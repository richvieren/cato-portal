// profile.js — Profile page orchestrator (Gilded Observatory redesign)

var _snippets = null;

async function loadSnippets() {
  try {
    var res = await fetch('snippets.json');
    if (res.ok) _snippets = await res.json();
  } catch (e) { console.warn('Snippets not loaded:', e); }
}

function findSnippet(section, key1, key2) {
  if (!_snippets) return '';
  if (section === 'welcome') {
    var sunMap = _snippets.welcome ? _snippets.welcome[key1] : null;
    return sunMap ? (sunMap[key2] || '') : '';
  }
  if (section === 'at_a_glance') {
    if (!Array.isArray(_snippets.at_a_glance)) return '';
    var match = _snippets.at_a_glance.find(function(s) { return s.element === key1 && s.modality === key2; });
    return match ? match.text : '';
  }
  if (section === 'money' || section === 'visibility' || section === 'how_you_sell' || section === 'how_you_lead') {
    var arr = _snippets[section];
    if (!Array.isArray(arr)) return '';
    var m = arr.find(function(s) { return s.sign === key1; });
    return m ? m.text : '';
  }
  if (section === 'question') {
    var rulerData = _snippets.question ? _snippets.question[key1] : null;
    if (!Array.isArray(rulerData)) return '';
    var hm = rulerData.find(function(s) { return s.house == key2; });
    return hm ? hm.text : '';
  }
  return '';
}

// ── Generate free profile for existing clients ──────

async function generateFreeProfile() {
  var btn = document.getElementById('generate-btn');
  var area = document.getElementById('generate-area');
  var loading = document.getElementById('generate-loading');

  if (area) area.style.display = 'none';
  if (loading) loading.style.display = 'block';

  var session = await getSession();
  if (!session) return;

  var profile = await getProfile();
  if (!profile || !profile.dob) {
    if (area) area.style.display = 'block';
    if (loading) loading.style.display = 'none';
    return;
  }

  var fields = {
    full_name: profile.full_name || session.user.email,
    email: session.user.email,
    dob: profile.dob,
    tob: profile.tob || '',
    city: profile.city || '',
    country: profile.country || '',
  };

  var result = await submitCosmicProfileIntake(session.user.id, fields);
  if (result.error) {
    if (area) { area.style.display = 'block'; area.innerHTML = '<p style="color:#c97878;font-size:0.85rem;margin-top:1rem">Something went wrong. Please try again.</p>' +
      '<button class="btn btn-primary" style="margin-top:1rem" onclick="generateFreeProfile()">Try Again</button>'; }
    if (loading) loading.style.display = 'none';
    return;
  }

  // Reload the page to show the full profile
  window.location.reload();
}

// ── Entrance animation observer ──────────────────────

function setupEntranceObserver() {
  if (!('IntersectionObserver' in window)) {
    // Fallback: show everything immediately
    document.querySelectorAll('.anim-fade-up, .anim-blur-in, .anim-grow, .badge-card__halo-ring, .badge-card__type, .bar-item__fill, .rank-row__bar-fill, .gauge-fill').forEach(function(el) {
      el.classList.add('in');
    });
    return;
  }

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');

        // Also trigger child animations within this section
        entry.target.querySelectorAll('.anim-fade-up, .anim-blur-in, .badge-card__halo-ring, .badge-card__type').forEach(function(child) {
          child.classList.add('in');
        });

        // Trigger bar fills within view
        entry.target.querySelectorAll('.bar-item__fill, .rank-row__bar-fill').forEach(function(bar) {
          bar.classList.add('in');
        });

        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.25 });

  // Observe all animatable sections
  document.querySelectorAll('.anim-fade-up, .anim-blur-in, .frost-card, .profile-section, .profile-section--text, .profile-section--tight, .upsell-banner, .stellium-card').forEach(function(el) {
    observer.observe(el);
  });
}

// ── Main profile loader ──────────────────────────────

