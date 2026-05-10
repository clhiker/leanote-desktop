# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Leanote Desktop is an Electron-based note-taking app (desktop client for the open-source Leanote service). Migrated from NW.js to Electron. Uses jQuery + Bootstrap for UI, NeDB for local storage, TinyMCE/Ace/markdown-it for editors.

## Known Issues & Fixes Applied

### require() paths in browser/ service files

`src/browser/service.js` and `src/browser/service_login.js` are loaded via `<script>` tags in the HTML files. Electron resolves `require()` paths relative to the **HTML file location** (project root), not the script file's own directory. Always use `./src/...` format, not `../` format.

These files also use `var` (not `const`) for global variables since they're loaded as inline scripts.

### Dark theme white background

The night theme had several white background issues fixed in `public/themes/themes/night/theme.less`:
- `body, html, #page, #pageInner` — added dark background
- `#editorContent`, `#editorContentWrap` — added dark background
- `#wmd-input.ace-tm` — was hardcoded `#ffffff`, changed to `@noteBg`
- `div.mce-edit-area` — TinyMCE skin hardcodes `#FFF`, must override with `!important`
- `.mce-container-body`, `.mce-tinymce` — same TinyMCE white background issue

### Login form Enter key

`login.html` buttons were set to `type="button"` which prevented form submission on Enter. Added explicit Enter key handler on email/pwd/host inputs to trigger login button click.

### note.html loadService() call

Removed the `window.Service = window.loadService()` call in note.html. Service is already initialized as a global by service.js script tag; `loadService` was only exposed by preload.js which is not in use.

### Emoji icon size in markdown preview

twemoji renders emoji as `<img class="emoji">` tags at full resolution. Without CSS constraints, emoji appear enormous in the preview panel. Fixed by adding `img.emoji { height: 1.1em; width: 1.1em; }` to `modern-markdown.css`.

## Commands

```bash
# Install dependencies
npm i

# Install dev dependencies (for LESS compilation)
cd dev && npm i

# Compile LESS themes (required before first run)
# Option 1: One-shot compile via build script (recommended)
./build.sh less-only

# Option 2: Watch mode for development (auto-recompile on changes)
cd dev && npx gulp dev

# Option 3: Manual compile (individual files)
cd dev && npx lessc ../public/themes/default.less ../public/themes/default.css
cd dev && npx lessc ../public/themes/basic.less ../public/themes/basic.css
cd dev && npx lessc ../public/themes/presentation.less ../public/themes/presentation.css
cd dev && npx lessc ../public/themes/writting.less ../public/themes/writting.css
cd dev && npx lessc ../public/themes/windows.less ../public/themes/windows.css
cd dev && npx lessc ../public/css/login.less ../public/css/login.css
cd dev && npx lessc ../public/themes/markdown/meditor.less ../public/themes/markdown/meditor.css

# Compile color themes
cd dev && for dir in ../public/themes/themes/*/; do
  if [ -f "$dir/theme.less" ]; then
    npx lessc "$dir/theme.less" "$dir/theme.css"
  fi
done

# Run the app
./node_modules/electron/dist/electron . --no-sandbox --disable-gpu --in-process-gpu

# Run with DevTools
./node_modules/electron/dist/electron . --devtools --no-sandbox --disable-gpu --in-process-gpu

# Tests (no formal test runner; run individually)
node tests/test.js
node tests/testCommon.js
node tests/testNeedle.js
node tests/test_fs.js
node tests/test_getmac.js
```

### Build & Packaging

```bash
# Compile LESS only (no packaging)
./build.sh less-only

# Generate PNG icons from .ico for Linux
./build.sh icons

# Build Linux .deb package (Ubuntu 22.04, amd64)
./build.sh linux

# Build Windows .exe installer (NSIS)
./build.sh win

# Build Android APK via Capacitor (requires Android SDK)
./build.sh android

# Build iOS app via Capacitor (requires macOS + Xcode)
./build.sh ios

# npm script shortcuts
npm run build:linux
npm run build:win
npm run build:android
npm run build:ios
npm run build:less
```

Output: `dist/` directory (e.g., `dist/Leanote-Desktop_1.0.0_amd64.deb`).

