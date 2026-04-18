import React, { useState, useEffect } from 'react';
import { getLocations, predictByDate, predictTimeSeries, predictSpecificLocation } from '../api';
import './TimeSeriesPredictor.css';

const TimeSeriesPredictor = () => {
  const [predictionType, setPredictionType] = useState('date');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [effortHours, setEffortHours] = useState(4);
  const [year, setYear] = useState(new Date().getFullYear());
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [endYear, setEndYear] = useState(new Date().getFullYear() + 5);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user?.role);
    
    if (predictionType === 'location') {
      loadLocations();
    }
    setResult(null);
  }, [predictionType]);

  const loadLocations = async () => {
    try {
      const response = await getLocations();
      setLocations(response.locations || []);
      if (response.locations && response.locations.length > 0) {
        setSelectedLocation(response.locations[0].name);
      }
    } catch (error) {
      console.error('Failed to load locations:', error);
      setLocations([]);
    }
  };

  const handlePredict = async () => {
    setLoading(true);
    try {
      let response;
      
      if (predictionType === 'date') {
        response = await predictByDate({
          date: selectedDate,
          effort_hours: effortHours
        });
        setResult(response);
      } 
      else if (predictionType === 'monthly') {
        const selectedMonth = new Date(selectedDate).getMonth() + 1;
        response = await predictTimeSeries({
          type: 'monthly',
          year: year,
          highlight_month: selectedMonth,
          effort_hours: effortHours
        });
        setResult(response);
      } 
      else if (predictionType === 'yearly') {
        response = await predictTimeSeries({
          type: 'yearly',
          start_year: startYear,
          end_year: endYear,
          effort_hours: effortHours
        });
        setResult(response);
      } 
      else if (predictionType === 'location') {
        response = await predictSpecificLocation({
          location_name: selectedLocation,
          month: new Date(selectedDate).getMonth() + 1,
          effort_hours: effortHours
        });
        setResult(response);
      }
      
    } catch (error) {
      console.error('Prediction error:', error);
      alert('Prediction failed: ' + (error.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Get dynamic weather icon based on actual data thresholds
  const getWeatherIcon = (condition, value) => {
    if (!value && value !== 0) return '📊';
    
    if (condition === 'temp') {
      if (value >= 20 && value <= 28) return '✅';
      if (value < 15) return '❄️';
      if (value > 30) return '🔥';
      return '🌡️';
    }
    
    if (condition === 'rain') {
      if (value < 5) return '☀️';
      if (value < 15) return '🌤️';
      if (value < 30) return '☁️';
      return '🌧️';
    }
    
    if (condition === 'wind') {
      if (value < 10) return '🍃';
      if (value < 20) return '💨';
      return '🌪️';
    }
    
    return '📊';
  };

  const getSeasonFromMonth = (month) => {
    if (month >= 3 && month <= 5) return 'Spring';
    if (month >= 6 && month <= 8) return 'Summer';
    if (month >= 9 && month <= 11) return 'Fall';
    return 'Winter';
  };

  return (
    <div className="time-series-predictor">
      <h2>📈 Time-Series Catch Predictor</h2>
      <p>Predict catch rates based on REAL historical data from your fishing records</p>

      {/* Role Indicator */}
      <div className="role-indicator">
        <span className={`role-badge ${userRole === 'admin' ? 'admin' : 'worker'}`}>
          {userRole === 'admin' ? '👑 Admin View - Organization Data' : '🔧 Worker View - Your Data'}
        </span>
      </div>

      <div className="prediction-controls">
        <div className="control-group">
          <label>Prediction Type:</label>
          <select value={predictionType} onChange={(e) => setPredictionType(e.target.value)}>
            <option value="date">📅 By Specific Date</option>
            <option value="monthly">📊 Monthly Forecast</option>
            <option value="yearly">📈 Yearly Trend</option>
            <option value="location">🌍 By Location (from your data)</option>
          </select>
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

        {predictionType === 'date' && (
          <div className="control-group">
            <label>📅 Select Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        )}

        {predictionType === 'monthly' && (
          <>
            <div className="control-group">
              <label>📅 Reference Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="control-group">
              <label>📆 Year:</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                min="2020"
                max="2030"
              />
            </div>
          </>
        )}

        {predictionType === 'yearly' && (
          <>
            <div className="control-group">
              <label>📅 Start Year:</label>
              <input
                type="number"
                value={startYear}
                onChange={(e) => setStartYear(parseInt(e.target.value))}
                min="2000"
                max="2030"
              />
            </div>
            <div className="control-group">
              <label>📅 End Year:</label>
              <input
                type="number"
                value={endYear}
                onChange={(e) => setEndYear(parseInt(e.target.value))}
                min="2001"
                max="2035"
              />
            </div>
          </>
        )}

        {predictionType === 'location' && locations.length > 0 && (
          <div className="control-group">
            <label>📍 Select Location:</label>
            <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)}>
              {locations.map(loc => (
                <option key={loc.name} value={loc.name}>
                  {loc.name} ({loc.record_count} records)
                </option>
              ))}
            </select>
          </div>
        )}

        {predictionType === 'location' && locations.length === 0 && (
          <div className="warning-message">
            ⚠️ No locations found. Add records with location names in Data Entry first.
          </div>
        )}

        <button 
          onClick={handlePredict} 
          disabled={loading || (predictionType === 'location' && locations.length === 0)} 
          className="predict-btn"
        >
          {loading ? '🔄 Predicting...' : '🔮 Predict'}
        </button>
      </div>

      {result && (
        <div className="prediction-results">
          {/* Date Prediction */}
          {predictionType === 'date' && result && (
            <div className="date-prediction">
              <div className="result-card date-card">
                <div className="result-header">
                  <span className="result-icon">📅</span>
                  <h3>Prediction for {result.date || selectedDate}</h3>
                  {userRole === 'admin' && <span className="admin-badge-small">Admin View</span>}
                </div>
                <div className="result-main">
                  <div className="catch-value">
                    <span className="catch-number">{result.final_prediction || result.predicted_catch_kg || 0}</span>
                    <span className="catch-unit">kg</span>
                  </div>
                  <div className="catch-cpue">
                    CPUE: {((result.final_prediction || result.predicted_catch_kg || 0) / (result.effort_hours || effortHours)).toFixed(1)} kg/h
                  </div>
                </div>
                <div className="result-info">
                  <div className="info-row">
                    <span>📆 {result.day_of_week || ''}, {result.month_name || ''} {result.year || ''}</span>
                    <span>🍂 {result.season || getSeasonFromMonth(new Date(selectedDate).getMonth() + 1)} Season</span>
                  </div>
                  <div className="info-row">
                    <span>⏱️ {result.effort_hours || effortHours} hours fishing</span>
                    {result.is_weekend && <span className="weekend-badge">📈 Weekend Effect</span>}
                  </div>
                  {result.weather_conditions && (
                    <div className="weather-info">
                      <div className="weather-row">
                        <span>{getWeatherIcon('temp', result.weather_conditions.temp)} {result.weather_conditions.temp}°C</span>
                        <span>{getWeatherIcon('rain', result.weather_conditions.rain)} {result.weather_conditions.rain}mm rain</span>
                        <span>{getWeatherIcon('wind', result.weather_conditions.wind)} {result.weather_conditions.wind}km/h wind</span>
                      </div>
                      <div className="weather-source">Source: {result.weather_conditions.source || 'NASA POWER'}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Monthly Prediction */}
          {predictionType === 'monthly' && result && result.predictions && (
            <div className="monthly-prediction">
              <div className="result-header">
                <span className="result-icon">📊</span>
                <h3>Monthly Forecast for {result.year || year}</h3>
                {userRole === 'admin' && <span className="admin-badge-small">Organization-wide data</span>}
                <p className="location-note">Based on weather at: {result.location || 'Your fishing location'}</p>
              </div>
              <div className="summary-stats">
                <div className="stat">
                  <span>📈 Average Monthly Catch:</span>
                  <strong>{result.average_catch || 0} kg</strong>
                </div>
                <div className="stat">
                  <span>📊 Total Yearly Catch:</span>
                  <strong>{result.total_yearly_catch || 0} kg</strong>
                </div>
              </div>
              
              <div className="months-grid">
                {result.predictions.map((month) => (
                  <div 
                    key={month.month} 
                    className={`month-card ${month.is_highlighted ? 'highlighted' : ''} ${month.is_best_month ? 'best' : month.is_worst_month ? 'worst' : ''}`}
                  >
                    <div className="month-name">{month.month_name}</div>
                    <div className="month-catch">{month.predicted_catch_kg || 0} kg</div>
                    <div className="month-cpue">CPUE: {((month.predicted_catch_kg || 0) / (result.effort_hours || effortHours)).toFixed(1)} kg/h</div>
                    <div className="month-conditions">
                      <span>🌡️{month.temperature || 0}°</span>
                      <span>💧{month.rainfall || 0}mm</span>
                      <span>💨{month.wind_speed || 0}km/h</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Yearly Prediction */}
          {predictionType === 'yearly' && result && result.predictions && (
            <div className="yearly-prediction">
              <div className="result-header">
                <span className="result-icon">📈</span>
                <h3>Yearly Trend ({result.start_year || startYear} - {result.end_year || endYear})</h3>
                {userRole === 'admin' && <span className="admin-badge-small">Organization trend</span>}
              </div>
              <div className="trend-indicator">
                <span className={`trend-badge ${result.trend || 'stable'}`}>
                  {result.trend === 'increasing' ? '📈 Increasing Trend' : result.trend === 'decreasing' ? '📉 Decreasing Trend' : '📊 Stable Trend'}
                </span>
                {result.percent_change && (
                  <span className="trend-percent">
                    {result.percent_change > 0 ? '+' : ''}{result.percent_change}% change
                  </span>
                )}
              </div>
              
              <div className="years-list">
                {result.predictions.map((yearData) => (
                  <div key={yearData.year} className="year-card">
                    <div className="year">{yearData.year}</div>
                    <div className="year-catch">{yearData.predicted_catch_kg || 0} kg</div>
                    <div className="year-temp">🌡️ {yearData.temperature_trend || 'N/A'}°C</div>
                    <div className="year-confidence">
                      Confidence: {((yearData.confidence || 0.7) * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Location Prediction */}
          {predictionType === 'location' && result && (
            <div className="location-prediction">
              <div className="result-header">
                <span className="result-icon">🌍</span>
                <h3>Prediction for {result.location}</h3>
                <p className="data-source">Based on {result.total_records || 0} historical records</p>
              </div>
              
              <div className="location-result-card">
                <div className="location-main">
                  <div className="catch-value">
                    <span className="catch-number">{result.predicted_catch_kg || 0}</span>
                    <span className="catch-unit">kg</span>
                  </div>
                  <div className="catch-cpue">
                    CPUE: {((result.predicted_catch_kg || 0) / (result.effort_hours || effortHours)).toFixed(1)} kg/h
                  </div>
                </div>
                
                <div className="location-stats">
                  <div className="stat-item">
                    <span className="stat-label">Historical Average:</span>
                    <span className="stat-value">{result.historical_avg_catch || 0} kg</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Total Records:</span>
                    <span className="stat-value">{result.total_records || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Confidence:</span>
                    <span className="stat-value">{((result.confidence || 0.7) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Trend:</span>
                    <span className={`stat-value trend-${result.trend || 'stable'}`}>
                      {result.trend === 'increasing' ? '📈 Improving' : result.trend === 'decreasing' ? '📉 Declining' : '📊 Stable'}
                      {result.trend_percent > 0 && ` (${result.trend_percent}%)`}
                    </span>
                  </div>
                </div>
                
                <div className="location-weather">
                  <h4>🌤️ Expected Weather for {result.month_name}</h4>
                  <div className="weather-grid">
                    <div className="weather-detail">
                      <span className="weather-icon">🌡️</span>
                      <span>{result.temperature || 0}°C</span>
                    </div>
                    <div className="weather-detail">
                      <span className="weather-icon">💧</span>
                      <span>{result.rainfall || 0}mm</span>
                    </div>
                    <div className="weather-detail">
                      <span className="weather-icon">💨</span>
                      <span>{result.wind_speed || 0}km/h</span>
                    </div>
                  </div>
                </div>
                
                <div className="location-recommendation">
                  💡 <strong>Recommendation:</strong>
                  {result.trend === 'increasing' 
                    ? ` This location shows improving trends (${result.trend_percent}% increase). Good time to fish here!`
                    : result.trend === 'decreasing'
                    ? ` Catch rates are declining (${result.trend_percent}% decrease). Consider alternative locations.`
                    : ` This location has stable catch rates. Reliable spot for fishing.`}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!result && !loading && (
        <div className="no-prediction">
          <div className="no-data-icon">🔮</div>
          <h3>Ready to Predict</h3>
          <p>Select prediction type and click "Predict" to see results based on your REAL fishing data</p>
          <p className="hint">💡 The more data you add, the more accurate predictions become!</p>
        </div>
      )}
    </div>
  );
};

export default TimeSeriesPredictor;