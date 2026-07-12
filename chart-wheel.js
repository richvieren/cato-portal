// chart-wheel.js — D3.js natal chart wheel (Gilded Observatory spec)
// Geometry: 560x560 SVG, center 280,280. ASC on left.
// Rings: r270 outer, r232 sign-inner, r70 hub, r186 dashed planet orbit.

function renderChartWheel(containerId, chartData) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  var CX = 280, CY = 280;

  // Find ASC longitude
  var asc = chartData.planets.find(function(p) { return p.name === 'Ascendant'; });
  var ascLon = asc ? asc.full_degree : 0;

  // Find MC longitude
  var mcPlanet = chartData.planets.find(function(p) { return p.name === 'Medium_Coeli'; });
  var mcLon = mcPlanet ? mcPlanet.full_degree : 0;

  // Projection: screen angle a = 180 + (lon - ascLon), x = cx + r*cos(a), y = cy - r*sin(a)
  function xy(lon, r) {
    var a = (180 + (lon - ascLon)) * Math.PI / 180;
    return [Math.round((CX + r * Math.cos(a)) * 10) / 10, Math.round((CY - r * Math.sin(a)) * 10) / 10];
  }

  // Check if mobile
  var isMobile = window.innerWidth <= 480;
  var svgW = isMobile ? 335 : 560;

  var svg = d3.select('#' + containerId)
    .append('svg')
    .attr('width', svgW)
    .attr('height', svgW)
    .attr('viewBox', '0 0 560 560')
    .style('display', 'block')
    .style('margin', '0 auto')
    .style('overflow', 'visible');

  var strokeScale = isMobile ? 1.5 : 1;

  // ── Rings ──
  svg.append('circle').attr('cx', CX).attr('cy', CY).attr('r', 270)
    .attr('fill', 'none').attr('stroke', 'rgba(186,175,163,0.28)').attr('stroke-width', strokeScale);
  svg.append('circle').attr('cx', CX).attr('cy', CY).attr('r', 232)
    .attr('fill', 'none').attr('stroke', 'rgba(186,175,163,0.18)').attr('stroke-width', strokeScale);
  svg.append('circle').attr('cx', CX).attr('cy', CY).attr('r', 70)
    .attr('fill', 'none').attr('stroke', 'rgba(186,175,163,0.15)').attr('stroke-width', strokeScale);
  svg.append('circle').attr('cx', CX).attr('cy', CY).attr('r', 186)
    .attr('fill', 'none').attr('stroke', 'rgba(186,175,163,0.07)')
    .attr('stroke-width', strokeScale).attr('stroke-dasharray', '2 5');

  // ── Sign ring ──
  var SIGNS_ORDER = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

  SIGNS_ORDER.forEach(function(sign, i) {
    var startLon = i * 30;
    // Boundary line from r232 to r270
    var p1 = xy(startLon, 232);
    var p2 = xy(startLon, 270);
    svg.append('line')
      .attr('x1', p1[0]).attr('y1', p1[1])
      .attr('x2', p2[0]).attr('y2', p2[1])
      .attr('stroke', 'rgba(186,175,163,0.18)').attr('stroke-width', strokeScale);

    // Glyph at midpoint r251
    var mid = xy(startLon + 15, 251);
    var glyphSize = isMobile ? 24 : 17;
    svg.append('text')
      .attr('x', mid[0]).attr('y', mid[1])
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('fill', '#B4A794')
      .attr('font-family', "'Cormorant Garamond', serif")
      .attr('font-size', glyphSize + 'px')
      .text(SIGN_GLYPHS[sign] || '');
  });

  // ── Houses (whole sign) ──
  // In whole sign houses, house 1 = entire sign of ASC.
  // House boundaries align to sign boundaries, not cusp degrees.
  var ascSignStart = Math.floor(ascLon / 30) * 30;

  chartData.houses.forEach(function(house) {
    // Whole sign cusp: house N starts at 0° of the Nth sign from ASC sign
    var lon = (ascSignStart + (house.number - 1) * 30) % 360;
    var isAngular = (house.number === 1 || house.number === 4 || house.number === 7 || house.number === 10);
    var p1 = xy(lon, 70);
    var p2 = xy(lon, 232);
    svg.append('line')
      .attr('x1', p1[0]).attr('y1', p1[1])
      .attr('x2', p2[0]).attr('y2', p2[1])
      .attr('stroke', isAngular ? 'rgba(186,145,107,0.35)' : 'rgba(186,175,163,0.1)')
      .attr('stroke-width', strokeScale);

    // House number at midpoint between this cusp and the next
    var nextLon = (lon + 30) % 360;
    var midLon = lon + 15; // Each whole sign house is exactly 30 degrees
    var numPos = xy(midLon, 86);
    svg.append('text')
      .attr('x', numPos[0]).attr('y', numPos[1])
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('fill', 'rgba(180,167,148,0.45)')
      .attr('font-family', 'Jost, sans-serif')
      .attr('font-size', '10px')
      .text(house.number);
  });

  // ── Major planets only (not ASC/MC — those get labels) ──
  var majorPlanets = chartData.planets.filter(function(p) {
    return PLANET_ORDER.indexOf(p.name) >= 0;
  });

  // Build aspect map
  var aspectMap = {};
  chartData.aspects.forEach(function(a) {
    if (!aspectMap[a.planet1]) aspectMap[a.planet1] = [];
    if (!aspectMap[a.planet2]) aspectMap[a.planet2] = [];
    aspectMap[a.planet1].push(a);
    aspectMap[a.planet2].push(a);
  });

  // ── Aspect lines (default state) ──
  var aspectGroup = svg.append('g').attr('class', 'aspect-lines');
  var drawnAspects = [];
  chartData.aspects.forEach(function(a) {
    var p1 = chartData.planets.find(function(p) { return p.name === a.planet1; });
    var p2 = chartData.planets.find(function(p) { return p.name === a.planet2; });
    if (!p1 || !p2) return;
    var pos1 = xy(p1.full_degree, 168);
    var pos2 = xy(p2.full_degree, 168);
    var line = aspectGroup.append('line')
      .attr('x1', pos1[0]).attr('y1', pos1[1])
      .attr('x2', pos2[0]).attr('y2', pos2[1])
      .attr('stroke', 'rgba(186,175,163,0.13)')
      .attr('stroke-width', 1)
      .style('transition', 'stroke 0.35s, stroke-width 0.35s, opacity 0.35s');
    drawnAspects.push({ line: line, planet1: a.planet1, planet2: a.planet2 });
  });

  // ── Planet groups ──
  var planetNodes = [];
  majorPlanets.forEach(function(planet) {
    var lon = planet.full_degree;
    var pos = xy(lon, 186);

    // Tick line from r232 to r206
    var tick1 = xy(lon, 232);
    var tick2 = xy(lon, 206);
    svg.append('line')
      .attr('x1', tick1[0]).attr('y1', tick1[1])
      .attr('x2', tick2[0]).attr('y2', tick2[1])
      .attr('stroke', 'rgba(186,145,107,0.3)')
      .attr('stroke-width', strokeScale);

    var hitR = isMobile ? 24 : 16;
    var g = svg.append('g').style('cursor', 'pointer');

    var circle = g.append('circle')
      .attr('cx', pos[0]).attr('cy', pos[1]).attr('r', hitR)
      .attr('fill', 'rgba(24,24,23,0.92)')
      .attr('stroke', 'rgba(186,175,163,0.35)')
      .attr('stroke-width', strokeScale)
      .style('transition', 'all 0.35s');

    var glyphSize = isMobile ? 24 : 16;
    var glyph = g.append('text')
      .attr('x', pos[0]).attr('y', pos[1])
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('font-family', "'Cormorant Garamond', serif")
      .attr('font-size', glyphSize + 'px')
      .attr('fill', '#D8CFB9')
      .style('pointer-events', 'none')
      .style('transition', 'fill 0.35s')
      .text(PLANET_GLYPHS[planet.name] || planet.name.slice(0, 2));

    planetNodes.push({ name: planet.name, planet: planet, g: g, circle: circle, glyph: glyph, pos: pos });
  });

  // ── Center readout ──
  var clientName = ''; // Will be set by profile.js
  var centerTitle = svg.append('text')
    .attr('x', CX).attr('y', 270)
    .attr('text-anchor', 'middle')
    .attr('font-family', "'Cormorant Garamond', serif")
    .attr('font-size', isMobile ? '28px' : '21px')
    .attr('fill', '#F2F0E5')
    .text('The Natal Wheel');
  var centerSub = svg.append('text')
    .attr('x', CX).attr('y', isMobile ? 302 : 296)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'Jost, sans-serif')
    .attr('font-size', isMobile ? '14px' : '10px')
    .attr('letter-spacing', '0.2em')
    .attr('fill', '#B4A794')
    .text('');

  // Store reference for profile.js to set the name
  container._setCenterName = function(name) {
    clientName = name;
    centerSub.text(name.toUpperCase());
  };

  // ── ASC / MC labels ──
  var ascPos = xy(ascLon, 292);
  svg.append('text')
    .attr('x', ascPos[0]).attr('y', ascPos[1])
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
    .attr('font-family', 'Jost, sans-serif')
    .attr('font-size', '10px').attr('letter-spacing', '0.15em')
    .attr('fill', 'rgba(186,145,107,0.8)')
    .text('ASC');

  var mcPos = xy(mcLon, 292);
  svg.append('text')
    .attr('x', mcPos[0]).attr('y', mcPos[1])
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
    .attr('font-family', 'Jost, sans-serif')
    .attr('font-size', '10px').attr('letter-spacing', '0.15em')
    .attr('fill', 'rgba(186,145,107,0.8)')
    .text('MC');

  // ── Hover / tap interaction ──
  var hoveredPlanet = null;

  function setHover(name) {
    hoveredPlanet = name;
    var relatedNames = new Set();
    if (name) {
      relatedNames.add(name);
      chartData.aspects.forEach(function(a) {
        if (a.planet1 === name) relatedNames.add(a.planet2);
        if (a.planet2 === name) relatedNames.add(a.planet1);
      });
    }

    // Update planets
    planetNodes.forEach(function(pn) {
      var isHovered = pn.name === name;
      var isRelated = name ? relatedNames.has(pn.name) : true;
      if (isHovered) {
        pn.circle
          .attr('fill', 'rgba(186,145,107,0.18)')
          .attr('stroke', 'rgba(186,145,107,0.9)')
          .attr('filter', 'drop-shadow(0 0 7px rgba(186,145,107,0.7))');
        pn.glyph.attr('fill', '#E8C9A6');
      } else if (isRelated || !name) {
        pn.circle
          .attr('fill', 'rgba(24,24,23,0.92)')
          .attr('stroke', 'rgba(186,175,163,0.35)')
          .attr('filter', null);
        pn.glyph.attr('fill', '#D8CFB9');
      } else {
        pn.circle
          .attr('fill', 'rgba(24,24,23,0.92)')
          .attr('stroke', 'rgba(186,175,163,0.1)')
          .attr('filter', null);
        pn.glyph.attr('fill', 'rgba(180,167,148,0.25)');
      }
    });

    // Update aspect lines
    drawnAspects.forEach(function(da) {
      if (!name) {
        da.line.attr('stroke', 'rgba(186,175,163,0.13)').attr('stroke-width', 1);
      } else {
        var involves = (da.planet1 === name || da.planet2 === name);
        if (involves) {
          da.line.attr('stroke', 'rgba(186,145,107,0.85)').attr('stroke-width', 1.2);
        } else {
          da.line.attr('stroke', 'rgba(186,175,163,0.04)').attr('stroke-width', 1);
        }
      }
    });

    // Update center readout
    if (name) {
      var hp = chartData.planets.find(function(p) { return p.name === name; });
      if (hp) {
        var aspectCount = chartData.aspects.filter(function(a) { return a.planet1 === name || a.planet2 === name; }).length;
        centerTitle.text(hp.name + ' in ' + hp.sign);
        var deg = Math.round(hp.full_degree % 30);
        centerSub.text(deg + '\u00B0 \u00B7 ' + ordinal(hp.house).toUpperCase() + ' HOUSE \u00B7 ' + aspectCount + ' ASPECTS');
      }
    } else {
      centerTitle.text('The Natal Wheel');
      centerSub.text(clientName ? clientName.toUpperCase() : '');
    }
  }

  // Bind events
  planetNodes.forEach(function(pn) {
    if (isMobile) {
      // Tap toggles on mobile
      pn.g.on('click', function() {
        if (hoveredPlanet === pn.name) {
          setHover(null);
        } else {
          setHover(pn.name);
        }
      });
    } else {
      pn.g.on('mouseenter', function() { setHover(pn.name); });
      pn.g.on('mouseleave', function() { setHover(null); });
    }
  });

  // Caption
  var captionText = isMobile ? 'TAP A PLANET TO REVEAL ITS ASPECTS' : 'HOVER A PLANET TO REVEAL ITS ASPECTS';
  var captionDiv = document.createElement('div');
  captionDiv.className = 'chart-wheel-caption';
  captionDiv.textContent = captionText;
  container.appendChild(captionDiv);
}
