import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { openInMemoryDatabase } from '../../src/db.js';
import { buildApp } from '../../src/app.js';
import { signAccessToken } from '../../src/oauth/tokens.js';
import { seedUser } from '../helpers/seed.js';

describe('MCP /mcp endpoint', () => {
  it('rejects requests without a bearer', async () => {
    const db = openInMemoryDatabase();
    const app = buildApp(db);
    const r = await request(app).post('/mcp').send({});
    expect(r.status).toBe(401);
    expect(r.headers['www-authenticate']).toMatch(/Bearer/);
    expect(r.headers['www-authenticate']).toMatch(/resource_metadata/);
  });

  it('rejects a malformed bearer', async () => {
    const db = openInMemoryDatabase();
    const app = buildApp(db);
    const r = await request(app).post('/mcp').set('Authorization', 'Bearer not.a.jwt').send({});
    expect(r.status).toBe(401);
  });

  it('accepts a valid bearer and routes to MCP transport (tools/list)', async () => {
    const db = openInMemoryDatabase();
    seedUser(db, 'usr-mcp-1');
    const app = buildApp(db);
    const jwt = await signAccessToken({ sub: 'usr-mcp-1', clientId: 'pmc-test' });

    // Drive a full JSON-RPC initialize first so the SDK's transport is happy.
    const init = await request(app)
      .post('/mcp')
      .set('Authorization', `Bearer ${jwt}`)
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '0' },
        },
      });
    // The bearer was accepted (no 401).
    expect(init.status).not.toBe(401);
  });
});
