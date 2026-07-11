import { config } from '../config.js';

export interface TransitAspect {
  transitPlanet: string;
  natalPoint: string;
  aspectType: string;
  orb: number;
}

export interface TransitData {
  date: Date;
  aspects: TransitAspect[];
}

const SIGN_ABBR: Record<string, string> = {
  Ari: 'Aries', Tau: 'Taurus', Gem: 'Gemini', Can: 'Cancer',
  Leo: 'Leo', Vir: 'Virgo', Lib: 'Libra', Sco: 'Scorpio',
  Sag: 'Sagittarius', Cap: 'Capricorn', Aqu: 'Aquarius', Pis: 'Pisces',
};

function expandSign(abbr: string): string {
  return SIGN_ABBR[abbr] || abbr;
}

// Transit planets to track (social + generational + Moon for hard aspects)
const TRANSIT_PLANETS = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const MOON_HARD_ASPECTS = ['conjunction', 'opposition', 'square'];

// Natal points to check against
const NATAL_TARGETS = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
  'Ascendant', 'Medium_Coeli',
  // Descendant = opposite Ascendant, IC = opposite MC — API may label differently
  'Descendant', 'IC',
];

// Aspects to track per Cato's feedback
const VALID_ASPECTS = ['conjunction', 'opposition', 'square', 'trine', 'quincunx', 'inconjunction'];

function cleanPlanetName(name: string): string {
  // API returns "Sun_transit" / "Sun_natal" format
  return name.replace('_transit', '').replace('_natal', '');
}

function isValidTransitAspect(
  transitPlanet: string,
  natalPoint: string,
  aspectType: string,
): boolean {
  const tp = cleanPlanetName(transitPlanet);
  const np = cleanPlanetName(natalPoint);
  const aspect = aspectType.toLowerCase();

  // Check natal point is one we care about
  if (!NATAL_TARGETS.includes(np)) return false;

  // Check aspect type is valid
  if (!VALID_ASPECTS.includes(aspect)) return false;

  // Major transit planets: all valid aspects
  if (TRANSIT_PLANETS.includes(tp)) return true;

  // Moon: only hard aspects (conjunction, opposition, square)
  if (tp === 'Moon' && MOON_HARD_ASPECTS.includes(aspect)) return true;

  // Everything else (Sun, Mercury, Venus, Mars transits): skip per Cato's feedback
  return false;
}

async function geocode(city: string, country: string): Promise<{ lat: number; lon: number; tzone: number }> {
  for (const query of [`${city}, ${country}`, city]) {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'cato-bot/1.0' } },
    );
    const results = await res.json();
    if (results.length > 0) {
      const lat = parseFloat(results[0].lat);
      const lon = parseFloat(results[0].lon);
      const tzRes = await fetch(
        `https://timeapi.io/api/timezone/coordinate?latitude=${lat}&longitude=${lon}`,
      );
      const tzData = await tzRes.json();
      const tzone = (tzData.currentUtcOffset?.seconds ?? 0) / 3600;
      return { lat, lon, tzone };
    }
  }
  throw new Error(`Could not geocode: ${city}, ${country}`);
}

export interface NatalBirthData {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  lat: number;
  lon: number;
  tzone: number;
}

export async function fetchTransitAspects(
  natal: NatalBirthData,
  transitDate: Date,
  transitLat: number = -33.9249,
  transitLon: number = 18.4241,
  transitTzone: number = 2,
): Promise<TransitData> {
  const [year, month, day] = transitDate.toISOString().split('T')[0].split('-').map(Number);

  const payload = {
    subject: {
      name: 'client',
      birth_data: {
        year: natal.year,
        month: natal.month,
        day: natal.day,
        hour: natal.hour,
        minute: natal.minute,
        second: 0,
        latitude: natal.lat,
        longitude: natal.lon,
        timezone_offset: natal.tzone,
      },
    },
    transit_time: {
      datetime: {
        year, month, day,
        hour: 12, minute: 0,
        latitude: transitLat,
        longitude: transitLon,
        timezone_offset: transitTzone,
      },
    },
    options: { house_system: 'W' },
  };

  const res = await fetch('https://api.astrology-api.io/api/v3/charts/transit', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.ASTROLOGY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Astrology API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const rawAspects = data.chart_data?.aspects || [];

  const aspects: TransitAspect[] = [];

  for (const a of rawAspects) {
    const p1 = a.point1 || '';
    const p2 = a.point2 || '';
    const aspectType = a.aspect_type || '';
    const orb = a.orb || 0;

    // Determine which is transit and which is natal
    let transitPlanet: string;
    let natalPoint: string;

    if (p1.includes('_transit')) {
      transitPlanet = cleanPlanetName(p1);
      natalPoint = cleanPlanetName(p2);
    } else if (p2.includes('_transit')) {
      transitPlanet = cleanPlanetName(p2);
      natalPoint = cleanPlanetName(p1);
    } else {
      continue; // Skip natal-to-natal aspects
    }

    if (!isValidTransitAspect(p1, p2, aspectType)) continue;

    aspects.push({ transitPlanet, natalPoint, aspectType, orb });
  }

  // Sort by orb (tightest first)
  aspects.sort((a, b) => a.orb - b.orb);

  return { date: transitDate, aspects };
}
