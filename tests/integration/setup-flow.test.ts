import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import supertest from 'supertest';
import { server, http, HttpResponse, PEER39_BASE } from '../helpers/msw.js';
import { openInMemoryDatabase } from '../../src/db.js';
import { buildApp } from '../../src/app.js';
import { hasPeer39Credentials, readCredentialContext } from '../../src/peer39/credentials.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function loggedInAgent(app: ReturnType<typeof buildApp>, email = 'setup-tester@example.com') {
  const agent = supertest.agent(app);
  await agent
    .post('/login')
    .type('form')
    .send({ email, password: 'correct-horse-battery-staple-3', next: '/setup' })
    .expect(302);
  return agent;
}

describe('Setup flow', () => {
  it('GET /setup without session redirects to /login', async () => {
    const db = openInMemoryDatabase();
    const app = buildApp(db);
    const r = await supertest(app).get('/setup');
    expect(r.status).toBe(302);
    expect(r.headers.location).toMatch(/^\/login\?next=/);
  });

  it('GET /setup with session returns 200 form', async () => {
    const db = openInMemoryDatabase();
    const app = buildApp(db);
    const agent = await loggedInAgent(app);
    const r = await agent.get('/setup').expect(200);
    expect(r.text).toMatch(/Peer39 setup/);
    expect(r.text).toMatch(/buyerId/);
  });

  it('POST /setup with bad Peer39 creds → 400 with retry form', async () => {
    server.use(http.post(`${PEER39_BASE}/api/external/login`, () => new HttpResponse(null, { status: 401 })));
    const db = openInMemoryDatabase();
    const app = buildApp(db);
    const agent = await loggedInAgent(app);
    const r = await agent
      .post('/setup')
      .type('form')
      .send({
        username: 'baduser',
        password: 'badpass',
        buyerId: '4242',
        system: 'sys-x',
        userEmail: 'me@example.com',
      });
    expect(r.status).toBe(400);
    expect(r.text).toMatch(/Peer39 rejected/);
  });

  it('POST /setup with good creds → success + DB row + encrypted', async () => {
    server.use(
      http.post(`${PEER39_BASE}/api/external/login`, () =>
        HttpResponse.json({ result: { sessionId: 'sid-good' }, expirationInSeconds: 86400 }),
      ),
    );
    const db = openInMemoryDatabase();
    const app = buildApp(db);
    const agent = await loggedInAgent(app, 'good-tester@example.com');
    const r = await agent
      .post('/setup')
      .type('form')
      .send({
        username: 'gooduser',
        password: 'goodpass',
        buyerId: '4242',
        system: 'sys-y',
        userEmail: 'good@example.com',
      });
    expect(r.status).toBe(200);
    expect(r.text).toMatch(/You're all set/);

    // Find the user's sub.
    const row = db.prepare('SELECT sub FROM users WHERE email = ?').get('good-tester@example.com') as { sub: string };
    expect(row.sub).toBeTruthy();
    expect(hasPeer39Credentials(db, row.sub)).toBe(true);

    // Ciphertext must not contain plaintext.
    const credsRaw = db.prepare('SELECT username_ciphertext, password_ciphertext FROM peer39_credentials WHERE sub = ?').get(row.sub) as
      | { username_ciphertext: Buffer; password_ciphertext: Buffer }
      | undefined;
    expect(credsRaw).toBeDefined();
    expect(credsRaw!.username_ciphertext.toString('utf8').includes('gooduser')).toBe(false);
    expect(credsRaw!.password_ciphertext.toString('utf8').includes('goodpass')).toBe(false);

    // Context readable.
    const ctxRow = readCredentialContext(db, row.sub);
    expect(ctxRow).toEqual({ buyerId: 4242, system: 'sys-y', userEmail: 'good@example.com' });
  });
});
