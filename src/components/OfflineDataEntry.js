import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';  // Use the configured API instance
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

  const gearTypes = ['Gillnet', 'Trawl', 'Longline', 'Purse seine', 'Handline', 'Other'];

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
          // Use api instance instead of direct axios
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
    try {
      await offlineStorage.saveDraft(draftId, formData);
    } catch (error) {
      console.error('Error saving draft:', error);
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
    if (formData.fish_type || formData.weight_kg) {
      saveDraft();
    }
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
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData({
            ...formData,
            latitude: position.coords.latitude.toFixed(6),
            longitude: position.coords.longitude.toFixed(6),
          });
          setError(null);
        },
        (err) => {
          setError('Unable to get location. Please enter manually.');
        }
      );
    } else {
      setError('Geolocation not supported by your browser.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const dataToSubmit = {
      ...formData,
      weight_kg: parseFloat(formData.weight_kg),
      effort_hours: parseFloat(formData.effort_hours),
      latitude: formData.latitude ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude ? parseFloat(formData.longitude) : null,
    };

    try {
      if (isOnline) {
        // Online: Send directly to server using api instance
        const response = await api.post('/add-catch', dataToSubmit);
        setSuccess({ 
          message: `✅ Record added! CPUE: ${response.data.cpue.toFixed(2)} kg/hour`,
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
        
        if (onSubmitSuccess) onSubmitSuccess();
      } else {
        // Offline: Save locally
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
        
        await updatePendingCount();
      }
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to add record');
    } finally {
      setLoading(false);
    }
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

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label>Date *</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label>Fish Type *</label>
            <input
              type="text"
              name="fish_type"
              value={formData.fish_type}
              onChange={handleChange}
              placeholder="e.g., Tuna, Salmon, Mackerel"
              required
            />
          </div>
          
          <div className="form-group">
            <label>Weight (kg) *</label>
            <input
              type="number"
              name="weight_kg"
              value={formData.weight_kg}
              onChange={handleChange}
              step="0.01"
              min="0"
              placeholder="0.00"
              required
            />
          </div>
          
          <div className="form-group">
            <label>Effort (hours) *</label>
            <input
              type="number"
              name="effort_hours"
              value={formData.effort_hours}
              onChange={handleChange}
              step="0.5"
              min="0"
              placeholder="0.0"
              required
            />
          </div>
          
          <div className="form-group">
            <label>Gear Type *</label>
            <select
              name="gear_type"
              value={formData.gear_type}
              onChange={handleChange}
              required
            >
              {gearTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label>Location Name</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="Fishing ground name"
            />
          </div>
          
          <div className="form-group">
            <label>Latitude</label>
            <input
              type="number"
              name="latitude"
              value={formData.latitude}
              onChange={handleChange}
              step="0.000001"
              placeholder="-90 to 90"
            />
          </div>
          
          <div className="form-group">
            <label>Longitude</label>
            <input
              type="number"
              name="longitude"
              value={formData.longitude}
              onChange={handleChange}
              step="0.000001"
              placeholder="-180 to 180"
            />
          </div>
        </div>
        
        <div className="form-actions">
          <button type="button" onClick={getCurrentLocation} className="btn-secondary">
            📍 Get Current Location
          </button>
          <button type="button" onClick={saveDraft} className="btn-secondary">
            💾 Save Draft
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : isOnline ? '💾 Save Record' : '📱 Save Offline'}
          </button>
        </div>
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