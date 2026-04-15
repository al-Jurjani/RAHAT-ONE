import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useThemeMode } from '../../contexts/ThemeModeContext';
import './TopBar.css';

function TopBar({ pageTitle }) {
  const { mode, toggleTheme } = useThemeMode();

  return (
    <header className="topbar">
      <h1 className="topbar-title">{pageTitle}</h1>
      <div className="topbar-right">
        <button className="topbar-bell" aria-label="Notifications">
          <NotificationsNoneIcon fontSize="small" />
        </button>
        <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          <IconButton
            onClick={toggleTheme}
            size="small"
            className="topbar-theme-toggle"
            aria-label="Toggle theme"
          >
            {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </div>
    </header>
  );
}

export default TopBar;
