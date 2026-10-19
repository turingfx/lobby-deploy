#!/usr/bin/env bash
# Lobby server deployment on the relay host. Idempotent; safe to re-run.
set -euo pipefail
cd "$HOME"

echo "== 1. clone deploy files =="
rm -rf lobby-deploy
git clone -q --depth 1 https://github.com/turingfx/lobby-deploy.git lobby-deploy

echo "== 2. rebuild viewer dist (fixed recipe: no NODE_ENV=production define) =="
cd ~/oh-my-pi/packages/collab-web
rm -rf dist-fix
~/.local/bin/bun build ./index.html --outdir=dist-fix \
	'--entry-naming=[hash].[ext]' '--chunk-naming=[hash].[ext]' '--asset-naming=[hash].[ext]'
mv dist-fix/*.html dist-fix/index.html
cp -R public/. dist-fix/

echo "== 3. install: dist -> ~/collab-relay/dist, lobby page alongside =="
rm -rf ~/collab-relay/dist
cp -R dist-fix ~/collab-relay/dist
cp ~/lobby-deploy/lobby.html ~/collab-relay/dist/

echo "== 4. (re)start lobby services =="
pkill -f 'bun bridge.ts' 2>/dev/null || true
pkill -f 'bun anchor.ts' 2>/dev/null || true
pkill -f 'bun mock-reporter.ts' 2>/dev/null || true
sleep 1
mkdir -p ~/collab-lobby
cp ~/lobby-deploy/{bridge.ts,anchor.ts,mock-reporter.ts} ~/collab-lobby/
cd ~/collab-lobby
nohup ~/.local/bin/bun bridge.ts > bridge.log 2>&1 &
sleep 2
RELAY_WS=ws://127.0.0.1:17443 nohup ~/.local/bin/bun anchor.ts > anchor.log 2>&1 &
sleep 1
RELAY_WS=ws://127.0.0.1:17443 nohup ~/.local/bin/bun mock-reporter.ts > mock.log 2>&1 &
sleep 2
echo "-- bridge.log --"; tail -2 bridge.log
echo "-- anchor.log --"; tail -2 anchor.log
echo "-- mock.log --"; tail -2 mock.log
curl -sk --max-time 5 https://127.0.0.1:8443/healthz && echo " relay-ok"
echo "== DEPLOY-DONE =="
