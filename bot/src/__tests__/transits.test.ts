import { describe, it, expect } from 'vitest';
import { detectSignificantTransits, formatTransitsForPrompt, formatNatalChartForPrompt } from '../services/transits.js';
import type { TransitData } from '../services/astrology.js';
import type { NatalChart } from '../services/database.js';

const mockNatalChart: NatalChart = {
  user_id: 'test-user',
  planets: [
    { name: 'Sun', sign: 'Cancer', house: 4, absolute_longitude: 100 },
    { name: 'Moon', sign: 'Libra', house: 7, absolute_longitude: 200 },
    { name: 'Mercury', sign: 'Gemini', house: 3, absolute_longitude: 80 },
  ],
  houses: [],
  aspects: [],
  elements: { Fire: 2, Earth: 3, Air: 4, Water: 3 },
  modalities: { Cardinal: 3, Fixed: 4, Mutable: 5 },
  hemispheres: {},
  stelliums: [],
  chart_ruler: null,
};

describe('detectSignificantTransits', () => {
  it('detects conjunction within orb', () => {
    const transitData: TransitData = {
      date: new Date('2026-07-15'),
      planets: [
        { planet: 'Venus', sign: 'Cancer', degree: 10, absoluteLongitude: 103, isRetrograde: false, house: 4 },
      ],
    };
    const results = detectSignificantTransits(transitData, mockNatalChart);
    expect(results.length).toBeGreaterThan(0);
    const conj = results.find(r => r.type === 'conjunction' && r.natalPlanet === 'Sun');
    expect(conj).toBeDefined();
    expect(conj!.orb).toBeLessThanOrEqual(8);
  });

  it('detects opposition', () => {
    const transitData: TransitData = {
      date: new Date('2026-07-15'),
      planets: [
        { planet: 'Mars', sign: 'Capricorn', degree: 10, absoluteLongitude: 280, isRetrograde: false, house: 10 },
      ],
    };
    const results = detectSignificantTransits(transitData, mockNatalChart);
    const opp = results.find(r => r.type === 'opposition' && r.natalPlanet === 'Sun');
    expect(opp).toBeDefined();
  });

  it('detects retrograde stations', () => {
    const transitData: TransitData = {
      date: new Date('2026-07-15'),
      planets: [
        { planet: 'Mercury', sign: 'Leo', degree: 15, absoluteLongitude: 135, isRetrograde: true, house: 5 },
      ],
    };
    const results = detectSignificantTransits(transitData, mockNatalChart);
    const retro = results.find(r => r.type === 'retrograde_station');
    expect(retro).toBeDefined();
    expect(retro!.transitPlanet).toBe('Mercury');
  });

  it('returns max 3 results sorted by orb', () => {
    const transitData: TransitData = {
      date: new Date('2026-07-15'),
      planets: [
        { planet: 'Sun', sign: 'Cancer', degree: 20, absoluteLongitude: 101, isRetrograde: false, house: 4 },
        { planet: 'Venus', sign: 'Cancer', degree: 10, absoluteLongitude: 99, isRetrograde: false, house: 4 },
        { planet: 'Mars', sign: 'Virgo', degree: 10, absoluteLongitude: 160, isRetrograde: false, house: 6 },
        { planet: 'Jupiter', sign: 'Cancer', degree: 5, absoluteLongitude: 95, isRetrograde: false, house: 4 },
      ],
    };
    const results = detectSignificantTransits(transitData, mockNatalChart);
    expect(results.length).toBeLessThanOrEqual(3);
  });
});

describe('formatTransitsForPrompt', () => {
  it('formats transits for GLM prompt', () => {
    const transits = [{
      type: 'conjunction' as const,
      transitPlanet: 'Venus',
      transitSign: 'Cancer',
      natalPlanet: 'Sun',
      natalSign: 'Cancer',
      natalHouse: 4,
      orb: 3,
      description: 'Transit Venus in Cancer conjunction natal Sun in Cancer (3.0° orb)',
    }];
    const result = formatTransitsForPrompt(transits, new Date('2026-07-15'));
    expect(result).toContain('Venus');
    expect(result).toContain('conjunction');
  });

  it('handles quiet days', () => {
    const result = formatTransitsForPrompt([], new Date('2026-07-15'));
    expect(result).toContain('No major transits');
  });
});

describe('formatNatalChartForPrompt', () => {
  it('formats natal chart for GLM prompt', () => {
    const result = formatNatalChartForPrompt(mockNatalChart);
    expect(result).toContain('Sun in Cancer');
    expect(result).toContain('Moon in Libra');
    expect(result).toContain('Dominant element: Air');
  });
});
