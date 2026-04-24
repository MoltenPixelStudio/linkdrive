#!/usr/bin/env bash
# Pack + push the LinkDrive Chocolatey package.
# Reads CHOCO_API_KEY (and optional CHOCO_VERSION) from packaging/chocolatey/.env
# Requires `choco` available on PATH (run on Windows or in chocolatey/choco
# Docker image: `docker run --rm -v "$(pwd):/work" -w /work chocolatey/choco …`).

set -euo pipefail

cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ -z "${CHOCO_API_KEY:-}" ]; then
  echo "error: CHOCO_API_KEY not set. Copy .env.example to .env and fill in." >&2
  exit 1
fi

# Verify the nuspec version matches what we expect, or override.
NUSPEC_VERSION=$(grep -oE '<version>[^<]+</version>' linkdrive.nuspec | sed 's/<[^>]*>//g')
VERSION=${CHOCO_VERSION:-$NUSPEC_VERSION}

if ! command -v choco >/dev/null 2>&1; then
  cat >&2 <<'MSG'
error: `choco` not found on PATH.

Run on Windows, or use the Chocolatey Docker image from this directory:

  docker run --rm -v "$(pwd):/work" -w /work \
    -e CHOCO_API_KEY="$CHOCO_API_KEY" \
    chocolatey/choco bash -c \
    "choco pack linkdrive.nuspec && \
     choco push linkdrive.${VERSION:-VERSION}.nupkg \
       --source https://push.chocolatey.org/ \
       --api-key \$CHOCO_API_KEY"
MSG
  exit 1
fi

echo "Packing linkdrive ${VERSION}…"
choco pack linkdrive.nuspec

echo "Pushing linkdrive.${VERSION}.nupkg…"
choco push "linkdrive.${VERSION}.nupkg" \
  --source https://push.chocolatey.org/ \
  --api-key "$CHOCO_API_KEY"

echo "Submitted. First-time packages enter moderator review (1–3 days)."
