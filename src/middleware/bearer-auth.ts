import type { RequestHandler } from 'express';
import { config, mcpResourceUrl } from '../config.js';
import { verifyAccessToken } from '../oauth/tokens.js';

declare module 'express-serve-static-core' {
  interface Request {
    userSub?: string;
    clientId?: string;
  }
}

function unauthorized(res: Parameters<RequestHandler>[1], reason: string): void {
  const metaUrl = `${config.publicUrl}/.well-known/oauth-protected-resource`;
  res
    .status(401)
    .set('WWW-Authenticate', `Bearer error="invalid_token", error_description="${reason}", resource_metadata="${metaUrl}"`)
    .end();
}

export const bearerAuth: RequestHandler = async (req, res, next) => {
  const auth = req.header('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/);
  if (!match) {
    return unauthorized(res, 'missing bearer');
  }
  try {
    const claims = await verifyAccessToken(match[1]);
    if (claims.aud !== mcpResourceUrl()) {
      return unauthorized(res, 'audience mismatch');
    }
    req.userSub = claims.sub;
    req.clientId = claims.client_id;
    next();
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'verification failed';
    return unauthorized(res, reason);
  }
};
