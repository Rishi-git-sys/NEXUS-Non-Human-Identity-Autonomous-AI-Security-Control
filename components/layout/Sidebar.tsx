'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useNavigation } from '@/context/NavigationContext';
import { alertService } from '@/lib/services/alertService';
import { 
  Shield, 
  LayoutDashboard, 
  Users, 
  Bot, 
  Network, 
  ShieldAlert, 
  Bell, 
  ScrollText, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  LogOut, 
  LockKeyhole,
  CheckSquare,
  Layers
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  dynamicBadge?: boolean;
}

interface NavGroup {
  groupName: string;
  items: NavItem[];
}

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { isMobileOpen, setIsMobileOpen } = useNavigation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeAlertsCount, setActiveAlertsCount] = useState<number>(0);

  // Load alert counts dynamically
  useEffect(() => {
    if (!user?.organization_id) return;
    let isMounted = true;
    alertService.getActiveCount(user.organization_id).then((count) => {
      if (isMounted) setActiveAlertsCount(count);
    });
    return () => {
      isMounted = false;
    };
  }, [user?.organization_id]);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const closeSidebar = () => {
    setIsMobileOpen(false);
  };

  const navigationGroups: NavGroup[] = [
    {
      groupName: 'OVERVIEW',
      items: [
        { name: 'Command Center', href: '/dashboard', icon: LayoutDashboard }
      ]
    },
    {
      groupName: 'IDENTITY',
      items: [
        { name: 'Identities', href: '/identities', icon: Users },
        { name: 'AI Agents', href: '/agents', icon: Bot }
      ]
    },
    {
      groupName: 'ACCESS',
      items: [
        { name: 'Access Graph', href: '/access', icon: Network },
        { name: 'Resources', href: '/resources', icon: Layers },
        { name: 'Privileged Access', href: '/access?tab=privileged', icon: LockKeyhole }
      ]
    },
    {
      groupName: 'GOVERNANCE',
      items: [
        { name: 'Policies', href: '/policies', icon: ShieldAlert },
        { name: 'Compliance', href: '/policies?tab=compliance', icon: CheckSquare }
      ]
    },
    {
      groupName: 'OPERATIONS',
      items: [
        { name: 'Alerts', href: '/alerts', icon: Bell, dynamicBadge: true },
        { name: 'Audit Logs', href: '/audit', icon: ScrollText }
      ]
    },
    {
      groupName: 'SYSTEM',
      items: [
        { name: 'Settings', href: '/settings', icon: Settings }
      ]
    }
  ];

  const renderNavItems = () => {
    return navigationGroups.map((group) => (
      <div key={group.groupName} className="space-y-1">
        {/* Group Name Header */}
        {!isCollapsed && (
          <h3 className="px-3 pt-4 pb-1 text-[10px] font-bold text-muted tracking-widest uppercase">
            {group.groupName}
          </h3>
        )}
        
        {group.items.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href.split('?')[0]));
          const badgeCount = item.dynamicBadge ? activeAlertsCount : 0;

          return (
            <div key={item.name} className="relative group/tooltip">
              <Link
                href={item.href}
                onClick={closeSidebar}
                className={`flex items-center justify-between px-3 py-2 rounded-[6px] transition-all duration-150 relative ${
                  isActive 
                    ? 'bg-surface-top text-white font-medium border-l-2 border-purple-500' 
                    : 'text-secondary hover:text-white hover:bg-surface'
                }`}
              >
                <div className="flex items-center">
                  <item.icon className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-purple-400' : 'text-muted group-hover:text-secondary'
                  }`} />
                  {!isCollapsed && <span className="ml-3 text-xs tracking-tight">{item.name}</span>}
                </div>

                {!isCollapsed && badgeCount > 0 && (
                  <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-bold px-1.5 py-0.5 rounded-[4px]">
                    {badgeCount}
                  </span>
                )}

                {/* Left indicators when collapsed and active */}
                {isCollapsed && isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-purple-500 rounded-r" />
                )}
              </Link>

              {/* Tooltip on collapse */}
              {isCollapsed && (
                <div className="absolute left-14 top-1/2 -translate-y-1/2 z-50 bg-surface-top border border-border px-2.5 py-1.5 rounded-[6px] shadow-xl text-[10px] text-white font-semibold tracking-wide whitespace-nowrap opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-150">
                  {item.name}
                  {badgeCount > 0 && (
                    <span className="ml-2 bg-red-500/10 text-red-400 border border-red-500/20 px-1 rounded">
                      {badgeCount}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    ));
  };

  const sidebarWidth = isCollapsed ? 'w-16' : 'w-60';

  const sidebarContent = (
    <div className={`h-full ${sidebarWidth} bg-bg-mid border-r border-border flex flex-col justify-between shrink-0 relative transition-all duration-200 z-30`}>
      
      {/* Top logo block */}
      <div>
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={closeSidebar}>
            <div className="p-1.5 bg-gradient-to-br from-brand-purple to-brand-indigo rounded-[6px]">
              <Shield className="w-4 h-4 text-white" />
            </div>
            {!isCollapsed && (
              <div>
                <span className="font-bold text-sm tracking-tight text-white block">NEXUS</span>
                <span className="text-[8px] text-purple-400 font-mono tracking-wider uppercase block -mt-1">Control Plane</span>
              </div>
            )}
          </Link>
          
          {/* Collapse trigger desktop */}
          <button
            onClick={toggleCollapse}
            className="hidden md:flex p-1 rounded-md text-muted hover:text-white hover:bg-surface border border-border/40"
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Navigation list */}
        <div className="py-4 px-3 flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-10rem)]">
          {renderNavItems()}
        </div>
      </div>

      {/* User profile section at the bottom */}
      <div className="p-3 border-t border-border space-y-2">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            {user?.avatar_url ? (
              <img 
                src={user.avatar_url} 
                alt={user.full_name || 'Operator'} 
                className="w-7 h-7 rounded-full border border-purple-500/20 object-cover shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-purple-900/40 border border-purple-500/20 flex items-center justify-center text-[10px] font-bold text-purple-300 shrink-0">
                {user?.full_name 
                  ? user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                  : user?.email ? user.email[0].toUpperCase() : 'U'
                }
              </div>
            )}
            {!isCollapsed && (
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-white block truncate leading-tight">{user?.full_name || 'Admin Operator'}</span>
                <span className="text-[9px] text-muted block truncate">{user?.email || 'admin@nexus.security'}</span>
              </div>
            )}
          </div>
          
          {!isCollapsed && (
            <button
              onClick={logout}
              className="p-1.5 rounded-md text-muted hover:text-red-400 hover:bg-red-500/5 transition-colors cursor-pointer"
              title="Logout session"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

    </div>
  );

  return (
    <>
      {/* Desktop Sidebar view */}
      <div className="hidden md:flex h-full shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile Drawer view */}
      <div 
        className={`fixed inset-0 z-50 flex md:hidden transition-opacity duration-200 ${
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={closeSidebar} />
        <div className={`relative flex flex-col max-w-xs w-full bg-[#0B0B12] transform transition-transform duration-200 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          {sidebarContent}
        </div>
      </div>
    </>
  );
}
