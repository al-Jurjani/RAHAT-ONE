import React, { useEffect, useState } from 'react';
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
  const [imgError, setImgError] = useState(false);
  const hasValidSrc = src && typeof src === 'string' && src.trim().length > 100 && !imgError;
  const showImage = hasValidSrc;

  const handleImageError = (event) => {
    if (event?.currentTarget) {
      event.currentTarget.style.display = 'none';
    }
    setImgError(true);
  };

  useEffect(() => {
    setImgError(false);
  }, [src]);

  const initialsStyle = {
    background: nameToColor(name),
    color: '#fff'
  };

  return (
    <div
      className={`avatar avatar--${size} ${className}`}
      style={initialsStyle}
      title={name}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          onError={handleImageError}
          onErrorCapture={handleImageError}
          className="avatar-image"
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
        />
      ) : (
        <div
          className="avatar-initials"
          style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {initials(name) || '?'}
        </div>
      )}
    </div>
  );
}

export default Avatar;
