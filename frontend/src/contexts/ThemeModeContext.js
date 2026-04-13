import React, { createContext, useContext } from 'react';

const ThemeModeContext = createContext({ mode: 'dark', toggleTheme: () => {} });

export function ThemeModeProvider({ value, children }) {
  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
