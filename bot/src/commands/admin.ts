import { Bot, InlineKeyboard } from 'grammy';
import { config } from '../config.js';
import { upsertLesson, deleteLesson, listLessons } from '../services/database.js';
import { backfillExistingClients } from '../cron/generate-alerts.js';
import type { BotContext } from '../types.js';

function isAdmin(chatId: number): boolean {
  return chatId === config.ADMIN_CHAT_ID;
}

export function registerAdminCommands(bot: Bot<BotContext>) {
  bot.command('admin', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) return;
    await ctx.reply(
      "✨ Admin commands:\n\n" +
      "/addlesson — Add a new lesson (guided)\n" +
      "/listlessons — List all lessons in a course\n" +
      "/deletelesson — Delete a lesson\n" +
      "/backfill — Generate alerts for all clients",
    );
  });

  // /addlesson — guided flow, no args needed
  bot.command('addlesson', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) return;

    ctx.session.pendingLesson = {
      courseId: '',
      lessonNumber: 0,
      title: '',
      step: 'awaiting_course',
    };

    await ctx.reply(
      "📚 Let's add a lesson.\n\n" +
      "Which course is this for? Type the course name (e.g. sovereign, introduction):",
    );
  });

  // Handle all admin text input based on pendingLesson step
  bot.on('message:text', async (ctx, next) => {
    if (!isAdmin(ctx.chat.id) || !ctx.session.pendingLesson) {
      await next();
      return;
    }

    const pending = ctx.session.pendingLesson;
    const text = ctx.message.text.trim();

    // Skip if it's a command
    if (text.startsWith('/')) {
      await next();
      return;
    }

    switch (pending.step) {
      case 'awaiting_course':
        pending.courseId = text.toLowerCase().replace(/\s+/g, '-');
        pending.step = 'awaiting_number';
        await ctx.reply(`Course: "${pending.courseId}"\n\nWhat lesson number? (e.g. 1, 2, 3):`);
        break;

      case 'awaiting_number':
        const num = parseInt(text);
        if (isNaN(num)) {
          await ctx.reply("🤔 That's not a number. Try again:");
          return;
        }
        pending.lessonNumber = num;
        pending.step = 'awaiting_title';
        await ctx.reply(`Lesson ${num}.\n\nWhat's the title?`);
        break;

      case 'awaiting_title':
        pending.title = text;
        pending.step = 'awaiting_text';
        await ctx.reply(`Title: "${text}"\n\nNow send me the lesson content. Type or paste the full text:`);
        break;

      case 'awaiting_text':
        pending.bodyText = text;
        pending.step = 'awaiting_voice';
        await ctx.reply("Got the text.\n\nWant to add a voice note? Send one now, or type /skip");
        break;

      default:
        await next();
    }
  });

  // Voice note for lesson
  bot.on('message:voice', async (ctx) => {
    if (!isAdmin(ctx.chat.id) || !ctx.session.pendingLesson) return;

    const pending = ctx.session.pendingLesson;
    if (pending.step === 'awaiting_voice') {
      pending.voiceNoteUrl = ctx.message.voice.file_id;
      pending.step = 'awaiting_image';
      await ctx.reply("Got the voice note.\n\nWant to add an image? Send one now, or type /skip");
    }
  });

  // Image for lesson
  bot.on('message:photo', async (ctx) => {
    if (!isAdmin(ctx.chat.id) || !ctx.session.pendingLesson) return;

    const pending = ctx.session.pendingLesson;
    if (pending.step === 'awaiting_image') {
      const photos = ctx.message.photo;
      pending.imageUrl = photos[photos.length - 1].file_id;
      await saveLesson(ctx);
    }
  });

  // /skip — skip optional fields
  bot.command('skip', async (ctx) => {
    if (!isAdmin(ctx.chat.id) || !ctx.session.pendingLesson) return;

    const pending = ctx.session.pendingLesson;
    if (pending.step === 'awaiting_voice') {
      pending.step = 'awaiting_image';
      await ctx.reply("Skipped voice note.\n\nWant to add an image? Send one now, or type /skip");
    } else if (pending.step === 'awaiting_image') {
      await saveLesson(ctx);
    }
  });

  // /cancel — cancel lesson in progress
  bot.command('cancel', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) return;
    if (ctx.session.pendingLesson) {
      ctx.session.pendingLesson = undefined;
      await ctx.reply("Cancelled. No lesson saved.");
    }
  });

  // /listlessons
  bot.command('listlessons', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) return;

    const courseId = ctx.match?.trim();
    if (!courseId) {
      await ctx.reply("Which course? Type the name after the command, e.g.:\n/listlessons sovereign");
      return;
    }

    const lessons = await listLessons(courseId);
    if (lessons.length === 0) {
      await ctx.reply(`No lessons found for "${courseId}".`);
      return;
    }

    const list = lessons.map(l => `${l.lesson_number}. ${l.title}`).join('\n');
    await ctx.reply(`📚 Lessons in "${courseId}":\n\n${list}`);
  });

  // /deletelesson
  bot.command('deletelesson', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) return;

    const lessonId = ctx.match?.trim();
    if (!lessonId) {
      await ctx.reply("Usage: /deletelesson <lesson_id>\n\nUse /listlessons to find the ID.");
      return;
    }

    await deleteLesson(lessonId);
    await ctx.reply(`Lesson deleted.`);
  });

  // /backfill
  bot.command('backfill', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) return;

    await ctx.reply("⏳ Starting backfill... This may take a while.");

    try {
      await backfillExistingClients();
      await ctx.reply("✅ Backfill complete! All existing clients now have pre-generated alerts.");
    } catch (err) {
      console.error('Backfill error:', err);
      await ctx.reply(`❌ Backfill failed: ${err}`);
    }
  });
}

async function saveLesson(ctx: BotContext): Promise<void> {
  const pending = ctx.session.pendingLesson;
  if (!pending || !pending.bodyText) {
    await ctx.reply("Something went wrong. Try again with /addlesson");
    ctx.session.pendingLesson = undefined;
    return;
  }

  await upsertLesson({
    course_id: pending.courseId,
    lesson_number: pending.lessonNumber,
    title: pending.title,
    body_text: pending.bodyText,
    voice_note_url: pending.voiceNoteUrl || null,
    image_url: pending.imageUrl || null,
  });

  await ctx.reply(
    `✅ Lesson saved!\n\n` +
    `Course: ${pending.courseId}\n` +
    `Lesson: ${pending.lessonNumber}\n` +
    `Title: ${pending.title}\n` +
    `Voice: ${pending.voiceNoteUrl ? 'Yes' : 'No'}\n` +
    `Image: ${pending.imageUrl ? 'Yes' : 'No'}\n\n` +
    `Send /addlesson to add another.`,
  );

  ctx.session.pendingLesson = undefined;
}
