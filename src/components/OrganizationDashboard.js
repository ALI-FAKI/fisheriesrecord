import React, { useState, useEffect } from 'react';
import api from '../api';
import './OrganizationDashboard.css';

const OrganizationDashboard = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [allCatches, setAllCatches] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const organizationId = user?.organization_id;
  
  // Debug: Log user role
  console.log('Current user:', user);
  console.log('User role:', user?.role);
  console.log('Is Admin?', user?.role === 'admin' || user?.role === 'developer');
  
  // Check for admin role - case insensitive and multiple checks
  const isAdmin = user?.role === 'admin' || 
                  user?.role === 'developer' || 
                  user?.role?.toLowerCase() === 'admin' ||
                  user?.role?.toLowerCase() === 'developer';
  
  console.log('isAdmin final:', isAdmin);

  useEffect(() => {
    if (organizationId) {
      loadData();
      loadAllCatches();
    } else {
      setLoadingData(false);
    }
  }, [organizationId]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get(`/organizations/${organizationId}/stats`),
        api.get(`/organizations/${organizationId}/users`)
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data.users || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to load data' });
    } finally {
      setLoadingData(false);
    }
  };

  const loadAllCatches = async () => {
    try {
      const response = await api.get(`/organizations/${organizationId}/all-catches`);
      setAllCatches(response.data.catches || []);
    } catch (error) {
      console.error('Failed to load catches:', error);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    
    // Validate email
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(newUser.email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      setLoading(false);
      return;
    }
    
    // Validate password
    if (!newUser.password) {
      setMessage({ type: 'error', text: 'Password is required' });
      setLoading(false);
      return;
    }
    
    if (newUser.password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      setLoading(false);
      return;
    }
    
    try {
      const result = await api.post(`/organizations/${organizationId}/workers`, {
        email: newUser.email,
        password: newUser.password,
        full_name: newUser.full_name,
        role: 'worker'
      });
      
      setMessage({ type: 'success', text: `✅ ${result.data.message}` });
      setNewUser({ email: '', password: '', full_name: '' });
      setShowAddUser(false);
      loadData();
      loadAllCatches();
      setTimeout(() => setMessage(null), 4000);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to add user' });
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals from all catches
  const totalCatch = allCatches.reduce((sum, c) => sum + (c.weight_kg || 0), 0);
  const totalEffort = allCatches.reduce((sum, c) => sum + (c.effort_hours || 0), 0);
  const avgCpue = totalEffort > 0 ? (totalCatch / totalEffort).toFixed(2) : 0;

  // Create a map of user IDs to names for proper matching
  const userMap = {};
  users.forEach(u => {
    userMap[u.id] = u.name;
    userMap[u.name] = u.id;
  });

  // Group catches by user
  const catchesByUser = {};
  allCatches.forEach(catchItem => {
    const userId = catchItem.user_id;
    const userName = catchItem.user_name || 'Unknown';
    const key = userId || userName;
    
    if (!catchesByUser[key]) {
      catchesByUser[key] = {
        name: userName,
        userId: userId,
        count: 0,
        totalWeight: 0,
        totalEffort: 0,
        catches: []
      };
    }
    catchesByUser[key].count++;
    catchesByUser[key].totalWeight += catchItem.weight_kg || 0;
    catchesByUser[key].totalEffort += catchItem.effort_hours || 0;
    catchesByUser[key].catches.push(catchItem);
  });

  if (loadingData) {
    return (
      <div className="org-dashboard">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading organization data...</p>
        </div>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="org-dashboard">
        <div className="no-org-message">
          <div className="no-org-icon">🏢</div>
          <h3>No Organization Associated</h3>
          <p>You are not associated with any organization.</p>
          <p className="no-org-hint">Organization admins can view team statistics and manage members here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="org-dashboard">
      <div className="org-header">
        <h2>🏢 Organization Dashboard</h2>
        <p className="org-subtitle">Manage your team and view all workers' data</p>
        {isAdmin && <p className="admin-badge-text">✅ Admin mode active - Add worker button should appear below</p>}
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.type === 'success' ? '✅' : '❌'} {message.text}
        </div>
      )}

      {/* Organization Summary Stats */}
      {stats && (
        <div className="org-stats">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-info">
              <h3>{stats.organization?.total_members || 0}</h3>
              <p>Total Workers</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🐟</div>
            <div className="stat-info">
              <h3>{allCatches.length}</h3>
              <p>Total Catches</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⚖️</div>
            <div className="stat-info">
              <h3>{totalCatch.toFixed(1)} kg</h3>
              <p>Total Catch Weight</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-info">
              <h3>{avgCpue} kg/h</h3>
              <p>Average CPUE</p>
            </div>
          </div>
        </div>
      )}

      {/* Add Worker Button - Visible for Admin */}
      {isAdmin && (
        <div className="org-actions">
          <button onClick={() => setShowAddUser(!showAddUser)} className="btn-add-user">
            {showAddUser ? '❌ Cancel' : '+ Add Worker'}
          </button>
        </div>
      )}

      {/* Show message if not admin */}
      {!isAdmin && (
        <div className="warning-message">
          ⚠️ You are not logged in as Admin. Add worker option is only available for administrators.
          <br />
          Your current role: <strong>{user?.role || 'Unknown'}</strong>
        </div>
      )}

      {/* Add Worker Form */}
      {showAddUser && isAdmin && (
        <div className="add-user-form">
          <h3>➕ Add New Worker</h3>
          <p className="form-hint">Create a new worker account. Password must be at least 6 characters.</p>
          <form onSubmit={handleAddUser}>
            <div className="form-row">
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({...newUser, full_name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  placeholder="Email address"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Password *</label>
              <input
                type="password"
                placeholder="Password (min 6 characters)"
                value={newUser.password}
                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit" disabled={loading} className="btn-submit">
                {loading ? 'Adding...' : 'Add Worker'}
              </button>
              <button type="button" onClick={() => setShowAddUser(false)} className="btn-cancel">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Workers List */}
      <div className="members-section">
        <div className="section-header">
          <h3>👥 Workers</h3>
          <span className="member-count">{users.length} total</span>
        </div>

        {users.length === 0 ? (
          <div className="empty-state">
            <p>No workers yet. Click "Add Worker" to add team members.</p>
          </div>
        ) : (
          <div className="members-table">
            <table>
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Catches</th>
                  <th>Total Catch</th>
                  <th>Avg CPUE</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map(member => {
                  const userCatches = catchesByUser[member.name] || catchesByUser[member.id] || 
                                     Object.values(catchesByUser).find(u => u.name === member.name) ||
                                     { count: 0, totalWeight: 0, totalEffort: 0 };
                  const userAvgCpue = userCatches.totalEffort > 0 ? (userCatches.totalWeight / userCatches.totalEffort).toFixed(2) : 0;
                  return (
                    <tr key={member.id}>
                      <td className="member-name">
                        <span className="member-avatar">{member.name?.charAt(0) || '?'}</span>
                        {member.name}
                      </td>
                      <td>{member.email}</td>
                      <td>
                        <span className={`role-badge ${member.role}`}>
                          {member.role === 'admin' ? '👑 Admin' : '🔧 Worker'}
                        </span>
                      </td>
                      <td>{userCatches.count}</td>
                      <td className="catch-weight">{userCatches.totalWeight.toFixed(1)} kg</td>
                      <td>{userAvgCpue} kg/h</td>
                      <td>
                        <span className={`status-badge ${member.is_active ? 'active' : 'inactive'}`}>
                          {member.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationDashboard;