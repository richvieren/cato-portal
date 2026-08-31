// dashboard.js — Reading card state logic

/**
 * Determine reading card state.
 *
 * locked    — no grant row
 * intake    — grant exists, this product's intake not submitted
 * submitted — intake submitted, awaiting review. No ETA exists yet.
 * pending   — approved, available_at in the future
 * ready     — available_at has passed
 *
 * available_at is written ONLY by the approve endpoint, so it stays NULL for the
 * whole review window. Keying the intake state on it alone told clients to fill in
 * a form they had already completed, for as long as review took — four days in
 * Melanie Peck's case (2026-08-27 to 2026-08-31), with her finished reading
 * sitting in the delivery store the whole time.
 *
 * intake_submitted_at lives on the grant, matching the (email, product) scope that
 * server-side _claim_generation() uses.
 */
function blueprintState(grant, profile) {
  if (!grant) return 'locked';
  if (!grant.available_at) {
    return grant.intake_submitted_at ? 'submitted' : 'intake';
  }
  const available = new Date(grant.available_at);
  if (Date.now() < available.getTime()) return 'pending';
  return 'ready';
}

/**
 * Determine cosmic profile state.
 * locked  — no grant
 * intake  — grant exists, no chart computed yet
 * ready   — chart computed
 */
function cosmicProfileState(grant, chart) {
  if (!grant) return 'locked';
  if (!chart) return 'intake';
  return 'ready';
}

// Alias — same logic works for mini reading, transit reading, and astrocartography
const miniReadingState = blueprintState;
const transitState = blueprintState;
const astrocartographyState = blueprintState;

/**
 * Determine course card state.
 * locked — no grant row
 * ready  — grant exists (no intake, direct access)
 */
function courseState(grant) {
  if (!grant) return 'locked';
  return 'ready';
}

/**
 * Format countdown: "Xh Ym"
 */
