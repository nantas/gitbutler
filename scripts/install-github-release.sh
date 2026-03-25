#!/bin/sh

set -eu

usage() {
  cat <<'EOF'
Install or update but from a GitHub Release tag.

Usage:
  install-github-release.sh --repo <owner/repo> --version <tag> [--bin-dir <path>]

Examples:
  install-github-release.sh --repo my-org/gitbutler --version v0.21.0
  install-github-release.sh --repo my-org/gitbutler --version v0.21.0-rc.1
EOF
}

error() {
  echo "Error: $*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || error "Required command '$1' not found"
}

REPO=""
TAG=""
BIN_DIR="${HOME}/.local/bin"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --repo)
      [ "$#" -ge 2 ] || error "Missing value for --repo"
      REPO="$2"
      shift 2
      ;;
    --version)
      [ "$#" -ge 2 ] || error "Missing value for --version"
      TAG="$2"
      shift 2
      ;;
    --bin-dir)
      [ "$#" -ge 2 ] || error "Missing value for --bin-dir"
      BIN_DIR="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      error "Unknown argument: $1"
      ;;
  esac
done

[ -n "$REPO" ] || error "--repo is required"
[ -n "$TAG" ] || error "--version is required"

case "$REPO" in
  */*) ;;
  *) error "--repo must be in owner/repo format" ;;
esac

need_cmd curl
need_cmd tar
need_cmd awk
need_cmd grep
need_cmd mktemp

if command -v sha256sum >/dev/null 2>&1; then
  HASH_CMD="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
  HASH_CMD="shasum -a 256"
else
  error "Required command 'sha256sum' or 'shasum' not found"
fi

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux) OS_NAME="linux" ;;
  Darwin) OS_NAME="macos" ;;
  *) error "Unsupported OS: $OS (supported: Linux, Darwin)" ;;
esac

case "$ARCH" in
  x86_64|amd64) ARCH_NAME="x86_64" ;;
  arm64|aarch64) ARCH_NAME="aarch64" ;;
  *) error "Unsupported architecture: $ARCH (supported: x86_64, arm64/aarch64)" ;;
esac

PLATFORM="${OS_NAME}-${ARCH_NAME}"
ASSET_NAME="but-${TAG}-${PLATFORM}.tar.gz"
CHECKSUMS_NAME="checksums-${TAG}.txt"
BASE_URL="https://github.com/${REPO}/releases/download/${TAG}"
ASSET_URL="${BASE_URL}/${ASSET_NAME}"
CHECKSUMS_URL="${BASE_URL}/${CHECKSUMS_NAME}"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/but-install.XXXXXX")"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

ARCHIVE_PATH="${TMP_DIR}/${ASSET_NAME}"
CHECKSUMS_PATH="${TMP_DIR}/${CHECKSUMS_NAME}"

echo "Downloading ${ASSET_NAME} ..."
curl --fail --silent --show-error --location --output "$ARCHIVE_PATH" "$ASSET_URL"
curl --fail --silent --show-error --location --output "$CHECKSUMS_PATH" "$CHECKSUMS_URL"

EXPECTED="$(grep " ${ASSET_NAME}\$" "$CHECKSUMS_PATH" | awk '{print $1}')"
[ -n "$EXPECTED" ] || error "No checksum found for ${ASSET_NAME}"

ACTUAL="$($HASH_CMD "$ARCHIVE_PATH" | awk '{print $1}')"
[ "$EXPECTED" = "$ACTUAL" ] || error "Checksum mismatch for ${ASSET_NAME}"

mkdir -p "$TMP_DIR/unpack"
tar -xzf "$ARCHIVE_PATH" -C "$TMP_DIR/unpack"
[ -f "$TMP_DIR/unpack/but" ] || error "Archive does not contain 'but' binary"

mkdir -p "$BIN_DIR"
install -m 0755 "$TMP_DIR/unpack/but" "$BIN_DIR/but"

echo "Installed to: $BIN_DIR/but"
"$BIN_DIR/but" --version
