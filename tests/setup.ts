// Global vitest setup. Sets required env so config.ts loads cleanly.
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'peer39-mcp-connector-test-'));
mkdirSync(tmp, { recursive: true });

process.env.PORT = process.env.PORT || '0';
// http (not https) so supertest's cookie jar will send back our session cookie
// — its requests go over plain HTTP and `secure` cookies would be filtered.
process.env.PUBLIC_URL = process.env.PUBLIC_URL || 'http://peer39-mcp.test';
process.env.DATA_DIR = process.env.DATA_DIR || tmp;
// 32 bytes base64 (44 chars). openssl rand -base64 32:
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQ=';
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ||
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.PEER39_BASE_URL = process.env.PEER39_BASE_URL || 'https://app.peer39.com';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'fatal';
