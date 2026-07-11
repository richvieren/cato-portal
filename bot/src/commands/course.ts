import { Bot, InlineKeyboard } from 'grammy';
import {
  getCourseLesson,
  getCompletedLessons,
  markLessonComplete,
  getLessonCount,
} from '../services/supabase.js';
import { showProductMenu } from './menu.js';
import type { BotContext } from '../types.js';

const DEFAULT_COURSE = 'introduction';

export function registerCourseCommand(bot: Bot<BotContext>) {
  bot.command('course', async (ctx) => {
    await sendNextLesson(ctx, DEFAULT_COURSE);
  });

  bot.callbackQuery(/^lesson_complete:(.+):(\d+)$/, async (ctx) => {
    const courseId = ctx.match[1];
    const lessonNumber = parseInt(ctx.match[2]);
    const userId = ctx.from.id.toString();

    const lesson = await getCourseLesson(courseId, lessonNumber);
    if (!lesson) {
      await ctx.answerCallbackQuery('Lesson not found');
      return;
    }

    await markLessonComplete(userId, lesson.id);
    await ctx.answerCallbackQuery('Lesson marked complete!');

    const totalLessons = await getLessonCount(courseId);
    if (lessonNumber < totalLessons) {
      const nextLesson = await getCourseLesson(courseId, lessonNumber + 1);
      if (nextLesson && nextLesson.drip_delay_hours > 0) {
        await ctx.reply(
          `Lesson ${lessonNumber + 1} unlocks in ${nextLesson.drip_delay_hours} hours. I'll ping you!`,
        );
        setTimeout(async () => {
          try {
            await sendLesson(ctx, courseId, lessonNumber + 1);
          } catch (err) {
            console.error('Failed to send next lesson:', err);
          }
        }, nextLesson.drip_delay_hours * 60 * 60 * 1000);
      } else if (nextLesson) {
        await sendLesson(ctx, courseId, lessonNumber + 1);
      }
    } else {
      await ctx.reply("You've completed the course!\n\nReady for the next level?");
      await showProductMenu(ctx);
    }
  });

  bot.callbackQuery(/^lesson_question:(.+):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      "Type your question and I'll pass it to Cato. She'll get back to you soon.",
    );
  });

  bot.callbackQuery(/^start_lesson:(.+):(\d+)$/, async (ctx) => {
    const courseId = ctx.match[1];
    const lessonNumber = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();
    await sendLesson(ctx, courseId, lessonNumber);
  });
}

async function sendNextLesson(ctx: BotContext, courseId: string): Promise<void> {
  const userId = ctx.from!.id.toString();
  const completed = await getCompletedLessons(userId);
  const totalLessons = await getLessonCount(courseId);

  if (totalLessons === 0) {
    await ctx.reply("No course content available yet. Check back soon!");
    return;
  }

  let nextNumber = 1;
  for (let i = 1; i <= totalLessons; i++) {
    const lesson = await getCourseLesson(courseId, i);
    if (lesson && !completed.includes(lesson.id)) {
      nextNumber = i;
      break;
    }
    if (i === totalLessons) {
      await ctx.reply("You've completed all lessons!");
      await showProductMenu(ctx);
      return;
    }
  }

  const keyboard = new InlineKeyboard()
    .text(`Start Lesson ${nextNumber}`, `start_lesson:${courseId}:${nextNumber}`);

  await ctx.reply(
    `Your course is ready! You're on lesson ${nextNumber} of ${totalLessons}.`,
    { reply_markup: keyboard },
  );
}

async function sendLesson(ctx: BotContext, courseId: string, lessonNumber: number): Promise<void> {
  const lesson = await getCourseLesson(courseId, lessonNumber);
  if (!lesson) {
    await ctx.reply("Lesson not found. Contact hello@catovermeulen.com");
    return;
  }

  const totalLessons = await getLessonCount(courseId);

  await ctx.reply(
    `*Lesson ${lessonNumber}/${totalLessons}: ${lesson.title}*\n\n${lesson.body_text}`,
    { parse_mode: 'Markdown', protect_content: true },
  );

  if (lesson.voice_note_url) {
    await ctx.replyWithVoice(lesson.voice_note_url, { protect_content: true });
  }

  if (lesson.image_url) {
    await ctx.replyWithPhoto(lesson.image_url, { protect_content: true });
  }

  const keyboard = new InlineKeyboard()
    .text('Complete', `lesson_complete:${courseId}:${lessonNumber}`)
    .text('Question', `lesson_question:${courseId}:${lessonNumber}`);

  await ctx.reply('Ready to continue?', { reply_markup: keyboard });
}
