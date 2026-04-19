import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import offlineStorage from '../services/OfflineStorage';
import './OfflineDataEntry.css';

const OfflineDataEntry = ({ onSubmitSuccess }) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    fish_type: '',
    weight_kg: '',
    effort_hours: '',
    gear_type: 'Gillnet',
    location: '',
    latitude: '',
    longitude: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [draftId] = useState('current_draft');
  const [validationErrors, setValidationErrors] = useState({});

  const gearTypes = ['Gillnet', 'Trawl', 'Longline', 'Purse seine', 'Handline', 'Other'];

  // Format string to proper case (First letter uppercase, rest lowercase)
  const formatProperCase = (str) => {
    if (!str) return str;
    return str.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Format fish type - capitalize first letter of each word
  const formatFishType = (fishType) => {
    if (!fishType) return fishType;
    return fishType.split(/[\s\-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Validation functions - NO DATE RESTRICTIONS
  const validateDate = (date) => {
    if (!date) return 'Date is required';
    // No restrictions on date - can be any valid date
    return null;
  };

  const validateFishType = (fishType) => {
    if (!fishType || fishType.trim() === '') return 'Fish type is required';
    
    const cleaned = fishType.trim();
    if (cleaned.length < 2) return 'Fish type must be at least 2 characters';
    if (cleaned.length > 50) return 'Fish type must be less than 50 characters';
    
    // Allow letters, spaces, hyphens, and apostrophes
    if (!/^[a-zA-Z\s\-']+$/.test(cleaned)) return 'Fish type should only contain letters, spaces, hyphens, and apostrophes';
    
    return null;
  };

  const validateWeight = (weight) => {
    if (!weight && weight !== 0) return 'Weight is required';
    const numWeight = parseFloat(weight);
    if (isNaN(numWeight)) return 'Weight must be a number';
    if (numWeight <= 0) return 'Weight must be greater than 0';
    if (numWeight > 1000) return 'Weight cannot exceed 1000 kg';
    if (numWeight < 0.1) return 'Weight must be at least 0.1 kg';
    
    // Restrict to 2 decimal places
    if (weight.toString().includes('.') && weight.toString().split('.')[1].length > 2) {
      return 'Weight can only have up to 2 decimal places';
    }
    return null;
  };

  const validateEffort = (effort) => {
    if (!effort && effort !== 0) return 'Effort hours are required';
    const numEffort = parseFloat(effort);
    if (isNaN(numEffort)) return 'Effort must be a number';
    if (numEffort <= 0) return 'Effort must be greater than 0';
    if (numEffort > 48) return 'Effort cannot exceed 48 hours';
    if (numEffort < 0.5) return 'Effort must be at least 0.5 hours';
    
    // Restrict to 1 decimal place
    if (effort.toString().includes('.') && effort.toString().split('.')[1].length > 1) {
      return 'Effort can only have up to 1 decimal place';
    }
    return null;
  };

  const validateGearType = (gearType) => {
    if (!gearType) return 'Gear type is required';
    if (!gearTypes.includes(gearType)) return 'Invalid gear type selected';
    return null;
  };

  const validateLocation = (location) => {
    if (location && location.length > 100) return 'Location name is too long (max 100 characters)';
    if (location && !/^[a-zA-Z0-9\s\-_,.'&]+$/.test(location)) {
      return 'Location contains invalid characters';
    }
    return null;
  };

  const validateLatitude = (lat) => {
    if (!lat) return null;
    const numLat = parseFloat(lat);
    if (isNaN(numLat)) return 'Latitude must be a number';
    if (numLat < -90 || numLat > 90) return 'Latitude must be between -90 and 90';
    
    // Restrict to 6 decimal places
    if (lat.toString().includes('.') && lat.toString().split('.')[1].length > 6) {
      return 'Latitude can only have up to 6 decimal places';
    }
    return null;
  };

  const validateLongitude = (lon) => {
    if (!lon) return null;
    const numLon = parseFloat(lon);
    if (isNaN(numLon)) return 'Longitude must be a number';
    if (numLon < -180 || numLon > 180) return 'Longitude must be between -180 and 180';
    
    // Restrict to 6 decimal places
    if (lon.toString().includes('.') && lon.toString().split('.')[1].length > 6) {
      return 'Longitude can only have up to 6 decimal places';
    }
    return null;
  };

  const validateForm = () => {
    const errors = {};
    
    errors.date = validateDate(formData.date);
    errors.fish_type = validateFishType(formData.fish_type);
    errors.weight_kg = validateWeight(formData.weight_kg);
    errors.effort_hours = validateEffort(formData.effort_hours);
    errors.gear_type = validateGearType(formData.gear_type);
    errors.location = validateLocation(formData.location);
    errors.latitude = validateLatitude(formData.latitude);
    errors.longitude = validateLongitude(formData.longitude);
    
    Object.keys(errors).forEach(key => {
      if (errors[key] === null) delete errors[key];
    });
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const updatePendingCount = useCallback(async () => {
    try {
      const count = await offlineStorage.getPendingCount();
      setPendingCount(count);
    } catch (error) {
      console.error('Error getting pending count:', error);
    }
  }, []);

  const syncPendingRecords = useCallback(async () => {
    setSyncing(true);
    try {
      const pendingRecords = await offlineStorage.getPendingRecords();
      
      for (const record of pendingRecords) {
        try {
          const response = await api.post('/add-catch', record.data);
          if (response.status === 201) {
            await offlineStorage.markAsSynced(record.id);
            console.log(`✅ Synced record ${record.id}`);
          }
        } catch (error) {
          console.error(`Failed to sync record ${record.id}:`, error);
          if (record.retryCount >= 3) {
            await offlineStorage.deletePendingRecord(record.id);
          }
        }
      }
      
      await updatePendingCount();
      if (pendingRecords.length > 0) {
        setSuccess({ message: `✅ Synced ${pendingRecords.length} records to server!` });
        setTimeout(() => setSuccess(null), 3000);
      }
      
      if (onSubmitSuccess && pendingRecords.length > 0) {
        onSubmitSuccess();
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  }, [onSubmitSuccess, updatePendingCount]);

  const loadDraft = useCallback(async () => {
    try {
      const draft = await offlineStorage.getDraft(draftId);
      if (draft) {
        setFormData(draft);
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
  }, [draftId]);

  const saveDraft = useCallback(async () => {
    if (formData.fish_type || formData.weight_kg) {
      try {
        await offlineStorage.saveDraft(draftId, formData);
      } catch (error) {
        console.error('Error saving draft:', error);
      }
    }
  }, [draftId, formData]);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setSuccess({ message: '🟢 Back online! Syncing pending records...' });
    syncPendingRecords();
    setTimeout(() => setSuccess(null), 3000);
  }, [syncPendingRecords]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setSuccess({ message: '🔴 You are offline. Records will be saved locally and synced when online.' });
    setTimeout(() => setSuccess(null), 3000);
  }, []);

  useEffect(() => {
    loadDraft();
    updatePendingCount();
  }, [loadDraft, updatePendingCount]);

  useEffect(() => {
    saveDraft();
  }, [formData, saveDraft]);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    let processedValue = value;
    
    if (name === 'fish_type') {
      // Allow only letters, spaces, hyphens, and apostrophes
      processedValue = value.replace(/[^a-zA-Z\s\-']/g, '');
    } else if (name === 'location') {
      // Allow letters, numbers, spaces, and common punctuation
      processedValue = value.replace(/[^a-zA-Z0-9\s\-_,.'&]/g, '');
    } else if (name === 'weight_kg') {
      // Allow only numbers and single decimal point, restrict to 2 decimals
      if (value !== '' && !/^\d*\.?\d{0,2}$/.test(value)) {
        return;
      }
      if (parseFloat(value) < 0) return;
      processedValue = value;
    } else if (name === 'effort_hours') {
      // Allow only numbers and single decimal point, restrict to 1 decimal
      if (value !== '' && !/^\d*\.?\d{0,1}$/.test(value)) {
        return;
      }
      if (parseFloat(value) < 0) return;
      processedValue = value;
    } else if (name === 'latitude') {
      if (value !== '' && !/^-?\d*\.?\d*$/.test(value)) {
        return;
      }
      processedValue = value;
    } else if (name === 'longitude') {
      if (value !== '' && !/^-?\d*\.?\d*$/.test(value)) {
        return;
      }
      processedValue = value;
    }
    
    setFormData({
      ...formData,
      [name]: processedValue,
    });
    
    if (validationErrors[name]) {
      setValidationErrors({
        ...validationErrors,
        [name]: null
      });
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    
    if (name === 'fish_type' && value) {
      const formatted = formatFishType(value);
      if (formatted !== value) {
        setFormData(prev => ({ ...prev, [name]: formatted }));
      }
    } else if (name === 'location' && value) {
      const formatted = formatProperCase(value);
      if (formatted !== value) {
        setFormData(prev => ({ ...prev, [name]: formatted }));
      }
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      setError(null);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData({
            ...formData,
            latitude: position.coords.latitude.toFixed(6),
            longitude: position.coords.longitude.toFixed(6),
          });
          setValidationErrors({
            ...validationErrors,
            latitude: null,
            longitude: null
          });
        },
        (err) => {
          let errorMsg = 'Unable to get location. ';
          switch(err.code) {
            case err.PERMISSION_DENIED:
              errorMsg += 'Please allow location access.';
              break;
            case err.POSITION_UNAVAILABLE:
              errorMsg += 'Location information unavailable.';
              break;
            case err.TIMEOUT:
              errorMsg += 'Location request timed out.';
              break;
            default:
              errorMsg += 'Please enter coordinates manually.';
          }
          setError(errorMsg);
          setTimeout(() => setError(null), 5000);
        }
      );
    } else {
      setError('Geolocation not supported by your browser. Please enter coordinates manually.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      const firstErrorField = Object.keys(validationErrors)[0];
      if (firstErrorField) {
        const element = document.querySelector(`[name="${firstErrorField}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.focus();
        }
      }
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);

    const dataToSubmit = {
      ...formData,
      fish_type: formatFishType(formData.fish_type),
      location: formData.location ? formatProperCase(formData.location) : '',
      weight_kg: parseFloat(parseFloat(formData.weight_kg).toFixed(2)),
      effort_hours: parseFloat(parseFloat(formData.effort_hours).toFixed(1)),
      latitude: formData.latitude ? parseFloat(parseFloat(formData.latitude).toFixed(6)) : null,
      longitude: formData.longitude ? parseFloat(parseFloat(formData.longitude).toFixed(6)) : null,
    };

    try {
      if (isOnline) {
        const response = await api.post('/add-catch', dataToSubmit);
        const cpue = (dataToSubmit.weight_kg / dataToSubmit.effort_hours).toFixed(2);
        setSuccess({ 
          message: `✅ Record added! ${dataToSubmit.weight_kg}kg in ${dataToSubmit.effort_hours} hours (CPUE: ${cpue} kg/h)`,
          isOnline: true 
        });
        
        await offlineStorage.deleteDraft(draftId);
        
        setFormData({
          date: new Date().toISOString().split('T')[0],
          fish_type: '',
          weight_kg: '',
          effort_hours: '',
          gear_type: 'Gillnet',
          location: '',
          latitude: '',
          longitude: '',
        });
        setValidationErrors({});
        
        if (onSubmitSuccess) onSubmitSuccess();
      } else {
        const pendingId = await offlineStorage.savePendingRecord({ data: dataToSubmit });
        setSuccess({ 
          message: `📱 Saved offline! Will sync when online. (ID: ${pendingId})`,
          isOnline: false 
        });
        
        await offlineStorage.deleteDraft(draftId);
        
        setFormData({
          date: new Date().toISOString().split('T')[0],
          fish_type: '',
          weight_kg: '',
          effort_hours: '',
          gear_type: 'Gillnet',
          location: '',
          latitude: '',
          longitude: '',
        });
        setValidationErrors({});
        
        await updatePendingCount();
      }
      
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to add record');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const hasError = (fieldName) => {
    return validationErrors[fieldName] ? true : false;
  };

  return (
    <div className="offline-data-entry">
      <div className="offline-status-bar">
        <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
          {isOnline ? '🟢 Online' : '🔴 Offline'}
        </div>
        {pendingCount > 0 && (
          <div className="pending-badge" onClick={syncPendingRecords}>
            📱 {pendingCount} pending {pendingCount === 1 ? 'record' : 'records'} 
            {isOnline && !syncing && ' (Click to sync)'}
            {syncing && ' - Syncing...'}
          </div>
        )}
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && (
        <div className={`alert success ${success.isOnline === false ? 'offline-success' : ''}`}>
          {success.message}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          {/* Date Field - NO RESTRICTIONS */}
          <div className={`form-group ${hasError('date') ? 'has-error' : ''}`}>
            <label>Date <span className="required">*</span></label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className={hasError('date') ? 'error-input' : ''}
              required
            />
            {validationErrors.date && <span className="error-message">{validationErrors.date}</span>}
          </div>
          
          {/* Fish Type Field */}
          <div className={`form-group ${hasError('fish_type') ? 'has-error' : ''}`}>
            <label>Fish Type <span className="required">*</span></label>
            <input
              type="text"
              name="fish_type"
              value={formData.fish_type}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="e.g., Tuna, Salmon, Mackerel"
              className={hasError('fish_type') ? 'error-input' : ''}
              required
            />
            {validationErrors.fish_type && <span className="error-message">{validationErrors.fish_type}</span>}
            <small className="input-hint">Letters, spaces, and hyphens only</small>
          </div>
          
          {/* Weight Field */}
          <div className={`form-group ${hasError('weight_kg') ? 'has-error' : ''}`}>
            <label>Weight (kg) <span className="required">*</span></label>
            <input
              type="number"
              name="weight_kg"
              value={formData.weight_kg}
              onChange={handleChange}
              step="0.01"
              min="0.1"
              max="1000"
              placeholder="0.00"
              className={hasError('weight_kg') ? 'error-input' : ''}
              required
            />
            {validationErrors.weight_kg && <span className="error-message">{validationErrors.weight_kg}</span>}
            <small className="input-hint">Between 0.1 kg and 1000 kg (2 decimal places max)</small>
          </div>
          
          {/* Effort Field */}
          <div className={`form-group ${hasError('effort_hours') ? 'has-error' : ''}`}>
            <label>Effort (hours) <span className="required">*</span></label>
            <input
              type="number"
              name="effort_hours"
              value={formData.effort_hours}
              onChange={handleChange}
              step="0.5"
              min="0.5"
              max="48"
              placeholder="0.0"
              className={hasError('effort_hours') ? 'error-input' : ''}
              required
            />
            {validationErrors.effort_hours && <span className="error-message">{validationErrors.effort_hours}</span>}
            <small className="input-hint">Between 0.5 and 48 hours (1 decimal place max)</small>
          </div>
          
          {/* Gear Type Field */}
          <div className={`form-group ${hasError('gear_type') ? 'has-error' : ''}`}>
            <label>Gear Type <span className="required">*</span></label>
            <select
              name="gear_type"
              value={formData.gear_type}
              onChange={handleChange}
              className={hasError('gear_type') ? 'error-input' : ''}
              required
            >
              {gearTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            {validationErrors.gear_type && <span className="error-message">{validationErrors.gear_type}</span>}
          </div>
          
          {/* Location Field */}
          <div className={`form-group ${hasError('location') ? 'has-error' : ''}`}>
            <label>Location Name</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Fishing ground name"
              className={hasError('location') ? 'error-input' : ''}
            />
            {validationErrors.location && <span className="error-message">{validationErrors.location}</span>}
            <small className="input-hint">Optional - Letters, numbers, spaces, and basic punctuation</small>
          </div>
          
          {/* Latitude Field */}
          <div className={`form-group ${hasError('latitude') ? 'has-error' : ''}`}>
            <label>Latitude</label>
            <input
              type="number"
              name="latitude"
              value={formData.latitude}
              onChange={handleChange}
              step="0.000001"
              min="-90"
              max="90"
              placeholder="-90 to 90"
              className={hasError('latitude') ? 'error-input' : ''}
            />
            {validationErrors.latitude && <span className="error-message">{validationErrors.latitude}</span>}
            <small className="input-hint">Optional - Between -90 and 90 (6 decimal places max)</small>
          </div>
          
          {/* Longitude Field */}
          <div className={`form-group ${hasError('longitude') ? 'has-error' : ''}`}>
            <label>Longitude</label>
            <input
              type="number"
              name="longitude"
              value={formData.longitude}
              onChange={handleChange}
              step="0.000001"
              min="-180"
              max="180"
              placeholder="-180 to 180"
              className={hasError('longitude') ? 'error-input' : ''}
            />
            {validationErrors.longitude && <span className="error-message">{validationErrors.longitude}</span>}
            <small className="input-hint">Optional - Between -180 and 180 (6 decimal places max)</small>
          </div>
        </div>
        
        <div className="form-actions">
          <button type="button" onClick={getCurrentLocation} className="btn-secondary" disabled={loading}>
            📍 Get Current Location
          </button>
          <button type="button" onClick={saveDraft} className="btn-secondary" disabled={loading}>
            💾 Save Draft
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : isOnline ? '💾 Save Record' : '📱 Save Offline'}
          </button>
        </div>
        
        {/* Validation Summary */}
        {Object.keys(validationErrors).length > 0 && (
          <div className="validation-summary">
            <p>⚠️ Please fix the following errors before submitting:</p>
            <ul>
              {Object.entries(validationErrors).map(([field, error]) => (
                <li key={field}>• {field.replace(/_/g, ' ')}: {error}</li>
              ))}
            </ul>
          </div>
        )}
      </form>

      {!isOnline && (
        <div className="offline-notice">
          <p>⚠️ You are offline. Records will be saved locally and synced when you reconnect.</p>
        </div>
      )}
    </div>
  );
};

export default OfflineDataEntry;
