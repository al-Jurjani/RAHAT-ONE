import axios from 'axios';

/**
 * Base API configuration
 */
const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Axios instance
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor
 * Attaches JWT token to every request if present
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response interceptor
 * Handles expired / invalid tokens globally
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('Unauthorized or expired token. Redirecting to login.');

      localStorage.removeItem('token');
      localStorage.removeItem('user');

      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

/* =========================
   Registration APIs
========================= */

export const registrationAPI = {
  initiate: (data) => api.post('/registration/initiate', data),

  complete: (formData) =>
    api.post('/registration/complete', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getStatus: (email) =>
    api.get(`/registration/status?personalEmail=${email}`),
};

/* =========================
   Lookup APIs
========================= */

export const lookupAPI = {
  getDepartments: () => api.get('/lookup/departments'),

  getPositions: (departmentId) =>
    departmentId
      ? api.get(`/lookup/positions?departmentId=${departmentId}`)
      : api.get('/lookup/positions'),
};

/* =========================
   HR APIs
========================= */

export const hrAPI = {
  getPending: () => api.get('/hr/verification/pending'),
  getApproved: () => api.get('/hr/verification/approved'),
  getRejected: () => api.get('/hr/verification/rejected'),

  getDetails: (employeeId) =>
    api.get(`/hr/verification/details/${employeeId}`),

  getDocument: (documentId) =>
    api.get(`/hr/verification/document/${documentId}`, {
      responseType: 'blob',
    }),

  approve: (employeeId, notes) =>
    api.post(`/hr/verification/approve/${employeeId}`, { notes }),

  reject: (employeeId, reason, details) =>
    api.post(`/hr/verification/reject/${employeeId}`, {
      reason,
      details,
    }),
};

/* =========================
   Onboarding APIs
========================= */

export const onboardingAPI = {
  initiate: (data) => api.post('/onboarding/initiate', data),
  getStatus: (employeeId) =>
    api.get(`/onboarding/status/${employeeId}`),
};

/* =========================
   Leave APIs (optional but recommended)
========================= */

export const leaveAPI = {
  getBalance: () => api.get('/leaves/balance'),
  getTypes: () => api.get('/leaves/types'),
  getMyLeaves: () => api.get('/leaves/my-leaves'),
  submit: (data) => api.post('/leaves/request', data),
};

export default api;
