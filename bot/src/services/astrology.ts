import { config } from '../config.js';

export interface PlanetPosition {
  planet: string;
  sign: string;
  degree: number;
  absoluteLongitude: number;
  isRetrograde: boolean;
  house: number;
}

export interface TransitData {
  date: Date;
  planets: PlanetPosition[];
}

const PLANET_ORDER = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

const SIGN_ABBR: Record<string, string> = {
  Ari: 'Aries', Tau: 'Taurus', Gem: 'Gemini', Can: 'Cancer',
  Leo: 'Leo', Vir: 'Virgo', Lib: 'Libra', Sco: 'Scorpio',
  Sag: 'Sagittarius', Cap: 'Capricorn', Aqu: 'Aquarius', Pis: 'Pisces',
};

function expandSign(abbr: string): string {
  return SIGN_ABBR[abbr] || abbr;
}

export async function fetchDailyTransits(
  date: Date,
  lat: number = -33.9249,
  lon: number = 18.4241,
): Promise<TransitData> {
  const dateStr = date.toISOString().split('T')[0];
  const [year, month, day] = dateStr.split('-');

  const params = new URLSearchParams({
    api_key: config.ASTROLOGY_API_KEY,
    year, month, day,
    hour: '12', minute: '0',
    latitude: String(lat),
    longitude: String(lon),
    house_system: 'whole_sign',
  });

  const res = await fetch(
    `https://astrology-api.io/api/v3/charts/natal?${params}`,
  );

  if (!res.ok) {
    throw new Error(`Astrology API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const planets: PlanetPosition[] = [];

  for (const p of (data.planets || [])) {
    const name = p.name || p.planet;
    if (!PLANET_ORDER.includes(name)) continue;
    planets.push({
      planet: name,
      sign: expandSign(p.sign),
      degree: p.degree || 0,
      absoluteLongitude: p.absolute_longitude || p.full_degree || 0,
      isRetrograde: p.is_retrograde || false,
      house: p.house || 1,
    });
  }

  return { date, planets };
}
