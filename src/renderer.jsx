/**
 * LocalWP Dev Tools — Renderer Process
 *
 * Registers all tool components as sidebar items in LocalWP's
 * site info panel via the siteInfoToolsItem filter hook.
 */

import PluginManager from './PluginManager';
import ThemeManager from './ThemeManager';
import DebugMode from './DebugMode';
import ErrorLogViewer from './ErrorLogViewer';
import DbSnapshot from './DbSnapshot';
import CacheFlush from './CacheFlush';
import ServerConfig from './ServerConfig';

const path = require('path');

export default function (context) {
	const { hooks } = context;

	// Inject addon stylesheet
	const stylesheetPath = path.resolve(__dirname, '../style.css');
	hooks.addContent('stylesheets', () => (
		<link rel="stylesheet" key="wp-debugging-tools-stylesheet" href={`file://${stylesheetPath}`} />
	));

	// Register all tools in the site info sidebar
	hooks.addFilter('siteInfoToolsItem', (items) => {
		items.push(
			{ path: '/debugging-tool-plugins', menuItem: 'Plugins', render: ({ site }) => <PluginManager site={site} context={context} /> },
			{ path: '/debugging-tool-themes', menuItem: 'Themes', render: ({ site }) => <ThemeManager site={site} context={context} /> },
			{ path: '/debugging-tool-debug', menuItem: 'Debug Mode', render: ({ site }) => <DebugMode site={site} context={context} /> },
			{ path: '/debugging-tool-error-log', menuItem: 'Error Log', render: ({ site }) => <ErrorLogViewer site={site} context={context} /> },
			{ path: '/debugging-tool-db-snapshots', menuItem: 'DB Snapshots', render: ({ site }) => <DbSnapshot site={site} context={context} /> },
			{ path: '/debugging-tool-cache-flush', menuItem: 'Cache Flush', render: ({ site }) => <CacheFlush site={site} context={context} /> },
			{ path: '/debugging-tool-server-config', menuItem: 'Server Config', render: ({ site }) => <ServerConfig site={site} context={context} /> },
		);
		return items;
	});
}
