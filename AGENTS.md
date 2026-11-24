# AGENTS.md

This file provides guidance to the AI agent when working with code in this repository.

Electron desktop client for Leanote (note-taking service). Vanilla JS — no bundler, no JS build step. Node 25+ (v26 verified) + Electron 45 (devDependency). Deeper architecture notes live in @CLAUDE.md.

## Commands

```sh
npm i                           # app + build deps (Electron 45, electron-builder, less)
./build.sh less-only            # compile LESS → CSS (required before first run; output is gitignored)
cd dev && npm i && npx gulp dev # alternative: compile once, then watch (needs gulp-less 5.x on Node 25+)
npm start                       # run app (electron . --no-sandbox --disable-gpu --in-process-gpu)
npm run start:dev               # same, plus --devtools
./build.sh linux|win|android|ios # package; output goes to dist/
```

- Compiled CSS is written beside each `.less` in `public/themes/` and `public/css/` and is gitignored — the app is unstyled until you compile once.
- In containers/VMs the `--no-sandbox --disable-gpu --in-process-gpu` flags are required. If `require('electron')` returns a string instead of the API, relaunch with `env -i` as shown in README.
- Electron 42+ downloads its binary on first launch (not at install); set `ELECTRON_MIRROR` if GitHub is slow.
- No test, lint, typecheck, or CI setup. `tests/` holds ad-hoc scripts run individually, not a suite.

## Architecture

- **Two npm locations**: root = app/build deps, `dev/` = Gulp watch tooling.
- **Main process** `main.js` — windows, IPC (`db-exec`, `db-init`, `openUrl`, `quit-app`, `show-tray`, `clipboard-read-image`), `leanote://` via `protocol.handle`; main-only helpers use the `*_main.js` suffix (`src/db_main.js`, `src/pdf_main.js`, `src/clipboard_main.js`).
- **Renderer** `note.html` / `login.html` — no bundler; code is loaded via `<script>` tags, plugins via RequireJS in `public/plugins/`.
- **Startup**: always loads `note.html` first; with no active user it switches to `login.html` through the renderer's `openUrl` IPC.
- **`preload.js` is ineffective** — `contextIsolation: false` bypasses contextBridge; renderer services are globals from `<script>` tags, not `window.api` / `loadService`.
- **HTML-loaded scripts** (`src/browser/*.js`, `public/md/modern-markdown.js`): their `require()` paths resolve from the project root (`./src/...`, never `../`), and they use `var` for globals.
- **DB**: nedb in the main process, proxied via `@electron/remote` IPC (see `src/nedb_proxy.js`).
- **Security**: `nodeIntegration: true`, `contextIsolation: false` (legacy Electron patterns).
- **Config**: runtime config is the tracked `public/config.js`; `config-default.js` is a template nothing reads.
- **i18n / themes**: locales in `public/langs/`; LESS sources in `public/themes/`.

## Style

- Callback-style Node.js (little async/await).
- Global `window` objects for shared renderer state.
- Chinese comments mixed with English code; commit messages are in Chinese, one feature/fix per commit.
