import { describe, it, expect } from 'vitest';
import { formatCreatedSummary } from '../../../src/mcp/tools/create-category.js';
import type { CategoryResponse } from '../../../src/peer39/types.js';

const baseRes: CategoryResponse = {
  value: {
    buyerId: 4242,
    buyerName: 'Acme Inc',
    categoryName: 'Premium Sports Inventory',
    type: 2,
    partner: { id: 28 },
    accountCategoryId: 99001,
  },
  code: 200,
  description: null,
  message: 'ok',
};

describe('formatCreatedSummary', () => {
  it('renders a markdown summary ending with "live on <buyerName>"', () => {
    const out = formatCreatedSummary({
      res: baseRes,
      categoryName: 'Premium Sports Inventory',
      type: 2,
      items: ['nba', 'nfl', 'mlb'],
      partnerId: 28,
      buyerId: 4242,
      expirationDate: '2026-12-31',
    });
    expect(out).toMatch(/^Category created\./);
    expect(out).toContain('**Premium Sports Inventory**');
    expect(out).toContain('- Type: Keyword');
    expect(out).toContain('- Items: 3');
    expect(out).toContain('- Expires: 2026-12-31');
    expect(out).toContain('- Account category ID: 99001');
    expect(out).toMatch(/The category is now live on Acme Inc \(buyer id 4242\)\.$/);
  });

  it('falls back to "your Peer39 account" when buyerName is missing in response', () => {
    const res: CategoryResponse = {
      ...baseRes,
      value: { ...baseRes.value, buyerName: undefined },
    };
    const out = formatCreatedSummary({
      res,
      categoryName: 'cat',
      type: 3,
      items: ['example.com'],
      partnerId: 28,
      buyerId: 4242,
    });
    expect(out).toMatch(/The category is now live on your Peer39 account \(buyer id 4242\)\.$/);
    expect(out).toContain('- Type: URL');
  });

  it('summarizes itemsTypes breakdown when provided', () => {
    const out = formatCreatedSummary({
      res: baseRes,
      categoryName: 'cat',
      type: 2,
      items: ['a', 'b', 'c', 'd'],
      itemsTypes: ['REGULAR', 'REGULAR', 'MUST_HAVE', 'EXCLUDE'],
      partnerId: 28,
      buyerId: 4242,
    });
    expect(out).toContain('- Items: 4 (2 regular, 1 must_have, 1 exclude)');
  });

  it('resolves partner name when known; falls back to "partner id N" otherwise', () => {
    const known = formatCreatedSummary({
      res: baseRes,
      categoryName: 'cat',
      type: 2,
      items: ['x'],
      partnerId: 1407, // ttd
      buyerId: 4242,
    });
    expect(known).toMatch(/- DSP: the-trade-desk \(id 1407\)/);

    const unknown = formatCreatedSummary({
      res: baseRes,
      categoryName: 'cat',
      type: 2,
      items: ['x'],
      partnerId: 99999,
      buyerId: 4242,
    });
    expect(unknown).toMatch(/- DSP: partner id 99999/);
  });
});
