# peer39-mcp-connector

Remote MCP Connector for Claude (web + mobile + desktop). Hosted at `https://mcp-connector.scatter-brain.ai` on the shared `alex-second-brain` DigitalOcean droplet (`174.138.92.250`).

## Scope — stay inside this project

This project is self-contained. When Claude Code runs from this directory, stay within `peer39-mcp-connector/` and its subdirectories.
Do NOT read, list, search, import from, create, or modify files in any sibling project or parent directory — not via file tools, not via Bash (`ls ..`, `cat ../x`, `find`/`grep` rooted above this directory), not via subagents — unless Alex asks in the current conversation. If a task seems to need something outside, stop and ask first, naming the path. Full rule: **Project Isolation** in `/Volumes/Storage/ai-tools/CLAUDE.md`.

**Exceptions** (read literally — named paths only, read-only unless stated):
- Workspace-level: recording memories via `node /Volumes/Storage/ai-tools/mem0-cli.js ...`, appending to this project's second-brain file (`/Volumes/Storage/ai-tools/second-brain/projects/peer39-mcp-connector.md`), and reading workspace-root shared modules (`cli_status.py`, `peer39_brand_colors.py`, `peer39_brand_colors.js`, logos)

## Auto-deploy on push — REQUIRED

**After every successful `git push` from this repo, immediately run:**

```bash
PEER39_MCP_PUBLIC_URL=https://mcp-connector.scatter-brain.ai bash deploy/deploy.sh
```

(Or the bare `bash deploy/deploy.sh` if a smoke test is not needed.)

**Why:** pushing to GitHub does not update the running droplet. The deploy script SSHes to the droplet, pulls origin/main into `/srv/peer39-mcp-connector`, `npm ci`, `npm run build`, and `systemctl restart peer39mcp-app.service`. Skipping it ships stale code — the repo says the change is in, but the live service is unchanged.

If the harness safety classifier blocks the SSH (production-deploy flag), tell the user and wait for re-approval. Do not silently skip. The deploy script is idempotent — safe to re-run after a manual finish.

## Stack & deploy

- Node 20+, Express, SQLite (better-sqlite3), JWT (jose), AES-256-GCM at-rest creds
- OAuth 2.1 AS: DCR (RFC 7591), AS metadata (RFC 8414), PR metadata (RFC 9728), PKCE S256, RFC 8707 audience binding
- Deployed unit: `peer39mcp-app.service` (systemd, `MemoryMax=256M`, runs as user `peer39mcp`)
- Reverse proxy: Caddy → `mcp-connector.scatter-brain.ai`
- Remote dir: `/srv/peer39-mcp-connector` (owned by `peer39mcp`; `alex` SSH user must `sudo -u peer39mcp` for any operation inside it, including `cd`)

## Coexistence on droplet

The droplet also runs second-brain (production-critical) and the trading scanner. Any setup/deploy script in this repo must:
- Be idempotent.
- Never touch ufw defaults (only `sudo ufw allow 80,443/tcp`).
- Use the `peer39mcp-` service prefix exclusively.
- Honor the `MemoryMax=256M`, `MemoryHigh=200M`, `CPUQuota=50%` resource budget.
