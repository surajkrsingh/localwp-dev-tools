/**
 * LocalWP Dev Tools — Main Process
 *
 * Handles all IPC communication between the LocalWP renderer and the
 * underlying WordPress site. Provides handlers for plugin/theme management,
 * debug mode toggling, error log viewing, DB snapshots, cache flushing,
 * and PHP server configuration.
 */

import * as electron from 'electron';
import * as path from 'path';
import * as fs from 'fs';

const { ipcMain } = electron;
const LOG_PREFIX = '[LocalWP Dev Tools]';

let serviceContainer: any;

export default function (_context: any) {
	try {
		const LocalMain = require('@getflywheel/local/main');
		serviceContainer = LocalMain.getServiceContainer().cradle;
	} catch (e: any) {
		console.error(LOG_PREFIX, 'Failed to get service container:', e.message);
	}

	registerPluginHandlers();
	registerThemeHandlers();
	registerDebugModeHandlers();
	registerErrorLogHandlers();
	registerDbSnapshotHandlers();
	registerCacheFlushHandlers();
	registerServerConfigHandlers();
}

// ────────────────────────────────────────────────────────────────────────────
// Plugin Management
// ────────────────────────────────────────────────────────────────────────────

function registerPluginHandlers() {
	/** List all plugins (excludes must-use and drop-in). */
	ipcMain.on('debugging-tool:get-plugins', async (event, siteId: string) => {
		try {
			const site = requireSite(siteId);
			const raw = await runWpCli(site, ['plugin', 'list', '--format=json']);
			const plugins = JSON.parse(raw).filter(
				(p: any) => p.status !== 'must-use' && p.status !== 'dropin',
			);
			event.reply('debugging-tool:plugins-result', { plugins });
		} catch (error: any) {
			replyError(event, 'debugging-tool:plugins-result', error);
		}
	});

	/** Activate or deactivate a single plugin. */
	ipcMain.on('debugging-tool:toggle-plugin', async (event, siteId: string, pluginName: string, activate: boolean) => {
		try {
			const site = requireSite(siteId);
			await runWpCli(site, ['plugin', activate ? 'activate' : 'deactivate', pluginName]);
			const raw = await runWpCli(site, ['plugin', 'list', '--format=json']);
			event.reply('debugging-tool:toggle-plugin-result', { plugins: JSON.parse(raw) });
		} catch (error: any) {
			replyError(event, 'debugging-tool:toggle-plugin-result', error);
		}
	});

	/** Bulk activate or deactivate multiple plugins. */
	ipcMain.on('debugging-tool:bulk-toggle-plugins', async (event, siteId: string, pluginNames: string[], activate: boolean) => {
		try {
			const site = requireSite(siteId);
			await runWpCli(site, ['plugin', activate ? 'activate' : 'deactivate', ...pluginNames]);
			const raw = await runWpCli(site, ['plugin', 'list', '--format=json']);
			event.reply('debugging-tool:bulk-toggle-result', { plugins: JSON.parse(raw) });
		} catch (error: any) {
			replyError(event, 'debugging-tool:bulk-toggle-result', error);
		}
	});
}

// ────────────────────────────────────────────────────────────────────────────
// Theme Management
// ────────────────────────────────────────────────────────────────────────────

function registerThemeHandlers() {
	/** List all installed themes. */
	ipcMain.on('debugging-tool:get-themes', async (event, siteId: string) => {
		try {
			const site = requireSite(siteId);
			const raw = await runWpCli(site, ['theme', 'list', '--format=json']);
			event.reply('debugging-tool:themes-result', { themes: JSON.parse(raw) });
		} catch (error: any) {
			replyError(event, 'debugging-tool:themes-result', error);
		}
	});

	/** Activate a theme (only one can be active). */
	ipcMain.on('debugging-tool:activate-theme', async (event, siteId: string, themeName: string) => {
		try {
			const site = requireSite(siteId);
			await runWpCli(site, ['theme', 'activate', themeName]);
			const raw = await runWpCli(site, ['theme', 'list', '--format=json']);
			event.reply('debugging-tool:activate-theme-result', { themes: JSON.parse(raw) });
		} catch (error: any) {
			replyError(event, 'debugging-tool:activate-theme-result', error);
		}
	});
}

// ────────────────────────────────────────────────────────────────────────────
// Debug Mode
// ────────────────────────────────────────────────────────────────────────────

