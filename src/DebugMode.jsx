const React = require('react');
const { ipcRenderer } = require('electron');

const { useState, useEffect, useCallback } = React;

const DEBUG_CONSTANTS = [
	{
		key: 'WP_DEBUG',
		label: 'WP_DEBUG',
		description: 'Enable WordPress debug mode. Shows PHP errors, notices, and warnings.',
	},
	{
		key: 'WP_DEBUG_LOG',
		label: 'WP_DEBUG_LOG',
		description: 'Log errors to wp-content/debug.log file.',
	},
	{
		key: 'WP_DEBUG_DISPLAY',
		label: 'WP_DEBUG_DISPLAY',
		description: 'Display errors on screen. Disable this on production sites.',
	},
	{
		key: 'SCRIPT_DEBUG',
		label: 'SCRIPT_DEBUG',
		description: 'Use unminified versions of CSS and JavaScript files.',
	},
	{
		key: 'SAVEQUERIES',
		label: 'SAVEQUERIES',
		description: 'Save database queries to an array for analysis. Useful for debugging slow queries.',
	},
];

export default function DebugMode({ site, context }) {
	const [debugStatus, setDebugStatus] = useState({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [updatingConstant, setUpdatingConstant] = useState(null);

	const fetchDebugStatus = useCallback(() => {
		setLoading(true);
		setError(null);
		ipcRenderer.send('debugging-tool:get-debug-status', site.id);
	}, [site.id]);

	useEffect(() => {
		fetchDebugStatus();

		const handleStatusResult = (event, data) => {
			setLoading(false);
			if (data.error) {
				setError(data.error);
			} else {
				setDebugStatus(data.debugStatus);
			}
		};

		const handleSetResult = (event, data) => {
			setUpdatingConstant(null);
			if (data.error) {
				setError(data.error);
			} else {
				setDebugStatus(data.debugStatus);
			}
		};

		ipcRenderer.on('debugging-tool:debug-status-result', handleStatusResult);
		ipcRenderer.on('debugging-tool:set-debug-result', handleSetResult);

		return () => {
			ipcRenderer.removeListener('debugging-tool:debug-status-result', handleStatusResult);
			ipcRenderer.removeListener('debugging-tool:set-debug-result', handleSetResult);
		};
	}, [site.id]);

	const handleToggle = (constant, currentValue) => {
		setUpdatingConstant(constant);
		setError(null);
		ipcRenderer.send(
			'debugging-tool:set-debug-constant',
			site.id,
			constant,
			!currentValue,
		);
	};

	const enableAll = () => {
		DEBUG_CONSTANTS.forEach((item) => {
			if (!debugStatus[item.key]) {
				ipcRenderer.send(
					'debugging-tool:set-debug-constant',
					site.id,
					item.key,
					true,
				);
			}
		});
		setUpdatingConstant('all');
		setTimeout(fetchDebugStatus, 500);
	};

	const disableAll = () => {
		DEBUG_CONSTANTS.forEach((item) => {
			if (debugStatus[item.key]) {
				ipcRenderer.send(
					'debugging-tool:set-debug-constant',
					site.id,
					item.key,
					false,
				);
			}
		});
		setUpdatingConstant('all');
		setTimeout(fetchDebugStatus, 500);
	};

	return (
		<div className="debugging-tool-container">
			<div className="debugging-tool-header">
				<h2 className="debugging-tool-title">Debug Mode</h2>
				<p className="debugging-tool-subtitle">
					Toggle WordPress debug constants in wp-config.php without manually editing files.
				</p>
			</div>

			{error && (
				<div className="debugging-tool-error">
					<span>{error}</span>
					<button
						className="debugging-tool-btn debugging-tool-btn-small"
						onClick={fetchDebugStatus}
					>
						Retry
					</button>
				</div>
			)}

			{loading ? (
				<div className="debugging-tool-loading">
					<div className="debugging-tool-spinner" />
					<span>Reading wp-config.php...</span>
				</div>
			) : (
				<div className="debugging-tool-debug-list">
					{DEBUG_CONSTANTS.map((item) => (
						<div key={item.key} className="debugging-tool-debug-item">
							<div className="debugging-tool-debug-info">
								<div className="debugging-tool-debug-label">
									<code>{item.label}</code>
									<span
										className={`debugging-tool-badge ${
											debugStatus[item.key]
												? 'debugging-tool-badge-active'
												: 'debugging-tool-badge-inactive'
										}`}
									>
										{debugStatus[item.key] ? 'Enabled' : 'Disabled'}
									</span>
								</div>
								<div className="debugging-tool-debug-description">
									{item.description}
								</div>
							</div>
							<div className="debugging-tool-debug-toggle">
								<label className="debugging-tool-switch">
									<input
										type="checkbox"
										checked={!!debugStatus[item.key]}
										disabled={updatingConstant !== null}
										onChange={() =>
											handleToggle(item.key, debugStatus[item.key])
										}
									/>
									<span className="debugging-tool-slider" />
								</label>
								{updatingConstant === item.key && (
									<div className="debugging-tool-spinner-small" />
								)}
							</div>
						</div>
					))}
				</div>
			)}

			<div className="debugging-tool-footer">
				<button
					className="debugging-tool-btn debugging-tool-btn-primary"
					onClick={enableAll}
					disabled={loading || updatingConstant !== null}
				>
					Enable All
				</button>
				<button
					className="debugging-tool-btn"
					onClick={disableAll}
					disabled={loading || updatingConstant !== null}
				>
					Disable All
				</button>
				<button
					className="debugging-tool-btn"
					onClick={fetchDebugStatus}
					disabled={loading}
				>
					Refresh
				</button>
			</div>
		</div>
	);
}
