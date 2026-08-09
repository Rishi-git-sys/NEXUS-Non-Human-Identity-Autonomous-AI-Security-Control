'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Shield,
  LayoutDashboard,
  Users,
  Bot,
  Network,
  ShieldAlert,
  Bell,
  ScrollText,
  Settings
} from 'lucide-react';

const navItems = [
  { name: 'Command Center', href: '/', icon: LayoutDashboard },
  { name: 'Identities', href: '/identities', icon: Users },
  { name: 'AI Agents', href: '/agents', icon: Bot },
  { name: 'Access Graph', href: '/access-graph', icon: Network },
  { name: 'Policies', href: '/policies', icon: ShieldAlert },
  { name: 'Alerts', href: '/alerts', icon: Bell, badge: 2 },
  { name: 'Audit', href: '/audit', icon: ScrollText },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-[#111318] border-r border-[#23262b] flex flex-col h-full hidden md:flex shrink-0">
      {/* Logo Area */}
      <div className="h-16 flex items-center px-6 border-b border-[#23262b]">
        <Shield className="w-6 h-6 text-[#5b9dff] mr-3" />
        <span className="font-semibold text-lg tracking-wide text-primary-text">NEXUS</span>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-6 px-4 flex flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                isActive 
                  ? 'bg-[#23262b] text-primary-text' 
                  : 'text-[#9a9da3] hover:text-primary-text hover:bg-[#23262b]/50'
              }`}
            >
              <div className="flex items-center">
                <item.icon className={`w-4 h-4 mr-3 ${isActive ? 'text-[#5b9dff]' : ''}`} />
                <span>{item.name}</span>
              </div>
              
              {item.badge && (
                <span className="bg-[#ff6b6b] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Bottom Settings */}
      <div className="p-4 border-t border-[#23262b]">
        <Link
          href="/settings"
          className={`flex items-center px-3 py-2 rounded-md transition-colors ${
            pathname === '/settings'
              ? 'bg-[#23262b] text-primary-text'
              : 'text-[#9a9da3] hover:text-primary-text hover:bg-[#23262b]/50'
          }`}
        >
          <Settings className={`w-4 h-4 mr-3 ${pathname === '/settings' ? 'text-[#5b9dff]' : ''}`} />
          <span>Settings</span>
        </Link>
      </div>
    </div>
  );
}
