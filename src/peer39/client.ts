import type { DB } from '../db.js';
import { config } from '../config.js';
import { sessionIdFor, invalidateSession } from './auth.js';
import { Peer39ApiError } from './errors.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RequestCtx {
  userSub: string;
  db: DB;
}

export interface RequestOptions {
  method: HttpMethod;
  path: string;
  body?: unknown;
  query?: Record<string, string | number | Array<string | number> | undefined>;
  extraHeaders?: Record<string, string>;
  /** Default true. Set false for endpoints that don't return `{code, message}` (e.g. /prediction/urlexamples). */
  expectErrorCode?: boolean;
}

export async function request<T>(ctx: RequestCtx, opts: RequestOptions, retry = true): Promise<T> {
  const sessionId = await sessionIdFor(ctx.userSub, ctx.db);
  const url = new URL(opts.path, config.peer39BaseUrl);

  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        for (const x of v) url.searchParams.append(k, String(x));
      } else {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${sessionId}`,
    'Accept': 'application/json',
    ...opts.extraHeaders,
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(url.toString(), {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401 && retry) {
    invalidateSession(ctx.userSub);
    return request<T>(ctx, opts, false);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401) {
      throw new Peer39ApiError(
        -401,
        'Authentication failed after retry',
        `Authentication failed for ${opts.method} ${opts.path} after re-login. HTTP 401. Response: ${text}`,
      );
    }
    throw new Error(`Peer39 API ${opts.method} ${opts.path} failed: HTTP ${res.status} ${text}`);
  }

  const body = (await res.json()) as { code?: number; message?: string } & T;

  if (opts.expectErrorCode !== false && typeof body.code === 'number' && body.code !== 0) {
    throw new Peer39ApiError(body.code, body.message ?? 'Unknown error');
  }

  return body;
}
