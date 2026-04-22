import React, { useState, useEffect } from 'react';
import api from '../api';
import './TimeSeriesPredictor.css';

const TimeSeriesPredictor = () => {
  const [viewMode, setViewMode] = useState('all');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [effortHours, setEffortHours] = useState(4);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user?.role);
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const response = await api.get('/get-locations');
      setLocations(response.data.locations || []);
      if (response.data.locations && response.data.locations.length > 0) {
        setSelectedLocation(response.data.locations[0].name);
      }
    } catch (error) {
      console.error('Failed to load locations:', error);
    }
  };

  const handlePredict = async () => {
    setLoading(true);
    
    try {
      if (viewMode === 'all') {
        const allPredictions = [];
        
        for (const loc of locations) {
          const response = await api.post('/predict-with-forecast', {
            date: selectedDate,
            location: loc.name,
            effort_hours: effortHours
          });
          
          allPredictions.push({
            location: loc.name,
            predicted_catch: response.data.predicted_catch_kg,
            cpue: response.data.cpue,
            confidence: response.data.confidence_score,
            weather: response.data.forecast_weather,
            trend: response.data.trend,
            recommendation: response.data.recommendation
          });
        }
        
        allPredictions.sort((a, b) => b.predicted_catch - a.predicted_catch);
        
        setResult({
          type: 'all',
          predictions: allPredictions,
          date: selectedDate
        });
        
      } else {
        const response = await api.post('/predict-with-forecast', {
          date: selectedDate,
          location: selectedLocation,
          effort_hours: effortHours
        });
        
        setResult({
          type: 'specific',
          data: response.data,
          date: selectedDate,
          location: selectedLocation
        });
      }
      
    } catch (error) {
      console.error('Prediction error:', error);
      alert('Prediction failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="time-series-predictor">
      <h2>📈 Future Catch Predictor</h2>
      <p>Predict future catches using weather forecast correlation</p>

      <div className="role-indicator">
        <span className={`role-badge ${userRole === 'admin' ? 'admin' : 'worker'}`}>
          {userRole === 'admin' ? '👑 Admin View' : '🔧 Worker View'}
        </span>
      </div>

      <div className="view-mode-toggle">
        <button 
          className={`mode-btn ${viewMode === 'all' ? 'active' : ''}`}
          onClick={() => setViewMode('all')}
        >
          🌍 All Locations
        </button>
        <button 
          className={`mode-btn ${viewMode === 'specific' ? 'active' : ''}`}
          onClick={() => setViewMode('specific')}
        >
          📍 Specific Location
        </button>
      </div>

      {viewMode === 'specific' && locations.length > 0 && (
        <div className="location-selector">
          <label>Select Location:</label>
          <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)}>
            {locations.map(loc => (
              <option key={loc.name} value={loc.name}>
                {loc.name} ({loc.record_count} records)
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="date-controls">
        <div className="control-group">
          <label>📅 Future Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]}
          />
        </div>

        <div className="control-group">
          <label>⏱️ Effort Hours:</label>
          <input
            type="number"
            value={effortHours}
            onChange={(e) => setEffortHours(parseFloat(e.target.value))}
            min="1"
            max="24"
            step="0.5"
          />
        </div>
      </div>

      <button onClick={handlePredict} disabled={loading} className="predict-btn">
        {loading ? '🔄 Analyzing forecast...' : '🔮 Predict with Forecast'}
      </button>

      {result && result.type === 'all' && (
        <div className="all-locations-result">
          <h3>📊 Predictions for {result.date}</h3>
          
          <div className="predictions-table">
            <div className="table-header">
              <div className="rank">#</div>
              <div className="location">Location</div>
              <div className="catch">Predicted Catch</div>
              <div className="cpue">CPUE</div>
              <div className="weather">Forecast</div>
              <div className="confidence">Confidence</div>
            </div>
            
            {result.predictions.map((pred, idx) => (
              <div key={pred.location} className={`table-row ${idx === 0 ? 'top-ranked' : ''}`}>
                <div className="rank">#{idx + 1}</div>
                <div className="location">{pred.location}</div>
                <div className="catch">{pred.predicted_catch.toFixed(1)} kg</div>
                <div className="cpue">{pred.cpue.toFixed(1)} kg/h</div>
                <div className="weather">🌡️{pred.weather.temperature}° 💧{pred.weather.rainfall}mm</div>
                <div className="confidence">{(pred.confidence * 100).toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && result.type === 'specific' && result.data && (
        <div className="specific-location-result">
          <h3>📊 Prediction for {result.location} on {result.date}</h3>
          
          <div className="result-card">
            <div className="result-main">
              <div className="catch-value">
                <span className="catch-number">{result.data.predicted_catch_kg.toFixed(1)}</span>
                <span className="catch-unit">kg</span>
              </div>
              <div className="catch-cpue">CPUE: {result.data.cpue.toFixed(1)} kg/h</div>
              <div className="confidence-badge">Confidence: {(result.data.confidence_score * 100).toFixed(0)}%</div>
            </div>
            
            <div className="forecast-weather">
              <h4>🌤️ Weather Forecast</h4>
              <div className="weather-details">
                <div className="weather-item">🌡️ {result.data.forecast_weather.temperature}°C</div>
                <div className="weather-item">💧 {result.data.forecast_weather.rainfall}mm rain</div>
                <div className="weather-item">💨 {result.data.forecast_weather.wind_speed}km/h wind</div>
              </div>
            </div>
            
            <div className="prediction-details">
              <div className="detail-row">🎯 Method: {result.data.prediction_method}</div>
              <div className="detail-row">📊 Similar conditions: {result.data.similar_conditions} records</div>
            </div>
            
            <div className="trend-analysis">
              <h4>📈 Catch Trend</h4>
              <div className={`trend-indicator ${result.data.trend?.direction}`}>
                {result.data.trend?.direction === 'increasing' ? '📈 Increasing' :
                 result.data.trend?.direction === 'decreasing' ? '📉 Decreasing' : '📊 Stable'}
                {result.data.trend?.percent_change > 0 && ` (${result.data.trend.percent_change}% change)`}
              </div>
            </div>
            
            <div className="recommendation-box">
              <div className="recommendation-icon">💡</div>
              <div className="recommendation-text">{result.data.recommendation}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeSeriesPredictor;
