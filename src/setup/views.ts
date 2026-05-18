function escapeHtml(s: string | number | undefined): string {
  if (s === undefined || s === null) return '';
  const str = String(s);
  return str.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' :
    c === '<' ? '&lt;' :
    c === '>' ? '&gt;' :
    c === '"' ? '&quot;' : '&#39;',
  );
}

const CSS = `
body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #073763; color: #fff; margin: 0; padding: 40px; }
.card { background: #fff; color: #073763; max-width: 520px; margin: 60px auto; padding: 32px; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
h1 { margin-top: 0; color: #073763; }
p { line-height: 1.5; }
label { display: block; margin: 14px 0 4px; font-weight: 600; }
input { width: 100%; padding: 8px; border: 1px solid #9FC5E8; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
input:focus { outline: 2px solid #3D85C6; border-color: #3D85C6; }
button { background: #3D85C6; color: #fff; border: 0; padding: 10px 20px; border-radius: 4px; font-size: 16px; cursor: pointer; margin-top: 20px; }
button:hover { background: #073763; }
.err { color: #B54F6F; margin: 16px 0; padding: 12px; background: rgba(181, 79, 111, 0.1); border-radius: 4px; }
.banner { color: #073763; background: #CFE2F3; padding: 12px; border-radius: 4px; margin-bottom: 16px; }
.muted { color: #757575; font-size: 13px; }
.success { color: #8CBA51; font-size: 18px; font-weight: 600; }
`;

export interface SetupPageOpts {
  email: string;
  buyerId?: number;
  system?: string;
  userEmail: string;
  error: string | null;
  alreadyConfigured: boolean;
}

export function renderSetupPage(opts: SetupPageOpts): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Peer39 setup — MCP Connector</title>
<style>${CSS}</style></head><body>
<div class="card">
<h1>Peer39 setup</h1>
<p>Signed in as <b>${escapeHtml(opts.email)}</b>. Provide your Peer39 credentials and account info. We store the credentials encrypted at rest (AES-256-GCM, scoped to your account).</p>
${opts.alreadyConfigured ? `<div class="banner">You already have credentials saved. Submitting this form will <b>overwrite</b> them.</div>` : ''}
${opts.error ? `<div class="err">${escapeHtml(opts.error)}</div>` : ''}
<form method="POST" action="/setup" autocomplete="off">
  <label>Peer39 username</label><input type="text" name="username" autocomplete="off" required>
  <label>Peer39 password</label><input type="password" name="password" autocomplete="new-password" required>
  <label>Buyer ID <span class="muted">(numeric, from app.peer39.com/accounts)</span></label>
  <input type="number" name="buyerId" min="1" value="${escapeHtml(opts.buyerId)}" required>
  <label>System name <span class="muted">(auto-generated string from your account page)</span></label>
  <input type="text" name="system" value="${escapeHtml(opts.system)}" required>
  <label>Your work email <span class="muted">(attached to categories as "last updated by")</span></label>
  <input type="email" name="userEmail" value="${escapeHtml(opts.userEmail)}" required>
  <button type="submit">Save</button>
</form>
<p class="muted">Your password is sent over TLS, encrypted with a per-account nonce, and never written to logs.</p>
</div>
</body></html>`;
}

export function renderSuccessPage(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Setup complete</title>
<style>${CSS}</style></head><body>
<div class="card">
<h1>You're all set</h1>
<p class="success">Peer39 credentials saved and verified.</p>
<p>Close this tab and return to Claude. Your Peer39 MCP tools are ready to use.</p>
<p class="muted">If you ever need to update your credentials, come back to <code>/setup</code>.</p>
</div>
</body></html>`;
}
