import React from 'react';
import './StatusChip.css';

const STATUS_MAP = {
  pending:        { cls: 'warning',  label: 'Pending' },
  approved:       { cls: 'success',  label: 'Approved' },
  rejected:       { cls: 'danger',   label: 'Rejected' },
  flagged:        { cls: 'danger',   label: 'Flagged' },
  in_progress:    { cls: 'info',     label: 'In Progress' },
  draft:          { cls: 'neutral',  label: 'Draft' },
  under_review:   { cls: 'info',     label: 'Under Review' },
  activated:      { cls: 'success',  label: 'Activated' },
  initiated:      { cls: 'info',     label: 'Initiated' },
  expired:        { cls: 'neutral',  label: 'Expired' },
  auto_approved:  { cls: 'success',  label: 'Auto-Approved' },
  auto_rejected:  { cls: 'danger',   label: 'Auto-Rejected' },
  verification_pending: { cls: 'warning', label: 'Verification Pending' },
  pending_manager_approval: { cls: 'warning', label: 'Pending Approval' },
  pending_hr_approval:      { cls: 'info',    label: 'HR Review' },
};

function StatusChip({ status, label: labelOverride, className = '' }) {
  const key = (status || '').toLowerCase().replace(/ /g, '_');
  const { cls, label } = STATUS_MAP[key] || { cls: 'neutral', label: status || 'Unknown' };

  return (
    <span className={`status-chip status-chip--${cls} ${className}`}>
      <span className="status-chip--dot" aria-hidden="true" />
      {labelOverride || label}
    </span>
  );
}

export default StatusChip;
