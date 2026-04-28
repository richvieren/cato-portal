// dashboard.js — Reading card state logic

/**
 * Determine reading card state.
 *
 * locked   — no grant row
 * intake   — grant exists, profile not yet submitted
 * pending  — profile submitted, available_at in the future
 * ready    — available_at has passed
 */
function blueprintState(grant, profile) {
  if (!grant) return 'locked';
  if (!profile || !profile.submitted_at) return 'intake';
  if (!grant.available_at) return 'pending';
  const available = new Date(grant.available_at);
  if (Date.now() < available.getTime()) return 'pending';
  return 'ready';
}

// Alias — same logic works for mini reading
const miniReadingState = blueprintState;

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
      status: 'Not yet unlocked',
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
    <div class="card-label">Introduction Course</div>
    <h2>Introduction Course</h2>
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
