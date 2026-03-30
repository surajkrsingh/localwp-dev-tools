const React = require('react');
const { ipcRenderer } = require('electron');

const { useState, useEffect, useCallback } = React;

const PHP_SETTINGS = [
	{
		key: 'memory_limit',
		label: 'Memory Limit',
		description: 'Maximum memory a PHP script can consume.',
		options: ['64M', '128M', '256M', '512M', '1024M', '2048M'],
	},
	{
		key: 'max_execution_time',
		label: 'Max Execution Time',
		description: 'Maximum time in seconds a script is allowed to run.',
		options: ['30', '60', '120', '300', '600', '0'],
		suffix: 'seconds (0 = unlimited)',
	},
	{
		key: 'max_input_time',
		label: 'Max Input Time',
		description: 'Maximum time in seconds a script is allowed to parse input data.',
		options: ['60', '120', '300', '600', '-1'],
		suffix: 'seconds (-1 = unlimited)',
	},
	{
		key: 'max_input_vars',
		label: 'Max Input Vars',
		description: 'Maximum number of input variables accepted per request.',
		options: ['1000', '3000', '5000', '10000'],
	},
	{
		key: 'post_max_size',
		label: 'Post Max Size',
		description: 'Maximum size of POST data allowed.',
		options: ['8M', '32M', '64M', '128M', '256M', '512M'],
	},
	{
		key: 'upload_max_filesize',
		label: 'Upload Max Filesize',
		description: 'Maximum size of an uploaded file.',
		options: ['2M', '16M', '32M', '64M', '128M', '256M', '512M'],
	},
	{
		key: 'max_file_uploads',
		label: 'Max File Uploads',
		description: 'Maximum number of files that can be uploaded simultaneously.',
		options: ['10', '20', '50', '100'],
	},
	{
		key: 'display_errors',
		label: 'Display Errors',
		description: 'Whether to display PHP errors in the browser output.',
		options: ['On', 'Off'],
	},
	{
		key: 'log_errors',
		label: 'Log Errors',
		description: 'Whether to log PHP errors to the server error log.',
		options: ['On', 'Off'],
	},
	{
		key: 'error_reporting',
		label: 'Error Reporting',
		description: 'Level of error reporting.',
		options: ['E_ALL', 'E_ALL & ~E_NOTICE', 'E_ALL & ~E_NOTICE & ~E_DEPRECATED', 'E_ERROR | E_WARNING | E_PARSE'],
	},
];

