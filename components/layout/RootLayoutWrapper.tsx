'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function RootLayoutWrapper({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();
  const pathname = usePathname();
  const { compactMode } = useTheme();

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background text-primary-text">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-purple border-t-transparent"></div>
          <span className="text-xs text-secondary font-medium tracking-wider">SECURE CONNECTION ESTABLISHING...</span>
        </div>
      </div>
    );
  }

  // Landing page needs full scrollability — body has overflow-hidden for the
  // dashboard shell so we must override it here.
  if (pathname === '/') {
    return (
      <div
        className={`w-full bg-[#06070A] ${compactMode ? 'compact-density' : ''}`}
        style={{ height: '100vh', overflowY: 'auto', overflowX: 'hidden' }}
      >
        {children}
      </div>
    );
  }

  // Other public routes (login, signup, etc.) — full screen, no shell
  const otherPublicRoutes = ['/login', '/signup', '/forgot-password', '/update-password'];
  if (otherPublicRoutes.includes(pathname)) {
    return <div className={`h-full w-full bg-background ${compactMode ? 'compact-density' : ''}`}>{children}</div>;
  }


  // App shell for authenticated pages
  return (
    <div className={`flex h-full w-full bg-background overflow-hidden ${compactMode ? 'compact-density' : ''}`}>
      <Sidebar />
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-background relative">
          {children}
        </main>
      </div>
    </div>
  );
}
