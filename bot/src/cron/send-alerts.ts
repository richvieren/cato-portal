import { Bot } from 'grammy';
import { getTodayAlerts, getChatIdForUser, markAlertSent, markChatIdInactive } from '../services/database.js';
import type { BotContext } from '../types.js';

const SEND_DELAY_MS = 100;

export async function sendDailyAlerts(bot: Bot<BotContext>): Promise<{
  sent: number;
  skipped: number;
  failed: number;
}> {
  const alerts = await getTodayAlerts();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`Daily alert send: ${alerts.length} alerts to process`);

  for (const alert of alerts) {
    const chatId = await getChatIdForUser(alert.user_id);

    if (!chatId) {
      skipped++;
      continue;
    }

    try {
      await bot.api.sendMessage(chatId, alert.body_text, {
        protect_content: true,
        parse_mode: 'Markdown',
      });
      await markAlertSent(alert.id);
      sent++;
    } catch (err: any) {
      if (err?.error_code === 403) {
        console.log(`User ${alert.email} blocked bot — marking inactive`);
        await markChatIdInactive(alert.user_id);
        await markAlertSent(alert.id);
        failed++;
      } else {
        console.error(`Failed to send alert to ${alert.email}:`, err);
        failed++;
      }
    }

    await new Promise(r => setTimeout(r, SEND_DELAY_MS));
  }

  console.log(`Daily alert send complete: ${sent} sent, ${skipped} skipped (no Telegram), ${failed} failed`);
  return { sent, skipped, failed };
}