const DEBUG_CONSTANTS = ['WP_DEBUG', 'WP_DEBUG_LOG', 'WP_DEBUG_DISPLAY', 'SCRIPT_DEBUG', 'SAVEQUERIES'];

function readDebugStatus(wpConfigContent: string): Record<string, boolean> {
	const status: Record<string, boolean> = {};
	for (const key of DEBUG_CONSTANTS) {
		status[key] = getConstantValue(wpConfigContent, key);
	}
	return status;
}

function registerDebugModeHandlers() {
	/** Read current debug constant values from wp-config.php. */
	ipcMain.on('debugging-tool:get-debug-status', async (event, siteId: string) => {
		try {
			const site = requireSite(siteId);
			const wpConfigPath = getWpConfigPath(site);

			if (!fs.existsSync(wpConfigPath)) {
				event.reply('debugging-tool:debug-status-result', {
					error: `wp-config.php not found at ${wpConfigPath}`,
				});
				return;
			}

			const debugStatus = readDebugStatus(fs.readFileSync(wpConfigPath, 'utf8'));
			event.reply('debugging-tool:debug-status-result', { debugStatus });
		} catch (error: any) {
			replyError(event, 'debugging-tool:debug-status-result', error);
		}
	});

	/** Set a debug constant in wp-config.php. */
	ipcMain.on('debugging-tool:set-debug-constant', async (event, siteId: string, constant: string, value: boolean) => {
		try {
			const site = requireSite(siteId);
			const wpConfigPath = getWpConfigPath(site);

			let wpConfig = fs.readFileSync(wpConfigPath, 'utf8');
			wpConfig = setConstantInConfig(wpConfig, constant, value);
			fs.writeFileSync(wpConfigPath, wpConfig, 'utf8');

			const debugStatus = readDebugStatus(fs.readFileSync(wpConfigPath, 'utf8'));
			event.reply('debugging-tool:set-debug-result', { debugStatus });
		} catch (error: any) {
			replyError(event, 'debugging-tool:set-debug-result', error);
		}
	});
}

// ────────────────────────────────────────────────────────────────────────────
// Error Log Viewer
// ────────────────────────────────────────────────────────────────────────────

function registerErrorLogHandlers() {
	/** Read the last N lines from wp-content/debug.log. */
	ipcMain.on('debugging-tool:get-error-log', async (event, siteId: string, lines: number) => {
		try {
			const site = requireSite(siteId);
			const logPath = getDebugLogPath(site);

			if (!fs.existsSync(logPath)) {
				event.reply('debugging-tool:error-log-result', { logs: '', logPath, empty: true });
				return;
			}

			const content = fs.readFileSync(logPath, 'utf8');
			const allLines = content.split('\n');
			const count = lines || 50;

			event.reply('debugging-tool:error-log-result', {
				logs: allLines.slice(-count).join('\n'),
				logPath,
				totalLines: allLines.length,
				fileSize: fs.statSync(logPath).size,
			});
		} catch (error: any) {
			replyError(event, 'debugging-tool:error-log-result', error);
		}
	});

	/** Clear the debug.log file. */
	ipcMain.on('debugging-tool:clear-error-log', async (event, siteId: string) => {
		try {
			const site = requireSite(siteId);
			const logPath = getDebugLogPath(site);
			if (fs.existsSync(logPath)) fs.writeFileSync(logPath, '', 'utf8');
			event.reply('debugging-tool:clear-log-result', { success: true });
		} catch (error: any) {
			replyError(event, 'debugging-tool:clear-log-result', error);
		}
	});

	/** Download the full debug.log via save dialog. */
	ipcMain.on('debugging-tool:download-error-log', async (event, siteId: string) => {
		try {
			const site = requireSite(siteId);
			const logPath = getDebugLogPath(site);

			if (!fs.existsSync(logPath)) {
				event.reply('debugging-tool:download-log-result', { error: 'Log file does not exist' });
				return;
			}

			const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
			const result = await electron.dialog.showSaveDialog({
				defaultPath: `debug-log-${site.name || 'site'}-${timestamp}.log`,
				filters: [{ name: 'Log Files', extensions: ['log', 'txt'] }],
			});

			if (!result.canceled && result.filePath) {
				fs.copyFileSync(logPath, result.filePath);
				event.reply('debugging-tool:download-log-result', { success: true });
			} else {
				event.reply('debugging-tool:download-log-result', { canceled: true });
			}
		} catch (error: any) {
			replyError(event, 'debugging-tool:download-log-result', error);
		}
	});
}

