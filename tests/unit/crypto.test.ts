import { describe, it, expect } from 'vitest';
import { encryptForUser, decryptForUser } from '../../src/crypto.js';

describe('crypto', () => {
  it('round-trips a plaintext', () => {
    const sealed = encryptForUser('user-1', 'hello world');
    expect(sealed.ciphertext.length).toBeGreaterThan(0);
    expect(sealed.nonce.length).toBe(12);
    const out = decryptForUser('user-1', sealed.ciphertext, sealed.nonce);
    expect(out).toBe('hello world');
  });

  it('rejects decryption with a different sub (AAD mismatch)', () => {
    const sealed = encryptForUser('user-1', 'secret');
    expect(() => decryptForUser('user-2', sealed.ciphertext, sealed.nonce)).toThrow();
  });

  it('rejects decryption with a different nonce', () => {
    const a = encryptForUser('user-1', 'a');
    const b = encryptForUser('user-1', 'b');
    expect(() => decryptForUser('user-1', a.ciphertext, b.nonce)).toThrow();
  });

  it('produces a different nonce + ciphertext on each call (nonce reuse safety)', () => {
    const a = encryptForUser('user-1', 'same');
    const b = encryptForUser('user-1', 'same');
    expect(Buffer.compare(a.nonce, b.nonce)).not.toBe(0);
    expect(Buffer.compare(a.ciphertext, b.ciphertext)).not.toBe(0);
  });
});
