import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const PEER39_BASE = 'https://app.peer39.com';
export const server = setupServer();

export function loginHandler(opts?: { sessionId?: string; ttlSeconds?: number; status?: number }) {
  return http.post(`${PEER39_BASE}/api/external/login`, async () => {
    if (opts?.status && opts.status !== 200) {
      return new HttpResponse(null, { status: opts.status });
    }
    return HttpResponse.json({
      result: { sessionId: opts?.sessionId ?? 'test-session-id' },
      expirationInSeconds: opts?.ttlSeconds ?? 86400,
    });
  });
}

export { http, HttpResponse };
