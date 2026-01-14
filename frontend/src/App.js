import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


// Auth
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import RegistrationPage from './pages/RegistrationPage';
import StatusPage from './pages/StatusPage';
import HRMainPage from './pages/HRMainPage';
import HRDashboard from './pages/HRDashboard';
import HRVerificationDetails from './pages/HRVerificationDetails';
import EmployeeDashboard from './pages/EmployeeDashboard';
import EmployeeLeavePage from './pages/EmployeeLeavePage';

// Outfitters theme colors
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // Blue
    },
    secondary: {
      main: '#00897b', // Teal
    },
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<RegistrationPage />} />
            <Route path="/status" element={<StatusPage />} />
            {/* <Route path="/leaves" element={<EmployeeLeavePage />} /> */}


            {/* Protected HR Routes */}
            <Route
              path="/hr"
              element={
                <ProtectedRoute allowedRoles={['hr']}>
                  <HRMainPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/verification"
              element={
                <ProtectedRoute allowedRoles={['hr']}>
                  <HRDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/verification/:employeeId"
              element={
                <ProtectedRoute allowedRoles={['hr']}>
                  <HRVerificationDetails />
                </ProtectedRoute>
              }
            />

            {/* Protected Employee Routes */}
            <Route
              path="/employee/dashboard"
              element={
                <ProtectedRoute allowedRoles={['employee']}>
                  <EmployeeDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee/leaves"
              element={
                <ProtectedRoute allowedRoles={['employee']}>
                  <EmployeeLeavePage />
                </ProtectedRoute>
              }
            />


            {/* Redirect root to login */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* 404 - redirect to login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          <ToastContainer position="top-right" autoClose={3000} />
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
