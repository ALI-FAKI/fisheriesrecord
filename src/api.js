import axios from 'axios';

// Use environment variable or default to localhost for development
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`📤 ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

// Handle responses
api.interceptors.response.use(
  (response) => {
    console.log(`📥 ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      console.error('Authentication error - redirecting to login');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// ==================== AUTH ENDPOINTS ====================

export const register = async (userData) => {
  try {
    const response = await api.post('/auth/register', userData);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: error.message };
  }
};

export const login = async (credentials) => {
  try {
    const response = await api.post('/auth/login', credentials);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: error.message };
  }
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const getCurrentUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

// ==================== CATCH RECORD ENDPOINTS ====================

export const addCatchRecord = async (data) => {
  try {
    const response = await api.post('/add-catch', data);
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: error.message };
  }
};

export const getCatches = async (page = 1, perPage = 50) => {
  try {
    const response = await api.get('/catches', {
      params: { page, per_page: perPage },
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: error.message };
  }
};

export const getDashboardSummary = async () => {
  try {
    const response = await api.get('/dashboard-summary');
    return {
      summary: response.data.summary || {
        total_catch_kg: 0,
        total_effort_hours: 0,
        average_cpue: 0,
        total_records: 0,
        top_fish_species: []
      },
      monthly_analysis: response.data.monthly_analysis || [],
      cpue_timeline: response.data.cpue_timeline || []
    };
  } catch (error) {
    console.error('Dashboard summary error:', error);
    return {
      summary: {
        total_catch_kg: 0,
        total_effort_hours: 0,
        average_cpue: 0,
        total_records: 0,
        top_fish_species: []
      },
      monthly_analysis: [],
      cpue_timeline: []
    };
  }
};

// ==================== ML PREDICTION ENDPOINTS ====================

export const predictCatch = async (data) => {
  try {
    const response = await api.post('/predict-catch', {
      temperature: parseFloat(data.temperature),
      rainfall: parseFloat(data.rainfall),
      wind_speed: parseFloat(data.wind_speed),
      effort_hours: parseFloat(data.effort_hours),
      month: parseInt(data.month)
    });
    return response.data;
  } catch (error) {
    console.error('Prediction error:', error);
    throw error.response?.data || { error: error.message };
  }
};

export const trainModel = async () => {
  try {
    const response = await api.post('/train-model', { model_type: 'random_forest' });
    return response.data;
  } catch (error) {
    console.error('Train model error:', error);
    throw error.response?.data || { error: error.message };
  }
};

export const getModelStatus = async () => {
  try {
    const response = await api.get('/model-status');
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: error.message };
  }
};

export const getEnvironmentalAnalysis = async () => {
  try {
    const response = await api.get('/environmental-analysis');
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: error.message };
  }
};

// ==================== LOCATION ENDPOINTS ====================

export const getLocations = async () => {
  try {
    const response = await api.get('/get-locations');
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: error.message };
  }
};

export const getWeatherForLocation = async (data) => {
  try {
    const response = await api.post('/get-weather-for-location', data);
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: error.message };
  }
};

export const predictSpecificLocation = async (data) => {
  try {
    const response = await api.post('/predict-specific-location', data);
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: error.message };
  }
};

// ==================== TIME-SERIES PREDICTION ENDPOINTS ====================

export const predictByDate = async (data) => {
  try {
    const response = await api.post('/predict-by-date', {
      date: data.date,
      effort_hours: data.effort_hours
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: error.message };
  }
};

export const predictTimeSeries = async (data) => {
  try {
    const response = await api.post('/predict-timeseries', data);
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: error.message };
  }
};

// ==================== ORGANIZATION ENDPOINTS ====================

export const getOrganizationStats = async (organizationId) => {
  try {
    const response = await api.get(`/organizations/${organizationId}/stats`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: error.message };
  }
};

export const getOrganizationUsers = async (organizationId) => {
  try {
    const response = await api.get(`/organizations/${organizationId}/users`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: error.message };
  }
};

export const addOrganizationWorker = async (organizationId, userData) => {
  try {
    const response = await api.post(`/organizations/${organizationId}/workers`, userData);
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: error.message };
  }
};

// ==================== ADMIN DASHBOARD ENDPOINT ====================

export const getAdminDashboardSummary = async () => {
  try {
    const response = await api.get('/admin/dashboard-summary');
    console.log('Admin dashboard response:', response.data);
    return {
      summary: response.data.summary || {
        total_catch_kg: 0,
        total_effort_hours: 0,
        average_cpue: 0,
        total_records: 0,
        total_workers: 0,
        top_fish_species: []
      },
      monthly_analysis: response.data.monthly_analysis || [],
      cpue_timeline: response.data.cpue_timeline || [],
      worker_stats: response.data.worker_stats || []
    };
  } catch (error) {
    console.error('Admin dashboard error:', error);
    return {
      summary: {
        total_catch_kg: 0,
        total_effort_hours: 0,
        average_cpue: 0,
        total_records: 0,
        total_workers: 0,
        top_fish_species: []
      },
      monthly_analysis: [],
      cpue_timeline: [],
      worker_stats: []
    };
  }
};

// ==================== ENVIRONMENTAL DATA ====================
export const getEnvironmentalData = async () => {
  try {
    const response = await api.get('/environmental-data');
    return response.data;
  } catch (error) {
    console.error('Error fetching environmental data:', error);
    return { data: [] };
  }
};
// ==================== DATA QUALITY ENDPOINT ====================

export const getDataQuality = async () => {
  try {
    const response = await api.get('/data-quality');
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: error.message };
  }
};

export default api;
