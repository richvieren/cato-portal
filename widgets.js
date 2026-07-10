// widgets.js — All profile widget components

function ordinal(n) {
  var s = ['th', 'st', 'nd', 'rd'];
  var v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function renderBig3(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var big3 = chartData.getBig3();
  var items = [
    { label: 'Sun', data: big3.sun, icon: '\u2609' },
    { label: 'Moon', data: big3.moon, icon: '\u263D' },
    { label: 'Rising', data: big3.rising, icon: 'AC' },
  ];
  el.innerHTML = items.map(function(item) {
    if (!item.data) return '';
    return '<div class="widget-badge">' +
      '<span class="badge-icon">' + item.icon + '</span>' +
      '<span class="badge-sign">' + item.data.sign + '</span>' +
      '<span class="badge-label">' + item.label + '</span>' +
    '</div>';
  }).join('');
}

function renderChartRuler(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var ruler = chartData.getChartRuler();
  if (!ruler) { el.style.display = 'none'; return; }
  el.innerHTML = '<div class="widget-card">' +
    '<div class="widget-card-label">Chart Ruler</div>' +
    '<div class="widget-card-value">' + (PLANET_GLYPHS[ruler.planet] || '') + ' ' + ruler.planet + '</div>' +
    '<div class="widget-card-detail">' + ruler.sign + ' in the ' + ordinal(ruler.house) + ' house</div>' +
    '<div class="widget-card-sub">Rules your ' + ruler.ascendant_sign + ' Ascendant</div>' +
  '</div>';
}

function renderElementBalance(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var elements = chartData.getElements();
  var total = 0;
  ['fire', 'earth', 'air', 'water'].forEach(function(k) { total += elements[k].count; });
  if (total === 0) total = 1;
  var order = ['fire', 'earth', 'air', 'water'];
  el.innerHTML = '<div class="widget-card">' +
    '<div class="widget-card-label">Elements</div>' +
    order.map(function(key) {
      var e = elements[key];
      var pct = Math.round((e.count / total) * 100);
      return '<div class="bar-row">' +
        '<span class="bar-label">' + key + '</span>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + ELEMENT_COLORS[key] + '"></div></div>' +
        '<span class="bar-count">' + e.count + '</span>' +
      '</div>';
    }).join('') +
  '</div>';
}

function renderModalitySplit(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var mods = chartData.getModalities();
  var total = 0;
  ['cardinal', 'fixed', 'mutable'].forEach(function(k) { total += mods[k].count; });
  if (total === 0) total = 1;
  var colors = { cardinal: '#BA916B', fixed: '#8B7D5E', mutable: '#A3B5C4' };
  el.innerHTML = '<div class="widget-card">' +
    '<div class="widget-card-label">Modality</div>' +
    ['cardinal', 'fixed', 'mutable'].map(function(key) {
      var m = mods[key];
      var pct = Math.round((m.count / total) * 100);
      return '<div class="bar-row">' +
        '<span class="bar-label">' + key + '</span>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + colors[key] + '"></div></div>' +
        '<span class="bar-count">' + m.count + '</span>' +
      '</div>';
    }).join('') +
  '</div>';
}

function renderHemisphereBalance(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var h = chartData.getHemispheres();
  el.innerHTML = '<div class="widget-card">' +
    '<div class="widget-card-label">Hemisphere Balance</div>' +
    '<div class="hemisphere-grid">' +
      '<div class="hemisphere-cell"><div class="hemisphere-count">' + h.above.count + '</div><div class="hemisphere-label">above horizon</div><div class="hemisphere-sub">public life</div></div>' +
      '<div class="hemisphere-cell"><div class="hemisphere-count">' + h.below.count + '</div><div class="hemisphere-label">below horizon</div><div class="hemisphere-sub">inner world</div></div>' +
      '<div class="hemisphere-cell"><div class="hemisphere-count">' + h.east.count + '</div><div class="hemisphere-label">eastern</div><div class="hemisphere-sub">self-driven</div></div>' +
      '<div class="hemisphere-cell"><div class="hemisphere-count">' + h.west.count + '</div><div class="hemisphere-label">western</div><div class="hemisphere-sub">others-oriented</div></div>' +
    '</div>' +
  '</div>';
}

function renderStelliums(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var stelliums = chartData.getStelliums();
  if (!stelliums.length) { el.style.display = 'none'; return; }
  el.innerHTML = stelliums.map(function(s) {
    return '<div class="widget-card widget-card-glow">' +
      '<div class="widget-card-label">Stellium</div>' +
      '<div class="widget-card-value">' + s.key + '</div>' +
      '<div class="widget-card-detail">' + s.planets.join(', ') + ' clustered in ' + (s.type === 'sign' ? 'the sign of ' + s.key : s.key) + '</div>' +
    '</div>';
  }).join('');
}

function renderPlanetCards(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var planets = chartData.getPlanetCards();
  el.innerHTML = '<div class="planet-cards-scroll">' +
    planets.map(function(p) {
      return '<div class="planet-card">' +
        '<div class="planet-card-glyph">' + (PLANET_GLYPHS[p.name] || '') + '</div>' +
        '<div class="planet-card-name">' + p.name.replace('_', ' ') + '</div>' +
        '<div class="planet-card-sign">' + (SIGN_GLYPHS[p.sign] || '') + ' ' + p.sign + '</div>' +
        '<div class="planet-card-house">' + ordinal(p.house) + ' house</div>' +
        (p.retrograde ? '<div class="planet-card-rx">\u212E retrograde</div>' : '') +
      '</div>';
    }).join('') +
  '</div>';
}

function renderBusinessLens(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var biz = chartData.getBusinessLens();

  function houseSummary(houseData) {
    var sign = houseData.house ? houseData.house.sign : '\u2014';
    var planets = houseData.planets.map(function(p) { return p.name; }).join(', ') || 'no planets';
    return sign + ' \u2014 ' + planets;
  }

  el.innerHTML = '<div class="biz-grid">' +
    '<div class="widget-card">' +
      '<div class="widget-card-label">Your Money</div>' +
      '<div class="biz-row"><span class="biz-house">2nd house</span><span class="biz-detail">' + houseSummary(biz.money.second) + '</span></div>' +
      '<div class="biz-sub">earned income</div>' +
      '<div class="biz-row" style="margin-top:0.8rem"><span class="biz-house">8th house</span><span class="biz-detail">' + houseSummary(biz.money.eighth) + '</span></div>' +
      '<div class="biz-sub">other people\'s money</div>' +
    '</div>' +
    '<div class="widget-card">' +
      '<div class="widget-card-label">Your Visibility</div>' +
      '<div class="biz-row"><span class="biz-house">MC</span><span class="biz-detail">' + (biz.visibility.mc ? biz.visibility.mc.sign : '\u2014') + '</span></div>' +
      '<div class="biz-sub">how the world sees your brand</div>' +
    '</div>' +
    '<div class="widget-card">' +
      '<div class="widget-card-label">How You Sell</div>' +
      '<div class="biz-row"><span class="biz-house">Mercury</span><span class="biz-detail">' + (biz.communication.mercury ? biz.communication.mercury.sign + ' in ' + ordinal(biz.communication.mercury.house) : '\u2014') + '</span></div>' +
    '</div>' +
    '<div class="widget-card">' +
      '<div class="widget-card-label">How You Lead</div>' +
      '<div class="biz-row"><span class="biz-house">Sun</span><span class="biz-detail">' + (biz.leadership.sun ? biz.leadership.sun.sign + ' in ' + ordinal(biz.leadership.sun.house) : '\u2014') + '</span></div>' +
      '<div class="biz-row" style="margin-top:0.4rem"><span class="biz-house">Mars</span><span class="biz-detail">' + (biz.leadership.mars ? biz.leadership.mars.sign + ' in ' + ordinal(biz.leadership.mars.house) : '\u2014') + '</span></div>' +
    '</div>' +
  '</div>';
}

function renderAspectWeb(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var aspects = chartData.getAspects();
  var planets = chartData.getPlanetCards();
  if (!aspects.length) { el.style.display = 'none'; return; }

  var size = Math.min(el.clientWidth || 400, 400);
  var cx = size / 2;
  var r = size / 2 - 30;

  var positions = {};
  planets.forEach(function(p, i) {
    var angle = (i / planets.length) * Math.PI * 2 - Math.PI / 2;
    positions[p.name] = {
      x: cx + Math.cos(angle) * r,
      y: cx + Math.sin(angle) * r,
    };
  });

  var svg = d3.select('#' + containerId)
    .append('svg')
    .attr('viewBox', '0 0 ' + size + ' ' + size)
    .attr('width', '100%')
    .style('max-width', size + 'px');

  aspects.forEach(function(a) {
    var p1 = positions[a.planet1];
    var p2 = positions[a.planet2];
    if (!p1 || !p2) return;
    svg.append('line')
      .attr('x1', p1.x).attr('y1', p1.y)
      .attr('x2', p2.x).attr('y2', p2.y)
      .attr('stroke', ASPECT_COLORS[a.type] || 'rgba(255,255,255,0.15)')
      .attr('stroke-width', Math.max(0.5, 2 - a.orb / 3))
      .attr('opacity', 0.5);
  });

  planets.forEach(function(p) {
    var pos = positions[p.name];
    if (!pos) return;
    var g = svg.append('g').attr('transform', 'translate(' + pos.x + ',' + pos.y + ')');
    g.append('circle').attr('r', 5).attr('fill', 'var(--mist)').attr('stroke', 'var(--smoke)').attr('stroke-width', 2);
    g.append('text').attr('y', -10).attr('text-anchor', 'middle').attr('fill', 'var(--stone)').attr('font-size', '10px')
      .text(PLANET_GLYPHS[p.name] || p.name.slice(0, 2));
  });
}

function renderCosmicDNA(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var planets = chartData.getPlanetCards();
  el.innerHTML = '<div class="widget-card">' +
    '<div class="widget-card-label">Cosmic DNA</div>' +
    '<div class="dna-strip">' +
      planets.map(function(p) {
        var meta = SIGN_META_SIMPLE[p.sign];
        return '<div class="dna-segment" style="background:' + (meta ? meta.color : '#666') + '" title="' + p.name + ' in ' + p.sign + '"></div>';
      }).join('') +
    '</div>' +
    '<div class="dna-labels">' +
      planets.map(function(p) {
        return '<span class="dna-label">' + (PLANET_GLYPHS[p.name] || p.name[0]) + '</span>';
      }).join('') +
    '</div>' +
  '</div>';
}

function renderRetrogrades(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var retros = chartData.getRetrogrades();
  if (!retros.length) {
    el.innerHTML = '<div class="widget-card">' +
      '<div class="widget-card-label">Natal Retrogrades</div>' +
      '<div class="widget-card-detail" style="opacity:0.4">None</div>' +
    '</div>';
    return;
  }
  el.innerHTML = '<div class="widget-card">' +
    '<div class="widget-card-label">Natal Retrogrades</div>' +
    '<div class="retro-badges">' +
      retros.map(function(p) {
        return '<span class="retro-badge">' + (PLANET_GLYPHS[p.name] || '') + ' ' + p.name + ' \u212E</span>';
      }).join('') +
    '</div>' +
  '</div>';
}
