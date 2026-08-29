// db.js — VPS data layer via /v2/api/ (SQLite backend)
// Depends on auth.js being loaded first (for getSession / API_BASE)

/** Helper: get auth headers for API calls. */
function _authHeaders() {
  const token = localStorage.getItem('cato_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

/** Helper: get current user's email from local storage. */
function _getUserEmail() {
  try {
    const user = JSON.parse(localStorage.getItem('cato_user') || '{}');
    return user.email || '';
  } catch { return ''; }
}

// --- Access Grants ---

async function getMiniReadingGrant() {
  const res = await fetch(`${API_BASE}/v2/api/grants/mini_reading`, { headers: _authHeaders() });
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}

async function getBlueprintGrant() {
  const res = await fetch(`${API_BASE}/v2/api/grants/blueprint`, { headers: _authHeaders() });
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}

async function getTransitGrant() {
  const res = await fetch(`${API_BASE}/v2/api/grants/transit_reading`, { headers: _authHeaders() });
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}

async function getAstrocartographyGrant() {
  const res = await fetch(`${API_BASE}/v2/api/grants/astrocartography`, { headers: _authHeaders() });
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}

async function getCourseGrant() {
  const res = await fetch(`${API_BASE}/v2/api/grants/course`, { headers: _authHeaders() });
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}

async function getCosmicProfileGrant() {
  const res = await fetch(`${API_BASE}/v2/api/grants/cosmic_profile`, { headers: _authHeaders() });
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}

// --- Profile ---

async function getProfile() {
  const res = await fetch(`${API_BASE}/v2/api/profile`, { headers: _authHeaders() });
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}

// --- Intake Submissions ---

async function submitIntake(userId, fields) {
  // Block resubmission. available_at is only set at approval, so it does NOT
  // catch a refresh/double-tap before then — submitted_at is the real signal.
  // Server-side _claim_generation() is the authoritative guard; this is UX only.
  const grant = await getBlueprintGrant();
  if (grant && grant.available_at) return {};
  const existing = await getProfile();
  if (existing && existing.submitted_at) return { error: 'Your details are already submitted and your reading is being prepared.' };

  // 1. Upsert profile
  const profileRes = await fetch(`${API_BASE}/v2/api/profile`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify({
      full_name: fields.full_name,
      dob: fields.dob,
      tob: fields.tob || null,
      city: fields.city,
      country: fields.country,
      business_context: fields.business_context,
      niche: fields.niche,
      clarity: fields.clarity,
    }),
  });
  if (!profileRes.ok) {
    const err = await profileRes.json().catch(() => ({}));
    return { error: err.detail || 'Profile save failed' };
  }

  // 2. Set available_at
  const availRes = await fetch(`${API_BASE}/v2/api/set-available`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify({ product: 'blueprint' }),
  });
  if (!availRes.ok) {
    const err = await availRes.json().catch(() => ({}));
    return { error: err.detail || 'Failed to set available_at' };
  }

  // 3. Trigger VPS pipeline
  await fetch(`${API_BASE}/blueprint-portal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  }).catch(err => console.error('Pipeline trigger failed:', err));

  return {};
}

async function submitMiniIntake(userId, fields) {
  // 1. Upsert profile
  const profileRes = await fetch(`${API_BASE}/v2/api/profile`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify({
      full_name: fields.full_name,
      dob: fields.dob,
      tob: fields.tob || null,
      city: fields.city,
      country: fields.country,
    }),
  });
  if (!profileRes.ok) {
    const err = await profileRes.json().catch(() => ({}));
    return { error: err.detail || 'Profile save failed' };
  }

  // 2. Set available_at
  const availRes = await fetch(`${API_BASE}/v2/api/set-available`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify({ product: 'mini_reading' }),
  });
  if (!availRes.ok) {
    const err = await availRes.json().catch(() => ({}));
    return { error: err.detail || 'Failed to set available_at' };
  }

  // 3. Trigger pipeline
  await fetch(`${API_BASE}/mini-reading-portal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  }).catch(err => console.error('Mini reading pipeline trigger failed:', err));

  return {};
}

