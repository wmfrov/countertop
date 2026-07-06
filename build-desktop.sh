#!/usr/bin/env bash
#
# build-desktop.sh — Package the Tally Counters web app into a macOS desktop
# app (Countertop.app / .dmg) using Pake (a Tauri wrapper).
#
# Usage:   ./build-desktop.sh
# Output:  artifacts/tally-counters/Countertop.dmg
#
# macOS only. See DESKTOP_BUILD.md for the full rationale behind each step.
#
set -euo pipefail

APP_NAME="Countertop"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$ROOT/artifacts/tally-counters"
WS="$ROOT/pnpm-workspace.yaml"

# --- prerequisites -----------------------------------------------------------
need() { command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing '$1'. $2" >&2; exit 1; }; }
need node "Install Node 18+ (e.g. 'brew install node')."
need pnpm "Install pnpm (e.g. 'npm install -g pnpm')."
need cargo "Install Rust ≥1.85 (e.g. 'brew install rust' or rustup)."
need pake  "Install Pake (e.g. 'npm install -g pake-cli')."

[ "$(uname -s)" = "Darwin" ] || { echo "❌ This script targets macOS." >&2; exit 1; }
case "$(uname -m)" in
  arm64)  DARWIN="darwin-arm64" ;;
  x86_64) DARWIN="darwin-x64"   ;;
  *) echo "❌ Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

# --- install deps with macOS native binaries (only if missing) ---------------
# The committed pnpm-workspace.yaml excludes every macOS native binary because
# the project is deployed on Replit (linux-x64). We temporarily re-enable the
# ones this Mac needs, install, then restore the file so git stays clean.
if ! ls "$ROOT"/node_modules/.pnpm/@rollup+rollup-"$DARWIN"* >/dev/null 2>&1; then
  echo "▶ Installing dependencies with $DARWIN native binaries…"
  cp "$WS" "$WS.desktopbak"
  cp "$ROOT/pnpm-lock.yaml" "$ROOT/pnpm-lock.yaml.desktopbak"
  restore() {
    [ -f "$WS.desktopbak" ] && mv "$WS.desktopbak" "$WS"
    [ -f "$ROOT/pnpm-lock.yaml.desktopbak" ] && mv "$ROOT/pnpm-lock.yaml.desktopbak" "$ROOT/pnpm-lock.yaml"
  }
  trap restore EXIT
  # Comment out the `"<pkg>-$DARWIN": "-"` exclusion lines for this arch.
  sed -i '' -E "s|^([[:space:]]*)(\"[^\"]*$DARWIN\": \"-\")|\1# \2|" "$WS"
  ( cd "$ROOT" && pnpm install --no-frozen-lockfile && pnpm rebuild esbuild )
  restore
  trap - EXIT
else
  echo "▶ macOS native binaries already installed — skipping install."
fi

# --- build the frontend ------------------------------------------------------
# base=/ (absolute) so assets resolve against Tauri's custom-protocol root, and
# so import.meta.env.BASE_URL is "/" (the app's wouter router depends on this).
echo "▶ Building frontend (BASE_PATH=/)…"
( cd "$APP" && PORT=3000 BASE_PATH=/ node_modules/.bin/vite build --config vite.config.ts )

# --- strip crossorigin from the emitted tags ---------------------------------
# WKWebView (Tauri release) can reject CORS-mode module/style fetches over the
# custom protocol, producing a blank window. Harmless to remove.
sed -i '' -E 's/ crossorigin( src=| href=)/\1/g' "$APP/dist/public/index.html"

# --- ensure npm is runnable --------------------------------------------------
# Pake rejects pnpm >10.x and falls back to npm; Homebrew's npm launcher
# sometimes lacks its executable bit, which breaks that fallback.
NPM_REAL="$(readlink -f "$(command -v npm)" 2>/dev/null || true)"
[ -n "$NPM_REAL" ] && chmod +x "$NPM_REAL" 2>/dev/null || true

# --- package with Pake -------------------------------------------------------
echo "▶ Packaging with Pake (first run compiles Rust — a few minutes)…"
( cd "$APP" && pake ./dist/public/index.html \
    --name "$APP_NAME" \
    --icon ./build-icon.png \
    --use-local-file \
    --width 1200 --height 800 )

echo ""
echo "✅ Built $APP/$APP_NAME.dmg"
echo "   Install: open '$APP/$APP_NAME.dmg' and drag $APP_NAME to /Applications."
echo "   (First launch: right-click → Open, since the app is ad-hoc signed.)"
