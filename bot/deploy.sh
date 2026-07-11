#!/bin/bash
set -e

VPS="root@161.97.100.134"
REMOTE_DIR="/opt/cato-bot"

echo "Building TypeScript..."
npm run build

echo "Syncing to VPS..."
rsync -avz --exclude node_modules --exclude .env --exclude .git \
  ./ "$VPS:$REMOTE_DIR/"

echo "Installing dependencies on VPS..."
ssh "$VPS" "cd $REMOTE_DIR && npm install --production"

echo "Installing systemd service..."
ssh "$VPS" "cp $REMOTE_DIR/cato-bot.service /etc/systemd/system/ && \
  systemctl daemon-reload && \
  systemctl enable cato-bot && \
  systemctl restart cato-bot"

echo "Checking status..."
ssh "$VPS" "systemctl status cato-bot --no-pager"

echo "Done! Bot is running."
