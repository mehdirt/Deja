#!/usr/bin/env bash
# Reproducible store build: bump the version, build, and zip dist/ for upload.
# Usage:  npm run release -- <version>     e.g.  npm run release -- 0.3.1
#         (or: bash scripts/release.sh 0.3.1)
#
# package.json is the single source of truth for the version; the build injects
# it into the manifest. This does NOT commit, tag, or push — that's your call.
set -euo pipefail

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "usage: npm run release -- <version>   (e.g. 0.3.1)" >&2
  exit 1
fi
if ! printf '%s' "$VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "error: version must be semver like 0.3.1 (got '$VERSION')" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ setting version to $VERSION"
npm version "$VERSION" --no-git-tag-version >/dev/null

echo "→ building"
npm run build >/dev/null

ZIP="deja-$VERSION.zip"
rm -f "$ZIP"
echo "→ zipping dist/ → $ZIP"
( cd dist && zip -rq "../$ZIP" . )

echo "✓ $ZIP ready — upload it at the Chrome Web Store dev console."
echo "  (version is now $VERSION in package.json + built manifest; commit/tag when ready.)"
