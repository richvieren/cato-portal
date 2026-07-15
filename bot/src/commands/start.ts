import { Bot } from 'grammy';
import { findProfileByEmail, linkTelegram, getActiveAlertGrants, getCourseGrant } from '../services/database.js';
import { showProductMenu } from './menu.js';
import type { BotContext } from '../types.js';

export function registerStartCommand(bot: Bot<BotContext>) {
  bot.command('start', async (ctx) => {
    const source = ctx.match || 'direct';
    ctx.session.awaitingEmail = true;
    ctx.session.source = source;

    await ctx.reply(
      "✨ Welcome to Cato's cosmic corner.\n\n" +
      "I deliver your personalized transit alerts and course content — right here in Telegram.\n\n" +
      "📩 Send me the email you used at checkout to activate.",
    );
  });

  bot.on('message:text', async (ctx, next) => {
    if (ctx.session.pendingLesson || !ctx.session.awaitingEmail) {
      await next();
      return;
    }

    const email = ctx.message.text.trim().toLowerCase();

    if (!email.includes('@') || !email.includes('.')) {
      await ctx.reply("🤔 That doesn't look like an email address. Try again.");
      return;
    }

    const profile = await findProfileByEmail(email);

    if (!profile) {
      await ctx.reply(
        "❌ I couldn't find that email.\n\n" +
        "Make sure it's the one you used at checkout, or contact hello@catovermeulen.com",
      );
      return;
    }

    const linked = await linkTelegram(email, ctx.chat.id);
    if (!linked) {
      await ctx.reply("Something went wrong linking your account. Contact hello@catovermeulen.com");
      ctx.session.awaitingEmail = false;
      return;
    }

    ctx.session.awaitingEmail = false;

    const alertGrants = await getActiveAlertGrants(email);
    const courseGrant = await getCourseGrant(email);

    if (alertGrants.length > 0) {
      const products = alertGrants.map(g => g.product.replace(/_/g, ' ')).join(', ');
      await ctx.reply(
        `🔮 You're in!\n\n` +
        `Active: ${products}\n\n` +
        `Your personalized daily transit alerts start tomorrow at 7am. ☀️`,
      );
    } else if (courseGrant) {
      await ctx.reply(
        "🔮 You're in!\n\n" +
        "Your course is ready. Tap /course to start your first lesson. 📚",
      );
    } else {
      await ctx.reply(
        "✅ Found your account!\n\n" +
        "You don't have an active transit subscription yet. Here's what's available 👇",
      );
      await showProductMenu(ctx);
    }

    console.log(`Telegram linked: ${email} (chat ${ctx.chat.id}, source: ${ctx.session.source || 'unknown'})`);
  });
}
