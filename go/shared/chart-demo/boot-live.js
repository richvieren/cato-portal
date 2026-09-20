/* boot-live.js — renders the delivered product live on the landing page.
   Replaces the captured PNGs. Every widget below is the portal's own code,
   pinned and unmodified (chart-engine.js, widgets.js, chart-wheel.js), fed by
   demo-chart.json and snippets-subset.json. What the page shows is what ships.

   findSnippet is copied verbatim from the portal's profile.js, which is NOT one
   of the three pinned files, so it lives here rather than being patched in.

   Every renderX guards on the container existing, so a page that omits a module
   simply renders fewer of them. */

var _snippets = null;

/* The widgets render by element id, but a landing page needs the same module in
   more than one place (the Big 3 appears in the hero and again at reason 4).
   So each widget renders once into an offscreen staging node that owns the
   canonical id, and the result is copied into every [data-live="<id>"] slot.
   Ids stay unique, the pinned widget code stays untouched. */
function stage(id) {
  var slots = document.querySelectorAll('[data-live="' + id + '"]');
  if (!slots.length) return null;
  var host = document.getElementById('live-staging');
  if (!host) {
    host = document.createElement('div');
    host.id = 'live-staging';
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:absolute;left:-99999px;top:0;width:1140px';
    document.body.appendChild(host);
  }
  var el = document.createElement('div');
  el.id = id;
  host.appendChild(el);
  return el;
}

