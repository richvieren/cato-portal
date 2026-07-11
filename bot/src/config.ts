import 'dotenv/config';

export { ALERT_DURATIONS, ALERT_PRODUCTS } from './constants.js';

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export const config = {
  BOT_TOKEN: required('BOT_TOKEN'),
  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_SERVICE_KEY: required('SUPABASE_SERVICE_KEY'),
  OPENROUTER_API_KEY: required('OPENROUTER_API_KEY'),
  ASTROLOGY_API_KEY: required('ASTROLOGY_API_KEY'),
  ADMIN_CHAT_ID: Number(required('ADMIN_CHAT_ID')),
  CRON_TIMEZONE: process.env.CRON_TIMEZONE || 'Africa/Johannesburg',
  PORTAL_URL: process.env.PORTAL_URL || 'https://app.catovermeulen.com',
} as const;
