import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import { useParams } from 'react-router-dom';

function HRVerificationDetails() {
  const { employeeId } = useParams();

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Verification Details
        </Typography>
        <Typography variant="body1">
          Viewing employee {employeeId}...
        </Typography>
      </Box>
    </Container>
  );
}

export default HRVerificationDetails;