async function loadProfile(session) {
  var snippetsPromise = loadSnippets();

  document.getElementById('profile-screen').style.display = 'block';
  document.getElementById('user-email').textContent = session.user.email;

  var results = await Promise.all([
    getCosmicProfileGrant(),
    getBlueprintGrant(),
    getTransitGrant(),
    getAstrocartographyGrant(),
    getCourseGrant(),
    getNatalChart(),
    getProfile(),
  ]);

  var cosmicGrant = results[0], blueprintGrant = results[1], transitGrant = results[2];
  var astroGrant = results[3], courseGrant = results[4], chart = results[5], profile = results[6];

  var fullName = profile && profile.full_name ? profile.full_name : session.user.email;
  document.getElementById('profile-name').textContent = fullName;

  // ── Priority: reading intake forms come FIRST ──
  // Redirect to intake if: user has a grant with no available_at AND hasn't submitted birth data yet.
  // Users who already submitted (profile.submitted_at exists) skip intake redirects.
  var hasSubmitted = profile && profile.submitted_at;

  if (!hasSubmitted) {
    var bpState = blueprintState(blueprintGrant, profile);
    if (bpState === 'intake') { window.location.href = 'blueprint.html'; return; }

    var trState = transitState(transitGrant, profile);
    if (trState === 'intake') { window.location.href = 'transit-reading.html'; return; }

    var acState = astrocartographyState(astroGrant, profile);
    if (acState === 'intake') { window.location.href = 'astrocartography.html'; return; }
  }

  // ── Auto-grant cosmic profile for reading buyers ──
  // Anyone with a blueprint, transit, or astrocartography grant gets cosmic profile free
  var hasReadingGrant = blueprintGrant || transitGrant || astroGrant;
  if (hasReadingGrant && !cosmicGrant) {
    // Auto-grant cosmic_profile for reading buyers
    var email = session.user.email.toLowerCase();
    await window.sb.from('access_grants').insert({
      email: email,
      product: 'cosmic_profile',
      source: 'comp',
      available_at: new Date().toISOString(),
    }).catch(function() {});
    cosmicGrant = { id: 'auto', available_at: new Date().toISOString(), granted_at: new Date().toISOString() };
  }

  var state = cosmicProfileState(cosmicGrant, chart);

  // Cosmic profile intake (only if they have a cosmic grant but no chart yet)
  if (state === 'intake') { window.location.href = 'profile-intake.html'; return; }

  if (state === 'locked') {
    var hasBirthData = profile && profile.dob && profile.city;

    if (hasReadingGrant && hasBirthData) {
      // Existing client with birth data — show free generate button
      document.getElementById('profile-locked').style.display = 'block';
      document.getElementById('profile-widgets').style.display = 'none';
      var lockedEl = document.getElementById('profile-locked');
      lockedEl.innerHTML =
        '<div class="locked-banner">' +
          '<h3>Your Cosmic Business Profile</h3>' +
          '<p>Your natal chart data is ready to be visualized. Element balance, business archetype, money style, visibility score, and more.</p>' +
          '<div id="generate-area">' +
            '<button class="btn btn-primary" style="margin-top:1.5rem" id="generate-btn" onclick="generateFreeProfile()">Generate My Profile</button>' +
          '</div>' +
          '<div id="generate-loading" style="display:none;margin-top:2rem">' +
            '<div class="generate-spinner"></div>' +
            '<p style="color:var(--golden);font-size:0.95rem;margin-top:1.2rem">Computing your chart...</p>' +
            '<p style="color:var(--stone);font-size:0.78rem;margin-top:0.4rem">Reading the sky for your birth moment</p>' +
          '</div>' +
        '</div>';
      renderProductSections(blueprintGrant, transitGrant, astroGrant, courseGrant, profile);
      return;
    }

    // No reading grants, no birth data — show purchase CTA
    document.getElementById('profile-locked').style.display = 'block';
    document.getElementById('profile-widgets').style.display = 'none';
    renderProductSections(blueprintGrant, transitGrant, astroGrant, courseGrant, profile);
    return;
  }

  document.getElementById('profile-locked').style.display = 'none';
  document.getElementById('profile-widgets').style.display = 'block';

  await snippetsPromise;
  var cd = new ChartData(chart);
  var big3 = cd.getBig3();

  // ── Hero big-3 line ──
  if (big3.sun && big3.moon && big3.rising) {
    var lineEl = document.getElementById('profile-big3-line');
    if (lineEl) {
      lineEl.innerHTML =
        '<span>' + big3.sun.sign.toUpperCase() + '&nbsp;SUN</span>' +
        '<span class="profile-hero__dot">\u00B7</span>' +
        '<span>' + big3.moon.sign.toUpperCase() + '&nbsp;MOON</span>' +
        '<span class="profile-hero__dot">\u00B7</span>' +
        '<span>' + big3.rising.sign.toUpperCase() + '&nbsp;RISING</span>';
    }
  }

  // ── Big 3 cards ──
  renderBig3('w-big3', cd);

  // ── Chart Ruler ──
  renderChartRuler('w-chart-ruler', cd);

  // ── Welcome text ──
  if (big3.sun && big3.rising) {
    renderTextSection('t-welcome', findSnippet('welcome', big3.sun.sign, big3.rising.sign), { label: 'WELCOME' });
  }

  // ── Chart Wheel ──
  renderChartWheel('w-chart-wheel', cd);
  // Set client name in wheel center
  var wheelContainer = document.getElementById('w-chart-wheel');
  if (wheelContainer && wheelContainer._setCenterName) {
    wheelContainer._setCenterName(fullName);
  }

  // ── Chart Snapshot ──
  renderElementBalance('w-elements', cd);
  renderModalitySplit('w-modality', cd);
  renderArchetype('w-archetype', cd);
  renderHemisphereBalance('w-hemispheres', cd);

  // ── At a Glance text ──
  renderTextSection('t-at-a-glance', findSnippet('at_a_glance', cd.getDominantElement(), cd.getDominantModality()), { label: 'AT A GLANCE' });

  // ── Business Lens ──
  var biz = cd.getBusinessLens();

  renderMoneyStyle('w-money-style', cd);
  renderVisibilityMeter('w-visibility', cd);

  // Biz text blocks with left-border treatment
  var secondSign = biz.money.second.house ? biz.money.second.house.sign : '';
  renderBizText('t-money', 'ON MONEY', findSnippet('money', secondSign));

  var mcSign = biz.visibility.mc ? biz.visibility.mc.sign : '';
  renderBizText('t-visibility', 'ON VISIBILITY', findSnippet('visibility', mcSign));

  renderSalesStyle('w-sales-style', cd);
  renderLeadershipStyle('w-leadership-style', cd);

  var mercSign = biz.communication.mercury ? biz.communication.mercury.sign : '';
  renderBizText('t-sales', 'ON SELLING', findSnippet('how_you_sell', mercSign));

  var sunSign = biz.leadership.sun ? biz.leadership.sun.sign : '';
  renderBizText('t-leadership', 'ON LEADING', findSnippet('how_you_lead', sunSign));

  // ── Upsell: Blueprint (only if not purchased) ──
  if (!blueprintGrant) {
    renderUpsellBanner('upsell-blueprint', {
      label: 'GO DEEPER',
      hook: 'Your chart in full \u2014 income houses, offer design, and the year ahead, read by Cato.',
      url: 'https://catovermeulen.com/category-of-one',
      cta: 'BOOK THE BLUEPRINT \u00B7 $297',
    });
  }

  // ── Planet Ranking + Retrogrades ──
  renderPlanetRanking('w-planet-ranking', cd);
  renderRetrogrades('w-retrogrades', cd);

  // ── Stellium ──
  renderStelliums('w-stelliums', cd, _snippets);

  // ── The Question text ──
  var ruler = cd.getChartRuler();
  if (ruler) {
    renderTextSection('t-question', findSnippet('question', ruler.planet, ruler.house), { label: 'THE QUESTION', italic: true });
  }

  // ── Upsell: Transits (only if not purchased) ──
  if (!transitGrant) {
    renderUpsellBanner('upsell-transits', {
      label: 'TIMING',
      hook: 'What is activating your chart this quarter \u2014 and when to launch, raise, and rest.',
      url: 'https://catovermeulen.com/transits-reading',
      cta: 'BOOK THE TRANSITS READING \u00B7 $197',
    });
  }

  // ── Purchased readings at top ──
  renderPurchasedReadingsTop(blueprintGrant, transitGrant, astroGrant, courseGrant, profile);

  // ── Remaining product sections (unpurchased) at bottom ──
  renderProductSections(blueprintGrant, transitGrant, astroGrant, courseGrant, profile);

  // ── Footer ──
  var footerEl = document.getElementById('profile-footer');
  if (footerEl) {
    footerEl.innerHTML =
      '<div class="profile-footer__top">' +
        '<span>\u00A9 Cato Vermeulen \u2014 Business Astrology</span>' +
      '</div>' +
      '<div class="profile-footer__vieren">' +
        '<a href="https://vieren.studio" target="_blank" rel="noopener">' +
          '<img src="builtbyvieren.png" alt="Built by Vieren" class="profile-footer__vieren-logo">' +
        '</a>' +
      '</div>';
  }

  // ── Entrance animations ──
  // Small delay to let DOM paint
  requestAnimationFrame(function() {
    setupEntranceObserver();
  });
}
