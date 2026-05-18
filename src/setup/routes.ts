import express, { type Router } from 'express';
import { config } from '../config.js';
import type { DB } from '../db.js';
import { SetupFormSchema } from '../peer39/validation.js';
import { upsertPeer39Credentials, readCredentialContext } from '../peer39/credentials.js';
import { readSession } from '../oauth/session.js';
import { renderSetupPage, renderSuccessPage } from './views.js';

interface ProbeResult {
  ok: boolean;
  status?: number;
  message?: string;
}

async function probePeer39Login(username: string, password: string): Promise<ProbeResult> {
  try {
    const res = await fetch(`${config.peer39BaseUrl}/api/external/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      redirect: 'manual',
    });
    if (res.status === 200) {
      const body = (await res.json().catch(() => null)) as { result?: { sessionId?: string } } | null;
      if (body?.result?.sessionId) return { ok: true, status: 200 };
      return { ok: false, status: 200, message: 'Peer39 login responded 200 but no sessionId was returned.' };
    }
    if (res.status === 401) {
      return { ok: false, status: 401, message: 'Peer39 rejected those credentials (401).' };
    }
    return { ok: false, status: res.status, message: `Peer39 login returned HTTP ${res.status}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'network error reaching Peer39' };
  }
}

export function setupRouter(db: DB): Router {
  const router = express.Router();

  router.get('/setup', (req, res) => {
    const session = readSession(req);
    if (!session?.sub) {
      return res.redirect(`/login?next=${encodeURIComponent('/setup')}`);
    }
    const existing = readCredentialContext(db, session.sub);
    res.set('Content-Type', 'text/html').send(renderSetupPage({
      email: session.email ?? '',
      buyerId: existing?.buyerId,
      system: existing?.system,
      userEmail: existing?.userEmail ?? session.email ?? '',
      error: null,
      alreadyConfigured: Boolean(existing),
    }));
  });

  router.post('/setup', async (req, res) => {
    const session = readSession(req);
    if (!session?.sub) {
      return res.redirect(`/login?next=${encodeURIComponent('/setup')}`);
    }
    const parsed = SetupFormSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return res.set('Content-Type', 'text/html').status(400).send(renderSetupPage({
        email: session.email ?? '',
        buyerId: typeof req.body.buyerId === 'string' ? Number(req.body.buyerId) || undefined : undefined,
        system: typeof req.body.system === 'string' ? req.body.system : undefined,
        userEmail: typeof req.body.userEmail === 'string' ? req.body.userEmail : '',
        error: `Form validation failed — ${msg}`,
        alreadyConfigured: false,
      }));
    }
    const data = parsed.data;
    const probe = await probePeer39Login(data.username, data.password);
    if (!probe.ok) {
      return res.set('Content-Type', 'text/html').status(400).send(renderSetupPage({
        email: session.email ?? '',
        buyerId: data.buyerId,
        system: data.system,
        userEmail: data.userEmail,
        error: probe.message ?? 'Peer39 rejected those credentials.',
        alreadyConfigured: false,
      }));
    }

    upsertPeer39Credentials(db, session.sub, {
      username: data.username,
      password: data.password,
      buyerId: data.buyerId,
      system: data.system,
      userEmail: data.userEmail,
    });

    // Zero the plaintext fields out of req.body so they don't linger in any
    // downstream logger that ignores our redact list.
    if (typeof req.body === 'object' && req.body) {
      (req.body as Record<string, unknown>).password = '[CLEARED]';
      (req.body as Record<string, unknown>).username = '[CLEARED]';
    }

    res.set('Content-Type', 'text/html').send(renderSuccessPage());
  });

  return router;
}
