import React from 'react';
import AppShell from '../components/layout/AppShell';
import ExpenseHistoryTable from '../components/expense/ExpenseHistoryTable';

const ExpenseHistory = () => {
  return (
    <AppShell pageTitle="Expense History">
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 'var(--text-sm)' }}>
          Review your expense submissions, track approvals, and view attached invoices.
        </p>
      </div>
      <ExpenseHistoryTable showTitle={false} />
    </AppShell>
  );
};

export default ExpenseHistory;
