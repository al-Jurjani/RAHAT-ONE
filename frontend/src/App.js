import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ApproveLeave from './pages/ApproveLeave';
import ApproveExpense from './pages/ApproveExpense';

// Auth
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import RegistrationPage from './pages/RegistrationPage';
import HRMainPage from './pages/HRMainPage';
import HRDashboard from './pages/HRDashboard';
import HRVerificationDetails from './pages/HRVerificationDetails';
import EmployeeDashboard from './pages/EmployeeDashboard';
import EmployeeProfile from './pages/EmployeeProfile';
import EmployeeLeavePage from './pages/EmployeeLeavePage';
import EmployeeActivityPage from './pages/EmployeeActivityPage';
import HRLeaveDashboard from './pages/HRLeaveDashboard';
import HRExpenseDashboard from './pages/HRExpenseDashboard';
import AuditLogPage from './pages/AuditLogPage';
import HRBranchManagementPage from './pages/HRBranchManagementPage';
import HRAttendanceOverviewPage from './pages/HRAttendanceOverviewPage';
import ExpenseSubmission from './pages/ExpenseSubmission';
import ExpenseHistory from './pages/ExpenseHistory';
import { ThemeModeProvider } from './contexts/ThemeModeContext';

const createAppTheme = (mode) => {
  const isDark = mode === 'dark';

  return createTheme({
  palette: {
    mode,
    background: {
      default: isDark ? '#0a0a0a' : '#f5f7fb',
      paper: isDark ? '#141414' : '#ffffff',
    },
    primary: {
      main: isDark ? '#FF6B35' : '#e05a2c',
      contrastText: isDark ? '#0a0a0a' : '#ffffff',
    },
    secondary: {
      main: isDark ? '#FF6B35' : '#e05a2c',
    },
    success: {
      main: '#22c55e',
    },
    warning: {
      main: '#f59e0b',
    },
    error: {
      main: '#ef4444',
    },
    info: {
      main: '#3b82f6',
    },
    text: {
      primary: isDark ? '#f0f0f0' : '#111827',
      secondary: isDark ? '#a0a0a0' : '#4b5563',
      disabled: isDark ? '#606060' : '#9ca3af',
    },
    divider: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.10)',
  },
  typography: {
    fontFamily: "'Mona Sans', system-ui, sans-serif",
    h1: { fontFamily: "'Hubot Sans', system-ui, sans-serif" },
    h2: { fontFamily: "'Hubot Sans', system-ui, sans-serif" },
    h3: { fontFamily: "'Hubot Sans', system-ui, sans-serif" },
    h4: { fontFamily: "'Hubot Sans', system-ui, sans-serif" },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: isDark ? '#0a0a0a' : '#f5f7fb',
          fontFamily: "'Mona Sans', system-ui, sans-serif",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: isDark ? '#141414' : '#ffffff',
          border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(17,24,39,0.10)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: isDark ? '#141414' : '#ffffff',
          border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(17,24,39,0.10)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: isDark ? 'rgba(20,20,20,0.9)' : 'rgba(255,255,255,0.92)',
          backgroundImage: 'none',
          borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(17,24,39,0.10)',
          boxShadow: 'none',
          backdropFilter: 'blur(12px)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: isDark ? '#141414' : '#ffffff',
          backgroundImage: 'none',
          border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(17,24,39,0.10)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: '10px',
        },
        containedPrimary: {
          backgroundColor: '#FF6B35',
          color: '#0a0a0a',
          '&:hover': { backgroundColor: '#ff8555' },
        },
        containedSuccess: {
          backgroundColor: '#22c55e',
          color: '#0a0a0a',
        },
        containedError: {
          backgroundColor: '#ef4444',
        },
        containedInfo: {
          backgroundColor: '#3b82f6',
        },
        outlined: {
          borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(17,24,39,0.20)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
            '& fieldset': { borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(17,24,39,0.20)' },
            '&:hover fieldset': { borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(17,24,39,0.30)' },
            '&.Mui-focused fieldset': { borderColor: isDark ? '#FF6B35' : '#e05a2c' },
          },
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: isDark ? '#1c1c1c' : '#f3f5fa',
            color: '#a0a0a0',
            ...(isDark ? {} : { color: '#4b5563' }),
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.10)',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.10)',
          color: isDark ? '#f0f0f0' : '#111827',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': { backgroundColor: isDark ? '#1c1c1c' : '#f3f5fa' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: '9999px', fontSize: '0.75rem' },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(17,24,39,0.10)' },
        indicator: { backgroundColor: '#FF6B35' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          color: isDark ? '#a0a0a0' : '#4b5563',
          '&.Mui-selected': { color: isDark ? '#FF6B35' : '#e05a2c' },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
          backgroundImage: 'none',
          border: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(17,24,39,0.16)',
          borderRadius: '16px',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { color: '#f0f0f0', fontWeight: 600 },
      },
    },
    MuiSelect: {
      styleOverrides: {
        outlined: { backgroundColor: isDark ? '#1c1c1c' : '#ffffff' },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          '&:hover': { backgroundColor: isDark ? '#242424' : '#f3f5fa' },
          '&.Mui-selected': { backgroundColor: isDark ? 'rgba(255,107,53,0.12)' : 'rgba(224,90,44,0.12)' },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: '10px' },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.12)', borderRadius: '4px' },
        bar: { borderRadius: '4px' },
      },
    },
    MuiCircularProgress: {
      styleOverrides: {
        root: { color: '#FF6B35' },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.10)' },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { color: isDark ? '#a0a0a0' : '#4b5563', '&.Mui-focused': { color: isDark ? '#FF6B35' : '#e05a2c' } },
      },
    },
  },
  });
};

