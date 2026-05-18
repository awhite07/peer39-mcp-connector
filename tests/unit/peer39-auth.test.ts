import { describe, it, expect, beforeAll, afterEach, afterAll, beforeEach } from 'vitest';
import { server, http, HttpResponse, PEER39_BASE } from '../helpers/msw.js';
import { sessionIdFor, invalidateSession, _resetAuthCacheForTests } from '../../src/peer39/auth.js';
import { openInMemoryDatabase } from '../../src/db.js';
import { seedUser, seedCreds } from '../helpers/seed.js';
import { MissingPeer39SetupError } from '../../src/peer39/errors.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  _resetAuthCacheForTests();
});

describe('peer39/auth — per-user sessions', () => {
  it('logs in once per user and caches the sessionId', async () => {
    const db = openInMemoryDatabase();
    seedUser(db, 'user-A');
    seedCreds(db, 'user-A');
    let calls = 0;
    server.use(
      http.post(`${PEER39_BASE}/api/external/login`, async () => {
        calls += 1;
        return HttpResponse.json({ result: { sessionId: 'sid-A' }, expirationInSeconds: 86400 });
      }),
    );
    const t1 = await sessionIdFor('user-A', db);
    const t2 = await sessionIdFor('user-A', db);
    expect(t1).toBe('sid-A');
    expect(t2).toBe('sid-A');
    expect(calls).toBe(1);
  });

  it('two users get two distinct sessions', async () => {
    const db = openInMemoryDatabase();
    seedUser(db, 'user-A');
    seedUser(db, 'user-B');
    seedCreds(db, 'user-A', { username: 'a-user' });
    seedCreds(db, 'user-B', { username: 'b-user' });
    server.use(
      http.post(`${PEER39_BASE}/api/external/login`, async ({ request }) => {
        const body = (await request.json()) as { username: string };
        return HttpResponse.json({
          result: { sessionId: `sid-${body.username}` },
          expirationInSeconds: 86400,
        });
      }),
    );
    const [a, b] = await Promise.all([sessionIdFor('user-A', db), sessionIdFor('user-B', db)]);
    expect(a).toBe('sid-a-user');
    expect(b).toBe('sid-b-user');
  });

  it('concurrent calls for same user share inflight promise', async () => {
    const db = openInMemoryDatabase();
    seedUser(db, 'user-A');
    seedCreds(db, 'user-A');
    let calls = 0;
    server.use(
      http.post(`${PEER39_BASE}/api/external/login`, async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 25));
        return HttpResponse.json({ result: { sessionId: 'sid-shared' }, expirationInSeconds: 86400 });
      }),
    );
    const [a, b, c] = await Promise.all([
      sessionIdFor('user-A', db),
      sessionIdFor('user-A', db),
      sessionIdFor('user-A', db),
    ]);
    expect(a).toBe('sid-shared');
    expect(b).toBe('sid-shared');
    expect(c).toBe('sid-shared');
    expect(calls).toBe(1);
  });

  it('invalidate forces a re-login', async () => {
    const db = openInMemoryDatabase();
    seedUser(db, 'user-A');
    seedCreds(db, 'user-A');
    let calls = 0;
    server.use(
      http.post(`${PEER39_BASE}/api/external/login`, async () => {
        calls += 1;
        return HttpResponse.json({ result: { sessionId: `sid-${calls}` }, expirationInSeconds: 86400 });
      }),
    );
    await sessionIdFor('user-A', db);
    invalidateSession('user-A');
    const t2 = await sessionIdFor('user-A', db);
    expect(t2).toBe('sid-2');
    expect(calls).toBe(2);
  });

  it('throws MissingPeer39SetupError when no credentials row', async () => {
    const db = openInMemoryDatabase();
    seedUser(db, 'user-NoSetup');
    await expect(sessionIdFor('user-NoSetup', db)).rejects.toBeInstanceOf(MissingPeer39SetupError);
  });

  it('surfaces 401 from upstream as a clear error', async () => {
    const db = openInMemoryDatabase();
    seedUser(db, 'user-A');
    seedCreds(db, 'user-A');
    server.use(http.post(`${PEER39_BASE}/api/external/login`, () => new HttpResponse(null, { status: 401 })));
    await expect(sessionIdFor('user-A', db)).rejects.toThrow(/401/);
  });
});
