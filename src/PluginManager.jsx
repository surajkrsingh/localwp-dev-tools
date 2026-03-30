const React = require('react');
const { ipcRenderer } = require('electron');

const { useState, useEffect, useCallback, useRef } = React;

// Module-level cache so data survives tab switches (component remounts)
const pluginCache = {};

export default function PluginManager({ site, context }) {
	const cached = pluginCache[site.id];
	const [plugins, setPlugins] = useState(cached || []);
	const [loading, setLoading] = useState(!cached);
	const [error, setError] = useState(null);
	const [togglingPlugin, setTogglingPlugin] = useState(null);
	const [selected, setSelected] = useState({});
	const [bulkAction, setBulkAction] = useState(null);

	const fetchPlugins = useCallback(() => {
		setLoading(true);
		setError(null);
		ipcRenderer.send('debugging-tool:get-plugins', site.id);
	}, [site.id]);

	useEffect(() => {
		// Only fetch if we don't have cached data for this site
		if (!pluginCache[site.id]) {
			fetchPlugins();
		}

		const updatePlugins = (data) => {
			pluginCache[site.id] = data;
			setPlugins(data);
		};

		const handlePluginsResult = (event, data) => {
			setLoading(false);
			if (data.error) {
				setError(data.error);
			} else {
				updatePlugins(data.plugins);
			}
		};

		const handleToggleResult = (event, data) => {
			setTogglingPlugin(null);
			if (data.error) {
				setError(data.error);
			} else {
				updatePlugins(data.plugins);
			}
		};

		const handleBulkResult = (event, data) => {
			setBulkAction(null);
			setSelected({});
			if (data.error) {
				setError(data.error);
			} else {
				updatePlugins(data.plugins);
			}
		};

		ipcRenderer.on('debugging-tool:plugins-result', handlePluginsResult);
		ipcRenderer.on('debugging-tool:toggle-plugin-result', handleToggleResult);
		ipcRenderer.on('debugging-tool:bulk-toggle-result', handleBulkResult);

		return () => {
			ipcRenderer.removeListener('debugging-tool:plugins-result', handlePluginsResult);
			ipcRenderer.removeListener('debugging-tool:toggle-plugin-result', handleToggleResult);
			ipcRenderer.removeListener('debugging-tool:bulk-toggle-result', handleBulkResult);
		};
	}, [site.id]);

	const handleToggle = (pluginName, currentStatus) => {
		const activate = currentStatus !== 'active';
		setTogglingPlugin(pluginName);
		setError(null);
		ipcRenderer.send('debugging-tool:toggle-plugin', site.id, pluginName, activate);
	};

	const toggleSelect = (pluginName) => {
		setSelected((prev) => ({
			...prev,
			[pluginName]: !prev[pluginName],
		}));
	};

	const selectedNames = Object.keys(selected).filter((k) => selected[k]);
	const allSelected = plugins.length > 0 && selectedNames.length === plugins.length;

	const toggleSelectAll = () => {
		if (allSelected) {
			setSelected({});
		} else {
			const all = {};
			plugins.forEach((p) => { all[p.name] = true; });
			setSelected(all);
		}
	};

	const handleBulk = (activate) => {
		if (selectedNames.length === 0) return;
		setBulkAction(activate ? 'activate' : 'deactivate');
		setError(null);
		ipcRenderer.send('debugging-tool:bulk-toggle-plugins', site.id, selectedNames, activate);
	};

	const isBusy = togglingPlugin !== null || bulkAction !== null;

	return (
		<div className="debugging-tool-container">
			<div className="debugging-tool-header">
				<h2 className="debugging-tool-title">Plugin Manager</h2>
				<p className="debugging-tool-subtitle">
					Quickly activate or deactivate plugins without loading WordPress admin.
				</p>
			</div>

			{error && (
				<div className="debugging-tool-error">
					<span>{error}</span>
					<button
						className="debugging-tool-btn debugging-tool-btn-small"
						onClick={fetchPlugins}
					>
						Retry
					</button>
				</div>
			)}

			{selectedNames.length > 0 && (
				<div className="debugging-tool-bulk-bar">
					<span className="debugging-tool-bulk-count">
						{selectedNames.length} plugin{selectedNames.length > 1 ? 's' : ''} selected
					</span>
					<div className="debugging-tool-bulk-actions">
						<button
							className="debugging-tool-btn debugging-tool-btn-primary debugging-tool-btn-small"
							onClick={() => handleBulk(true)}
							disabled={isBusy}
						>
							{bulkAction === 'activate' ? 'Activating...' : 'Activate Selected'}
						</button>
						<button
							className="debugging-tool-btn debugging-tool-btn-danger debugging-tool-btn-small"
							onClick={() => handleBulk(false)}
							disabled={isBusy}
						>
							{bulkAction === 'deactivate' ? 'Deactivating...' : 'Deactivate Selected'}
						</button>
					</div>
				</div>
			)}

			{loading ? (
				<div className="debugging-tool-loading">
					<div className="debugging-tool-spinner" />
					<span>Loading plugins...</span>
				</div>
			) : (
				<div className="debugging-tool-table-wrapper">
					<table className="debugging-tool-table">
						<thead>
							<tr>
								<th className="debugging-tool-col-checkbox">
									<label className="debugging-tool-checkbox-wrap">
										<input
											type="checkbox"
											checked={allSelected}
											onChange={toggleSelectAll}
											disabled={isBusy}
										/>
										<span className="debugging-tool-checkmark" />
									</label>
								</th>
								<th className="debugging-tool-col-plugin">Plugin</th>
								<th className="debugging-tool-col-version">Version</th>
								<th className="debugging-tool-col-status">Status</th>
								<th className="debugging-tool-col-toggle">Active</th>
							</tr>
						</thead>
						<tbody>
							{plugins.length === 0 ? (
								<tr>
									<td colSpan={5} className="debugging-tool-empty">
										No plugins found.
									</td>
								</tr>
							) : (
								plugins.map((plugin) => (
									<tr
										key={plugin.name}
										className={
											selected[plugin.name]
												? 'debugging-tool-row-selected'
												: plugin.status !== 'active'
												? 'debugging-tool-row-inactive'
												: ''
										}
									>
										<td>
											<label className="debugging-tool-checkbox-wrap">
												<input
													type="checkbox"
													checked={!!selected[plugin.name]}
													onChange={() => toggleSelect(plugin.name)}
													disabled={isBusy}
												/>
												<span className="debugging-tool-checkmark" />
											</label>
										</td>
										<td>
											<div className="debugging-tool-plugin-name">
												{plugin.title || plugin.name}
											</div>
											<div className="debugging-tool-plugin-slug">
												{plugin.name}
											</div>
										</td>
										<td className="debugging-tool-version">
											{plugin.version}
										</td>
										<td>
											<span
												className={`debugging-tool-badge ${
													plugin.status === 'active'
														? 'debugging-tool-badge-active'
														: 'debugging-tool-badge-inactive'
												}`}
											>
												{plugin.status}
											</span>
										</td>
										<td>
											<div className="debugging-tool-toggle-cell">
												<label className="debugging-tool-switch">
													<input
														type="checkbox"
														checked={plugin.status === 'active'}
														disabled={isBusy}
														onChange={() =>
															handleToggle(plugin.name, plugin.status)
														}
													/>
													<span className="debugging-tool-slider" />
												</label>
												{togglingPlugin === plugin.name && (
													<div className="debugging-tool-spinner-small" />
												)}
											</div>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			)}

			<div className="debugging-tool-footer">
				<button
					className="debugging-tool-btn"
					onClick={fetchPlugins}
					disabled={loading}
				>
					Refresh Plugins
				</button>
			</div>
		</div>
	);
}
