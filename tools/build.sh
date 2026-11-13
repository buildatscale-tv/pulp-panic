#!/usr/bin/env bash
# Copies the game into dist/pulp/ so the Worker serves it under /pulp/.
# Deploy: ./tools/build.sh && wrangler deploy
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist
mkdir -p dist/pulp
cp -R public/. dist/pulp/
find dist -name .DS_Store -delete
# Revalidate on each load so new builds show at once (ETag makes this cheap).
cat > dist/_headers <<'EOF'
/pulp/*
  Cache-Control: no-cache
EOF
echo "Built dist/pulp ($(find dist/pulp -type f | wc -l | tr -d ' ') files)"
