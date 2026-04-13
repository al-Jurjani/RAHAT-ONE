import React from 'react';
import './Spinner.css';

function SkeletonLoader({ width = '100%', height = '16px', borderRadius, style, className = '' }) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius, display: 'block', ...style }}
      aria-hidden="true"
    />
  );
}

export default SkeletonLoader;
