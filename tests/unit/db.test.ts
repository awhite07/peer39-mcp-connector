import { describe, it, expect } from 'vitest';
import { openInMemoryDatabase } from '../../src/db.js';

describe('db schema', () => {
  it('creates every table', () => {
    const db = openInMemoryDatabase();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((r: { name: string } | unknown) => (r as { name: string }).name)
      .sort();
    expect(tables).toEqual([
      'oauth_authorization_codes',
      'oauth_clients',
      'oauth_refresh_tokens',
      'peer39_credentials',
      'users',
    ]);
  });

  it('users table has expected columns', () => {
    const db = openInMemoryDatabase();
    const cols = db
      .prepare('PRAGMA table_info(users)')
      .all()
      .map((c: unknown) => (c as { name: string }).name);
    expect(cols).toContain('sub');
    expect(cols).toContain('email');
    expect(cols).toContain('password_hash');
  });

  it('peer39_credentials cascade-deletes when user is removed', () => {
    const db = openInMemoryDatabase();
    const now = Date.now();
    db.prepare('INSERT INTO users (sub, email, created_at, updated_at) VALUES (?, ?, ?, ?)').run('u1', 'u1@x', now, now);
    db.prepare(
      `INSERT INTO peer39_credentials
       (sub, username_ciphertext, username_nonce, password_ciphertext, password_nonce, buyer_id, system, user_email, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run('u1', Buffer.from('x'), Buffer.from('y'), Buffer.from('a'), Buffer.from('b'), 1, 'sys', 'e@x', now);
    db.prepare('DELETE FROM users WHERE sub = ?').run('u1');
    const left = db.prepare('SELECT COUNT(*) AS n FROM peer39_credentials').get() as { n: number };
    expect(left.n).toBe(0);
  });
});
