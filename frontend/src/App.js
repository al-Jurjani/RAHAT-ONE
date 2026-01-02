import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Pages (we'll create these next)
import RegistrationPage from './pages/RegistrationPage';
import StatusPage from './pages/StatusPage';
import HRMainPage from './pages/HRMainPage';
import HRDashboard from './pages/HRDashboard';
import HRVerificationDetails from './pages/HRVerificationDetails';

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
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<RegistrationPage />} />
          <Route path="/register" element={<RegistrationPage />} />
          <Route path="/status" element={<StatusPage />} />

          {/* HR Routes */}
          <Route path="/hr" element={<HRMainPage />} />
          <Route path="/hr/verification" element={<HRDashboard />} />
          <Route path="/hr/verification/:employeeId" element={<HRVerificationDetails />} />
        </Routes>
      </Router>
      <ToastContainer position="top-right" autoClose={3000} />
    </ThemeProvider>
  );
}

export default App;
