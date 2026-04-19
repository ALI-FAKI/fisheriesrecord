import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
  ComposedChart
} from 'recharts';
import { getDashboardSummary, getAdminDashboardSummary, getCatches, getLocations } from '../api';
import './Dashboard.css';

const Dashboard = ({ refreshTrigger }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [environmentalData, setEnvironmentalData] = useState([]);
  const [locationTrendData, setLocationTrendData] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState([]);
  const [showLocationTrend, setShowLocationTrend] = useState(false);
  const [timelineData, setTimelineData] = useState([]);

  const COLORS = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe'];
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const role = user?.role;
    setIsAdmin(role === 'admin');
    fetchDashboardData();
    fetchEnvironmentalData();
    fetchLocations();
    fetchTimelineData();
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

  const fetchTimelineData = async () => {
    try {
      const response = await getCatches(1, 500);
      const catches = response.data || [];
      
      const sortedCatches = [...catches].sort((a, b) => new Date(a.date) - new Date(b.date));
      
      let runningTotal = 0;
      const timeline = sortedCatches.map((catchItem, index) => {
        runningTotal += catchItem.weight_kg;
        return {
          trip: index + 1,
          date: catchItem.date,
          cpue: catchItem.cpue || (catchItem.weight_kg / catchItem.effort_hours),
          catch: catchItem.weight_kg,
          totalCatch: runningTotal
        };
      }).filter(item => item.catch > 0);
      
      setTimelineData(timeline);
    } catch (err) {
      console.error('Error fetching timeline data:', err);
    }
  };

  const fetchEnvironmentalData = async () => {
    try {
      const response = await getCatches(1, 500);
      const catches = response.data || [];
      
      const sortedCatches = [...catches].sort((a, b) => new Date(a.date) - new Date(b.date));
      
      const dailyData = sortedCatches.map((catchItem, index) => ({
        trip: index + 1,
        date: catchItem.date,
        temperature: catchItem.temperature || 25,
        rainfall: catchItem.rainfall || 5,
        windSpeed: catchItem.wind_speed || 12,
        catchKg: catchItem.weight_kg,
        cpue: catchItem.cpue || (catchItem.weight_kg / catchItem.effort_hours),
        effort: catchItem.effort_hours
      })).filter(item => item.catchKg > 0);
      
      setEnvironmentalData(dailyData);
    } catch (err) {
      console.error('Error fetching environmental data:', err);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await getLocations();
      setLocations(response.locations || []);
      if (response.locations && response.locations.length > 0) {
        setSelectedLocation(response.locations[0].name);
      }
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  };

  const fetchLocationTrend = async () => {
    if (!selectedLocation) return;
    
    setShowLocationTrend(true);
    try {
      const response = await getCatches(1, 500);
      const catches = response.data || [];
      
      const locationCatches = catches.filter(c => c.location === selectedLocation);
      const sortedCatches = [...locationCatches].sort((a, b) => new Date(a.date) - new Date(b.date));
      
      const dailyData = sortedCatches.map((catchItem, index) => ({
        trip: index + 1,
        date: catchItem.date,
        catch: catchItem.weight_kg,
        cpue: catchItem.cpue || (catchItem.weight_kg / catchItem.effort_hours),
        effort: catchItem.effort_hours
      }));
      
      setLocationTrendData(dailyData);
    } catch (err) {
      console.error('Error fetching location trend:', err);
    }
  };

  useEffect(() => {
    if (selectedLocation) {
      fetchLocationTrend();
    }
  }, [selectedLocation]);

  // Custom tick formatter to prevent label overlap
  const formatXAxis = (tickItem) => {
    if (tickItem > 20) {
      return tickItem % 5 === 0 ? tickItem : '';
    }
    return tickItem;
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
            Viewing data from <strong>{data.summary.total_workers}</strong> workers
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
            {isAdmin && <div className="card-hint">Team total</div>}
          </div>
        </div>
        
        <div className="card">
          <div className="card-icon">⚡</div>
          <div className="card-content">
            <h3>Avg CPUE</h3>
            <div className="card-value">{data?.summary?.average_cpue?.toFixed(2) || 0} kg/h</div>
            {isAdmin && <div className="card-hint">Team avg</div>}
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
            <h3>Records</h3>
            <div className="card-value">{data?.summary?.total_records || 0}</div>
            {isAdmin && <div className="card-hint">All workers</div>}
          </div>
        </div>
      </div>

      {/* Worker Performance Table */}
      {isAdmin && data?.worker_stats && data.worker_stats.length > 0 && (
        <div className="worker-stats">
          <div className="section-header">
            <h3>👥 Worker Performance</h3>
            <span className="stat-badge">
              🏆 Top: {data.worker_stats.reduce((best, w) => 
                w.total_catch_kg > best.total_catch_kg ? w : best, data.worker_stats[0]
              )?.name || 'N/A'}
            </span>
          </div>
          
          <div className="worker-table-container">
            <table className="worker-table">
              <thead>
                <tr><th>Worker</th><th>Catches</th><th>Catch (kg)</th><th>CPUE</th><th>Level</th></tr>
              </thead>
              <tbody>
                {data.worker_stats.slice(0, 10).map((worker, idx) => {
                  const avgCpue = worker.avg_cpue;
                  let perfLabel = '', perfColor = '';
                  if (avgCpue >= 2.0) { perfLabel = 'Excellent'; perfColor = '#28a745'; }
                  else if (avgCpue >= 1.0) { perfLabel = 'Good'; perfColor = '#17a2b8'; }
                  else if (avgCpue >= 0.5) { perfLabel = 'Avg'; perfColor = '#ffc107'; }
                  else if (avgCpue > 0) { perfLabel = 'Low'; perfColor = '#fd7e14'; }
                  else { perfLabel = 'No data'; perfColor = '#6c757d'; }
                  
                  const maxCatch = Math.max(...data.worker_stats.map(w => w.total_catch_kg), 1);
                  const progressWidth = (worker.total_catch_kg / maxCatch) * 100;
                  
                  return (
                    <tr key={idx}>
                      <td className="worker-name-cell"><div className="worker-avatar">{worker.name?.charAt(0) || '?'}</div>{worker.name}</td>
                      <td>{worker.total_catches}</td>
                      <td className="catch-weight-cell"><div className="progress-container"><div className="progress-bar" style={{ width: `${progressWidth}%` }}></div><span className="progress-value">{worker.total_catch_kg} kg</span></div></td>
                      <td>{worker.avg_cpue} kg/h</td><td><span className="perf-badge" style={{ backgroundColor: perfColor + '20', color: perfColor }}>{perfLabel}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="worker-stats-footer">
            <span>📊 Workers: {data.worker_stats.length}</span>
            <span>🏆 Top: {data.worker_stats.reduce((best, w) => w.total_catch_kg > best.total_catch_kg ? w : best, data.worker_stats[0])?.name || 'N/A'}</span>
            <span>⚖️ Team: {data.summary?.total_catch_kg?.toFixed(1) || 0} kg</span>
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

      {/* GRAPH 1: Catch vs Environmental Factors - BY DAY */}
      <div className="environmental-section">
        <div className="section-header">
          <h3>🌡️ Catch vs Environmental Factors (By Day)</h3>
          <p className="section-subtitle">Daily comparison of catch amount with temperature, rainfall, and wind conditions</p>
        </div>
        
        <div className="env-charts-grid">
          {/* Temperature vs Catch - Dual Line Chart */}
          <div className="chart-card">
            <h4>🌡️ Temperature vs Catch</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={environmentalData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis 
                  dataKey="trip" 
                  tick={{ fontSize: 10, angle: -45, textAnchor: 'end' }}
                  height={60}
                  interval={Math.floor(environmentalData.length / 10) || 1}
                  label={{ value: 'Fishing Trip #', position: 'insideBottom', offset: -5, fontSize: 10 }}
                />
                <YAxis 
                  yAxisId="left" 
                  tick={{ fontSize: 10 }} 
                  label={{ value: 'Temp (°C)', angle: -90, position: 'insideLeft', fontSize: 10 }}
                  domain={[0, 40]}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  tick={{ fontSize: 10 }} 
                  label={{ value: 'Catch (kg)', angle: 90, position: 'insideRight', fontSize: 10 }}
                />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'Temperature') return [`${value}°C`, name];
                    return [`${value} kg`, name];
                  }}
                  labelFormatter={(label) => `Trip #${label}`}
                />
                <Legend verticalAlign="top" height={36} />
                <Line yAxisId="left" type="monotone" dataKey="temperature" stroke="#667eea" name="Temperature" strokeWidth={2} dot={{ r: 2 }} />
                <Line yAxisId="right" type="monotone" dataKey="catchKg" stroke="#28a745" name="Catch" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="chart-insight">💡 Optimal temperature: 20-28°C produces highest catch</div>
          </div>

          {/* Rainfall vs Catch - Dual Line Chart */}
          <div className="chart-card">
            <h4>💧 Rainfall vs Catch</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={environmentalData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis 
                  dataKey="trip" 
                  tick={{ fontSize: 10, angle: -45, textAnchor: 'end' }}
                  height={60}
                  interval={Math.floor(environmentalData.length / 10) || 1}
                  label={{ value: 'Fishing Trip #', position: 'insideBottom', offset: -5, fontSize: 10 }}
                />
                <YAxis 
                  yAxisId="left" 
                  tick={{ fontSize: 10 }} 
                  label={{ value: 'Rain (mm)', angle: -90, position: 'insideLeft', fontSize: 10 }}
                  domain={[0, 100]}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  tick={{ fontSize: 10 }} 
                  label={{ value: 'Catch (kg)', angle: 90, position: 'insideRight', fontSize: 10 }}
                />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'Rainfall') return [`${value} mm`, name];
                    return [`${value} kg`, name];
                  }}
                  labelFormatter={(label) => `Trip #${label}`}
                />
                <Legend verticalAlign="top" height={36} />
                <Line yAxisId="left" type="monotone" dataKey="rainfall" stroke="#17a2b8" name="Rainfall" strokeWidth={2} dot={{ r: 2 }} />
                <Line yAxisId="right" type="monotone" dataKey="catchKg" stroke="#28a745" name="Catch" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="chart-insight">💡 Light rain (&lt;10mm) is ideal; heavy rain reduces catch</div>
          </div>

          {/* Wind Speed vs Catch - Dual Line Chart */}
          <div className="chart-card">
            <h4>💨 Wind Speed vs Catch</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={environmentalData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis 
                  dataKey="trip" 
                  tick={{ fontSize: 10, angle: -45, textAnchor: 'end' }}
                  height={60}
                  interval={Math.floor(environmentalData.length / 10) || 1}
                  label={{ value: 'Fishing Trip #', position: 'insideBottom', offset: -5, fontSize: 10 }}
                />
                <YAxis 
                  yAxisId="left" 
                  tick={{ fontSize: 10 }} 
                  label={{ value: 'Wind (km/h)', angle: -90, position: 'insideLeft', fontSize: 10 }}
                  domain={[0, 50]}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  tick={{ fontSize: 10 }} 
                  label={{ value: 'Catch (kg)', angle: 90, position: 'insideRight', fontSize: 10 }}
                />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'Wind Speed') return [`${value} km/h`, name];
                    return [`${value} kg`, name];
                  }}
                  labelFormatter={(label) => `Trip #${label}`}
                />
                <Legend verticalAlign="top" height={36} />
                <Line yAxisId="left" type="monotone" dataKey="windSpeed" stroke="#fd7e14" name="Wind Speed" strokeWidth={2} dot={{ r: 2 }} />
                <Line yAxisId="right" type="monotone" dataKey="catchKg" stroke="#28a745" name="Catch" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="chart-insight">💡 Calm to light winds (&lt;15km/h) are best for fishing</div>
          </div>
        </div>
      </div>

      {/* GRAPH 2: Catch Trend by Specific Location */}
      <div className="location-trend-section">
        <div className="section-header">
          <h3>📍 Catch Trend at {selectedLocation}</h3>
          <p className="section-subtitle">Daily catch performance over time</p>
        </div>
        
        <div className="location-selector-container">
          <select 
            value={selectedLocation} 
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="location-select"
          >
            {locations.map(loc => (
              <option key={loc.name} value={loc.name}>
                {loc.name} ({loc.record_count} records)
              </option>
            ))}
          </select>
          <button onClick={fetchLocationTrend} className="refresh-trend-btn">🔄 Refresh</button>
        </div>

        {showLocationTrend && locationTrendData.length > 0 ? (
          <div className="location-trend-charts">
            {/* Daily Catch Trend */}
            <div className="chart-card">
              <h4>📈 Daily Catch Trend</h4>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={locationTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis 
                    dataKey="trip" 
                    tick={{ fontSize: 10, angle: -45, textAnchor: 'end' }}
                    height={60}
                    interval={Math.floor(locationTrendData.length / 10) || 1}
                    label={{ value: 'Fishing Trip #', position: 'insideBottom', offset: -5, fontSize: 10 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }} 
                    label={{ value: 'Catch (kg)', angle: -90, position: 'insideLeft', fontSize: 10 }}
                  />
                  <Tooltip 
                    formatter={(value) => [`${value} kg`, 'Catch']}
                    labelFormatter={(label) => `Trip #${label}`}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Line type="monotone" dataKey="catch" stroke="#667eea" name="Catch" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Daily CPUE Trend */}
            <div className="chart-card">
              <h4>📊 CPUE Trend</h4>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={locationTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis 
                    dataKey="trip" 
                    tick={{ fontSize: 10, angle: -45, textAnchor: 'end' }}
                    height={60}
                    interval={Math.floor(locationTrendData.length / 10) || 1}
                    label={{ value: 'Fishing Trip #', position: 'insideBottom', offset: -5, fontSize: 10 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }} 
                    label={{ value: 'CPUE (kg/h)', angle: -90, position: 'insideLeft', fontSize: 10 }}
                  />
                  <Tooltip 
                    formatter={(value) => [`${value} kg/h`, 'CPUE']}
                    labelFormatter={(label) => `Trip #${label}`}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Line type="monotone" dataKey="cpue" stroke="#28a745" name="CPUE" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Effort */}
            <div className="chart-card">
              <h4>⏱️ Fishing Effort</h4>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={locationTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis 
                    dataKey="trip" 
                    tick={{ fontSize: 10, angle: -45, textAnchor: 'end' }}
                    height={60}
                    interval={Math.floor(locationTrendData.length / 10) || 1}
                    label={{ value: 'Fishing Trip #', position: 'insideBottom', offset: -5, fontSize: 10 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }} 
                    label={{ value: 'Effort (hrs)', angle: -90, position: 'insideLeft', fontSize: 10 }}
                  />
                  <Tooltip />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="effort" fill="#17a2b8" name="Effort" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : showLocationTrend && (
          <div className="no-data-message">
            <p>📭 No catch data available for {selectedLocation}</p>
            <p>Add catch records for this location to see trends.</p>
          </div>
        )}
      </div>

      {/* CPUE Timeline with Total Catch Line */}
      <div className="chart-card full-width">
        <h3>📈 CPUE Timeline & Total Catch</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={timelineData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis 
              dataKey="trip" 
              tick={{ fontSize: 10, angle: -45, textAnchor: 'end' }}
              height={60}
              interval={Math.floor(timelineData.length / 15) || 1}
              label={{ value: 'Fishing Trip # (chronological)', position: 'insideBottom', offset: -5, fontSize: 10 }}
            />
            <YAxis 
              yAxisId="left" 
              tick={{ fontSize: 10 }} 
              label={{ value: 'CPUE (kg/h)', angle: -90, position: 'insideLeft', fontSize: 10 }}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              tick={{ fontSize: 10 }} 
              label={{ value: 'Total Catch (kg)', angle: 90, position: 'insideRight', fontSize: 10 }}
            />
            <Tooltip 
              formatter={(value, name) => {
                if (name === 'CPUE') return [`${value} kg/h`, name];
                if (name === 'Total Catch') return [`${value} kg`, name];
                return [`${value} kg`, name];
              }}
              labelFormatter={(label) => `Trip #${label}`}
            />
            <Legend verticalAlign="top" height={36} />
            <Line yAxisId="left" type="monotone" dataKey="cpue" stroke="#667eea" name="CPUE" strokeWidth={2} dot={{ r: 2 }} />
            <Line yAxisId="right" type="monotone" dataKey="totalCatch" stroke="#764ba2" name="Total Catch" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
        <div className="chart-insight">📊 Cumulative catch trend shows overall fishing success over time</div>
      </div>

      {/* Original Charts */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3>📊 Monthly CPUE</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data?.monthly_analysis || []} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis 
                dataKey="month_name" 
                tick={{ fontSize: 10, angle: -45, textAnchor: 'end' }}
                height={60}
              />
              <YAxis tick={{ fontSize: 10 }} label={{ value: 'CPUE (kg/h)', angle: -90, position: 'insideLeft', fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="avg_cpue" fill="#667eea" name="Avg CPUE" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>🎯 Top Species</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data?.summary?.top_fish_species || []}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={entry => entry.fish_type}
                outerRadius={80}
                dataKey="total_weight"
              >
                {(data?.summary?.top_fish_species || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
