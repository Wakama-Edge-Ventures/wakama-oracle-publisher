#!/usr/bin/env bash
set -euo pipefail
ATTEMPTS=${1:-5}
DELAY=2
for i in $(seq 1 "$ATTEMPTS"); do
  echo "try $i/$ATTEMPTS"
  if node src/publish.js; then
    exit 0
  fi
  sleep "$DELAY"
  DELAY=$((DELAY*2))
done
echo "publish failed after $ATTEMPTS attempts" >&2
exit 1
