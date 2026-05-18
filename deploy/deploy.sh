#!/usr/bin/env bash
# Push latest main to the droplet and restart the service.
# Matches the git-pull deploy pattern used by second-brain on the same box.
set -euo pipefail

DROPLET="${PEER39_MCP_DROPLET:-alex@174.138.92.250}"
REMOTE_DIR="/srv/peer39-mcp-connector"

echo "[deploy] target: $DROPLET:$REMOTE_DIR"

ssh "$DROPLET" "
  set -euo pipefail
  sudo -u peer39mcp git -C $REMOTE_DIR fetch --quiet origin
  sudo -u peer39mcp git -C $REMOTE_DIR reset --hard origin/main
  sudo -u peer39mcp bash -c 'cd $REMOTE_DIR && npm ci --omit=dev --quiet && npm run build'
  sudo systemctl restart peer39mcp-app.service
  sleep 2
  sudo systemctl is-active peer39mcp-app.service
"

if [ -n "${PEER39_MCP_PUBLIC_URL:-}" ]; then
  echo "[deploy] smoke test: $PEER39_MCP_PUBLIC_URL/health"
  curl -fsS "$PEER39_MCP_PUBLIC_URL/health" && echo
fi
echo "[deploy] done."
