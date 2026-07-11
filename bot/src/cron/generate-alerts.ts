import { getNatalChart, insertAlerts, getActiveAlertUsers, findProfileByEmail } from '../services/supabase.js';
import { fetchTransitAspects, NatalBirthData } from '../services/astrology.js';
import { formatTransitsForPrompt, formatNatalChartForPrompt, formatTransitHeader } from '../services/transits.js';
import { generateAlertText } from '../services/glm.js';
import { ALERT_DURATIONS } from '../constants.js';
import type { NewAlert } from '../services/supabase.js';

async function getNatalBirthData(email: string): Promise<NatalBirthData | null> {
  // We need the raw birth data to call the transit endpoint
  // This comes from the profiles table
  const { createClient } = await import('@supabase/supabase-js');
  const { config } = await import('../config.js');
  const sb = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);

  const { data } = await sb
    .from('profiles')
    .select('dob, tob, city, country')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (!data || !data.dob || !data.city) return null;

  // Geocode the birth city
  const geoRes = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(data.city + ', ' + (data.country || ''))}&format=json&limit=1`,
    { headers: { 'User-Agent': 'cato-bot/1.0' } },
  );
  const geoResults = await geoRes.json();
  if (!geoResults.length) return null;

  const lat = parseFloat(geoResults[0].lat);
  const lon = parseFloat(geoResults[0].lon);

  const tzRes = await fetch(
    `https://timeapi.io/api/timezone/coordinate?latitude=${lat}&longitude=${lon}`,
  );
  const tzData = await tzRes.json();
  const tzone = (tzData.currentUtcOffset?.seconds ?? 0) / 3600;

  const [year, month, day] = data.dob.split('-').map(Number);
  const [hour, minute] = (data.tob || '12:00:00').split(':').map(Number);

  return { year, month, day, hour, minute, lat, lon, tzone };
}

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

  const birthData = await getNatalBirthData(email);
  if (!birthData) {
    console.error(`No birth data for ${email} — skipping alert generation`);
    return 0;
  }

  const chartContext = formatNatalChartForPrompt(chart);
  const alerts: NewAlert[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];

    try {
      const transitData = await fetchTransitAspects(birthData, currentDate);

      // Skip quiet days — only generate alerts when there are actual transits
      if (transitData.aspects.length === 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      const transitContext = formatTransitsForPrompt(transitData);
      const header = formatTransitHeader(transitData.aspects);

      let bodyText: string;
      try {
        bodyText = await generateAlertText(chartContext, transitContext);
      } catch (glmErr) {
        console.error(`GLM failed for ${email} on ${dateStr}, retrying once...`);
        try {
          bodyText = await generateAlertText(chartContext, transitContext);
        } catch {
          console.error(`GLM retry failed for ${email} on ${dateStr}, skipping`);
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }
      }

      const fullMessage = header
        ? `🔮 _${header}_\n\n${bodyText}`
        : `🔮\n\n${bodyText}`;

      alerts.push({ user_id: userId, email, send_date: dateStr, body_text: fullMessage });
    } catch (err) {
      console.error(`Failed to process ${email} on ${dateStr}:`, err);
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
