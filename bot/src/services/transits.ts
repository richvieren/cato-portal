import { PlanetPosition, TransitData } from './astrology.js';
import { NatalChart } from './supabase.js';

export interface SignificantTransit {
  type: 'conjunction' | 'opposition' | 'square' | 'trine' | 'sextile' | 'retrograde_station';
  transitPlanet: string;
  transitSign: string;
  natalPlanet?: string;
  natalSign?: string;
  natalHouse?: number;
  orb?: number;
  description: string;
}

const ASPECT_ANGLES: Record<string, number> = {
  conjunction: 0,
  opposition: 180,
  square: 90,
  trine: 120,
  sextile: 60,
};

const ASPECT_ORBS: Record<string, number> = {
  conjunction: 8,
  opposition: 8,
  square: 7,
  trine: 7,
  sextile: 5,
};

function angleDiff(a: number, b: number): number {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

export function detectSignificantTransits(
  transitData: TransitData,
  natalChart: NatalChart,
): SignificantTransit[] {
  const results: SignificantTransit[] = [];
  const natalPlanets = natalChart.planets as any[];

  for (const tp of transitData.planets) {
    if (tp.isRetrograde && tp.planet !== 'Moon') {
      results.push({
        type: 'retrograde_station',
        transitPlanet: tp.planet,
        transitSign: tp.sign,
        description: `${tp.planet} retrograde in ${tp.sign}`,
      });
    }

    for (const np of natalPlanets) {
      const natalName = np.name || np.planet;
      const natalLon = np.absolute_longitude || np.full_degree || 0;
      const natalSign = np.sign || '';
      const natalHouse = np.house || 1;

      for (const [aspectName, targetAngle] of Object.entries(ASPECT_ANGLES)) {
        const diff = angleDiff(tp.absoluteLongitude, natalLon);
        const absOrb = Math.abs(diff - targetAngle);
        const maxOrb = ASPECT_ORBS[aspectName] || 8;

        if (absOrb <= maxOrb) {
          results.push({
            type: aspectName as SignificantTransit['type'],
            transitPlanet: tp.planet,
            transitSign: tp.sign,
            natalPlanet: natalName,
            natalSign: natalSign,
            natalHouse: natalHouse,
            orb: Math.round(absOrb * 100) / 100,
            description: `Transit ${tp.planet} in ${tp.sign} ${aspectName} natal ${natalName} in ${natalSign} (${absOrb.toFixed(1)}° orb)`,
          });
        }
      }
    }
  }

  results.sort((a, b) => (a.orb || 99) - (b.orb || 99));
  return results.slice(0, 3);
}

export function formatTransitsForPrompt(
  transits: SignificantTransit[],
  date: Date,
): string {
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  if (transits.length === 0) {
    return `Date: ${dateStr}\nNo major transits today. Quiet energy.`;
  }

  const lines = transits.map(t => `- ${t.description}`);
  return `Date: ${dateStr}\nTransits:\n${lines.join('\n')}`;
}

export function formatNatalChartForPrompt(chart: NatalChart): string {
  const planets = (chart.planets as any[])
    .map(p => `${p.name || p.planet} in ${p.sign} (house ${p.house})${p.is_retrograde ? ' Rx' : ''}`)
    .join(', ');

  const elements = chart.elements as Record<string, number>;
  const dominant = Object.entries(elements).sort(([, a], [, b]) => b - a)[0];

  return `Natal chart: ${planets}\nDominant element: ${dominant?.[0] || 'unknown'}`;
}
