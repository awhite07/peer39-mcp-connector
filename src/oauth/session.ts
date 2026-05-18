import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { config } from '../config.js';

export const sessionCookieName = '__peer39_session';

export interface SessionPayload {
  sub: string;
  email?: string;
  iat: number;
}

function sign(payload: string): string {
  return createHmac('sha256', config.sessionSecret).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function encodeSession(payload: Omit<SessionPayload, 'iat'>): string {
  const full: SessionPayload = { ...payload, iat: Math.floor(Date.now() / 1000) };
  const body = Buffer.from(JSON.stringify(full), 'utf8').toString('base64url');
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string): SessionPayload | null {
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!safeEqual(sign(body), sig)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.sub || !parsed.iat) return null;
    // 24h max
    if (Date.now() / 1000 - parsed.iat > 86_400) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readSession(req: Request): SessionPayload | null {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
  const raw = cookies[sessionCookieName];
  if (!raw) return null;
  return decodeSession(raw);
}

export function writeSession(res: Response, payload: Omit<SessionPayload, 'iat'>): void {
  const token = encodeSession(payload);
  const isProd = config.publicUrl.startsWith('https://');
  res.cookie(sessionCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 86_400 * 1000,
    path: '/',
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(sessionCookieName, { path: '/' });
}
