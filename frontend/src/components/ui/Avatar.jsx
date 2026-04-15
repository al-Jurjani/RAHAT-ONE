import React from 'react';
import './Avatar.css';

const PALETTE = [
  '#c2410c','#b45309','#15803d','#0369a1','#7c3aed','#be185d','#0f766e','#a16207',
];

function nameToColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('');
}

function Avatar({ name = '', src, size = 'md', className = '' }) {
  return (
    <div
      className={`avatar avatar--${size} ${className}`}
      style={!src ? { background: nameToColor(name) } : undefined}
      title={name}
    >
      {src ? (
        <img src={src} alt={name} />
      ) : (
        <span style={{ color: '#fff' }}>{initials(name) || '?'}</span>
      )}
    </div>
  );
}

export default Avatar;
