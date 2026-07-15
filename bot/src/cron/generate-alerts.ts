import { getNatalChart, insertAlerts, getActiveAlertUsers, getProfileBirthData } from '../services/database.js';
import { fetchTransitAspects, NatalBirthData, TransitAspect } from '../services/astrology.js';
import { formatTransitsForPrompt, formatNatalChartForPrompt, formatTransitHeader } from '../services/transits.js';
import { generateAlertText } from '../services/glm.js';
import { ALERT_DURATIONS } from '../constants.js';
import type { NewAlert } from '../services/database.js';

/**
 * Build a signature string from outer planet aspects (excluding Moon).
 * Used to detect when the transit picture actually changes day-to-day.
 * Slow-moving planets (Neptune, Pluto, Uranus) can hold the same aspect
 * for weeks — we only alert when something NEW enters the picture.
 */
function outerPlanetSignature(aspects: TransitAspect[]): string {
  return aspects
    .filter(a => a.transitPlanet !== 'Moon')
    .map(a => `${a.transitPlanet}-${a.aspectType}-${a.natalPoint}`)
    .sort()
    .join('|');
}

/**
 * Return aspects that are genuinely new compared to the previous day.
 * A "new" aspect = an outer planet aspect not present yesterday,
 * OR any Moon hard aspect (those change daily and add flavor).
 */
function getNewAspects(
  todayAspects: TransitAspect[],
  prevSignature: string,
): TransitAspect[] {
  const prevSet = new Set(prevSignature.split('|').filter(Boolean));
  return todayAspects.filter(a => {
    if (a.transitPlanet === 'Moon') return true; // Moon aspects always count as new
    const sig = `${a.transitPlanet}-${a.aspectType}-${a.natalPoint}`;
    return !prevSet.has(sig);
  });
}

async function getNatalBirthData(email: string): Promise<NatalBirthData | null> {
  // We need the raw birth data to call the transit endpoint
  // This comes from the profiles table
  const data = getProfileBirthData(email);

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
  let prevOuterSig = '';

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];

    try {
      const transitData = await fetchTransitAspects(birthData, currentDate);

      // Skip days with zero transits
      if (transitData.aspects.length === 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      const todaySig = outerPlanetSignature(transitData.aspects);
      const newAspects = getNewAspects(transitData.aspects, prevOuterSig);

      // Always update the signature for comparison, even if we skip
      prevOuterSig = todaySig;

      // Skip if no new outer planet aspects entered the picture.
      // Moon-only days are skipped too — Moon hard aspects add flavor
      // to an alert but don't warrant a standalone notification.
      const hasNewOuterAspect = newAspects.some(a => a.transitPlanet !== 'Moon');
      if (!hasNewOuterAspect) {
        console.log(`Skipping ${email} on ${dateStr} — same outer transits as previous day`);
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
