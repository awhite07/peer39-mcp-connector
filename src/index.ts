#!/usr/bin/env node
import { config } from './config.js';
import { openDatabase } from './db.js';
import { buildApp } from './app.js';
import { logger } from './lib/logger.js';

const db = openDatabase();
const app = buildApp(db);

const server = app.listen(config.port, () => {
  const addr = server.address();
  const actualPort = typeof addr === 'object' && addr ? addr.port : config.port;
  logger.info(
    {
      port: actualPort,
      publicUrl: config.publicUrl,
      peer39BaseUrl: config.peer39BaseUrl,
    },
    'peer39-mcp-connector listening',
  );
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    try { db.close(); } catch { /* ignore */ }
    process.exit(0);
  });
  // Hard exit after 5s if the server didn't close cleanly.
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
