import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { ALERT_PRODUCTS, ALERT_DURATIONS } from '../constants.js';

const supabase: SupabaseClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_KEY,
);

// --- Types ---

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  telegram_chat_id: number | null;
}

export interface Grant {
  id: string;
  email: string;
  product: string;
  granted_at: string;
  expires_at: string | null;
}

export interface NatalChart {
  user_id: string;
  planets: Record<string, any>[];
  houses: Record<string, any>[];
  aspects: Record<string, any>[];
  elements: Record<string, any>;
  modalities: Record<string, any>;
  hemispheres: Record<string, any>;
  stelliums: Record<string, any>[];
  chart_ruler: Record<string, any> | null;
}

export interface Alert {
  id: string;
  user_id: string;
  email: string;
  send_date: string;
  body_text: string;
}

export interface NewAlert {
  user_id: string;
  email: string;
  send_date: string;
  body_text: string;
}

export interface AlertUser {
  user_id: string;
  email: string;
  telegram_chat_id: number;
  product: string;
  granted_at: string;
  expires_at: string | null;
}

export interface Lesson {
  id: string;
  course_id: string;
  lesson_number: number;
  title: string;
  body_text: string;
  voice_note_url: string | null;
  image_url: string | null;
  drip_delay_hours: number;
}

export interface LessonSummary {
  id: string;
  course_id: string;
  lesson_number: number;
  title: string;
}

export interface NewLesson {
  course_id: string;
  lesson_number: number;
  title: string;
  body_text: string;
  voice_note_url?: string | null;
  image_url?: string | null;
  drip_delay_hours?: number;
}

// --- Profile queries ---

export async function findProfileByEmail(email: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, telegram_chat_id')
    .eq('email', email.toLowerCase())
    .limit(1)
    .maybeSingle();
  if (error) { console.error('findProfileByEmail error:', error); return null; }
  return data;
}

export async function linkTelegram(email: string, chatId: number): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ telegram_chat_id: chatId })
    .eq('email', email.toLowerCase());
  if (error) { console.error('linkTelegram error:', error); return false; }
  return true;
}

export async function getChatIdForUser(userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('telegram_chat_id')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.telegram_chat_id;
}

export async function markChatIdInactive(userId: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ telegram_chat_id: null })
    .eq('id', userId);
}

// --- Grant queries ---

export async function getActiveAlertGrants(email: string): Promise<Grant[]> {
  const { data, error } = await supabase
    .from('access_grants')
    .select('id, email, product, granted_at, expires_at')
    .eq('email', email.toLowerCase())
    .in('product', ALERT_PRODUCTS)
    .is('revoked_at', null)
    .returns<Grant[]>();
  if (error) { console.error('getActiveAlertGrants error:', error); return []; }
  const now = new Date();
  return (data || []).filter(g => {
    if (g.expires_at && new Date(g.expires_at) < now) return false;
    if (!g.expires_at && g.granted_at) {
      const duration = ALERT_DURATIONS[g.product];
      if (duration) {
        const expiry = new Date(g.granted_at);
        expiry.setDate(expiry.getDate() + duration);
        if (expiry < now) return false;
      }
    }
    return true;
  });
}

// --- Alert queries ---

export async function getTodayAlerts(): Promise<Alert[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('telegram_alerts')
    .select('id, user_id, email, send_date, body_text')
    .eq('send_date', today)
    .is('sent_at', null)
    .returns<Alert[]>();
  if (error) { console.error('getTodayAlerts error:', error); return []; }
  return data || [];
}

export async function markAlertSent(alertId: string): Promise<void> {
  await supabase
    .from('telegram_alerts')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', alertId);
}

export async function insertAlerts(alerts: NewAlert[]): Promise<void> {
  if (alerts.length === 0) return;
  for (let i = 0; i < alerts.length; i += 500) {
    const batch = alerts.slice(i, i + 500);
    const { error } = await supabase.from('telegram_alerts').insert(batch);
    if (error) console.error('insertAlerts batch error:', error);
  }
}

export async function getActiveAlertUsers(): Promise<AlertUser[]> {
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, email, telegram_chat_id')
    .not('telegram_chat_id', 'is', null);
  if (pErr || !profiles) return [];

  const result: AlertUser[] = [];
  for (const p of profiles) {
    const grants = await getActiveAlertGrants(p.email);
    for (const g of grants) {
      result.push({
        user_id: p.id,
        email: p.email,
        telegram_chat_id: p.telegram_chat_id!,
        product: g.product,
        granted_at: g.granted_at,
        expires_at: g.expires_at,
      });
    }
  }
  return result;
}

// --- Natal chart ---

export async function getNatalChart(userId: string): Promise<NatalChart | null> {
  const { data, error } = await supabase
    .from('natal_charts')
    .select('user_id, planets, houses, aspects, elements, modalities, hemispheres, stelliums, chart_ruler')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) { console.error('getNatalChart error:', error); return null; }
  return data;
}

// --- Course queries ---

export async function getCourseGrant(email: string): Promise<Grant | null> {
  const { data, error } = await supabase
    .from('access_grants')
    .select('id, email, product, granted_at, expires_at')
    .eq('email', email.toLowerCase())
    .eq('product', 'course')
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle();
  if (error) { console.error('getCourseGrant error:', error); return null; }
  return data;
}

export async function getCourseLesson(courseId: string, lessonNumber: number): Promise<Lesson | null> {
  const { data, error } = await supabase
    .from('course_lessons')
    .select('*')
    .eq('course_id', courseId)
    .eq('lesson_number', lessonNumber)
    .maybeSingle();
  if (error) { console.error('getCourseLesson error:', error); return null; }
  return data;
}

export async function getCompletedLessons(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('course_progress')
    .select('lesson_id')
    .eq('user_id', userId);
  if (error) { console.error('getCompletedLessons error:', error); return []; }
  return (data || []).map(r => r.lesson_id);
}

export async function markLessonComplete(userId: string, lessonId: string): Promise<void> {
  await supabase
    .from('course_progress')
    .upsert({ user_id: userId, lesson_id: lessonId }, { onConflict: 'user_id,lesson_id' });
}

export async function getLessonCount(courseId: string): Promise<number> {
  const { count, error } = await supabase
    .from('course_lessons')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId);
  if (error) { console.error('getLessonCount error:', error); return 0; }
  return count || 0;
}

export async function upsertLesson(lesson: NewLesson): Promise<void> {
  const { error } = await supabase
    .from('course_lessons')
    .upsert(lesson, { onConflict: 'course_id,lesson_number' });
  if (error) console.error('upsertLesson error:', error);
}

export async function deleteLesson(lessonId: string): Promise<void> {
  const { error } = await supabase
    .from('course_lessons')
    .delete()
    .eq('id', lessonId);
  if (error) console.error('deleteLesson error:', error);
}

export async function listLessons(courseId: string): Promise<LessonSummary[]> {
  const { data, error } = await supabase
    .from('course_lessons')
    .select('id, course_id, lesson_number, title')
    .eq('course_id', courseId)
    .order('lesson_number');
  if (error) { console.error('listLessons error:', error); return []; }
  return data || [];
}
