'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Agent } from '@/lib/types/agent';
import { Identity } from '@/lib/types/identity';
import { RiskBadge, StatusBadge } from '@/components/ui/Badges';
import { 
  Search, 
  ArrowRight, 
  Cpu, 
  Sparkles, 
  Plus, 
  Loader2, 
  RefreshCw, 
  AlertCircle,
  X 
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/context/ToastContext';

export default function AIAgentsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedEnv, setSelectedEnv] = useState<string>('all');
  const [selectedRisk, setSelectedRisk] = useState<string>('all');

  // Register Agent Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newModel, setNewModel] = useState('GPT-4o');
  const [newProvider, setNewProvider] = useState('OpenAI');
  const [newPurpose, setNewPurpose] = useState('');
  const [newEnv, setNewEnv] = useState('Production');
  const [newOwner, setNewOwner] = useState('SecOps Team');
  const [newIdentityId, setNewIdentityId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAgents = useCallback(async (isRefresh = false) => {
    if (!user?.organization_id) {
      setIsLoading(false);
      return;
    }

    if (!isRefresh) setIsLoading(true);
    setError(null);

    try {
      const [agentsRes, identitiesRes] = await Promise.all([
        fetch('/api/ai-agents'),
        fetch('/api/identities'),
      ]);

      if (!agentsRes.ok) throw new Error('Failed to fetch AI agents');
      const agentsJson = await agentsRes.json();
      if (agentsJson.success && agentsJson.data) {
        setAgents(agentsJson.data);
      }

      if (identitiesRes.ok) {
        const identitiesJson = await identitiesRes.json();
        if (identitiesJson.success && identitiesJson.data) {
          setIdentities(identitiesJson.data);
        }
      }
    } catch (err: unknown) {
      console.error('Error fetching AI agents:', err);
      setError('Unable to fetch AI agent telemetry from control plane. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.organization_id) {
      requestAnimationFrame(() => {
        fetchAgents();
      });
    } else if (!user) {
      requestAnimationFrame(() => {
        setIsLoading(false);
      });
    }
  }, [user, fetchAgents]);

  const handleRegisterAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.organization_id) return;

    if (!newName.trim()) {
      showToast('Agent name is required.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/ai-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          model: newModel,
          provider: newProvider,
          purpose: newPurpose || `Autonomous ${newModel} agent`,
          environment: newEnv,
          owner: newOwner,
          identityId: newIdentityId || null,
          riskScore: 20,
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        showToast('AI Agent registered successfully.', 'success');
        setIsModalOpen(false);
        setNewName('');
        setNewPurpose('');
        setNewIdentityId('');
        await fetchAgents(true);
      } else {
        showToast(json.error || 'Failed to register AI agent.', 'error');
      }
    } catch (err) {
      console.error('Error registering agent:', err);
      showToast('Failed to register AI agent.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAgents = agents.filter((agent) => {
    const matchesSearch = agent.name.toLowerCase().includes(search.toLowerCase()) ||
                          agent.purpose.toLowerCase().includes(search.toLowerCase()) ||
                          agent.model.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = selectedStatus === 'all' || 
                         (selectedStatus === 'Active' && agent.status === 'Active') ||
                         (selectedStatus === 'Suspended' && agent.status === 'Suspended') ||
                         (selectedStatus === 'Idle' && agent.status === 'Idle');

    const matchesEnv = selectedEnv === 'all' || 
                      (selectedEnv === 'Production' && agent.environment === 'Production') ||
                      (selectedEnv === 'Development' && agent.environment === 'Development') ||
                      (selectedEnv === 'other' && agent.environment !== 'Production' && agent.environment !== 'Development');

    let matchesRisk = true;
    if (selectedRisk !== 'all') {
      if (selectedRisk === 'critical') matchesRisk = agent.riskScore >= 80;
      else if (selectedRisk === 'high') matchesRisk = agent.riskScore >= 60 && agent.riskScore < 80;
      else if (selectedRisk === 'medium') matchesRisk = agent.riskScore >= 30 && agent.riskScore < 60;
      else if (selectedRisk === 'healthy') matchesRisk = agent.riskScore < 30;
    }

    return matchesSearch && matchesStatus && matchesEnv && matchesRisk;
  });

  return (
    <div className="p-4 md:p-8 pb-20 max-w-7xl mx-auto space-y-6 text-primary-text">
      
      {/* Title & Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">AI Agent Security Catalog</h2>
          <p className="text-xs text-secondary mt-1">Registry of LLM-powered autonomous agents, capability bounds, and active transaction logs.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchAgents(true)}
            className="p-2 bg-surface hover:bg-surface-top border border-border text-secondary hover:text-white rounded-[6px] transition-colors cursor-pointer"
            title="Refresh Agents"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs px-3.5 py-2 rounded-[6px] transition-colors flex items-center gap-1.5 cursor-pointer h-9"
          >
            <Plus className="w-4 h-4" />
            <span>Register AI Agent</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface border border-border rounded-[12px] p-4 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          
          {/* Search bar */}
          <div className="relative md:col-span-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search agents by name, model..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-background border border-border text-xs text-primary-text placeholder-muted rounded-[6px] pl-9 pr-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
            />
          </div>

          {/* Status filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40 appearance-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Idle">Idle Only</option>
              <option value="Suspended">Suspended / Frozen</option>
            </select>
          </div>

          {/* Environment filter */}
          <div>
            <select
              value={selectedEnv}
              onChange={(e) => setSelectedEnv(e.target.value)}
              className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40 appearance-none cursor-pointer"
            >
              <option value="all">All Environments</option>
              <option value="Production">Production</option>
              <option value="Development">Development</option>
              <option value="other">Staging / Corporate</option>
            </select>
          </div>

          {/* Risk filter */}
          <div>
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40 appearance-none cursor-pointer"
            >
              <option value="all">All Risk Scores</option>
              <option value="critical">Critical (≥80)</option>
              <option value="high">High Risk (60-79)</option>
              <option value="medium">Medium (30-59)</option>
              <option value="healthy">Healthy (&lt;30)</option>
            </select>
          </div>

        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-[12px] p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-xs text-white font-medium">{error}</p>
          <button
            onClick={() => fetchAgents()}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-[6px] transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Loading State Skeleton Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface border border-border rounded-[12px] p-5 h-64 animate-pulse" />
          ))}
        </div>
      ) : (
        /* Grid List */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.length === 0 ? (
            <div className="col-span-full bg-surface border border-border rounded-[12px] p-12 text-center text-xs text-muted">
              {agents.length === 0 ? 'No AI agents registered' : 'No autonomous agents match the selected parameters.'}
            </div>
          ) : (
            filteredAgents.map((agent) => (
              <div key={agent.id} className="bg-surface border border-border hover:border-border/80 rounded-[12px] p-5 flex flex-col justify-between space-y-4 hover:shadow-xl transition-all duration-200 animate-slide-up">
                
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 bg-background border border-border text-purple-400 rounded-[6px] shrink-0">
                        <Cpu className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <Link href={`/agents/${agent.id}`} className="font-semibold text-xs text-primary-text hover:text-purple-400 hover:underline block leading-tight truncate">
                          {agent.name}
                        </Link>
                        <span className="text-[10px] text-muted font-mono block mt-0.5 truncate">{agent.model}</span>
                      </div>
                    </div>
                    <RiskBadge score={agent.status === 'Suspended' ? 0 : agent.riskScore} className="shrink-0" />
                  </div>
                  
                  <p className="text-xs text-secondary leading-relaxed line-clamp-2">{agent.purpose}</p>

                  {/* Dynamic Insight Recommendation if applicable */}
                  {agent.riskScore >= 60 && agent.status !== 'Suspended' && (
                    <div className="bg-purple-500/5 border border-purple-500/10 rounded-[6px] p-2 flex items-start gap-1.5 text-[10px]">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                      <span className="text-purple-300">
                        Recommendation: Consider restricting permissions and performing credential audits.
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="flex justify-between items-center text-[10px] text-muted">
                    <span>Connected Resources</span>
                    <span className="text-secondary font-semibold">{agent.connectedSystems.length} systems</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {agent.connectedSystems.map((sys) => (
                      <span key={sys} className="text-[9px] font-mono px-2 py-0.5 rounded-[4px] bg-background text-secondary border border-border">
                        {sys.split(' ').slice(-1)[0]}
                      </span>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-1 gap-3 w-full">
                    <div className="flex gap-2 min-w-0 shrink-0">
                      <span className="px-2 py-0.5 rounded-[4px] bg-surface-top text-secondary border border-border font-medium text-[9px] shrink-0 whitespace-nowrap">
                        {agent.environment}
                      </span>
                      <StatusBadge status={agent.status} className="text-[9px]" />
                    </div>
                    
                    <Link href={`/agents/${agent.id}`} className="text-purple-400 hover:text-purple-300 text-xs font-semibold flex items-center gap-1 min-w-0 truncate shrink">
                      <span className="truncate">Review Agent</span>
                      <ArrowRight className="w-3 h-3 shrink-0" />
                    </Link>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>
      )}

      {/* Register Agent Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !isSubmitting && setIsModalOpen(false)}
          />
          
          <div className="relative bg-surface border border-border max-w-md w-full rounded-[12px] p-6 space-y-4 shadow-2xl animate-scale-up z-10">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-sm font-bold text-white">Register Autonomous AI Agent</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterAgent} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-secondary font-medium">Agent Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Payment-Processing-Agent"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-background border border-border text-xs text-white rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-secondary font-medium">Model</label>
                  <select
                    value={newModel}
                    onChange={(e) => {
                      setNewModel(e.target.value);
                      if (e.target.value.includes('Claude')) setNewProvider('Anthropic');
                      else if (e.target.value.includes('Llama')) setNewProvider('Meta');
                      else setNewProvider('OpenAI');
                    }}
                    className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                  >
                    <option value="GPT-4o">GPT-4o</option>
                    <option value="GPT-4-Turbo">GPT-4 Turbo</option>
                    <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet</option>
                    <option value="Llama-3-70B">Llama-3 70B</option>
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
                <label className="text-secondary font-medium">Purpose / Task Description</label>
                <textarea
                  rows={2}
                  placeholder="Describe agent workload scope and capability bounds..."
                  value={newPurpose}
                  onChange={(e) => setNewPurpose(e.target.value)}
                  className="bg-background border border-border text-xs text-white rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-secondary font-medium">Associated Non-Human Identity (Optional)</label>
                <select
                  value={newIdentityId}
                  onChange={(e) => setNewIdentityId(e.target.value)}
                  className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                >
                  <option value="">No linked identity</option>
                  {identities.map((id) => (
                    <option key={id.id} value={id.id}>
                      {id.name} ({id.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-border">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
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
                  <span>Register Agent</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
