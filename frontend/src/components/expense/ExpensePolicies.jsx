import React, { useState } from 'react';
import { Button, Modal } from '../ui';

const policySections = [
  {
    title: 'Expense categories',
    points: [
      'Choose the category that genuinely fits your claim: Medical, Petrol, Travel, or Other.',
      'Each category has a reasonable ceiling — claims well beyond what is typical for that category will not go through automatically.',
    ],
  },
  {
    title: 'Invoices are required',
    points: [
      'Attach a clear invoice or receipt (image or PDF) for every claim.',
      'Anything beyond a small amount must have supporting documentation to be considered.',
      'Make sure the invoice is legitimate and matches the amount and vendor you entered.',
    ],
  },
  {
    title: 'Accurate, genuine claims',
    points: [
      'Submit real expenses only — invoices are checked automatically for duplicates and signs of tampering.',
      'Re-using or altering a receipt, or submitting the same invoice twice, will be detected.',
      'Keep claims consistent with your normal pattern; unusual or out-of-character claims get a closer look.',
    ],
  },
  {
    title: 'How claims are reviewed',
    points: [
      'Many straightforward claims with a valid invoice are processed quickly.',
      'Larger, first-time, or unusual claims are routed to your manager and/or HR for review.',
      'You will be notified of the outcome by email, and can always track status in Expense History.',
    ],
  },
];

const ExpensePolicies = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" style={triggerCard} onClick={() => setOpen(true)}>
        <span style={triggerIcon} aria-hidden="true">📋</span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
          <span style={triggerTitle}>Expense Policies</span>
          <span style={triggerSubtitle}>What the company allows — read before you claim</span>
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Expense Policies"
        maxWidth="640px"
        footer={<Button onClick={() => setOpen(false)}>Got it</Button>}
      >
        <p style={intro}>
          A quick rundown of how expense claims work here. For anything specific to your
          situation, your manager and HR are happy to help.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {policySections.map((section) => (
            <div key={section.title}>
              <p style={sectionHeading}>{section.title}</p>
              <ul style={list}>
                {section.points.map((point, i) => (
                  <li key={i} style={listItem}>{point}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
};

const triggerCard = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  width: '100%',
  marginTop: 'var(--space-4)',
  padding: 'var(--space-4)',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-lg)',
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
};

const triggerIcon = {
  fontSize: 'var(--text-xl)',
  lineHeight: 1,
};

const triggerTitle = {
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  color: 'var(--text-primary)',
};

const triggerSubtitle = {
  fontSize: 'var(--text-xs)',
  color: 'var(--text-secondary)',
};

const intro = {
  margin: '0 0 var(--space-5)',
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
  lineHeight: 1.6,
};

const sectionHeading = {
  margin: '0 0 var(--space-2)',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  color: 'var(--text-primary)',
};

const list = {
  margin: 0,
  paddingLeft: 'var(--space-5)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
};

const listItem = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
  lineHeight: 1.6,
};

export default ExpensePolicies;
