/**
 * Package script — Creates a distributable .zip for LocalWP "Install from Disk".
 *
 * Includes only the files needed to run the addon:
 *   package.json, lib/, style.css, icon.svg, README.MD
 *
 * Production node_modules are installed inside the dist folder
 * so end users don't need npm/node on their machine.
 *
 * Output: dist/localwp-dev-tools-v{version}.zip
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pkg = require(path.join(ROOT, 'package.json'));
const version = pkg.version;
const distName = `localwp-dev-tools-v${version}`;
const distDir = path.join(ROOT, 'dist', distName);
const zipPath = path.join(ROOT, 'dist', `${distName}.zip`);

// Clean previous dist
if (fs.existsSync(path.join(ROOT, 'dist'))) {
	fs.rmSync(path.join(ROOT, 'dist'), { recursive: true });
}

fs.mkdirSync(distDir, { recursive: true });

// Files to include in the distribution
const filesToCopy = ['package.json', 'package-lock.json', 'style.css', 'icon.svg', 'README.MD'];

for (const file of filesToCopy) {
	const src = path.join(ROOT, file);
	if (fs.existsSync(src)) {
		fs.copyFileSync(src, path.join(distDir, file));
	}
}

// Copy lib/ directory
copyDirSync(path.join(ROOT, 'lib'), path.join(distDir, 'lib'));

// Install production dependencies only
console.log('Installing production dependencies...');
execSync('npm install --omit=dev --ignore-scripts', { cwd: distDir, stdio: 'inherit' });

// Remove package-lock from dist (not needed for end users)
const lockFile = path.join(distDir, 'package-lock.json');
if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);

// Create zip
console.log(`Creating ${distName}.zip ...`);
execSync(`cd "${path.join(ROOT, 'dist')}" && zip -r "${distName}.zip" "${distName}" -x "*.DS_Store"`, { stdio: 'inherit' });

// Clean up the unzipped folder
fs.rmSync(distDir, { recursive: true });

const zipSize = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
console.log(`\nDone! dist/${distName}.zip (${zipSize} MB)`);
console.log('Users can install via: LocalWP → Add-ons → Install from Disk');

// ── Helpers ──

function copyDirSync(src, dest) {
	fs.mkdirSync(dest, { recursive: true });
	for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		if (entry.isDirectory()) {
			copyDirSync(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}
