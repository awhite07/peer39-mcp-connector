import { describe, it, expect } from 'vitest';
import { s256Challenge, verifyPkceS256 } from '../../src/oauth/pkce.js';

describe('oauth/pkce', () => {
  // Known-good RFC 7636 Appendix B test vector.
  it('matches the RFC 7636 example', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    expect(s256Challenge(verifier)).toBe(expected);
    expect(verifyPkceS256(verifier, expected)).toBe(true);
  });

  it('rejects an invalid verifier', () => {
    expect(verifyPkceS256('short', 'whatever')).toBe(false);
  });

  it('rejects mismatched challenge', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    expect(verifyPkceS256(verifier, 'definitely-wrong-challenge')).toBe(false);
  });
});
