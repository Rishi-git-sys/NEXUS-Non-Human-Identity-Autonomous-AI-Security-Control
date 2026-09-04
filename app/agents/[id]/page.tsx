'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { Agent } from '@/lib/types/agent';
import { AuditEvent } from '@/lib/types/audit';
import { RiskBadge, StatusBadge } from '@/components/ui/Badges';
import { Cpu, ArrowLeft, Ban, PlayCircle, Key, Network, ScrollText, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { formatTimestamp } from '@/lib/utils';
import { useToast } from '@/context/ToastContext';

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const { showToast } = useToast();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [activity, setActivity] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal toggle states
  const [modalType, setModalType] = useState<'freeze' | 'unfreeze' | 'rotate' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [agentRes, auditRes] = await Promise.all([
        fetch(`/api/ai-agents/${id}`),
        fetch('/api/audit'),
      ]);

      if (!agentRes.ok) {
        const errJson = await agentRes.json().catch(() => ({}));
        setError(errJson.error || 'AI Agent record not found.');
        setAgent(null);
      } else {
        const agentJson = await agentRes.json();
        if (agentJson.success && agentJson.data) {
          setAgent(agentJson.data);
        } else {
          setError(agentJson.error || 'AI Agent record not found.');
          setAgent(null);
        }
      }

      if (auditRes.ok) {
        const auditJson = await auditRes.json();
        if (auditJson.success && Array.isArray(auditJson.data)) {
          const agentLogs = (auditJson.data as AuditEvent[]).filter(
            (log) => log.actorId === id || log.resource?.includes(id) || (log.metadata as Record<string, unknown>)?.entityId === id
          );
          setActivity(agentLogs.slice(0, 20));
        }
      }
    } catch (err: unknown) {
      console.error('Error loading AI agent details:', err);
      setError('Unable to load AI agent telemetry from control plane.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    requestAnimationFrame(() => {
      loadData();
    });
  }, [loadData]);

  const handleFreeze = async () => {
    if (!agent) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/ai-agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'freeze' }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setAgent(json.data);
        showToast('Agent frozen and isolated successfully.', 'success');
      } else {
        showToast(json.error || 'Failed to freeze AI agent.', 'error');
      }
    } catch (err) {
      console.error('Error freezing agent:', err);
      showToast('Failed to freeze AI agent.', 'error');
    } finally {
      setIsSubmitting(false);
      setModalType(null);
      loadData();
    }
  };

  const handleUnfreeze = async () => {
    if (!agent) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/ai-agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unfreeze' }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setAgent(json.data);
        showToast('Agent reactivated successfully.', 'success');
      } else {
        showToast(json.error || 'Failed to reactivate AI agent.', 'error');
      }
    } catch (err) {
      console.error('Error reactivating agent:', err);
      showToast('Failed to reactivate AI agent.', 'error');
    } finally {
      setIsSubmitting(false);
      setModalType(null);
      loadData();
    }
  };

  const handleRotate = async () => {
    if (!agent) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/ai-agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rotate' }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        showToast('Agent API key rotated successfully.', 'success');
      } else {
        showToast(json.error || 'Failed to rotate token.', 'error');
      }
    } catch (err) {
      console.error('Error rotating agent token:', err);
      showToast('Failed to rotate token.', 'error');
    } finally {
      setIsSubmitting(false);
      setModalType(null);
      loadData();
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6 text-center text-xs text-muted">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-500 mb-2" />
        <span>Loading agent details from control plane...</span>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6 text-center text-xs text-secondary">
        <div>
          <Link href="/agents" className="text-xs text-muted hover:text-white flex items-center gap-1.5 transition-colors mb-6 inline-flex">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to AI Agents catalog
          </Link>
        </div>
        <div className="bg-surface border border-border rounded-[12px] p-8 max-w-md mx-auto space-y-4">
          <p className="text-sm font-semibold text-white">{error || 'AI Agent record not found.'}</p>
          <button
            onClick={() => loadData()}
            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-4 py-2 rounded-[6px] transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 pb-20 max-w-7xl mx-auto space-y-6 relative text-primary-text">
      
      {/* Back button */}
      <div>
        <Link href="/agents" className="text-xs text-muted hover:text-white flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to AI Agents catalog
        </Link>
      </div>

      {/* Header Info */}
      <div className="bg-surface border border-border rounded-[12px] p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:border-border/80 transition-colors animate-slide-up">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-white leading-none">{agent.name}</h2>
            <StatusBadge status={agent.status} />
          </div>
          <p className="text-xs text-secondary max-w-xl">{agent.purpose}</p>
          <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-muted">
            <span>Model: <strong className="text-white font-medium">{agent.model}</strong></span>
            <span>Env: <strong className="text-white font-medium">{agent.environment}</strong></span>
            <span>Owner: <strong className="text-white font-medium">{agent.owner}</strong></span>
            <span>Active check: <strong className="text-white font-medium">{formatTimestamp(agent.lastActive)}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch md:self-auto justify-end border-t md:border-t-0 border-border pt-4 md:pt-0">
          <div className="text-right">
            <span className="text-[10px] text-muted block uppercase font-bold tracking-wider">Dynamic Risk Score</span>
            <div className="flex items-baseline justify-end gap-1.5 mt-0.5">
              <RiskBadge score={agent.status === 'Suspended' ? 0 : agent.riskScore} className="text-sm font-bold px-3 py-1" />
              <span className="text-[10px] text-muted">/ 100</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Risk breakdown */}
        <div className="bg-surface border border-border rounded-[12px] p-6 lg:col-span-2 space-y-6 hover:border-border/80 transition-colors animate-slide-up">
          <div className="border-b border-border pb-4 flex justify-between items-center">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider block">Risk Analysis Vectors</h3>
            <Cpu className="w-4 h-4 text-purple-400" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            <div className="bg-bg-mid border border-border rounded-[8px] p-3 text-center">
              <span className="text-[9px] text-muted font-bold uppercase tracking-wider block">Permission Risk</span>
              <span className="text-lg font-bold text-white font-mono mt-1.5 block">
                {agent.status === 'Suspended' ? 0 : agent.riskBreakdown.permissionRisk}%
              </span>
            </div>

            <div className="bg-bg-mid border border-border rounded-[8px] p-3 text-center">
              <span className="text-[9px] text-muted font-bold uppercase tracking-wider block">Behavior Risk</span>
              <span className="text-lg font-bold text-white font-mono mt-1.5 block">
                {agent.status === 'Suspended' ? 0 : agent.riskBreakdown.behaviorRisk}%
              </span>
            </div>

            <div className="bg-bg-mid border border-border rounded-[8px] p-3 text-center">
              <span className="text-[9px] text-muted font-bold uppercase tracking-wider block">Credential Risk</span>
              <span className="text-lg font-bold text-white font-mono mt-1.5 block">
                {agent.status === 'Suspended' ? 0 : agent.riskBreakdown.credentialRisk}%
              </span>
            </div>

            <div className="bg-bg-mid border border-border rounded-[8px] p-3 text-center">
              <span className="text-[9px] text-muted font-bold uppercase tracking-wider block">Exposure Risk</span>
              <span className="text-lg font-bold text-white font-mono mt-1.5 block">
                {agent.status === 'Suspended' ? 0 : agent.riskBreakdown.exposureRisk}%
              </span>
            </div>

          </div>

          {/* Capabilities registry */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-white">Capabilities Scope & Action Permissions</h4>
            
            {agent.capabilities.length === 0 ? (
              <p className="text-xs text-muted bg-bg-mid p-3 rounded-[6px] border border-border">
                No explicit capability permissions configured for this agent catalog.
              </p>
            ) : (
              <div className="divide-y divide-border border border-border rounded-[8px] overflow-hidden bg-bg-mid">
                {agent.capabilities.map((cap) => (
                  <div key={cap.id} className="p-3 text-xs flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white truncate">{cap.capability}</span>
                        <span className="text-[10px] font-mono text-muted truncate">on {cap.resource}</span>
                      </div>
                      <p className="text-[10px] text-muted mt-1 leading-relaxed">{cap.reason}</p>
                    </div>
                    
                    <div className="flex items-center gap-3 self-end sm:self-auto justify-end shrink-0">
                      <span className="px-2 py-0.5 rounded-[4px] bg-surface-top text-secondary text-[9px] font-mono border border-border shrink-0">
                        {cap.accessLevel}
                      </span>
                      <StatusBadge status={agent.status === 'Suspended' && cap.decision === 'ALLOWED' ? 'BLOCKED' : cap.decision} className="text-[9px]" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Governance Controls Panel */}
        <div className="bg-surface border border-border rounded-[12px] p-6 space-y-6 hover:border-border/80 transition-colors animate-slide-up">
          <div className="border-b border-border pb-4">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider block">Agent Controls</h3>
          </div>

          <div className="flex flex-col gap-3">
            
            {/* Freeze / Reactivate Agent */}
            {agent.status === 'Suspended' ? (
              <button 
                onClick={() => setModalType('unfreeze')}
                className="bg-[#10B981] hover:bg-[#0D9668] text-[#07070B] font-semibold text-xs py-2 px-3 rounded-[6px] transition-colors flex items-center justify-center gap-2 cursor-pointer h-10"
              >
                <PlayCircle className="w-4 h-4" />
                <span>Re-Activate Agent</span>
              </button>
            ) : (
              <button 
                onClick={() => setModalType('freeze')}
                className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold text-xs py-2 px-3 rounded-[6px] transition-colors flex items-center justify-center gap-2 cursor-pointer h-10"
              >
                <Ban className="w-4 h-4" />
                <span>Freeze Agent</span>
              </button>
            )}

            {/* Rotate Keys */}
            <button 
              onClick={() => setModalType('rotate')}
              className="bg-surface-top hover:bg-surface-mid border border-border text-primary-text font-semibold text-xs py-2 px-3 rounded-[6px] transition-all flex items-center justify-center gap-2 cursor-pointer h-10"
            >
              <Key className="w-4 h-4 text-secondary" />
              <span>Rotate Access Token</span>
            </button>

          </div>

          <div className="space-y-3">
            <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Connected Systems</span>
            <div className="flex flex-col gap-2">
              {agent.connectedSystems.map((sys) => (
                <div key={sys} className="flex items-center gap-2 text-xs text-secondary">
                  <Network className="w-3.5 h-3.5 text-muted shrink-0" />
                  <span>{sys}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Security Evaluation Timeline Interface */}
      <div className="bg-surface border border-border rounded-[12px] p-6 space-y-6 hover:border-border/80 transition-colors animate-slide-up">
        <div className="border-b border-border pb-4 flex justify-between items-center">
          <div>
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider block">Security Evaluation Timeline</h3>
            <p className="text-[10px] text-muted mt-0.5">Policy decision audit sequence for recent actions</p>
          </div>
          <ScrollText className="w-4 h-4 text-purple-400" />
        </div>

        {/* Visual vertical timeline from real audit logs */}
        <div className="relative pl-6 space-y-6 border-l border-border ml-3 pt-2 pb-2">
          {activity.length === 0 ? (
            <p className="text-xs text-muted">No recent policy engine activity recorded for this agent.</p>
          ) : (
            activity.map((event) => {
              const isBlocked = event.decision === 'BLOCKED';
              const dotColor = isBlocked ? 'bg-critical-text border-critical-text ring-4 ring-critical-text/10' : 'bg-healthy-text border-healthy-text ring-4 ring-healthy-text/10';

              return (
                <div key={event.id} className="relative space-y-1">
                  <span className={`absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border-2 ${dotColor}`} />
                  
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted font-mono">{formatTimestamp(event.timestamp)}</span>
                    <h4 className="text-xs font-bold text-white leading-none">{event.action}</h4>
                  </div>
                  <p className="text-xs text-secondary leading-relaxed max-w-3xl">{event.reason || event.resource}</p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Confirmation Modals */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !isSubmitting && setModalType(null)}
          />
          
          <div className="relative bg-surface border border-border max-w-md w-full rounded-[12px] p-6 space-y-4 shadow-2xl animate-scale-up">
            
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="text-sm font-bold text-white capitalize">
                {modalType === 'freeze' ? 'Freeze Agent?' : 
                 modalType === 'unfreeze' ? 'Re-Activate Agent?' : 'Rotate Access Token?'}
              </h3>
            </div>

            <p className="text-xs text-secondary leading-relaxed">
              {modalType === 'freeze' && `This will immediately restrict the Agent "${agent.name}" from calling any connected resource tools. Policy engine decisions will evaluate to BLOCKED.`}
              {modalType === 'unfreeze' && `This will restore Agent "${agent.name}" to Active operations and resume security monitoring.`}
              {modalType === 'rotate' && `This will rotate the API connection token. Update the agent configuration settings in the orchestration layer to prevent downtime.`}
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
                onClick={
                  modalType === 'freeze' ? handleFreeze : 
                  modalType === 'unfreeze' ? handleUnfreeze : handleRotate
                }
                className={`font-semibold text-xs px-4 py-2 rounded-[6px] text-white flex items-center gap-1.5 transition-colors cursor-pointer ${
                  modalType === 'freeze'
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-purple-600 hover:bg-purple-500'
                }`}
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
                <span>
                  {modalType === 'freeze' ? 'Freeze Agent' : 
                   modalType === 'unfreeze' ? 'Activate Agent' : 'Rotate Token'}
                </span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
