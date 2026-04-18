import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import OfflineDataEntry from './components/OfflineDataEntry';  // Change this import
import Dashboard from './components/Dashboard';
import MLPredictor from './components/MLPredictor';
import TimeSeriesPredictor from './components/TimeSeriesPredictor';
import OrganizationDashboard from './components/OrganizationDashboard';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      const userData = JSON.parse(savedUser);
      setIsAuthenticated(true);
      setUser(userData);
      
      // Set initial tab based on role
      if (userData.role === 'admin') {
        setActiveTab('org-dashboard');
      } else {
        setActiveTab('dashboard');
      }
    }
  }, []);

  const handleLogin = (userData) => {
    setIsAuthenticated(true);
    setUser(userData);
    
    // Redirect to appropriate dashboard based on role
    if (userData.role === 'admin') {
      setActiveTab('org-dashboard');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    setActiveTab('dashboard');
  };

  const handleDataSubmit = () => {
    setRefreshTrigger(prev => prev + 1);
    setActiveTab('dashboard');
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const isAdmin = user?.role === 'admin';
  const isWorker = user?.role === 'worker';

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <div>
            <h1>🐟 Smart Fisheries Data System</h1>
            <p>Intelligent Catch Management & Analytics Platform</p>
          </div>
          <div className="user-info">
            {user?.organization_id && (
              <div className="org-badge" title={`Member of ${user.organization_name || 'Organization'}`}>
                🏢 {user.organization_name || 'Organization'}
                {user.role === 'admin' && <span className="admin-badge">Admin</span>}
                {user.role === 'worker' && <span className="worker-badge">Worker</span>}
              </div>
            )}
            <span className="user-role">{user?.role}</span>
            <span className="user-name">{user?.full_name || user?.email?.split('@')[0]}</span>
            <button onClick={handleLogout} className="logout-btn">🚪 Logout</button>
          </div>
        </div>
      </header>

      <nav className="app-nav">
        {isWorker && (
          <>
            <button 
              className={activeTab === 'dashboard' ? 'active' : ''} 
              onClick={() => setActiveTab('dashboard')}
            >
              📊 My Dashboard
            </button>
            <button 
              className={activeTab === 'entry' ? 'active' : ''} 
              onClick={() => setActiveTab('entry')}
            >
              ✍️ Data Entry
            </button>
            <button 
              className={activeTab === 'ml' ? 'active' : ''} 
              onClick={() => setActiveTab('ml')}
            >
              🤖 AI Predictor
            </button>
            <button 
              className={activeTab === 'timeseries' ? 'active' : ''} 
              onClick={() => setActiveTab('timeseries')}
            >
              📈 Time Series
            </button>
          </>
        )}
        
        {isAdmin && (
          <>
            <button 
              className={activeTab === 'org-dashboard' ? 'active' : ''} 
              onClick={() => setActiveTab('org-dashboard')}
            >
              🏢 Organization Dashboard
            </button>
            <button 
              className={activeTab === 'dashboard' ? 'active' : ''} 
              onClick={() => setActiveTab('dashboard')}
            >
              📊 Dashboard
            </button>
            <button 
              className={activeTab === 'ml' ? 'active' : ''} 
              onClick={() => setActiveTab('ml')}
            >
              🤖 AI Predictor
            </button>
            <button 
              className={activeTab === 'timeseries' ? 'active' : ''} 
              onClick={() => setActiveTab('timeseries')}
            >
              📈 Time Series
            </button>
          </>
        )}
      </nav>

      <main className="app-main">
        {activeTab === 'dashboard' && <Dashboard refreshTrigger={refreshTrigger} />}
        {activeTab === 'entry' && <OfflineDataEntry onSubmitSuccess={handleDataSubmit} />}
        {activeTab === 'ml' && <MLPredictor />}
        {activeTab === 'timeseries' && <TimeSeriesPredictor />}
        {activeTab === 'org-dashboard' && isAdmin && <OrganizationDashboard />}
      </main>
    </div>
  );
}

export default App;