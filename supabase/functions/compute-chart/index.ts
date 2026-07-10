import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const supabaseAdmin = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const ASTROLOGY_API_BASE = 'https://api.astrology-api.io/api/v3';
const ASTROLOGY_API_KEY = Deno.env.get('ASTROLOGY_API_KEY')!;

const SIGN_META: Record<string, { element: string; modality: string }> = {
  Aries:       { element: 'fire',  modality: 'cardinal' },
  Taurus:      { element: 'earth', modality: 'fixed' },
  Gemini:      { element: 'air',   modality: 'mutable' },
  Cancer:      { element: 'water', modality: 'cardinal' },
  Leo:         { element: 'fire',  modality: 'fixed' },
  Virgo:       { element: 'earth', modality: 'mutable' },
  Libra:       { element: 'air',   modality: 'cardinal' },
  Scorpio:     { element: 'water', modality: 'fixed' },
  Sagittarius: { element: 'fire',  modality: 'mutable' },
  Capricorn:   { element: 'earth', modality: 'cardinal' },
  Aquarius:    { element: 'air',   modality: 'fixed' },
  Pisces:      { element: 'water', modality: 'mutable' },
};

const SIGN_RULERS: Record<string, string> = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon',
  Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Mars',
  Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Saturn', Pisces: 'Jupiter',
};

const MAJOR_PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

interface BirthData {
  full_name: string;
  dob: string;
  tob: string;
  city: string;
  country: string;
}

async function geocode(city: string, country: string): Promise<{ lat: number; lon: number; tzone: number }> {
  const queries = [`${city}, ${country}`, city];
  for (const query of queries) {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'cato-cosmic-profile/1.0' } }
    );
    const results = await res.json();
    if (results.length > 0) {
      const lat = parseFloat(results[0].lat);
      const lon = parseFloat(results[0].lon);
      const tzRes = await fetch(
        `https://timeapi.io/api/timezone/coordinate?latitude=${lat}&longitude=${lon}`
      );
      const tzData = await tzRes.json();
      const tzone = (tzData.currentUtcOffset?.seconds ?? 0) / 3600;
      return { lat, lon, tzone };
    }
  }
  throw new Error(`Could not geocode: ${city}, ${country}`);
}

