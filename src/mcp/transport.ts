import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { DB } from '../db.js';
import { buildServerForUser } from './server.js';

// We build a per-request transport + Server pair. The SDK's StreamableHTTPServerTransport
// supports both stateless (one per request) and stateful (session-bound) modes.
// For per-user isolation with a small request volume, stateless is simplest and safest.

export async function handleMcpRequest(req: Request, res: Response, db: DB): Promise<void> {
  const userSub = req.userSub;
  if (!userSub) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });

  // Best-effort cleanup. The SDK will also close the transport when the response ends.
  res.on('close', () => {
    transport.close().catch(() => {});
  });

  const server = buildServerForUser({ userSub, db });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
