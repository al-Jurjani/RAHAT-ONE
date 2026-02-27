import React from 'react';
import { Box, Button, Container, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ExpenseHistoryTable from '../components/expense/ExpenseHistoryTable';

const ExpenseHistory = () => {
  const navigate = useNavigate();
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button variant="text" onClick={() => navigate('/employee/dashboard')} sx={{ mb: 2 }}>
        ← Back to Dashboard
      </Button>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Expense History
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Review your expense submissions, track approvals, and view attached invoices.
        </Typography>
      </Box>
      <ExpenseHistoryTable showTitle={false} />
    </Container>
  );
};

export default ExpenseHistory;
