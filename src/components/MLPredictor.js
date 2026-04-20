import React, { useState, useEffect, useCallback } from 'react';
import { predictCatch, trainModel, getEnvironmentalAnalysis, getModelStatus, getLocations, getCatches } from '../api';
import './MLPredictor.css';

const MLPredictor = () => {
  const [formData, setFormData] = useState({
    temperature: 25,
    rainfall: 5,
    wind_speed: 10,
    effort_hours: 4,
    month: new Date().getMonth() + 1
  });
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [training, setTraining] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [modelStatus, setModelStatus] = useState(null);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [predictionsByLocation, setPredictionsByLocation] = useState([]);
  const [predictingAll, setPredictingAll] = useState(false);
  const [viewMode, setViewMode] = useState('single'); // 'single' or 'all'
  
  const [useRealWeather, setUseRealWeather] = useState(true);
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [weatherSource, setWeatherSource] = useState('');
  const [historicalData, setHistoricalData] = useState([]);
  const [optimalConditions, setOptimalConditions] = useState({
    temperature: null,
    rainfall: null,
    wind_speed: null
  });

  // Fetch real weather for a specific location
  const fetchRealWeather = useCallback(async (location) => {
    if (!location || !location.latitude || !location.longitude) {
      console.log('No coordinates for this location');
      return null;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const { getWeatherForLocation } = await import('../api');
      const response = await getWeatherForLocation({
        latitude: location.latitude,
        longitude: location.longitude,
        date: today
      });

      if (response) {
        return {
          temperature: response.temperature,
          rainfall: response.rainfall,
          wind_speed: response.wind_speed,
          source: response.source
        };
      }
    } catch (error) {
      console.error('Failed to fetch real weather:', error);
      return null;
    }
    return null;
  }, []);

  const loadModelStatus = useCallback(async () => {
    try {
      const status = await getModelStatus();
      setModelStatus(status);
    } catch (error) {
      console.error('Failed to load model status:', error);
    }
  }, []);

  const loadLocations = useCallback(async () => {
    try {
      const response = await getLocations();
      setLocations(response.locations || []);
      if (response.locations && response.locations.length > 0) {
        setSelectedLocation(response.locations[0].name);
        // Fetch weather for the first location
        const weather = await fetchRealWeather(response.locations[0]);
        if (weather && useRealWeather) {
          setFormData(prev => ({
            ...prev,
            temperature: weather.temperature,
            rainfall: weather.rainfall,
            wind_speed: weather.wind_speed
          }));
          setWeatherSource(`Real weather from ${response.locations[0].name} (${weather.source})`);
        }
      }
    } catch (error) {
      console.error('Failed to load locations:', error);
    }
  }, [fetchRealWeather, useRealWeather]);

  const loadHistoricalData = useCallback(async () => {
    try {
      const response = await getCatches(1, 100);
      const records = response.data || [];
      
      const recordsWithWeather = records.filter(r => 
        r.temperature && r.temperature !== null && 
        r.rainfall && r.rainfall !== null &&
        r.wind_speed && r.wind_speed !== null
      );
      
      setHistoricalData(recordsWithWeather);
      
      if (recordsWithWeather.length > 0) {
        const sortedByCPUE = [...recordsWithWeather].sort((a, b) => (b.cpue || 0) - (a.cpue || 0));
        const topCount = Math.max(5, Math.floor(sortedByCPUE.length * 0.2));
        const topCatches = sortedByCPUE.slice(0, topCount);
        
        const avgTemp = topCatches.reduce((sum, r) => sum + (r.temperature || 0), 0) / topCatches.length;
        const avgRain = topCatches.reduce((sum, r) => sum + (r.rainfall || 0), 0) / topCatches.length;
        const avgWind = topCatches.reduce((sum, r) => sum + (r.wind_speed || 0), 0) / topCatches.length;
        
        setOptimalConditions({
          temperature: Math.round(avgTemp * 10) / 10,
          rainfall: Math.round(avgRain * 10) / 10,
          wind_speed: Math.round(avgWind * 10) / 10
        });
      }
    } catch (error) {
      console.error('Failed to load historical data:', error);
    }
  }, []);

  useEffect(() => {
    loadModelStatus();
    loadLocations();
    loadHistoricalData();
  }, [loadModelStatus, loadLocations, loadHistoricalData]);

  const handleLocationChange = async (e) => {
    const locationName = e.target.value;
    setSelectedLocation(locationName);
    
    const location = locations.find(l => l.name === locationName);
    if (location && useRealWeather) {
      setFetchingWeather(true);
      const weather = await fetchRealWeather(location);
      if (weather) {
        setFormData(prev => ({
          ...prev,
          temperature: weather.temperature,
          rainfall: weather.rainfall,
          wind_speed: weather.wind_speed
        }));
        setWeatherSource(`Real weather from ${location.name} (${weather.source})`);
      }
      setFetchingWeather(false);
    }
  };

  const handlePredictAllLocations = async () => {
    setPredictingAll(true);
    setPredictionsByLocation([]);
    
    const results = [];
    
    for (const location of locations) {
      try {
        let temp, rain, wind;
        
        if (useRealWeather && location.latitude && location.longitude) {
          const weather = await fetchRealWeather(location);
          if (weather) {
            temp = weather.temperature;
            rain = weather.rainfall;
            wind = weather.wind_speed;
          } else {
            temp = formData.temperature;
            rain = formData.rainfall;
            wind = formData.wind_speed;
          }
        } else {
          temp = formData.temperature;
          rain = formData.rainfall;
          wind = formData.wind_speed;
        }
        
        const result = await predictCatch({
          temperature: temp,
          rainfall: rain,
          wind_speed: wind,
          effort_hours: formData.effort_hours,
          month: formData.month
        });
        
        results.push({
          location: location.name,
          predicted_catch_kg: result.predicted_catch_kg,
          cpue: (result.predicted_catch_kg / formData.effort_hours).toFixed(1),
          temperature: temp,
          rainfall: rain,
          wind_speed: wind,
          record_count: location.record_count,
          total_catch: location.total_catch || 0,
          confidence: result.confidence_score,
          latitude: location.latitude,
          longitude: location.longitude
        });
      } catch (error) {
        console.error(`Failed to predict for ${location.name}:`, error);
        results.push({
          location: location.name,
          predicted_catch_kg: 0,
          cpue: 0,
          error: true,
          record_count: location.record_count
        });
      }
    }
    
    // Sort by predicted catch (highest first)
    results.sort((a, b) => b.predicted_catch_kg - a.predicted_catch_kg);
    setPredictionsByLocation(results);
    setPredictingAll(false);
  };

  const handleToggleWeatherSource = () => {
    const nextValue = !useRealWeather;
    setUseRealWeather(nextValue);
    if (nextValue && selectedLocation) {
      const location = locations.find(l => l.name === selectedLocation);
      if (location) {
        fetchRealWeather(location).then(weather => {
          if (weather) {
            setFormData(prev => ({
              ...prev,
              temperature: weather.temperature,
              rainfall: weather.rainfall,
              wind_speed: weather.wind_speed
            }));
          }
        });
      }
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: parseFloat(e.target.value)
    });
  };

  const handlePredict = async () => {
    setLoading(true);
    try {
      const result = await predictCatch(formData);
      setPrediction(result);
    } catch (error) {
      alert('Prediction failed: ' + (error.error || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleTrain = async () => {
    setTraining(true);
    try {
      const result = await trainModel();
      alert(`✅ Model trained successfully!\n\nTrain MAE: ${result.metrics.train_mae} kg\nTrain R²: ${result.metrics.train_r2}\nTraining samples: ${result.metrics.training_samples}`);
      await loadModelStatus();
      await loadHistoricalData();
    } catch (error) {
      alert('Training failed: ' + (error.error || 'Need at least 5 records with weather data'));
    } finally {
      setTraining(false);
    }
  };

  const handleAnalysis = async () => {
    try {
      const result = await getEnvironmentalAnalysis();
      setAnalysis(result);
    } catch (error) {
      alert('Analysis failed: ' + (error.error || 'Need at least 5 records with weather data'));
    }
  };

  const getCPUE = () => {
    if (prediction) {
      return (prediction.predicted_catch_kg / formData.effort_hours).toFixed(1);
    }
    return null;
  };

  const getInterpretation = () => {
    const cpueVal = parseFloat(getCPUE());
    if (!cpueVal) return null;
    
    const historicalCPUE = historicalData.filter(d => d.cpue > 0).map(d => d.cpue);
    const avgHistoricalCPUE = historicalCPUE.length > 0 
      ? historicalCPUE.reduce((a, b) => a + b, 0) / historicalCPUE.length 
      : 3.5;
    
    const percentBetter = ((cpueVal - avgHistoricalCPUE) / avgHistoricalCPUE * 100).toFixed(0);
    
    if (cpueVal >= avgHistoricalCPUE * 1.5) {
      return {
        level: 'Excellent',
        color: '#28a745',
        icon: '🏆',
        message: `Excellent catch rate of ${cpueVal} kg/hour! ${percentBetter}% above average.`,
        recommendation: 'Perfect conditions! Consider increasing fishing effort.'
      };
    } else if (cpueVal >= avgHistoricalCPUE * 1.2) {
      return {
        level: 'Good',
        color: '#17a2b8',
        icon: '👍',
        message: `Good catch rate of ${cpueVal} kg/hour. ${percentBetter}% above average.`,
        recommendation: 'Favorable conditions - good time for fishing.'
      };
    } else if (cpueVal >= avgHistoricalCPUE * 0.8) {
      return {
        level: 'Average',
        color: '#ffc107',
        icon: '📊',
        message: `Average catch rate of ${cpueVal} kg/hour. Similar to historical average.`,
        recommendation: 'Normal conditions expected.'
      };
    } else if (cpueVal >= avgHistoricalCPUE * 0.5) {
      return {
        level: 'Below Average',
        color: '#fd7e14',
        icon: '⚠️',
        message: `Below average catch rate of ${cpueVal} kg/hour. ${Math.abs(percentBetter)}% below average.`,
        recommendation: 'Challenging conditions expected.'
      };
    } else {
      return {
        level: 'Poor',
        color: '#dc3545',
        icon: '❌',
        message: `Poor catch rate of ${cpueVal} kg/hour. Significantly below average.`,
        recommendation: 'Not recommended for fishing today.'
      };
    }
  };

  const getWeatherAssessment = () => {
    const { temperature, rainfall, wind_speed } = formData;
    
    if (!optimalConditions.temperature) {
      return {
        score: 3,
        assessments: [
          { good: true, text: `🌡️ Temperature ${temperature}°C - acceptable range` },
          { good: true, text: `💧 Rainfall ${rainfall}mm - acceptable` },
          { good: true, text: `💨 Wind ${wind_speed}km/h - acceptable` }
        ],
        overall: { text: 'Conditions are favorable for fishing', color: '#28a745', icon: '👍' }
      };
    }
    
    let assessments = [];
    let score = 0;
    
    const tempDiff = Math.abs(temperature - optimalConditions.temperature);
    if (tempDiff <= 2) {
      score += 2;
      assessments.push({ good: true, text: `🌡️ Temperature ${temperature}°C is optimal (best: ${optimalConditions.temperature}°C)` });
    } else if (tempDiff <= 5) {
      score += 1;
      assessments.push({ good: true, text: `🌡️ Temperature ${temperature}°C is acceptable (optimal: ${optimalConditions.temperature}°C)` });
    } else {
      assessments.push({ good: false, text: `🌡️ Temperature ${temperature}°C differs from optimal (${optimalConditions.temperature}°C)` });
    }
    
    const rainDiff = Math.abs(rainfall - optimalConditions.rainfall);
    if (rainDiff <= 2) {
      score += 2;
      assessments.push({ good: true, text: `💧 Rainfall ${rainfall}mm - optimal (best: ${optimalConditions.rainfall}mm)` });
    } else if (rainfall <= optimalConditions.rainfall + 10) {
      score += 1;
      assessments.push({ good: true, text: `💧 Rainfall ${rainfall}mm - acceptable` });
    } else {
      assessments.push({ good: false, text: `💧 Rainfall ${rainfall}mm - higher than optimal (${optimalConditions.rainfall}mm)` });
    }
    
    const windDiff = Math.abs(wind_speed - optimalConditions.wind_speed);
    if (windDiff <= 3) {
      score += 2;
      assessments.push({ good: true, text: `💨 Wind ${wind_speed}km/h - optimal (best: ${optimalConditions.wind_speed}km/h)` });
    } else if (windDiff <= 8) {
      score += 1;
      assessments.push({ good: true, text: `💨 Wind ${wind_speed}km/h - acceptable` });
    } else {
      assessments.push({ good: false, text: `💨 Wind ${wind_speed}km/h - higher than optimal (${optimalConditions.wind_speed}km/h)` });
    }
    
    let overall;
    if (score >= 5) overall = { text: 'Excellent conditions based on your best catches!', color: '#28a745', icon: '🌟' };
    else if (score >= 3) overall = { text: 'Good conditions - should be productive', color: '#17a2b8', icon: '👍' };
    else overall = { text: 'Challenging conditions - lower catch expected', color: '#ffc107', icon: '⚠️' };
    
    return { score, assessments, overall };
  };

  const interpretation = getInterpretation();
  const weatherAssessment = getWeatherAssessment();
  const currentCPUE = getCPUE();

  // Find best location from predictions
  const bestLocation = predictionsByLocation.length > 0 ? predictionsByLocation[0] : null;

  return (
    <div className="ml-predictor">
      <h2>🤖 AI Catch Predictor</h2>
      <p>Predict fish catch based on REAL environmental conditions from your fishing locations</p>

      {/* View Mode Toggle */}
      <div className="view-mode-toggle">
        <button 
          className={`mode-btn ${viewMode === 'single' ? 'active' : ''}`}
          onClick={() => setViewMode('single')}
        >
          📍 Single Location
        </button>
        <button 
          className={`mode-btn ${viewMode === 'all' ? 'active' : ''}`}
          onClick={() => setViewMode('all')}
        >
          🌍 All Locations
        </button>
      </div>

      {viewMode === 'single' ? (
        // Single Location View
        <>
          <div className="weather-source-bar">
            <div className="weather-toggle">
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={useRealWeather} 
                  onChange={handleToggleWeatherSource} 
                />
                <span className="slider round"></span>
              </label>
              <span>Use Real Weather Data</span>
            </div>
            {weatherSource && (
              <div className="weather-source-info">
                🌐 {weatherSource}
                {fetchingWeather && <span className="fetching"> (Updating...)</span>}
              </div>
            )}
          </div>

          {locations.length > 0 && (
            <div className="location-selector">
              <label>📍 Select Fishing Location:</label>
              <select value={selectedLocation} onChange={handleLocationChange}>
                {locations.map(loc => (
                  <option key={loc.name} value={loc.name}>
                    {loc.name} ({loc.record_count} records) 
                    {loc.latitude ? ' 📍' : ' ❌ No coordinates'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {optimalConditions.temperature && (
            <div className="optimal-conditions">
              <h4>📊 Best Conditions from Your Successful Catches</h4>
              <div className="optimal-grid">
                <div className="optimal-item">
                  <span className="optimal-icon">🌡️</span>
                  <span className="optimal-label">Best Temp:</span>
                  <span className="optimal-value">{optimalConditions.temperature}°C</span>
                </div>
                <div className="optimal-item">
                  <span className="optimal-icon">💧</span>
                  <span className="optimal-label">Best Rain:</span>
                  <span className="optimal-value">{optimalConditions.rainfall}mm</span>
                </div>
                <div className="optimal-item">
                  <span className="optimal-icon">💨</span>
                  <span className="optimal-label">Best Wind:</span>
                  <span className="optimal-value">{optimalConditions.wind_speed}km/h</span>
                </div>
              </div>
              <p className="optimal-note">Based on your top {historicalData.length} fishing records</p>
            </div>
          )}

          {modelStatus && (
            <div className="model-status">
              <div className={`status-badge ${modelStatus.model_trained ? 'trained' : 'untrained'}`}>
                {modelStatus.model_trained ? '✅ Model Trained' : '⚠️ Model Not Trained'}
              </div>
              {modelStatus.model_trained && modelStatus.metrics && (
                <div className="status-metrics">
                  <span>📊 R² Score: {modelStatus.metrics.train_r2}</span>
                  <span>📈 MAE: {modelStatus.metrics.train_mae} kg</span>
                  <span>🎯 Samples: {modelStatus.metrics.training_samples}</span>
                </div>
              )}
            </div>
          )}

          <div className="predictor-grid">
            <div className="input-group">
              <label>🌡️ Temperature (°C)</label>
              <input
                type="range"
                name="temperature"
                min="0"
                max="40"
                step="0.5"
                value={formData.temperature}
                onChange={handleChange}
                disabled={useRealWeather && fetchingWeather}
              />
              <div className="input-value">{formData.temperature}°C</div>
              {optimalConditions.temperature && (
                <div className="input-hint">Best from data: {optimalConditions.temperature}°C</div>
              )}
            </div>

            <div className="input-group">
              <label>💧 Rainfall (mm)</label>
              <input
                type="range"
                name="rainfall"
                min="0"
                max="100"
                step="1"
                value={formData.rainfall}
                onChange={handleChange}
                disabled={useRealWeather && fetchingWeather}
              />
              <div className="input-value">{formData.rainfall} mm</div>
              {optimalConditions.rainfall && (
                <div className="input-hint">Best from data: {optimalConditions.rainfall}mm</div>
              )}
            </div>

            <div className="input-group">
              <label>💨 Wind Speed (km/h)</label>
              <input
                type="range"
                name="wind_speed"
                min="0"
                max="50"
                step="1"
                value={formData.wind_speed}
                onChange={handleChange}
                disabled={useRealWeather && fetchingWeather}
              />
              <div className="input-value">{formData.wind_speed} km/h</div>
              {optimalConditions.wind_speed && (
                <div className="input-hint">Best from data: {optimalConditions.wind_speed}km/h</div>
              )}
            </div>

            <div className="input-group">
              <label>⏱️ Effort (hours)</label>
              <input
                type="range"
                name="effort_hours"
                min="1"
                max="12"
                step="0.5"
                value={formData.effort_hours}
                onChange={handleChange}
              />
              <div className="input-value">{formData.effort_hours} hrs</div>
            </div>

            <div className="input-group">
              <label>📅 Month</label>
              <select name="month" value={formData.month} onChange={handleChange}>
                <option value={1}>January</option>
                <option value={2}>February</option>
                <option value={3}>March</option>
                <option value={4}>April</option>
                <option value={5}>May</option>
                <option value={6}>June</option>
                <option value={7}>July</option>
                <option value={8}>August</option>
                <option value={9}>September</option>
                <option value={10}>October</option>
                <option value={11}>November</option>
                <option value={12}>December</option>
              </select>
            </div>
          </div>

          <div className="action-buttons">
            <button onClick={handlePredict} disabled={loading} className="btn-predict">
              {loading ? '🤔 Predicting...' : '🎯 Predict Catch'}
            </button>
            <button onClick={handleTrain} disabled={training || !modelStatus?.training_ready} className="btn-train">
              {training ? '🧠 Training...' : '🤖 Train Model'}
            </button>
            <button onClick={handleAnalysis} className="btn-analyze">
              {analysis ? '📊 View Analysis' : '📊 Environmental Analysis'}
            </button>
          </div>

          {prediction && (
            <div className="prediction-result">
              <h3>🎯 Prediction Result for {selectedLocation}</h3>
              
              <div className="result-value">
                {prediction.predicted_catch_kg} <span>kg</span>
              </div>
              
              <div className="result-cpue">
                <strong>Catch Per Unit Effort (CPUE):</strong> {currentCPUE} kg/hour
              </div>
              
              {interpretation && (
                <div className="interpretation-badge" style={{ backgroundColor: interpretation.color + '20', borderColor: interpretation.color }}>
                  <span className="interpretation-icon">{interpretation.icon}</span>
                  <div className="interpretation-content">
                    <div className="interpretation-level" style={{ color: interpretation.color }}>
                      {interpretation.level} Fishing Conditions
                    </div>
                    <div className="interpretation-message">{interpretation.message}</div>
                    <div className="interpretation-recommendation">💡 {interpretation.recommendation}</div>
                  </div>
                </div>
              )}
              
              <div className="weather-assessment">
                <h4>🌤️ Weather Assessment</h4>
                <div className="weather-overall" style={{ color: weatherAssessment.overall.color }}>
                  {weatherAssessment.overall.icon} {weatherAssessment.overall.text}
                </div>
                <div className="weather-details">
                  {weatherAssessment.assessments.map((item, idx) => (
                    <div key={idx} className={`weather-item ${item.good ? 'good' : 'bad'}`}>
                      {item.good ? '✅' : '⚠️'} {item.text}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="result-details">
                <div className="detail-item">
                  <span className="detail-label">Confidence:</span>
                  <span className="detail-value">{(prediction.confidence_score * 100).toFixed(0)}%</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Model:</span>
                  <span className="detail-value">{prediction.model_used === 'trained' ? 'Trained ML Model' : 'Heuristic Model'}</span>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        // All Locations View
        <div className="all-locations-view">
          <div className="all-locations-header">
            <h3>🌍 Predictions for All Locations</h3>
            <p>Using current weather conditions for {locations.length} locations</p>
            <button 
              onClick={handlePredictAllLocations} 
              disabled={predictingAll || locations.length === 0}
              className="btn-predict-all"
            >
              {predictingAll ? '🔄 Predicting for all locations...' : '🔮 Predict All Locations'}
            </button>
          </div>

          {predictionsByLocation.length > 0 && (
            <div className="all-locations-results">
              <div className="best-location-card">
                <h4>🏆 Best Location to Fish</h4>
                {bestLocation && (
                  <div className="best-location-details">
                    <div className="best-location-name">{bestLocation.location}</div>
                    <div className="best-location-catch">{bestLocation.predicted_catch_kg} kg</div>
                    <div className="best-location-cpue">CPUE: {bestLocation.cpue} kg/h</div>
                    <div className="best-location-conditions">
                      🌡️ {bestLocation.temperature}°C | 💧 {bestLocation.rainfall}mm | 💨 {bestLocation.wind_speed}km/h
                    </div>
                  </div>
                )}
              </div>

              <div className="locations-table-container">
                <table className="locations-prediction-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Location</th>
                      <th>Predicted Catch (kg)</th>
                      <th>CPUE (kg/h)</th>
                      <th>Weather</th>
                      <th>Records</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictionsByLocation.map((loc, index) => (
                      <tr key={loc.location} className={index === 0 ? 'top-ranked' : ''}>
                        <td className="rank">#{index + 1}</td>
                        <td className="location-name">{loc.location}</td>
                        <td className="catch-value">{loc.predicted_catch_kg} kg</td>
                        <td className="cpue-value">{loc.cpue} kg/h</td>
                        <td className="weather-details">
                          🌡️{loc.temperature}° 💧{loc.rainfall}mm 💨{loc.wind_speed}km/h
                        </td>
                        <td className="record-count">{loc.record_count || 0}</td>
                        <td className="confidence">{(loc.confidence * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {predictionsByLocation.length === 0 && !predictingAll && (
            <div className="no-predictions-message">
              <p>Click "Predict All Locations" to see predictions for all your fishing spots.</p>
            </div>
          )}
        </div>
      )}

      {analysis && viewMode === 'single' && (
        <div className="analysis-result">
          <h3>📈 Environmental Impact Analysis</h3>
          
          <div className="analysis-section">
            <h4>🌡️ Temperature Impact</h4>
            <p className="optimal-value">Optimal: {analysis.optimal_temperature?.toFixed(1)}°C</p>
          </div>

          <div className="analysis-section">
            <h4>💧 Rainfall Impact</h4>
            <p className="optimal-value">Optimal: {analysis.optimal_rainfall?.toFixed(1)} mm</p>
          </div>

          <div className="analysis-section">
            <h4>💨 Wind Speed Impact</h4>
            <p className="optimal-value">Optimal: {analysis.optimal_wind?.toFixed(1)} km/h</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MLPredictor;
