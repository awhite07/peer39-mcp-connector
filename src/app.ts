import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import type { DB } from './db.js';
import { oauthRouter } from './oauth/routes.js';
import { setupRouter } from './setup/routes.js';
import { bearerAuth } from './middleware/bearer-auth.js';
import { auditLog } from './middleware/audit-log.js';
import { createRateLimiter } from './middleware/rate-limit.js';
import { handleMcpRequest } from './mcp/transport.js';
import { logger } from './lib/logger.js';

export function buildApp(db: DB): Express {
  const app = express();
  app.disable('x-powered-by');

  // Body parsers. Order matters — JSON before urlencoded so /token (form) and /mcp (json) both work.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // Security headers (apply to all responses).
  app.use((_req, res, next) => {
    res.set('Strict-Transport-Security', 'max-age=31536000');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });

  app.use(auditLog);

  // Health + index.
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/', (_req, res) => {
    res.set('Content-Type', 'text/html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Peer39 MCP Connector</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#073763;color:#fff;padding:40px;max-width:640px;margin:0 auto}h1{color:#9FC5E8}a{color:#CFE2F3}code{background:rgba(207,226,243,0.15);padding:2px 6px;border-radius:3px}</style></head>
<body>
<h1>Peer39 MCP Connector</h1>
<p>This is a remote Model Context Protocol server. Add it to Claude:</p>
<ol>
<li>Go to <a href="https://claude.ai/settings/connectors">claude.ai → Settings → Connectors</a></li>
<li>Click <b>Add custom connector</b></li>
<li>Paste: <code>${config.publicUrl}/mcp</code></li>
<li>Walk the OAuth flow and complete <a href="/setup">/setup</a> with your Peer39 credentials.</li>
</ol>
<p>Resources: <a href="/.well-known/oauth-authorization-server">AS metadata</a> · <a href="/.well-known/oauth-protected-resource">resource metadata</a></p>
</body></html>`);
  });

  // OAuth + Connector account routes.
  app.use(oauthRouter(db));

  // Setup UI for storing Peer39 credentials.
  app.use(setupRouter(db));

  // Per-user rate limiter for /mcp (after bearer-auth attaches req.userSub).
  const mcpRateLimiter = createRateLimiter({ perMinute: 60, burst: 10 });

  // MCP — bearer-gated.
  app.all('/mcp', bearerAuth, mcpRateLimiter, async (req, res) => {
    try {
      await handleMcpRequest(req, res, db);
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'mcp transport error');
      if (!res.headersSent) {
        res.status(500).json({ error: 'internal_error' });
      }
    }
  });

  // Catch-all error handler.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, 'unhandled error');
    if (res.headersSent) return;
    res.status(500).type('application/problem+json').json({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
    });
  });

  return app;
}
