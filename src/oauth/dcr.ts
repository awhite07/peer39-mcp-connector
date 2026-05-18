import { randomBytes, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import type { DB } from '../db.js';

export interface RegisteredClient {
  client_id: string;
  client_secret?: string;
  client_id_issued_at: number;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  client_name?: string;
}

export interface RegistrationRequest {
  redirect_uris?: string[];
  client_name?: string;
  token_endpoint_auth_method?: string;
}

export async function registerClient(db: DB, req: RegistrationRequest): Promise<RegisteredClient> {
  const redirect_uris = Array.isArray(req.redirect_uris) ? req.redirect_uris.filter(Boolean) : [];
  if (redirect_uris.length === 0) {
    throw Object.assign(new Error('redirect_uris is required'), { httpStatus: 400, oauthError: 'invalid_redirect_uri' });
  }
  // We only accept https://... or http://localhost / 127.0.0.1 redirect URIs.
  for (const uri of redirect_uris) {
    let parsed: URL;
    try { parsed = new URL(uri); }
    catch { throw Object.assign(new Error(`bad redirect_uri: ${uri}`), { httpStatus: 400, oauthError: 'invalid_redirect_uri' }); }
    if (parsed.protocol === 'https:') continue;
    if (parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) continue;
    throw Object.assign(new Error(`redirect_uri must be https (or http://localhost): ${uri}`), { httpStatus: 400, oauthError: 'invalid_redirect_uri' });
  }

  const clientId = `pmc-${randomUUID()}`;
  const requestedAuthMethod = req.token_endpoint_auth_method ?? 'none';

  let clientSecret: string | undefined;
  let secretHash: string | null = null;
  if (requestedAuthMethod === 'client_secret_post') {
    clientSecret = randomBytes(32).toString('base64url');
    secretHash = await argon2.hash(clientSecret);
  }

  db.prepare(
    'INSERT INTO oauth_clients (client_id, client_secret_hash, redirect_uris, client_name, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(clientId, secretHash, JSON.stringify(redirect_uris), req.client_name ?? null, Date.now());

  return {
    client_id: clientId,
    ...(clientSecret ? { client_secret: clientSecret } : {}),
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: requestedAuthMethod,
    client_name: req.client_name,
  };
}

export interface ClientRow {
  client_id: string;
  client_secret_hash: string | null;
  redirect_uris: string[];
  client_name: string | null;
  created_at: number;
}

export function getClient(db: DB, clientId: string): ClientRow | undefined {
  const row = db.prepare(
    'SELECT client_id, client_secret_hash, redirect_uris, client_name, created_at FROM oauth_clients WHERE client_id = ?',
  ).get(clientId) as
    | { client_id: string; client_secret_hash: string | null; redirect_uris: string; client_name: string | null; created_at: number }
    | undefined;
  if (!row) return undefined;
  return {
    client_id: row.client_id,
    client_secret_hash: row.client_secret_hash,
    redirect_uris: JSON.parse(row.redirect_uris) as string[],
    client_name: row.client_name,
    created_at: row.created_at,
  };
}

export async function verifyClientSecret(stored: ClientRow, presented: string): Promise<boolean> {
  if (!stored.client_secret_hash) return false;
  try {
    return await argon2.verify(stored.client_secret_hash, presented);
  } catch {
    return false;
  }
}
