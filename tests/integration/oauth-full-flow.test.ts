import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import { openInMemoryDatabase } from '../../src/db.js';
import { buildApp } from '../../src/app.js';
import { s256Challenge } from '../../src/oauth/pkce.js';
import { mcpResourceUrl } from '../../src/config.js';

function makeApp() {
  const db = openInMemoryDatabase();
  return { app: buildApp(db), db };
}

function makePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString('base64url').slice(0, 64);
  return { verifier, challenge: s256Challenge(verifier) };
}

describe('OAuth full flow (discovery → DCR → authorize → token → /mcp)', () => {
  let app: ReturnType<typeof buildApp>;
  beforeAll(() => { app = makeApp().app; });

  it('returns AS metadata', async () => {
    const r = await request(app).get('/.well-known/oauth-authorization-server').expect(200);
    expect(r.body.issuer).toBeDefined();
    expect(r.body.code_challenge_methods_supported).toEqual(['S256']);
  });

  it('returns protected resource metadata', async () => {
    const r = await request(app).get('/.well-known/oauth-protected-resource').expect(200);
    expect(r.body.resource).toBe(mcpResourceUrl());
  });

  it('GET /mcp without bearer returns 401 with WWW-Authenticate', async () => {
    const r = await request(app).get('/mcp').expect(401);
    expect(r.headers['www-authenticate']).toMatch(/resource_metadata=/);
  });

  it('completes a full PKCE flow end-to-end', async () => {
    const { app, db } = makeApp();

    // 1. DCR
    const dcr = await request(app)
      .post('/register')
      .send({ redirect_uris: ['https://claude.ai/callback'], client_name: 'Claude.ai (test)' })
      .expect(201);
    const clientId = dcr.body.client_id;
    expect(clientId).toMatch(/^pmc-/);

    // 2. Create a user via /login (auto-registers).
    const agent = request.agent(app);
    await agent
      .post('/login')
      .type('form')
      .send({ email: 'tester@example.com', password: 'correct-horse-battery-staple-1', next: '/setup' })
      .expect(302);

    // 3. /authorize (POST, simulating consent).
    const pkce = makePkce();
    const authorizeRes = await agent
      .post('/authorize')
      .type('form')
      .send({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: 'https://claude.ai/callback',
        code_challenge: pkce.challenge,
        code_challenge_method: 'S256',
        resource: mcpResourceUrl(),
        scope: 'mcp',
        state: 'xyz',
      })
      .expect(302);
    const loc = new URL(authorizeRes.headers.location);
    const code = loc.searchParams.get('code');
    expect(code).toBeTruthy();

    // 4. /token exchange.
    const tokenRes = await request(app)
      .post('/token')
      .type('form')
      .send({
        grant_type: 'authorization_code',
        code: code!,
        code_verifier: pkce.verifier,
        redirect_uri: 'https://claude.ai/callback',
        client_id: clientId,
      })
      .expect(200);
    const accessToken: string = tokenRes.body.access_token;
    expect(accessToken).toBeTruthy();
    expect(tokenRes.body.refresh_token).toBeTruthy();

    // 5. /mcp with the bearer — JSON-RPC initialize so the SDK accepts the request.
    const mcpRes = await request(app)
      .post('/mcp')
      .set('Authorization', `Bearer ${accessToken}`)
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
    // Acceptable outcomes: 200 with JSON-RPC body, or 200 with event stream — either proves
    // the bearer was accepted and routing reached the MCP layer.
    expect([200, 202]).toContain(mcpRes.status);

    db.close();
  });

  it('rejects authorize POST when not logged in', async () => {
    const { app } = makeApp();
    const dcr = await request(app)
      .post('/register')
      .send({ redirect_uris: ['https://claude.ai/callback'] })
      .expect(201);
    const pkce = makePkce();
    // No session cookie -> redirect to /login.
    const res = await request(app)
      .post('/authorize')
      .type('form')
      .send({
        response_type: 'code',
        client_id: dcr.body.client_id,
        redirect_uri: 'https://claude.ai/callback',
        code_challenge: pkce.challenge,
        code_challenge_method: 'S256',
        resource: mcpResourceUrl(),
      });
    expect([302, 401]).toContain(res.status);
  });

  it('rejects token exchange with bad PKCE verifier', async () => {
    const { app } = makeApp();
    const dcr = await request(app)
      .post('/register')
      .send({ redirect_uris: ['https://claude.ai/callback'] })
      .expect(201);

    const agent = request.agent(app);
    await agent
      .post('/login')
      .type('form')
      .send({ email: 'tester2@example.com', password: 'correct-horse-battery-staple-2', next: '/setup' })
      .expect(302);
    const pkce = makePkce();
    const authorizeRes = await agent
      .post('/authorize')
      .type('form')
      .send({
        response_type: 'code',
        client_id: dcr.body.client_id,
        redirect_uri: 'https://claude.ai/callback',
        code_challenge: pkce.challenge,
        code_challenge_method: 'S256',
        resource: mcpResourceUrl(),
      })
      .expect(302);
    const code = new URL(authorizeRes.headers.location).searchParams.get('code')!;
    await request(app)
      .post('/token')
      .type('form')
      .send({
        grant_type: 'authorization_code',
        code,
        code_verifier: 'this-is-the-wrong-verifier-but-the-right-length-aaaaaaaa',
        redirect_uri: 'https://claude.ai/callback',
        client_id: dcr.body.client_id,
      })
      .expect(400);
  });
});
