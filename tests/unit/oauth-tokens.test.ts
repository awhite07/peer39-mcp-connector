import { describe, it, expect } from 'vitest';
import { signAccessToken, verifyAccessToken, newRefreshToken, hashRefreshToken } from '../../src/oauth/tokens.js';
import { mcpResourceUrl } from '../../src/config.js';

describe('oauth/tokens', () => {
  it('signs and verifies an access token', async () => {
    const jwt = await signAccessToken({ sub: 'usr-1', clientId: 'pmc-x', scope: 'mcp' });
    const claims = await verifyAccessToken(jwt);
    expect(claims.sub).toBe('usr-1');
    expect(claims.aud).toBe(mcpResourceUrl());
    expect(claims.client_id).toBe('pmc-x');
  });

  it('rejects a tampered token', async () => {
    const jwt = await signAccessToken({ sub: 'usr-1', clientId: 'pmc-x' });
    const tampered = jwt.slice(0, -4) + 'AAAA';
    await expect(verifyAccessToken(tampered)).rejects.toBeDefined();
  });

  it('refresh token + hash is deterministic on hash', () => {
    const { token, hash } = newRefreshToken();
    expect(hashRefreshToken(token)).toBe(hash);
  });
});
