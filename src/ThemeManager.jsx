const React = require('react');
const { ipcRenderer } = require('electron');

const { useState, useEffect, useCallback } = React;

// Module-level cache so data survives tab switches
const themeCache = {};

export default function ThemeManager({ site, context }) {
	const cached = themeCache[site.id];
	const [themes, setThemes] = useState(cached || []);
	const [loading, setLoading] = useState(!cached);
	const [error, setError] = useState(null);
	const [activating, setActivating] = useState(null);

	const fetchThemes = useCallback(() => {
		setLoading(true);
		setError(null);
		ipcRenderer.send('debugging-tool:get-themes', site.id);
	}, [site.id]);

	useEffect(() => {
		if (!themeCache[site.id]) {
			fetchThemes();
		}

		const updateThemes = (data) => {
			themeCache[site.id] = data;
			setThemes(data);
		};

		const handleThemesResult = (event, data) => {
			setLoading(false);
			if (data.error) {
				setError(data.error);
			} else {
				updateThemes(data.themes);
			}
		};

		const handleActivateResult = (event, data) => {
			setActivating(null);
			if (data.error) {
				setError(data.error);
			} else {
				updateThemes(data.themes);
			}
		};

		ipcRenderer.on('debugging-tool:themes-result', handleThemesResult);
		ipcRenderer.on('debugging-tool:activate-theme-result', handleActivateResult);

		return () => {
			ipcRenderer.removeListener('debugging-tool:themes-result', handleThemesResult);
			ipcRenderer.removeListener('debugging-tool:activate-theme-result', handleActivateResult);
		};
	}, [site.id]);

	const handleActivate = (themeName) => {
		setActivating(themeName);
		setError(null);
		ipcRenderer.send('debugging-tool:activate-theme', site.id, themeName);
	};

	const isBusy = activating !== null;

	return (
		<div className="debugging-tool-container">
			<div className="debugging-tool-header">
				<h2 className="debugging-tool-title">Theme Manager</h2>
				<p className="debugging-tool-subtitle">
					Switch the active theme instantly without loading WordPress admin.
				</p>
			</div>

			{error && (
				<div className="debugging-tool-error">
					<span>{error}</span>
					<button
						className="debugging-tool-btn debugging-tool-btn-small"
						onClick={fetchThemes}
					>
						Retry
					</button>
				</div>
			)}

			{loading ? (
				<div className="debugging-tool-loading">
					<div className="debugging-tool-spinner" />
					<span>Loading themes...</span>
				</div>
			) : (
				<div className="debugging-tool-theme-grid">
					{themes.length === 0 ? (
						<div className="debugging-tool-empty">No themes found.</div>
					) : (
						themes.map((theme) => {
							const isActive = theme.status === 'active';
							return (
								<div
									key={theme.name}
									className={
										'debugging-tool-theme-card' +
										(isActive ? ' debugging-tool-theme-active' : '')
									}
								>
									<div className="debugging-tool-theme-info">
										<div className="debugging-tool-theme-name">
											{theme.title || theme.name}
										</div>
										<div className="debugging-tool-theme-meta">
											<span className="debugging-tool-theme-slug">
												{theme.name}
											</span>
											<span className="debugging-tool-theme-version">
												v{theme.version}
											</span>
										</div>
									</div>
									<div className="debugging-tool-theme-action">
										{isActive ? (
											<span className="debugging-tool-badge debugging-tool-badge-active">
												Active
											</span>
										) : (
											<button
												className="debugging-tool-btn debugging-tool-btn-small"
												onClick={() => handleActivate(theme.name)}
												disabled={isBusy}
											>
												{activating === theme.name
													? 'Activating...'
													: 'Activate'}
											</button>
										)}
										{activating === theme.name && (
											<div className="debugging-tool-spinner-small" />
										)}
									</div>
								</div>
							);
						})
					)}
				</div>
			)}

			<div className="debugging-tool-footer">
				<button
					className="debugging-tool-btn"
					onClick={fetchThemes}
					disabled={loading}
				>
					Refresh Themes
				</button>
			</div>
		</div>
	);
}
