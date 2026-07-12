// chart-engine.js — Parse stored natal_charts data into widget-ready objects.

var SIGN_GLYPHS = {
  Aries: '\u2648', Taurus: '\u2649', Gemini: '\u264A', Cancer: '\u264B', Leo: '\u264C', Virgo: '\u264D',
  Libra: '\u264E', Scorpio: '\u264F', Sagittarius: '\u2650', Capricorn: '\u2651', Aquarius: '\u2652', Pisces: '\u2653',
};

var PLANET_GLYPHS = {
  Sun: '\u2609', Moon: '\u263D', Mercury: '\u263F', Venus: '\u2640', Mars: '\u2642',
  Jupiter: '\u2643', Saturn: '\u2644', Ascendant: 'AC', Medium_Coeli: 'MC',
};

var PLANET_ORDER = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

var ELEMENT_COLORS = { fire: '#C4654A', earth: '#8B7D5E', air: '#A3B5C4', water: '#5B7B7A' };

var SIGN_ELEMENTS = {
  Aries: 'fire', Taurus: 'earth', Gemini: 'air', Cancer: 'water', Leo: 'fire', Virgo: 'earth',
  Libra: 'air', Scorpio: 'water', Sagittarius: 'fire', Capricorn: 'earth', Aquarius: 'air', Pisces: 'water',
};

var SIGN_MODALITIES = {
  Aries: 'cardinal', Taurus: 'fixed', Gemini: 'mutable', Cancer: 'cardinal', Leo: 'fixed', Virgo: 'mutable',
  Libra: 'cardinal', Scorpio: 'fixed', Sagittarius: 'mutable', Capricorn: 'cardinal', Aquarius: 'fixed', Pisces: 'mutable',
};

var SALES_TYPES = {
  Aries: { type: 'The Direct Closer', desc: 'You sell fast, bold, and first.' },
  Taurus: { type: 'The Trust Builder', desc: 'You sell through patience and proof.' },
  Gemini: { type: 'The Conversationalist', desc: 'You sell by talking it through.' },
  Cancer: { type: 'The Empathic Listener', desc: 'You sell by making them feel heard.' },
  Leo: { type: 'The Storyteller', desc: 'You sell through narrative and presence.' },
  Virgo: { type: 'The Consultant', desc: 'You sell by diagnosing the problem.' },
  Libra: { type: 'The Negotiator', desc: 'You sell through rapport and balance.' },
  Scorpio: { type: 'The Investigator', desc: 'You sell by going deeper than anyone else.' },
  Sagittarius: { type: 'The Educator', desc: 'You sell by teaching first.' },
  Capricorn: { type: 'The Authority', desc: 'You sell through credibility and track record.' },
  Aquarius: { type: 'The Original', desc: 'You sell by reframing the whole problem.' },
  Pisces: { type: 'The Intuitive', desc: 'You sell by reading what they actually need.' },
};

var LEADERSHIP_TYPES = {
  Aries: { type: 'The Initiator', desc: 'You lead by going first.' },
  Taurus: { type: 'The Steady Hand', desc: 'You lead by outlasting everyone.' },
  Gemini: { type: 'The Connector', desc: 'You lead by linking people and ideas.' },
  Cancer: { type: 'The Protector', desc: 'You lead by building a safe base.' },
  Leo: { type: 'The Standard-Setter', desc: 'You lead by embodying the work.' },
  Virgo: { type: 'The Craftsman', desc: 'You lead through precision and process.' },
  Libra: { type: 'The Diplomat', desc: 'You lead through relationships and fairness.' },
  Scorpio: { type: 'The Strategist', desc: 'You lead from behind the curtain.' },
  Sagittarius: { type: 'The Visionary', desc: 'You lead through big-picture thinking.' },
  Capricorn: { type: 'The Builder', desc: 'You lead through structure and ambition.' },
  Aquarius: { type: 'The Disruptor', desc: 'You lead by breaking the mold.' },
  Pisces: { type: 'The Dreamer', desc: 'You lead through vision and empathy.' },
};

