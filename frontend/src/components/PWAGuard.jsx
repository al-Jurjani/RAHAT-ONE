import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import FmdGoodIcon from '@mui/icons-material/FmdGood';
import EventIcon from '@mui/icons-material/Event';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PersonIcon from '@mui/icons-material/Person';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui';
import rahatOneLogo from '../assets/rahat-one-logo.svg';
import './PWAGuard.css';

function detectMobileMode() {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(max-width: 768px)').matches;
}

function PWABottomNav() {
  const navItems = useMemo(() => ([
    { to: '/employee/home',       icon: <HomeIcon fontSize="small" />,    label: 'Home'     },
    { to: '/employee/attendance', icon: <FmdGoodIcon fontSize="small" />, label: 'Attendance' },
    { to: '/employee/leaves',     icon: <EventIcon fontSize="small" />,   label: 'Leaves'   },
    { to: '/expenses/submit',     icon: <ReceiptIcon fontSize="small" />, label: 'Expenses' },
    { to: '/employee/profile',    icon: <PersonIcon fontSize="small" />,  label: 'Profile'  },
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

function PWAInstallBanner() {
  const [prompt, setPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem('pwa-install-dismissed'));
  const [isStandalone] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
  );

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (isStandalone || dismissed || !prompt) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 72, left: 12, right: 12, zIndex: 9999,
      background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)', padding: '12px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
    }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
        Install RAHAT app for quick access
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => { localStorage.setItem('pwa-install-dismissed', '1'); setDismissed(true); }}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}
        >
          Not now
        </button>
        <button
          onClick={async () => {
            prompt.prompt();
            const { outcome } = await prompt.userChoice;
            if (outcome === 'accepted') setPrompt(null);
          }}
          style={{
            background: 'var(--brand-primary)', color: '#fff', border: 'none',
            borderRadius: 'var(--radius-md)', padding: '6px 14px',
            cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 600,
          }}
        >
          Install
        </button>
      </div>
    </div>
  );
}

function PWAGuard({ children }) {
  const { user, loading, logout, viewMode, setViewMode } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(detectMobileMode);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;

    const mobileQuery = window.matchMedia('(max-width: 768px)');
    const updateMobile = () => setIsMobile(mobileQuery.matches);

    if (mobileQuery.addEventListener) {
      mobileQuery.addEventListener('change', updateMobile);
      return () => mobileQuery.removeEventListener('change', updateMobile);
    }

    mobileQuery.addListener(updateMobile);
    return () => mobileQuery.removeListener(updateMobile);
  }, []);

  // HR individuals with a linked employee record can use the PWA as employees
  const isPwaEmployeeMode = isMobile && (user?.role === 'employee' || (user?.role === 'hr' && !!user?.employeeId));
  const isPwaBlocked      = isMobile && !loading && !!user && user?.role === 'hr' && !user?.employeeId && location.pathname !== '/login';

  // Force HR employees into employee viewMode on mobile and redirect to employee home
  useEffect(() => {
    if (!isPwaEmployeeMode || loading || !user) return;
    if (user.role === 'hr' && viewMode !== 'employee') {
      setViewMode('employee');
      navigate('/employee/home', { replace: true });
    }
  }, [isPwaEmployeeMode, user, viewMode, loading, setViewMode, navigate]);

  useEffect(() => {
    document.body.classList.toggle('pwa-employee-mode', isPwaEmployeeMode);
    return () => document.body.classList.remove('pwa-employee-mode');
  }, [isPwaEmployeeMode]);

  if (loading) return children;

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
          <Button
            className="pwa-block-page__button"
            variant="ghost"
            onClick={async () => { await logout(); navigate('/login'); }}
          >
            Sign in as Employee
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {isPwaEmployeeMode ? <PWABottomNav /> : null}
      {isPwaEmployeeMode ? <PWAInstallBanner /> : null}
    </>
  );
}

export default PWAGuard;
