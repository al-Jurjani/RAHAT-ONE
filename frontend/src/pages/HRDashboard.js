import React from 'react';
import { Container, Typography, Box } from '@mui/material';

function HRDashboard() {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          HR Dashboard
        </Typography>
        <Typography variant="body1">
          Pending registrations coming soon...
        </Typography>
      </Box>
    </Container>
  );
}

export default HRDashboard;
