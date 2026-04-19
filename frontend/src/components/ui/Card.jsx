import React from 'react';
import './Card.css';

function Card({ children, hoverable = false, header, headerRight, className = '', style, onClick }) {
  const classes = [
    'card',
    hoverable ? 'card--hoverable' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style} onClick={onClick}>
      {(header || headerRight) && (
        <div className="card-header">
          {header && <h3 className="card-header-title">{header}</h3>}
          {headerRight && <div className="card-header-right">{headerRight}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export default Card;
