import Database from 'better-sqlite3';
import { ALERT_PRODUCTS, ALERT_DURATIONS } from '../constants.js';

const DB_PATH = process.env.CATO_DB_PATH || '/opt/cato/data/cato.db';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, { readonly: false });
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

// --- Types ---

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  telegram_chat_id: number | null;
}

export interface ProfileBirthData {
  dob: string | null;
  tob: string | null;
  city: string | null;
  country: string | null;
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

// --- Helpers ---

function parseJsonField<T>(value: string | null | undefined): T {
  if (!value) return null as unknown as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null as unknown as T;
  }
}

function hydrateNatalChart(row: any): NatalChart | null {
  if (!row) return null;
  return {
    user_id: row.user_id,
    planets: parseJsonField<Record<string, any>[]>(row.planets) || [],
    houses: parseJsonField<Record<string, any>[]>(row.houses) || [],
    aspects: parseJsonField<Record<string, any>[]>(row.aspects) || [],
    elements: parseJsonField<Record<string, any>>(row.elements) || {},
    modalities: parseJsonField<Record<string, any>>(row.modalities) || {},
    hemispheres: parseJsonField<Record<string, any>>(row.hemispheres) || {},
    stelliums: parseJsonField<Record<string, any>[]>(row.stelliums) || [],
    chart_ruler: parseJsonField<Record<string, any>>(row.chart_ruler),
  };
}

// --- Profile queries ---

export function findProfileByEmail(email: string): Profile | null {
  const row = getDb()
    .prepare('SELECT id, email, full_name, telegram_chat_id FROM profiles WHERE email = ?')
    .get(email.toLowerCase()) as Profile | undefined;
  return row ?? null;
}

export function getProfileBirthData(email: string): ProfileBirthData | null {
  const row = getDb()
    .prepare('SELECT dob, tob, city, country FROM profiles WHERE email = ?')
    .get(email.toLowerCase()) as ProfileBirthData | undefined;
  return row ?? null;
}

export function linkTelegram(email: string, chatId: number): boolean {
  try {
    getDb()
      .prepare('UPDATE profiles SET telegram_chat_id = ? WHERE email = ?')
      .run(chatId, email.toLowerCase());
    return true;
  } catch (err) {
    console.error('linkTelegram error:', err);
    return false;
  }
}

export function getChatIdForUser(userId: string): number | null {
  const row = getDb()
    .prepare('SELECT telegram_chat_id FROM profiles WHERE id = ?')
    .get(userId) as { telegram_chat_id: number | null } | undefined;
  return row?.telegram_chat_id ?? null;
}

export function markChatIdInactive(userId: string): void {
  getDb()
    .prepare('UPDATE profiles SET telegram_chat_id = NULL WHERE id = ?')
    .run(userId);
}

// --- Grant queries ---

