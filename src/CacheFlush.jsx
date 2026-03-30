const React = require('react');
const { ipcRenderer } = require('electron');

const { useState, useEffect } = React;

const FLUSH_ACTIONS = [
	{
		key: 'object-cache',
		label: 'Object Cache',
		description: 'Flush the WordPress object cache. Clears all cached data stored by wp_cache functions.',
		command: 'wp cache flush',
	},
	{
		key: 'transients',
		label: 'Transients',
		description: 'Delete all transients from the database. Useful when stale transient data causes issues.',
		command: 'wp transient delete --all',
	},
	{
		key: 'rewrite-rules',
		label: 'Rewrite Rules',
		description: 'Flush and regenerate permalink rewrite rules. Fixes 404 errors on pages and posts.',
		command: 'wp rewrite flush',
	},
	{
		key: 'opcache',
		label: 'OPcache',
		description: 'Reset PHP OPcache. Forces PHP to recompile all scripts on next request.',
		command: 'opcache_reset()',
	},
	{
		key: 'post-revisions',
		label: 'Post Revisions',
		description: 'Delete all post revisions from the database. Frees up database space.',
		command: 'wp post delete (revisions) --force',
	},
];

export default function CacheFlush({ site, context }) {
	const [flushing, setFlushing] = useState({});
	const [results, setResults] = useState({});

	useEffect(() => {
		const handleResult = (event, data) => {
			setFlushing((prev) => ({ ...prev, [data.action]: false }));

			if (data.error) {
				setResults((prev) => ({ ...prev, [data.action]: { type: 'error', message: data.error } }));
			} else {
				setResults((prev) => ({
					...prev,
					[data.action]: { type: 'success', message: data.note || 'Done' },
				}));
				// Clear success after 3s
				setTimeout(() => {
					setResults((prev) => {
						const next = { ...prev };
						delete next[data.action];
						return next;
					});
				}, 3000);
			}
		};

		ipcRenderer.on('debugging-tool:flush-cache-result', handleResult);

		return () => {
			ipcRenderer.removeListener('debugging-tool:flush-cache-result', handleResult);
		};
	}, []);

	const handleFlush = (actionKey) => {
		setFlushing((prev) => ({ ...prev, [actionKey]: true }));
		setResults((prev) => {
			const next = { ...prev };
			delete next[actionKey];
			return next;
		});
		ipcRenderer.send('debugging-tool:flush-cache', site.id, actionKey);
	};

	const handleFlushAll = () => {
		FLUSH_ACTIONS.forEach((action) => {
			handleFlush(action.key);
		});
	};

	const anyFlushing = Object.values(flushing).some(Boolean);

	return (
		<div className="debugging-tool-container">
			<div className="debugging-tool-header">
				<h2 className="debugging-tool-title">Cache Flush</h2>
				<p className="debugging-tool-subtitle">
					One-click cache clearing for common WordPress caches.
				</p>
			</div>

			<div className="debugging-tool-flush-list">
				{FLUSH_ACTIONS.map((action) => (
					<div key={action.key} className="debugging-tool-flush-item">
						<div className="debugging-tool-flush-info">
							<div className="debugging-tool-flush-label">
								<span className="debugging-tool-flush-name">{action.label}</span>
								<code className="debugging-tool-flush-command">{action.command}</code>
							</div>
							<div className="debugging-tool-flush-description">
								{action.description}
							</div>
							{results[action.key] && (
								<div
									className={
										'debugging-tool-flush-result ' +
										(results[action.key].type === 'success'
											? 'debugging-tool-flush-success'
											: 'debugging-tool-flush-error-msg')
									}
								>
									{results[action.key].message}
								</div>
							)}
						</div>
						<div className="debugging-tool-flush-action">
							<button
								className="debugging-tool-btn debugging-tool-btn-small"
								onClick={() => handleFlush(action.key)}
								disabled={flushing[action.key] || false}
							>
								{flushing[action.key] ? 'Flushing...' : 'Flush'}
							</button>
							{flushing[action.key] && (
								<div className="debugging-tool-spinner-small" />
							)}
						</div>
					</div>
				))}
			</div>

			<div className="debugging-tool-footer">
				<button
					className="debugging-tool-btn debugging-tool-btn-primary"
					onClick={handleFlushAll}
					disabled={anyFlushing}
				>
					{anyFlushing ? 'Flushing...' : 'Flush All'}
				</button>
			</div>
		</div>
	);
}
