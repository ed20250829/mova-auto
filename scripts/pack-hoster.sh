#!/usr/bin/env bash
# Builds hoster.by zips: prebuilt dist + slim runtime deps (no Astro build on server).
# - mova-auto-hoster.zip         — full (includes seeded data/mova.db) for first deploy
# - mova-auto-hoster-update.zip  — no database (safe for redeploys)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/dist-hoster"
FULL_ZIP="$ROOT/mova-auto-hoster.zip"
UPDATE_ZIP="$ROOT/mova-auto-hoster-update.zip"

cd "$ROOT"
npm run build
npm run db:seed

rm -rf "$OUT_DIR" "$FULL_ZIP" "$UPDATE_ZIP"
mkdir -p "$OUT_DIR/data"

cp -R "$ROOT/dist" "$OUT_DIR/dist"
cp "$ROOT/server.mjs" "$OUT_DIR/server.mjs"
cp "$ROOT/.env.example" "$OUT_DIR/.env.example"
touch "$OUT_DIR/data/.gitkeep"

if [[ -f "$ROOT/data/mova.db" ]]; then
  cp "$ROOT/data/mova.db" "$OUT_DIR/data/mova.db"
fi

cat > "$OUT_DIR/package.json" <<'EOF'
{
  "name": "mova-auto",
  "type": "module",
  "version": "1.0.0",
  "private": true,
  "engines": {
    "node": ">=22.23.4"
  },
  "scripts": {
    "start": "node server.mjs",
    "ispmanager-custom-command": "node ./server.mjs"
  },
  "dependencies": {
    "@oslojs/encoding": "1.1.0",
    "better-sqlite3": "13.0.3",
    "clsx": "2.1.1",
    "cookie": "2.0.2",
    "devalue": "6.0.3",
    "drizzle-orm": "0.45.4",
    "html-escaper": "3.0.3",
    "mrmime": "2.0.1",
    "piccolore": "0.1.3",
    "picomatch": "4.0.7",
    "react": "19.3.1",
    "react-dom": "19.3.1",
    "recharts": "3.10.1",
    "send": "1.2.1",
    "server-destroy": "1.0.1",
    "ultrahtml": "1.7.0",
    "unstorage": "1.17.6",
    "zod": "4.6.7"
  }
}
EOF

(
  cd "$OUT_DIR"
  zip -r "$FULL_ZIP" . -x '*.DS_Store' -x '**/.DS_Store'
  zip -r "$UPDATE_ZIP" . -x '*.DS_Store' -x '**/.DS_Store' -x 'data/mova.db'
)

rm -rf "$OUT_DIR"
echo "Created:"
ls -lh "$FULL_ZIP" "$UPDATE_ZIP"
