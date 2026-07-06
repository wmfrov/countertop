# Desktop build notes (Pake / Tauri)

Technical reference for building the **Countertop** macOS desktop app from the
`artifacts/tally-counters` web app. If you just want to build it, run
`./build-desktop.sh`. This file explains *why* each step exists so the process
can be maintained or debugged. macOS only.

## What the desktop app is

The frontend (`artifacts/tally-counters`, a static React 19 + Vite SPA, state in
`localStorage`) is the only source of truth. [Pake](https://github.com/tw93/Pake)
wraps the built `dist/` in a Tauri (Rust) shell and **embeds the assets into the
compiled binary** — so there are no loose HTML/JS files in the `.app`, and there
is no separate Rust source to maintain. Every content change requires a repackage
(fast after the first compile: crates are cached, so it's re-embed + relink).

## Prerequisites

- Node 18+ (`brew install node`)
- pnpm (`npm i -g pnpm`)
- Rust ≥ 1.85 (`brew install rust`, provides `cargo`)
- Pake (`npm i -g pake-cli`)
- Xcode Command Line Tools (`xcode-select --install`)

## The four non-obvious gotchas

Each of these individually produces a **blank/black window** or a build failure,
and each cost real debugging time. The build script handles all four.

1. **The workspace excludes macOS native binaries.** `pnpm-workspace.yaml`
   `overrides` set every `*-darwin-*` binary (rollup, esbuild, lightningcss,
   `@tailwindcss/oxide`) to `"-"` because the project is deployed on Replit
   (linux-x64). A plain `pnpm install` on a Mac therefore omits the binaries Vite
   needs. The script temporarily comments out the `darwin-<arch>` exclusions,
   installs, runs `pnpm rebuild esbuild`, then **restores** the file (backup +
   `trap`) so git stays clean. `node_modules` keeps the binaries, so subsequent
   runs skip reinstalling.

2. **Build with `BASE_PATH=/`, not `./`.** Tauri serves the frontend from its
   custom-protocol *root*, so absolute `/assets/…` is correct. Relative `./`
   also makes `import.meta.env.BASE_URL` become `"./"`, and `App.tsx` uses
   `<Router base={BASE_URL.replace(/\/$/,"")}>` → `"."`, an invalid router base
   → wouter matches nothing → blank screen.

3. **The router must match `/index.html`.** Pake loads the app via
   `WebviewUrl::App("index.html")`, so the runtime pathname is `/index.html`, not
   `/`. Without a matching route it falls through to wouter's catch-all
   ("Not Found"). `App.tsx` has an explicit `<Route path="/index.html" .../>`
   (additive; no effect on the web build). **Keep this route.**

4. **Strip `crossorigin` from the emitted `<script>`/`<link>`.** Vite emits
   `type="module" crossorigin`; Tauri's release WKWebView can reject the
   CORS-mode fetch over the custom protocol, leaving `#root` empty. The script
   removes it from the built `index.html` (harmless).

Also: Pake rejects pnpm > 10.x and falls back to `npm`; Homebrew's `npm`
launcher can lack its executable bit, which breaks the fallback — the script
`chmod +x`'s it.

## Verifying a build without launching the GUI

`screencapture` needs Screen Recording permission, so to confirm rendering
headlessly: serve `dist/public` and dump the post-JS DOM.

```bash
( cd artifacts/tally-counters/dist/public && python3 -m http.server 8848 & )
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --dump-dom http://localhost:8848/index.html \
  | grep -c 'bg-background'      # >0 means React mounted the board
```

## Workflow

Edit the frontend (in Replit or locally) → push/pull so `main` has the change →
`./build-desktop.sh` → install the new `Countertop.dmg`. Never hand-edit the
generated Tauri/Rust project under Pake's cache; it is regenerated every build.
