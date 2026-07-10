// widgets.js — All profile widget components (v2)

function ordinal(n) {
  var s = ['th','st','nd','rd'];
  var v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── BIG 3 BADGES ──────────────────────────────────────

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

// ── CHART RULER (compact) ─────────────────────────────

function renderChartRuler(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var ruler = chartData.getChartRuler();
  if (!ruler) { el.style.display = 'none'; return; }
  el.innerHTML =
    '<div class="ruler-compact">' +
      '<span class="ruler-glyph">' + (PLANET_GLYPHS[ruler.planet] || '') + '</span>' +
      '<span class="ruler-text">Chart ruler <strong>' + ruler.planet + '</strong> in ' + ruler.sign + ' ' + ordinal(ruler.house) + ' house</span>' +
    '</div>';
}

// ── ELEMENT BALANCE (bars) ────────────────────────────

function renderElementBalance(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var elements = chartData.getElements();
  var total = 0;
  ['fire','earth','air','water'].forEach(function(k) { total += elements[k].count; });
  if (total === 0) total = 1;
  el.innerHTML = '<div class="widget-card">' +
    '<div class="widget-card-label">Elements</div>' +
    ['fire','earth','air','water'].map(function(key) {
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

// ── MODALITY SPLIT (bars) ─────────────────────────────

function renderModalitySplit(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var mods = chartData.getModalities();
  var total = 0;
  ['cardinal','fixed','mutable'].forEach(function(k) { total += mods[k].count; });
  if (total === 0) total = 1;
  var colors = { cardinal: '#BA916B', fixed: '#8B7D5E', mutable: '#A3B5C4' };
  el.innerHTML = '<div class="widget-card">' +
    '<div class="widget-card-label">Modality</div>' +
    ['cardinal','fixed','mutable'].map(function(key) {
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

// ── BUSINESS ARCHETYPE (3 spectrums) ──────────────────

function renderArchetype(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var a = chartData.getArchetype();

  function spectrum(left, right, value, color) {
    return '<div class="spectrum-row">' +
      '<span class="spectrum-label-left">' + left + '</span>' +
      '<div class="spectrum-track">' +
        '<div class="spectrum-dot" style="left:' + value + '%;background:' + color + '"></div>' +
      '</div>' +
      '<span class="spectrum-label-right">' + right + '</span>' +
    '</div>';
  }

  el.innerHTML = '<div class="widget-card">' +
    '<div class="widget-card-label">Business Archetype</div>' +
    spectrum('Operator', 'Visionary', a.visionary, '#BA916B') +
    spectrum('Finisher', 'Starter', a.starter, '#A3B5C4') +
    spectrum('Committed', 'Adaptable', a.adaptable, '#5B7B7A') +
  '</div>';
}

// ── MONEY STYLE (spectrums) ───────────────────────────

function renderMoneyStyle(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var m = chartData.getMoneyStyle();

  function spectrum(left, right, value) {
    return '<div class="spectrum-row">' +
      '<span class="spectrum-label-left">' + left + '</span>' +
      '<div class="spectrum-track">' +
        '<div class="spectrum-dot" style="left:' + value + '%;background:#BA916B"></div>' +
      '</div>' +
      '<span class="spectrum-label-right">' + right + '</span>' +
    '</div>';
  }

  el.innerHTML = '<div class="widget-card">' +
    '<div class="widget-card-label">Money Style</div>' +
    spectrum('Volatile', 'Steady', m.stability) +
    spectrum('Conservative', 'Risk-taker', m.risk) +
    spectrum('Joint ventures', 'Self-earned', m.ownVsOther) +
  '</div>';
}

// ── VISIBILITY METER (radial gauge) ───────────────────

function renderVisibilityMeter(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var score = chartData.getVisibilityScore();
  var mc = chartData.planets.find(function(p) { return p.name === 'Medium_Coeli'; });
  var mcSign = mc ? mc.sign : '';

  // Semi-circle gauge using SVG
  var radius = 60;
  var circumference = Math.PI * radius;
  var filled = (score / 100) * circumference;

  el.innerHTML = '<div class="widget-card" style="text-align:center">' +
    '<div class="widget-card-label">Visibility</div>' +
    '<svg viewBox="0 0 150 90" width="150" height="90" style="margin:0.5rem auto;display:block">' +
      '<path d="M 15 80 A 60 60 0 0 1 135 80" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8" stroke-linecap="round"/>' +
      '<path d="M 15 80 A 60 60 0 0 1 135 80" fill="none" stroke="#BA916B" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + filled + ' ' + circumference + '"/>' +
    '</svg>' +
    '<div class="vis-score">' + score + '%</div>' +
    '<div class="vis-label">public-facing chart</div>' +
    (mcSign ? '<div class="vis-mc">MC in ' + mcSign + '</div>' : '') +
  '</div>';
}

// ── SALES STYLE BADGE ─────────────────────────────────

function renderSalesStyle(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var s = chartData.getSalesStyle();
  if (!s) { el.style.display = 'none'; return; }
  el.innerHTML = '<div class="widget-card style-badge-card">' +
    '<div class="widget-card-label">How You Sell</div>' +
    '<div class="style-badge-glyph">' + (PLANET_GLYPHS.Mercury || '') + '</div>' +
    '<div class="style-badge-type">' + s.type + '</div>' +
    '<div class="style-badge-desc">' + s.desc + '</div>' +
    '<div class="style-badge-detail">Mercury in ' + s.planet.sign + ' ' + ordinal(s.planet.house) + '</div>' +
  '</div>';
}

// ── LEADERSHIP STYLE BADGE ────────────────────────────

function renderLeadershipStyle(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var l = chartData.getLeadershipStyle();
  if (!l) { el.style.display = 'none'; return; }
  el.innerHTML = '<div class="widget-card style-badge-card">' +
    '<div class="widget-card-label">How You Lead</div>' +
    '<div class="style-badge-glyph">' + (PLANET_GLYPHS.Sun || '') + '</div>' +
    '<div class="style-badge-type">' + l.type + '</div>' +
    '<div class="style-badge-desc">' + l.desc + '</div>' +
    '<div class="style-badge-detail">Sun in ' + l.planet.sign + ' ' + ordinal(l.planet.house) + '</div>' +
  '</div>';
}

// ── PLANET POWER RANKING ──────────────────────────────

function renderPlanetRanking(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var ranked = chartData.getPlanetRanking();
  var maxScore = ranked.length > 0 ? ranked[0].score : 1;

  el.innerHTML = '<div class="widget-card">' +
    '<div class="widget-card-label">Planet Strength</div>' +
    ranked.map(function(p, i) {
      var pct = Math.round((p.score / maxScore) * 100);
      var isTop = i === 0;
      return '<div class="rank-row' + (isTop ? ' rank-top' : '') + '">' +
        '<span class="rank-glyph">' + (PLANET_GLYPHS[p.name] || '') + '</span>' +
        '<span class="rank-name">' + p.name + (p.retrograde ? ' \u212E' : '') + '</span>' +
        '<div class="rank-bar-track"><div class="rank-bar-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="rank-sign">' + (SIGN_GLYPHS[p.sign] || '') + ' ' + ordinal(p.house) + '</span>' +
      '</div>';
    }).join('') +
  '</div>';
}

// ── HEMISPHERE (quadrant visual) ──────────────────────

function renderHemisphereBalance(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var h = chartData.getHemispheres();
  var total = (h.above ? h.above.count : 0) + (h.below ? h.below.count : 0);
  if (total === 0) total = 1;
  var abovePct = Math.round(((h.above ? h.above.count : 0) / total) * 100);
  var eastPct = Math.round(((h.east ? h.east.count : 0) / total) * 100);

  el.innerHTML = '<div class="widget-card">' +
    '<div class="widget-card-label">Chart Focus</div>' +
    '<div class="quad-grid">' +
      '<div class="quad-cell" style="opacity:' + (eastPct > 50 && abovePct > 50 ? '1' : '0.3') + '">' +
        '<div class="quad-label">Public Self</div><div class="quad-sub">visible leadership</div></div>' +
      '<div class="quad-cell" style="opacity:' + (eastPct <= 50 && abovePct > 50 ? '1' : '0.3') + '">' +
        '<div class="quad-label">Public Others</div><div class="quad-sub">partnerships &amp; clients</div></div>' +
      '<div class="quad-cell" style="opacity:' + (eastPct > 50 && abovePct <= 50 ? '1' : '0.3') + '">' +
        '<div class="quad-label">Private Self</div><div class="quad-sub">inner development</div></div>' +
      '<div class="quad-cell" style="opacity:' + (eastPct <= 50 && abovePct <= 50 ? '1' : '0.3') + '">' +
        '<div class="quad-label">Private Others</div><div class="quad-sub">family &amp; foundation</div></div>' +
    '</div>' +
    '<div class="quad-summary">' + abovePct + '% public-facing \u00B7 ' + eastPct + '% self-driven</div>' +
  '</div>';
}

// ── RETROGRADES (improved) ────────────────────────────

function renderRetrogrades(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var retros = chartData.getRetrogrades();

  var RETRO_MEANINGS = {
    Mercury: 'Communication style is internal-first. You process before you speak.',
    Venus: 'Your relationship to value and pricing runs deeper than surface level.',
    Mars: 'Your drive operates behind the scenes. Action happens internally before externally.',
    Jupiter: 'Growth and expansion develop privately before going public.',
    Saturn: 'Your relationship to structure and authority is self-taught, not inherited.',
  };

  if (!retros.length) {
    el.innerHTML = '<div class="widget-card">' +
      '<div class="widget-card-label">Natal Retrogrades</div>' +
      '<div class="retro-none">No natal retrogrades. Your planets all operate in direct motion.</div>' +
    '</div>';
    return;
  }

  el.innerHTML = '<div class="widget-card">' +
    '<div class="widget-card-label">Natal Retrogrades</div>' +
    retros.map(function(p) {
      var meaning = RETRO_MEANINGS[p.name] || '';
      return '<div class="retro-item">' +
        '<div class="retro-planet">' + (PLANET_GLYPHS[p.name] || '') + ' ' + p.name + ' \u212E</div>' +
        (meaning ? '<div class="retro-meaning">' + meaning + '</div>' : '') +
      '</div>';
    }).join('') +
  '</div>';
}

// ── STELLIUM CALLOUT ──────────────────────────────────

function renderStelliums(containerId, chartData, snippets) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var stelliums = chartData.getStelliums();
  if (!stelliums.length) { el.style.display = 'none'; return; }

  el.innerHTML = stelliums.map(function(s) {
    var snippetText = '';
    if (snippets && snippets.stellium) {
      var match = snippets.stellium.find(function(sn) {
        return sn.type === s.type && sn.key === (s.type === 'house' ? s.key.replace('House ', '') : s.key);
      });
      if (match) snippetText = '<div class="snippet-text">' + match.text + '</div>';
    }
    return '<div class="widget-card widget-card-glow">' +
      '<div class="widget-card-label">Stellium</div>' +
      '<div class="widget-card-value">' + s.key + '</div>' +
      '<div class="widget-card-detail">' + s.planets.join(', ') + '</div>' +
      snippetText +
    '</div>';
  }).join('');
}

// ── TEXT SECTION RENDERER ─────────────────────────────

function renderTextSection(containerId, text) {
  var el = document.getElementById(containerId);
  if (!el || !text) { if (el) el.style.display = 'none'; return; }
  el.innerHTML = '<div class="text-section">' + text + '</div>';
}

// ── UPSELL BANNER ─────────────────────────────────────

function renderUpsellBanner(containerId, config) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div class="upsell-banner">' +
    '<div class="upsell-label">' + config.label + '</div>' +
    '<div class="upsell-hook">' + config.hook + '</div>' +
    '<a href="' + config.url + '" class="upsell-cta">' + config.cta + '</a>' +
  '</div>';
}
