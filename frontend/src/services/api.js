import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Registration endpoints
export const registrationAPI = {
  initiate: (data) => api.post('/registration/initiate', data),

  complete: (formData) => {
    return api.post('/registration/complete', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  getStatus: (email) => api.get(`/registration/status?personalEmail=${email}`),
};

// Lookup endpoints
export const lookupAPI = {
  getDepartments: () => api.get('/lookup/departments'),
  getPositions: (departmentId) => {
    const url = departmentId
      ? `/lookup/positions?departmentId=${departmentId}`
      : '/lookup/positions';
    return api.get(url);
  },
};

// HR endpoints - CHANGED: Use 'api' instead of 'axios'
export const hrAPI = {
  getPending: () => api.get('/hr/verification/pending'),
  getApproved: () => api.get('/hr/verification/approved'),
  getRejected: () => api.get('/hr/verification/rejected'),
  getDetails: (employeeId) => api.get(`/hr/verification/details/${employeeId}`),
  getDocument: (documentId) => api.get(`/hr/verification/document/${documentId}`, {
    responseType: 'blob'
  }),
  approve: (employeeId, notes) => api.post(`/hr/verification/approve/${employeeId}`, { notes }),
  reject: (employeeId, reason, details) => api.post(`/hr/verification/reject/${employeeId}`, { reason, details })
};

// Onboarding endpoints
export const onboardingAPI = {
  initiate: (data) => api.post('/onboarding/initiate', data),
  getStatus: (employeeId) => api.get(`/onboarding/status/${employeeId}`)
};

export default api;
