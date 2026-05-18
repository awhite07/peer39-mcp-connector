import { createHash } from 'node:crypto';

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

export function s256Challenge(verifier: string): string {
  return b64url(createHash('sha256').update(verifier, 'utf8').digest());
}

export function verifyPkceS256(verifier: string, expectedChallenge: string): boolean {
  if (!verifier || !expectedChallenge) return false;
  // RFC 7636: verifier is 43-128 chars, ALPHA / DIGIT / "-" / "." / "_" / "~"
  if (verifier.length < 43 || verifier.length > 128) return false;
  if (!/^[A-Za-z0-9\-._~]+$/.test(verifier)) return false;
  return s256Challenge(verifier) === expectedChallenge;
}
