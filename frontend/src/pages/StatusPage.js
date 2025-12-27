import React from 'react';
import { Container, Typography, Box } from '@mui/material';

function StatusPage() {
  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Registration Status
        </Typography>
        <Typography variant="body1">
          Status checker coming soon...
        </Typography>
      </Box>
    </Container>
  );
}

export default StatusPage;
