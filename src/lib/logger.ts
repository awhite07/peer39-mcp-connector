import pino from 'pino';
import { config } from '../config.js';

// Structured JSON logs to stderr so stdout is reserved if anything ever needs it.
export const logger = pino({
  level: config.logLevel,
  base: { service: 'peer39-mcp-connector' },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Belt-and-suspenders: redact anything that smells like a credential.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.client_secret',
      'req.body.code_verifier',
      'req.body.refresh_token',
      'req.body.username',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
}, pino.destination({ dest: 2, sync: false }));
