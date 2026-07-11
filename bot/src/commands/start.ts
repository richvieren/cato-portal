import { Bot } from 'grammy';
import { findProfileByEmail, linkTelegram, getActiveAlertGrants, getCourseGrant } from '../services/supabase.js';
import { showProductMenu } from './menu.js';
import type { BotContext } from '../types.js';

export function registerStartCommand(bot: Bot<BotContext>) {
  bot.command('start', async (ctx) => {
    const source = ctx.match || 'direct';
    ctx.session.awaitingEmail = true;
    ctx.session.source = source;

    await ctx.reply(
      "Welcome! I'm Cato's astrology bot. I deliver personalized transit alerts and course lessons based on your chart.\n\n" +
      "To connect your account, send me the email you used at checkout.",
    );
  });

  bot.on('message:text', async (ctx, next) => {
    if (ctx.session.pendingLesson || !ctx.session.awaitingEmail) {
      await next();
      return;
    }

    const email = ctx.message.text.trim().toLowerCase();

    if (!email.includes('@') || !email.includes('.')) {
      await ctx.reply("That doesn't look like an email address. Try again.");
      return;
    }

    const profile = await findProfileByEmail(email);

    if (!profile) {
      await ctx.reply(
        "I couldn't find that email. Make sure it's the one you used at checkout.\n\n" +
        "Try again or contact hello@catovermeulen.com",
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
        `You're verified!\n\nActive access: ${products}\n\nYour daily transit alerts start tomorrow morning at 7am. Sit tight.`,
      );
    } else if (courseGrant) {
      await ctx.reply(
        "You're verified!\n\nYour course is connected. Use /course to start your lessons.",
      );
    } else {
      await ctx.reply(
        "I found your account! You don't have an active transit subscription yet.\n\nHere's what's available:",
      );
      await showProductMenu(ctx);
    }

    console.log(`Telegram linked: ${email} (chat ${ctx.chat.id}, source: ${ctx.session.source || 'unknown'})`);
  });
}