function App() {
  const [mode, setMode] = useState(() => localStorage.getItem('rahato-theme-mode') || 'dark');

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  useEffect(() => {
    document.body.setAttribute('data-theme', mode);
    localStorage.setItem('rahato-theme-mode', mode);
  }, [mode]);

  const toggleTheme = () => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ThemeModeProvider value={{ mode, toggleTheme }}>
        <Router>
          <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<RegistrationPage />} />
            <Route path="/approve-leave/:leaveId" element={<ApproveLeave />} />
            <Route path="/approve-expense/:expenseId" element={<ApproveExpense />} />

            {/* Protected HR Routes */}
            <Route path="/hr" element={<ProtectedRoute allowedRoles={['hr']}><HRMainPage /></ProtectedRoute>} />
            <Route path="/hr/verification" element={<ProtectedRoute allowedRoles={['hr']}><HRDashboard /></ProtectedRoute>} />
            <Route path="/hr/verification/:employeeId" element={<ProtectedRoute allowedRoles={['hr']}><HRVerificationDetails /></ProtectedRoute>} />
            <Route path="/hr/leave-dashboard" element={<ProtectedRoute allowedRoles={['hr']}><HRLeaveDashboard /></ProtectedRoute>} />
            <Route path="/hr/expense-dashboard" element={<ProtectedRoute allowedRoles={['hr']}><HRExpenseDashboard /></ProtectedRoute>} />
            <Route path="/hr/audit-log" element={<ProtectedRoute allowedRoles={['hr']}><AuditLogPage /></ProtectedRoute>} />
            <Route path="/hr/branches" element={<ProtectedRoute allowedRoles={['hr']}><HRBranchManagementPage /></ProtectedRoute>} />
            <Route path="/hr/attendance" element={<ProtectedRoute allowedRoles={['hr']}><HRAttendanceOverviewPage /></ProtectedRoute>} />

            {/* Protected Employee Routes */}
            <Route path="/employee/dashboard" element={<ProtectedRoute allowedRoles={['employee']}><EmployeeDashboard /></ProtectedRoute>} />
            <Route path="/employee/activity" element={<ProtectedRoute allowedRoles={['employee']}><EmployeeActivityPage /></ProtectedRoute>} />
            <Route path="/employee/profile" element={<ProtectedRoute allowedRoles={['employee']}><EmployeeProfile /></ProtectedRoute>} />
            <Route path="/expenses/submit" element={<ProtectedRoute allowedRoles={['employee']}><ExpenseSubmission /></ProtectedRoute>} />
            <Route path="/expenses/history" element={<ProtectedRoute allowedRoles={['employee']}><ExpenseHistory /></ProtectedRoute>} />
            <Route path="/employee/leaves" element={<ProtectedRoute allowedRoles={['employee']}><EmployeeLeavePage /></ProtectedRoute>} />

            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
            <ToastContainer position="top-right" autoClose={3000} theme={mode === 'dark' ? 'dark' : 'light'} />
          </AuthProvider>
        </Router>
      </ThemeModeProvider>
    </ThemeProvider>
  );
}

export default App;