async function submitTransitIntake(userId, fields) {
  const grant = await getTransitGrant();
  if (grant && grant.available_at) return {};
  const existingT = await getProfile();
  if (existingT && existingT.submitted_at) return { error: 'Your details are already submitted and your reading is being prepared.' };

  const profile = await getProfile();
  const profileData = {
    full_name: fields.full_name,
    dob: fields.dob,
    tob: fields.tob || null,
    city: fields.city,
    country: fields.country,
  };
  if (!profile || !profile.submitted_at) {
    profileData.business_context = fields.business_niche;
    profileData.niche = fields.planned_launches;
    profileData.clarity = fields.clarity;
  }

  const profileRes = await fetch(`${API_BASE}/v2/api/profile`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify(profileData),
  });
  if (!profileRes.ok) {
    const err = await profileRes.json().catch(() => ({}));
    return { error: err.detail || 'Profile save failed' };
  }

  const availRes = await fetch(`${API_BASE}/v2/api/set-available`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify({ product: 'transit_reading' }),
  });
  if (!availRes.ok) {
    const err = await availRes.json().catch(() => ({}));
    return { error: err.detail || 'Failed to set available_at' };
  }

  await fetch(`${API_BASE}/transit-portal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  }).catch(err => console.error('Transit pipeline trigger failed:', err));

  return {};
}

async function submitAstrocartographyIntake(userId, fields) {
  const grant = await getAstrocartographyGrant();
  if (grant && grant.available_at) return {};
  const existingA = await getProfile();
  if (existingA && existingA.submitted_at) return { error: 'Your details are already submitted and your reading is being prepared.' };

  const profile = await getProfile();
  const profileData = {
    full_name: fields.full_name,
    dob: fields.dob,
    tob: fields.tob || null,
    city: fields.city,
    country: fields.country,
  };
  if (!profile || !profile.submitted_at) {
    profileData.business_context = fields.career_context;
  }

  const profileRes = await fetch(`${API_BASE}/v2/api/profile`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify(profileData),
  });
  if (!profileRes.ok) {
    const err = await profileRes.json().catch(() => ({}));
    return { error: err.detail || 'Profile save failed' };
  }

  const availRes = await fetch(`${API_BASE}/v2/api/set-available`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify({ product: 'astrocartography' }),
  });
  if (!availRes.ok) {
    const err = await availRes.json().catch(() => ({}));
    return { error: err.detail || 'Failed to set available_at' };
  }

  await fetch(`${API_BASE}/astrocartography-portal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  }).catch(err => console.error('Astrocartography pipeline trigger failed:', err));

  return {};
}

// --- Cosmic Profile / Natal Chart ---

async function getNatalChart() {
  const res = await fetch(`${API_BASE}/v2/api/natal-chart`, { headers: _authHeaders() });
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}

async function submitCosmicProfileIntake(userId, fields) {
  const profileRes = await fetch(`${API_BASE}/v2/api/profile`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify({
      full_name: fields.full_name,
      dob: fields.dob,
      tob: fields.tob || null,
      city: fields.city,
      country: fields.country,
    }),
  });
  if (!profileRes.ok) {
    const err = await profileRes.json().catch(() => ({}));
    return { error: err.detail || 'Profile save failed' };
  }

  const chartRes = await fetch(`${API_BASE}/v2/api/compute-chart`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify({
      full_name: fields.full_name,
      dob: fields.dob,
      tob: fields.tob || '00:00',
      city: fields.city,
      country: fields.country,
    }),
  });
  if (!chartRes.ok) {
    const err = await chartRes.json().catch(() => ({}));
    return { error: err.detail || 'Failed to compute chart' };
  }

  return {};
}

// --- Course Progress ---

async function getCourseProgress() {
  const res = await fetch(`${API_BASE}/v2/api/course-progress`, { headers: _authHeaders() });
  if (!res.ok) return [];
  const { data } = await res.json();
  return data || [];
}

async function markLessonComplete(lessonId) {
  const res = await fetch(`${API_BASE}/v2/api/course-progress/${lessonId}`, {
    method: 'POST',
    headers: _authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { error: err.detail || 'Failed to mark complete' };
  }
  return {};
}
