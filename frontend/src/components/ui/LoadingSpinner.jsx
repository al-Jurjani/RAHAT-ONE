import React from 'react';
import './Spinner.css';

function LoadingSpinner({ size = 'md', center = true }) {
  const spinner = <span className={`spinner spinner--${size}`} role="status" aria-label="Loading" />;
  if (center) return <div className="spinner-center">{spinner}</div>;
  return spinner;
}

export default LoadingSpinner;
