'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ResourceItem, ResourceType, ResourceSensitivity, ResourceStatus } from '@/lib/types/resource';
import { RiskBadge, StatusBadge } from '@/components/ui/Badges';
import { 
  Search, 
  Database, 
  Server, 
  Cloud, 
  FileText, 
  Plus, 
  Loader2, 
  RefreshCw, 
  AlertCircle,
  X,
  Layers,
  Lock
} from 'lucide-react';
import { formatTimestamp } from '@/lib/utils';
import { useToast } from '@/context/ToastContext';

export default function ResourcesPage() {
  useAuth();
  const { showToast } = useToast();

  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedSensitivity, setSelectedSensitivity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modal State for Add / Register Resource
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ResourceType>('Database');
  const [newSensitivity, setNewSensitivity] = useState<ResourceSensitivity>('Confidential');
  const [newStatus, setNewStatus] = useState<ResourceStatus>('Active');
  const [newEnv, setNewEnv] = useState('Production');
  const [newOwner, setNewOwner] = useState('SecOps Team');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail Modal State
  const [selectedResource, setSelectedResource] = useState<ResourceItem | null>(null);

  const fetchResources = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/resources');
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Unable to fetch resource inventory');
      }
      const json = await res.json();
      if (json.success && json.data) {
        setResources(json.data);
      } else {
        throw new Error(json.error || 'Unable to fetch resource inventory');
      }
    } catch (err: unknown) {
      console.error('Error loading resources from database:', err);
      setError('Unable to fetch resource inventory from control plane. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      fetchResources();
    });
  }, [fetchResources]);

  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newName.trim()) {
      showToast('Resource name is required.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          resourceType: newType,
          sensitivity: newSensitivity,
          status: newStatus,
          environment: newEnv,
          owner: newOwner,
          description: newDescription || `${newName} cloud resource asset`,
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        showToast('Target resource registered successfully.', 'success');
        setIsAddModalOpen(false);
        setNewName('');
        setNewDescription('');
        await fetchResources(true);
      } else {
        showToast(json.error || 'Error registering target resource.', 'error');
      }
    } catch (err) {
      console.error('Failed to create resource:', err);
      showToast('Error registering target resource.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredResources = resources.filter((res) => {
    const matchesSearch = res.name.toLowerCase().includes(search.toLowerCase()) ||
                          res.resourceType.toLowerCase().includes(search.toLowerCase()) ||
                          (res.metadata?.description as string || '').toLowerCase().includes(search.toLowerCase());

    const matchesType = selectedType === 'all' || res.resourceType === selectedType;
    const matchesSensitivity = selectedSensitivity === 'all' || res.sensitivity === selectedSensitivity;
    const matchesStatus = selectedStatus === 'all' || res.status === selectedStatus;

    return matchesSearch && matchesType && matchesSensitivity && matchesStatus;
  });

  const getResourceIcon = (type: ResourceType) => {
    switch (type) {
      case 'Database': return <Database className="w-4 h-4 text-purple-400" />;
      case 'API': return <Server className="w-4 h-4 text-blue-400" />;
      case 'Cloud Role': return <Cloud className="w-4 h-4 text-amber-400" />;
      case 'Storage': return <Layers className="w-4 h-4 text-emerald-400" />;
      default: return <FileText className="w-4 h-4 text-secondary" />;
    }
  };

  return (
    <div className="p-4 md:p-8 pb-20 max-w-7xl mx-auto space-y-6 text-primary-text">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Target Resource Control Catalog</h2>
          <p className="text-xs text-secondary mt-1">Registry of enterprise databases, API gateways, storage buckets, and sensitive cloud assets.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchResources(true)}
            className="p-2 bg-surface hover:bg-surface-top border border-border text-secondary hover:text-white rounded-[6px] transition-colors cursor-pointer"
            title="Refresh Inventory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-3.5 py-2 rounded-[6px] transition-colors flex items-center gap-1.5 cursor-pointer h-9"
          >
            <Plus className="w-4 h-4" />
            <span>Register Resource</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-surface border border-border rounded-[12px] p-4 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          
          {/* Search bar */}
          <div className="relative md:col-span-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search resources by name, type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-background border border-border text-xs text-primary-text placeholder-muted rounded-[6px] pl-9 pr-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
            />
          </div>

          {/* Resource Type filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40 appearance-none cursor-pointer"
            >
              <option value="all">All Resource Types</option>
              <option value="Database">Database</option>
              <option value="API">API Gateway</option>
              <option value="Cloud Role">Cloud IAM Role</option>
              <option value="Storage">Storage Bucket</option>
              <option value="Service">Service</option>
              <option value="Other">Other Asset</option>
            </select>
          </div>

          {/* Sensitivity filter */}
          <div>
            <select
              value={selectedSensitivity}
              onChange={(e) => setSelectedSensitivity(e.target.value)}
              className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40 appearance-none cursor-pointer"
            >
              <option value="all">All Sensitivity Levels</option>
              <option value="Restricted">Restricted (Critical)</option>
              <option value="Confidential">Confidential</option>
              <option value="Internal">Internal Only</option>
              <option value="Public">Public</option>
            </select>
          </div>

          {/* Status filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40 appearance-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Restricted">Restricted Access</option>
              <option value="Deprecated">Deprecated</option>
            </select>
          </div>

        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-[12px] p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-xs text-white font-medium">{error}</p>
          <button
            onClick={() => fetchResources()}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-[6px] transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="bg-surface border border-border rounded-[12px] p-12 text-center text-xs text-muted">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-500 mb-2" />
          <span>Loading resource inventory from control plane...</span>
        </div>
      ) : (
        /* Resource Table / Grid */
        <div className="bg-surface border border-border rounded-[12px] overflow-hidden">
          {filteredResources.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted">
              {resources.length === 0 ? 'No resources discovered' : 'No target resources match the selected parameters.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-background/50 text-[10px] uppercase font-bold text-muted tracking-wider">
                    <th className="px-4 py-3">Resource Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Sensitivity</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Risk Score</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-secondary">
                  {filteredResources.map((res) => (
                    <tr key={res.id} className="hover:bg-surface-top/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 bg-background border border-border rounded-[6px] shrink-0">
                            {getResourceIcon(res.resourceType)}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-white block truncate">{res.name}</span>
                            <span className="text-[10px] text-muted font-mono block truncate">
                              {(res.metadata?.description as string) || res.environment}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-white">{res.resourceType}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-semibold border ${
                          res.sensitivity === 'Restricted' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          res.sensitivity === 'Confidential' ? 'bg-purple-500/10 text-purple-300 border-purple-500/20' :
                          'bg-surface-top text-secondary border-border'
                        }`}>
                          {res.sensitivity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={res.status} className="text-[9px]" />
                      </td>
                      <td className="px-4 py-3 text-muted font-mono">{res.owner}</td>
                      <td className="px-4 py-3">
                        <RiskBadge score={res.riskScore} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedResource(res)}
                          className="text-purple-400 hover:text-purple-300 font-semibold text-[11px] cursor-pointer"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Resource Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !isSubmitting && setIsAddModalOpen(false)}
          />
          
          <div className="relative bg-surface border border-border max-w-md w-full rounded-[12px] p-6 space-y-4 shadow-2xl animate-scale-up z-10">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-sm font-bold text-white">Register Target Resource Asset</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateResource} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-secondary font-medium">Resource Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. s3-finance-ledger-bucket"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-background border border-border text-xs text-white rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-secondary font-medium">Resource Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as ResourceType)}
                    className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                  >
                    <option value="Database">Database</option>
                    <option value="API">API Gateway</option>
                    <option value="Cloud Role">Cloud IAM Role</option>
                    <option value="Storage">Storage Bucket</option>
                    <option value="Service">Service</option>
                    <option value="Other">Other Asset</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-secondary font-medium">Sensitivity</label>
                  <select
                    value={newSensitivity}
                    onChange={(e) => setNewSensitivity(e.target.value as ResourceSensitivity)}
                    className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                  >
                    <option value="Confidential">Confidential</option>
                    <option value="Restricted">Restricted (Critical)</option>
                    <option value="Internal">Internal</option>
                    <option value="Public">Public</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-secondary font-medium">Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as ResourceStatus)}
                    className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Restricted">Restricted Access</option>
                    <option value="Deprecated">Deprecated</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-secondary font-medium">Environment</label>
                  <select
                    value={newEnv}
                    onChange={(e) => setNewEnv(e.target.value)}
                    className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                  >
                    <option value="Production">Production</option>
                    <option value="Staging">Staging</option>
                    <option value="Development">Development</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-secondary font-medium">Owner / Managing Team</label>
                <input
                  type="text"
                  placeholder="e.g. SecOps Team"
                  value={newOwner}
                  onChange={(e) => setNewOwner(e.target.value)}
                  className="bg-background border border-border text-xs text-white rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                />
              </div>

              <div className="space-y-1">
                <label className="text-secondary font-medium">Description</label>
                <textarea
                  rows={2}
                  placeholder="Describe resource purpose and security boundary..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="bg-background border border-border text-xs text-white rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40 resize-none"
                />
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
                  <span>Register Resource</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resource Detail Drawer / Modal */}
      {selectedResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedResource(null)}
          />
          
          <div className="relative bg-surface border border-border max-w-md w-full rounded-[12px] p-6 space-y-4 shadow-2xl animate-scale-up z-10">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Resource Inspector</h3>
              </div>
              <button
                onClick={() => setSelectedResource(null)}
                className="text-muted hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-muted block text-[10px] uppercase font-bold tracking-wider">Asset Name</span>
                <span className="text-white font-semibold text-sm mt-0.5 block">{selectedResource.name}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-background p-3 rounded-[6px] border border-border">
                <div>
                  <span className="text-muted block text-[9px] uppercase font-bold tracking-wider">Type</span>
                  <span className="text-white font-medium mt-0.5 block">{selectedResource.resourceType}</span>
                </div>
                <div>
                  <span className="text-muted block text-[9px] uppercase font-bold tracking-wider">Sensitivity</span>
                  <span className="text-purple-300 font-medium mt-0.5 block">{selectedResource.sensitivity}</span>
                </div>
                <div>
                  <span className="text-muted block text-[9px] uppercase font-bold tracking-wider">Status</span>
                  <span className="text-white font-medium mt-0.5 block">{selectedResource.status}</span>
                </div>
                <div>
                  <span className="text-muted block text-[9px] uppercase font-bold tracking-wider">Risk Score</span>
                  <div className="mt-0.5">
                    <RiskBadge score={selectedResource.riskScore} />
                  </div>
                </div>
              </div>

              <div>
                <span className="text-muted block text-[10px] uppercase font-bold tracking-wider">Resource ID (Database UUID)</span>
                <span className="font-mono text-[10px] text-secondary bg-background p-2 rounded-[4px] block border border-border mt-1 truncate select-all">
                  {selectedResource.id}
                </span>
              </div>

              <div>
                <span className="text-muted block text-[10px] uppercase font-bold tracking-wider">Registered At</span>
                <span className="text-secondary text-[11px] mt-0.5 block">{formatTimestamp(selectedResource.createdAt)}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedResource(null)}
                className="bg-surface-top hover:bg-surface-mid border border-border text-white font-semibold text-xs px-4 py-2 rounded-[6px] transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
