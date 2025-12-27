import React from 'react';
import { Container, Typography, Box } from '@mui/material';

function RegistrationPage() {
  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Employee Registration
        </Typography>
        <Typography variant="body1">
          Registration form coming soon...
        </Typography>
      </Box>
    </Container>
  );
}

export default RegistrationPage;
