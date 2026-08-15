#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="${SITES_PROJECT_ROOT:-$(cd "${script_dir}/.." && pwd)}"
cd "${project_root}"

for candidate in dist .vinext .next .output; do
  if [[ -d "${candidate}" ]]; then
    echo "Build artifact validated: ${candidate}/"
    exit 0
  fi
done

echo "Build finished without a recognized artifact directory (dist, .vinext, .next or .output)." >&2
exit 1
