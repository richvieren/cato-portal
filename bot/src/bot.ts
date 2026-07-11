import { Bot } from 'grammy';
import { config } from './config.js';

const bot = new Bot(config.BOT_TOKEN);

bot.command('ping', (ctx) => ctx.reply('pong'));

// Error handler
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Start in long-polling mode for development
// Production uses webhooks (configured in deployment task)
bot.start({
  onStart: () => console.log('CatoVermeulenBot started'),
});
