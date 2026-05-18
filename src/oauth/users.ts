import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import type { DB } from '../db.js';

export interface UserRow {
  sub: string;
  email: string | null;
  password_hash: string | null;
  created_at: number;
  updated_at: number;
}

export function findUserByEmail(db: DB, email: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as UserRow | undefined;
}

export function findUserBySub(db: DB, sub: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE sub = ?').get(sub) as UserRow | undefined;
}

export async function createUser(db: DB, email: string, password: string): Promise<UserRow> {
  const sub = `usr-${randomUUID()}`;
  const passwordHash = await argon2.hash(password);
  const now = Date.now();
  db.prepare(
    'INSERT INTO users (sub, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  ).run(sub, email.toLowerCase(), passwordHash, now, now);
  return {
    sub,
    email: email.toLowerCase(),
    password_hash: passwordHash,
    created_at: now,
    updated_at: now,
  };
}

export async function verifyPassword(user: UserRow, password: string): Promise<boolean> {
  if (!user.password_hash) return false;
  try {
    return await argon2.verify(user.password_hash, password);
  } catch {
    return false;
  }
}