export function getActiveAlertGrants(email: string): Grant[] {
  const rows = getDb()
    .prepare(
      `SELECT id, email, product, granted_at, expires_at
       FROM access_grants
       WHERE email = ? AND product IN (${ALERT_PRODUCTS.map(() => '?').join(',')}) AND revoked_at IS NULL`,
    )
    .all(email.toLowerCase(), ...ALERT_PRODUCTS) as Grant[];

  const now = new Date();
  return rows.filter(g => {
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

export function getCourseGrant(email: string): Grant | null {
  const row = getDb()
    .prepare(
      `SELECT id, email, product, granted_at, expires_at
       FROM access_grants
       WHERE email = ? AND product = 'course' AND revoked_at IS NULL
       LIMIT 1`,
    )
    .get(email.toLowerCase()) as Grant | undefined;
  return row ?? null;
}

// --- Alert queries ---

export function getTodayAlerts(): Alert[] {
  const today = new Date().toISOString().split('T')[0];
  return getDb()
    .prepare(
      'SELECT id, user_id, email, send_date, body_text FROM telegram_alerts WHERE send_date = ? AND sent_at IS NULL',
    )
    .all(today) as Alert[];
}

export function markAlertSent(alertId: string): void {
  getDb()
    .prepare('UPDATE telegram_alerts SET sent_at = datetime(\'now\') WHERE id = ?')
    .run(alertId);
}

export function insertAlerts(alerts: NewAlert[]): void {
  if (alerts.length === 0) return;
  const insert = getDb().prepare(
    `INSERT OR IGNORE INTO telegram_alerts (id, user_id, email, send_date, body_text)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const insertMany = getDb().transaction((rows: NewAlert[]) => {
    for (const row of rows) {
      const id = crypto.randomUUID();
      insert.run(id, row.user_id, row.email, row.send_date, row.body_text);
    }
  });
  insertMany(alerts);
}

export function getActiveAlertUsers(): AlertUser[] {
  const profiles = getDb()
    .prepare('SELECT id, email, telegram_chat_id FROM profiles WHERE telegram_chat_id IS NOT NULL')
    .all() as { id: string; email: string; telegram_chat_id: number }[];

  const result: AlertUser[] = [];
  for (const p of profiles) {
    const grants = getActiveAlertGrants(p.email);
    for (const g of grants) {
      result.push({
        user_id: p.id,
        email: p.email,
        telegram_chat_id: p.telegram_chat_id,
        product: g.product,
        granted_at: g.granted_at,
        expires_at: g.expires_at,
      });
    }
  }
  return result;
}

// --- Natal chart ---

export function getNatalChart(userId: string): NatalChart | null {
  const row = getDb()
    .prepare(
      'SELECT user_id, planets, houses, aspects, elements, modalities, hemispheres, stelliums, chart_ruler FROM natal_charts WHERE user_id = ?',
    )
    .get(userId);
  return hydrateNatalChart(row);
}

// --- Course queries ---

export function getCourseLesson(courseId: string, lessonNumber: number): Lesson | null {
  const row = getDb()
    .prepare('SELECT * FROM course_lessons WHERE course_id = ? AND lesson_number = ?')
    .get(courseId, lessonNumber) as Lesson | undefined;
  return row ?? null;
}

export function getCompletedLessons(userId: string): string[] {
  const rows = getDb()
    .prepare('SELECT lesson_id FROM course_progress WHERE user_id = ?')
    .all(userId) as { lesson_id: string }[];
  return rows.map(r => r.lesson_id);
}

export function markLessonComplete(userId: string, lessonId: string): void {
  getDb()
    .prepare('INSERT OR IGNORE INTO course_progress (user_id, lesson_id) VALUES (?, ?)')
    .run(userId, lessonId);
}

export function getLessonCount(courseId: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) as count FROM course_lessons WHERE course_id = ?')
    .get(courseId) as { count: number };
  return row?.count ?? 0;
}

export function upsertLesson(lesson: NewLesson): void {
  getDb()
    .prepare(
      `INSERT INTO course_lessons (id, course_id, lesson_number, title, body_text, voice_note_url, image_url, drip_delay_hours)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(course_id, lesson_number) DO UPDATE SET
         title = excluded.title,
         body_text = excluded.body_text,
         voice_note_url = excluded.voice_note_url,
         image_url = excluded.image_url,
         drip_delay_hours = excluded.drip_delay_hours`,
    )
    .run(
      crypto.randomUUID(),
      lesson.course_id,
      lesson.lesson_number,
      lesson.title,
      lesson.body_text,
      lesson.voice_note_url ?? null,
      lesson.image_url ?? null,
      lesson.drip_delay_hours ?? 24,
    );
}

export function deleteLesson(lessonId: string): void {
  getDb()
    .prepare('DELETE FROM course_lessons WHERE id = ?')
    .run(lessonId);
}

export function listLessons(courseId: string): LessonSummary[] {
  return getDb()
    .prepare(
      'SELECT id, course_id, lesson_number, title FROM course_lessons WHERE course_id = ? ORDER BY lesson_number',
    )
    .all(courseId) as LessonSummary[];
}
