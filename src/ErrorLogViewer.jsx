const React = require('react');
const { ipcRenderer, clipboard } = require('electron');

const { useState, useEffect, useCallback } = React;

export default function ErrorLogViewer({ site, context }) {
	const [logs, setLogs] = useState('');
	const [logPath, setLogPath] = useState('');
	const [totalLines, setTotalLines] = useState(0);
	const [fileSize, setFileSize] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [empty, setEmpty] = useState(false);
	const [copied, setCopied] = useState(false);

	const fetchLogs = useCallback(() => {
		setLoading(true);
		setError(null);
		ipcRenderer.send('debugging-tool:get-error-log', site.id, 50);
	}, [site.id]);

	useEffect(() => {
		fetchLogs();

		const handleLogResult = (event, data) => {
			setLoading(false);
			if (data.error) {
				setError(data.error);
			} else {
				setLogs(data.logs || '');
				setLogPath(data.logPath || '');
				setTotalLines(data.totalLines || 0);
				setFileSize(data.fileSize || 0);
				setEmpty(!!data.empty);
			}
		};

		const handleClearResult = (event, data) => {
			if (data.error) {
				setError(data.error);
			} else {
				setLogs('');
				setTotalLines(0);
				setFileSize(0);
				setEmpty(true);
			}
		};

		const handleDownloadResult = (event, data) => {
			if (data.error) {
				setError(data.error);
			}
		};

		ipcRenderer.on('debugging-tool:error-log-result', handleLogResult);
		ipcRenderer.on('debugging-tool:clear-log-result', handleClearResult);
		ipcRenderer.on('debugging-tool:download-log-result', handleDownloadResult);

		return () => {
			ipcRenderer.removeListener('debugging-tool:error-log-result', handleLogResult);
			ipcRenderer.removeListener('debugging-tool:clear-log-result', handleClearResult);
			ipcRenderer.removeListener('debugging-tool:download-log-result', handleDownloadResult);
		};
	}, [site.id]);

	const handleCopy = () => {
		clipboard.writeText(logs);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleClear = () => {
		ipcRenderer.send('debugging-tool:clear-error-log', site.id);
	};

	const handleDownload = () => {
		ipcRenderer.send('debugging-tool:download-error-log', site.id);
	};

	const formatSize = (bytes) => {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	};

	return (
		<div className="debugging-tool-container">
			<div className="debugging-tool-header">
				<h2 className="debugging-tool-title">Error Log Viewer</h2>
				<p className="debugging-tool-subtitle">
					View recent entries from wp-content/debug.log (last 50 lines).
				</p>
			</div>

			{error && (
				<div className="debugging-tool-error">
					<span>{error}</span>
					<button
						className="debugging-tool-btn debugging-tool-btn-small"
						onClick={fetchLogs}
					>
						Retry
					</button>
				</div>
			)}

			{!loading && !empty && logs && (
				<div className="debugging-tool-log-meta">
					<span>Total lines: {totalLines}</span>
					<span>File size: {formatSize(fileSize)}</span>
					{logPath && <span className="debugging-tool-log-path">{logPath}</span>}
				</div>
			)}

			{loading ? (
				<div className="debugging-tool-loading">
					<div className="debugging-tool-spinner" />
					<span>Reading debug.log...</span>
				</div>
			) : empty || !logs.trim() ? (
				<div className="debugging-tool-log-empty">
					<div className="debugging-tool-log-empty-icon">--</div>
					<div className="debugging-tool-log-empty-text">No log entries found</div>
					<div className="debugging-tool-log-empty-hint">
						Enable WP_DEBUG and WP_DEBUG_LOG in Debug Mode to start capturing errors.
					</div>
				</div>
			) : (
				<div className="debugging-tool-log-wrapper">
					<pre className="debugging-tool-log-content">{logs}</pre>
				</div>
			)}

			<div className="debugging-tool-footer">
				<button
					className="debugging-tool-btn"
					onClick={fetchLogs}
					disabled={loading}
				>
					Refresh
				</button>
				<button
					className="debugging-tool-btn"
					onClick={handleCopy}
					disabled={loading || empty || !logs.trim()}
				>
					{copied ? 'Copied!' : 'Copy Logs'}
				</button>
				<button
					className="debugging-tool-btn"
					onClick={handleDownload}
					disabled={loading || empty}
				>
					Download
				</button>
				<button
					className="debugging-tool-btn debugging-tool-btn-danger"
					onClick={handleClear}
					disabled={loading || empty}
				>
					Clear Log
				</button>
			</div>
		</div>
	);
}
