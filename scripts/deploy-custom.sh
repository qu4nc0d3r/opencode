#!/usr/bin/env bash
# Deploy the latest custom-fs build to the VPS.
#
# Prereqs: gh (logged in), ssh/scp access to the VPS as root.
# Usage:   bash scripts/deploy-custom.sh
#
# Steps: download the newest custom-build artifact, upload it, swap the
# binary (keeping /usr/bin/opencode.bak), restart the service, print status.
set -euo pipefail

REPO=qu4nc0d3r/opencode
WORKFLOW=custom-build.yml
BRANCH=custom-fs
VPS_HOST=160.187.240.56
VPS_PORT=25901
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

echo "==> locating latest successful run on $BRANCH"
RUN=$(gh run list --repo "$REPO" --workflow "$WORKFLOW" --branch "$BRANCH" --status success --limit 1 \
  --json databaseId --jq '.[0].databaseId')
echo "    run $RUN"

echo "==> downloading artifact"
gh run download "$RUN" --repo "$REPO" -n opencode-linux-x64 -D "$WORKDIR"
ls -la "$WORKDIR/opencode"

echo "==> uploading to VPS"
scp -P "$VPS_PORT" "$WORKDIR/opencode" "root@$VPS_HOST:/tmp/opencode-custom-bin"

echo "==> swapping binary and restarting"
ssh -p "$VPS_PORT" "root@$VPS_HOST" '
  set -e
  cp /usr/bin/opencode /usr/bin/opencode.bak
  install -m 755 /tmp/opencode-custom-bin /usr/bin/opencode
  systemctl restart opencode-web
  sleep 5
  systemctl is-active opencode-web
  /usr/bin/opencode --version
'

echo "==> done. Rollback: cp /usr/bin/opencode.bak /usr/bin/opencode && systemctl restart opencode-web"
