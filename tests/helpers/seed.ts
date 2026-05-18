import type { DB } from '../../src/db.js';
import { encryptForUser } from '../../src/crypto.js';

export function seedUser(db: DB, sub: string, email = `${sub}@test.example`): void {
  const now = Date.now();
  db.prepare(
    'INSERT INTO users (sub, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  ).run(sub, email, null, now, now);
}

export function seedCreds(
  db: DB,
  sub: string,
  opts: { username?: string; password?: string; buyerId?: number; system?: string; email?: string } = {},
): void {
  const u = encryptForUser(sub, opts.username ?? 'test-user');
  const p = encryptForUser(sub, opts.password ?? 'test-pass');
  db.prepare(
    `INSERT INTO peer39_credentials
       (sub, username_ciphertext, username_nonce, password_ciphertext, password_nonce,
        buyer_id, system, user_email, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    sub,
    u.ciphertext,
    u.nonce,
    p.ciphertext,
    p.nonce,
    opts.buyerId ?? 4242,
    opts.system ?? 'test-system',
    opts.email ?? 'test@example.com',
    Date.now(),
  );
}
