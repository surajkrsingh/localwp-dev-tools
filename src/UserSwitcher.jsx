/**
 * User Switcher — List WordPress users and login as any user with one click.
 * Supports search filtering and pagination for sites with many users.
 */

const React = require('react');
const { ipcRenderer } = require('electron');

const { useState, useEffect, useCallback, useMemo } = React;

const userCache = {};
const USERS_PER_PAGE = 20;

const ROLE_COLORS = {
	administrator: '#51bb7b',
	editor: '#3b82f6',
	author: '#a855f7',
	contributor: '#f59e0b',
	subscriber: '#6b7280',
};

export default function UserSwitcher({ site }) {
	const cached = userCache[site.id];
	const [users, setUsers] = useState(cached || []);
	const [loading, setLoading] = useState(!cached);
	const [error, setError] = useState(null);
	const [loggingIn, setLoggingIn] = useState(null);
	const [success, setSuccess] = useState(null);
	const [search, setSearch] = useState('');
	const [page, setPage] = useState(1);
	const [roleFilter, setRoleFilter] = useState('');

	const fetchUsers = useCallback(() => {
		setLoading(true);
		setError(null);
		ipcRenderer.send('debugging-tool:get-users', site.id);
	}, [site.id]);

	useEffect(() => {
		if (!userCache[site.id]) fetchUsers();

		const updateUsers = (data) => {
			userCache[site.id] = data;
			setUsers(data);
		};

		const handleUsersResult = (event, data) => {
			setLoading(false);
			if (data.error) setError(data.error);
			else updateUsers(data.users);
		};

		const handleLoginResult = (event, data) => {
			setLoggingIn(null);
			if (data.error) {
				setError(data.error);
			} else if (data.success) {
				setSuccess('Login link opened in browser');
				setTimeout(() => setSuccess(null), 3000);
			}
		};

		ipcRenderer.on('debugging-tool:users-result', handleUsersResult);
		ipcRenderer.on('debugging-tool:login-as-result', handleLoginResult);

		return () => {
			ipcRenderer.removeListener('debugging-tool:users-result', handleUsersResult);
			ipcRenderer.removeListener('debugging-tool:login-as-result', handleLoginResult);
		};
	}, [site.id]);

	const handleLogin = (userId) => {
		setLoggingIn(userId);
		setError(null);
		setSuccess(null);
		ipcRenderer.send('debugging-tool:login-as-user', site.id, userId);
	};

	const getRoleName = (roles) => {
		if (!roles) return 'none';
		return typeof roles === 'string' ? roles : Object.keys(roles)[0] || 'none';
	};

	const getRoleColor = (roles) => {
		return ROLE_COLORS[getRoleName(roles)] || ROLE_COLORS.subscriber;
	};

	// Get unique roles for filter dropdown
	const availableRoles = useMemo(() => {
		const roles = new Set();
		users.forEach((u) => roles.add(getRoleName(u.roles)));
		return Array.from(roles).sort();
	}, [users]);

	// Filter and paginate
	const filtered = useMemo(() => {
		let result = users;

		if (roleFilter) {
			result = result.filter((u) => getRoleName(u.roles) === roleFilter);
		}

		if (search.trim()) {
			const q = search.toLowerCase();
			result = result.filter((u) =>
				(u.user_login || '').toLowerCase().includes(q) ||
				(u.display_name || '').toLowerCase().includes(q) ||
				(u.user_email || '').toLowerCase().includes(q) ||
				String(u.ID).includes(q)
			);
		}

		return result;
	}, [users, search, roleFilter]);

	const totalPages = Math.ceil(filtered.length / USERS_PER_PAGE);
	const paginated = filtered.slice((page - 1) * USERS_PER_PAGE, page * USERS_PER_PAGE);

	// Reset page when filters change
	useEffect(() => { setPage(1); }, [search, roleFilter]);

	return (
		<div className="debugging-tool-container">
			<div className="debugging-tool-header">
				<h2 className="debugging-tool-title">User Switcher</h2>
				<p className="debugging-tool-subtitle">
					Quickly log in as any WordPress user to test roles and permissions.
				</p>
			</div>

			{error && (
				<div className="debugging-tool-error">
					<span>{error}</span>
					<button className="debugging-tool-btn debugging-tool-btn-small" onClick={fetchUsers}>
						Retry
					</button>
				</div>
			)}

			{success && (
				<div className="debugging-tool-notice" style={{ color: '#51bb7b', borderColor: 'rgba(81,187,123,0.25)', background: 'rgba(81,187,123,0.1)' }}>
					{success}
				</div>
			)}

			{/* Search & Filter Bar */}
			{!loading && users.length > 0 && (
				<div className="debugging-tool-user-toolbar">
					<input
						type="text"
						className="debugging-tool-input"
						placeholder="Search by name, email, or ID..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
					<select
						className="debugging-tool-select"
						value={roleFilter}
						onChange={(e) => setRoleFilter(e.target.value)}
					>
						<option value="">All roles</option>
						{availableRoles.map((role) => (
							<option key={role} value={role}>{role}</option>
						))}
					</select>
					<span className="debugging-tool-user-count">
						{filtered.length} of {users.length} user{users.length !== 1 ? 's' : ''}
					</span>
				</div>
			)}

			{loading ? (
				<div className="debugging-tool-loading">
					<div className="debugging-tool-spinner" />
					<span>Loading users...</span>
				</div>
			) : paginated.length === 0 ? (
				<div className="debugging-tool-log-empty">
					<div className="debugging-tool-log-empty-icon">--</div>
					<div className="debugging-tool-log-empty-text">
						{users.length === 0 ? 'No users found' : 'No users match your search'}
					</div>
				</div>
			) : (
				<div className="debugging-tool-user-list">
					{paginated.map((user) => {
						const role = getRoleName(user.roles);
						const roleColor = getRoleColor(user.roles);

						return (
							<div key={user.ID} className="debugging-tool-user-item">
								<div className="debugging-tool-user-avatar">
									{(user.display_name || user.user_login || '?')[0].toUpperCase()}
								</div>
								<div className="debugging-tool-user-info">
									<div className="debugging-tool-user-name">
										{user.display_name || user.user_login}
										<span className="debugging-tool-user-id">#{user.ID}</span>
									</div>
									<div className="debugging-tool-user-meta">
										<span>{user.user_login}</span>
										<span>{user.user_email}</span>
										<span
											className="debugging-tool-user-role"
											style={{ color: roleColor, borderColor: roleColor + '40', backgroundColor: roleColor + '15' }}
										>
											{role}
										</span>
									</div>
								</div>
								<div className="debugging-tool-user-action">
									<button
										className="debugging-tool-btn debugging-tool-btn-small debugging-tool-btn-primary"
										onClick={() => handleLogin(user.ID)}
										disabled={loggingIn !== null}
									>
										{loggingIn === user.ID ? 'Opening...' : 'Login as'}
									</button>
									{loggingIn === user.ID && (
										<div className="debugging-tool-spinner-small" />
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}

			{/* Pagination */}
			{totalPages > 1 && (
				<div className="debugging-tool-pagination">
					<button
						className="debugging-tool-btn debugging-tool-btn-small"
						onClick={() => setPage((p) => Math.max(1, p - 1))}
						disabled={page === 1}
					>
						Previous
					</button>
					<span className="debugging-tool-pagination-info">
						Page {page} of {totalPages}
					</span>
					<button
						className="debugging-tool-btn debugging-tool-btn-small"
						onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
						disabled={page === totalPages}
					>
						Next
					</button>
				</div>
			)}

			<div className="debugging-tool-footer">
				<button className="debugging-tool-btn" onClick={fetchUsers} disabled={loading}>
					Refresh
				</button>
			</div>
		</div>
	);
}
