// profile.js — Profile page orchestrator (v2 with text sections + new widgets)

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

async function loadProfile(session) {
  // Load snippets in parallel with data
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

  document.getElementById('profile-name').textContent = profile && profile.full_name ? profile.full_name : session.user.email;

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

  if (big3.sun && big3.moon && big3.rising) {
    document.getElementById('profile-subtitle').textContent =
      big3.sun.sign + ' Sun \u00B7 ' + big3.moon.sign + ' Moon \u00B7 ' + big3.rising.sign + ' Rising';
  }

  // ── SECTION 1: Big 3 + Welcome text ──
  renderBig3('w-big3', cd);
  renderChartRuler('w-chart-ruler', cd);
  if (big3.sun && big3.rising) {
    renderTextSection('t-welcome', findSnippet('welcome', big3.sun.sign, big3.rising.sign));
  }

  // ── SECTION 2: Chart Wheel ──
  renderChartWheel('w-chart-wheel', cd);

  // ── SECTION 3: Snapshot (elements + modality + archetype) ──
  renderElementBalance('w-elements', cd);
  renderModalitySplit('w-modality', cd);
  renderArchetype('w-archetype', cd);
  renderHemisphereBalance('w-hemispheres', cd);
  renderTextSection('t-at-a-glance', findSnippet('at_a_glance', cd.getDominantElement(), cd.getDominantModality()));

  // ── SECTION 4: Business Lens ──
  var biz = cd.getBusinessLens();
  renderMoneyStyle('w-money-style', cd);
  var secondSign = biz.money.second.house ? biz.money.second.house.sign : '';
  renderTextSection('t-money', findSnippet('money', secondSign));

  renderVisibilityMeter('w-visibility', cd);
  var mcSign = biz.visibility.mc ? biz.visibility.mc.sign : '';
  renderTextSection('t-visibility', findSnippet('visibility', mcSign));

  renderSalesStyle('w-sales-style', cd);
  var mercSign = biz.communication.mercury ? biz.communication.mercury.sign : '';
  renderTextSection('t-sales', findSnippet('how_you_sell', mercSign));

  renderLeadershipStyle('w-leadership-style', cd);
  var sunSign = biz.leadership.sun ? biz.leadership.sun.sign : '';
  renderTextSection('t-leadership', findSnippet('how_you_lead', sunSign));

  // ── UPSELL BANNER 1: Blueprint ──
  renderUpsellBanner('upsell-blueprint', {
    label: 'Go Deeper',
    hook: 'Your full Category of One Blueprint maps your wealth codes, leadership style, soulmate clients, and million-dollar messaging.',
    url: 'https://catovermeulen.com/category-of-one',
    cta: 'Get your Blueprint',
  });

  // ── SECTION 5: Planet Ranking + Retrogrades ──
  renderPlanetRanking('w-planet-ranking', cd);
  renderRetrogrades('w-retrogrades', cd);

  // ── SECTION 6: Stellium (if any) ──
  renderStelliums('w-stelliums', cd, _snippets);

  // ── SECTION 7: The Question ──
  var ruler = cd.getChartRuler();
  if (ruler) {
    renderTextSection('t-question', findSnippet('question', ruler.planet, ruler.house));
  }

  // ── UPSELL BANNER 2: Transits ──
  renderUpsellBanner('upsell-transits', {
    label: 'What\'s Coming',
    hook: 'Your Transits Reading maps the next 3 months of business timing. Launch windows, income shifts, visibility peaks.',
    url: 'https://catovermeulen.com/transits-reading',
    cta: 'Get your Transits Reading',
  });

  // ── Product sections ──
  renderProductSections(blueprintGrant, transitGrant, astroGrant, courseGrant, profile);
}

function renderProductSections(blueprintGrant, transitGrant, astroGrant, courseGrant, profile) {
  var container = document.getElementById('product-sections');

  var products = [
    { id: 'blueprint', name: 'Category of One Blueprint', grant: blueprintGrant, profile: profile,
      hook: 'Your chart holds a full business strategy. This is the deep dive.',
      cta: 'Get your Blueprint', url: 'https://catovermeulen.com/category-of-one',
      readyUrl: 'blueprint.html', intakeUrl: 'blueprint.html' },
    { id: 'transit', name: 'Transits Reading', grant: transitGrant, profile: profile,
      hook: 'What\'s coming for your business. Dates, moves, windows.',
      cta: 'Get your Transits Reading', url: 'https://catovermeulen.com/transits-reading',
      readyUrl: 'transit-reading.html', intakeUrl: 'transit-reading.html' },
    { id: 'astrocartography', name: 'Astrocartography Reading', grant: astroGrant, profile: profile,
      hook: 'Where in the world your business thrives.',
      cta: 'Get your Astrocartography Reading', url: 'https://catovermeulen.com/astrocartography',
      readyUrl: 'astrocartography.html', intakeUrl: 'astrocartography.html' },
    { id: 'course', name: 'Business Astrology Course', grant: courseGrant, profile: null,
      hook: 'Learn to read your own chart for business.',
      cta: 'Get the Course', url: 'https://catovermeulen.com',
      readyUrl: 'course.html', intakeUrl: null },
  ];

  container.innerHTML = products.map(function(p) {
    var state = p.id === 'course' ? courseState(p.grant) : blueprintState(p.grant, p.profile);
    if (state === 'locked') {
      return '<div class="product-card product-locked">' +
        '<div class="product-card-label">' + p.name + '</div>' +
        '<div class="product-card-hook">' + p.hook + '</div>' +
        '<a href="' + p.url + '" class="card-cta">' + p.cta + ' \u2192</a></div>';
    }
    if (state === 'intake') {
      return '<div class="product-card product-intake">' +
        '<div class="product-card-label">' + p.name + '</div>' +
        '<div class="product-card-status">Complete your details to begin</div>' +
        '<a href="' + p.intakeUrl + '" class="card-cta">Complete your details \u2192</a></div>';
    }
    if (state === 'pending') {
      return '<div class="product-card product-pending">' +
        '<div class="product-card-label">' + p.name + '</div>' +
        '<div class="product-card-status">Ready in ' + (p.grant ? formatCountdown(p.grant.available_at) : '...') + '</div></div>';
    }
    return '<div class="product-card product-ready">' +
      '<div class="product-card-label">' + p.name + '</div>' +
      '<div class="product-card-status" style="color:var(--golden)">Your reading is ready</div>' +
      '<a href="' + p.readyUrl + '" class="card-cta">View reading \u2192</a></div>';
  }).join('');
}
