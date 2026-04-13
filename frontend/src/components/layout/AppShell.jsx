import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import HomeIcon from '@mui/icons-material/Home';
import EventIcon from '@mui/icons-material/Event';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import EventNoteIcon from '@mui/icons-material/EventNote';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import './AppShell.css';

const HR_BOTTOM_NAV = [
  { to: '/hr',                   icon: <HomeIcon />,       label: 'Home' },
  { to: '/hr/verification',      icon: <PersonAddIcon />,  label: 'Onboarding' },
  { to: '/hr/leave-dashboard',   icon: <EventNoteIcon />,  label: 'Leaves' },
  { to: '/hr/expense-dashboard', icon: <ReceiptIcon />,    label: 'Expenses' },
];

const EMPLOYEE_BOTTOM_NAV = [
  { to: '/employee/dashboard', icon: <HomeIcon />,                       label: 'Home' },
  { to: '/employee/leaves',    icon: <EventIcon />,                      label: 'Leaves' },
  { to: '/expenses/submit',    icon: <AccountBalanceWalletIcon />,       label: 'Expenses' },
  { to: '/expenses/history',   icon: <ReceiptIcon />,                    label: 'History' },
];

function AppShell({ children, pageTitle }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();
  const bottomNav = user?.role === 'hr' ? HR_BOTTOM_NAV : EMPLOYEE_BOTTOM_NAV;

  return (
    <div className="app-shell">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />

      <main className={`app-shell-main${collapsed ? ' app-shell-main--collapsed' : ''}`}>
        <TopBar pageTitle={pageTitle} />
        <div className="app-shell-content">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        {bottomNav.slice(0, 5).map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `bottom-nav-item${isActive ? ' bottom-nav-item--active' : ''}`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default AppShell;
