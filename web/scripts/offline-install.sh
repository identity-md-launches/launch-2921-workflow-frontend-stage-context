#!/bin/sh
# No package manager, registry/cache or node_modules is needed for the compact path.
set -eu
web_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
node "$web_dir/scripts/offline-verify.mjs"
printf '%s\n' 'Offline build: npm --prefix web run build:offline' 'Offline component tests: npm --prefix web run test:offline' 'Full typecheck/dev/browser tooling still uses the pinned npm lockfile.'
