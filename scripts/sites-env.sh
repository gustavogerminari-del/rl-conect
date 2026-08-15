#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export SITES_PROJECT_ROOT="$(cd "${script_dir}/.." && pwd)"
export SITES_ENV_READY=1

if [[ "${1:-}" == "--" ]]; then
  shift
fi

if [[ "$#" -eq 0 ]]; then
  exit 0
fi

cd "${SITES_PROJECT_ROOT}"
exec "$@"
