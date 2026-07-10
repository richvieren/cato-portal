// profile.js — Profile page orchestrator

async function loadProfile(session) {
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

  var cosmicGrant = results[0];
  var blueprintGrant = results[1];
  var transitGrant = results[2];
  var astroGrant = results[3];
  var courseGrant = results[4];
  var chart = results[5];
  var profile = results[6];

  var state = cosmicProfileState(cosmicGrant, chart);

  if (state === 'intake') {
    window.location.href = 'profile-intake.html';
    return;
  }

  if (state === 'locked') {
    document.getElementById('profile-locked').style.display = 'block';
    document.getElementById('profile-widgets').style.display = 'none';
    renderProductSections(blueprintGrant, transitGrant, astroGrant, courseGrant, profile);
    return;
  }

  document.getElementById('profile-locked').style.display = 'none';
  document.getElementById('profile-widgets').style.display = 'block';

  var cd = new ChartData(chart);

  var big3 = cd.getBig3();
  document.getElementById('profile-name').textContent = profile ? profile.full_name : session.user.email;
  if (big3.sun && big3.moon && big3.rising) {
    document.getElementById('profile-subtitle').textContent =
      big3.sun.sign + ' Sun \u00B7 ' + big3.moon.sign + ' Moon \u00B7 ' + big3.rising.sign + ' Rising';
  }

  renderBig3('w-big3', cd);
  renderChartRuler('w-chart-ruler', cd);
  renderChartWheel('w-chart-wheel', cd);
  renderElementBalance('w-elements', cd);
  renderModalitySplit('w-modality', cd);
  renderHemisphereBalance('w-hemispheres', cd);
  renderStelliums('w-stelliums', cd);
  renderPlanetCards('w-planets', cd);
  renderBusinessLens('w-business', cd);
  renderAspectWeb('w-aspect-web', cd);
  renderCosmicDNA('w-cosmic-dna', cd);
  renderRetrogrades('w-retrogrades', cd);

  renderProductSections(blueprintGrant, transitGrant, astroGrant, courseGrant, profile);
}

function renderProductSections(blueprintGrant, transitGrant, astroGrant, courseGrant, profile) {
  var container = document.getElementById('product-sections');

  var products = [
    {
      id: 'blueprint', name: 'Category of One Blueprint', grant: blueprintGrant, profile: profile,
      hook: 'Your chart holds a full business strategy. This is the deep dive.',
      cta: 'Get your Blueprint', url: 'https://catovermeulen.com/category-of-one',
      readyUrl: 'blueprint.html', intakeUrl: 'blueprint.html',
    },
    {
      id: 'transit', name: 'Transits Reading', grant: transitGrant, profile: profile,
      hook: 'What\'s coming for your business. Dates, moves, windows.',
      cta: 'Get your Transits Reading', url: 'https://catovermeulen.com/transits-reading',
      readyUrl: 'transit-reading.html', intakeUrl: 'transit-reading.html',
    },
    {
      id: 'astrocartography', name: 'Astrocartography Reading', grant: astroGrant, profile: profile,
      hook: 'Where in the world your business thrives.',
      cta: 'Get your Astrocartography Reading', url: 'https://catovermeulen.com/astrocartography',
      readyUrl: 'astrocartography.html', intakeUrl: 'astrocartography.html',
    },
    {
      id: 'course', name: 'Business Astrology Course', grant: courseGrant, profile: null,
      hook: 'Learn to read your own chart for business.',
      cta: 'Get the Course', url: 'https://catovermeulen.com',
      readyUrl: 'course.html', intakeUrl: null,
    },
  ];

  container.innerHTML = products.map(function(p) {
    var state = p.id === 'course' ? courseState(p.grant) : blueprintState(p.grant, p.profile);

    if (state === 'locked') {
      return '<div class="product-card product-locked">' +
        '<div class="product-card-label">' + p.name + '</div>' +
        '<div class="product-card-hook">' + p.hook + '</div>' +
        '<a href="' + p.url + '" class="card-cta">' + p.cta + ' \u2192</a>' +
      '</div>';
    }
    if (state === 'intake') {
      return '<div class="product-card product-intake">' +
        '<div class="product-card-label">' + p.name + '</div>' +
        '<div class="product-card-status">Complete your details to begin</div>' +
        '<a href="' + p.intakeUrl + '" class="card-cta">Complete your details \u2192</a>' +
      '</div>';
    }
    if (state === 'pending') {
      return '<div class="product-card product-pending">' +
        '<div class="product-card-label">' + p.name + '</div>' +
        '<div class="product-card-status">Ready in ' + (p.grant ? formatCountdown(p.grant.available_at) : '...') + '</div>' +
      '</div>';
    }
    return '<div class="product-card product-ready">' +
      '<div class="product-card-label">' + p.name + '</div>' +
      '<div class="product-card-status" style="color:var(--golden)">Your reading is ready</div>' +
      '<a href="' + p.readyUrl + '" class="card-cta">View reading \u2192</a>' +
    '</div>';
  }).join('');
}
