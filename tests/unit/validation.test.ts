import { describe, it, expect } from 'vitest';
import {
  CreateCategoryInputSchema,
  ListCategoriesInputSchema,
  SetupFormSchema,
} from '../../src/peer39/validation.js';

describe('validation schemas', () => {
  it('accepts a minimal create-category input', () => {
    const r = CreateCategoryInputSchema.safeParse({
      type: 2,
      partnerId: 'the-trade-desk',
      items: ['cars', 'trucks'],
      categoryName: 'autos',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.languageCodes).toEqual(['All']);
      expect(r.data.safeFrom).toBe(false);
    }
  });

  it('rejects itemsTypes on non-keyword type', () => {
    const r = CreateCategoryInputSchema.safeParse({
      type: 3,
      partnerId: 'the-trade-desk',
      items: ['https://a.com'],
      itemsTypes: ['REGULAR'],
      categoryName: 'urls',
    });
    expect(r.success).toBe(false);
  });

  it('accepts a podcast keyword category (type 10)', () => {
    const r = CreateCategoryInputSchema.safeParse({
      type: 10,
      partnerId: 'the-trade-desk',
      items: ['true crime', 'murder mystery'],
      categoryName: 'True Crime Podcasts',
    });
    expect(r.success).toBe(true);
  });

  it('rejects itemsTypes on podcast keyword categories', () => {
    const r = CreateCategoryInputSchema.safeParse({
      type: 10,
      partnerId: 'the-trade-desk',
      items: ['true crime'],
      itemsTypes: ['EXCLUDE'],
      categoryName: 'podcasts',
    });
    expect(r.success).toBe(false);
  });

  it('rejects unsupported category types', () => {
    const r = CreateCategoryInputSchema.safeParse({
      type: 9,
      partnerId: 'the-trade-desk',
      items: ['a'],
      categoryName: 'nine',
    });
    expect(r.success).toBe(false);
  });

  it('rejects itemsTypes length mismatch', () => {
    const r = CreateCategoryInputSchema.safeParse({
      type: 2,
      partnerId: 'the-trade-desk',
      items: ['a', 'b'],
      itemsTypes: ['REGULAR'],
      categoryName: 'mismatch',
    });
    expect(r.success).toBe(false);
  });

  it('accepts list categories with all-optional fields', () => {
    expect(ListCategoriesInputSchema.safeParse({}).success).toBe(true);
  });

  it('coerces SetupForm buyerId from string', () => {
    const r = SetupFormSchema.safeParse({
      username: 'u',
      password: 'p',
      buyerId: '4242',
      system: 'sys',
      userEmail: 'a@b.com',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.buyerId).toBe(4242);
  });

  it('rejects malformed setup email', () => {
    const r = SetupFormSchema.safeParse({
      username: 'u',
      password: 'p',
      buyerId: 1,
      system: 'sys',
      userEmail: 'not-an-email',
    });
    expect(r.success).toBe(false);
  });
});
