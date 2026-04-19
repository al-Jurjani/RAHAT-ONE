import React from 'react';
import './StatCard.css';

function StatCard({ icon, value, label, trend, trendDir, className = '' }) {
  return (
    <div className={`stat-card ${className}`}>
      {icon && <div className="stat-card__icon">{icon}</div>}
      <div className="stat-card__value">{value ?? '—'}</div>
      <div className="stat-card__label">{label}</div>
      {trend && (
        <div className={`stat-card__trend${trendDir ? ` stat-card__trend--${trendDir}` : ''}`}>
          {trend}
        </div>
      )}
    </div>
  );
}

export default StatCard;
