import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { type ColorPalette, type ThemeName, Themes } from '../constants/theme';

const STORAGE_KEY = 'app_theme';

interface ThemeContextValue {
  themeName: ThemeName;
  colors: ColorPalette;
  setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeName: 'lavender',
  colors: Themes.lavender.palette,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>('lavender');

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then((saved) => {
      if (saved && saved in Themes) setThemeName(saved as ThemeName);
    });
  }, []);

  const setTheme = useCallback((name: ThemeName) => {
    setThemeName(name);
    SecureStore.setItemAsync(STORAGE_KEY, name);
  }, []);

  const value = useMemo(
    () => ({ themeName, colors: Themes[themeName].palette, setTheme }),
    [themeName, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
