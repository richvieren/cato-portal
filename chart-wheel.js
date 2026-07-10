// chart-wheel.js — D3.js natal chart wheel renderer

const SIGN_META_SIMPLE = {
  Aries: { color: '#C4654A' }, Taurus: { color: '#8B7D5E' }, Gemini: { color: '#A3B5C4' },
  Cancer: { color: '#5B7B7A' }, Leo: { color: '#C4654A' }, Virgo: { color: '#8B7D5E' },
  Libra: { color: '#A3B5C4' }, Scorpio: { color: '#5B7B7A' }, Sagittarius: { color: '#C4654A' },
  Capricorn: { color: '#8B7D5E' }, Aquarius: { color: '#A3B5C4' }, Pisces: { color: '#5B7B7A' },
};

function renderChartWheel(containerId, chartData) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const size = Math.min(container.clientWidth, 560);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 10;
  const signR = outerR - 36;
  const houseR = signR - 24;
  const planetR = houseR - 40;
  const innerR = planetR - 30;

  const svg = d3.select('#' + containerId)
    .append('svg')
    .attr('viewBox', '0 0 ' + size + ' ' + size)
    .attr('width', '100%')
    .style('max-width', size + 'px');

  const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

  var asc = chartData.planets.find(function(p) { return p.name === 'Ascendant'; });
  var ascDeg = asc ? asc.full_degree : 0;
  var rotation = 180 - ascDeg;

  var g = svg.append('g').attr('transform', 'translate(' + cx + ',' + cy + ')');

  // Outer ring: zodiac signs
  var signArc = d3.arc().innerRadius(signR).outerRadius(outerR);

  SIGNS.forEach(function(sign, i) {
    var startAngle = (i * 30 + rotation) * Math.PI / 180;
    var endAngle = ((i + 1) * 30 + rotation) * Math.PI / 180;
    var meta = SIGN_META_SIMPLE[sign];

    g.append('path')
      .attr('d', signArc({ startAngle: startAngle, endAngle: endAngle }))
      .attr('fill', meta ? meta.color + '15' : 'rgba(255,255,255,0.03)')
      .attr('stroke', 'rgba(216,207,185,0.12)')
      .attr('stroke-width', 0.5);

    var midAngle = (startAngle + endAngle) / 2;
    var labelR = (signR + outerR) / 2;
    g.append('text')
      .attr('x', Math.cos(midAngle - Math.PI / 2) * labelR)
      .attr('y', Math.sin(midAngle - Math.PI / 2) * labelR)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', 'var(--stone)')
      .attr('font-size', '13px')
      .text(SIGN_GLYPHS[sign] || '');
  });

  // House lines
  for (var i = 1; i <= 12; i++) {
    var house = chartData.houses.find(function(h) { return h.number === i; });
    if (!house) continue;
    var deg = (i - 1) * 30 + rotation;
    var rad = deg * Math.PI / 180;
    var x1 = Math.cos(rad - Math.PI / 2) * innerR;
    var y1 = Math.sin(rad - Math.PI / 2) * innerR;
    var x2 = Math.cos(rad - Math.PI / 2) * signR;
    var y2 = Math.sin(rad - Math.PI / 2) * signR;

    var isAngular = (i === 1 || i === 4 || i === 7 || i === 10);
    g.append('line')
      .attr('x1', x1).attr('y1', y1)
      .attr('x2', x2).attr('y2', y2)
      .attr('stroke', isAngular ? 'rgba(216,207,185,0.25)' : 'rgba(216,207,185,0.08)')
      .attr('stroke-width', (i === 1 || i === 10) ? 1.5 : 0.5);

    var numDeg = deg + 15;
    var numRad = numDeg * Math.PI / 180;
    var numR = (innerR + houseR) / 2;
    g.append('text')
      .attr('x', Math.cos(numRad - Math.PI / 2) * numR)
      .attr('y', Math.sin(numRad - Math.PI / 2) * numR)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', 'rgba(180,167,148,0.3)')
      .attr('font-size', '10px')
      .attr('font-family', 'Jost, sans-serif')
      .text(i);
  }

  // Inner circle
  g.append('circle')
    .attr('r', innerR)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(216,207,185,0.1)')
    .attr('stroke-width', 0.5);

  // Planets
  var majorPlanets = chartData.planets.filter(function(p) {
    return PLANET_ORDER.includes(p.name) || p.name === 'Ascendant' || p.name === 'Medium_Coeli';
  });

  var aspectGroup = g.append('g').attr('class', 'aspects').style('opacity', 0);
  var planetDots = [];

  majorPlanets.forEach(function(planet) {
    var deg = planet.full_degree + rotation;
    var rad = deg * Math.PI / 180;
    var x = Math.cos(rad - Math.PI / 2) * planetR;
    var y = Math.sin(rad - Math.PI / 2) * planetR;
    var isAngle = (planet.name === 'Ascendant' || planet.name === 'Medium_Coeli');

    var dot = g.append('g')
      .attr('transform', 'translate(' + x + ',' + y + ')')
      .attr('class', 'planet-dot')
      .style('cursor', 'pointer');

    dot.append('circle')
      .attr('r', isAngle ? 4 : 6)
      .attr('fill', isAngle ? 'var(--golden)' : 'var(--mist)')
      .attr('stroke', 'var(--smoke)')
      .attr('stroke-width', 2);

    dot.append('text')
      .attr('y', -12)
      .attr('text-anchor', 'middle')
      .attr('fill', planet.retrograde ? '#C4654A' : 'var(--mist)')
      .attr('font-size', '11px')
      .text((PLANET_GLYPHS[planet.name] || planet.name.slice(0, 2)) + (planet.retrograde ? '\u212E' : ''));

    planetDots.push({ planet: planet, x: x, y: y, deg: deg, dot: dot });

    dot.on('mouseenter', function() {
      aspectGroup.style('opacity', 1);
      aspectGroup.selectAll('*').remove();
      var relatedAspects = chartData.aspects.filter(function(a) {
        return a.planet1 === planet.name || a.planet2 === planet.name;
      });
      relatedAspects.forEach(function(aspect) {
        var otherName = aspect.planet1 === planet.name ? aspect.planet2 : aspect.planet1;
        var other = planetDots.find(function(pd) { return pd.planet.name === otherName; });
        if (!other) return;
        aspectGroup.append('line')
          .attr('x1', x).attr('y1', y)
          .attr('x2', other.x).attr('y2', other.y)
          .attr('stroke', ASPECT_COLORS[aspect.type] || 'rgba(255,255,255,0.2)')
          .attr('stroke-width', Math.max(0.5, 2 - aspect.orb / 4))
          .attr('stroke-dasharray', aspect.type === 'Opposition' ? '4,3' : 'none')
          .attr('opacity', 0.7);
      });
    });

    dot.on('mouseleave', function() {
      aspectGroup.style('opacity', 0);
    });
  });
}
