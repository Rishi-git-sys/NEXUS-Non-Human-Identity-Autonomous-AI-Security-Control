'use client';

import { usePathname } from 'next/navigation';

export default function TopBar() {
  const pathname = usePathname();
  
  // Format the title based on route
  const getPageTitle = () => {
    if (pathname === '/') return 'Command Center';
    
    // Convert e.g., '/ai-agents' to 'Ai Agents', we'll just handle known routes for now
    if (pathname?.startsWith('/agents')) return 'AI Agents';
    if (pathname?.startsWith('/identities')) return 'Identities';
    if (pathname?.startsWith('/access-graph')) return 'Access Graph';
    if (pathname?.startsWith('/policies')) return 'Policies';
    if (pathname?.startsWith('/alerts')) return 'Alerts';
    if (pathname?.startsWith('/audit')) return 'Audit';
    if (pathname?.startsWith('/settings')) return 'Settings';
    
    return 'Command Center';
  };

  const getPageSubtitle = () => {
    if (pathname === '/') return 'Enterprise non-human identity and AI agent security posture';
    return '';
  };

  return (
    <header className="h-16 flex items-center justify-between px-8 border-b border-[#23262b] bg-[#0d0f12] shrink-0">
      <div>
        <h1 className="text-lg font-medium text-primary-text">{getPageTitle()}</h1>
        {getPageSubtitle() && (
          <p className="text-xs text-[#9a9da3] mt-0.5">{getPageSubtitle()}</p>
        )}
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Placeholder for future top right elements like user profile or global search */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#111318] border border-[#23262b] flex items-center justify-center text-xs font-bold text-[#5b9dff]">
            AD
          </div>
        </div>
      </div>
    </header>
  );
}
