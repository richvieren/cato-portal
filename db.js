// db.js — access_grants + profiles data layer
// Depends on window.sb from auth.js

/**
 * Fetch Mini Business Reading access grant for current user.
 * Returns grant row or null.
 */
async function getMiniReadingGrant() {
  const { data, error } = await window.sb
    .from('access_grants')
    .select('id, available_at, granted_at')
    .eq('product', 'mini_reading')
    .is('revoked_at', null)
    .maybeSingle();
  if (error) { console.error('getMiniReadingGrant error:', error); return null; }
  return data;
}

/**
 * Submit mini reading intake: upsert profile (birth data only) + set available_at + trigger pipeline.
 * Returns { error } or {}.
 */
async function submitMiniIntake(userId, fields) {
  // 1. Upsert profile (birth data only)
  const { error: profileErr } = await window.sb
    .from('profiles')
    .upsert({
      id: userId,
      email: fields.email,
      full_name: fields.full_name,
      dob: fields.dob,
      tob: fields.tob || null,
      city: fields.city,
      country: fields.country,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  if (profileErr) return { error: profileErr };

  // 2. Set available_at immediately via Edge Function
  const { data: { session } } = await window.sb.auth.getSession();
  const res = await fetch(
    `${window.SUPABASE_URL}/functions/v1/set-available-at`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ product: 'mini_reading' }),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body.error || 'Failed to set available_at' };
  }

  // 3. Trigger VPS pipeline
  await fetch('https://api.catovermeulen.com/mini-reading-portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  }).catch(err => console.error('Mini reading pipeline trigger failed:', err));

  return {};
}

/**
 * Fetch Blueprint access grant for current user.
 * Returns grant row or null.
 */
async function getBlueprintGrant() {
  const { data, error } = await window.sb
    .from('access_grants')
    .select('id, available_at, granted_at')
    .eq('product', 'blueprint')
    .is('revoked_at', null)
    .maybeSingle();
  if (error) { console.error('getBlueprintGrant error:', error); return null; }
  return data;
}

/**
 * Fetch profiles row for current user.
 * Returns profile or null.
 */
async function getProfile() {
  const { data, error } = await window.sb
    .from('profiles')
    .select('id, full_name, dob, tob, city, country, submitted_at')
    .maybeSingle();
  if (error) { console.error('getProfile error:', error); return null; }
  return data;
}

/**
 * Submit intake form: upsert profile row + call Edge Function to set available_at + trigger PDF pipeline.
 * Returns { error } or {}.
 */
async function submitIntake(userId, fields) {
  // 1. Upsert profile
  const { error: profileErr } = await window.sb
    .from('profiles')
    .upsert({
      id: userId,
      email: fields.email,
      full_name: fields.full_name,
      dob: fields.dob,
      tob: fields.tob || null,
      city: fields.city,
      country: fields.country,
      business_context: fields.business_context,
      niche: fields.niche,
      clarity: fields.clarity,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  if (profileErr) return { error: profileErr };

  // 2. Set available_at via Edge Function (uses Postgres NOW() server-side)
  const { data: { session } } = await window.sb.auth.getSession();
  const res = await fetch(
    `${window.SUPABASE_URL}/functions/v1/set-available-at`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body.error || 'Failed to set available_at' };
  }

  // 3. Trigger PDF pipeline on VPS — awaited so the request isn't cancelled by page navigation
  await fetch('https://api.catovermeulen.com/blueprint-portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  }).catch(err => console.error('Pipeline trigger failed:', err));

  return {};
}
