import React, { useState } from 'react';
import { register, login } from '../api';
import './Login.css';

const Login = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'worker',  // Changed default from 'individual' to 'worker'
    organization_name: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let response;
      if (isLogin) {
        response = await login({
          email: formData.email,
          password: formData.password
        });
      } else {
        response = await register({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role: formData.role,
          organization_name: formData.organization_name
        });
      }
      
      if (response.user) {
        onLogin(response.user);
      }
    } catch (err) {
      setError(err.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>🐟 Smart Fisheries System</h1>
          <p>{isLogin ? 'Login to your account' : 'Create new account'}</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="your@email.com"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="••••••••"
            />
          </div>

          {!isLogin && (
            <>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  required
                  placeholder="Your full name"
                />
              </div>

              <div className="form-group">
                <label>Account Type</label>
                <select name="role" value={formData.role} onChange={handleChange}>
                  <option value="worker">Worker</option>
                  <option value="admin">Organization Admin</option>
                </select>
              </div>

              {formData.role === 'admin' && (
                <div className="form-group">
                  <label>Organization Name</label>
                  <input
                    type="text"
                    name="organization_name"
                    value={formData.organization_name}
                    onChange={handleChange}
                    required
                    placeholder="Your organization name"
                  />
                </div>
              )}
            </>
          )}

          <button type="submit" disabled={loading} className="login-btn">
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>

        <div className="login-footer">
          <button onClick={() => setIsLogin(!isLogin)} className="switch-btn">
            {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
