const React = require('react');
const { ipcRenderer } = require('electron');

const { useState, useEffect, useCallback } = React;

const snapshotCache = {};

export default function DbSnapshot({ site, context }) {
	const cached = snapshotCache[site.id];
	const [snapshots, setSnapshots] = useState(cached || []);
	const [loading, setLoading] = useState(!cached);
	const [error, setError] = useState(null);
	const [creating, setCreating] = useState(false);
	const [restoring, setRestoring] = useState(null);
	const [snapshotName, setSnapshotName] = useState('');
	const [showNameInput, setShowNameInput] = useState(false);

	const fetchSnapshots = useCallback(() => {
		setLoading(true);
		setError(null);
		ipcRenderer.send('debugging-tool:get-snapshots', site.id);
	}, [site.id]);

	useEffect(() => {
		if (!snapshotCache[site.id]) {
			fetchSnapshots();
		}

		const updateSnapshots = (data) => {
			snapshotCache[site.id] = data;
			setSnapshots(data);
		};

		const handleSnapshotsResult = (event, data) => {
			setLoading(false);
			if (data.error) {
				setError(data.error);
			} else {
				updateSnapshots(data.snapshots);
			}
		};

		const handleCreateResult = (event, data) => {
			setCreating(false);
			setSnapshotName('');
			setShowNameInput(false);
			if (data.error) {
				setError(data.error);
			} else {
				updateSnapshots(data.snapshots);
			}
		};

		const handleRestoreResult = (event, data) => {
			setRestoring(null);
			if (data.error) {
				setError(data.error);
			}
		};

		const handleDeleteResult = (event, data) => {
			if (data.error) {
				setError(data.error);
			} else {
				updateSnapshots(data.snapshots);
			}
		};

		const handleDownloadResult = (event, data) => {
			if (data.error) {
				setError(data.error);
			}
		};

		ipcRenderer.on('debugging-tool:snapshots-result', handleSnapshotsResult);
		ipcRenderer.on('debugging-tool:create-snapshot-result', handleCreateResult);
		ipcRenderer.on('debugging-tool:restore-snapshot-result', handleRestoreResult);
		ipcRenderer.on('debugging-tool:delete-snapshot-result', handleDeleteResult);
		ipcRenderer.on('debugging-tool:download-snapshot-result', handleDownloadResult);

		return () => {
			ipcRenderer.removeListener('debugging-tool:snapshots-result', handleSnapshotsResult);
			ipcRenderer.removeListener('debugging-tool:create-snapshot-result', handleCreateResult);
			ipcRenderer.removeListener('debugging-tool:restore-snapshot-result', handleRestoreResult);
			ipcRenderer.removeListener('debugging-tool:delete-snapshot-result', handleDeleteResult);
			ipcRenderer.removeListener('debugging-tool:download-snapshot-result', handleDownloadResult);
		};
	}, [site.id]);

	const handleCreate = () => {
		setCreating(true);
		setError(null);
		ipcRenderer.send('debugging-tool:create-snapshot', site.id, snapshotName || 'snapshot');
	};

	const handleRestore = (snap) => {
		setRestoring(snap.name);
		setError(null);
		ipcRenderer.send('debugging-tool:restore-snapshot', site.id, snap.path);
	};

	const handleDelete = (snap) => {
		setError(null);
		ipcRenderer.send('debugging-tool:delete-snapshot', site.id, snap.path);
	};

	const handleDownload = (snap) => {
		ipcRenderer.send('debugging-tool:download-snapshot', site.id, snap.path, snap.name);
	};

	const formatSize = (bytes) => {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	};

	const formatDate = (iso) => {
		const d = new Date(iso);
		return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
	};

	const isBusy = creating || restoring !== null;

	return (
		<div className="debugging-tool-container">
			<div className="debugging-tool-header">
				<h2 className="debugging-tool-title">DB Snapshots</h2>
				<p className="debugging-tool-subtitle">
					Create database backups and restore them instantly. Snapshots are stored in the site directory.
				</p>
			</div>

			{error && (
				<div className="debugging-tool-error">
					<span>{error}</span>
					<button
						className="debugging-tool-btn debugging-tool-btn-small"
						onClick={() => setError(null)}
					>
						Dismiss
					</button>
				</div>
			)}

			{/* Create Snapshot Section */}
			<div className="debugging-tool-snapshot-create">
				{showNameInput ? (
					<div className="debugging-tool-snapshot-form">
						<input
							type="text"
							className="debugging-tool-input"
							placeholder="Snapshot name (optional)"
							value={snapshotName}
							onChange={(e) => setSnapshotName(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
							disabled={creating}
							autoFocus
						/>
						<button
							className="debugging-tool-btn debugging-tool-btn-primary"
							onClick={handleCreate}
							disabled={creating}
						>
							{creating ? 'Creating...' : 'Create'}
						</button>
						<button
							className="debugging-tool-btn"
							onClick={() => { setShowNameInput(false); setSnapshotName(''); }}
							disabled={creating}
						>
							Cancel
						</button>
					</div>
				) : (
					<button
						className="debugging-tool-btn debugging-tool-btn-primary"
						onClick={() => setShowNameInput(true)}
						disabled={isBusy}
					>
						Create New Snapshot
					</button>
				)}
				{creating && (
					<div className="debugging-tool-snapshot-progress">
						<div className="debugging-tool-spinner-small" />
						<span>Exporting database...</span>
					</div>
				)}
			</div>

			{/* Snapshot List */}
			{loading ? (
				<div className="debugging-tool-loading">
					<div className="debugging-tool-spinner" />
					<span>Loading snapshots...</span>
				</div>
			) : snapshots.length === 0 ? (
				<div className="debugging-tool-log-empty">
					<div className="debugging-tool-log-empty-icon">--</div>
					<div className="debugging-tool-log-empty-text">No snapshots yet</div>
					<div className="debugging-tool-log-empty-hint">
						Create your first snapshot to back up the current database state.
					</div>
				</div>
			) : (
				<div className="debugging-tool-snapshot-list">
					{snapshots.map((snap) => (
						<div key={snap.name} className="debugging-tool-snapshot-item">
							<div className="debugging-tool-snapshot-info">
								<div className="debugging-tool-snapshot-name">
									{snap.name}
								</div>
								<div className="debugging-tool-snapshot-meta">
									<span>{formatDate(snap.created)}</span>
									<span>{formatSize(snap.size)}</span>
								</div>
							</div>
							<div className="debugging-tool-snapshot-actions">
								<button
									className="debugging-tool-btn debugging-tool-btn-small"
									onClick={() => handleRestore(snap)}
									disabled={isBusy}
									title="Restore this snapshot"
								>
									{restoring === snap.name ? 'Restoring...' : 'Restore'}
								</button>
								<button
									className="debugging-tool-btn debugging-tool-btn-small"
									onClick={() => handleDownload(snap)}
									disabled={isBusy}
									title="Download .sql file"
								>
									Download
								</button>
								<button
									className="debugging-tool-btn debugging-tool-btn-small debugging-tool-btn-danger"
									onClick={() => handleDelete(snap)}
									disabled={isBusy}
									title="Delete this snapshot"
								>
									Delete
								</button>
							</div>
						</div>
					))}
				</div>
			)}

			<div className="debugging-tool-footer">
				<button
					className="debugging-tool-btn"
					onClick={fetchSnapshots}
					disabled={loading}
				>
					Refresh
				</button>
			</div>
		</div>
	);
}
