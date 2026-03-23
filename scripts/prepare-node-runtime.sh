#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/node-runtime/bin"

if ! command -v node >/dev/null 2>&1; then
  echo "node not found in PATH"
  exit 1
fi

NODE_BIN="$(command -v node)"
mkdir -p "${OUT_DIR}"
cp "${NODE_BIN}" "${OUT_DIR}/node"
chmod +x "${OUT_DIR}/node"

echo "Prepared bundled node runtime: ${OUT_DIR}/node"