function ChartData(chartRow) {
  this._raw = chartRow;
  this.planets = chartRow.planets;
  this.houses = chartRow.houses;
  this.aspects = chartRow.aspects;
  this.elements = chartRow.elements;
  this.modalities = chartRow.modalities;
  this.hemispheres = chartRow.hemispheres;
  this.stelliums = chartRow.stelliums;
  this.chartRuler = chartRow.chart_ruler;
}

ChartData.prototype.getBig3 = function () {
  var find = function(planets, name) { return planets.find(function(p) { return p.name === name; }); };
  return { sun: find(this.planets, 'Sun'), moon: find(this.planets, 'Moon'), rising: find(this.planets, 'Ascendant'), mc: find(this.planets, 'Medium_Coeli') };
};

ChartData.prototype.getHouseCusps = function () {
  var houses = this.houses || [];
  var find = function(num) { return houses.find(function(h) { return h.number === num; }); };
  return { second: find(2), sixth: find(6), tenth: find(10) };
};

ChartData.prototype.getElements = function () { return this.elements; };
ChartData.prototype.getModalities = function () { return this.modalities; };
ChartData.prototype.getHemispheres = function () { return this.hemispheres; };
ChartData.prototype.getStelliums = function () { return this.stelliums; };
ChartData.prototype.getChartRuler = function () { return this.chartRuler; };

ChartData.prototype.getRetrogrades = function () {
  return this.planets.filter(function(p) { return p.retrograde && PLANET_ORDER.indexOf(p.name) >= 0; });
};

ChartData.prototype.getBusinessLens = function () {
  var self = this;
  var findPlanetsInHouse = function(h) { return self.planets.filter(function(p) { return p.house === h && PLANET_ORDER.indexOf(p.name) >= 0; }); };
  var findHouse = function(n) { return self.houses.find(function(h) { return h.number === n; }); };
  return {
    money: { second: { house: findHouse(2), planets: findPlanetsInHouse(2) }, eighth: { house: findHouse(8), planets: findPlanetsInHouse(8) } },
    visibility: { mc: self.planets.find(function(p) { return p.name === 'Medium_Coeli'; }), tenthHouse: { house: findHouse(10), planets: findPlanetsInHouse(10) } },
    communication: { mercury: self.planets.find(function(p) { return p.name === 'Mercury'; }) },
    leadership: { sun: self.planets.find(function(p) { return p.name === 'Sun'; }), mars: self.planets.find(function(p) { return p.name === 'Mars'; }) },
  };
};

/** Business Archetype: 3 spectrums derived from elements + modalities */
ChartData.prototype.getArchetype = function () {
  var el = this.elements;
  var mod = this.modalities;
  var total = 7; // 7 major planets
  var fireAir = (el.fire ? el.fire.count : 0) + (el.air ? el.air.count : 0);
  var earthWater = (el.earth ? el.earth.count : 0) + (el.water ? el.water.count : 0);
  var cardinal = mod.cardinal ? mod.cardinal.count : 0;
  var fixed = mod.fixed ? mod.fixed.count : 0;
  var mutable = mod.mutable ? mod.mutable.count : 0;

  return {
    // Visionary (fire+air) vs Operator (earth+water): 0=full operator, 100=full visionary
    visionary: Math.round((fireAir / total) * 100),
    // Starter (cardinal) vs Finisher (fixed): 0=full finisher, 100=full starter
    starter: cardinal + fixed > 0 ? Math.round((cardinal / (cardinal + fixed)) * 100) : 50,
    // Adaptable (mutable) vs Committed (fixed): 0=full committed, 100=full adaptable
    adaptable: mutable + fixed > 0 ? Math.round((mutable / (mutable + fixed)) * 100) : 50,
  };
};

