# Countertop — Tally Counters

A customizable multi-counter board. Add or remove counters, set each one's label,
color, and font, adjust the number height, and everything persists locally
(`localStorage`). Runs as a web app and as a native macOS desktop app.

The app lives in [`artifacts/tally-counters/`](artifacts/tally-counters) — a
static **React 19 + Vite** SPA with no backend.

## Develop (web)

```bash
pnpm install
pnpm --filter @workspace/tally-counters run dev   # Vite dev server
```

> Note: this repo is a Replit-originated pnpm workspace configured for
> **linux-x64**. Building on macOS needs the platform's native binaries
> re-enabled — `build-desktop.sh` handles that automatically. See
> [DESKTOP_BUILD.md](DESKTOP_BUILD.md).

## Build the macOS desktop app

Wraps the built frontend into `Countertop.app` with [Pake](https://github.com/tw93/Pake)
(a Tauri shell). **macOS only.**

```bash
./build-desktop.sh
```

Output: `artifacts/tally-counters/Countertop.dmg`. Open it and drag **Countertop**
to `/Applications`. On first launch, right-click → **Open** (the app is ad-hoc
signed, not notarized).

**Prerequisites:** Node 18+, pnpm, Rust ≥ 1.85, and `pake-cli`
(`npm i -g pake-cli`), plus Xcode Command Line Tools. The first build compiles
Rust and takes a few minutes; later builds are fast.

## Typical workflow

The frontend is the single source of truth; the desktop app is just a build
artifact. So:

1. Edit the app (in Replit or locally) and commit.
2. Make sure `main` has the change (`git push` / `git pull`).
3. `./build-desktop.sh` to produce an updated `Countertop.dmg`.

## Repo layout

- `artifacts/tally-counters/` — the app (`src/App.tsx` is the whole UI)
- `artifacts/tally-counters/build-icon.svg` / `.png` — desktop app icon source
- `build-desktop.sh` — one-command desktop packaging
- `DESKTOP_BUILD.md` — how/why the desktop build works (gotchas, verification)

## License

[MIT](LICENSE)
