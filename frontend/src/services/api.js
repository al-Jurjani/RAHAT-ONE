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

      localStorage.removeItem('accessToken');
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

    overrideAssignment: (employeeId, data) =>
    api.put(`/hr/verification/${employeeId}/override-assignment`, data)
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
   Leave Management APIs
========================= */

export const leaveAPI = {
  // Get all leave types
  getTypes: () => api.get('/leaves/types'),

  // Get leave balance (optionally for specific leave type)
  getBalance: (leaveTypeId = null) => {
    const url = leaveTypeId
      ? `/leaves/balance?leave_type_id=${leaveTypeId}`
      : '/leaves/balance';
    return api.get(url);
  },

  // Submit leave request (employee)
  submit: (data) => api.post('/leaves', data),

  // Get my leaves (employee view)
  getMyLeaves: (status = null) => {
    const url = status
      ? `/leaves/my-leaves?status=${status}`
      : '/leaves/my-leaves';
    return api.get(url);
  },

  // Get all leaves (HR/Manager view)
  getAllLeaves: (status = null) => {
    const url = status
      ? `/leaves?status=${status}`
      : '/leaves';
    return api.get(url);
  },

  // Approve or reject leave (HR/Manager)
  updateStatus: (leaveId, action, remarks = '') =>
    api.put(`/leaves/${leaveId}/status`, { action, remarks }),

  // Get leave statistics
  getStatistics: () => api.get('/leaves/statistics'),
};

/* =========================
   Expense Management APIs
========================= */

export const expenseAPI = {
  // Submit expense (multipart/form-data)
  submit: (formData) =>
    api.post('/expenses/submit', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  // List expenses (filters: status, category, dateFrom, dateTo, vendor)
  list: (filters = {}) => api.get('/expenses', { params: filters }),
  // Get invoice attachment (blob response)
  getAttachment: (expenseId) =>
    api.get(`/expenses/${expenseId}/attachment`, { responseType: 'blob' }),
};

export default api;