export default function ServerConfig({ site, context }) {
	const [config, setConfig] = useState({});
	const [phpIniPath, setPhpIniPath] = useState('');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [saving, setSaving] = useState(null);
	const [notice, setNotice] = useState(null);
	const [customEdit, setCustomEdit] = useState({});

	const fetchConfig = useCallback(() => {
		setLoading(true);
		setError(null);
		ipcRenderer.send('debugging-tool:get-php-config', site.id);
	}, [site.id]);

	useEffect(() => {
		fetchConfig();

		const handleConfigResult = (event, data) => {
			setLoading(false);
			if (data.error) {
				setError(data.error);
			} else {
				setConfig(data.config);
				setPhpIniPath(data.phpIniPath || '');
			}
		};

		const handleSetResult = (event, data) => {
			setSaving(null);
			if (data.error) {
				setError(data.error);
			} else {
				setConfig(data.config);
				if (data.note) {
					setNotice(data.note);
					setTimeout(() => setNotice(null), 5000);
				}
			}
		};

		ipcRenderer.on('debugging-tool:php-config-result', handleConfigResult);
		ipcRenderer.on('debugging-tool:set-php-config-result', handleSetResult);

		return () => {
			ipcRenderer.removeListener('debugging-tool:php-config-result', handleConfigResult);
			ipcRenderer.removeListener('debugging-tool:set-php-config-result', handleSetResult);
		};
	}, [site.id]);

	const handleChange = (key, value) => {
		setSaving(key);
		setError(null);
		setCustomEdit((prev) => { const n = { ...prev }; delete n[key]; return n; });
		ipcRenderer.send('debugging-tool:set-php-config', site.id, key, value);
	};

	const toggleCustom = (key) => {
		setCustomEdit((prev) => ({
			...prev,
			[key]: prev[key] !== undefined ? undefined : config[key] || '',
		}));
	};

	const handleCustomSubmit = (key) => {
		const val = customEdit[key];
		if (val !== undefined && val !== '') {
			handleChange(key, val);
		}
	};

	return (
		<div className="debugging-tool-container">
			<div className="debugging-tool-header">
				<h2 className="debugging-tool-title">Server Config</h2>
				<p className="debugging-tool-subtitle">
					Adjust PHP settings for this site. Restart the site after making changes.
				</p>
			</div>

			{error && (
				<div className="debugging-tool-error">
					<span>{error}</span>
					<button
						className="debugging-tool-btn debugging-tool-btn-small"
						onClick={fetchConfig}
					>
						Retry
					</button>
				</div>
			)}

			{notice && (
				<div className="debugging-tool-notice">
					{notice}
				</div>
			)}

			{phpIniPath && !loading && (
				<div className="debugging-tool-log-meta">
					<span className="debugging-tool-log-path">{phpIniPath}</span>
				</div>
			)}

			{loading ? (
				<div className="debugging-tool-loading">
					<div className="debugging-tool-spinner" />
					<span>Reading PHP configuration...</span>
				</div>
			) : (
				<div className="debugging-tool-server-list">
					{PHP_SETTINGS.map((setting) => {
						const currentValue = config[setting.key] || '';
						const isCustom = customEdit[setting.key] !== undefined;

						return (
							<div key={setting.key} className="debugging-tool-server-item">
								<div className="debugging-tool-server-info">
									<div className="debugging-tool-server-label">
										<span className="debugging-tool-server-name">
											{setting.label}
										</span>
										<code className="debugging-tool-server-key">
											{setting.key}
										</code>
										{saving === setting.key && (
											<div className="debugging-tool-spinner-small" />
										)}
									</div>
									<div className="debugging-tool-server-description">
										{setting.description}
										{setting.suffix && (
											<span className="debugging-tool-server-suffix">
												{' '}({setting.suffix})
											</span>
										)}
									</div>
								</div>
								<div className="debugging-tool-server-control">
									{isCustom ? (
										<div className="debugging-tool-server-custom">
											<input
												type="text"
												className="debugging-tool-input debugging-tool-input-sm"
												value={customEdit[setting.key]}
												onChange={(e) =>
													setCustomEdit((prev) => ({
														...prev,
														[setting.key]: e.target.value,
													}))
												}
												onKeyDown={(e) =>
													e.key === 'Enter' && handleCustomSubmit(setting.key)
												}
												placeholder={currentValue}
												autoFocus
											/>
											<button
												className="debugging-tool-btn debugging-tool-btn-small debugging-tool-btn-primary"
												onClick={() => handleCustomSubmit(setting.key)}
												disabled={saving !== null}
											>
												Set
											</button>
											<button
												className="debugging-tool-btn debugging-tool-btn-small"
												onClick={() => toggleCustom(setting.key)}
											>
												Cancel
											</button>
										</div>
									) : (
										<div className="debugging-tool-server-select-wrap">
											<select
												className="debugging-tool-select"
												value={
													setting.options.includes(currentValue)
														? currentValue
														: '__custom__'
												}
												onChange={(e) => {
													if (e.target.value === '__custom__') {
														toggleCustom(setting.key);
													} else {
														handleChange(setting.key, e.target.value);
													}
												}}
												disabled={saving !== null}
											>
												{!setting.options.includes(currentValue) &&
													currentValue && (
														<option value="__custom__">
															{currentValue} (current)
														</option>
													)}
												{setting.options.map((opt) => (
													<option key={opt} value={opt}>
														{opt}
													</option>
												))}
												{setting.options.includes(currentValue) && (
													<option value="__custom__">Custom...</option>
												)}
											</select>
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}

			<div className="debugging-tool-footer">
				<button
					className="debugging-tool-btn"
					onClick={fetchConfig}
					disabled={loading}
				>
					Refresh
				</button>
			</div>
		</div>
	);
}