// ────────────────────────────────────────────────────────────────────────────
// DB Snapshots
// ────────────────────────────────────────────────────────────────────────────

/** Read the snapshot directory and return a sorted file list. */
function listSnapshots(snapshotDir: string) {
	if (!fs.existsSync(snapshotDir)) return [];
	return fs.readdirSync(snapshotDir)
		.filter((f) => f.endsWith('.sql'))
		.map((f) => {
			const filePath = path.join(snapshotDir, f);
			const stat = fs.statSync(filePath);
			return { name: f, path: filePath, size: stat.size, created: stat.birthtime.toISOString() };
		})
		.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
}

function registerDbSnapshotHandlers() {
	/** List all saved DB snapshots. */
	ipcMain.on('debugging-tool:get-snapshots', async (event, siteId: string) => {
		try {
			const site = requireSite(siteId);
			const dir = getSnapshotDir(site);
			if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
			event.reply('debugging-tool:snapshots-result', { snapshots: listSnapshots(dir) });
		} catch (error: any) {
			replyError(event, 'debugging-tool:snapshots-result', error);
		}
	});

	/** Create a new DB snapshot via mysqldump. */
	ipcMain.on('debugging-tool:create-snapshot', async (event, siteId: string, snapshotName: string) => {
		try {
			const site = requireSite(siteId);
			const dir = getSnapshotDir(site);
			if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

			const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
			const safeName = (snapshotName || 'snapshot').replace(/[^a-zA-Z0-9_-]/g, '_');
			const filePath = path.join(dir, `${safeName}_${timestamp}.sql`);

			await runMysqlDump(site, filePath);
			event.reply('debugging-tool:create-snapshot-result', { snapshots: listSnapshots(dir) });
		} catch (error: any) {
			replyError(event, 'debugging-tool:create-snapshot-result', error);
		}
	});

	/** Restore the database from a snapshot file. */
	ipcMain.on('debugging-tool:restore-snapshot', async (event, siteId: string, snapshotPath: string) => {
		try {
			requireSite(siteId);
			if (!fs.existsSync(snapshotPath)) {
				event.reply('debugging-tool:restore-snapshot-result', { error: 'Snapshot file not found' });
				return;
			}
			const site = requireSite(siteId);
			await runMysqlImport(site, snapshotPath);
			event.reply('debugging-tool:restore-snapshot-result', { success: true });
		} catch (error: any) {
			replyError(event, 'debugging-tool:restore-snapshot-result', error);
		}
	});

	/** Delete a snapshot file. */
	ipcMain.on('debugging-tool:delete-snapshot', async (event, siteId: string, snapshotPath: string) => {
		try {
			const site = requireSite(siteId);
			if (fs.existsSync(snapshotPath)) fs.unlinkSync(snapshotPath);
			event.reply('debugging-tool:delete-snapshot-result', { snapshots: listSnapshots(getSnapshotDir(site)) });
		} catch (error: any) {
			replyError(event, 'debugging-tool:delete-snapshot-result', error);
		}
	});

	/** Download a snapshot file via save dialog. */
	ipcMain.on('debugging-tool:download-snapshot', async (event, _siteId: string, snapshotPath: string, snapshotName: string) => {
		try {
			if (!fs.existsSync(snapshotPath)) {
				event.reply('debugging-tool:download-snapshot-result', { error: 'Snapshot file not found' });
				return;
			}
			const result = await electron.dialog.showSaveDialog({
				defaultPath: snapshotName,
				filters: [{ name: 'SQL Files', extensions: ['sql'] }],
			});
			if (!result.canceled && result.filePath) {
				fs.copyFileSync(snapshotPath, result.filePath);
				event.reply('debugging-tool:download-snapshot-result', { success: true });
			} else {
				event.reply('debugging-tool:download-snapshot-result', { canceled: true });
			}
		} catch (error: any) {
			replyError(event, 'debugging-tool:download-snapshot-result', error);
		}
	});
}

// ────────────────────────────────────────────────────────────────────────────
// Cache Flush
// ────────────────────────────────────────────────────────────────────────────

