import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  AppBar,
  Toolbar
} from '@mui/material';
import { VerifiedUser, PersonAdd, Logout } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import InitiateOnboardingModal from '../components/InitiateOnboardingModal';

function HRMainPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [initiateDialogOpen, setInitiateDialogOpen] = useState(false);

  const handleInitiateSuccess = (employeeData) => {
    console.log('Onboarding initiated for employee:', employeeData);
  };

  return (
    <>
      {/* Top Navigation Bar with Logout */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            RAHAT-ONE - HR Portal
          </Typography>

          {/* User Info & Logout */}
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
        <Box sx={{ mt: 8, mb: 4 }}>
          <Typography variant="h3" component="h1" gutterBottom align="center">
            HR Portal
          </Typography>
          <Typography variant="h6" color="text.secondary" align="center" sx={{ mb: 6 }}>
            Welcome to HR Management
          </Typography>

          <Grid container spacing={4} justifyContent="center">
            {/* Employee Verification Card */}
            <Grid item xs={12} sm={6} md={5}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4
                  }
                }}
              >
                <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <VerifiedUser sx={{ fontSize: 60, color: 'primary.main' }} />
                  </Box>
                  <Typography variant="h5" component="h2" gutterBottom>
                    Employee Verification
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Review and verify pending employee registrations, approve or reject candidates
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: 'center', pb: 3 }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => navigate('/hr/verification')}
                  >
                    Go to Verification
                  </Button>
                </CardActions>
              </Card>
            </Grid>

            {/* Initiate Onboarding Card */}
            <Grid item xs={12} sm={6} md={5}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4
                  }
                }}
              >
                <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <PersonAdd sx={{ fontSize: 60, color: 'success.main' }} />
                  </Box>
                  <Typography variant="h5" component="h2" gutterBottom>
                    Initiate Onboarding
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Start the onboarding process for new employees by sending them an invitation email
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: 'center', pb: 3 }}>
                  <Button
                    variant="contained"
                    color="success"
                    size="large"
                    onClick={() => setInitiateDialogOpen(true)}
                  >
                    Initiate Onboarding
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          </Grid>
        </Box>

        {/* Initiate Onboarding Modal */}
        <InitiateOnboardingModal
          open={initiateDialogOpen}
          onClose={() => setInitiateDialogOpen(false)}
          onSuccess={handleInitiateSuccess}
        />
      </Container>
    </>
  );
}

export default HRMainPage;
