/**
 * Cron Manager — View, run, and delete WP-Cron scheduled events.
 * Card layout: hook name on top, meta (next run, recurrence) + actions below.
 */

const React = require('react');
const { ipcRenderer } = require('electron');

const { useState, useEffect, useCallback } = React;

const cronCache = {};

export default function CronManager({ site }) {
	const cached = cronCache[site.id];
	const [events, setEvents] = useState(cached || []);
	const [loading, setLoading] = useState(!cached);
	const [error, setError] = useState(null);
	const [running, setRunning] = useState(null);
	const [deleting, setDeleting] = useState(null);

	const fetchEvents = useCallback(() => {
		setLoading(true);
		setError(null);
		ipcRenderer.send('debugging-tool:get-cron-events', site.id);
	}, [site.id]);

	useEffect(() => {
		if (!cronCache[site.id]) fetchEvents();

		const updateEvents = (data) => {
			cronCache[site.id] = data;
			setEvents(data);
		};

		const handleEventsResult = (event, data) => {
			setLoading(false);
			if (data.error) setError(data.error);
			else updateEvents(data.events);
		};

		const handleRunResult = (event, data) => {
			setRunning(null);
			if (data.error) setError(data.error);
			else updateEvents(data.events);
		};

		const handleDeleteResult = (event, data) => {
			setDeleting(null);
			if (data.error) setError(data.error);
			else updateEvents(data.events);
		};

		ipcRenderer.on('debugging-tool:cron-events-result', handleEventsResult);
		ipcRenderer.on('debugging-tool:run-cron-result', handleRunResult);
		ipcRenderer.on('debugging-tool:delete-cron-result', handleDeleteResult);

		return () => {
			ipcRenderer.removeListener('debugging-tool:cron-events-result', handleEventsResult);
			ipcRenderer.removeListener('debugging-tool:run-cron-result', handleRunResult);
			ipcRenderer.removeListener('debugging-tool:delete-cron-result', handleDeleteResult);
		};
	}, [site.id]);

	const handleRun = (hook) => {
		setRunning(hook);
		setError(null);
		ipcRenderer.send('debugging-tool:run-cron-event', site.id, hook);
	};

	const handleDelete = (hook) => {
		setDeleting(hook);
		setError(null);
		ipcRenderer.send('debugging-tool:delete-cron-event', site.id, hook);
	};

	const formatNextRun = (timestamp) => {
		if (!timestamp) return '-';
		const date = new Date(timestamp * 1000);
		const now = new Date();
		const diffMs = date.getTime() - now.getTime();

		if (diffMs < 0) return 'Overdue';
		if (diffMs < 60000) return '< 1 min';
		if (diffMs < 3600000) return `${Math.round(diffMs / 60000)} min`;
		if (diffMs < 86400000) return `${Math.round(diffMs / 3600000)} hr`;
		return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
	};

	const isOverdue = (timestamp) => {
		if (!timestamp) return false;
		return new Date(timestamp * 1000).getTime() < Date.now();
	};

	const isBusy = running !== null || deleting !== null;

	return (
		<div className="debugging-tool-container">
			<div className="debugging-tool-header">
				<h2 className="debugging-tool-title">Cron Manager</h2>
				<p className="debugging-tool-subtitle">
					View, run, and manage WordPress scheduled events (WP-Cron).
				</p>
			</div>

			{error && (
				<div className="debugging-tool-error">
					<span>{error}</span>
					<button className="debugging-tool-btn debugging-tool-btn-small" onClick={fetchEvents}>
						Retry
					</button>
				</div>
			)}

			{loading ? (
				<div className="debugging-tool-loading">
					<div className="debugging-tool-spinner" />
					<span>Loading cron events...</span>
				</div>
			) : events.length === 0 ? (
				<div className="debugging-tool-log-empty">
					<div className="debugging-tool-log-empty-icon">--</div>
					<div className="debugging-tool-log-empty-text">No cron events found</div>
				</div>
			) : (
				<div className="debugging-tool-cron-list">
					{events.map((evt, idx) => (
						<div key={evt.hook + '-' + idx} className="debugging-tool-cron-card">
							<div className="debugging-tool-cron-card-header">
								<code className="debugging-tool-cron-hook-name">
									{evt.hook}
								</code>
							</div>
							<div className="debugging-tool-cron-card-footer">
								<div className="debugging-tool-cron-meta">
									<span className={
										'debugging-tool-cron-tag' +
										(isOverdue(evt.next_run) ? ' debugging-tool-cron-tag-overdue' : '')
									}>
										{isOverdue(evt.next_run) ? 'Overdue' : formatNextRun(evt.next_run)}
									</span>
									<span className="debugging-tool-cron-tag debugging-tool-cron-tag-recurrence">
										{evt.recurrence || 'One-time'}
									</span>
								</div>
								<div className="debugging-tool-cron-actions">
									<button
										className="debugging-tool-btn debugging-tool-btn-small debugging-tool-btn-primary"
										onClick={() => handleRun(evt.hook)}
										disabled={isBusy}
									>
										{running === evt.hook ? 'Running...' : 'Run Now'}
									</button>
									<button
										className="debugging-tool-btn debugging-tool-btn-small debugging-tool-btn-danger"
										onClick={() => handleDelete(evt.hook)}
										disabled={isBusy}
									>
										{deleting === evt.hook ? 'Deleting...' : 'Delete'}
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			<div className="debugging-tool-footer">
				<button className="debugging-tool-btn" onClick={fetchEvents} disabled={loading}>
					Refresh
				</button>
				<span className="debugging-tool-footer-count">
					{!loading && events.length > 0 && `${events.length} event${events.length !== 1 ? 's' : ''}`}
				</span>
			</div>
		</div>
	);
}
