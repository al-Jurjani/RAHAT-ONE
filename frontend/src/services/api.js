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

// HR endpoints
export const hrAPI = {
  getPending: () => api.get('/hr/verification/pending'),
  getDetails: (employeeId) => api.get(`/hr/verification/details/${employeeId}`),
  approve: (employeeId, notes) => api.post(`/hr/verification/approve/${employeeId}`, { notes }),
  reject: (employeeId, reason, details) => api.post(`/hr/verification/reject/${employeeId}`, { reason, details }),
};

export default api;
