import React, { useState } from 'react';
import { addCatchRecord } from '../api';
import './DataEntryForm.css';

const DataEntryForm = ({ onSubmitSuccess }) => {
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

  const gearTypes = ['Gillnet', 'Trawl', 'Longline', 'Purse seine', 'Handline', 'Other'];

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

    try {
      const dataToSubmit = {
        ...formData,
        weight_kg: parseFloat(formData.weight_kg),
        effort_hours: parseFloat(formData.effort_hours),
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      };
      
      const result = await addCatchRecord(dataToSubmit);
      setSuccess(`Record added! CPUE: ${result.cpue.toFixed(2)} kg/hour`);
      
      // Reset form
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
      
      setTimeout(() => {
        if (onSubmitSuccess) onSubmitSuccess();
      }, 1500);
      
    } catch (err) {
      setError(err.error || 'Failed to add record');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="data-entry-form">
      <h2>Record New Catch</h2>
      
      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}
      
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
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : 'Save Catch Record'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DataEntryForm;