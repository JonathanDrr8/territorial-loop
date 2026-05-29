#!/usr/bin/env bash
# Liest die gesammelten Feedback-/Bug-Reports vom gehosteten Server (JSONL, neueste zuletzt).
set -euo pipefail

PVE="${PVE_HOST:-192.168.188.64}"
CTID="${CT_ID:-307}"

raw="$(ssh root@"$PVE" "pct exec $CTID -- cat /app/feedback/feedback.jsonl 2>/dev/null" || true)"
if [ -z "$raw" ]; then
  echo "(noch kein Feedback)"
  exit 0
fi
if command -v jq >/dev/null 2>&1; then
  echo "$raw" | jq -r '"[\(.ts)] \(.kind | ascii_upcase) (v\(.version)): \(.text)"'
else
  echo "$raw"
fi