function registerCacheFlushHandlers() {
	ipcMain.on('debugging-tool:flush-cache', async (event, siteId: string, action: string) => {
		try {
			const site = requireSite(siteId);

			switch (action) {
				case 'object-cache':
					await runWpCli(site, ['cache', 'flush']);
					break;
				case 'transients':
					await runWpCli(site, ['transient', 'delete', '--all']);
					break;
				case 'rewrite-rules':
					await runWpCli(site, ['rewrite', 'flush']);
					break;
				case 'opcache':
					await runWpCli(site, ['eval', 'if(function_exists("opcache_reset")){opcache_reset();echo "OK";}else{echo "opcache not available";}']);
					break;
				case 'post-revisions':
					try {
						const ids = await runWpCli(site, ['post', 'list', '--post_type=revision', '--format=ids']);
						if (ids.trim()) {
							await runWpCli(site, ['post', 'delete', ...ids.trim().split(' '), '--force']);
						}
					} catch (_e) {
						// No revisions found — not an error
					}
					break;
				default:
					event.reply('debugging-tool:flush-cache-result', { error: 'Unknown action', action });
					return;
			}

			event.reply('debugging-tool:flush-cache-result', { success: true, action });
		} catch (error: any) {
			console.error(LOG_PREFIX, 'flush-cache error:', error);
			event.reply('debugging-tool:flush-cache-result', { error: error.message, action });
		}
	});
}

// ────────────────────────────────────────────────────────────────────────────
// Server Config (php.ini)
// ────────────────────────────────────────────────────────────────────────────

