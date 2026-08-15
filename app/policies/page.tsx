'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Policy } from '@/lib/types/policy';
import { Search, Plus, Trash2, Edit2, ShieldAlert, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { formatTimestamp } from '@/lib/utils';
import { useToast } from '@/context/ToastContext';

export default function PoliciesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  
  // Modals state
  const [modalType, setModalType] = useState<'create' | 'edit' | 'delete' | null>(null);
  const [activePolicy, setActivePolicy] = useState<Policy | null>(null);
  
  // Form states
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formScope, setFormScope] = useState('');
  const [formSeverity, setFormSeverity] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [formDecision, setFormDecision] = useState<'ALLOWED' | 'BLOCKED' | 'REVIEW' | 'ALERT'>('BLOCKED');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPolicies = useCallback(async (isRefresh = false) => {
    if (!user?.organization_id) {
      setIsLoading(false);
      return;
    }

    if (!isRefresh) setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/policies');
      if (!res.ok) throw new Error('Unable to load security policies');
      const json = await res.json();
      if (json.success && json.data) {
        setPolicies(json.data);
      } else {
        throw new Error(json.error || 'Unable to load security policies');
      }
    } catch (err: unknown) {
      console.error('Error loading policies from control plane:', err);
      setError('Unable to load security policies from control plane. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.organization_id) {
      requestAnimationFrame(() => {
        fetchPolicies();
      });
    } else if (!user) {
      requestAnimationFrame(() => {
        setIsLoading(false);
      });
    }
  }, [user, fetchPolicies]);

  // Actions
  const handleToggleStatus = async (id: string, currentStatus: Policy['status']) => {
    if (!user?.organization_id) return;

    const nextStatus: Policy['status'] = currentStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await fetch(`/api/policies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        showToast(`Policy marked as ${nextStatus}.`, 'success');
        await fetchPolicies(true);
      } else {
        showToast(json.error || 'Failed to update policy status.', 'error');
      }
    } catch (err) {
      console.error('Error updating policy status:', err);
      showToast('Failed to update policy status.', 'error');
    }
  };

  const handleOpenCreate = () => {
    setFormName('');
    setFormDescription('');
    setFormScope('');
    setFormSeverity('Medium');
    setFormDecision('BLOCKED');
    setActivePolicy(null);
    setModalType('create');
  };

  const handleOpenEdit = (policy: Policy) => {
    setActivePolicy(policy);
    setFormName(policy.name);
    setFormDescription(policy.description);
    setFormScope(policy.scope);
    setFormSeverity(policy.severity);
    setFormDecision(policy.decision);
    setModalType('edit');
  };

  const handleOpenDelete = (policy: Policy) => {
    setActivePolicy(policy);
    setModalType('delete');
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.organization_id) return;

    if (!formName.trim() || !formDescription.trim()) {
      showToast('Name and Description are required fields.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (modalType === 'create') {
        const res = await fetch('/api/policies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            description: formDescription,
            scope: formScope || 'All Scopes',
            severity: formSeverity,
            decision: formDecision,
            status: 'Active',
            conditions: [],
          }),
        });

        const json = await res.json();

        if (res.ok && json.success) {
          showToast('Policy created successfully.', 'success');
          setModalType(null);
          await fetchPolicies(true);
        } else {
          showToast(json.error || 'Failed to create policy.', 'error');
        }
      } else if (modalType === 'edit' && activePolicy) {
        const res = await fetch(`/api/policies/${activePolicy.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            description: formDescription,
            scope: formScope,
            severity: formSeverity,
            decision: formDecision,
          }),
        });

        const json = await res.json();

        if (res.ok && json.success) {
          showToast('Policy configuration updated.', 'success');
          setModalType(null);
          await fetchPolicies(true);
        } else {
          showToast(json.error || 'Failed to update policy.', 'error');
        }
      }
    } catch (err) {
      console.error('Error saving policy:', err);
      showToast('Error saving policy configuration.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!activePolicy || !user?.organization_id) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/policies/${activePolicy.id}`, {
        method: 'DELETE',
      });

      const json = await res.json();

      if (res.ok && json.success) {
        showToast('Policy deleted successfully.', 'success');
        setModalType(null);
        await fetchPolicies(true);
      } else {
        showToast(json.error || 'Error deleting policy.', 'error');
      }
    } catch (err) {
      console.error('Error deleting policy:', err);
      showToast('Error deleting policy.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPolicies = policies.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.description.toLowerCase().includes(search.toLowerCase()) ||
                          p.scope.toLowerCase().includes(search.toLowerCase());
    
    const matchesSeverity = selectedSeverity === 'all' || p.severity === selectedSeverity;
    
    return matchesSearch && matchesSeverity;
  });

  return (
    <div className="p-4 md:p-8 pb-20 max-w-7xl mx-auto space-y-6 relative text-primary-text">
      
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Security Boundaries & Governance Policies</h2>
          <p className="text-xs text-secondary mt-1">Configure action decisions and enforce strict operational guardrails on non-human identities.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchPolicies(true)}
            className="p-2 bg-surface hover:bg-surface-top border border-border text-secondary hover:text-white rounded-[6px] transition-colors cursor-pointer"
            title="Refresh Policies"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreate}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:from-purple-700 active:to-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-[6px] transition-colors flex items-center justify-center gap-2 self-start sm:self-auto h-9 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Policy</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface border border-border rounded-[12px] p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search by policy name, scope..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-background border border-border text-xs text-primary-text placeholder-muted rounded-[6px] pl-9 pr-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
          />
        </div>

        <div className="w-full sm:w-48">
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40 appearance-none cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="Critical">Critical Only</option>
            <option value="High">High Only</option>
            <option value="Medium">Medium Only</option>
            <option value="Low">Low Only</option>
          </select>
        </div>
      </div>

      {/* Error State Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-[12px] p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-xs text-white font-medium">{error}</p>
          <button
            onClick={() => fetchPolicies()}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-[6px] transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface border border-border rounded-[12px] p-6 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        /* Policy Card List */
        <div className="grid grid-cols-1 gap-4">
          {filteredPolicies.length === 0 ? (
            <div className="bg-surface border border-border rounded-[12px] p-12 text-center text-xs text-muted">
              {policies.length === 0 ? 'No security policies configured' : 'No governance policies match your filter constraints.'}
            </div>
          ) : (
            filteredPolicies.map((policy) => (
              <div key={policy.id} className="bg-surface border border-border rounded-[12px] p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-border/80 transition-colors animate-slide-up">
                
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 w-full min-w-0">
                    <h3 className="font-semibold text-xs text-white leading-none truncate max-w-full">{policy.name}</h3>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] border shrink-0 whitespace-nowrap ${
                      policy.severity === 'Critical' ? 'bg-critical-bg text-critical-text border-critical-border' :
                      policy.severity === 'High' ? 'bg-warning-bg text-warning-text border-warning-border' :
                      'bg-surface-top text-secondary border-border'
                    }`}>
                      {policy.severity}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-[4px] bg-background text-secondary border border-border font-mono shrink-0 whitespace-nowrap">
                      {policy.decision}
                    </span>
                  </div>
                  
                  <p className="text-xs text-secondary max-w-2xl leading-relaxed">{policy.description}</p>
                  
                  <div className="flex flex-wrap gap-4 text-[10px] text-muted">
                    <span>Scope: <strong className="text-secondary font-medium">{policy.scope}</strong></span>
                    <span>Violations count: <strong className="text-critical-text font-mono">{policy.violations}</strong></span>
                    <span>Updated: {formatTimestamp(policy.lastUpdated)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 border-t md:border-t-0 border-border pt-4 md:pt-0 self-stretch md:self-auto justify-end shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted font-bold uppercase tracking-wider">Enforcement</span>
                    <button 
                      onClick={() => handleToggleStatus(policy.id, policy.status)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none cursor-pointer ${
                        policy.status === 'Active' ? 'bg-[#10B981]' : 'bg-surface-top'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-surface transform transition-transform ${
                        policy.status === 'Active' ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  <div className="h-6 w-[1px] bg-border" />

                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => handleOpenEdit(policy)}
                      className="p-1.5 text-secondary hover:text-white rounded hover:bg-surface-top border border-border cursor-pointer"
                      title="Edit policy"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    
                    <button 
                      onClick={() => handleOpenDelete(policy)}
                      className="p-1.5 text-red-400/60 hover:text-red-400 rounded hover:bg-red-500/10 border border-red-500/20 cursor-pointer"
                      title="Delete policy"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>
      )}

      {/* Creation / Edit Form Dialog */}
      {modalType && modalType !== 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !isSubmitting && setModalType(null)} />
          
          <form 
            onSubmit={handleSubmitForm} 
            className="relative bg-surface border border-border max-w-lg w-full rounded-[12px] p-6 space-y-4 shadow-2xl animate-scale-up"
          >
            
            <div className="border-b border-border pb-3 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">
                {modalType === 'create' ? 'Create Governance Policy' : 'Edit Policy Settings'}
              </h3>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-muted font-bold uppercase tracking-wider block">Policy Name</label>
                <input
                  type="text"
                  placeholder="e.g. Prevent Database Deletions"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="bg-background border border-border text-xs text-white placeholder-muted rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-muted font-bold uppercase tracking-wider block">Description</label>
                <textarea
                  placeholder="Summarize the action triggers and rules enforced by this policy."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="bg-background border border-border text-xs text-white placeholder-muted rounded-[6px] px-3 py-2 w-full h-20 focus:outline-none focus:border-purple-500/40 resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-muted font-bold uppercase tracking-wider block">Scope Name</label>
                  <input
                    type="text"
                    placeholder="AWS KMS / S3"
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value)}
                    className="bg-background border border-border text-xs text-white placeholder-muted rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-muted font-bold uppercase tracking-wider block">Severity Level</label>
                  <select
                    value={formSeverity}
                    onChange={(e) => setFormSeverity(e.target.value as 'Low' | 'Medium' | 'High' | 'Critical')}
                    className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40 appearance-none cursor-pointer"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-muted font-bold uppercase tracking-wider block">Policy Decision</label>
                  <select
                    value={formDecision}
                    onChange={(e) => setFormDecision(e.target.value as 'ALLOWED' | 'BLOCKED' | 'REVIEW' | 'ALERT')}
                    className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40 appearance-none cursor-pointer"
                  >
                    <option value="BLOCKED">BLOCKED</option>
                    <option value="REVIEW">REVIEW</option>
                    <option value="ALERT">ALERT</option>
                    <option value="ALLOWED">ALLOWED</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-3 border-t border-border">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setModalType(null)}
                className="bg-surface-top hover:bg-surface-mid border border-border text-secondary hover:text-white font-semibold text-xs px-4 py-2 rounded-[6px] disabled:opacity-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-4 py-2 rounded-[6px] disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer h-9"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
                <span>{modalType === 'create' ? 'Save Policy' : 'Update Policy'}</span>
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {modalType === 'delete' && activePolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !isSubmitting && setModalType(null)} />
          
          <div className="relative bg-surface border border-border max-w-sm w-full rounded-[12px] p-6 space-y-4 shadow-2xl animate-scale-up">
            
            <div className="flex items-center gap-3 text-red-400">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              <h3 className="text-sm font-bold text-white">Delete Policy?</h3>
            </div>

            <p className="text-xs text-secondary leading-relaxed">
              Are you sure you want to delete policy &quot;{activePolicy.name}&quot;? This boundary constraint will immediately stop enforcing security checks.
            </p>

            <div className="flex gap-3 justify-end pt-2 border-t border-border">
              <button
                disabled={isSubmitting}
                onClick={() => setModalType(null)}
                className="bg-surface-top hover:bg-surface-mid border border-border text-secondary hover:text-white font-semibold text-xs px-4 py-2 rounded-[6px] disabled:opacity-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                disabled={isSubmitting}
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-500 text-white font-semibold text-xs px-4 py-2 rounded-[6px] disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer h-9"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
                <span>Delete Policy</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
