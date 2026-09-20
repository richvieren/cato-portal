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

async function getNumerologyGrant() {
  const res = await fetch(`${API_BASE}/v2/api/grants/numerology`, { headers: _authHeaders() });
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
/**
 * Turn whatever the API refused with into something a client can read.
 *
 * The pipeline's refusal codes are internal: "already_generated",
 * "already_in_progress". On 2026-09-17 the portal printed "already_generated"
 * straight onto Michelle van Dijk's screen, and she read it as her reading
 * being finished and hidden from her.
 *
 * The rule, not a list: a reason that is a bare snake_case token is internal
 * and never shown. A reason that reads as a sentence is already client-safe —
 * the location checks in geocode_validator.py return real sentences — so it
 * passes through. Unknown codes fall back to the generic line and are logged
 * for us, not for her.
 */
var PIPELINE_REASON_TEXT = {
  already_generated:
    "Your reading has already been prepared, so there is nothing more to submit. " +
    "Cato reviews every reading before it is released, and you will get an email the moment yours is ready.",
  already_in_progress:
    "Your reading is being prepared right now. There is no need to submit again — " +
    "you will get an email as soon as it is ready.",
  already_submitted:
    "Your details are already in and your reading is on its way. Cato reviews every reading " +
    "before it is released, and you will get an email the moment yours is ready.",
};
var PIPELINE_GENERIC =
  "We couldn't start your reading just now. Please try again in a few minutes, " +
  "and if it keeps happening reply to your welcome email.";

function _clientMessage(reason) {
  if (!reason || typeof reason !== 'string') return PIPELINE_GENERIC;
  if (PIPELINE_REASON_TEXT[reason]) return PIPELINE_REASON_TEXT[reason];
  if (/^[a-z0-9]+(_[a-z0-9]+)*$/.test(reason.trim())) {
    console.error('Unmapped internal reason code, showing the generic message:', reason);
    return PIPELINE_GENERIC;
  }
  return reason;
}

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
  return _clientMessage(data && data.reason);
}

/**
 * Stamp intake_submitted_at, AFTER the pipeline has accepted the job.
 *
 * Never fatal. Once the server is generating, telling the client her submission
 * failed is the same lie in the other direction: she would retry, hit the
 * duplicate guard, and read "already_in_progress" as an error. A missing stamp
 * is visible to the stranded sweeper; a false failure is not.
 */
// intake_submitted_at is stamped server-side by webhook_server._claim_intake_slot()
// at the moment the pipeline accepts the job. It used to be a fire-and-forget POST
// from here, which is lost if the tab closes between the trigger and this call.

async function submitIntake(userId, fields) {
  var _dobErr = dobError(fields.dob);
  if (_dobErr) return { error: _dobErr };
  // No client-side duplicate check: it was advisory, and an advisory check is the
  // shape that let a second submission through. webhook_server._claim_generation()
  // refuses durably from the grant's own intake_submitted_at.

  // 1. Ask the server to take the job FIRST. A refusal is then one round trip away
  // and nothing has been written yet: a rejected submission no longer mutates the
  // profile row, and the client sees the reason immediately.
  const trigErr = await _triggerPipeline(`${API_BASE}/blueprint-portal`, fields);
  if (trigErr) return { error: trigErr };

  // 2. Accepted. Save the profile. intake_submitted_at is already stamped server-side.
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
    // The reading is generating from the payload it already has, so this is not a
    // failure for her: never turn an accepted job into an error on screen.
    console.error('Profile save failed after the pipeline accepted', profileRes.status);
  }


  return {};
}

async function submitTransitIntake(userId, fields) {
  var _dobErr = dobError(fields.dob);
  if (_dobErr) return { error: _dobErr };
  // No client-side duplicate check: it was advisory, and an advisory check is the
  // shape that let a second submission through. webhook_server._claim_generation()
  // refuses durably from the grant's own intake_submitted_at.

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

  // Ask the server to take the job FIRST: a refusal is one round trip away and
  // nothing has been written yet.
  const trigErr = await _triggerPipeline(`${API_BASE}/transit-portal`, fields);
  if (trigErr) return { error: trigErr };

  // Accepted. Save the profile; intake_submitted_at is already stamped server-side.
  const profileRes = await fetch(`${API_BASE}/v2/api/profile`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify(profileData),
  });
  if (!profileRes.ok) {
    console.error('Profile save failed after the pipeline accepted', profileRes.status);
  }


  return {};
}

async function submitAstrocartographyIntake(userId, fields) {
  var _dobErr = dobError(fields.dob);
  if (_dobErr) return { error: _dobErr };
  // No client-side duplicate check: it was advisory, and an advisory check is the
  // shape that let a second submission through. webhook_server._claim_generation()
  // refuses durably from the grant's own intake_submitted_at.

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

  // Ask the server to take the job FIRST: a refusal is one round trip away and
  // nothing has been written yet.
  const trigErr = await _triggerPipeline(`${API_BASE}/astrocartography-portal`, fields);
  if (trigErr) return { error: trigErr };

  // Accepted. Save the profile; intake_submitted_at is already stamped server-side.
  const profileRes = await fetch(`${API_BASE}/v2/api/profile`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify(profileData),
  });
  if (!profileRes.ok) {
    console.error('Profile save failed after the pipeline accepted', profileRes.status);
  }


  return {};
}

// --- Cosmic Profile / Natal Chart ---

async function getNatalChart() {
  const res = await fetch(`${API_BASE}/v2/api/natal-chart`, { headers: _authHeaders() });
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}

/**
 * Numerology intake: full name and date of birth, nothing else.
 *
 * No profile write. The astrology submits save birth city and time to profiles
 * because their charts need them; numerology needs neither, and writing a
 * half-filled profile row would overwrite the birth data a client already gave
 * for her Blueprint.
 */
async function submitNumerologyIntake(userId, fields) {
  var _dobErr = dobError(fields.dob);
  if (_dobErr) return { error: _dobErr };

  const trigErr = await _triggerPipeline(`${API_BASE}/numerology-portal`, fields);
  if (trigErr) return { error: trigErr };

  return {};
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
      // place_id was collected by the form and then dropped here. The server
      // only runs the Places gate `if place_id`, so for this product it never
      // ran: no birth_lat/birth_lon were stored and the chart re-geocoded the
      // city string through Nominatim. That is the 2026-08-29 incident, where
      // "City of Atwater" resolved to a street in Detroit, 3229 km away.
      // Forwarding it makes this intake behave like the blueprint intake.
      place_id: fields.place_id,
      city: fields.city,
      country: fields.country,
      hopes: fields.hopes || null,
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