function registerServerConfigHandlers() {
	/** Read PHP configuration values from php.ini. */
	ipcMain.on('debugging-tool:get-php-config', async (event, siteId: string) => {
		try {
			const site = requireSite(siteId);
			const phpIniPath = getPhpIniPath(site);
			if (!phpIniPath) {
				event.reply('debugging-tool:php-config-result', { error: 'php.ini not found for this site' });
				return;
			}
			const config = parsePhpIni(fs.readFileSync(phpIniPath, 'utf8'));
			event.reply('debugging-tool:php-config-result', { config, phpIniPath });
		} catch (error: any) {
			replyError(event, 'debugging-tool:php-config-result', error);
		}
	});

	/** Update a PHP configuration value in php.ini. */
	ipcMain.on('debugging-tool:set-php-config', async (event, siteId: string, key: string, value: string) => {
		try {
			const site = requireSite(siteId);
			const phpIniPath = getPhpIniPath(site);
			if (!phpIniPath) {
				event.reply('debugging-tool:set-php-config-result', { error: 'php.ini not found for this site' });
				return;
			}

			let content = fs.readFileSync(phpIniPath, 'utf8');
			content = setPhpIniValue(content, key, value);
			fs.writeFileSync(phpIniPath, content, 'utf8');

			const config = parsePhpIni(fs.readFileSync(phpIniPath, 'utf8'));
			event.reply('debugging-tool:set-php-config-result', {
				config,
				phpIniPath,
				note: 'Restart the site for changes to take effect.',
			});
		} catch (error: any) {
			replyError(event, 'debugging-tool:set-php-config-result', error);
		}
	});
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers — Site & Path Resolution
// ════════════════════════════════════════════════════════════════════════════

/** Fetch a site from the service container or throw. */
function requireSite(siteId: string): any {
	if (!serviceContainer) throw new Error('Service container not available');
	const site = serviceContainer.siteData.getSite(siteId);
	if (!site) throw new Error('Site not found');
	return site;
}

/** Centralised error reply to keep handler code DRY. */
function replyError(event: Electron.IpcMainEvent, channel: string, error: any) {
	console.error(LOG_PREFIX, channel, error.message || error);
	event.reply(channel, { error: error.message || 'An unknown error occurred' });
}

/** Expand `~` to the user's home directory. */
function expandHome(filePath: string): string {
	if (filePath.startsWith('~/') || filePath === '~') {
		return path.join(process.env.HOME || require('os').homedir(), filePath.slice(2));
	}
	return filePath;
}

/** Get the resolved filesystem path for a site. */
function getSitePath(site: any): string {
	return expandHome(site.path || site.longPath || '');
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers — File Locators
// ════════════════════════════════════════════════════════════════════════════

/** Locate wp-content/debug.log for a site. */
function getDebugLogPath(site: any): string {
	const sitePath = getSitePath(site);
	const candidates = [path.join(sitePath, 'app', 'public', 'wp-content', 'debug.log')];

	if (site.paths?.webRoot) {
		candidates.push(path.join(expandHome(site.paths.webRoot), 'wp-content', 'debug.log'));
	}

	return candidates.find((c) => fs.existsSync(c)) || candidates[0];
}

/** Locate php.ini (or php.ini.hbs) for a site. */
function getPhpIniPath(site: any): string | null {
	const sitePath = getSitePath(site);
	const candidates = [
		path.join(sitePath, 'conf', 'php', 'php.ini.hbs'),
		path.join(sitePath, 'conf', 'php', 'php.ini'),
	];

	if (site.paths?.confDir) {
		candidates.push(path.join(expandHome(site.paths.confDir), 'php', 'php.ini.hbs'));
		candidates.push(path.join(expandHome(site.paths.confDir), 'php', 'php.ini'));
	}

	return candidates.find((c) => fs.existsSync(c)) || null;
}

/** Get the DB snapshots directory for a site. */
function getSnapshotDir(site: any): string {
	return path.join(getSitePath(site), 'app', 'public', 'wp-content', 'uploads', 'db-snapshots');
}

/** Locate wp-config.php for a site. */
function getWpConfigPath(site: any): string {
	const sitePath = getSitePath(site);
	const candidates: string[] = [];

	if (sitePath) candidates.push(path.join(sitePath, 'app', 'public', 'wp-config.php'));
	if (site.paths?.webRoot) candidates.push(path.join(expandHome(site.paths.webRoot), 'wp-config.php'));
	if (site.paths?.app) candidates.push(path.join(expandHome(site.paths.app), 'public', 'wp-config.php'));
	if (site.webRoot) candidates.push(path.join(expandHome(site.webRoot), 'wp-config.php'));

	return candidates.find((c) => fs.existsSync(c)) || candidates[0] || path.join(sitePath, 'app', 'public', 'wp-config.php');
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers — WP-CLI
// ════════════════════════════════════════════════════════════════════════════

/** Run a WP-CLI command via LocalWP's service container, with shell fallback. */
async function runWpCli(site: any, args: string[]): Promise<string> {
	if (!serviceContainer) throw new Error('Service container not available');

	const wpCli = serviceContainer.wpCli;
	if (wpCli && typeof wpCli.run === 'function') {
		const result = await wpCli.run(site, args);
		return typeof result === 'string' ? result : String(result);
	}

	return runWpCliFallback(site, args);
}

/** Fallback: run WP-CLI via the site shell script or system `wp`. */
function runWpCliFallback(site: any, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const { spawn } = require('child_process');
		const sitePath = getSitePath(site);
		const wpRoot = path.join(sitePath, 'app', 'public');
		const shellScript = path.join(sitePath, 'conf', 'siteShell.sh');

		const child = fs.existsSync(shellScript)
			? spawn('bash', ['-c', `source "${shellScript}" && wp ${args.join(' ')} --path="${wpRoot}"`], { cwd: wpRoot })
			: spawn('wp', [...args, `--path=${wpRoot}`], { cwd: wpRoot, env: { ...process.env } });

		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
		child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
		child.on('close', (code: number) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr || `WP-CLI exited with code ${code}`)));
		child.on('error', (err: Error) => reject(new Error(`Failed to run WP-CLI: ${err.message}`)));
	});
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers — MySQL (for DB Snapshots)
// ════════════════════════════════════════════════════════════════════════════

/** Find a MySQL binary (mysqldump / mysql) in LocalWP's lightning-services. */
function getMysqlBinPath(binaryName: string): string {
	const baseDir = path.join(
		process.env.HOME || require('os').homedir(),
		'Library', 'Application Support', 'Local', 'lightning-services',
	);

	if (fs.existsSync(baseDir)) {
		for (const dir of fs.readdirSync(baseDir).filter((d) => d.startsWith('mysql-'))) {
			const candidates = [
				path.join(baseDir, dir, 'bin', 'darwin-arm64', 'bin', binaryName),
				path.join(baseDir, dir, 'bin', 'darwin', 'bin', binaryName),
				path.join(baseDir, dir, 'bin', binaryName),
			];
			const found = candidates.find((c) => fs.existsSync(c));
			if (found) return found;
		}
	}

	return binaryName; // fallback to PATH
}

