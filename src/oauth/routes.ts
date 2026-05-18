import { randomBytes, randomUUID } from 'node:crypto';
import type { Request, Response, Router } from 'express';
import express from 'express';
import { z } from 'zod';
import { config, mcpResourceUrl } from '../config.js';
import type { DB } from '../db.js';
import {
  protectedResourceMetadata,
  authorizationServerMetadata,
} from './metadata.js';
import { registerClient, getClient, verifyClientSecret } from './dcr.js';
import { verifyPkceS256 } from './pkce.js';
import {
  signAccessToken,
  newRefreshToken,
  hashRefreshToken,
  jwks,
} from './tokens.js';
import { createUser, findUserByEmail, findUserBySub, verifyPassword } from './users.js';
import { sessionCookieName, readSession, writeSession, clearSession } from './session.js';

const AUTHORIZE_CODE_TTL_MS = 60_000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const AuthorizeQuerySchema = z.object({
  response_type: z.literal('code'),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal('S256'),
  resource: z.string().url().optional(),
  scope: z.string().optional(),
  state: z.string().optional(),
});

export function oauthRouter(db: DB): Router {
  const router = express.Router();

  // --- .well-known/* ---
  router.get('/.well-known/oauth-authorization-server', (_req, res) => {
    res.json(authorizationServerMetadata());
  });
  router.get('/.well-known/oauth-protected-resource', (_req, res) => {
    res.json(protectedResourceMetadata());
  });
  // Some clients append the resource path to the .well-known suffix.
  router.get('/.well-known/oauth-protected-resource/mcp', (_req, res) => {
    res.json(protectedResourceMetadata());
  });
  router.get('/.well-known/jwks.json', async (_req, res) => {
    res.json(await jwks());
  });

  // --- POST /register (RFC 7591) ---
  router.post('/register', async (req, res) => {
    try {
      const client = await registerClient(db, req.body ?? {});
      res.status(201).json(client);
    } catch (err) {
      const e = err as { httpStatus?: number; oauthError?: string; message?: string };
      res.status(e.httpStatus ?? 400).json({
        error: e.oauthError ?? 'invalid_client_metadata',
        error_description: e.message ?? 'registration failed',
      });
    }
  });

  // --- GET /authorize ---
  router.get('/authorize', (req, res) => {
    const parsed = AuthorizeQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }
    const q = parsed.data;
    const client = getClient(db, q.client_id);
    if (!client) {
      return res.status(400).json({ error: 'invalid_client' });
    }
    if (!client.redirect_uris.includes(q.redirect_uri)) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri mismatch' });
    }
    const expectedResource = mcpResourceUrl();
    if (q.resource && q.resource.replace(/\/$/, '') !== expectedResource) {
      return res.status(400).json({ error: 'invalid_target', error_description: `resource must be ${expectedResource}` });
    }

    const session = readSession(req);
    if (!session?.sub) {
      // Not logged in yet — bounce through /login, preserving the authorize query.
      const next = `/authorize?${new URLSearchParams(req.query as Record<string, string>).toString()}`;
      return res.redirect(`/login?next=${encodeURIComponent(next)}`);
    }
    // Render a tiny consent page. Single button = POST /authorize.
    const formAction = '/authorize';
    const hidden = Object.entries(q)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `<input type="hidden" name="${k}" value="${escapeHtml(String(v))}">`)
      .join('');
    res.set('Content-Type', 'text/html').send(consentPage({
      clientName: client.client_name ?? client.client_id,
      hidden,
      formAction,
      userEmail: session.email ?? '',
    }));
  });

  // --- POST /authorize (consent submitted) ---
  router.post('/authorize', (req, res) => {
    const parsed = AuthorizeQuerySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_request' });
    }
    const q = parsed.data;
    const session = readSession(req);
    if (!session?.sub) {
      return res.redirect('/login');
    }
    const client = getClient(db, q.client_id);
    if (!client || !client.redirect_uris.includes(q.redirect_uri)) {
      return res.status(400).json({ error: 'invalid_client' });
    }
    const expectedResource = mcpResourceUrl();
    const resource = q.resource ? q.resource.replace(/\/$/, '') : expectedResource;
    if (resource !== expectedResource) {
      return res.status(400).json({ error: 'invalid_target' });
    }

    const code = `code-${randomUUID()}`;
    db.prepare(
      `INSERT INTO oauth_authorization_codes
         (code, client_id, sub, redirect_uri, code_challenge, resource, scope, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      code,
      q.client_id,
      session.sub,
      q.redirect_uri,
      q.code_challenge,
      resource,
      q.scope ?? null,
      Date.now() + AUTHORIZE_CODE_TTL_MS,
    );

    const url = new URL(q.redirect_uri);
    url.searchParams.set('code', code);
    if (q.state) url.searchParams.set('state', q.state);
    res.redirect(url.toString());
  });

  // --- POST /token ---
  router.post('/token', async (req, res) => {
    const body = req.body ?? {};
    const grantType = body.grant_type;

    if (grantType === 'authorization_code') {
      const { code, code_verifier, redirect_uri, client_id, client_secret } = body;
      if (!code || !code_verifier || !redirect_uri || !client_id) {
        return res.status(400).json({ error: 'invalid_request' });
      }
      const codeRow = db.prepare(
        'SELECT client_id, sub, redirect_uri, code_challenge, resource, scope, expires_at FROM oauth_authorization_codes WHERE code = ?',
      ).get(code) as
        | { client_id: string; sub: string; redirect_uri: string; code_challenge: string; resource: string; scope: string | null; expires_at: number }
        | undefined;
      if (!codeRow) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'unknown or already-used code' });
      }
      // Single-use: delete unconditionally on first lookup.
      db.prepare('DELETE FROM oauth_authorization_codes WHERE code = ?').run(code);
      if (codeRow.expires_at < Date.now()) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'expired code' });
      }
      if (codeRow.client_id !== client_id) {
        return res.status(400).json({ error: 'invalid_client' });
      }
      if (codeRow.redirect_uri !== redirect_uri) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
      }
      const client = getClient(db, client_id);
      if (!client) {
        return res.status(400).json({ error: 'invalid_client' });
      }
      if (client.client_secret_hash) {
        if (!client_secret || !(await verifyClientSecret(client, client_secret))) {
          return res.status(401).json({ error: 'invalid_client' });
        }
      }
      if (!verifyPkceS256(code_verifier, codeRow.code_challenge)) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
      }

      const accessToken = await signAccessToken({
        sub: codeRow.sub,
        clientId: codeRow.client_id,
        scope: codeRow.scope ?? undefined,
      });
      const refresh = newRefreshToken();
      db.prepare(
        'INSERT INTO oauth_refresh_tokens (token_hash, sub, client_id, expires_at) VALUES (?, ?, ?, ?)',
      ).run(refresh.hash, codeRow.sub, codeRow.client_id, Date.now() + REFRESH_TOKEN_TTL_MS);

      return res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 900,
        refresh_token: refresh.token,
        scope: codeRow.scope ?? 'mcp',
      });
    }

    if (grantType === 'refresh_token') {
      const { refresh_token, client_id } = body;
      if (!refresh_token || !client_id) {
        return res.status(400).json({ error: 'invalid_request' });
      }
      const hash = hashRefreshToken(refresh_token);
      const row = db.prepare(
        'SELECT sub, client_id, expires_at FROM oauth_refresh_tokens WHERE token_hash = ?',
      ).get(hash) as { sub: string; client_id: string; expires_at: number } | undefined;
      // Rotate: delete the presented token whether or not it's valid.
      db.prepare('DELETE FROM oauth_refresh_tokens WHERE token_hash = ?').run(hash);
      if (!row) {
        return res.status(400).json({ error: 'invalid_grant' });
      }
      if (row.expires_at < Date.now()) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'refresh token expired' });
      }
      if (row.client_id !== client_id) {
        return res.status(400).json({ error: 'invalid_client' });
      }
      const accessToken = await signAccessToken({ sub: row.sub, clientId: row.client_id });
      const next = newRefreshToken();
      db.prepare(
        'INSERT INTO oauth_refresh_tokens (token_hash, sub, client_id, expires_at) VALUES (?, ?, ?, ?)',
      ).run(next.hash, row.sub, row.client_id, Date.now() + REFRESH_TOKEN_TTL_MS);
      return res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 900,
        refresh_token: next.token,
        scope: 'mcp',
      });
    }

    return res.status(400).json({ error: 'unsupported_grant_type' });
  });

  // --- Connector account login (NOT Peer39 login) ---
  // Internal-beta UX: sign-up and sign-in share the same form. New email creates a user.
  router.get('/login', (req, res) => {
    const next = typeof req.query.next === 'string' ? req.query.next : '/setup';
    res.set('Content-Type', 'text/html').send(loginPage({ next, error: null }));
  });

  router.post('/login', async (req, res) => {
    const next = typeof req.body.next === 'string' ? req.body.next : '/setup';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      return res.set('Content-Type', 'text/html').status(400).send(loginPage({ next, error: 'Email and password required.' }));
    }
    let user = findUserByEmail(db, email);
    if (user) {
      const ok = await verifyPassword(user, password);
      if (!ok) {
        return res.set('Content-Type', 'text/html').status(401).send(loginPage({ next, error: 'Invalid email or password.' }));
      }
    } else {
      // Auto-register (internal beta).
      if (password.length < 12) {
        return res.set('Content-Type', 'text/html').status(400).send(loginPage({ next, error: 'New password must be at least 12 characters.' }));
      }
      user = await createUser(db, email, password);
    }
    writeSession(res, { sub: user.sub, email: user.email ?? undefined });
    res.redirect(next);
  });

  router.post('/logout', (_req, res) => {
    clearSession(res);
    res.redirect('/login');
  });

  return router;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' :
    c === '<' ? '&lt;' :
    c === '>' ? '&gt;' :
    c === '"' ? '&quot;' : '&#39;',
  );
}

function consentPage(opts: { clientName: string; hidden: string; formAction: string; userEmail: string }): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Authorize — Peer39 MCP</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #073763; color: #fff; margin: 0; padding: 40px; }
.card { background: #fff; color: #073763; max-width: 480px; margin: 60px auto; padding: 32px; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
h1 { margin-top: 0; color: #073763; }
p { line-height: 1.5; }
button { background: #3D85C6; color: #fff; border: 0; padding: 10px 20px; border-radius: 4px; font-size: 16px; cursor: pointer; }
button:hover { background: #073763; }
.muted { color: #757575; font-size: 14px; }
</style></head><body>
<div class="card">
<h1>Authorize ${escapeHtml(opts.clientName)}</h1>
<p>You are signed in as <b>${escapeHtml(opts.userEmail)}</b>.</p>
<p>Grant <b>${escapeHtml(opts.clientName)}</b> access to your Peer39 MCP Connector? This lets it call Peer39 tools on your behalf.</p>
<form method="POST" action="${escapeHtml(opts.formAction)}">${opts.hidden}<button type="submit">Approve</button></form>
<p class="muted">You can revoke access anytime in claude.ai settings.</p>
</div>
</body></html>`;
}

function loginPage(opts: { next: string; error: string | null }): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Sign in — Peer39 MCP</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #073763; color: #fff; margin: 0; padding: 40px; }
.card { background: #fff; color: #073763; max-width: 420px; margin: 80px auto; padding: 32px; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
h1 { margin-top: 0; color: #073763; }
label { display: block; margin: 12px 0 4px; font-weight: 600; }
input { width: 100%; padding: 8px; border: 1px solid #9FC5E8; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
button { background: #3D85C6; color: #fff; border: 0; padding: 10px 20px; border-radius: 4px; font-size: 16px; cursor: pointer; margin-top: 16px; }
.err { color: #B54F6F; margin-top: 12px; }
.muted { color: #757575; font-size: 13px; margin-top: 12px; }
</style></head><body>
<div class="card">
<h1>Peer39 MCP Connector</h1>
<p>Sign in (or sign up — new emails create an account).</p>
${opts.error ? `<div class="err">${escapeHtml(opts.error)}</div>` : ''}
<form method="POST" action="/login">
<input type="hidden" name="next" value="${escapeHtml(opts.next)}">
<label>Email</label><input type="email" name="email" autocomplete="email" required>
<label>Password</label><input type="password" name="password" autocomplete="current-password" required>
<button type="submit">Continue</button>
</form>
<p class="muted">New accounts require a password of at least 12 characters.</p>
</div>
</body></html>`;
}

export { sessionCookieName };
