import { getNatalChart, insertAlerts, getActiveAlertUsers } from '../services/supabase.js';
import { fetchDailyTransits } from '../services/astrology.js';
import { detectSignificantTransits, formatTransitsForPrompt, formatNatalChartForPrompt } from '../services/transits.js';
import { generateAlertText, generateQuietDayText } from '../services/glm.js';
import { ALERT_DURATIONS } from '../constants.js';
import type { NewAlert } from '../services/supabase.js';

const FALLBACK_TEMPLATE = (date: Date): string =>
  `Your cosmic weather for ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}. Take stock of where your energy is today and direct it toward your highest-priority business goal.`;

export async function generateAlertsForUser(
  userId: string,
  email: string,
  startDate: Date,
  endDate: Date,
): Promise<number> {
  const chart = await getNatalChart(userId);
  if (!chart) {
    console.error(`No natal chart for user ${userId} — skipping alert generation`);
    return 0;
  }

  const chartContext = formatNatalChartForPrompt(chart);
  const alerts: NewAlert[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];

    try {
      const transitData = await fetchDailyTransits(currentDate);
      const significant = detectSignificantTransits(transitData, chart);

      let bodyText: string;

      if (significant.length > 0) {
        const transitContext = formatTransitsForPrompt(significant, currentDate);
        try {
          bodyText = await generateAlertText(chartContext, transitContext);
        } catch (glmErr) {
          console.error(`GLM failed for ${email} on ${dateStr}, retrying once...`);
          try {
            bodyText = await generateAlertText(chartContext, transitContext);
          } catch {
            console.error(`GLM retry failed for ${email} on ${dateStr}, using fallback`);
            bodyText = FALLBACK_TEMPLATE(currentDate);
          }
        }
      } else {
        try {
          bodyText = await generateQuietDayText(chartContext, currentDate);
        } catch {
          bodyText = FALLBACK_TEMPLATE(currentDate);
        }
      }

      alerts.push({ user_id: userId, email, send_date: dateStr, body_text: bodyText });
    } catch (err) {
      console.error(`Failed to generate alert for ${email} on ${dateStr}:`, err);
      alerts.push({ user_id: userId, email, send_date: dateStr, body_text: FALLBACK_TEMPLATE(currentDate) });
    }

    await new Promise(r => setTimeout(r, 500));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  await insertAlerts(alerts);
  console.log(`Generated ${alerts.length} alerts for ${email} (${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]})`);
  return alerts.length;
}

export async function backfillExistingClients(): Promise<void> {
  console.log('Starting backfill for existing clients...');
  const users = await getActiveAlertUsers();

  for (const user of users) {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let endDate: Date;
    if (user.expires_at) {
      endDate = new Date(user.expires_at);
    } else {
      const duration = ALERT_DURATIONS[user.product] || 90;
      endDate = new Date(user.granted_at);
      endDate.setDate(endDate.getDate() + duration);
    }

    if (endDate < now) {
      console.log(`Grant expired for ${user.email} (${user.product}) — skipping`);
      continue;
    }

    const count = await generateAlertsForUser(user.user_id, user.email, tomorrow, endDate);
    console.log(`Backfilled ${count} alerts for ${user.email}`);
  }

  console.log('Backfill complete.');
}
