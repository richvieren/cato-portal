// chart-engine.js — Parse stored natal_charts data into widget-ready objects.
// All computation was done server-side by compute-chart. This is just accessors + formatting.

const SIGN_GLYPHS = {
  Aries: '\u2648', Taurus: '\u2649', Gemini: '\u264A', Cancer: '\u264B', Leo: '\u264C', Virgo: '\u264D',
  Libra: '\u264E', Scorpio: '\u264F', Sagittarius: '\u2650', Capricorn: '\u2651', Aquarius: '\u2652', Pisces: '\u2653',
};

const PLANET_GLYPHS = {
  Sun: '\u2609', Moon: '\u263D', Mercury: '\u263F', Venus: '\u2640', Mars: '\u2642',
  Jupiter: '\u2643', Saturn: '\u2644', Uranus: '\u2645', Neptune: '\u2646', Pluto: '\u2647',
  Ascendant: 'AC', Medium_Coeli: 'MC', North_Node: '\u260A',
};

// API returns: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn (+ Ascendant, Medium_Coeli as angles)
const PLANET_ORDER = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

const ELEMENT_COLORS = {
  fire: '#C4654A',
  earth: '#8B7D5E',
  air: '#A3B5C4',
  water: '#5B7B7A',
};

const ASPECT_COLORS = {
  Conjunction: '#BA916B',
  Trine: '#5B7B7A',
  Sextile: '#A3B5C4',
  Square: '#C4654A',
  Opposition: '#8B4A4A',
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
  const find = (name) => this.planets.find(p => p.name === name);
  return { sun: find('Sun'), moon: find('Moon'), rising: find('Ascendant') };
};

ChartData.prototype.getElements = function () { return this.elements; };
ChartData.prototype.getModalities = function () { return this.modalities; };
ChartData.prototype.getHemispheres = function () { return this.hemispheres; };
ChartData.prototype.getStelliums = function () { return this.stelliums; };
ChartData.prototype.getChartRuler = function () { return this.chartRuler; };

ChartData.prototype.getPlanetCards = function () {
  return PLANET_ORDER.map(name => this.planets.find(p => p.name === name)).filter(Boolean);
};

ChartData.prototype.getBusinessLens = function () {
  const findPlanetsInHouse = (h) => this.planets.filter(p => p.house === h && PLANET_ORDER.includes(p.name));
  const findHouse = (n) => this.houses.find(h => h.number === n);
  return {
    money: {
      second: { house: findHouse(2), planets: findPlanetsInHouse(2) },
      eighth: { house: findHouse(8), planets: findPlanetsInHouse(8) },
    },
    visibility: {
      mc: this.planets.find(p => p.name === 'Medium_Coeli'),
      tenthHouse: { house: findHouse(10), planets: findPlanetsInHouse(10) },
    },
    communication: { mercury: this.planets.find(p => p.name === 'Mercury') },
    leadership: {
      sun: this.planets.find(p => p.name === 'Sun'),
      mars: this.planets.find(p => p.name === 'Mars'),
    },
  };
};

ChartData.prototype.getRetrogrades = function () {
  return this.planets.filter(p => p.retrograde && PLANET_ORDER.includes(p.name));
};

ChartData.prototype.getAspects = function () { return this.aspects; };
