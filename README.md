# Peer39 MCP Connector

Remote MCP server that exposes Peer39 Custom Category tools to **claude.ai web + mobile + desktop** via the Custom Connector protocol. Sibling to [`custom-category-mcp`](https://github.com/awhite07/custom-category-mcp) (the stdio version that only runs on desktop).

## What's in the box

- OAuth 2.1 Authorization Server: PKCE S256, RFC 7591 Dynamic Client Registration, RFC 8414 AS metadata, RFC 9728 Protected Resource metadata, RFC 8707 audience binding.
- Streamable HTTP MCP transport, gated by audience-bound JWT bearers.
- Per-user encrypted Peer39 credentials (AES-256-GCM, AAD = user `sub`).
- Tiny server-rendered web UI at `/setup` for credential entry — no SPA, no JS framework.
- Express + better-sqlite3 + jose + pino. Runs on Node 20+.

## Install (for a tester)

1. Open `claude.ai → Settings → Connectors → Add custom connector`.
2. Paste the public URL of the deployment (e.g. `https://peer39-mcp.example.com/mcp`).
3. Walk the OAuth flow. Pick any email + password for your Connector account (≥ 12 chars).
4. You'll land on `/setup`. Enter:
   - Peer39 username / password (from `app.peer39.com`)
   - Buyer ID (numeric, from `app.peer39.com/accounts`)
   - System name (auto-generated string from your account page)
   - Your work email (used as "last updated by" on categories)
5. Return to Claude. The Peer39 tools light up across web, mobile, and desktop.

## Tools

The Connector ships the same 9 tools as the desktop MCP minus `peer39_configure` (now replaced by the `/setup` web UI):

| Tool | Purpose |
|---|---|
| `peer39_check_setup` | Status of your saved credentials/buyer/system/email. |
| `peer39_create_category` | Create + sync a custom category to a DSP. |
| `peer39_list_categories` | List categories on your buyer account. |
| `peer39_get_category` | Fetch one category by ID. |
| `peer39_update_category` | Full overwrite of a category. |
| `peer39_update_category_details` | Patch a category's metadata (not items). |
| `peer39_update_category_items` | Patch a category's items list (append-by-default). |
| `peer39_delete_category` | Delete one or more categories. |
| `peer39_get_url_examples` | Preview URLs that match a keyword set. |

## Local dev

```bash
npm install
cp .env.example .env
# Generate keys
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
echo "SESSION_SECRET=$(openssl rand -hex 32)"   >> .env
npm run dev
```

Then in another shell:
```bash
curl -fsS http://localhost:3001/health
curl -fsS http://localhost:3001/.well-known/oauth-authorization-server | jq
```

## Tests

```bash
npm test           # all
npm test tests/unit
npm test tests/integration
npm run typecheck
```

## Deploy

See [`deploy/`](./deploy/) — runs on the shared `alex-second-brain` Digital Ocean droplet via systemd (not Docker). Caddy fronts it on `peer39-mcp.<domain>` with auto-TLS.

**One-time bootstrap on the droplet:**
```bash
ssh alex@174.138.92.250
cd /srv/peer39-mcp-connector  # cloned by setup-droplet.sh
sudo bash deploy/setup-droplet.sh
# Then create /etc/peer39-mcp/connector.env (copy from deploy/connector.env.example,
# fill ENCRYPTION_KEY + SESSION_SECRET + PUBLIC_URL), and re-run setup-droplet.sh.
```

**Per-deploy from a laptop:**
```bash
PEER39_MCP_PUBLIC_URL=https://peer39-mcp.example.com bash deploy/deploy.sh
```

## Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│  Claude (web / mobile / desktop)                            │
└────────────┬────────────────────────────────────────────────┘
             │ HTTPS
             ▼
┌────────────────────┐     ┌─────────────────────────────────┐
│  Caddy (auto-TLS)  │────▶│  Express app                    │
│  *.<domain>:443    │     │  ├─ OAuth 2.1 AS                │
└────────────────────┘     │  │  ├─ /authorize /token        │
                           │  │  ├─ /register (DCR)          │
                           │  │  └─ /.well-known/*           │
                           │  ├─ /setup (Peer39 creds UI)    │
                           │  ├─ /mcp (bearer-gated)         │
                           │  │  └─ StreamableHTTP transport │
                           │  │     └─ per-request Server    │
                           │  │        with per-user ctx     │
                           │  └─ SQLite (connector.db)       │
                           │     ├─ users                    │
                           │     ├─ peer39_credentials       │
                           │     │  (AES-256-GCM, AAD=sub)   │
                           │     └─ oauth_*                  │
                           └────────┬────────────────────────┘
                                    │ Per-user
                                    │ session-id cache
                                    ▼
                           ┌────────────────────┐
                           │  Peer39 API        │
                           │  app.peer39.com    │
                           └────────────────────┘
```

## Restore from backup

1. Stop the service: `sudo systemctl stop peer39mcp-app`.
2. Replace `/var/lib/peer39-mcp/connector.db` with the backup (`*.db.gz`).
3. Start: `sudo systemctl start peer39mcp-app`.

The `ENCRYPTION_KEY` in `/etc/peer39-mcp/connector.env` must be the same one that was active when the backup was taken — otherwise every stored credential row will fail AAD verification on decrypt.

## Rotate the encryption key

Out of scope for v1. To rotate manually:
1. Generate a new key.
2. Write a one-shot migration script that decrypts every `peer39_credentials` row with the OLD key, re-encrypts with the new key, and updates the row. Run it under a maintenance window.
3. Swap `ENCRYPTION_KEY` in `/etc/peer39-mcp/connector.env`.
4. Restart.

## Security model

- All HTTP traffic terminates TLS at Caddy.
- The OAuth 2.1 access token is a JWT signed with RS256, audience-bound to `<PUBLIC_URL>/mcp`. Tokens with the wrong `aud` are rejected by the bearer middleware.
- Peer39 credentials are AES-256-GCM encrypted at rest. The user's `sub` (Anthropic-issued subject we mint at OAuth time) is the additional-authenticated-data, so swapping a row across users fails decryption.
- The `ENCRYPTION_KEY` master key is 32 random bytes, base64-encoded, read at startup from the env file. It must be backed up out-of-band.
- The Connector account password is hashed with argon2 before storage.
- OAuth authorization codes are single-use and expire in 60 seconds.
- Refresh tokens are stored as SHA-256 hashes and rotated on every exchange.
- Per-user rate limit on `/mcp`: 60 req/min, burst 10.

## License

UNLICENSED — internal Peer39 beta.
