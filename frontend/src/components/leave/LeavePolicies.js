import React, { useState } from 'react';
import { Button, Modal } from '../ui';

const policySections = [
  {
    title: 'Leave types available',
    points: [
      'Annual Leave for planned time off, drawn from your yearly allocation.',
      'Sick Leave for illness or medical needs.',
      'Emergency Leave for urgent, unforeseen situations.',
      'Unpaid Leave when paid balance is not available or applicable.',
    ],
  },
  {
    title: 'During your first 90 days (probation)',
    points: [
      'Sick Leave and Unpaid Leave remain available to you.',
      'Annual and Emergency Leave generally become available once you complete the probationary period.',
    ],
  },
  {
    title: 'Using your balance',
    points: [
      'Paid leave is granted against your available balance, so keep an eye on what you have left.',
      'Genuine emergencies are handled with flexibility even when your balance is tight.',
      'Plan annual leave ahead of time — a limited number of annual requests are supported each year, so group your days where you can.',
    ],
  },
  {
    title: 'Blackout periods',
    points: [
      'At certain busy times of year the company may set blackout periods when leave normally cannot be granted.',
      'If you have an exceptional circumstance during a blackout period, reach out to HR directly.',
    ],
  },
  {
    title: 'How requests are reviewed',
    points: [
      'Many requests are confirmed quickly in line with company policy — you will be notified by email either way.',
      'Longer or less routine requests are reviewed by your manager, and may also need HR sign-off.',
      'You can always track the status of any request in the Leave History tab.',
    ],
  },
];

const LeavePolicies = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" style={triggerCard} onClick={() => setOpen(true)}>
        <span style={triggerIcon} aria-hidden="true">📋</span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
          <span style={triggerTitle}>Leave Policies</span>
          <span style={triggerSubtitle}>What the company allows — read before you apply</span>
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Leave Policies"
        maxWidth="640px"
        footer={<Button onClick={() => setOpen(false)}>Got it</Button>}
      >
        <p style={intro}>
          A quick rundown of how leave works here. For anything specific to your situation,
          your manager and HR are happy to help.
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
  marginTop: 'var(--space-3)',
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

export default LeavePolicies;
