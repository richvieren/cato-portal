import { Bot } from 'grammy';
import { config } from '../config.js';
import { upsertLesson, deleteLesson, listLessons } from '../services/supabase.js';
import { backfillExistingClients } from '../cron/generate-alerts.js';
import type { BotContext } from '../types.js';

function isAdmin(chatId: number): boolean {
  return chatId === config.ADMIN_CHAT_ID;
}

export function registerAdminCommands(bot: Bot<BotContext>) {
  bot.command('admin', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) return;
    await ctx.reply(
      "Admin commands:\n\n" +
      "/addlesson <course_id> <lesson_number> <title>\n" +
      "  Then send the lesson text\n\n" +
      "/listlessons <course_id>\n" +
      "  List all lessons in a course\n\n" +
      "/deletelesson <lesson_id>\n" +
      "  Delete a lesson by ID\n\n" +
      "/backfill\n" +
      "  Generate alerts for all existing clients",
    );
  });

  bot.command('addlesson', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) return;

    const parts = ctx.match?.split(' ');
    if (!parts || parts.length < 3) {
      await ctx.reply("Usage: /addlesson <course_id> <lesson_number> <title>\nExample: /addlesson introduction 1 Your Saturn Return");
      return;
    }

    const courseId = parts[0];
    const lessonNumber = parseInt(parts[1]);
    const title = parts.slice(2).join(' ');

    if (isNaN(lessonNumber)) {
      await ctx.reply("Lesson number must be a number.");
      return;
    }

    ctx.session.pendingLesson = {
      courseId,
      lessonNumber,
      title,
      step: 'awaiting_text',
    };

    await ctx.reply(`Adding lesson ${lessonNumber} to "${courseId}": "${title}"\n\nNow send me the lesson text.`);
  });

  bot.on('message:text', async (ctx, next) => {
    if (!isAdmin(ctx.chat.id) || !ctx.session.pendingLesson) {
      await next();
      return;
    }

    const pending = ctx.session.pendingLesson;

    if (pending.step === 'awaiting_text') {
      pending.bodyText = ctx.message.text;
      pending.step = 'awaiting_voice';
      await ctx.reply("Got the text. Now send a voice note for this lesson, or type /skip to skip.");
      return;
    }
  });

  bot.on('message:voice', async (ctx) => {
    if (!isAdmin(ctx.chat.id) || !ctx.session.pendingLesson) return;

    const pending = ctx.session.pendingLesson;
    if (pending.step === 'awaiting_voice') {
      pending.voiceNoteUrl = ctx.message.voice.file_id;
      pending.step = 'awaiting_image';
      await ctx.reply("Got the voice note. Now send an image, or type /skip to skip.");
    }
  });

  bot.on('message:photo', async (ctx) => {
    if (!isAdmin(ctx.chat.id) || !ctx.session.pendingLesson) return;

    const pending = ctx.session.pendingLesson;
    if (pending.step === 'awaiting_image') {
      const photos = ctx.message.photo;
      pending.imageUrl = photos[photos.length - 1].file_id;
      await saveLesson(ctx);
    }
  });

  bot.command('skip', async (ctx) => {
    if (!isAdmin(ctx.chat.id) || !ctx.session.pendingLesson) return;

    const pending = ctx.session.pendingLesson;
    if (pending.step === 'awaiting_voice') {
      pending.step = 'awaiting_image';
      await ctx.reply("Skipped voice note. Now send an image, or type /skip again to finish.");
    } else if (pending.step === 'awaiting_image') {
      await saveLesson(ctx);
    }
  });

  bot.command('listlessons', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) return;

    const courseId = ctx.match?.trim();
    if (!courseId) {
      await ctx.reply("Usage: /listlessons <course_id>");
      return;
    }

    const lessons = await listLessons(courseId);
    if (lessons.length === 0) {
      await ctx.reply(`No lessons found for course "${courseId}".`);
      return;
    }

    const list = lessons.map(l => `${l.lesson_number}. ${l.title} (${l.id})`).join('\n');
    await ctx.reply(`Lessons in "${courseId}":\n\n${list}`);
  });

  bot.command('deletelesson', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) return;

    const lessonId = ctx.match?.trim();
    if (!lessonId) {
      await ctx.reply("Usage: /deletelesson <lesson_id>");
      return;
    }

    await deleteLesson(lessonId);
    await ctx.reply(`Lesson ${lessonId} deleted.`);
  });

  bot.command('backfill', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) return;

    await ctx.reply("Starting backfill... This may take a while. I'll notify you when done.");

    try {
      await backfillExistingClients();
      await ctx.reply("Backfill complete! All existing clients now have pre-generated alerts.");
    } catch (err) {
      console.error('Backfill error:', err);
      await ctx.reply(`Backfill failed: ${err}`);
    }
  });
}

async function saveLesson(ctx: BotContext): Promise<void> {
  const pending = ctx.session.pendingLesson;
  if (!pending || !pending.bodyText) {
    await ctx.reply("Something went wrong. Try again with /addlesson.");
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
    `Lesson ${pending.lessonNumber} saved!\n` +
    `Course: ${pending.courseId}\n` +
    `Title: ${pending.title}\n` +
    `Text: ${pending.bodyText.substring(0, 50)}...\n` +
    `Voice: ${pending.voiceNoteUrl ? 'Yes' : 'No'}\n` +
    `Image: ${pending.imageUrl ? 'Yes' : 'No'}`,
  );

  ctx.session.pendingLesson = undefined;
}
