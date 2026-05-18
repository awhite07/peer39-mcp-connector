import { describe, it, expect, beforeAll, afterEach, afterAll, beforeEach } from 'vitest';
import { server, http, HttpResponse, PEER39_BASE, loginHandler } from '../helpers/msw.js';
import { request } from '../../src/peer39/client.js';
import { _resetAuthCacheForTests } from '../../src/peer39/auth.js';
import { Peer39ApiError } from '../../src/peer39/errors.js';
import { openInMemoryDatabase } from '../../src/db.js';
import { seedUser, seedCreds } from '../helpers/seed.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let db: ReturnType<typeof openInMemoryDatabase>;
beforeEach(() => {
  _resetAuthCacheForTests();
  db = openInMemoryDatabase();
  seedUser(db, 'user-A');
  seedCreds(db, 'user-A');
  server.use(loginHandler());
});

const ctx = () => ({ userSub: 'user-A', db });

describe('peer39/client.request — per-user ctx', () => {
  it('happy path parses JSON', async () => {
    server.use(
      http.get(`${PEER39_BASE}/api/external/customcategories/123`, () =>
        HttpResponse.json({ value: { categoryName: 'x' }, code: 0, message: 'ok', description: null }),
      ),
    );
    const res = await request<{ value: { categoryName: string }; code: number }>(ctx(), {
      method: 'GET',
      path: '/api/external/customcategories/123',
    });
    expect(res.value.categoryName).toBe('x');
    expect(res.code).toBe(0);
  });

  it('retries once on 401, re-authenticates, then succeeds', async () => {
    let count = 0;
    server.use(
      http.get(`${PEER39_BASE}/api/external/customcategories`, () => {
        count += 1;
        if (count === 1) return new HttpResponse(null, { status: 401 });
        return HttpResponse.json({ value: { result: [] }, code: 0, message: 'ok', description: null });
      }),
    );
    const res = await request<{ code: number }>(ctx(), { method: 'GET', path: '/api/external/customcategories' });
    expect(res.code).toBe(0);
    expect(count).toBe(2);
  });

  it('throws Peer39ApiError when body.code !== 0', async () => {
    server.use(
      http.get(`${PEER39_BASE}/api/external/customcategories/9`, () =>
        HttpResponse.json({ value: null, code: 31, message: 'Invalid Account ID', description: null }),
      ),
    );
    await expect(
      request(ctx(), { method: 'GET', path: '/api/external/customcategories/9' }),
    ).rejects.toBeInstanceOf(Peer39ApiError);
  });

  it('serializes array query params', async () => {
    let receivedUrl = '';
    server.use(
      http.get(`${PEER39_BASE}/api/external/customcategories`, ({ request: req }) => {
        receivedUrl = req.url;
        return HttpResponse.json({ value: { result: [] }, code: 0, message: 'ok', description: null });
      }),
    );
    await request(ctx(), {
      method: 'GET',
      path: '/api/external/customcategories',
      query: { buyer: [1, 2], partner: [10] },
    });
    expect(receivedUrl).toMatch(/buyer=1/);
    expect(receivedUrl).toMatch(/buyer=2/);
    expect(receivedUrl).toMatch(/partner=10/);
  });

  it('sends the system header for createCategory', async () => {
    let seen: string | null = null;
    server.use(
      http.post(`${PEER39_BASE}/api/external/customcategories`, ({ request: req }) => {
        seen = req.headers.get('system');
        return HttpResponse.json({ value: null, code: 0, message: 'ok', description: null });
      }),
    );
    await request(ctx(), {
      method: 'POST',
      path: '/api/external/customcategories',
      body: { value: {} },
      extraHeaders: { system: 'sys-abc' },
    });
    expect(seen).toBe('sys-abc');
  });

  it('skips error-code validation for /urlexamples', async () => {
    server.use(
      http.post(`${PEER39_BASE}/api/external/prediction/urlexamples`, () =>
        HttpResponse.json({ urlExamples: ['https://a.com'] }),
      ),
    );
    const res = await request<{ urlExamples: string[] }>(ctx(), {
      method: 'POST',
      path: '/api/external/prediction/urlexamples',
      body: { x: 1 },
      expectErrorCode: false,
    });
    expect(res.urlExamples).toEqual(['https://a.com']);
  });
});
