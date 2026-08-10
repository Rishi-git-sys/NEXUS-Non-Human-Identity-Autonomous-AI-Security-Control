'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  compactMode: boolean;
  setCompactMode: (compact: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('nexus-theme') as Theme;
      if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme;
    }
    return 'dark';
  });

  const [compactMode, setCompactMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nexus-compact') === 'true';
    }
    return false;
  });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => {
      setMounted(true);
    });
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('nexus-theme', theme);
    
    // Apply theme class to HTML root
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('nexus-compact', String(compactMode));
  }, [compactMode, mounted]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, compactMode, setCompactMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
