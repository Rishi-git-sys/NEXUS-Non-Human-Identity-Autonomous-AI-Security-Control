'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Menu, Search, Bell, Shield, User, Settings, LogOut, CheckCircle } from 'lucide-react';
import { useNavigation } from '@/context/NavigationContext';
import { useAuth } from '@/context/AuthContext';
import { alertService } from '@/lib/services/alertService';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toggleMobileSidebar } = useNavigation();
  const { logout, user } = useAuth();
  const [activeAlertsCount, setActiveAlertsCount] = useState<number>(0);
  
  // Dropdown states
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load alert counts
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

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPageInfo = () => {
    if (pathname === '/dashboard' || pathname === '/') {
      return { category: 'OVERVIEW', title: 'Command Center' };
    }
    if (pathname?.startsWith('/identities')) {
      return { category: 'IDENTITY', title: 'Identities' };
    }
    if (pathname?.startsWith('/agents')) {
      return { category: 'IDENTITY', title: 'AI Agents' };
    }
    if (pathname?.startsWith('/access')) {
      return { category: 'ACCESS', title: 'Access Graph' };
    }
    if (pathname?.startsWith('/policies')) {
      return { category: 'GOVERNANCE', title: 'Policies' };
    }
    if (pathname?.startsWith('/alerts')) {
      return { category: 'OPERATIONS', title: 'Alerts Response' };
    }
    if (pathname?.startsWith('/audit')) {
      return { category: 'OPERATIONS', title: 'Audit Ledger' };
    }
    if (pathname?.startsWith('/settings')) {
      return { category: 'SYSTEM', title: 'Settings' };
    }
    return { category: 'NEXUS', title: 'Control Plane' };
  };

  const pageInfo = getPageInfo();

  const handleProfileMenuClick = (tab: string) => {
    setShowProfileMenu(false);
    if (tab === 'logout') {
      logout();
    } else {
      router.push(`/settings?tab=${tab}`);
    }
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-border bg-background shrink-0 sticky top-0 z-40 select-none">
      
      {/* Left side: Hamburger + Breadcrumb page info */}
      <div className="flex items-center space-x-4 overflow-hidden">
        <button
          onClick={toggleMobileSidebar}
          className="md:hidden text-secondary hover:text-white p-1.5 rounded-md hover:bg-surface"
          aria-label="Open mobile navigation drawer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb */}
        <div className="hidden sm:flex flex-col">
          <div className="flex items-center gap-1 text-[10px] text-[#6B7280] font-mono tracking-widest uppercase">
            <span>NEXUS</span>
            <span>/</span>
            <span>{pageInfo.category}</span>
          </div>
          <h2 className="text-sm font-semibold text-white tracking-tight leading-none mt-1">
            {pageInfo.title}
          </h2>
        </div>

        <div className="sm:hidden flex items-center">
          <Shield className="w-4 h-4 text-purple-400 mr-2" />
          <span className="font-bold text-xs tracking-wider text-white">NEXUS</span>
        </div>
      </div>

      {/* Right side Actions */}
      <div className="flex items-center space-x-3 md:space-x-5" ref={dropdownRef}>
        
        {/* Security status indicator indicator */}
        <div className="hidden lg:flex items-center gap-1.5 bg-healthy-bg border border-healthy-border text-healthy-text px-2.5 py-1 rounded-[6px] text-[10px] font-semibold">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>PLANE SECURITY COMPLIANT</span>
        </div>

        {/* Search Input */}
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search resources, events..."
            disabled
            className="bg-surface border border-border text-xs text-primary-text placeholder-muted rounded-[6px] pl-9 pr-3 py-1.5 w-48 focus:outline-none cursor-not-allowed opacity-80"
          />
        </div>

        {/* Notifications list trigger */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-md hover:bg-surface text-secondary hover:text-white transition-colors relative"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" />
            {activeAlertsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-background" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-surface border border-border rounded-[8px] shadow-2xl p-4 space-y-3 z-50 animate-scale-up">
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Active Notifications</h4>
                <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/15">
                  {activeAlertsCount} critical
                </span>
              </div>
              
              <div className="space-y-2 text-xs text-secondary max-h-60 overflow-y-auto">
                {activeAlertsCount === 0 ? (
                  <p className="text-center py-4 text-[#6B7280]">Zero active anomalies logged.</p>
                ) : (
                  <>
                    <div className="p-2 rounded hover:bg-[#181824] border border-[#1f1f30]/40 transition-colors">
                      <p className="font-semibold text-white truncate">DevOps-Agent DELETE database</p>
                      <span className="text-[9px] text-[#6B7280] block mt-0.5">Critical violation blocked automatically.</span>
                    </div>
                    <div className="p-2 rounded hover:bg-[#181824] border border-[#1f1f30]/40 transition-colors">
                      <p className="font-semibold text-white truncate">Stripe API key leak in VCS logs</p>
                      <span className="text-[9px] text-[#6B7280] block mt-0.5">Exposed credential key signature scan match.</span>
                    </div>
                  </>
                )}
              </div>
              
              <div className="pt-2 border-t border-[#1F1F30] text-center">
                <Link href="/alerts" onClick={() => setShowNotifications(false)} className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold">
                  Open Alerts Center &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="h-5 w-[1px] bg-border" />

        {/* User Profile dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2.5 focus:outline-none p-1 rounded-md hover:bg-[#14141F] transition-colors"
            aria-label="User profile dropdown"
          >
            {user?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={user.avatar_url} 
                alt={user.full_name || 'User Avatar'} 
                className="w-8 h-8 rounded-full border border-purple-500/20 object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-purple-900/40 border border-purple-500/20 flex items-center justify-center text-[11px] font-bold text-purple-300">
                {user?.full_name 
                  ? user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                  : user?.email ? user.email[0].toUpperCase() : 'U'
                }
              </div>
            )}
          </button>

          {/* User profile dropdown box */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-surface border border-border rounded-[8px] shadow-2xl overflow-hidden z-50 animate-scale-up">
              <div className="p-3 border-b border-border bg-surface-mid/40">
                <span className="text-xs font-semibold text-white block truncate">{user?.full_name || 'Admin Operator'}</span>
                <span className="text-[9px] text-muted block mt-0.5 truncate">{user?.email}</span>
                <span className="inline-block text-[8px] font-bold tracking-wider uppercase text-purple-400 bg-purple-950/40 border border-purple-900/40 px-1.5 py-0.5 rounded mt-1.5">
                  {user?.role || 'Operator'}
                </span>
              </div>
              
              <div className="py-1 text-xs text-secondary">
                <button
                  onClick={() => handleProfileMenuClick('profile')}
                  className="w-full text-left px-4 py-2 hover:bg-surface-mid hover:text-white transition-colors flex items-center gap-2"
                >
                  <User className="w-3.5 h-3.5 text-muted" />
                  <span>Profile Settings</span>
                </button>
                
                <button
                  onClick={() => handleProfileMenuClick('security')}
                  className="w-full text-left px-4 py-2 hover:bg-surface-mid hover:text-white transition-colors flex items-center gap-2"
                >
                  <Shield className="w-3.5 h-3.5 text-muted" />
                  <span>Security & MFA</span>
                </button>

                <button
                  onClick={() => handleProfileMenuClick('notifications')}
                  className="w-full text-left px-4 py-2 hover:bg-surface-mid hover:text-white transition-colors flex items-center gap-2"
                >
                  <Bell className="w-3.5 h-3.5 text-muted" />
                  <span>Notifications</span>
                </button>

                <button
                  onClick={() => handleProfileMenuClick('appearance')}
                  className="w-full text-left px-4 py-2 hover:bg-surface-mid hover:text-white transition-colors flex items-center gap-2"
                >
                  <Settings className="w-3.5 h-3.5 text-muted" />
                  <span>Console Theme</span>
                </button>

                <div className="h-[1px] bg-border my-1" />

                <button
                  onClick={() => handleProfileMenuClick('logout')}
                  className="w-full text-left px-4 py-2 hover:bg-red-500/5 hover:text-red-400 transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-500/60" />
                  <span className="font-medium">Logout Session</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

    </header>
  );
}