function formatCountdown(available_at) {
  const msLeft = new Date(available_at).getTime() - Date.now();
  if (msLeft <= 0) return 'Ready now';
  const totalMins = Math.floor(msLeft / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Render the Blueprint card into #blueprint-card.
 */
function renderBlueprintCard(state, grant) {
  const card = document.getElementById('blueprint-card');

  const configs = {
    locked: {
      status: '',
      ctaText: 'Get your reading',
      ctaHref: 'https://catovermeulen.com/category-of-one',
    },
    intake: {
      status: 'Complete your details to begin',
      ctaText: 'Complete your details →',
      ctaHref: 'blueprint.html',
    },
    submitted: {
      status: 'Your details are in. Your reading is being prepared.',
      ctaText: 'Check status →',
      ctaHref: 'blueprint.html',
    },
    pending: {
      status: `Ready in ${grant ? formatCountdown(grant.available_at) : '...'}`,
      ctaText: null,
      ctaHref: null,
    },
    ready: {
      status: 'Your reading is being prepared',
      ctaText: 'Check status →',
      ctaHref: 'blueprint.html',
    },
  };

  const c = configs[state];

  card.innerHTML = `
    <img src="img/01blueprint.webp" alt="Blueprint" class="card-img">
    <div class="card-label">Blueprint Reading</div>
    <h2>Category of One</h2>
    <div class="card-status ${state === 'ready' ? 'ready' : ''}">${c.status}</div>
    ${c.ctaText
      ? `<a href="${c.ctaHref}" class="card-cta ${state === 'pending' ? 'muted' : ''}">${c.ctaText}</a>`
      : ''}
  `;

  // Live countdown for pending state
  if (state === 'pending' && grant?.available_at) {
    const statusEl = card.querySelector('.card-status');
    const interval = setInterval(() => {
      const msLeft = new Date(grant.available_at).getTime() - Date.now();
      if (msLeft <= 0) {
        clearInterval(interval);
        statusEl.textContent = 'Your reading is ready';
        statusEl.classList.add('ready');
        const cta = document.createElement('a');
        cta.href = 'blueprint.html';
        cta.className = 'card-cta';
        cta.textContent = 'View reading →';
        card.appendChild(cta);
      } else {
        statusEl.textContent = `Ready in ${formatCountdown(grant.available_at)}`;
      }
    }, 60000);
  }
}

/**
 * Render the Course card into #course-card.
 */
function renderCourseCard(state) {
  const card = document.getElementById('course-card');
  if (!card) return;

  const configs = {
    locked: {
      status: 'Coming soon',
      ctaText: null,
      ctaHref: null,
    },
    ready: {
      status: 'You have access',
      ctaText: 'Enter course →',
      ctaHref: 'course.html',
    },
  };

  const c = configs[state];

  card.innerHTML = `
    <img src="img/04-course.webp" alt="Course" class="card-img">
    <div class="card-label">Introduction Course</div>
    <h2>Business Astrology Introduction Course</h2>
    <div class="card-status ${state === 'ready' ? 'ready' : ''}">${c.status}</div>
    ${c.ctaText
      ? `<a href="${c.ctaHref}" class="card-cta">${c.ctaText}</a>`
      : ''}
  `;
}

/**
 * Render the Your Business Astrology Roadmap card into #mini-reading-card.
 */
function renderMiniReadingCard(state, grant) {
  const card = document.getElementById('mini-reading-card');
  if (!card) return;

  const configs = {
    locked: {
      status: '',
      ctaText: 'Get your reading',
      ctaHref: 'https://catovermeulen.com',
    },
    intake: {
      status: 'Complete your details to begin',
      ctaText: 'Complete your details →',
      ctaHref: 'mini-reading.html',
    },
    submitted: {
      status: 'Your details are in. Your reading is being prepared.',
      ctaText: 'Check status →',
      ctaHref: 'mini-reading.html',
    },
    pending: {
      status: 'Your reading is being prepared',
      ctaText: null,
      ctaHref: null,
    },
    ready: {
      status: 'Your reading is ready',
      ctaText: 'View reading →',
      ctaHref: 'mini-reading.html',
    },
  };

  const c = configs[state];

  card.innerHTML = `
    <div class="card-label">Mini Reading</div>
    <h2>Your Mini Reading</h2>
    <div class="card-status ${state === 'ready' ? 'ready' : ''}">${c.status}</div>
    ${c.ctaText
      ? `<a href="${c.ctaHref}" class="card-cta">${c.ctaText}</a>`
      : ''}
  `;
}

/**
 * Render the Transits Reading card into #transit-card.
 */
function renderTransitCard(state, grant) {
  const card = document.getElementById('transit-card');
  if (!card) return;

  const configs = {
    locked: {
      status: '',
      ctaText: 'Get your reading',
      ctaHref: 'https://catovermeulen.com/transits-reading',
    },
    intake: {
      status: 'Complete your details to begin',
      ctaText: 'Complete your details →',
      ctaHref: 'transit-reading.html',
    },
    submitted: {
      status: 'Your details are in. Your reading is being prepared.',
      ctaText: 'Check status →',
      ctaHref: 'transit-reading.html',
    },
    pending: {
      status: `Ready in ${grant ? formatCountdown(grant.available_at) : '...'}`,
      ctaText: null,
      ctaHref: null,
    },
    ready: {
      status: 'Your reading is ready',
      ctaText: 'View reading →',
      ctaHref: 'transit-reading.html',
    },
  };

  const c = configs[state];

  card.innerHTML = `
    <img src="img/02-transites.webp" alt="Transits" class="card-img">
    <div class="card-label">Transits Reading</div>
    <h2>Transits Reading</h2>
    <div class="card-status ${state === 'ready' ? 'ready' : ''}">${c.status}</div>
    ${c.ctaText
      ? `<a href="${c.ctaHref}" class="card-cta ${state === 'pending' ? 'muted' : ''}">${c.ctaText}</a>`
      : ''}
  `;

  if (state === 'pending' && grant?.available_at) {
    const statusEl = card.querySelector('.card-status');
    const interval = setInterval(() => {
      const msLeft = new Date(grant.available_at).getTime() - Date.now();
      if (msLeft <= 0) {
        clearInterval(interval);
        statusEl.textContent = 'Your reading is ready';
        statusEl.classList.add('ready');
        const cta = document.createElement('a');
        cta.href = 'transit-reading.html';
        cta.className = 'card-cta';
        cta.textContent = 'View reading →';
        card.appendChild(cta);
      } else {
        statusEl.textContent = `Ready in ${formatCountdown(grant.available_at)}`;
      }
    }, 60000);
  }
}

/**
 * Render the Astrocartography card into #astrocartography-card.
 */
function renderAstrocartographyCard(state, grant) {
  const card = document.getElementById('astrocartography-card');
  if (!card) return;

  const configs = {
    locked: {
      status: '',
      ctaText: 'Get your reading',
      ctaHref: 'https://catovermeulen.com/astrocartography',
    },
    intake: {
      status: 'Complete your details to begin',
      ctaText: 'Complete your details →',
      ctaHref: 'astrocartography.html',
    },
    submitted: {
      status: 'Your details are in. Your reading is being prepared.',
      ctaText: 'Check status →',
      ctaHref: 'astrocartography.html',
    },
    pending: {
      status: `Ready in ${grant ? formatCountdown(grant.available_at) : '...'}`,
      ctaText: null,
      ctaHref: null,
    },
    ready: {
      status: 'Your reading is ready',
      ctaText: 'View reading →',
      ctaHref: 'astrocartography.html',
    },
  };

  const c = configs[state];

  card.innerHTML = `
    <img src="img/03-astrocartography.webp" alt="Astrocartography" class="card-img">
    <div class="card-label">Astrocartography</div>
    <h2>Astrocartography Reading</h2>
    <div class="card-status ${state === 'ready' ? 'ready' : ''}">${c.status}</div>
    ${c.ctaText
      ? `<a href="${c.ctaHref}" class="card-cta ${state === 'pending' ? 'muted' : ''}">${c.ctaText}</a>`
      : ''}
  `;

  if (state === 'pending' && grant?.available_at) {
    const statusEl = card.querySelector('.card-status');
    const interval = setInterval(() => {
      const msLeft = new Date(grant.available_at).getTime() - Date.now();
      if (msLeft <= 0) {
        clearInterval(interval);
        statusEl.textContent = 'Your reading is ready';
        statusEl.classList.add('ready');
        const cta = document.createElement('a');
        cta.href = 'astrocartography.html';
        cta.className = 'card-cta';
        cta.textContent = 'View reading →';
        card.appendChild(cta);
      } else {
        statusEl.textContent = `Ready in ${formatCountdown(grant.available_at)}`;
      }
    }, 60000);
  }
}
