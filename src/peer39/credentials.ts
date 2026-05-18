import type { DB } from '../db.js';
import { encryptForUser } from '../crypto.js';
import { invalidateSession } from './auth.js';

export interface CredentialContext {
  buyerId: number;
  system: string;
  userEmail: string;
}

export function upsertPeer39Credentials(
  db: DB,
  userSub: string,
  creds: { username: string; password: string } & CredentialContext,
): void {
  const u = encryptForUser(userSub, creds.username);
  const p = encryptForUser(userSub, creds.password);
  const now = Date.now();
  db.prepare(
    `INSERT INTO peer39_credentials
       (sub, username_ciphertext, username_nonce, password_ciphertext, password_nonce,
        buyer_id, system, user_email, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(sub) DO UPDATE SET
       username_ciphertext = excluded.username_ciphertext,
       username_nonce = excluded.username_nonce,
       password_ciphertext = excluded.password_ciphertext,
       password_nonce = excluded.password_nonce,
       buyer_id = excluded.buyer_id,
       system = excluded.system,
       user_email = excluded.user_email,
       updated_at = excluded.updated_at`,
  ).run(
    userSub,
    u.ciphertext,
    u.nonce,
    p.ciphertext,
    p.nonce,
    creds.buyerId,
    creds.system,
    creds.userEmail,
    now,
  );
  // Force fresh login on next call so any old cached sessionId is discarded.
  invalidateSession(userSub);
}

export function readCredentialContext(db: DB, userSub: string): CredentialContext | undefined {
  const row = db.prepare(
    'SELECT buyer_id, system, user_email FROM peer39_credentials WHERE sub = ?',
  ).get(userSub) as { buyer_id: number; system: string; user_email: string } | undefined;
  if (!row) return undefined;
  return {
    buyerId: row.buyer_id,
    system: row.system,
    userEmail: row.user_email,
  };
}

export function hasPeer39Credentials(db: DB, userSub: string): boolean {
  const row = db.prepare('SELECT 1 FROM peer39_credentials WHERE sub = ?').get(userSub);
  return Boolean(row);
}
