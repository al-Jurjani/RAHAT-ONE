import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = () => {
      const token = localStorage.getItem('accessToken');
      const userData = localStorage.getItem('user');

      if (token && userData) {
        setUser(JSON.parse(userData));
        // Set token in API headers
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }

      setLoading(false);
    };

    loadUser();
  }, []);

  const login = async (email, password) => {
  try {
    const response = await api.post('/auth/login', { email, password });

    const { accessToken, refreshToken, user: userData } = response.data.data;

    // Store tokens
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(userData));

    // Set user state
    setUser(userData);

    // Set token in API headers
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

    // Small delay to ensure state updates
    await new Promise(resolve => setTimeout(resolve, 100));

    // Redirect based on role
    if (userData.role === 'hr') {
      navigate('/hr');
    } else if (userData.role === 'manager') {
      navigate('/manager/dashboard');
    } else {
      navigate('/employee/dashboard');
    }

    return { success: true };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Login failed'
    };
  }
};

  const logout = () => {
    // Clear storage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');

    // Clear state
    setUser(null);

    // Clear API headers
    delete api.defaults.headers.common['Authorization'];

    // Redirect to login
    navigate('/login');
  };

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
