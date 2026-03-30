# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A LocalWP addon (Electron-based) called **LocalWP Dev Tools** that adds WordPress debugging and development tools to the LocalWP sidebar. It provides 9 tools: Plugin Manager, Theme Manager, Debug Mode, Error Log, DB Snapshots, Cache Flush, Server Config, Cron Manager, and User Switcher.

## Build & Development Commands

```bash
npm run build     # Babel compile src/ → lib/ (TypeScript + JSX → ES5)
npm run watch     # Watch mode for development
npm run package   # Build + create distributable .zip in dist/
```

After building, restart LocalWP or press `Cmd+R` to reload the renderer. Main process changes require a full LocalWP restart.

**Symlink for local development:**
```bash
ln -s "$(pwd)" ~/Library/Application\ Support/Local/addons/localwp-dev-tools
```

There are no tests or linting configured.

## Architecture

This is an **Electron IPC addon** with two entry points defined in `package.json`:

- **`main` → `lib/main.js`** — Runs in Electron's main process (Node.js). Handles all backend operations: WP-CLI commands, file I/O, MySQL dumps, subprocess spawning. Registers `ipcMain.on()` listeners.
- **`renderer` → `lib/renderer.js`** — Runs in Electron's renderer process (React). Registers UI components into LocalWP's sidebar via `hooks.addFilter('siteInfoToolsItem', ...)`.

### Data Flow

```
React Component → ipcRenderer.send('debugging-tool:<action>', siteId, ...)
    → main.ts ipcMain.on('debugging-tool:<action>')
    → performs work (WP-CLI, file ops, mysqldump)
    → event.reply('debugging-tool:<action>-result', { data })
    → Component ipcRenderer.on() listener updates state
```

All IPC channels use the prefix `debugging-tool:`. Each tool has its own set of channels (e.g., `debugging-tool:get-plugins`, `debugging-tool:toggle-plugin`).

### Key Patterns

- **Module-level caches** (e.g., `const pluginCache = {}`) in components keep data alive across tab switches since components remount each time.
- **`requireSite(siteId)`** in main.ts fetches the site from LocalWP's service container (`@getflywheel/local/main` → `getServiceContainer().cradle.siteData`).
- **`expandHome()`** resolves `~` in site paths — LocalWP stores paths like `~/Local Sites/mysite` which Node.js doesn't expand.
- **WP-CLI** runs via `serviceContainer.wpCli.run(site, args)` with a shell-based fallback.
- **MySQL operations** (DB Snapshots) use `mysqldump`/`mysql` binaries directly from `~/Library/Application Support/Local/lightning-services/mysql-*/` with `--defaults-file` pointing to `Local/run/{siteId}/conf/mysql/my.cnf` for socket/auth config.
- **User Switcher** auto-installs a mu-plugin (`devtools-autologin.php`) that handles one-time login URLs via WordPress transients.

### File Responsibilities

- **`src/main.ts`** — All IPC handlers organized into `register*Handlers()` functions, plus helpers for path resolution, WP-CLI, MySQL, wp-config.php parsing, and php.ini parsing.
- **`src/renderer.jsx`** — Imports all components, injects stylesheet, registers 9 sidebar items via `siteInfoToolsItem` filter.
- **`src/*.jsx`** — One component per tool. Each follows the same pattern: state hooks, IPC send on mount, IPC listeners in useEffect with cleanup.
- **`style.css`** — Theme-aware styles using `rgba()` and `color: inherit` for dark/light mode. Light mode overrides via `@media (prefers-color-scheme: light)`.
- **`scripts/package.js`** — Creates distribution ZIP with compiled lib/, production node_modules, assets. No source files included.

## LocalWP Addon API

- `context.hooks.addFilter('siteInfoToolsItem', callback)` — Registers sidebar tools with `{ path, menuItem, render }`.
- `context.hooks.addContent('stylesheets', callback)` — Injects CSS.
- Site object has: `id`, `name`, `path` (may contain `~`), `services.mysql.ports.MYSQL`, `mysql.database/user/password`.
- React is provided by LocalWP's context, not bundled — components use `const React = require('react')`.

## Release Process

1. Bump `version` in `package.json` on `main`
2. Merge `main` → `release` branch
3. GitHub Actions (`.github/workflows/release.yml`) builds, packages, and creates a GitHub Release with the `.zip` attached
4. Users install via LocalWP → Add-ons → Install from Disk