/** Get the rendered my.cnf defaults file for a site's MySQL instance. */
function getMysqlDefaultsFile(site: any): string {
	const homeDir = process.env.HOME || require('os').homedir();
	return path.join(homeDir, 'Library', 'Application Support', 'Local', 'run', site.id, 'conf', 'mysql', 'my.cnf');
}

/** Export the database using mysqldump with the site's MySQL defaults. */
function runMysqlDump(site: any, outputPath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const { spawn } = require('child_process');
		const database = site.mysql?.database || 'local';

		const child = spawn(getMysqlBinPath('mysqldump'), [
			`--defaults-file=${getMysqlDefaultsFile(site)}`,
			`--result-file=${outputPath}`,
			database,
		]);

		let stderr = '';
		child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
		child.on('close', (code: number) => code === 0 ? resolve('OK') : reject(new Error(stderr || `mysqldump exited with code ${code}`)));
		child.on('error', (err: Error) => reject(new Error(`Failed to run mysqldump: ${err.message}`)));
	});
}

/** Import a SQL file into the database using the mysql client. */
function runMysqlImport(site: any, inputPath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const { spawn } = require('child_process');
		const database = site.mysql?.database || 'local';

		const child = spawn(getMysqlBinPath('mysql'), [
			`--defaults-file=${getMysqlDefaultsFile(site)}`,
			database,
		], { stdio: ['pipe', 'pipe', 'pipe'] });

		fs.createReadStream(inputPath).pipe(child.stdin);

		let stderr = '';
		child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
		child.on('close', (code: number) => code === 0 ? resolve('OK') : reject(new Error(stderr || `mysql exited with code ${code}`)));
		child.on('error', (err: Error) => reject(new Error(`Failed to run mysql: ${err.message}`)));
	});
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers — wp-config.php Constants
// ════════════════════════════════════════════════════════════════════════════

/** Read a boolean define() value from wp-config.php content. */
function getConstantValue(wpConfig: string, constant: string): boolean {
	const match = wpConfig.match(new RegExp(`define\\s*\\(\\s*['"]${constant}['"]\\s*,\\s*(true|false)\\s*\\)`, 'i'));
	return match ? match[1].toLowerCase() === 'true' : false;
}

/** Set or insert a boolean define() constant in wp-config.php content. */
function setConstantInConfig(wpConfig: string, constant: string, value: boolean): string {
	const phpValue = value ? 'true' : 'false';
	const regex = new RegExp(`(define\\s*\\(\\s*['"]${constant}['"]\\s*,\\s*)(true|false)(\\s*\\))`, 'i');

	if (regex.test(wpConfig)) {
		return wpConfig.replace(regex, `$1${phpValue}$3`);
	}

	// Insert before the "stop editing" comment or wp-settings require
	const anchor = wpConfig.match(/\/\*\s*That's all, stop editing!|require_once.*wp-settings\.php/);
	const line = `define( '${constant}', ${phpValue} );\n`;

	if (anchor) return wpConfig.replace(anchor[0], line + anchor[0]);
	return wpConfig.replace('<?php', `<?php\n${line}`);
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers — php.ini Parsing
// ════════════════════════════════════════════════════════════════════════════

const PHP_INI_KEYS = [
	'memory_limit', 'max_execution_time', 'max_input_time', 'max_input_vars',
	'post_max_size', 'upload_max_filesize', 'max_file_uploads',
	'display_errors', 'log_errors', 'error_reporting', 'date.timezone',
];

/** Parse selected PHP ini directives from file content. */
function parsePhpIni(content: string): Record<string, string> {
	const config: Record<string, string> = {};
	for (const key of PHP_INI_KEYS) {
		const match = content.match(new RegExp(`^\\s*${key.replace('.', '\\.')}\\s*=\\s*(.+)`, 'm'));
		config[key] = match ? match[1].trim() : '';
	}
	return config;
}

/** Set a PHP ini directive value, or append if not found. */
function setPhpIniValue(content: string, key: string, value: string): string {
	const regex = new RegExp(`^(\\s*${key.replace('.', '\\.')}\\s*=\\s*)(.+)`, 'm');
	return regex.test(content)
		? content.replace(regex, `$1${value}`)
		: content.trimEnd() + `\n${key} = ${value}\n`;
}
