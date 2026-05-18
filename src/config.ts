import 'dotenv/config';
import { z } from 'zod';

const Base64Key32 = z.string().refine(
  (v) => {
    try {
      return Buffer.from(v, 'base64').length === 32;
    } catch {
      return false;
    }
  },
  { message: 'ENCRYPTION_KEY must decode to exactly 32 bytes (base64). Generate with `openssl rand -base64 32`.' },
);

const ConfigSchema = z.object({
  port: z.coerce.number().int().min(0).max(65535).default(3001),
  publicUrl: z.string().url().transform((s) => s.replace(/\/$/, '')),
  encryptionKey: Base64Key32,
  sessionSecret: z.string().min(32, 'SESSION_SECRET must be at least 32 chars'),
  dataDir: z.string().min(1),
  peer39BaseUrl: z.string().url().default('https://app.peer39.com'),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Config = z.infer<typeof ConfigSchema>;

const ENV_NAMES: Record<keyof Config, string> = {
  port: 'PORT',
  publicUrl: 'PUBLIC_URL',
  encryptionKey: 'ENCRYPTION_KEY',
  sessionSecret: 'SESSION_SECRET',
  dataDir: 'DATA_DIR',
  peer39BaseUrl: 'PEER39_BASE_URL',
  logLevel: 'LOG_LEVEL',
};

function readEnv(): Readonly<Config> {
  const raw = {
    port: process.env.PORT,
    publicUrl: process.env.PUBLIC_URL,
    encryptionKey: process.env.ENCRYPTION_KEY,
    sessionSecret: process.env.SESSION_SECRET,
    dataDir: process.env.DATA_DIR,
    peer39BaseUrl: process.env.PEER39_BASE_URL,
    logLevel: process.env.LOG_LEVEL,
  };
  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[peer39-mcp-connector] FATAL: invalid configuration.');
    for (const issue of parsed.error.issues) {
      const path = issue.path[0] as keyof Config | undefined;
      const envName = path ? ENV_NAMES[path] ?? String(path) : '(unknown)';
      console.error(`  - ${envName}: ${issue.message}`);
    }
    process.exit(1);
  }
  return Object.freeze(parsed.data);
}

export const config: Readonly<Config> = readEnv();

export const mcpResourceUrl = (): string => `${config.publicUrl}/mcp`;
