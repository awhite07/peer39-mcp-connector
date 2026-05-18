import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { logger } from '../lib/logger.js';

declare module 'express-serve-static-core' {
  interface Request {
    reqId?: string;
  }
}

export const auditLog: RequestHandler = (req, res, next) => {
  const start = Date.now();
  const reqId = randomUUID();
  req.reqId = reqId;
  res.setHeader('x-request-id', reqId);
  res.on('finish', () => {
    logger.info({
      req_id: reqId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: Date.now() - start,
      user_sub: req.userSub,
      client_id: req.clientId,
    });
  });
  next();
};
