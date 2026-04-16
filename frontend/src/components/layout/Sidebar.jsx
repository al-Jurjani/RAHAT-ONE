import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../ui';
import outfittersLogo from '../../assets/outfitters-logo.svg';
import './Sidebar.css';

import HomeIcon from '@mui/icons-material/Home';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EventNoteIcon from '@mui/icons-material/EventNote';
import ReceiptIcon from '@mui/icons-material/Receipt';
import SettingsIcon from '@mui/icons-material/Settings';
import EventIcon from '@mui/icons-material/Event';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PersonIcon from '@mui/icons-material/Person';
import HistoryIcon from '@mui/icons-material/History';
import LogoutIcon from '@mui/icons-material/Logout';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';

const HR_NAV = [
  { to: '/hr',                    icon: <HomeIcon fontSize="small" />,                   label: 'Home' },
  { to: '/hr/verification',       icon: <PersonAddIcon fontSize="small" />,               label: 'Onboarding' },
  { to: '/hr/leave-dashboard',    icon: <EventNoteIcon fontSize="small" />,               label: 'Leave Management' },
  { to: '/hr/expense-dashboard',  icon: <ReceiptIcon fontSize="small" />,                 label: 'Expense Management' },
  { to: '/hr/audit-log',          icon: <HistoryIcon fontSize="small" />,                label: 'Audit Log' },
  { to: '/hr/config',             icon: <SettingsIcon fontSize="small" />,                label: 'Configuration', disabled: true },
];

const EMPLOYEE_NAV = [
  { to: '/employee/dashboard',    icon: <HomeIcon fontSize="small" />,                   label: 'Home' },
  { to: '/employee/leaves',       icon: <EventIcon fontSize="small" />,                  label: 'My Leaves' },
  { to: '/expenses/submit',       icon: <AccountBalanceWalletIcon fontSize="small" />,   label: 'My Expenses' },
  { to: '/employee/profile',      icon: <PersonIcon fontSize="small" />,                 label: 'Profile' },
];

function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const nav = user?.role === 'hr' ? HR_NAV : EMPLOYEE_NAV;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
      {/* Collapse toggle */}
      <button className="sidebar-toggle" onClick={onToggle} aria-label="Toggle sidebar">
        <ChevronLeftIcon fontSize="small" className="sidebar-toggle-icon" />
      </button>

      {/* Brand */}
      <div className="sidebar-brand">
        <img src={outfittersLogo} alt="Outfitters" />
      </div>

      <div className="sidebar-divider" />

      {/* Navigation */}
      <nav className="sidebar-nav">
        {!collapsed && (
          <span className="sidebar-section-label">
            {user?.role === 'hr' ? 'HR Tools' : 'Employee'}
          </span>
        )}
        {nav.map(item => (
          item.disabled ? (
            <span
              key={item.to}
              className="sidebar-link"
              style={{ opacity: 0.4, cursor: 'not-allowed' }}
              data-tooltip={item.label}
              title={collapsed ? item.label : undefined}
            >
              <span className="sidebar-link__icon">{item.icon}</span>
              <span className="sidebar-link__label">{item.label}</span>
            </span>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/hr' || item.to === '/employee/dashboard'}
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' sidebar-link--active' : ''}`
              }
              data-tooltip={item.label}
              title={collapsed ? item.label : undefined}
            >
              <span className="sidebar-link__icon">{item.icon}</span>
              <span className="sidebar-link__label">{item.label}</span>
            </NavLink>
          )
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <Avatar name={user?.name || ''} size="md" />
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name || 'User'}</div>
            <div className="sidebar-user-role">{user?.role || ''}</div>
          </div>
          <button className="sidebar-logout" onClick={handleLogout} title="Sign out">
            <LogoutIcon fontSize="small" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
