import { TransitData, TransitAspect } from './astrology.js';
import { NatalChart } from './database.js';

export function formatTransitHeader(aspects: TransitAspect[]): string {
  return aspects
    .slice(0, 3)
    .map(a => `${a.transitPlanet} ${a.aspectType} your ${a.natalPoint}`)
    .join(' · ');
}

export function formatTransitsForPrompt(transitData: TransitData): string {
  const dateStr = transitData.date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  if (transitData.aspects.length === 0) {
    return `Date: ${dateStr}\nNo major transits today.`;
  }

  const lines = transitData.aspects.map(a =>
    `- Transit ${a.transitPlanet} ${a.aspectType} natal ${a.natalPoint} (${a.orb.toFixed(1)}° orb)`,
  );
  return `Date: ${dateStr}\nTransits:\n${lines.join('\n')}`;
}

export function formatNatalChartForPrompt(chart: NatalChart): string {
  const planets = (chart.planets as any[])
    .map(p => `${p.name || p.planet} in ${p.sign} (house ${p.house})${p.retrograde || p.is_retrograde ? ' Rx' : ''}`)
    .join(', ');

  const elements = chart.elements as Record<string, any>;
  const dominant = Object.entries(elements)
    .sort(([, a]: [string, any], [, b]: [string, any]) => (b.count || b) - (a.count || a))[0];

  return `Natal chart: ${planets}\nDominant element: ${dominant?.[0] || 'unknown'}`;
}
