import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CircularProgress, Box } from '@mui/material';

function ProtectedRoute({ children, allowedRoles = [], requireManager = false }) {
  const { user, loading, viewMode } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // HR users with a linked employee record can access employee routes in employee view mode
    const hrInEmployeeMode =
      user.role === 'hr' &&
      user.employeeId &&
      viewMode === 'employee' &&
      allowedRoles.includes('employee');
    if (!hrInEmployeeMode) {
      // HR users switching back to HR mode get sent to /hr, not /unauthorized
      if (user.role === 'hr') return <Navigate to="/hr" replace />;
      return <Navigate to="/unauthorized" replace />;
    }
  }

  if (requireManager && !user.isManager) {
    return <Navigate to="/employee/dashboard" replace />;
  }

  return children;
}

export default ProtectedRoute;
