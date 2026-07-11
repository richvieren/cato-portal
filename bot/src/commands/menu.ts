import { Bot, InlineKeyboard } from 'grammy';
import { config } from '../config.js';
import type { BotContext } from '../types.js';

const productMenu = new InlineKeyboard()
  .url('Transit Reading — 3 months of daily alerts', config.PORTAL_URL)
  .row()
  .url('Evergreen Queen — 6-month program', config.PORTAL_URL)
  .row()
  .url('Legacy Leaders — 6-month program', config.PORTAL_URL)
  .row()
  .url('Introduction Course', config.PORTAL_URL);

export async function showProductMenu(ctx: BotContext): Promise<void> {
  await ctx.reply(
    "Explore Cato's offerings:",
    { reply_markup: productMenu },
  );
}

export function registerMenuCommand(bot: Bot<BotContext>) {
  bot.command('menu', async (ctx) => {
    await showProductMenu(ctx);
  });
}
