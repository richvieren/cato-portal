// db.js — VPS data layer via /v2/api/ (SQLite backend)
// Depends on auth.js being loaded first (for getSession / API_BASE)

/** Helper: get auth headers for API calls. */
// --- Birth date bounds ----------------------------------------------------
// A bare <input type="date"> accepts any year. On 2026-09-07 a birth year of
// 1893 passed the form, the astrology API, a finished PDF and Cato's approval
// queue without anything objecting, and the client was shown a chart with the
// wrong Moon. Bound it here, at the one point every intake page passes through.
// The server repeats this check; the form must not be the only guard.
var DOB_MIN = '1920-01-01';
var MIN_AGE_YEARS = 16;

function dobMaxDate() {
  var d = new Date();
  d.setFullYear(d.getFullYear() - MIN_AGE_YEARS);
  return d.toISOString().slice(0, 10);
}

function dobError(dob) {
  if (!dob) return 'Please enter your date of birth.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return 'Please enter your date of birth as a full date.';
  if (dob < DOB_MIN) return 'That birth year looks wrong — please check it. It must be ' + DOB_MIN.slice(0, 4) + ' or later.';
  if (dob > dobMaxDate()) return 'That birth date is in the future or too recent — please check it.';
  return null;
}

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

/**
 * Trigger a generation pipeline and decide whether the server actually took the job.
 *
 * /blueprint-portal and its three siblings answer HTTP 200 with
 * {"status":"rejected","reason":...} when the Google Places check fails closed,
 * and 200 with {"status":"ignored","reason":...} when the duplicate guard
 * refuses. This call used to be `.catch(err => console.error(...))`, so a
 * rejection body reached nobody: the browser showed the success screen and no
 * reading was ever generated. Halie Devlin sat on that screen for 19 hours
 * (2026-09-09), and could not resubmit because intake_submitted_at had already
 * been stamped.
 *
 * Only {"status":"accepted"} counts as success. A non-OK HTTP status, an
 * unparseable body, a missing or different status field, and a network failure
 * are all failures, and the reason travels back to the client.
 */
async function _triggerPipeline(url, fields) {
  var res, text;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    text = await res.text();
  } catch (err) {
    console.error('Pipeline trigger failed to reach the server:', url, err);
    return "We couldn't reach the server to start your reading. Check your connection and try again.";
  }

  var data = null;
  try { data = JSON.parse(text); } catch (e) { /* handled below */ }

  if (data && data.status === 'accepted') return null;

  console.error('Pipeline refused the job:', url, 'http=' + res.status, text.slice(0, 500));
  if (data && typeof data.reason === 'string' && data.reason) return data.reason;
  return "We couldn't start your reading just now. Please try again in a few minutes.";
}

/**
 * Stamp intake_submitted_at, AFTER the pipeline has accepted the job.
 *
 * Never fatal. Once the server is generating, telling the client her submission
 * failed is the same lie in the other direction: she would retry, hit the
 * duplicate guard, and read "already_in_progress" as an error. A missing stamp
 * is visible to the stranded sweeper; a false failure is not.
 */
async function _markIntakeSubmitted(product) {
  try {
    const res = await fetch(`${API_BASE}/v2/api/set-available`, {
      method: 'POST',
      headers: _authHeaders(),
      body: JSON.stringify({ product: product }),
    });
    if (!res.ok) {
      console.error('set-available failed after the pipeline accepted', product, res.status);
    }
  } catch (err) {
    console.error('set-available threw after the pipeline accepted', product, err);
  }
}

async function submitIntake(userId, fields) {
  var _dobErr = dobError(fields.dob);
  if (_dobErr) return { error: _dobErr };
  // Block resubmission of THIS product only. profiles.submitted_at is per-person,
  // so keying on it blocked returning buyers from their second product
  // (incident 2026-08-30: 4 paid buyers got a grant but no reading).
  // intake_submitted_at lives on the grant, so this matches the (email, product)
  // scope that server-side _claim_generation() uses. UX only — _claim_generation()
  // remains the authoritative duplicate guard.
  const grant = await getBlueprintGrant();
  if (grant && (grant.intake_submitted_at || grant.available_at)) {
    return { error: 'Your details are already submitted and your reading is being prepared.' };
  }

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

  // 2. Trigger the pipeline, and only stamp the intake once it accepts.
  const trigErr = await _triggerPipeline(`${API_BASE}/blueprint-portal`, fields);
  if (trigErr) return { error: trigErr };

  await _markIntakeSubmitted('blueprint');

  return {};
}

async function submitTransitIntake(userId, fields) {
  var _dobErr = dobError(fields.dob);
  if (_dobErr) return { error: _dobErr };
  // Block resubmission of THIS product only. profiles.submitted_at is per-person,
  // so keying on it blocked returning buyers from their second product
  // (incident 2026-08-30: 4 paid buyers got a grant but no reading).
  // intake_submitted_at lives on the grant, so this matches the (email, product)
  // scope that server-side _claim_generation() uses. UX only — _claim_generation()
  // remains the authoritative duplicate guard.
  const grant = await getTransitGrant();
  if (grant && (grant.intake_submitted_at || grant.available_at)) {
    return { error: 'Your details are already submitted and your reading is being prepared.' };
  }

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

  const trigErr = await _triggerPipeline(`${API_BASE}/transit-portal`, fields);
  if (trigErr) return { error: trigErr };

  await _markIntakeSubmitted('transit_reading');

  return {};
}

async function submitAstrocartographyIntake(userId, fields) {
  var _dobErr = dobError(fields.dob);
  if (_dobErr) return { error: _dobErr };
  // Block resubmission of THIS product only. profiles.submitted_at is per-person,
  // so keying on it blocked returning buyers from their second product
  // (incident 2026-08-30: 4 paid buyers got a grant but no reading).
  // intake_submitted_at lives on the grant, so this matches the (email, product)
  // scope that server-side _claim_generation() uses. UX only — _claim_generation()
  // remains the authoritative duplicate guard.
  const grant = await getAstrocartographyGrant();
  if (grant && (grant.intake_submitted_at || grant.available_at)) {
    return { error: 'Your details are already submitted and your reading is being prepared.' };
  }

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

  const trigErr = await _triggerPipeline(`${API_BASE}/astrocartography-portal`, fields);
  if (trigErr) return { error: trigErr };

  await _markIntakeSubmitted('astrocartography');

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
  var _dobErr = dobError(fields.dob);
  if (_dobErr) return { error: _dobErr };
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
