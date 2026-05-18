import type { RequestHandler } from 'express';

interface Bucket {
  tokens: number;
  last: number;
}

export interface RateLimiterOptions {
  /** Sustained refill rate (tokens per minute). Default 60. */
  perMinute?: number;
  /** Max burst capacity. Default 10. */
  burst?: number;
  /** How to identify a caller. Default: req.userSub then req.ip. */
  keyFn?: (req: Parameters<RequestHandler>[0]) => string;
}

export function createRateLimiter(opts: RateLimiterOptions = {}): RequestHandler {
  const perMinute = opts.perMinute ?? 60;
  const burst = opts.burst ?? 10;
  const refillPerMs = perMinute / 60_000;
  const buckets = new Map<string, Bucket>();
  const keyFn = opts.keyFn ?? ((req) => req.userSub ?? req.ip ?? 'anonymous');

  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { tokens: burst, last: now };
      buckets.set(key, bucket);
    }
    const elapsed = now - bucket.last;
    bucket.tokens = Math.min(burst, bucket.tokens + elapsed * refillPerMs);
    bucket.last = now;
    if (bucket.tokens < 1) {
      res.set('Retry-After', '1').status(429).json({ error: 'rate_limited' });
      return;
    }
    bucket.tokens -= 1;
    next();
  };
}
