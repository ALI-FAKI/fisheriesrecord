import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { getDashboardSummary, getAdminDashboardSummary } from '../api';
import './Dashboard.css';

const Dashboard = ({ refreshTrigger }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const COLORS = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe'];
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const role = user?.role;
    setIsAdmin(role === 'admin');
    fetchDashboardData();
  }, [refreshTrigger, user?.role]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let dashboardData;
      const userRole = user?.role;
      
      if (userRole === 'admin') {
        dashboardData = await getAdminDashboardSummary();
      } else {
        dashboardData = await getDashboardSummary();
      }
      setData(dashboardData);
    } catch (err) {
      console.error('Dashboard error:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <p>{error}</p>
        <button onClick={fetchDashboardData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>{isAdmin ? '📊 Admin Dashboard' : '📊 My Fishing Dashboard'}</h2>
        {!isAdmin && (
          <p className="dashboard-subtitle">Welcome back, {user?.full_name || 'Fisher'}!</p>
        )}
        {isAdmin && data?.summary?.total_workers > 0 && (
          <p className="dashboard-subtitle">
            Viewing organization-wide data from <strong>{data.summary.total_workers}</strong> workers
          </p>
        )}
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="card">
          <div className="card-icon">🐟</div>
          <div className="card-content">
            <h3>Total Catch</h3>
            <div className="card-value">{data?.summary?.total_catch_kg?.toFixed(1) || 0} kg</div>
            {isAdmin && <div className="card-hint">Organization total</div>}
          </div>
        </div>
        
        <div className="card">
          <div className="card-icon">⚡</div>
          <div className="card-content">
            <h3>Average CPUE</h3>
            <div className="card-value">{data?.summary?.average_cpue?.toFixed(2) || 0} kg/h</div>
            {isAdmin && <div className="card-hint">Organization average</div>}
          </div>
        </div>
        
        <div className="card">
          <div className="card-icon">⏱️</div>
          <div className="card-content">
            <h3>Total Effort</h3>
            <div className="card-value">{data?.summary?.total_effort_hours?.toFixed(1) || 0} hrs</div>
          </div>
        </div>
        
        <div className="card">
          <div className="card-icon">📊</div>
          <div className="card-content">
            <h3>Total Records</h3>
            <div className="card-value">{data?.summary?.total_records || 0}</div>
            {isAdmin && <div className="card-hint">Across all workers</div>}
          </div>
        </div>
      </div>

      {/* Worker Performance Table - Enhanced Visualization */}
      {isAdmin && data?.worker_stats && data.worker_stats.length > 0 && (
        <div className="worker-stats">
          <div className="section-header">
            <h3>👥 Worker Performance</h3>
            <div className="stats-summary">
              <span className="stat-badge">
                📈 Top Performer: {data.worker_stats.reduce((best, w) => 
                  w.total_catch_kg > best.total_catch_kg ? w : best, data.worker_stats[0]
                )?.name || 'N/A'}
              </span>
            </div>
          </div>
          
          <div className="worker-table-container">
            <table className="worker-table">
              <thead>
                <tr>
                  <th>👤 Worker</th>
                  <th>📊 Total Catches</th>
                  <th>⚖️ Total Catch (kg)</th>
                  <th>📈 Avg CPUE (kg/h)</th>
                  <th>🏆 Performance</th>
                </tr>
              </thead>
              <tbody>
                {data.worker_stats.map((worker, idx) => {
                  // Calculate performance level
                  let performanceLevel = '';
                  let performanceColor = '';
                  const avgCpue = worker.avg_cpue;
                  
                  if (avgCpue >= 2.0) {
                    performanceLevel = 'Excellent';
                    performanceColor = '#28a745';
                  } else if (avgCpue >= 1.0) {
                    performanceLevel = 'Good';
                    performanceColor = '#17a2b8';
                  } else if (avgCpue >= 0.5) {
                    performanceLevel = 'Average';
                    performanceColor = '#ffc107';
                  } else if (avgCpue > 0) {
                    performanceLevel = 'Below Average';
                    performanceColor = '#fd7e14';
                  } else {
                    performanceLevel = 'No Data';
                    performanceColor = '#6c757d';
                  }
                  
                  // Calculate progress bar width
                  const maxCatch = Math.max(...data.worker_stats.map(w => w.total_catch_kg), 1);
                  const progressWidth = (worker.total_catch_kg / maxCatch) * 100;
                  
                  return (
                    <tr key={idx} className={idx === 0 && worker.total_catch_kg > 0 ? 'top-performer' : ''}>
                      <td className="worker-name-cell">
                        <div className="worker-avatar">
                          {worker.name?.charAt(0) || '?'}
                        </div>
                        <strong>{worker.name}</strong>
                      </td>
                      <td>{worker.total_catches}</td>
                      <td className="catch-weight-cell">
                        <div className="progress-container">
                          <div className="progress-bar" style={{ width: `${progressWidth}%` }}></div>
                          <span className="progress-value">{worker.total_catch_kg} kg</span>
                        </div>
                      </td>
                      <td>
                        <span className="cpue-badge" style={{ backgroundColor: performanceColor + '20', color: performanceColor }}>
                          {worker.avg_cpue} kg/h
                        </span>
                      </td>
                      <td>
                        <span className="performance-badge" style={{ backgroundColor: performanceColor + '20', color: performanceColor }}>
                          {performanceLevel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Summary Footer */}
          <div className="worker-stats-footer">
            <div className="footer-stat">
              <span>📊 Total Workers:</span>
              <strong>{data.worker_stats.length}</strong>
            </div>
            <div className="footer-stat">
              <span>🏆 Top Performer:</span>
              <strong>
                {data.worker_stats.reduce((best, w) => 
                  w.total_catch_kg > best.total_catch_kg ? w : best, data.worker_stats[0]
                )?.name || 'N/A'}
              </strong>
            </div>
            <div className="footer-stat">
              <span>⚖️ Total Team Catch:</span>
              <strong>{data.summary?.total_catch_kg?.toFixed(1) || 0} kg</strong>
            </div>
          </div>
        </div>
      )}

      {/* Empty State for No Workers */}
      {isAdmin && (!data?.worker_stats || data.worker_stats.length === 0) && (
        <div className="empty-workers">
          <div className="empty-icon">👥</div>
          <h4>No Workers Yet</h4>
          <p>Add workers to start tracking team performance.</p>
        </div>
      )}

      {/* Charts */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3>CPUE Timeline {isAdmin ? '(All Workers)' : '(Your Data)'}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data?.cpue_timeline || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" label={{ value: 'CPUE (kg/h)', angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" orientation="right" label={{ value: 'Catch (kg)', angle: 90, position: 'insideRight' }} />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="cpue" stroke="#667eea" name="CPUE" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="catch" stroke="#764ba2" name="Catch" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Monthly CPUE Analysis {isAdmin ? '(All Workers)' : ''}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data?.monthly_analysis || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month_name" />
              <YAxis label={{ value: 'CPUE (kg/h)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="avg_cpue" fill="#667eea" name="Avg CPUE" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Top Fish Species {isAdmin ? '(Organization)' : '(Your Catches)'}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data?.summary?.top_fish_species || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={entry => `${entry.fish_type}: ${entry.total_weight.toFixed(0)}kg`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="total_weight"
              >
                {(data?.summary?.top_fish_species || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;