// widgets.js — All profile widget components (Gilded Observatory redesign)

function ordinal(n) {
  var s = ['th','st','nd','rd'];
  var v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Element tint colors for Big 3 circles (based on sign element)
var ELEMENT_TINTS = {
  fire:  'rgba(196,133,79,0.16)',
  earth: 'rgba(151,155,114,0.16)',
  air:   'rgba(168,176,188,0.16)',
  water: 'rgba(110,140,160,0.16)',
};

var ELEMENT_BAR_COLORS = {
  fire: '#C4854F', earth: '#979B72', air: '#A8B0BC', water: '#6E8CA0',
};

// ── BIG 3 BADGES ──────────────────────────────────────

function renderBig3(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var big3 = chartData.getBig3();
  var items = [
    { label: 'SUN', sub: 'Your core identity in business', data: big3.sun, glyph: '\u2609' },
    { label: 'MOON', sub: 'What nourishes you as an entrepreneur', data: big3.moon, glyph: '\u263D' },
    { label: 'RISING', sub: 'Why clients feel drawn to your brand', data: big3.rising, glyph: '\u2191' },
  ];
  el.innerHTML = items.map(function(item) {
    if (!item.data) return '';
    var signEl = SIGN_ELEMENTS[item.data.sign] || 'air';
    var tint = ELEMENT_TINTS[signEl] || ELEMENT_TINTS.air;
    return '<div class="frost-card big3-card">' +
      '<div class="big3-circle">' +
        '<div class="big3-circle__inner" style="background:radial-gradient(closest-side,' + tint + ',transparent)"></div>' +
        '<span class="big3-circle__glyph">' + item.glyph + '</span>' +
      '</div>' +
      '<div class="big3-sign">' + item.data.sign + '</div>' +
      '<div style="display:flex;flex-direction:column;align-items:center;gap:7px">' +
        '<div class="big3-label">' + item.label + '</div>' +
        '<div class="big3-sub">' + item.sub + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ── CHART RULER (pill) ──────────────────────────────────

function renderChartRuler(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var ruler = chartData.getChartRuler();
  if (!ruler) { el.style.display = 'none'; return; }
  var glyph = PLANET_GLYPHS[ruler.planet] || '';
  el.innerHTML =
    '<div class="ruler-pill">' +
      '<span class="ruler-pill__glyph">' + glyph + '</span>' +
      '<span class="ruler-pill__label">CHART&nbsp;RULER</span>' +
      '<span class="ruler-pill__divider"></span>' +
      '<span class="ruler-pill__text">' + ruler.planet + ' in ' + ruler.sign + ' \u00B7 ' + ordinal(ruler.house) + ' house</span>' +
    '</div>';
}

// ── MIDHEAVEN PILL ──────────────────────────────────────

function renderMidheavenPill(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var mc = chartData.planets.find(function(p) { return p.name === 'Medium_Coeli'; });
  if (!mc) { el.style.display = 'none'; return; }
  var glyph = SIGN_GLYPHS[mc.sign] || '';
  el.innerHTML =
    '<div class="ruler-pill">' +
      '<span class="ruler-pill__glyph">' + glyph + '</span>' +
      '<span class="ruler-pill__label">MIDHEAVEN</span>' +
      '<span class="ruler-pill__divider"></span>' +
      '<span class="ruler-pill__text">' + mc.sign + ' MC \u00B7 ' + ordinal(mc.house) + ' house</span>' +
    '</div>';
}

// ── ELEMENT BALANCE (bars) ────────────────────────────

function renderElementBalance(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var elements = chartData.getElements();
  var maxCount = 0;
  ['fire','earth','air','water'].forEach(function(k) {
    if (elements[k] && elements[k].count > maxCount) maxCount = elements[k].count;
  });
  if (maxCount === 0) maxCount = 1;
  var dominant = chartData.getDominantElement();

  var delays = ['0.1s','0.2s','0.3s','0.4s'];
  var html = '<div class="frost-card" style="padding:30px 32px">' +
    '<div class="widget-label" style="margin-bottom:26px">ELEMENTS</div>' +
    '<div class="bar-rows">' +
    ['fire','earth','air','water'].map(function(key, i) {
      var e = elements[key];
      var count = e ? e.count : 0;
      var pct = Math.round((count / maxCount) * 100);
      var color = ELEMENT_BAR_COLORS[key];
      return '<div class="bar-item">' +
        '<div class="bar-item__header">' +
          '<span class="bar-item__name">' + key.toUpperCase() + '</span>' +
          '<span class="bar-item__count" style="color:' + color + '">' + count + '</span>' +
        '</div>' +
        '<div class="bar-item__track">' +
          '<div class="bar-item__fill anim-grow" style="width:' + pct + '%;background:' + color + ';animation-delay:' + delays[i] + '"></div>' +
        '</div>' +
      '</div>';
    }).join('') +
    '</div>' +
    '<div class="bar-footer">Dominant element: <span>' + dominant.charAt(0).toUpperCase() + dominant.slice(1) + '</span></div>' +
    '<div class="widget-context" id="element-context"></div>' +
  '</div>';
  el.innerHTML = html;

  var elementDescriptions = {
    fire: 'You lead with bold action, vision, and momentum. Your business thrives when you trust your instincts and move fast. Sitting still kills your energy.',
    earth: 'You build things that last. Slow, steady, tangible results. Your business grows through consistency, structure, and proof of concept.',
    air: 'You lead with ideas, connections, and communication. Your business grows through networking, content, and intellectual positioning.',
    water: 'You lead with intuition, emotional intelligence, and depth. Your business grows through trust, transformation, and genuine connection.',
  };
  var contextEl = document.getElementById('element-context');
  if (contextEl && elementDescriptions[dominant]) {
    contextEl.textContent = elementDescriptions[dominant];
  }
}

// ── MODALITY SPLIT (bars) ─────────────────────────────

function renderModalitySplit(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var mods = chartData.getModalities();
  var maxCount = 0;
  ['cardinal','fixed','mutable'].forEach(function(k) {
    if (mods[k] && mods[k].count > maxCount) maxCount = mods[k].count;
  });
  if (maxCount === 0) maxCount = 1;
  var dominant = chartData.getDominantModality();

  var modColors = {
    cardinal: '#BA916B',
    fixed: 'rgba(186,145,107,0.55)',
    mutable: 'rgba(186,145,107,0.55)',
  };
  var delays = ['0.1s','0.2s','0.3s'];

  var html = '<div class="frost-card" style="padding:30px 32px">' +
    '<div class="widget-label" style="margin-bottom:26px">MODALITY</div>' +
    '<div class="bar-rows">' +
    ['cardinal','fixed','mutable'].map(function(key, i) {
      var m = mods[key];
      var count = m ? m.count : 0;
      var pct = Math.round((count / maxCount) * 100);
      var color = modColors[key];
      return '<div class="bar-item">' +
        '<div class="bar-item__header">' +
          '<span class="bar-item__name">' + key.toUpperCase() + '</span>' +
          '<span class="bar-item__count" style="color:' + color + '">' + count + '</span>' +
        '</div>' +
        '<div class="bar-item__track">' +
          '<div class="bar-item__fill anim-grow" style="width:' + pct + '%;background:' + color + ';animation-delay:' + delays[i] + '"></div>' +
        '</div>' +
      '</div>';
    }).join('') +
    '</div>' +
    '<div class="bar-footer">Dominant modality: <span>' + dominant.charAt(0).toUpperCase() + dominant.slice(1) + '</span></div>' +
    '<div class="widget-context" id="modality-context"></div>' +
  '</div>';
  el.innerHTML = html;

  var modalityDescriptions = {
    cardinal: 'You are a starter. You initiate projects, lead from the front, and set things in motion. Your challenge is finishing what you start.',
    fixed: 'You are a finisher. Once you commit, you see it through. Your business grows through persistence and depth. Your challenge is adapting when the plan stops working.',
    mutable: 'You are adaptable. You pivot fast, read the room, and adjust your offer to what the market needs. Your challenge is sticking with one thing long enough to see it compound.',
  };
  var modContextEl = document.getElementById('modality-context');
  if (modContextEl && modalityDescriptions[dominant]) {
    modContextEl.textContent = modalityDescriptions[dominant];
  }
}

// ── BUSINESS ARCHETYPE (3 spectrums) ──────────────────

function renderArchetype(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var a = chartData.getArchetype();

  var rows = [
    { left: 'OPERATOR', right: 'VISIONARY', value: a.visionary },
    { left: 'FINISHER', right: 'STARTER', value: a.starter },
    { left: 'COMMITTED', right: 'ADAPTABLE', value: a.adaptable },
  ];

  var contexts = [
    a.visionary < 35
      ? 'You lead with systems, structure, and execution. Ideas without a plan don\'t interest you.'
      : a.visionary > 65
      ? 'You lead with ideas, vision, and possibility. You see the future before the spreadsheet catches up.'
      : 'You balance vision with execution. You can dream it up and build it out.',
    a.starter < 35
      ? 'You finish what you start. Persistence is your edge. You outlast the competition.'
      : a.starter > 65
      ? 'You are wired to initiate. First moves come naturally. Your challenge is staying once the novelty fades.'
      : 'You can start and finish. You pick your moments to launch and your moments to grind.',
    a.adaptable < 35
      ? 'Once you commit, you stay committed. Loyalty to your path is a strength. Rigidity is the shadow side.'
      : a.adaptable > 65
      ? 'You pivot fast and read the room. Flexibility is your superpower. The risk is spreading too thin.'
      : 'You know when to hold your ground and when to adjust. That balance is rare.',
  ];

  el.innerHTML = '<div class="frost-card" style="padding:30px 32px">' +
    '<div class="widget-label" style="margin-bottom:30px">BUSINESS&nbsp;ARCHETYPE</div>' +
    '<div class="spectrum-rows">' +
    rows.map(function(r, i) {
      var leftActive = r.value < 50;
      return '<div class="spectrum-item">' +
        '<div class="spectrum-item__poles">' +
          '<span class="spectrum-item__pole ' + (leftActive ? 'spectrum-item__pole--active' : 'spectrum-item__pole--dim') + '">' + r.left + '</span>' +
          '<span class="spectrum-item__pole ' + (!leftActive ? 'spectrum-item__pole--active' : 'spectrum-item__pole--dim') + '">' + r.right + '</span>' +
        '</div>' +
        '<div class="spectrum-item__track">' +
          '<div class="spectrum-item__line"></div>' +
          '<div class="spectrum-item__tick"></div>' +
          '<div class="spectrum-item__dot" style="left:' + r.value + '%"></div>' +
        '</div>' +
        '<div class="spectrum-item__context">' + contexts[i] + '</div>' +
      '</div>';
    }).join('') +
    '</div>' +
  '</div>';
}

// ── HEMISPHERE BALANCE (2x2 grid) ─────────────────────

function renderHemisphereBalance(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var h = chartData.getHemispheres();
  var total = (h.above ? h.above.count : 0) + (h.below ? h.below.count : 0);
  if (total === 0) total = 1;
  var aboveCount = h.above ? h.above.count : 0;
  var eastCount = h.east ? h.east.count : 0;
  var abovePct = Math.round((aboveCount / total) * 100);
  var eastPct = Math.round((eastCount / total) * 100);

  // Quadrants: top-left = Public Self (east+above), top-right = Public Others (west+above)
  // bottom-left = Private Self (east+below), bottom-right = Private Others (west+below)
  var quads = [
    { t: 'Public Self', s: 'Career & output', active: eastPct > 50 && abovePct > 50, weight: 0.10 },
    { t: 'Public Others', s: 'Clients & audience', active: eastPct <= 50 && abovePct > 50, weight: 0.18 },
    { t: 'Private Self', s: 'Inner work', active: eastPct > 50 && abovePct <= 50, weight: 0 },
    { t: 'Private Others', s: 'Home & foundations', active: eastPct <= 50 && abovePct <= 50, weight: 0 },
  ];

  // Determine dominant description
  var dominantDesc = abovePct > 50 ? 'above the horizon' : 'below the horizon';
  var dominantFlavor = abovePct > 50 ? 'a chart that works in public' : 'a chart that works behind the scenes';

  // Build plain-language summary
  var hemiContext = '';
  if (abovePct > 60) {
    hemiContext = 'Most of your planets sit in the upper hemisphere. Your business energy is directed outward toward clients and public visibility. You work best when people can see what you do.';
  } else if (abovePct < 40) {
    hemiContext = 'Most of your planets sit below the horizon. Your business runs on behind-the-scenes work, internal process, and deep preparation. The output is public, but the engine is private.';
  } else {
    hemiContext = 'Your planets are spread across both hemispheres. You alternate between public-facing work and internal building. Neither mode dominates.';
  }
  if (eastPct > 60) {
    hemiContext += ' With more planets in the eastern half, you are self-directed. You set the agenda.';
  } else if (eastPct < 40) {
    hemiContext += ' With more planets in the western half, your best opportunities come through other people. Partnerships and client work fuel your growth.';
  }

  el.innerHTML = '<div class="frost-card" style="padding:30px 32px;display:flex;flex-direction:column">' +
    '<div class="widget-label" style="margin-bottom:24px">CHART&nbsp;FOCUS</div>' +
    '<div class="hemi-grid">' +
    quads.map(function(q) {
      if (q.active) {
        var alpha = 0.10 + q.weight;
        return '<div class="hemi-cell" style="background:rgba(186,145,107,' + alpha + ');border:1px solid rgba(186,145,107,' + (0.3 + q.weight * 0.8) + ')">' +
          '<div class="hemi-cell__title" style="color:var(--mist)">' + q.t + '</div>' +
          '<div class="hemi-cell__sub" style="color:var(--stone)">' + q.s + '</div>' +
        '</div>';
      }
      return '<div class="hemi-cell" style="background:rgba(242,240,229,0.02);border:1px solid rgba(186,175,163,0.08)">' +
        '<div class="hemi-cell__title" style="color:rgba(180,167,148,0.5)">' + q.t + '</div>' +
        '<div class="hemi-cell__sub" style="color:rgba(180,167,148,0.35)">' + q.s + '</div>' +
      '</div>';
    }).join('') +
    '</div>' +
    '<div class="hemi-footer">' + hemiContext + '</div>' +
  '</div>';
}

// ── MONEY STYLE (spectrums) ───────────────────────────

function renderMoneyStyle(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var m = chartData.getMoneyStyle();
  var biz = chartData.getBusinessLens();
  var secondHouse = biz.money.second.house;
  var secondSign = secondHouse ? secondHouse.sign : '';

  // Build footer caption
  var footerParts = [];
  if (secondSign) {
    var secondElement = SIGN_ELEMENTS[secondSign] || '';
    footerParts.push(secondSign + ' on your 2nd house');
    if (secondElement) footerParts.push(secondElement + ' approach to money');
  }

  var rows = [
    { left: 'VOLATILE', right: 'STEADY', value: m.stability },
    { left: 'CONSERVATIVE', right: 'RISK-TAKER', value: m.risk },
    { left: 'JOINT VENTURES', right: 'SELF-EARNED', value: m.ownVsOther },
  ];

  el.innerHTML = '<div class="frost-card" style="padding:30px 32px">' +
    '<div class="widget-label" style="margin-bottom:30px">MONEY&nbsp;STYLE</div>' +
    '<div class="spectrum-rows">' +
    rows.map(function(r) {
      var leftActive = r.value < 50;
      return '<div class="spectrum-item">' +
        '<div class="spectrum-item__poles">' +
          '<span class="spectrum-item__pole ' + (leftActive ? 'spectrum-item__pole--active' : 'spectrum-item__pole--dim') + '">' + r.left + '</span>' +
          '<span class="spectrum-item__pole ' + (!leftActive ? 'spectrum-item__pole--active' : 'spectrum-item__pole--dim') + '">' + r.right + '</span>' +
        '</div>' +
        '<div class="spectrum-item__track">' +
          '<div class="spectrum-item__line"></div>' +
          '<div class="spectrum-item__tick"></div>' +
          '<div class="spectrum-item__dot" style="left:' + r.value + '%"></div>' +
        '</div>' +
      '</div>';
    }).join('') +
    '</div>' +
    (footerParts.length ? '<div class="bar-footer">' + footerParts.join(' \u00B7 ') + '</div>' : '') +
  '</div>';
}

// ── VISIBILITY METER (SVG gauge) ──────────────────────

function renderVisibilityMeter(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var score = chartData.getVisibilityScore();
  var mc = chartData.planets.find(function(p) { return p.name === 'Medium_Coeli'; });
  var mcSign = mc ? mc.sign : '';
  var mcGlyph = mcSign ? (SIGN_GLYPHS[mcSign] || '') : '';

  var arcLen = 283; // pi * 90
  var offset = Math.round(arcLen * (1 - score / 100) * 10) / 10;

  el.innerHTML = '<div class="frost-card vis-card">' +
    '<div class="widget-label">VISIBILITY</div>' +
    '<svg width="240" height="140" viewBox="0 0 240 140" style="display:block;overflow:visible">' +
      '<defs><linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#8A6C50"/><stop offset="100%" stop-color="#D8B389"/></linearGradient></defs>' +
      '<path d="M 30 130 A 90 90 0 0 1 210 130" fill="none" stroke="rgba(216,207,185,0.1)" stroke-width="10" stroke-linecap="round"/>' +
      '<path d="M 30 130 A 90 90 0 0 1 210 130" fill="none" stroke="url(#gaugeGrad)" stroke-width="10" stroke-linecap="round" stroke-dasharray="283" stroke-dashoffset="' + offset + '" class="gauge-fill" style="filter:drop-shadow(0 0 8px rgba(186,145,107,0.4))"/>' +
      '<text x="120" y="108" text-anchor="middle" style="font-family:\'Cormorant Garamond\',serif;font-size:52px;fill:#F2F0E5">' + score + '%</text>' +
      '<text x="120" y="132" text-anchor="middle" style="font-family:Jost,sans-serif;font-size:9px;letter-spacing:0.24em;fill:#B4A794">PUBLIC-FACING CHART</text>' +
    '</svg>' +
    (mcSign ? '<div class="vis-mc-pill"><span class="vis-mc-pill__glyph">' + mcGlyph + '</span><span class="vis-mc-pill__text">MC&nbsp;IN&nbsp;' + mcSign.toUpperCase() + '</span></div>' : '') +
  '</div>';
}

// ── SALES STYLE BADGE ─────────────────────────────────

function renderSalesStyle(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var s = chartData.getSalesStyle();
  if (!s) { el.style.display = 'none'; return; }
  var glyph = PLANET_GLYPHS.Mercury || '\u263F';
  var placement = 'MERCURY IN ' + s.planet.sign.toUpperCase() + ' \u00B7 ' + ordinal(s.planet.house).toUpperCase() + ' HOUSE';

  el.innerHTML = '<div class="frost-card badge-card anim-fade-up">' +
    '<div class="badge-card__label">SALES&nbsp;STYLE</div>' +
    '<div class="badge-card__halo">' +
      '<div class="badge-card__halo-ring"></div>' +
      '<span class="badge-card__glyph">' + glyph + '</span>' +
    '</div>' +
    '<div class="badge-card__type">' + s.type + '</div>' +
    '<p class="badge-card__desc">' + s.desc + '</p>' +
    '<div class="badge-card__rule"></div>' +
    '<div class="badge-card__placement">' + placement + '</div>' +
    (s.basis ? '<p class="badge-card__basis">' + s.basis + '</p>' : '') +
  '</div>';
}

// ── LEADERSHIP STYLE BADGE ────────────────────────────

function renderLeadershipStyle(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var l = chartData.getLeadershipStyle();
  if (!l) { el.style.display = 'none'; return; }
  var glyph = PLANET_GLYPHS.Sun || '\u2609';
  var placement = 'SUN IN ' + l.planet.sign.toUpperCase() + ' \u00B7 ' + ordinal(l.planet.house).toUpperCase() + ' HOUSE';

  el.innerHTML = '<div class="frost-card badge-card anim-fade-up">' +
    '<div class="badge-card__label">LEADERSHIP&nbsp;STYLE</div>' +
    '<div class="badge-card__halo">' +
      '<div class="badge-card__halo-ring"></div>' +
      '<span class="badge-card__glyph">' + glyph + '</span>' +
    '</div>' +
    '<div class="badge-card__type">' + l.type + '</div>' +
    '<p class="badge-card__desc">' + l.desc + '</p>' +
    '<div class="badge-card__rule"></div>' +
    '<div class="badge-card__placement">' + placement + '</div>' +
    (l.basis ? '<p class="badge-card__basis">' + l.basis + '</p>' : '') +
  '</div>';
}

// ── PLANET POWER RANKING ──────────────────────────────

function renderPlanetRanking(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var ranked = chartData.getPlanetRanking();
  var maxScore = ranked.length > 0 ? ranked[0].score : 1;
  var gold = '#BA916B';
  var dim = 'rgba(180,167,148,0.55)';
  var delays = ranked.map(function(_, i) { return (0.1 + i * 0.08).toFixed(2) + 's'; });

  // House type labels for explanation
  var HOUSE_TYPES = { 1:'angular', 4:'angular', 7:'angular', 10:'angular', 2:'succedent', 5:'succedent', 8:'succedent', 11:'succedent', 3:'cadent', 6:'cadent', 9:'cadent', 12:'cadent' };

  el.innerHTML = '<div class="frost-card" style="padding:30px 32px">' +
    '<div class="widget-label" style="margin-bottom:26px">PLANET&nbsp;STRENGTH</div>' +
    '<div class="rank-rows">' +
    ranked.map(function(p, i) {
      var pct = Math.round((p.score / maxScore) * 100);
      var isTop = i === 0;
      var glyphCol = isTop ? '#E8C9A6' : dim;
      var nameCol = isTop ? '#F2F0E5' : '#D8CFB9';
      var barCol = isTop ? gold : 'rgba(216,207,185,0.35)';
      var glyph = PLANET_GLYPHS[p.name] || '';
      var detail = p.sign + ' \u00B7 ' + ordinal(p.house);
      if (p.retrograde) detail += ' \u212E';

      // Build explanation
      var houseType = HOUSE_TYPES[p.house] || 'cadent';
      var aspectCount = chartData.aspects.filter(function(a) { return a.planet1 === p.name || a.planet2 === p.name; }).length;
      var reasons = [];
      if (houseType === 'angular') reasons.push('angular house (high visibility)');
      else if (houseType === 'succedent') reasons.push('succedent house (resource position)');
      else reasons.push('cadent house (behind the scenes)');
      if (aspectCount > 0) reasons.push(aspectCount + ' aspect' + (aspectCount > 1 ? 's' : '') + ' (actively connected)');
      if (p.retrograde) reasons.push('retrograde (internalized)');
      var explanation = reasons.join(' + ');

      return '<div class="rank-row">' +
        '<span class="rank-row__glyph" style="color:' + glyphCol + '">' + glyph + '</span>' +
        '<span class="rank-row__name" style="color:' + nameCol + '">' + p.name + '</span>' +
        '<div class="rank-row__bar"><div class="rank-row__bar-fill anim-grow" style="width:' + pct + '%;background:' + barCol + ';animation-delay:' + delays[i] + '"></div></div>' +
        '<span class="rank-row__detail">' + detail + '</span>' +
        '<div class="rank-row__explain">' + explanation + '</div>' +
      '</div>';
    }).join('') +
    '</div>' +
  '</div>';
}

// ── HEMISPHERE (quadrant visual) ──────────────────────
// (already defined above as renderHemisphereBalance)

// ── RETROGRADES ─────────────────────────────────────

function renderRetrogrades(containerId, chartData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var retros = chartData.getRetrogrades();

  var RETRO_MEANINGS = {
    Mercury: 'Communication style is internal-first \u2014 you process before you speak.',
    Venus: 'Your relationship to value and pricing runs deeper than surface level.',
    Mars: 'Your drive operates behind the scenes. Action happens internally before externally.',
    Jupiter: 'Growth compounds inward first; refine the method before you scale it.',
    Saturn: 'Authority is self-built \u2014 validation lands late, but permanent.',
  };

  if (!retros.length) {
    el.innerHTML = '<div class="frost-card" style="padding:30px 32px">' +
      '<div class="widget-label" style="margin-bottom:26px">RETROGRADES</div>' +
      '<div style="font-size:12px;color:rgba(180,167,148,0.7)">No natal retrogrades.</div>' +
    '</div>';
    return;
  }

  el.innerHTML = '<div class="frost-card" style="padding:30px 32px">' +
    '<div class="widget-label" style="margin-bottom:26px">RETROGRADES</div>' +
    '<div class="retro-rows">' +
    retros.map(function(p) {
      var meaning = RETRO_MEANINGS[p.name] || '';
      var glyph = PLANET_GLYPHS[p.name] || '';
      return '<div class="retro-item">' +
        '<div class="retro-item__circle">' + glyph + '</div>' +
        '<div>' +
          '<div class="retro-item__name">' + p.name + ' retrograde</div>' +
          (meaning ? '<div class="retro-item__meaning">' + meaning + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('') +
    '</div>' +
    '<div class="retro-footer">Retrograde planets internalise their function \u2014 slower to show, deeper when they do.</div>' +
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
      if (match) snippetText = match.text;
    }

    var pills = s.planets.map(function(pName) {
      var planet = chartData.planets.find(function(p) { return p.name === pName; });
      var glyph = PLANET_GLYPHS[pName] || '';
      var desc = pName.toUpperCase();
      if (planet) desc += ' \u00B7 ' + planet.sign.toUpperCase() + ' ' + Math.round(planet.full_degree % 30) + '\u00B0';
      return '<div class="stellium-pill">' +
        '<span class="stellium-pill__glyph">' + glyph + '</span>' +
        '<span class="stellium-pill__text">' + desc + '</span>' +
      '</div>';
    }).join('');

    return '<div class="stellium-card">' +
      '<div class="stellium-card__overlay"></div>' +
      '<div class="stellium-card__inner">' +
        '<div class="stellium-card__text">' +
          '<div class="stellium-card__label">STELLIUM</div>' +
          '<div class="stellium-card__name">The ' + s.key + ' Cluster</div>' +
          (snippetText ? '<p class="stellium-card__desc">' + snippetText + '</p>' : '') +
        '</div>' +
        '<div class="stellium-card__pills">' + pills + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ── TEXT SECTION RENDERER (letter treatment) ──────────

function renderTextSection(containerId, text, opts) {
  var el = document.getElementById(containerId);
  if (!el || !text) { if (el) el.style.display = 'none'; return; }
  el.style.display = '';
  var label = (opts && opts.label) || '';
  var italic = (opts && opts.italic) || false;
  var textClass = 'letter-section__text' + (italic ? ' letter-section__text--italic' : '');
  el.innerHTML = '<div class="letter-section anim-fade-up">' +
    (label ? '<div class="letter-section__label">' + label + '</div>' : '') +
    '<div class="letter-section__rule"></div>' +
    '<p class="' + textClass + '">' + text + '</p>' +
  '</div>';
}

// ── UPSELL BANNER ─────────────────────────────────────

function renderUpsellBanner(containerId, config) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div class="upsell-banner">' +
    '<div class="upsell-banner__label">' + config.label + '</div>' +
    '<h2 class="upsell-banner__headline">' + config.hook + '</h2>' +
    '<a href="' + config.url + '" class="upsell-banner__cta">' + config.cta + '</a>' +
  '</div>';
}

// ── BUSINESS TEXT BLOCK (left-border treatment) ───────

function renderBizText(containerId, label, text) {
  var el = document.getElementById(containerId);
  if (!el || !text) { if (el) el.style.display = 'none'; return; }
  el.style.display = '';
  el.innerHTML = '<div class="biz-text">' +
    '<div class="biz-text__label">' + label + '</div>' +
    '<p class="biz-text__body">' + text + '</p>' +
  '</div>';
}

// ── PRODUCT READING CARDS (2x2 grid) ─────────────────

function renderProductSections(blueprintGrant, transitGrant, astroGrant, courseGrant, profile) {
  var container = document.getElementById('product-sections');
  if (!container) return;

  var products = [
    { id: 'blueprint', name: 'Category of One Blueprint', grant: blueprintGrant, profile: profile,
      price: '$297', desc: 'Full natal reading: income houses, offer design, the year ahead.',
      cta: 'Get your Blueprint', url: 'https://catovermeulen.com/category-of-one',
      readyUrl: 'blueprint.html', intakeUrl: 'blueprint.html' },
    { id: 'transit', name: 'Transits Reading', grant: transitGrant, profile: profile,
      price: '$197', desc: 'The timing layer \u2014 launches, raises, rest, quarter by quarter.',
      cta: 'Get your Transits Reading', url: 'https://catovermeulen.com/transits-reading',
      readyUrl: 'transit-reading.html', intakeUrl: 'transit-reading.html' },
    { id: 'astrocartography', name: 'Astrocartography Reading', grant: astroGrant, profile: profile,
      price: '$247', desc: 'Where in the world your business thrives \u2014 mapped to your chart.',
      cta: 'Get your Reading', url: 'https://catovermeulen.com/astrocartography',
      readyUrl: 'astrocartography.html', intakeUrl: 'astrocartography.html' },
    { id: 'course', name: 'Business Astrology Course', grant: courseGrant, profile: null,
      price: '', desc: 'Learn to read your own chart for business.',
      cta: 'Get the Course', url: 'https://catovermeulen.com',
      readyUrl: 'course.html', intakeUrl: null },
  ];

  container.innerHTML = products.map(function(p) {
    var state = p.id === 'course' ? courseState(p.grant) : blueprintState(p.grant, p.profile);
    var isPurchased = (state === 'ready' || state === 'pending' || state === 'intake');
    var borderClass = isPurchased ? 'reading-card--purchased' : '';
    var statusClass = isPurchased ? 'reading-card__status--active' : 'reading-card__status--available';
    var statusText, ctaText, ctaHref;

    if (state === 'locked') {
      statusText = 'AVAILABLE';
      statusClass = 'reading-card__status--available';
      ctaText = 'UNLOCK \u2192';
      ctaHref = p.url;
    } else if (state === 'intake') {
      statusText = 'PURCHASED';
      ctaText = 'COMPLETE DETAILS \u2192';
      ctaHref = p.intakeUrl;
    } else if (state === 'pending') {
      statusText = 'PROCESSING';
      ctaText = '';
      ctaHref = '#';
    } else {
      statusText = 'DELIVERED';
      ctaText = 'VIEW READING \u2192';
      ctaHref = p.readyUrl;
    }

    return '<div class="frost-card reading-card ' + borderClass + '">' +
      '<div class="reading-card__header">' +
        '<div class="reading-card__title">' + p.name + '</div>' +
        (p.price ? '<div class="reading-card__price">' + p.price + '</div>' : '') +
      '</div>' +
      '<p class="reading-card__desc">' + p.desc + '</p>' +
      '<div class="reading-card__footer">' +
        '<span class="reading-card__status ' + statusClass + '">' + statusText + '</span>' +
        (ctaText ? '<a href="' + ctaHref + '" class="reading-card__cta">' + ctaText + '</a>' : '') +
      '</div>' +
    '</div>';
  }).join('');
}

function renderPurchasedReadingsTop(blueprintGrant, transitGrant, astroGrant, courseGrant, profile) {
  var container = document.getElementById('purchased-readings');
  var section = document.getElementById('section-readings-top');
  if (!container || !section) return;

  var purchased = [];

  var readings = [
    { name: 'Category of One Blueprint', grant: blueprintGrant, profile: profile, readyUrl: 'blueprint.html', intakeUrl: 'blueprint.html', icon: '📜' },
    { name: 'Transits Reading', grant: transitGrant, profile: profile, readyUrl: 'transit-reading.html', intakeUrl: 'transit-reading.html', icon: '🔮' },
    { name: 'Astrocartography Reading', grant: astroGrant, profile: profile, readyUrl: 'astrocartography.html', intakeUrl: 'astrocartography.html', icon: '🌍' },
    { name: 'Business Astrology Course', grant: courseGrant, profile: null, readyUrl: 'course.html', intakeUrl: null, icon: '📚', isCourse: true },
  ];

  readings.forEach(function(r) {
    var state = r.isCourse ? courseState(r.grant) : blueprintState(r.grant, r.profile);
    if (state === 'locked') return;

    var statusText, ctaText, ctaHref, statusClass;

    if (state === 'intake') {
      statusText = 'COMPLETE DETAILS';
      statusClass = 'reading-top__status--action';
      ctaText = 'Fill in your details';
      ctaHref = r.intakeUrl;
    } else if (state === 'pending') {
      statusText = 'PROCESSING';
      statusClass = 'reading-top__status--pending';
      ctaText = 'Being prepared';
      ctaHref = null;
    } else {
      statusText = 'READY';
      statusClass = 'reading-top__status--ready';
      ctaText = 'View reading';
      ctaHref = r.readyUrl;
    }

    purchased.push(
      '<div class="frost-card reading-top-card">' +
        '<div class="reading-top-card__icon">' + r.icon + '</div>' +
        '<div class="reading-top-card__info">' +
          '<div class="reading-top-card__name">' + r.name + '</div>' +
          '<span class="reading-top-card__status ' + statusClass + '">' + statusText + '</span>' +
        '</div>' +
        (ctaHref ? '<a href="' + ctaHref + '" class="reading-top-card__cta">' + ctaText + ' →</a>' : '<span class="reading-top-card__cta reading-top-card__cta--muted">' + ctaText + '</span>') +
      '</div>'
    );
  });

  if (purchased.length > 0) {
    container.innerHTML = purchased.join('');
    section.style.display = 'block';
  }
}
