#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/src/ScientificTangle.Web"
FRONTEND_DIR="$ROOT_DIR/src/ScientificTangle.Frontend"

cleanup() {
  if [ -n "${BACKEND_PID:-}" ]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

cd "$BACKEND_DIR"
dotnet run --launch-profile http &
BACKEND_PID=$!

cd "$FRONTEND_DIR"
npm install
npm run dev