The build script auto-downloads Electron and electron-builder binaries from npmmirror.com (Chinese mirror). Override with `ELECTRON_MIRROR` and `ELECTRON_BUILDER_BINARIES_MIRROR` env vars.

If `require('electron')` returns the wrong object, use a clean environment:
```bash
env -i HOME=$HOME DISPLAY=$DISPLAY WAYLAND_DISPLAY=$WAYLAND_DISPLAY \
  XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR DBUS_SESSION_BUS_ADDRESS=$DBUS_SESSION_BUS_ADDRESS \
  ./node_modules/electron/dist/electron . --no-sandbox --disable-gpu --in-process-gpu
```

## Architecture

### Electron Process Model

- **Main process** (`main.js`): Creates BrowserWindow, manages IPC, runs NeDB proxy server, registers `leanote://` custom protocol. Debug flag: `--devtools`.
- **Renderer process** (`login.html` / `note.html`): Runs with `nodeIntegration: true`, `contextIsolation: false`. Loads services via `<script>` tags, not bundled.
- **Preload** (`preload.js`): Defined but **not effective** — `contextIsolation: false` means the contextBridge is bypassed. The preload imports `./src/browser/service` and exposes it via `loadService()`, but the renderer loads services directly via `<script>` tags instead.

### Service Loading

Services are loaded via `<script>` tags in the HTML files. The `require()` paths must be relative to the HTML file location (project root), not the script file location.

- **login.html**: Loads `src/browser/service_login.js` via `<script>` tag. Provides `UserService`, `gui` as global variables.
- **note.html**: Loads `src/browser/service.js` via `<script>` tag. Provides `Service`, `UserService`, `NotebookService`, `NoteService`, `TagService`, `gui` as global variables.

**Important**: When modifying service files in `src/browser/`, ensure all `require()` paths use `./src/...` format (relative to project root), not `../` format (relative to the script file location).

### Startup Flow

1. `main.js` → `app.on('ready')` → creates BrowserWindow → loads `note.html`
2. `note.html` loads `src/browser/service.js` via script tag, which initializes all services as global variables
3. `UserService.init()` checks for active user in NeDB:
   - If active user exists → loads main UI (notebooks, notes, tags)
   - If no active user → calls `switchAccount()` → `toLogin()` → IPC `openUrl` to open `login.html`
4. User logs in via `login.html` → `goToMainPage()` → IPC `openUrl` to open `note.html`

### IPC Channels

**Renderer → Main:**
- `db-exec` — Execute NeDB operation (method, dbname, params)
- `db-init` — Initialize main process NeDB with user context and paths
- `openUrl` — Open a new HTML page (login.html or note.html)
- `quit-app` — Signal main process to quit
- `show-tray` — Create system tray icon (macOS/Windows only)

**Main → Renderer:**
- `db-exec-ret` — Return value from NeDB operation
- `focusWindow` — Window gained focus
- `blurWindow` — Window lost focus
- `closeWindow` — Window is being closed

### IPC-based Database Proxy

NeDB operations are split across processes:
- Renderer sends DB requests via IPC (`db-exec` channel) through `src/nedb_proxy.js` / `src/db_client.js`
- Main process executes them in `src/db_main.js` and returns results via `db-exec-ret`
- Renderer also initializes NeDB directly in `src/db.js` for fast local reads

### Service Layer (`src/`)

| Module | Purpose |
|---|---|
| `src/sync.js` | Two-phase sync engine (pull then push) using USN-based incremental sync |
| `src/note.js` | Note CRUD and content management |
| `src/notebook.js` | Notebook CRUD with parent-child tree structure |
| `src/user.js` | Authentication (local + Leanote cloud) |
| `src/api.js` | HTTP client for Leanote cloud API (uses needle) |
| `src/file.js` | File/image/attachment management |
| `src/tag.js` | Tag management |
| `src/common.js` | Utilities (ObjectId, MD5, file I/O, date formatting) |
| `src/web.js` | Bridges backend services to frontend UI, dispatches sync results |
| `src/import.js` | Import from Evernote (ENEX), HTML, Leanote formats |
| `src/gui.js` | Wraps `@electron/remote` APIs (Menu, dialog, Shell) |
| `src/leanote_protocol.js` | Custom protocol for serving local files |
| `src/pdf_main.js` | PDF export functionality (main process side) |