async function fetchNatalChart(birthData: BirthData) {
  const [year, month, day] = birthData.dob.split('-').map(Number);
  const [hour, minute] = birthData.tob.split(':').map(Number);
  const { lat, lon, tzone } = await geocode(birthData.city, birthData.country);

  const payload = {
    subject: {
      name: birthData.full_name,
      birth_data: { year, month, day, hour, minute, second: 0, latitude: lat, longitude: lon, timezone_offset: tzone },
    },
    options: { house_system: 'W' },
  };

  const headers = {
    'Authorization': `Bearer ${ASTROLOGY_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const wsRes = await fetch(`${ASTROLOGY_API_BASE}/charts/natal`, {
    method: 'POST', headers, body: JSON.stringify(payload),
  });
  if (!wsRes.ok) throw new Error(`Astrology API error: ${wsRes.status}`);
  const wsChart = await wsRes.json();

  // Placidus chart for real ASC/MC degrees
  const pPayload = { ...payload, options: { house_system: 'P' } };
  const pRes = await fetch(`${ASTROLOGY_API_BASE}/charts/natal`, {
    method: 'POST', headers, body: JSON.stringify(pPayload),
  });
  if (pRes.ok) {
    const pChart = await pRes.json();
    const realAngles: Record<string, any> = {};
    for (const p of pChart.chart_data.planetary_positions) {
      if (p.name === 'Ascendant' || p.name === 'Medium_Coeli') {
        realAngles[p.name] = p;
      }
    }
    for (let i = 0; i < wsChart.chart_data.planetary_positions.length; i++) {
      const name = wsChart.chart_data.planetary_positions[i].name;
      if (realAngles[name]) {
        wsChart.chart_data.planetary_positions[i] = realAngles[name];
      }
    }
  }

  return wsChart;
}

function parseChart(rawChart: any) {
  const positions = rawChart.chart_data.planetary_positions;
  const rawHouses = rawChart.chart_data.houses;
  const rawAspects = rawChart.chart_data.aspects || [];

  const planets = positions.map((p: any) => ({
    name: p.name,
    sign: p.sign,
    degree: p.degree,
    house: p.house,
    retrograde: p.retrograde || false,
    full_degree: p.full_degree,
  }));

  const houses = rawHouses.map((h: any) => ({
    number: h.number,
    sign: h.sign,
    degree: h.degree,
  }));

  const majorAspectTypes = ['Conjunction', 'Opposition', 'Trine', 'Square', 'Sextile'];
  const aspects = rawAspects
    .filter((a: any) => majorAspectTypes.includes(a.type))
    .map((a: any) => ({
      planet1: a.first_planet,
      planet2: a.second_planet,
      type: a.type,
      orb: a.orb,
    }));

  const elements: Record<string, { count: number; planets: string[] }> = {
    fire: { count: 0, planets: [] }, earth: { count: 0, planets: [] },
    air: { count: 0, planets: [] }, water: { count: 0, planets: [] },
  };
  const modalities: Record<string, { count: number; planets: string[] }> = {
    cardinal: { count: 0, planets: [] }, fixed: { count: 0, planets: [] }, mutable: { count: 0, planets: [] },
  };

  for (const p of planets) {
    if (!MAJOR_PLANETS.includes(p.name)) continue;
    const meta = SIGN_META[p.sign];
    if (!meta) continue;
    elements[meta.element].count++;
    elements[meta.element].planets.push(p.name);
    modalities[meta.modality].count++;
    modalities[meta.modality].planets.push(p.name);
  }

  const hemispheres = {
    above: { count: 0, planets: [] as string[] },
    below: { count: 0, planets: [] as string[] },
    east: { count: 0, planets: [] as string[] },
    west: { count: 0, planets: [] as string[] },
  };

  for (const p of planets) {
    if (!MAJOR_PLANETS.includes(p.name)) continue;
    const h = p.house;
    if (h >= 7 && h <= 12) { hemispheres.above.count++; hemispheres.above.planets.push(p.name); }
    else { hemispheres.below.count++; hemispheres.below.planets.push(p.name); }
    if (h >= 10 || h <= 3) { hemispheres.east.count++; hemispheres.east.planets.push(p.name); }
    else { hemispheres.west.count++; hemispheres.west.planets.push(p.name); }
  }

  const stelliums: Array<{ type: 'sign' | 'house'; key: string; planets: string[] }> = [];
  const bySign: Record<string, string[]> = {};
  const byHouse: Record<number, string[]> = {};
  for (const p of planets) {
    if (!MAJOR_PLANETS.includes(p.name)) continue;
    if (!bySign[p.sign]) bySign[p.sign] = [];
    bySign[p.sign].push(p.name);
    if (!byHouse[p.house]) byHouse[p.house] = [];
    byHouse[p.house].push(p.name);
  }
  for (const [sign, pls] of Object.entries(bySign)) {
    if (pls.length >= 3) stelliums.push({ type: 'sign', key: sign, planets: pls });
  }
  for (const [house, pls] of Object.entries(byHouse)) {
    if (pls.length >= 3) stelliums.push({ type: 'house', key: `House ${house}`, planets: pls });
  }

  const asc = planets.find((p: any) => p.name === 'Ascendant');
  let chartRuler = null;
  if (asc) {
    const rulerName = SIGN_RULERS[asc.sign];
    const rulerPlanet = planets.find((p: any) => p.name === rulerName);
    if (rulerPlanet) {
      chartRuler = {
        planet: rulerName,
        sign: rulerPlanet.sign,
        house: rulerPlanet.house,
        ascendant_sign: asc.sign,
      };
    }
  }

  return { planets, houses, aspects, elements, modalities, hemispheres, stelliums, chartRuler };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const supabase = supabaseAdmin();
  const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  let body: BirthData;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  try {
    const rawChart = await fetchNatalChart(body);
    const parsed = parseChart(rawChart);

    const { error: dbErr } = await supabase.from('natal_charts').upsert({
      user_id: user.id,
      email: user.email!.toLowerCase(),
      planets: parsed.planets,
      houses: parsed.houses,
      aspects: parsed.aspects,
      elements: parsed.elements,
      modalities: parsed.modalities,
      hemispheres: parsed.hemispheres,
      stelliums: parsed.stelliums,
      chart_ruler: parsed.chartRuler,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (dbErr) throw dbErr;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (err) {
    console.error('compute-chart error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
});