function distribute(id) {
  var src = document.getElementById(id);
  if (!src) return;
  var html = src.innerHTML;
  document.querySelectorAll('[data-live="' + id + '"]').forEach(function (slot) {
    slot.innerHTML = html;
  });
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
  if (section === 'money' || section === 'visibility' || section === 'how_you_sell' || section === 'how_you_lead' || section === 'mc_signs' || section === 'moon_signs') {
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
  if (section === 'retrogrades') {
    if (!Array.isArray(_snippets.retrogrades)) return '';
    var rm = _snippets.retrogrades.find(function(s) { return s.planet === key1 && s.house == key2; });
    return rm ? rm.text : '';
  }
  if (section === 'element_combos') {
    if (!Array.isArray(_snippets.element_combos)) return '';
    var ecm = _snippets.element_combos.find(function(s) { return s.dominant === key1 && s.low === key2; });
    return ecm ? ecm.text : '';
  }
  if (section === 'modality_summaries') {
    if (!Array.isArray(_snippets.modality_summaries)) return '';
    var msm = _snippets.modality_summaries.find(function(s) { return s.modality === key1; });
    return msm ? msm.text : '';
  }
  return '';
}

/* The numbers modules. Every value is read from the chart, never written into
   the copy, so a different demo chart changes the page rather than making it
   lie. Only "24" and "10s" are static, and they live in the copy file. */
function fillNumbers(cd, CHART, b3) {
  function degMin(lon) {
    var m = Math.min(1799, Math.floor(((((lon % 30) + 30) % 30) * 60) + 1e-9));
    return Math.floor(m / 60) + '\u00B0' + (m % 60 < 10 ? '0' : '') + (m % 60) + '\u2032';
  }
  var els = CHART.elements || {};
  var domEl = Object.keys(els).sort(function (a, b) { return els[b].count - els[a].count; })[0];
  var values = {
    'rising-degree': b3.rising && b3.rising.degree !== undefined ? degMin(b3.rising.degree)
                    : (b3.rising && b3.rising.lon !== undefined ? degMin(b3.rising.lon) : ''),
    'visibility': Math.round(cd.getVisibilityScore()) + '%',
    'dominant-count': domEl ? String(els[domEl].count) : '',
    'planet-count': String((CHART.planets || []).filter(function (p) {
      return ['Ascendant', 'Medium_Coeli'].indexOf(p.name) === -1; }).length),
    'house-count': '3',
    'aspect-count': String((CHART.aspects || []).length)
  };
  document.querySelectorAll('[data-num]').forEach(function (el) {
    var k = el.getAttribute('data-num');
    if (values[k]) el.textContent = values[k];
  });
  opticalise();
}

/* OPTICAL SIZING of the number decks.
   One font-size across all eight values makes them MEASURE the same and READ
   different: "3" is one glyph, "12@24'" is six, and the eye compares mass, not
   font-size. Two corrections here, both applied after the live values land
   because only then is each value's shape known:

     1. Split figures from units. Digits keep the display weight; degree marks,
        primes, percent signs and the "s" of "10s" drop to 0.46em in the accent
        colour, so what the eye lines up is the DIGITS' cap height.
     2. Trim the digit size by how many digits there are -- a lone figure gets a
        bump, a four-figure run gets pulled back. The trim is deliberately small
        (5.5rem to 4.7rem, 17%); the heavy lifting is done by step 1.

   A zero-width strut at the base size holds every value on one baseline, so the
   sizes can differ without the row of numerals stepping up and down. */
function opticalise() {
  document.querySelectorAll('.num__value, .stat__value').forEach(function (el) {
    var text = (el.textContent || '').trim();
    if (!text) return;
    var digits = (text.match(/\d/g) || []).length;
    var html = '<i class="num__strut" aria-hidden="true">0</i>';
    text.replace(/(\d+|\D+)/g, function (run) {
      var cls = /\d/.test(run) ? 'num__digits' : 'num__unit';
      html += '<span class="' + cls + '">' + run.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>';
      return run;
    });
    el.innerHTML = html;
    el.setAttribute('data-digits', String(Math.min(4, Math.max(1, digits))));
  });
}

function bootLiveProduct() {
  return Promise.all([
    fetch('../shared/chart-demo/demo-chart.json').then(function (r) { return r.json(); }),
    fetch('../shared/chart-demo/snippets-subset.json').then(function (r) { return r.json(); })
  ]).then(function (res) {
    var CHART = res[0];
    _snippets = res[1];
    var cd = new ChartData(CHART);
    var b3 = cd.getBig3();
    var biz = cd.getBusinessLens();
    var ruler = cd.getChartRuler();

    ['w-big3','w-chart-ruler','w-midheaven','t-welcome','w-chart-wheel','w-elements','w-modality','w-archetype','w-hemispheres','t-moon','t-at-a-glance','w-money-style','w-visibility','t-money','t-visibility','t-mc-destiny','w-sales-style','w-leadership-style','t-sales','t-leadership','w-house-cusps','w-planet-ranking','w-retrogrades','w-stelliums','t-question'].forEach(stage);

    /* identity */
    renderBig3('w-big3', cd);
    renderChartRuler('w-chart-ruler', cd);
    renderMidheavenPill('w-midheaven', cd);
    renderTextSection('t-welcome', findSnippet('welcome', b3.sun.sign, b3.rising.sign), { label: 'WELCOME' });

    /* the wheel */
    renderChartWheel('w-chart-wheel', cd);
    var wc = document.getElementById('w-chart-wheel');
    if (wc && wc._setCenterName) wc._setCenterName('Sample Profile');

    /* snapshot */
    renderElementBalance('w-elements', cd);
    renderModalitySplit('w-modality', cd);
    renderArchetype('w-archetype', cd);
    renderHemisphereBalance('w-hemispheres', cd);
    renderTextSection('t-moon', findSnippet('moon_signs', b3.moon.sign), { label: 'WHAT NOURISHES YOU' });
    renderTextSection('t-at-a-glance', findSnippet('at_a_glance', cd.getDominantElement(), cd.getDominantModality()), { label: 'AT A GLANCE' });

    /* business lens */
    renderMoneyStyle('w-money-style', cd);
    renderVisibilityMeter('w-visibility', cd);
    renderBizText('t-money', 'ON MONEY', findSnippet('money', biz.money.second.house ? biz.money.second.house.sign : ''));
    var mcSign = biz.visibility.mc ? biz.visibility.mc.sign : '';
    renderBizText('t-visibility', 'ON VISIBILITY', findSnippet('visibility', mcSign));
    renderBizText('t-mc-destiny', 'CAREER DESTINY', findSnippet('mc_signs', mcSign));
    renderSalesStyle('w-sales-style', cd);
    renderLeadershipStyle('w-leadership-style', cd);
    renderBizText('t-sales', 'ON SELLING', findSnippet('how_you_sell', biz.communication.mercury ? biz.communication.mercury.sign : ''));
    renderBizText('t-leadership', 'ON LEADING', findSnippet('how_you_lead', biz.leadership.sun ? biz.leadership.sun.sign : ''));
    renderHouseCusps('w-house-cusps', cd, _snippets);

    /* planets */
    renderPlanetRanking('w-planet-ranking', cd);
    renderRetrogrades('w-retrogrades', cd, _snippets);
    renderStelliums('w-stelliums', cd, _snippets);
    renderTextSection('t-question', findSnippet('question', ruler.planet, ruler.house), { label: 'THE QUESTION' });

    ['w-big3','w-chart-ruler','w-midheaven','t-welcome','w-chart-wheel','w-elements','w-modality','w-archetype','w-hemispheres','t-moon','t-at-a-glance','w-money-style','w-visibility','t-money','t-visibility','t-mc-destiny','w-sales-style','w-leadership-style','t-sales','t-leadership','w-house-cusps','w-planet-ranking','w-retrogrades','w-stelliums','t-question'].forEach(distribute);

    fillNumbers(cd, CHART, b3);

    document.documentElement.setAttribute('data-live-product', 'ready');
    return true;
  }).catch(function (err) {
    document.documentElement.setAttribute('data-live-product', 'failed');
    if (window.console) console.error('[live-product] ' + err);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootLiveProduct);
else bootLiveProduct();
