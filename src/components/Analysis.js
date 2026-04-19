import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import './Analysis.css';

const Analysis = () => {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [reportFormat, setReportFormat] = useState('pdf');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [dataStats, setDataStats] = useState(null);
  
  // Single state to manage location filtering globally
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    fetchDataStats();
    fetchLocations();
  }, []);

  const fetchDataStats = async () => {
    try {
      const response = await api.get('/analysis/stats');
      setDataStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await api.get('/get-locations');
      console.log('Locations response:', response.data);
      setLocations(response.data.locations || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
      setLocations([]);
    }
  };

  const handleDownloadData = async (format) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.startDate) params.append('start_date', dateRange.startDate);
      if (dateRange.endDate) params.append('end_date', dateRange.endDate);
      
      // Send location parameter only if a specific location is chosen
      if (selectedLocation !== 'All') {
        params.append('location', selectedLocation);
      }
      
      const response = await api.get(`/analysis/download/${format}?${params.toString()}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const fileExt = format === 'excel' ? 'xlsx' : format;
      link.setAttribute('download', `fisheries_data_${new Date().toISOString().split('T')[0]}.${fileExt}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      alert(`✅ Data exported successfully as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Error downloading data:', error);
      alert('Failed to download data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const requestData = {
        format: reportFormat,
        include_charts: includeCharts,
        include_summary: includeSummary,
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        // Pass the location and view_type based on the dropdown selection
        location: selectedLocation === 'All' ? '' : selectedLocation,
        view_type: selectedLocation === 'All' ? 'all' : 'location'
      };
      
      console.log('Report request:', requestData);
      
      const response = await api.post('/analysis/generate-report', requestData, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `fisheries_report_${new Date().toISOString().split('T')[0]}.${reportFormat === 'pdf' ? 'pdf' : 'docx'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      alert(`✅ Report generated successfully as ${reportFormat.toUpperCase()}`);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Memoized data transformation to handle local filtering and pivoting species into columns
  const { uniqueSpecies, pivotedRecords } = useMemo(() => {
    if (!dataStats?.recent_records) return { uniqueSpecies: [], pivotedRecords: [] };

    // 1. Filter by location dynamically based on dropdown
    const filtered = dataStats.recent_records.filter(record => 
      selectedLocation === 'All' || record.location === selectedLocation
    );

    // 2. Pivot the data: extract unique species and group rows by trip
    const speciesSet = new Set();
    const grouped = {};

    filtered.forEach(record => {
      if (record.fish_type) speciesSet.add(record.fish_type);
      
      // Grouping by Date + Location + Effort to create a single table row per trip
      const key = `${record.date}_${record.location}_${record.effort_hours}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          id: record.id || key,
          date: record.date,
          location: record.location,
          effort_hours: record.effort_hours,
          cpue: record.cpue,
          species_weights: {}
        };
      }
      
      // Sum the weights in case there are multiple entries for the same species in the same group
      const currentWeight = grouped[key].species_weights[record.fish_type] || 0;
      grouped[key].species_weights[record.fish_type] = currentWeight + (Number(record.weight_kg) || 0);
    });

    return {
      uniqueSpecies: Array.from(speciesSet).sort(),
      pivotedRecords: Object.values(grouped)
    };
  }, [dataStats?.recent_records, selectedLocation]);

  return (
    <div className="analysis-container">
      <h2>📊 Data Analysis & Reports</h2>
      <p className="subtitle">Export your fishing data and generate comprehensive reports</p>

      {/* Data Statistics Cards */}
      {dataStats && (
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-icon">📝</div>
            <div className="stat-info">
              <h3>{dataStats.total_records}</h3>
              <p>Total Records</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🐟</div>
            <div className="stat-info">
              <h3>{dataStats.total_catch_kg} kg</h3>
              <p>Total Catch</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📍</div>
            <div className="stat-info">
              <h3>{dataStats.total_locations}</h3>
              <p>Fishing Locations</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📅</div>
            <div className="stat-info">
              <h3>{dataStats.date_range?.start || 'N/A'}</h3>
              <p>to {dataStats.date_range?.end || 'N/A'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Location Summary Cards */}
      {dataStats?.locations && dataStats.locations.length > 0 && (
        <div className="location-summary">
          <h3>📍 Top Fishing Locations</h3>
          <div className="location-cards">
            {dataStats.locations.slice(0, 4).map((loc, idx) => (
              <div key={idx} className="location-card">
                <div className="location-name">{loc.name}</div>
                <div className="location-stats">
                  <span>🎣 {loc.count} trips</span>
                  <span>🐟 {loc.total_catch} kg</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Section */}
      <div className="filter-section">
        <h3>🔍 Filter Data</h3>
        <div className="filter-grid">
          <div className="filter-group">
            <label>Start Date</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
            />
          </div>
          <div className="filter-group">
            <label>End Date</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
            />
          </div>
          <div className="filter-group">
            <label>Location Filter</label>
            <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)}>
              <option value="All">All Locations</option>
              {locations.map(loc => (
                <option key={loc.name} value={loc.name}>
                  {loc.name} ({loc.record_count || 0} records)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Data Export Section */}
      <div className="export-section">
        <h3>📥 Export Raw Data</h3>
        <p>
          Download data 
          {selectedLocation !== 'All' ? ` for ${selectedLocation} ` : ' for all locations'} 
           in various formats
        </p>
        <div className="export-buttons">
          <button 
            onClick={() => handleDownloadData('excel')} 
            className="btn-excel"
            disabled={loading}
          >
            📊 Excel (.xlsx)
          </button>
          <button 
            onClick={() => handleDownloadData('csv')} 
            className="btn-csv"
            disabled={loading}
          >
            📄 CSV (.csv)
          </button>
          <button 
            onClick={() => handleDownloadData('json')} 
            className="btn-json"
            disabled={loading}
          >
            🔧 JSON (.json)
          </button>
        </div>
      </div>

      {/* Report Generation Section */}
      <div className="report-section">
        <h3>📋 Generate Report</h3>
        <p>
          Create comprehensive reports 
          {selectedLocation !== 'All' ? ` for ${selectedLocation}` : ' for all locations'} 
          with charts and analysis
        </p>
        
        <div className="report-options">
          <div className="option-group">
            <label>Report Format</label>
            <select value={reportFormat} onChange={(e) => setReportFormat(e.target.value)}>
              <option value="pdf">PDF Document</option>
              <option value="docx">Word Document (.docx)</option>
            </select>
          </div>
          
          <div className="option-group">
            <label>Include Charts</label>
            <input
              type="checkbox"
              checked={includeCharts}
              onChange={(e) => setIncludeCharts(e.target.checked)}
            />
          </div>
          
          <div className="option-group">
            <label>Include Summary Statistics</label>
            <input
              type="checkbox"
              checked={includeSummary}
              onChange={(e) => setIncludeSummary(e.target.checked)}
            />
          </div>
        </div>
        
        <button 
          onClick={handleGenerateReport} 
          className="btn-generate"
          disabled={generating}
        >
          {generating ? '📄 Generating Report...' : '📄 Generate Report'}
        </button>
      </div>

      {/* Data Preview */}
      <div className="preview-section">
        <h3>📊 Data Preview {selectedLocation !== 'All' && `(${selectedLocation})`}</h3>
        {pivotedRecords.length > 0 ? (
          <div className="table-container">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Location</th>
                  <th>Effort (hrs)</th>
                  <th>CPUE</th>
                  {/* Dynamically render a column header for each unique species */}
                  {uniqueSpecies.map(species => (
                    <th key={species}>{species} (kg)</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pivotedRecords.map(record => (
                  <tr key={record.id}>
                    <td>{record.date}</td>
                    <td>{record.location || '-'}</td>
                    <td>{record.effort_hours || '-'}</td>
                    <td>{record.cpue ? record.cpue.toFixed(2) : '-'}</td>
                    {/* Map through the unique species list to extract the weight from the group object */}
                    {uniqueSpecies.map(species => (
                      <td key={species}>
                        {record.species_weights[species] 
                          ? record.species_weights[species].toFixed(2) 
                          : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="no-data">No data available for the selected filters.</p>
        )}
      </div>
    </div>
  );
};

export default Analysis;
