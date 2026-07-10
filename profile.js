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

  var state = cosmicProfileState(cosmicGrant, chart);
  var fullName = profile && profile.full_name ? profile.full_name : session.user.email;

  document.getElementById('profile-name').textContent = fullName;

  if (state === 'intake') { window.location.href = 'profile-intake.html'; return; }

  if (state === 'locked') {
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

  // ── Upsell: Blueprint ──
  renderUpsellBanner('upsell-blueprint', {
    label: 'GO DEEPER',
    hook: 'Your chart in full \u2014 income houses, offer design, and the year ahead, read by Cato.',
    url: 'https://catovermeulen.com/category-of-one',
    cta: 'BOOK THE BLUEPRINT \u00B7 $297',
  });

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

  // ── Upsell: Transits ──
  renderUpsellBanner('upsell-transits', {
    label: 'TIMING',
    hook: 'What is activating your chart this quarter \u2014 and when to launch, raise, and rest.',
    url: 'https://catovermeulen.com/transits-reading',
    cta: 'BOOK THE TRANSITS READING \u00B7 $197',
  });

  // ── Product sections ──
  renderProductSections(blueprintGrant, transitGrant, astroGrant, courseGrant, profile);

  // ── Footer ──
  var footerEl = document.getElementById('profile-footer');
  if (footerEl && profile) {
    var birthLine = '';
    if (profile.birth_date) {
      var d = new Date(profile.birth_date);
      var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      birthLine = 'Cast for ' + months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
      if (profile.birth_time) birthLine += ' \u00B7 ' + profile.birth_time;
      if (profile.birth_city) birthLine += ' \u00B7 ' + profile.birth_city;
    }
    footerEl.innerHTML =
      '<span>' + birthLine + '</span>' +
      '<span>\u00A9 Cato Vermeulen \u2014 Business Astrology</span>';
  }

  // ── Entrance animations ──
  // Small delay to let DOM paint
  requestAnimationFrame(function() {
    setupEntranceObserver();
  });
}
