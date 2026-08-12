'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  identityService, 
  mapUITypeToDB, 
  VALID_DB_IDENTITY_TYPES,
  mapUIStatusToDB,
  VALID_DB_IDENTITY_STATUSES
} from '@/lib/services/identityService';
import { Identity, IdentityType } from '@/lib/types/identity';
import { RiskBadge, StatusBadge } from '@/components/ui/Badges';
import { 
  Search, 
  ShieldAlert, 
  ArrowUpDown, 
  ChevronRight, 
  Plus, 
  Loader2, 
  RefreshCw, 
  AlertCircle,
  X,
  Cloud
} from 'lucide-react';
import Link from 'next/link';
import { formatTimestamp } from '@/lib/utils';
import { useToast } from '@/context/ToastContext';

export default function IdentitiesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [identities, setIdentities] = useState<Identity[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'Human' | 'Service Account' | 'Machine Identity' | 'AI Agent'>('all');
  const [selectedEnv, setSelectedEnv] = useState<string>('all');
  const [selectedRisk, setSelectedRisk] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'riskScore' | 'lastActive'>('riskScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal State for Add Identity
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newIdentityName, setNewIdentityName] = useState('');
  const [newIdentityType, setNewIdentityType] = useState<IdentityType>('Service Account');
  const [newIdentityEnv, setNewIdentityEnv] = useState('Production');
  const [newIdentityProvider, setNewIdentityProvider] = useState('AWS');
  const [newIdentityOwner, setNewIdentityOwner] = useState('SecOps Team');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // AWS Sync State
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchIdentities = useCallback(async (isRefresh = false) => {
    if (!user?.organization_id) {
      setIsLoading(false);
      return;
    }

    if (!isRefresh) setIsLoading(true);
    setError(null);

    try {
      const data = await identityService.getIdentities(user.organization_id);
      setIdentities(data);
    } catch (err: unknown) {
      console.error('Error loading identities from database:', err);
      setError('Unable to fetch identity catalog from control plane. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.organization_id) {
      requestAnimationFrame(() => {
        fetchIdentities();
      });
    } else if (!user) {
      requestAnimationFrame(() => {
        setIsLoading(false);
      });
    }
  }, [user, fetchIdentities]);

  const handleSort = (field: 'name' | 'riskScore' | 'lastActive') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleCreateIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.organization_id) return;

    if (!newIdentityName.trim()) {
      showToast('Identity name is required.', 'error');
      return;
    }

    const dbType = mapUITypeToDB(newIdentityType);
    if (!VALID_DB_IDENTITY_TYPES.includes(dbType)) {
      showToast(`Unsupported identity type: "${newIdentityType}".`, 'error');
      return;
    }

    const dbStatus = mapUIStatusToDB('Active');
    if (!VALID_DB_IDENTITY_STATUSES.includes(dbStatus)) {
      showToast(`Unsupported identity status: "Active".`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await identityService.createIdentity(user.organization_id, {
        name: newIdentityName,
        type: newIdentityType,
        status: 'Active',
        riskScore: 25,
        environment: newIdentityEnv,
        provider: newIdentityProvider,
        owner: newIdentityOwner,
      });

      if (res.success) {
        showToast('New identity registered successfully.', 'success');
        setIsAddModalOpen(false);
        setNewIdentityName('');
        await fetchIdentities(true);
      } else {
        showToast(res.message, 'error');
      }
    } catch (err) {
      console.error('Failed to create identity:', err);
      showToast('Error registering new identity.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncAWS = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/integrations/aws/sync', { method: 'POST' });
      const data = await res.json();
      
      if (res.ok && data.success) {
        const sync = data.summary?.sync || data.summary || {};
        const intel = data.summary?.intelligence || {};
        const created = sync.identitiesCreated ?? sync.created ?? 0;
        const updated = sync.identitiesUpdated ?? sync.updated ?? 0;
        const skipped = sync.skipped ?? 0;
        const errors = sync.errors ?? 0;
        const usersDiscovered = sync.usersDiscovered ?? 0;
        const rolesDiscovered = sync.rolesDiscovered ?? 0;
        
        const keys = intel.accessKeysAnalyzed ?? 0;
        const pols = intel.policiesAnalyzed ?? 0;
        const high = intel.highRiskIdentities ?? 0;
        const crit = intel.criticalRiskIdentities ?? 0;

        const msg = `Users: ${usersDiscovered}, Roles: ${rolesDiscovered} | Keys analyzed: ${keys}, Policies analyzed: ${pols} | High: ${high}, Critical: ${crit} | Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`;

        if (errors > 0) {
          showToast(`AWS Sync completed with ${errors} errors. ${msg}`, 'warning');
        } else {
          showToast(`AWS IAM Sync Complete. ${msg}`, 'success');
        }
        await fetchIdentities(true);
      } else {
        showToast(data.error || 'Failed to sync AWS IAM identities.', 'error');
      }
    } catch (err) {
      console.error('Error syncing AWS IAM:', err);
      showToast('An error occurred during AWS IAM synchronization.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter identities
  const filteredIdentities = identities
    .filter((id) => {
      const matchesSearch = id.name.toLowerCase().includes(search.toLowerCase()) || 
                            id.owner.toLowerCase().includes(search.toLowerCase()) ||
                            id.id.toLowerCase().includes(search.toLowerCase());
      
      let matchesCategory = true;
      if (activeCategory !== 'all') {
        if (activeCategory === 'Human') {
          matchesCategory = id.type === 'OAuth Client' || id.owner.toLowerCase().includes('helpdesk') || id.owner.toLowerCase().includes('marketing');
        } else if (activeCategory === 'Service Account') {
          matchesCategory = id.type === 'Service Account' || id.type === 'Workload';
        } else if (activeCategory === 'Machine Identity') {
          matchesCategory = id.type === 'Machine Identity' || id.type === 'IAM Role' || id.type === 'API Key';
        } else if (activeCategory === 'AI Agent') {
          matchesCategory = id.type === 'Bot' || id.name.toLowerCase().includes('agent');
        }
      }

      const matchesEnv = selectedEnv === 'all' || id.environment === selectedEnv;
      
      let matchesRisk = true;
      if (selectedRisk !== 'all') {
        if (selectedRisk === 'critical') matchesRisk = id.riskScore >= 80;
        else if (selectedRisk === 'high') matchesRisk = id.riskScore >= 60 && id.riskScore < 80;
        else if (selectedRisk === 'medium') matchesRisk = id.riskScore >= 30 && id.riskScore < 60;
        else if (selectedRisk === 'healthy') matchesRisk = id.riskScore < 30;
      }

      return matchesSearch && matchesCategory && matchesEnv && matchesRisk;
    })
    .sort((a, b) => {
      const multiplier = sortOrder === 'desc' ? -1 : 1;
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name) * multiplier;
      }
      if (sortBy === 'lastActive') {
        return (new Date(a.lastActive).getTime() - new Date(b.lastActive).getTime()) * multiplier;
      }
      return (a.riskScore - b.riskScore) * multiplier;
    });

  // Unique environments for filters
  const environments = Array.from(new Set(identities.map((id) => id.environment)));

  // Real Database Telemetry Metric Calculations
  const totalCount = identities.length;
  const highRiskCount = identities.filter(i => i.riskScore >= 60 && i.status !== 'Disabled').length;
  const unreviewedCount = identities.filter(i => i.credentialAgeDays > 90 || i.riskScore >= 60).length;
  const privilegedCount = identities.filter(i => i.accessBreadth === 'High' || i.type === 'IAM Role' || i.type === 'Service Account').length;

  return (
    <div className="p-4 md:p-8 pb-20 max-w-7xl mx-auto space-y-6 text-primary-text">
      
      {/* Title & Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Identity Governance Catalog</h2>
          <p className="text-xs text-secondary mt-1">Discover, monitor, and regulate permissions for human operators, cloud services, and machine integrations.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchIdentities(true)}
            className="p-2 bg-surface hover:bg-surface-top border border-border text-secondary hover:text-white rounded-[6px] transition-colors cursor-pointer flex items-center justify-center h-9 w-9"
            title="Refresh Identities"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleSyncAWS}
            disabled={isSyncing || isLoading}
            className="bg-surface hover:bg-surface-top border border-border text-secondary hover:text-white font-semibold text-xs px-3.5 py-2 rounded-[6px] transition-colors flex items-center gap-1.5 cursor-pointer h-9 disabled:opacity-50"
            title="Sync AWS IAM Identities"
          >
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
            <span className="hidden sm:inline">Sync AWS IAM</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs px-3.5 py-2 rounded-[6px] transition-colors flex items-center gap-1.5 cursor-pointer h-9"
          >
            <Plus className="w-4 h-4" />
            <span>Add Identity</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-[12px] p-4 flex flex-col justify-between hover:border-border/80 transition-colors">
          <span className="text-muted text-[10px] font-bold uppercase tracking-wider block">Total Identities</span>
          <span className="text-xl font-bold text-white tracking-tight mt-2">{totalCount}</span>
        </div>
        <div className="bg-surface border border-border rounded-[12px] p-4 flex flex-col justify-between hover:border-border/80 transition-colors">
          <span className="text-muted text-[10px] font-bold uppercase tracking-wider block">High Risk Assets</span>
          <span className="text-xl font-bold text-critical-text tracking-tight mt-2">{highRiskCount}</span>
        </div>
        <div className="bg-surface border border-border rounded-[12px] p-4 flex flex-col justify-between hover:border-border/80 transition-colors">
          <span className="text-muted text-[10px] font-bold uppercase tracking-wider block">Unreviewed Keys</span>
          <span className="text-xl font-bold text-warning-text tracking-tight mt-2">{unreviewedCount}</span>
        </div>
        <div className="bg-surface border border-border rounded-[12px] p-4 flex flex-col justify-between hover:border-border/80 transition-colors">
          <span className="text-muted text-[10px] font-bold uppercase tracking-wider block">Privileged Scopes</span>
          <span className="text-xl font-bold text-purple-400 tracking-tight mt-2">{privilegedCount}</span>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="bg-surface border border-border rounded-[12px] p-4 space-y-4">
        
        {/* Categories Tab selectors */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex bg-background p-0.5 rounded-[6px] border border-border overflow-x-auto max-w-full">
            {(['all', 'Human', 'Service Account', 'Machine Identity', 'AI Agent'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`text-[10px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-[4px] whitespace-nowrap transition-colors cursor-pointer ${
                  activeCategory === cat 
                    ? 'bg-surface-top text-white border border-border/40' 
                    : 'text-muted hover:text-secondary'
                }`}
              >
                {cat === 'all' ? 'All Identities' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by identity name, id, owner..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-background border border-border text-xs text-primary-text placeholder-muted rounded-[6px] pl-9 pr-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
            />
          </div>

          {/* Environment Filter */}
          <div className="relative">
            <select
              value={selectedEnv}
              onChange={(e) => setSelectedEnv(e.target.value)}
              className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40 appearance-none cursor-pointer"
            >
              <option value="all">All Environments</option>
              {environments.map((env) => (
                <option key={env} value={env}>{env}</option>
              ))}
            </select>
          </div>

          {/* Risk Filter */}
          <div className="relative">
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40 appearance-none cursor-pointer"
            >
              <option value="all">All Risk Levels</option>
              <option value="critical">Critical (≥80)</option>
              <option value="high">High Risk (60-79)</option>
              <option value="medium">Medium (30-59)</option>
              <option value="healthy">Healthy (&lt;30)</option>
            </select>
          </div>
        </div>

      </div>

      {/* Warning Indicators */}
      <div className="flex justify-between items-center text-xs text-muted">
        <span>Showing {filteredIdentities.length} matching entities</span>
        {filteredIdentities.some(id => id.riskScore >= 80 && id.status === 'Active') && (
          <span className="text-critical-text flex items-center gap-1.5 font-semibold">
            <ShieldAlert className="w-3.5 h-3.5" />
            Critical threat score detected in active credentials!
          </span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-[12px] p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-xs text-white font-medium">{error}</p>
          <button
            onClick={() => fetchIdentities()}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-[6px] transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-surface border border-border rounded-[12px] overflow-hidden">
        
        {/* Loading State */}
        {isLoading ? (
          <div className="p-8 text-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500 mx-auto" />
            <p className="text-xs text-muted font-mono">Fetching non-human identities from control plane...</p>
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-primary-text border-collapse">
                <thead className="text-[10px] text-muted uppercase tracking-wider border-b border-border bg-surface-mid/40">
                  <tr>
                    <th className="px-6 py-3 font-semibold cursor-pointer select-none" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1">
                        <span>Identity</span>
                        <ArrowUpDown className="w-3.5 h-3.5 text-muted" />
                      </div>
                    </th>
                    <th className="px-6 py-3 font-semibold">Type</th>
                    <th className="px-6 py-3 font-semibold cursor-pointer select-none" onClick={() => handleSort('riskScore')}>
                      <div className="flex items-center gap-1">
                        <span>Risk Score</span>
                        <ArrowUpDown className="w-3.5 h-3.5 text-muted" />
                      </div>
                    </th>
                    <th className="px-6 py-3 font-semibold">Access Scope</th>
                    <th className="px-6 py-3 font-semibold cursor-pointer select-none" onClick={() => handleSort('lastActive')}>
                      <div className="flex items-center gap-1">
                        <span>Last Activity</span>
                        <ArrowUpDown className="w-3.5 h-3.5 text-muted" />
                      </div>
                    </th>
                    <th className="px-6 py-3 font-semibold">Owner</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIdentities.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-muted">
                        {identities.length === 0 ? 'No identities discovered' : 'No identities match search criteria.'}
                      </td>
                    </tr>
                  ) : (
                    filteredIdentities.map((id) => (
                      <tr key={id.id} className="border-b border-border hover:bg-surface-mid/30 transition-colors">
                        <td className="px-6 py-4">
                          <Link href={`/identities/${id.id}`} className="font-semibold text-white hover:text-purple-400 hover:underline block">
                            {id.name}
                          </Link>
                          <span className="text-[10px] text-muted font-mono block mt-0.5">{id.id}</span>
                        </td>
                        <td className="px-6 py-4 font-medium text-secondary">{id.type}</td>
                        <td className="px-6 py-4">
                          <RiskBadge score={id.status === 'Disabled' ? 0 : id.riskScore} />
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-secondary font-medium font-mono">
                            {id.credentialsCount} keys ({id.accessBreadth} breadth)
                          </span>
                        </td>
                        <td className="px-6 py-4 text-secondary">{formatTimestamp(id.lastActive)}</td>
                        <td className="px-6 py-4 text-secondary">{id.owner}</td>
                        <td className="px-6 py-4">
                          <StatusBadge status={id.status} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link href={`/identities/${id.id}`} className="text-purple-400 hover:text-purple-300 font-semibold">
                            Review Access
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden divide-y divide-border">
              {filteredIdentities.length === 0 ? (
                <div className="px-4 py-8 text-center text-muted text-xs">
                  {identities.length === 0 ? 'No identities discovered' : 'No identities found matching search criteria.'}
                </div>
              ) : (
                filteredIdentities.map((id) => (
                  <Link 
                    key={id.id} 
                    href={`/identities/${id.id}`} 
                    className="p-4 block hover:bg-surface-mid/30 transition-colors space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-white text-xs leading-none">{id.name}</h3>
                        <span className="text-[10px] text-muted font-mono mt-1 block">{id.id}</span>
                      </div>
                      <RiskBadge score={id.status === 'Disabled' ? 0 : id.riskScore} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-secondary">
                      <div>
                        <span className="text-muted">Type:</span> {id.type}
                      </div>
                      <div>
                        <span className="text-muted">Env:</span> {id.environment}
                      </div>
                      <div>
                        <span className="text-muted">Owner:</span> {id.owner}
                      </div>
                      <div>
                        <span className="text-muted">Access:</span> {id.accessBreadth}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-border/60 gap-3 w-full">
                      <span className="text-[10px] text-muted truncate">{new Date(id.lastActive).toLocaleDateString()}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={id.status} />
                        <ChevronRight className="w-3.5 h-3.5 text-muted" />
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </>
        )}

      </div>

      {/* Add Identity Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !isSubmitting && setIsAddModalOpen(false)}
          />
          
          <div className="relative bg-surface border border-border max-w-md w-full rounded-[12px] p-6 space-y-4 shadow-2xl animate-scale-up z-10">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-sm font-bold text-white">Register New Identity</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateIdentity} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-secondary font-medium">Identity Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. svc-payment-gateway-prod"
                  value={newIdentityName}
                  onChange={(e) => setNewIdentityName(e.target.value)}
                  className="bg-background border border-border text-xs text-white rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-secondary font-medium">Type</label>
                  <select
                    value={newIdentityType}
                    onChange={(e) => setNewIdentityType(e.target.value as IdentityType)}
                    className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                  >
                    <option value="Service Account">Service Account</option>
                    <option value="API Key">API Key</option>
                    <option value="IAM Role">IAM Role</option>
                    <option value="OAuth Client">OAuth Client</option>
                    <option value="Machine Identity">Machine Identity</option>
                    <option value="Workload">Workload</option>
                    <option value="Bot">Bot</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-secondary font-medium">Environment</label>
                  <select
                    value={newIdentityEnv}
                    onChange={(e) => setNewIdentityEnv(e.target.value)}
                    className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                  >
                    <option value="Production">Production</option>
                    <option value="Staging">Staging</option>
                    <option value="Development">Development</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-secondary font-medium">Provider</label>
                  <input
                    type="text"
                    value={newIdentityProvider}
                    onChange={(e) => setNewIdentityProvider(e.target.value)}
                    className="bg-background border border-border text-xs text-white rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-secondary font-medium">Owner</label>
                  <input
                    type="text"
                    value={newIdentityOwner}
                    onChange={(e) => setNewIdentityOwner(e.target.value)}
                    className="bg-background border border-border text-xs text-white rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-border">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-surface-top hover:bg-surface-mid border border-border text-secondary hover:text-white font-semibold text-xs px-4 py-2 rounded-[6px] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-4 py-2 rounded-[6px] disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Register Identity</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
