import React from 'react';
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  AppBar,
  Toolbar,
  Button,
  Paper,
  Chip
} from '@mui/material';
import {
  Person,
  Logout,
  Description,
  CheckCircle,
  Schedule
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';


function EmployeeDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();


  return (
    <>
      {/* Top Navigation Bar */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            RAHAT-ONE - Employee Portal
          </Typography>

          <Typography variant="body2" sx={{ mr: 2 }}>
            Welcome, {user?.name}
          </Typography>
          <Button
            color="inherit"
            startIcon={<Logout />}
            onClick={logout}
          >
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg">
        <Box sx={{ mt: 4, mb: 4 }}>
          {/* Welcome Section */}
          <Paper sx={{ p: 4, mb: 4, bgcolor: 'primary.main', color: 'white' }}>
            <Typography variant="h4" gutterBottom>
              Welcome to Your Dashboard
            </Typography>
            <Typography variant="body1">
              Manage your profile, track your onboarding progress, and access HR services.
            </Typography>
          </Paper>

          {/* Quick Stats */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Person sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                  <Typography variant="h6" gutterBottom>
                    Profile
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    View and manage your information
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Description sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                  <Typography variant="h6" gutterBottom>
                    Documents
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Access your uploaded documents
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card
                sx={{ cursor: 'pointer' }}
                onClick={() => navigate('/employee/leaves')}
              >
                <CardContent sx={{ textAlign: 'center' }}>
                  <Schedule sx={{ fontSize: 48, color: 'warning.main', mb: 1 }} />
                  <Typography variant="h6" gutterBottom>
                    Requests
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Submit leave and expense requests
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* User Info Card */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Your Information
            </Typography>
            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Name
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {user?.name}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Email
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {user?.email}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Role
                </Typography>
                <Chip
                  label={user?.role?.toUpperCase()}
                  color="primary"
                  size="small"
                  sx={{ mt: 0.5 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Employee ID
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {user?.employeeId || 'N/A'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Coming Soon Section */}
          <Paper sx={{ p: 3, mt: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              📋 More Features Coming Soon
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Leave requests, expense claims, and document management will be available soon!
            </Typography>
          </Paper>
        </Box>
      </Container>
    </>
  );
}

export default EmployeeDashboard;
