import type { DB } from '../db.js';
import { config } from '../config.js';
import { decryptForUser } from '../crypto.js';
import { MissingPeer39SetupError } from './errors.js';
import type { CachedToken, LoginResponse } from './types.js';

const SAFETY_MARGIN_MS = 60_000;

const cache = new Map<string, CachedToken>();
const inflight = new Map<string, Promise<string>>();

function setupUrl(): string {
  return `${config.publicUrl}/setup`;
}

interface CredsRow {
  username_ciphertext: Buffer;
  username_nonce: Buffer;
  password_ciphertext: Buffer;
  password_nonce: Buffer;
}

function readDecryptedCreds(db: DB, userSub: string): { username: string; password: string } {
  const stmt = db.prepare(
    'SELECT username_ciphertext, username_nonce, password_ciphertext, password_nonce FROM peer39_credentials WHERE sub = ?',
  );
  const row = stmt.get(userSub) as CredsRow | undefined;
  if (!row) {
    throw new MissingPeer39SetupError(userSub, setupUrl());
  }
  const username = decryptForUser(userSub, row.username_ciphertext, row.username_nonce);
  const password = decryptForUser(userSub, row.password_ciphertext, row.password_nonce);
  return { username, password };
}

async function performLogin(userSub: string, db: DB): Promise<string> {
  const { username, password } = readDecryptedCreds(db, userSub);
  const res = await fetch(`${config.peer39BaseUrl}/api/external/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (res.status === 401) {
    throw new Error(
      'Peer39 login failed (401): your saved username/password is wrong or the account lost the "External API" role. Visit /setup to update.',
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Peer39 login failed (HTTP ${res.status}): ${body}`);
  }
  const body = (await res.json()) as LoginResponse;
  if (!body?.result?.sessionId || typeof body.expirationInSeconds !== 'number') {
    throw new Error('Peer39 login succeeded but response shape was unexpected.');
  }
  cache.set(userSub, {
    sessionId: body.result.sessionId,
    expiresAt: Date.now() + body.expirationInSeconds * 1000,
  });
  return body.result.sessionId;
}

export async function sessionIdFor(userSub: string, db: DB): Promise<string> {
  const cached = cache.get(userSub);
  if (cached && Date.now() < cached.expiresAt - SAFETY_MARGIN_MS) {
    return cached.sessionId;
  }
  const pending = inflight.get(userSub);
  if (pending) return pending;
  const p = performLogin(userSub, db).finally(() => inflight.delete(userSub));
  inflight.set(userSub, p);
  return p;
}

export function invalidateSession(userSub: string): void {
  cache.delete(userSub);
}

export function _resetAuthCacheForTests(): void {
  cache.clear();
  inflight.clear();
}
