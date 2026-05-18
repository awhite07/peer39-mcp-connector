import { describe, it, expect } from 'vitest';
import { authorizationServerMetadata, protectedResourceMetadata } from '../../src/oauth/metadata.js';
import { config, mcpResourceUrl } from '../../src/config.js';

describe('oauth/metadata', () => {
  it('AS metadata has required RFC 8414 fields', () => {
    const m = authorizationServerMetadata();
    expect(m.issuer).toBe(config.publicUrl);
    expect(m.authorization_endpoint).toMatch(/\/authorize$/);
    expect(m.token_endpoint).toMatch(/\/token$/);
    expect(m.registration_endpoint).toMatch(/\/register$/);
    expect(m.response_types_supported).toEqual(['code']);
    expect(m.code_challenge_methods_supported).toEqual(['S256']);
    expect(m.grant_types_supported).toContain('authorization_code');
    expect(m.grant_types_supported).toContain('refresh_token');
  });

  it('protected resource metadata points at /mcp', () => {
    const m = protectedResourceMetadata();
    expect(m.resource).toBe(mcpResourceUrl());
    expect(m.authorization_servers).toEqual([config.publicUrl]);
  });
});
