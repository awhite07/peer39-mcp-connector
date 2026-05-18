import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from './config.js';

const KEY = Buffer.from(config.encryptionKey, 'base64');
if (KEY.length !== 32) {
  // Defensive — config.ts already validated, but guard against module-load surprises.
  throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes (base64).');
}

export interface SealedValue {
  ciphertext: Buffer;
  nonce: Buffer;
}

export function encryptForUser(sub: string, plaintext: string): SealedValue {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, nonce);
  cipher.setAAD(Buffer.from(sub, 'utf8'));
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: Buffer.concat([enc, tag]), nonce };
}

export function decryptForUser(
  sub: string,
  ciphertext: Buffer | Uint8Array,
  nonce: Buffer | Uint8Array,
): string {
  const ct = Buffer.isBuffer(ciphertext) ? ciphertext : Buffer.from(ciphertext);
  const iv = Buffer.isBuffer(nonce) ? nonce : Buffer.from(nonce);
  if (ct.length < 16) throw new Error('Ciphertext too short to contain auth tag.');
  const tag = ct.subarray(ct.length - 16);
  const body = ct.subarray(0, ct.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAAD(Buffer.from(sub, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}
