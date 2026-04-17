import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import FmdGoodIcon from '@mui/icons-material/FmdGood';
import EventIcon from '@mui/icons-material/Event';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PersonIcon from '@mui/icons-material/Person';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui';
import rahatOneLogo from '../assets/rahat-one-logo.svg';
import './PWAGuard.css';

function detectStandaloneMode() {
  if (typeof window === 'undefined') {
    return false;
  }

  if (typeof window.matchMedia !== 'function') {
    return window.navigator.standalone === true;
  }

  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function detectMobileMode() {
  if (typeof window === 'undefined') {
    return false;
  }

  if (typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(max-width: 768px)').matches;
}

function PWABottomNav() {
  const navItems = useMemo(() => ([
    { to: '/employee/home', icon: <HomeIcon fontSize="small" />, label: 'Home' },
    { to: '/employee/attendance', icon: <FmdGoodIcon fontSize="small" />, label: 'Check In' },
    { to: '/employee/leaves', icon: <EventIcon fontSize="small" />, label: 'Leaves' },
    { to: '/employee/expenses', icon: <ReceiptIcon fontSize="small" />, label: 'Expenses' },
    { to: '/employee/profile', icon: <PersonIcon fontSize="small" />, label: 'Profile' },
  ]), []);

  return createPortal(
    <nav className="pwa-bottom-nav" aria-label="Employee navigation">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `pwa-bottom-nav__item${isActive ? ' pwa-bottom-nav__item--active' : ''}`}
        >
          <span className="pwa-bottom-nav__icon">{item.icon}</span>
          <span className="pwa-bottom-nav__label">{item.label}</span>
          <span className="pwa-bottom-nav__dot" aria-hidden="true" />
        </NavLink>
      ))}
    </nav>,
    document.body
  );
}

function PWAGuard({ children }) {
  const { user, loading } = useAuth();
  const [isStandalone, setIsStandalone] = useState(detectStandaloneMode);
  const [isMobile, setIsMobile] = useState(detectMobileMode);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const mobileQuery = window.matchMedia('(max-width: 768px)');

    const updateStandalone = () => setIsStandalone(detectStandaloneMode());
    const updateMobile = () => setIsMobile(detectMobileMode());

    updateStandalone();
    updateMobile();

    if (standaloneQuery.addEventListener) {
      standaloneQuery.addEventListener('change', updateStandalone);
      mobileQuery.addEventListener('change', updateMobile);
      return () => {
        standaloneQuery.removeEventListener('change', updateStandalone);
        mobileQuery.removeEventListener('change', updateMobile);
      };
    }

    standaloneQuery.addListener(updateStandalone);
    mobileQuery.addListener(updateMobile);
    return () => {
      standaloneQuery.removeListener(updateStandalone);
      mobileQuery.removeListener(updateMobile);
    };
  }, []);

  const isPwaEmployeeMode = isStandalone && isMobile && user?.role === 'employee';
  const isPwaBlocked = isStandalone && !loading && !!user && user?.role === 'hr';

  useEffect(() => {
    document.body.classList.toggle('pwa-employee-mode', isPwaEmployeeMode);
    return () => {
      document.body.classList.remove('pwa-employee-mode');
    };
  }, [isPwaEmployeeMode]);

  if (loading) {
    return children;
  }

  if (isPwaBlocked) {
    return (
      <div className="pwa-block-page">
        <div className="pwa-block-page__card">
          <img className="pwa-block-page__logo" src={rahatOneLogo} alt="RAHAT-ONE" />
          <h1 className="pwa-block-page__title">Employee App Only</h1>
          <p className="pwa-block-page__message">
            This mobile app is for employees only. HR staff should access RAHAT-ONE through the web portal on a desktop browser.
          </p>
          <Button
            className="pwa-block-page__button"
            variant="secondary"
            onClick={() => window.open('/', '_self')}
          >
            Open Web Portal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {isPwaEmployeeMode ? <PWABottomNav /> : null}
    </>
  );
}

export default PWAGuard;
