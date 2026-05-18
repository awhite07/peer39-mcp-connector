#!/usr/bin/env bash
# Idempotent bootstrap for the Peer39 MCP Connector on the shared alex-second-brain droplet.
# SAFE TO RE-RUN. Touches nothing under /srv/secondbrain*, /var/log/secondbrain*,
# /var/log/trading*, or /etc/systemd/system/secondbrain-*.
set -euo pipefail

REPO_URL="${PEER39_MCP_REPO:-https://github.com/awhite07/peer39-mcp-connector.git}"
APP_DIR="/srv/peer39-mcp-connector"
DATA_DIR="/var/lib/peer39-mcp"
LOG_DIR="/var/log/peer39-mcp"
ETC_DIR="/etc/peer39-mcp"
SYSTEMD_UNIT="/etc/systemd/system/peer39mcp-app.service"
CADDY_SITE="/etc/caddy/Caddyfile.d/peer39-mcp.conf"
EXPECTED_HOST="alex-second-brain"

log() { printf '[setup] %s\n' "$*"; }
ok()  { printf '[setup] ✓ %s\n' "$*"; }
skip(){ printf '[setup] - %s\n' "$*"; }

# 1. Host check — bail loudly if we're on the wrong machine.
if [ "$(hostname)" != "$EXPECTED_HOST" ]; then
  echo "[setup] FATAL: hostname is $(hostname); expected $EXPECTED_HOST. Aborting to protect the wrong machine." >&2
  exit 2
fi
ok "host check: $(hostname)"

# 2. 1 GB swap if no swap exists (RAM is tight).
SWAP_TOTAL=$(free -m | awk '/Swap:/ {print $2}')
if [ "$SWAP_TOTAL" = "0" ]; then
  log "no swap detected — creating /swapfile (1 GB)"
  sudo fallocate -l 1G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  sudo sysctl vm.swappiness=10 >/dev/null
  grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf >/dev/null
  ok "swap configured (1 GB, swappiness=10)"
else
  skip "swap already present (${SWAP_TOTAL} MB)"
fi

# 3. UFW: allow 80/443. NEVER ufw disable, NEVER change defaults.
if command -v ufw >/dev/null 2>&1; then
  STATUS=$(sudo ufw status | head -1)
  log "ufw status: $STATUS"
  sudo ufw allow 80/tcp >/dev/null
  sudo ufw allow 443/tcp >/dev/null
  ok "ufw: 80/tcp and 443/tcp allowed"
else
  skip "ufw not installed (?) — skipping firewall rules"
fi

# 4. System user.
if getent passwd peer39mcp >/dev/null; then
  skip "user peer39mcp already exists"
else
  sudo useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin peer39mcp
  ok "created user peer39mcp"
fi

# 5. Directories.
sudo install -d -m 0750 -o peer39mcp -g peer39mcp "$APP_DIR" "$DATA_DIR" "$LOG_DIR"
sudo install -d -m 0750 -o root      -g peer39mcp "$ETC_DIR"
ok "directories present: $APP_DIR, $DATA_DIR, $LOG_DIR, $ETC_DIR"

# 6. Node 20.
NODE_VERSION=$(node --version 2>/dev/null || echo 'none')
if echo "$NODE_VERSION" | grep -qE '^v(20|21|22|23)\.'; then
  skip "node already installed: $NODE_VERSION"
else
  log "installing Node 20 LTS via NodeSource"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ok "node installed: $(node --version)"
fi

# 7. Caddy.
if command -v caddy >/dev/null 2>&1; then
  skip "caddy already installed: $(caddy version | head -1)"
else
  log "installing Caddy from official stable apt repo"
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y caddy
  ok "caddy installed"
fi

# 8. Caddyfile.d/ + ensure top-level Caddyfile imports it.
sudo install -d -m 0755 -o root -g root /etc/caddy/Caddyfile.d
if [ -f /etc/caddy/Caddyfile ] && ! grep -q 'import Caddyfile.d/' /etc/caddy/Caddyfile; then
  log "adding 'import Caddyfile.d/*' to /etc/caddy/Caddyfile"
  sudo sed -i '1i import Caddyfile.d/*\n' /etc/caddy/Caddyfile
  ok "Caddyfile updated to import Caddyfile.d/"
else
  skip "Caddyfile already imports Caddyfile.d/ (or doesn't exist)"
fi

# 9. Clone repo if directory empty.
if [ ! -d "$APP_DIR/.git" ]; then
  log "cloning $REPO_URL into $APP_DIR"
  sudo -u peer39mcp git clone "$REPO_URL" "$APP_DIR"
  ok "repo cloned"
else
  skip "$APP_DIR already a git checkout"
fi

# 10. Install systemd unit + Caddy site file.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
sudo install -m 0644 -o root -g root "$SCRIPT_DIR/peer39mcp-app.service" "$SYSTEMD_UNIT"
sudo install -m 0644 -o root -g root "$SCRIPT_DIR/Caddyfile.d/peer39-mcp.conf" "$CADDY_SITE"
ok "systemd unit + Caddy site file installed"

# 11. Verify env file exists. We never create it automatically — operator-managed.
if [ ! -f "$ETC_DIR/connector.env" ]; then
  echo "[setup] WARNING: $ETC_DIR/connector.env is missing." >&2
  echo "[setup] Copy deploy/connector.env.example there, fill in ENCRYPTION_KEY + SESSION_SECRET + PUBLIC_URL, then re-run this script." >&2
  echo "[setup] Skipping systemctl enable until the env file is present." >&2
else
  ok "env file present at $ETC_DIR/connector.env"
  sudo systemctl daemon-reload
  sudo systemctl enable --now peer39mcp-app.service
  ok "peer39mcp-app.service enabled and started"
fi

# 12. Reload Caddy (only if its config validates).
if sudo caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
  sudo systemctl reload caddy
  ok "caddy reloaded"
else
  echo "[setup] WARNING: /etc/caddy/Caddyfile does not validate — leaving Caddy untouched. Inspect $CADDY_SITE." >&2
fi

echo
ok "setup complete. Smoke test: curl -fsS https://$(grep -oP 'PUBLIC_URL=\K.*' $ETC_DIR/connector.env 2>/dev/null | sed 's|https\?://||')/health"
