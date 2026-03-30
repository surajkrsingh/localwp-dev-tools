# LocalWP Dev Tools

A powerful LocalWP addon that brings essential WordPress debugging and development tools directly into the LocalWP interface. Manage plugins, themes, debug constants, error logs, database snapshots, caches, and PHP server configuration — all without leaving LocalWP or loading wp-admin.

## Features

| Tool | What it does | Key capabilities |
|------|-------------|-----------------|
| **Plugin Manager** | Activate/deactivate plugins without loading wp-admin | Toggle switch per plugin, bulk select & activate/deactivate multiple at once, auto-excludes MU-plugins, cached across tab switches |
| **Theme Manager** | Switch active theme instantly | One-click activate, only one theme active at a time, visual indicator for active theme |
| **Debug Mode** | Toggle WP debug constants in `wp-config.php` | `WP_DEBUG`, `WP_DEBUG_LOG`, `WP_DEBUG_DISPLAY`, `SCRIPT_DEBUG`, `SAVEQUERIES` — Enable All / Disable All buttons |
| **Error Log** | View `wp-content/debug.log` in real-time | Shows last 50 lines, copy to clipboard, download full log, clear log, displays file size & line count |
| **DB Snapshots** | Backup & restore database with one click | Named snapshots via `mysqldump`, instant restore via `mysql` import, download `.sql` files, stored in `wp-content/uploads/db-snapshots/` |
| **Cache Flush** | Clear WordPress caches without code | Object Cache, Transients, Rewrite Rules, OPcache, Post Revisions — individual or Flush All at once |
| **Server Config** | Adjust PHP settings from the UI | `memory_limit`, `max_execution_time`, `upload_max_filesize`, `post_max_size`, `display_errors`, and more — preset dropdowns + custom values, edits `php.ini` directly |

## Installation

### From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/user/localwp-debugging-tool.git
   ```

2. Install dependencies:
   ```bash
   cd localwp-debugging-tool
   npm install
   ```

3. Build:
   ```bash
   npm run build
   ```

4. Symlink into LocalWP's addons directory:
   ```bash
   ln -s "$(pwd)" ~/Library/Application\ Support/Local/addons/localwp-debugging-tool
   ```

5. Restart LocalWP

### Addon Locations

| OS      | Path                                              |
|---------|---------------------------------------------------|
| macOS   | `~/Library/Application Support/Local/addons/`      |
| Windows | `C:\Users\<user>\AppData\Roaming\Local\addons\`    |
| Linux   | `~/.config/Local/addons/`                          |

## Development

Watch for changes during development:

```bash
npm run watch
```

After saving changes, press `Cmd+R` (macOS) or `Ctrl+R` (Windows/Linux) inside LocalWP to reload the renderer, or restart LocalWP for main process changes.

## Usage

1. Open any site in LocalWP
2. Navigate to the **Tools** tab
3. Select any tool from the sidebar: Plugins, Themes, Debug Mode, Error Log, DB Snapshots, Cache Flush, or Server Config

## Tech Stack

- **Platform:** LocalWP Addon (Electron)
- **UI:** React (provided by LocalWP context)
- **Styling:** Custom CSS with dark/light mode support
- **Backend:** Node.js IPC handlers with WP-CLI and direct MySQL access
- **Build:** Babel (TypeScript + React + ES2018)

## Requirements

- LocalWP 6.5.2 or later
- macOS, Windows, or Linux

## License

MIT
