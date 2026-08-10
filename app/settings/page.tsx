'use client';

import { useState, useEffect } from 'react';
import { integrationService } from '@/lib/services/integrationService';
import { Integration } from '@/lib/types/integration';
import { Shield, Key, Bell, LayoutGrid, Cloud, GitFork, UserCheck, Cpu, User, Settings, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';

export default function SettingsPage() {
  const { user, updateProfile } = useAuth();
  const { theme, setTheme, compactMode, setCompactMode } = useTheme();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const initialTab = searchParams?.get('tab');

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [activeTab, setActiveTab] = useState<'profile' | 'org' | 'security' | 'notifications' | 'appearance' | 'integrations'>(() => {
    if (initialTab && ['profile', 'org', 'security', 'notifications', 'appearance', 'integrations'].includes(initialTab)) {
      return initialTab as 'profile' | 'org' | 'security' | 'notifications' | 'appearance' | 'integrations';
    }
    return 'profile';
  });

  // User Profile Form States
  const [profileFullName, setProfileFullName] = useState(() => user?.full_name || '');
  const [profileEmail, setProfileEmail] = useState(() => user?.email || '');
  const [profileRole, setProfileRole] = useState(() => user?.role || 'Operator');
  const [profileOrgId, setProfileOrgId] = useState(() => user?.organization_id || 'NEXUS Enterprise Corp');
  const [isProfileSaving, setIsProfileSaving] = useState(false);

  useEffect(() => {
    if (user) {
      requestAnimationFrame(() => {
        setProfileFullName(user.full_name || '');
        setProfileEmail(user.email || '');
        setProfileRole(user.role || 'Operator');
        setProfileOrgId(user.organization_id || 'NEXUS Enterprise Corp');
      });
    }
  }, [user]);

  // Org form settings
  const [orgName, setOrgName] = useState(() => user?.organization_id || 'NEXUS Enterprise Corp');
  const [envContext, setEnvContext] = useState('Production/Multi-Cloud');

  // Sync user organization ID if available
  useEffect(() => {
    if (user?.organization_id) {
      requestAnimationFrame(() => {
        setOrgName(user.organization_id || 'NEXUS Enterprise Corp');
      });
    }
  }, [user]);

  // Security settings
  const [sessionTimeout, setSessionTimeout] = useState('12');
  const [mfaEnforced, setMfaEnforced] = useState(true);
  const [ssoEnforced, setSsoEnforced] = useState(true);

  // Notification settings
  const [notifyCritical, setNotifyCritical] = useState(true);
  const [notifyHigh, setNotifyHigh] = useState(true);
  const [notifyViolations, setNotifyViolations] = useState(true);

  useEffect(() => {
    requestAnimationFrame(() => {
      setIntegrations(integrationService.getIntegrations());
    });
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProfileSaving(true);
    try {
      await updateProfile({
        full_name: profileFullName,
        email: profileEmail,
        organization_id: profileOrgId
      });
      showToast('User profile updated successfully.', 'success');
    } catch {
      showToast('Failed to save profile changes.', 'error');
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleSaveOrg = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Organization settings saved successfully.', 'success');
  };

  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Security governance policies updated.', 'success');
  };

  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Alert notification dispatch rules saved.', 'success');
  };

  const handleToggleIntegration = (id: string) => {
    const res = integrationService.toggleIntegration(id);
    if (res.success) {
      showToast(res.message, 'success');
      setIntegrations(integrationService.getIntegrations());
    } else {
      showToast(res.message, 'error');
    }
  };

  const getIntegrationIcon = (cat: Integration['category']) => {
    switch (cat) {
      case 'Cloud':
        return <Cloud className="w-4 h-4 text-purple-400 shrink-0" />;
      case 'VCS':
        return <GitFork className="w-4 h-4 text-[#10B981] shrink-0" />;
      case 'Identity':
        return <UserCheck className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'Agent Framework':
        return <Cpu className="w-4 h-4 text-red-400 shrink-0" />;
      default:
        return <LayoutGrid className="w-4 h-4 text-muted shrink-0" />;
    }
  };

  return (
    <div className="p-4 md:p-8 pb-20 max-w-7xl mx-auto space-y-6 relative text-primary-text">
      
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white">Control Plane Settings</h2>
        <p className="text-xs text-secondary mt-1">Configure global organization variables, credential thresholds, theme parameters, and API integrations.</p>
      </div>

      {/* Tab Panels Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start min-w-0">
        
        {/* Left Side Tab Navigation */}
        <div className="w-full lg:w-60 bg-surface border border-border rounded-[12px] p-2 shrink-0 flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible gap-1 select-none">
          <button
            onClick={() => setActiveTab('profile')}
            className={`text-xs font-semibold px-4 py-2.5 rounded-[6px] text-left transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'profile' ? 'bg-surface-top text-white border-l-2 border-purple-500' : 'text-secondary hover:bg-surface-top/40'
            }`}
          >
            My Profile
          </button>
          <button
            onClick={() => setActiveTab('org')}
            className={`text-xs font-semibold px-4 py-2.5 rounded-[6px] text-left transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'org' ? 'bg-surface-top text-white border-l-2 border-purple-500' : 'text-secondary hover:bg-surface-top/40'
            }`}
          >
            Organization Profile
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`text-xs font-semibold px-4 py-2.5 rounded-[6px] text-left transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'security' ? 'bg-surface-top text-white border-l-2 border-purple-500' : 'text-secondary hover:bg-surface-top/40'
            }`}
          >
            Security Controls
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`text-xs font-semibold px-4 py-2.5 rounded-[6px] text-left transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'notifications' ? 'bg-surface-top text-white border-l-2 border-purple-500' : 'text-secondary hover:bg-surface-top/40'
            }`}
          >
            Notification Dispatch
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`text-xs font-semibold px-4 py-2.5 rounded-[6px] text-left transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'appearance' ? 'bg-surface-top text-white border-l-2 border-purple-500' : 'text-secondary hover:bg-surface-top/40'
            }`}
          >
            Console Appearance
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`text-xs font-semibold px-4 py-2.5 rounded-[6px] text-left transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'integrations' ? 'bg-surface-top text-white border-l-2 border-purple-500' : 'text-secondary hover:bg-surface-top/40'
            }`}
          >
            Cloud Integrations
          </button>
        </div>

        {/* Right Side Content Areas */}
        <div className="flex-1 w-full bg-surface border border-border rounded-[12px] p-6 min-h-[350px] hover:border-border/80 transition-colors min-w-0">
          
          {/* Tab 0: My Profile */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-6 animate-fade-in">
              <div className="border-b border-border pb-3 flex justify-between items-center">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">My Profile</h3>
                <User className="w-4 h-4 text-purple-400 shrink-0" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs w-full min-w-0">
                <div className="space-y-1">
                  <label className="text-muted font-bold uppercase tracking-wider block">Full Name</label>
                  <input
                    type="text"
                    value={profileFullName}
                    onChange={(e) => setProfileFullName(e.target.value)}
                    className="bg-background border border-border text-xs text-white placeholder-muted rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-muted font-bold uppercase tracking-wider block">Work Email</label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="bg-background border border-border text-xs text-white placeholder-muted rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-muted font-bold uppercase tracking-wider block">Role Scope</label>
                  <input
                    type="text"
                    value={profileRole}
                    disabled
                    className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none cursor-not-allowed opacity-75"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-muted font-bold uppercase tracking-wider block">Organization ID</label>
                  <input
                    type="text"
                    value={profileOrgId}
                    onChange={(e) => setProfileOrgId(e.target.value)}
                    className="bg-background border border-border text-xs text-white placeholder-muted rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isProfileSaving}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:from-purple-700 active:to-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-[6px] transition-colors flex items-center gap-1.5 cursor-pointer h-9"
              >
                {isProfileSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Profile Changes</span>
              </button>
            </form>
          )}

          {/* Tab 1: Org Profile */}
          {activeTab === 'org' && (
            <form onSubmit={handleSaveOrg} className="space-y-6 animate-fade-in">
              <div className="border-b border-border pb-3 flex justify-between items-center">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Organization Profile</h3>
                <Shield className="w-4 h-4 text-purple-400 shrink-0" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs w-full min-w-0">
                <div className="space-y-1">
                  <label className="text-muted font-bold uppercase tracking-wider block">Organization Name</label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="bg-background border border-border text-xs text-white placeholder-muted rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-muted font-bold uppercase tracking-wider block">Environment Scope Context</label>
                  <input
                    type="text"
                    value={envContext}
                    onChange={(e) => setEnvContext(e.target.value)}
                    className="bg-background border border-border text-xs text-white placeholder-muted rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:from-purple-700 active:to-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-[6px] transition-colors cursor-pointer"
              >
                Save Organization Settings
              </button>
            </form>
          )}

          {/* Tab 2: Security Controls */}
          {activeTab === 'security' && (
            <form onSubmit={handleSaveSecurity} className="space-y-6 animate-fade-in">
              <div className="border-b border-border pb-3 flex justify-between items-center">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Security Control Limits</h3>
                <Key className="w-4 h-4 text-purple-400 shrink-0" />
              </div>

              <div className="space-y-4 text-xs">
                <div className="space-y-1 max-w-sm w-full min-w-0">
                  <label className="text-muted font-bold uppercase tracking-wider block">Max Session Duration (Hours)</label>
                  <select
                    value={sessionTimeout}
                    onChange={(e) => setSessionTimeout(e.target.value)}
                    className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40 appearance-none cursor-pointer"
                  >
                    <option value="1">1 Hour</option>
                    <option value="4">4 Hours</option>
                    <option value="8">8 Hours</option>
                    <option value="12">12 Hours (Default)</option>
                    <option value="24">24 Hours</option>
                  </select>
                </div>

                <div className="space-y-3 pt-2">
                  <span className="text-muted font-bold uppercase tracking-wider block">Enforcement Directives</span>
                  
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mfaEnforced}
                      onChange={(e) => setMfaEnforced(e.target.checked)}
                      className="accent-purple-500 shrink-0"
                    />
                    <span className="text-secondary leading-relaxed">Enforce multi-factor authentication (MFA) for administrative console signins</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ssoEnforced}
                      onChange={(e) => setSsoEnforced(e.target.checked)}
                      className="accent-purple-500 shrink-0"
                    />
                    <span className="text-secondary leading-relaxed">Enforce corporate single sign-on (SSO) gateway integration</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:from-purple-700 active:to-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-[6px] transition-colors cursor-pointer"
              >
                Update Security Settings
              </button>
            </form>
          )}

          {/* Tab 3: Notifications */}
          {activeTab === 'notifications' && (
            <form onSubmit={handleSaveNotifications} className="space-y-6 animate-fade-in">
              <div className="border-b border-border pb-3 flex justify-between items-center">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Alert Notifications Dispatch</h3>
                <Bell className="w-4 h-4 text-purple-400 shrink-0" />
              </div>

              <div className="space-y-4 text-xs">
                <span className="text-muted font-bold uppercase tracking-wider block">Email & Webhook Dispatch Rules</span>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyCritical}
                    onChange={(e) => setNotifyCritical(e.target.checked)}
                    className="accent-purple-500 shrink-0"
                  />
                  <span className="text-secondary leading-relaxed">Dispatch instant PagerDuty/Slack notifications for Critical alerts (score &ge; 90)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyHigh}
                    onChange={(e) => setNotifyHigh(e.target.checked)}
                    className="accent-purple-500 shrink-0"
                  />
                  <span className="text-secondary leading-relaxed">Dispatch email summaries for High Risk anomalies (score 70-89)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyViolations}
                    onChange={(e) => setNotifyViolations(e.target.checked)}
                    className="accent-purple-500 shrink-0"
                  />
                  <span className="text-secondary leading-relaxed">Log warnings on policy compliance boundary engine mismatches</span>
                </label>
              </div>

              <button
                type="submit"
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:from-purple-700 active:to-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-[6px] transition-colors cursor-pointer"
              >
                Save Dispatch Preferences
              </button>
            </form>
          )}

          {/* Tab 4: Appearance */}
          {activeTab === 'appearance' && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-border pb-3 flex justify-between items-center">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Console Appearance</h3>
                <Settings className="w-4 h-4 text-purple-400 shrink-0" />
              </div>

              <div className="space-y-4 text-xs w-full min-w-0">
                <div className="flex items-center justify-between p-3.5 bg-background border border-border rounded-[8px] max-w-md w-full min-w-0 gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-white">Console Theme Variant</span>
                    <span className="block text-[10px] text-muted mt-0.5 leading-relaxed">Toggle between Dark and Light mode themes.</span>
                  </div>
                  
                  <select
                    value={theme}
                    onChange={(e) => {
                      setTheme(e.target.value as 'dark' | 'light');
                      showToast(`Console theme changed to ${e.target.value}.`, 'success');
                    }}
                    className="bg-surface-top border border-border text-xs text-secondary rounded-[6px] px-2.5 py-1.5 focus:outline-none cursor-pointer appearance-none shrink-0"
                  >
                    <option value="dark">Dark Theme</option>
                    <option value="light">Light Theme</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-background border border-border rounded-[8px] max-w-md w-full min-w-0 gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-white">Compact Density Mode</span>
                    <span className="block text-[10px] text-muted mt-0.5 leading-relaxed">Reduce padding sizes to maximize screen data density.</span>
                  </div>
                  
                  <button 
                    onClick={() => {
                      setCompactMode(!compactMode);
                      showToast(`Compact density mode ${!compactMode ? 'enabled' : 'disabled'}.`, 'success');
                    }}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none cursor-pointer shrink-0 ${
                      compactMode ? 'bg-[#10B981]' : 'bg-surface-top'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-surface transform transition-transform ${
                      compactMode ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Cloud Integrations */}
          {activeTab === 'integrations' && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-border pb-3 flex justify-between items-center">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Third-Party Cloud Services</h3>
                <LayoutGrid className="w-4 h-4 text-purple-400 shrink-0" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {integrations.map((int) => {
                  const isConnected = int.status === 'Connected';
                  const isComingSoon = int.status === 'Coming Soon';
                  
                  return (
                    <div key={int.id} className="bg-background border border-border rounded-[8px] p-4 flex flex-col justify-between space-y-4 hover:border-border/80 transition-colors">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-3 w-full min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            {getIntegrationIcon(int.category)}
                            <h4 className="font-semibold text-xs text-white truncate">{int.name}</h4>
                          </div>
                          
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] border shrink-0 whitespace-nowrap ${
                            isConnected ? 'bg-healthy-bg text-healthy-text border-healthy-border/25' :
                            isComingSoon ? 'bg-surface-top text-muted border-border' :
                            'bg-warning-bg text-warning-text border-warning-border/20'
                          }`}>
                            {int.status}
                          </span>
                        </div>
                        
                        <p className="text-[11px] text-secondary leading-relaxed">{int.description}</p>
                      </div>

                      <div className="pt-2 border-t border-border flex justify-between items-center text-[10px] text-muted gap-3 w-full">
                        <span className="truncate">Gateway: <strong className="font-mono text-secondary">{int.type}</strong></span>
                        
                        {isComingSoon ? (
                          <span className="text-[9px] uppercase tracking-wider text-muted font-semibold shrink-0">Locked</span>
                        ) : (
                          <button
                            onClick={() => handleToggleIntegration(int.id)}
                            className={`font-semibold text-[10px] px-2.5 py-0.5 rounded-[4px] border transition-colors cursor-pointer shrink-0 ${
                              isConnected 
                                ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' 
                                : 'bg-purple-600/10 text-purple-400 border-purple-600/20 hover:bg-purple-600/20'
                            }`}
                          >
                            {isConnected ? 'Disconnect' : 'Connect'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