### Frontend UI (`public/js/app/`)

| Module | Purpose |
|---|---|
| `page.js` | Main layout, resize handling, writing mode |
| `note.js` | Note list UI, caching, auto-save (10s interval), editor switching |
| `notebook.js` | Notebook tree UI (zTree), drag-and-drop |
| `tag.js` | Tag navigation |
| `api.js` | Plugin API surface |
| `native.js` | Window controls, context menus |

### Plugin System

Plugins use RequireJS (AMD modules) in `public/plugins/<name>/`. Each has:
- `plugin.js` — AMD module with `langs`, `init()`, `onOpen()`, `onOpenAfter()` lifecycle hooks
- `plugin.json` — metadata and language strings

Plugin config in `public/config.js`. Default plugins: `theme`, `import_leanote`, `import_evernote`, `import_html`, `export_pdf`, `export_html`, `export_leanote`, `export_evernote`, `langs`, `accounts`. Default theme: `grass`, default view: `snippet`.

### Data Storage

NeDB files in `<appData>/leanote/nedb55/<userId>/`. Collections: `users`, `g` (global), `notebooks`, `notes`, `tags`, `attachs`, `noteHistories`, `images`.

### Build & Packaging

- **`build.sh`** — Main build script. Compiles LESS (including markdown themes), generates icons, packages for each platform.
- **`electron-builder.yml`** — electron-builder configuration. Linux: .deb, Windows: NSIS .exe, Mac: .dmg (x64 + arm64). Uses ASAR archive.
- **`build/icons/`** — PNG icons (16-256px) extracted from `.ico` for Linux desktop integration.
- **`package.json`** — Contains `build` section for electron-builder, npm scripts for each platform.
- **Capacitor** (Android/iOS): Requires `npx cap add android/ios`. Mobile needs a web bundling step (webpack/vite) + adapter modules since the app uses Node.js in renderer.

### Markdown Rendering

The markdown system uses `markdown-it` v14.1.1 with `highlight.js` for code syntax highlighting.

- **`public/md/modern-markdown.js`** — IIFE wrapper that creates `window.MD` API and `window.MarkdownEditor`. Integrates markdown-it with plugins (emoji, task-lists, footnote, mark, anchor), highlight.js, and twemoji.
- **`public/md/modern-markdown.css`** — Light theme styles for code blocks, tables, task lists, footnotes, blockquotes, inline code, and twemoji images.
- **Token-based TOC** — A markdown-it core plugin (`toc_collect`) extracts headings during parsing and builds the TOC in `#leanoteNavContentMd`.
- **API surface** (`window.MD`): `focus()`, `setContent()`, `getContent()`, `onResize()`, `resize()`, `clearUndo()`, `toggleToAce()`, `toggleToLight()`, `setModeName()`, `changeAceKeyboardMode()`, `insertLink()`.
- **Dark theme**: The night theme (`public/themes/themes/night/theme.less`) includes dark hljs syntax colors (VS Code dark palette), dark table/blockquote/inline code backgrounds, and dark mark highlighting. Twemoji images are constrained to `1.1em` via CSS.
- **Note**: `modern-markdown.js` uses `require()` paths like `./src/...` (resolved from project root), NOT relative paths. Same rule as `src/browser/` scripts.

### Themes & i18n

- LESS themes in `public/themes/`, compiled to CSS. Color themes in `public/themes/themes/`.
- Each color theme has a `theme.less` file that must be compiled to `theme.css`.
- Language files in `public/langs/` (en-us, zh-cn, zh-hk, ja-jp, de-de). Loaded by `public/js/lang.js`.
- **LESS must be compiled before running the app** - CSS files are not checked into the repository.
- **Dark theme caveat**: TinyMCE skin (`public/tinymce/skins/custom/skin.min.css`) hardcodes white backgrounds. Dark themes must override `div.mce-edit-area`, `.mce-container-body`, `.mce-tinymce` with `!important`. Also check `#wmd-input.ace-tm` for Ace editor.
