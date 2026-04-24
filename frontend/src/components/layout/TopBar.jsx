import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import { useNavigate } from 'react-router-dom';
import { useThemeMode } from '../../contexts/ThemeModeContext';
import './TopBar.css';

function TopBar({ pageTitle }) {
  const { mode, toggleTheme } = useThemeMode();
  const navigate = useNavigate();
  const canGoBack = window.history.length > 1;

  return (
    <header className="topbar">
      {canGoBack && (
        <IconButton
          className="topbar-back"
          size="small"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowBackIosNewIcon fontSize="small" />
        </IconButton>
      )}
      <h1 className="topbar-title">{pageTitle}</h1>
      <div className="topbar-right">
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