/** Money Style derived from 2nd/8th house */
ChartData.prototype.getMoneyStyle = function () {
  var biz = this.getBusinessLens();
  var secondSign = biz.money.second.house ? biz.money.second.house.sign : '';
  var eighthSign = biz.money.eighth.house ? biz.money.eighth.house.sign : '';
  var secondPlanets = biz.money.second.planets.length;
  var eighthPlanets = biz.money.eighth.planets.length;

  // Income stability: earth/water 2nd = steady, fire/air = volatile
  var secondEl = SIGN_ELEMENTS[secondSign] || '';
  var stability = (secondEl === 'earth' || secondEl === 'water') ? 75 : 30;

  // Risk tolerance: fire/air 2nd house = high, planets in 8th = higher
  var risk = (secondEl === 'fire' || secondEl === 'air') ? 70 : 30;
  risk = Math.min(100, risk + eighthPlanets * 15);

  // Income source: 2nd house planets = earned, 8th house planets = joint/other
  var ownVsOther = secondPlanets + eighthPlanets > 0
    ? Math.round((secondPlanets / (secondPlanets + eighthPlanets)) * 100)
    : 50;

  return { stability: stability, risk: risk, ownVsOther: ownVsOther, secondSign: secondSign, eighthSign: eighthSign };
};

/** Visibility score: 0-100 based on hemisphere + 10th house */
ChartData.prototype.getVisibilityScore = function () {
  var h = this.hemispheres;
  var above = h.above ? h.above.count : 0;
  var total = above + (h.below ? h.below.count : 0);
  var base = total > 0 ? Math.round((above / total) * 70) : 35;
  // Bonus for planets in 10th house
  var tenthPlanets = this.planets.filter(function(p) { return p.house === 10 && PLANET_ORDER.indexOf(p.name) >= 0; }).length;
  return Math.min(100, base + tenthPlanets * 15);
};

/** Sales Style Badge from Mercury sign */
ChartData.prototype.getSalesStyle = function () {
  var merc = this.planets.find(function(p) { return p.name === 'Mercury'; });
  if (!merc) return null;
  var info = SALES_TYPES[merc.sign] || { type: merc.sign, desc: '' };
  return { planet: merc, type: info.type, desc: info.desc };
};

/** Leadership Style Badge from Sun sign */
ChartData.prototype.getLeadershipStyle = function () {
  var sun = this.planets.find(function(p) { return p.name === 'Sun'; });
  if (!sun) return null;
  var info = LEADERSHIP_TYPES[sun.sign] || { type: sun.sign, desc: '' };
  return { planet: sun, type: info.type, desc: info.desc };
};

/** Planet Power Ranking: sorted by house position strength */
ChartData.prototype.getPlanetRanking = function () {
  // Angular houses (1,4,7,10) = strongest, Succedent (2,5,8,11) = medium, Cadent (3,6,9,12) = weakest
  var HOUSE_SCORES = { 1:10, 10:10, 7:9, 4:9, 5:6, 11:6, 2:5, 8:5, 9:3, 3:3, 6:2, 12:2 };
  var ranked = [];
  var self = this;
  PLANET_ORDER.forEach(function(name) {
    var p = self.planets.find(function(pl) { return pl.name === name; });
    if (!p) return;
    var score = HOUSE_SCORES[p.house] || 3;
    // Bonus for aspects (more aspects = more active)
    var aspectCount = self.aspects.filter(function(a) { return a.planet1 === name || a.planet2 === name; }).length;
    score += Math.min(4, aspectCount);
    ranked.push({ name: name, sign: p.sign, house: p.house, score: score, retrograde: p.retrograde });
  });
  ranked.sort(function(a, b) { return b.score - a.score; });
  return ranked;
};

/** Dominant element name */
ChartData.prototype.getDominantElement = function () {
  var el = this.elements;
  var max = 0, dom = 'fire';
  ['fire','earth','air','water'].forEach(function(k) {
    if (el[k] && el[k].count > max) { max = el[k].count; dom = k; }
  });
  return dom;
};

/** Dominant modality name */
ChartData.prototype.getDominantModality = function () {
  var mod = this.modalities;
  var max = 0, dom = 'cardinal';
  ['cardinal','fixed','mutable'].forEach(function(k) {
    if (mod[k] && mod[k].count > max) { max = mod[k].count; dom = k; }
  });
  return dom;
};
