import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify, importPKCS8, importSPKI, exportJWK, type KeyLike } from 'jose';
import { config, mcpResourceUrl } from '../config.js';

const ALG = 'RS256';
const KID = 'connector-key-1';

let cachedPrivateKey: KeyLike | null = null;
let cachedPublicKey: KeyLike | null = null;
let cachedPublicPem: string | null = null;

function keyPaths(): { privatePath: string; publicPath: string } {
  mkdirSync(config.dataDir, { recursive: true });
  return {
    privatePath: join(config.dataDir, 'jwt-private.pem'),
    publicPath: join(config.dataDir, 'jwt-public.pem'),
  };
}

function ensureKeysOnDisk(): { privatePem: string; publicPem: string } {
  const { privatePath, publicPath } = keyPaths();
  if (existsSync(privatePath) && existsSync(publicPath)) {
    return {
      privatePem: readFileSync(privatePath, 'utf8'),
      publicPem: readFileSync(publicPath, 'utf8'),
    };
  }
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  writeFileSync(privatePath, privatePem, { mode: 0o600 });
  writeFileSync(publicPath, publicPem, { mode: 0o644 });
  return { privatePem, publicPem };
}

async function getPrivateKey(): Promise<KeyLike> {
  if (cachedPrivateKey) return cachedPrivateKey;
  const { privatePem } = ensureKeysOnDisk();
  cachedPrivateKey = await importPKCS8(privatePem, ALG);
  return cachedPrivateKey;
}

async function getPublicKey(): Promise<KeyLike> {
  if (cachedPublicKey) return cachedPublicKey;
  const { publicPem } = ensureKeysOnDisk();
  cachedPublicPem = publicPem;
  cachedPublicKey = await importSPKI(publicPem, ALG);
  return cachedPublicKey;
}

export interface AccessTokenClaims {
  iss: string;
  sub: string;
  aud: string;
  client_id: string;
  scope?: string;
  iat: number;
  exp: number;
}

export interface SignAccessTokenOpts {
  sub: string;
  clientId: string;
  scope?: string;
  /** seconds; defaults to 900 (15 min) */
  ttlSeconds?: number;
}

export async function signAccessToken(opts: SignAccessTokenOpts): Promise<string> {
  const key = await getPrivateKey();
  const now = Math.floor(Date.now() / 1000);
  const ttl = opts.ttlSeconds ?? 900;
  return new SignJWT({
    client_id: opts.clientId,
    scope: opts.scope,
  })
    .setProtectedHeader({ alg: ALG, kid: KID, typ: 'JWT' })
    .setIssuer(config.publicUrl)
    .setSubject(opts.sub)
    .setAudience(mcpResourceUrl())
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(key);
}

export async function verifyAccessToken(jwt: string): Promise<AccessTokenClaims> {
  const key = await getPublicKey();
  const { payload } = await jwtVerify(jwt, key, {
    issuer: config.publicUrl,
    audience: mcpResourceUrl(),
    algorithms: [ALG],
  });
  return payload as unknown as AccessTokenClaims;
}

export function newRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function jwks(): Promise<{ keys: Array<Record<string, unknown>> }> {
  const key = await getPublicKey();
  const jwk = await exportJWK(key);
  return {
    keys: [
      {
        ...jwk,
        kid: KID,
        alg: ALG,
        use: 'sig',
      },
    ],
  };
}
