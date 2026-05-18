import { describe, it, expect } from 'vitest';
import { resolvePartnerId, partnerIdToName, PARTNER_NAME_TO_ID } from '../../src/peer39/partners.js';

describe('partners', () => {
  it('resolves numeric strings', () => {
    expect(resolvePartnerId('1407')).toBe(1407);
  });
  it('resolves slugs', () => {
    expect(resolvePartnerId('the-trade-desk')).toBe(1407);
    expect(resolvePartnerId('xandr')).toBe(841);
  });
  it('rejects unknown names', () => {
    expect(() => resolvePartnerId('not-a-real-dsp')).toThrow();
  });
  it('rejects non-positive numbers', () => {
    expect(() => resolvePartnerId(0)).toThrow();
    expect(() => resolvePartnerId(-5)).toThrow();
  });
  it('reverse-lookup picks first canonical name', () => {
    expect(partnerIdToName(841)).toBe('microsoft-advertising');
    expect(partnerIdToName(99999999)).toBeUndefined();
  });
  it('partner table is non-empty', () => {
    expect(Object.keys(PARTNER_NAME_TO_ID).length).toBeGreaterThan(20);
  });
});
