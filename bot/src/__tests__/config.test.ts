import { describe, it, expect } from 'vitest';
import { ALERT_DURATIONS, ALERT_PRODUCTS } from '../constants.js';

describe('Alert duration config', () => {
  it('has correct durations', () => {
    expect(ALERT_DURATIONS['transit_reading']).toBe(90);
    expect(ALERT_DURATIONS['masterclass_eq']).toBe(180);
    expect(ALERT_DURATIONS['masterclass_ll']).toBe(180);
  });

  it('ALERT_PRODUCTS matches ALERT_DURATIONS keys', () => {
    expect(ALERT_PRODUCTS).toEqual(['transit_reading', 'masterclass_eq', 'masterclass_ll']);
  });

  it('computes correct expiry for transit reading (90 days)', () => {
    const grantedAt = new Date('2026-07-01');
    const duration = ALERT_DURATIONS['transit_reading'];
    const expiry = new Date(grantedAt);
    expiry.setDate(expiry.getDate() + duration);
    expect(expiry.toISOString().split('T')[0]).toBe('2026-09-29');
  });

  it('computes correct expiry for masterclass (180 days)', () => {
    const grantedAt = new Date('2026-07-01');
    const duration = ALERT_DURATIONS['masterclass_eq'];
    const expiry = new Date(grantedAt);
    expiry.setDate(expiry.getDate() + duration);
    expect(expiry.toISOString().split('T')[0]).toBe('2026-12-28');
  });
});
