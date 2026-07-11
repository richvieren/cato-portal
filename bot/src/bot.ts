import { Bot, session } from 'grammy';
import cron from 'node-cron';
import { config } from './config.js';
import { registerStartCommand } from './commands/start.js';
import { registerMenuCommand } from './commands/menu.js';
import { registerCourseCommand } from './commands/course.js';
import { registerAdminCommands } from './commands/admin.js';
import { sendDailyAlerts } from './cron/send-alerts.js';
import type { BotContext, SessionData } from './types.js';

const bot = new Bot<BotContext>(config.BOT_TOKEN);

// Session middleware
bot.use(session({ initial: (): SessionData => ({}) }));

// Register commands (order matters — admin text handler must come before start's)
bot.command('ping', (ctx) => ctx.reply('pong'));
registerAdminCommands(bot);
registerCourseCommand(bot);
registerStartCommand(bot);
registerMenuCommand(bot);

// Daily alert cron — 7:00 AM configured timezone
cron.schedule('0 7 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Running daily alert send...`);
  try {
    await sendDailyAlerts(bot);
  } catch (err) {
    console.error('Daily alert cron failed:', err);
  }
}, { timezone: config.CRON_TIMEZONE });

// Error handler
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Start
bot.start({
  onStart: () => {
    console.log('CatoVermeulenBot started');
    console.log(`Daily alerts scheduled for 07:00 ${config.CRON_TIMEZONE}`);
  },
});

export { bot };
