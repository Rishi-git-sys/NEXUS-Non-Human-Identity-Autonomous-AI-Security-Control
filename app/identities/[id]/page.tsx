'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { identityService } from '@/lib/services/identityService';
import { Identity } from '@/lib/types/identity';
import { AuditEvent } from '@/lib/types/audit';
import { RiskBadge, StatusBadge } from '@/components/ui/Badges';
import { Shield, ShieldAlert, Key, Ban, UserCheck, AlertTriangle, ArrowLeft, Clock, Activity, Lock, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { formatTimestamp } from '@/lib/utils';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase/client';

export default function IdentityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const { user } = useAuth();
  const { showToast } = useToast();

  const [identity, setIdentity] = useState<Identity | null>(null);
  const [activity, setActivity] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [modalType, setModalType] = useState<'disable' | 'enable' | 'rotate' | 'revoke' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load identity and activity log data from Supabase
  const loadData = useCallback(async () => {
    if (!user?.organization_id || !id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await identityService.getIdentityById(user.organization_id, id);
      if (!data) {
        setError('Identity record not found.');
        setIdentity(null);
      } else {
        setIdentity(data);

        // Fetch audit logs related to this identity from Supabase
        const { data: logsData } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('organization_id', user.organization_id)
          .or(`actor_id.eq.${id},entity_id.eq.${id}`)
          .order('created_at', { ascending: false })
          .limit(20);

        if (logsData) {
          const mappedEvents: AuditEvent[] = logsData.map(log => {
            const meta = (typeof log.metadata === 'object' && log.metadata !== null) ? log.metadata as Record<string, unknown> : {};
            return {
              id: log.id,
              timestamp: log.created_at,
              actor: (meta.actor as string) || log.actor_id || 'System Operator',
              actorId: log.actor_id || '',
              action: log.action,
              resource: (meta.resource as string) || log.entity_type || 'identity',
              environment: (meta.environment as string) || 'Production',
              decision: (meta.decision as AuditEvent['decision']) || 'ALLOWED',
              riskScore: typeof meta.riskScore === 'number' ? meta.riskScore : 10,
              ipAddress: (meta.ipAddress as string) || '127.0.0.1',
              reason: (meta.reason as string) || 'Security policy evaluation.',
            };
          });
          setActivity(mappedEvents);
        }
      }
    } catch (err: unknown) {
      console.error('Error fetching identity detail:', err);
      setError('Unable to load identity details from database.');
    } finally {
      setIsLoading(false);
    }
  }, [user, id]);

  useEffect(() => {
    if (user?.organization_id) {
      requestAnimationFrame(() => {
        loadData();
      });
    } else if (!user) {
      requestAnimationFrame(() => {
        setIsLoading(false);
      });
    }
  }, [user, loadData]);

  // Operations connecting to Supabase
  const handleDisable = async () => {
    if (!identity || !user?.organization_id) return;
    setIsSubmitting(true);

    try {
      const res = await identityService.disableIdentity(user.organization_id, identity.id);
      if (res.success && res.identity) {
        setIdentity(res.identity);
        
        await supabase.from('audit_logs').insert({
          organization_id: user.organization_id,
          actor_id: user.id,
          action: 'DISABLE_IDENTITY',
          entity_type: 'identity',
          entity_id: identity.id,
          metadata: {
            actor: user.full_name || 'System Operator',
            resource: `identity/${identity.id}`,
            environment: identity.environment,
            decision: 'ALLOWED',
            riskScore: 0,
            reason: `Identity "${identity.name}" has been disabled/suspended by operator request.`,
          },
        });

        showToast('Identity disabled successfully.', 'success');
      } else {
        showToast(res.message, 'error');
      }
    } catch (err) {
      console.error('Failed to disable identity:', err);
      showToast('Error updating identity state.', 'error');
    } finally {
      setIsSubmitting(false);
      setModalType(null);
      loadData();
    }
  };

  const handleEnable = async () => {
    if (!identity || !user?.organization_id) return;
    setIsSubmitting(true);

    try {
      const res = await identityService.enableIdentity(user.organization_id, identity.id);
      if (res.success && res.identity) {
        setIdentity(res.identity);
        
        await supabase.from('audit_logs').insert({
          organization_id: user.organization_id,
          actor_id: user.id,
          action: 'ENABLE_IDENTITY',
          entity_type: 'identity',
          entity_id: identity.id,
          metadata: {
            actor: user.full_name || 'System Operator',
            resource: `identity/${identity.id}`,
            environment: identity.environment,
            decision: 'ALLOWED',
            riskScore: 10,
            reason: `Identity "${identity.name}" has been re-enabled and restored to active state.`,
          },
        });

        showToast('Identity re-enabled successfully.', 'success');
      } else {
        showToast(res.message, 'error');
      }
    } catch (err) {
      console.error('Failed to enable identity:', err);
      showToast('Error updating identity state.', 'error');
    } finally {
      setIsSubmitting(false);
      setModalType(null);
      loadData();
    }
  };

  const handleRotate = async () => {
    if (!identity || !user?.organization_id) return;
    setIsSubmitting(true);

    try {
      const res = await identityService.rotateCredential(user.organization_id, identity.id);
      if (res.success && res.identity) {
        setIdentity(res.identity);
        
        await supabase.from('audit_logs').insert({
          organization_id: user.organization_id,
          actor_id: user.id,
          action: 'ROTATE_CREDENTIALS',
          entity_type: 'identity',
          entity_id: identity.id,
          metadata: {
            actor: user.full_name || 'System Operator',
            resource: `credentials/${identity.id}`,
            environment: identity.environment,
            decision: 'ALLOWED',
            riskScore: 10,
            reason: `Credentials for identity "${identity.name}" rotated. CredentialAgeDays reset to 0.`,
          },
        });

        showToast('Credentials rotated successfully.', 'success');
      } else {
        showToast(res.message, 'error');
      }
    } catch (err) {
      console.error('Failed to rotate credentials:', err);
      showToast('Error rotating credentials.', 'error');
    } finally {
      setIsSubmitting(false);
      setModalType(null);
      loadData();
    }
  };

  const handleRevoke = async () => {
    if (!identity || !user?.organization_id) return;
    setIsSubmitting(true);

    try {
      const res = await identityService.revokeAccess(user.organization_id, identity.id);
      if (res.success && res.identity) {
        setIdentity(res.identity);
        
        await supabase.from('audit_logs').insert({
          organization_id: user.organization_id,
          actor_id: user.id,
          action: 'REVOKE_ACCESS',
          entity_type: 'identity',
          entity_id: identity.id,
          metadata: {
            actor: user.full_name || 'System Operator',
            resource: `permissions/${identity.id}`,
            environment: identity.environment,
            decision: 'ALLOWED',
            riskScore: 0,
            reason: `Permissions and cloud access for identity "${identity.name}" have been revoked.`,
          },
        });

        showToast('Access permissions revoked successfully.', 'success');
      } else {
        showToast(res.message, 'error');
      }
    } catch (err) {
      console.error('Failed to revoke access:', err);
      showToast('Error revoking permissions.', 'error');
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
        <span>Loading identity profiles from control plane...</span>
      </div>
    );
  }

  if (error || !identity) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6 text-center text-xs text-secondary">
        <div>
          <Link href="/identities" className="text-xs text-muted hover:text-white flex items-center gap-1.5 transition-colors mb-6 inline-flex">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Identities catalog
          </Link>
        </div>
        <div className="bg-surface border border-border rounded-[12px] p-8 max-w-md mx-auto space-y-4">
          <p className="text-sm font-semibold text-white">{error || 'Identity record not found.'}</p>
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
        <Link href="/identities" className="text-xs text-muted hover:text-white flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Identities catalog
        </Link>
      </div>

      {/* Profile Overview Header Card */}
      <div className="bg-surface border border-border rounded-[12px] p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:border-border/80 transition-colors animate-slide-up">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-white leading-none">{identity.name}</h2>
            <StatusBadge status={identity.status} />
          </div>
          <p className="text-xs font-mono text-muted">{identity.id}</p>
          <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-secondary">
            <span>Type: <strong className="text-white font-medium">{identity.type}</strong></span>
            <span>Provider: <strong className="text-white font-medium">{identity.provider}</strong></span>
            <span>Env: <strong className="text-white font-medium">{identity.environment}</strong></span>
            <span>Owner: <strong className="text-white font-medium">{identity.owner}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch md:self-auto justify-end border-t md:border-t-0 border-border pt-4 md:pt-0">
          <div className="text-right">
            <span className="text-[10px] text-muted block uppercase font-bold tracking-wider">Dynamic Risk Score</span>
            <div className="flex items-baseline justify-end gap-1.5 mt-0.5">
              <RiskBadge score={identity.status === 'Disabled' ? 0 : identity.riskScore} className="text-sm font-bold px-3 py-1" />
              <span className="text-[10px] text-muted">/ 100</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Risk Analysis Card */}
        <div className="bg-surface border border-border rounded-[12px] p-6 lg:col-span-2 space-y-6 hover:border-border/80 transition-colors animate-slide-up">
          <div className="border-b border-border pb-4 flex justify-between items-center">
            <h3 className="text-white text-xs font-bold uppercase tracking-wider">Security & Risk Analysis</h3>
            <Shield className="w-4 h-4 text-purple-400" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div className="bg-bg-mid border border-border rounded-[8px] p-4 flex flex-col justify-between">
              <span className="text-[9px] text-muted font-bold uppercase tracking-wider block">Credential Age</span>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-lg font-bold text-white font-mono">{identity.credentialAgeDays}d</span>
                <Clock className="w-4 h-4 text-secondary" />
              </div>
              <span className="text-[9px] text-muted mt-1">Recommended rotation: 90 days</span>
            </div>

            <div className="bg-bg-mid border border-border rounded-[8px] p-4 flex flex-col justify-between">
              <span className="text-[9px] text-muted font-bold uppercase tracking-wider block">Access Breadth</span>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-lg font-bold text-white font-mono">{identity.accessBreadth}</span>
                <Lock className="w-4 h-4 text-secondary" />
              </div>
              <span className="text-[9px] text-muted mt-1">Resource access scopes</span>
            </div>

            <div className="bg-bg-mid border border-border rounded-[8px] p-4 flex flex-col justify-between">
              <span className="text-[9px] text-muted font-bold uppercase tracking-wider block">Credentials Active</span>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-lg font-bold text-white font-mono">{identity.credentialsCount}</span>
                <Key className="w-4 h-4 text-secondary" />
              </div>
              <span className="text-[9px] text-muted mt-1">Active cryptographic keys</span>
            </div>

          </div>

          {/* Risk Factors Bullet List */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-white">Risk Factors Analysis</h4>
            {identity.riskFactors.length === 0 || identity.status === 'Disabled' ? (
              <p className="text-xs text-healthy-text flex items-center gap-1.5 font-semibold">
                <Shield className="w-4 h-4 text-healthy-text" />
                Zero critical risk anomalies detected for this identity.
              </p>
            ) : (
              <ul className="space-y-3">
                {identity.riskFactors.map((factor, idx) => {
                  const isString = typeof factor === 'string';
                  const title = isString ? factor : factor.title;
                  const description = isString ? null : factor.description;
                  const severity = isString ? 'HIGH' : factor.severity;
                  
                  return (
                    <li key={idx} className="bg-bg-mid border border-border rounded-[8px] p-3 flex items-start gap-3">
                      <ShieldAlert className={`w-4 h-4 shrink-0 mt-0.5 ${severity === 'CRITICAL' ? 'text-critical-text' : severity === 'HIGH' ? 'text-warning-text' : severity === 'MEDIUM' ? 'text-purple-400' : 'text-secondary'}`} />
                      <div className="space-y-1 w-full">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white">{title}</span>
                          {!isString && (
                            <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                              severity === 'CRITICAL' ? 'bg-critical-bg text-critical-text border-critical-border' :
                              severity === 'HIGH' ? 'bg-warning-bg text-warning-text border-warning-border' :
                              severity === 'MEDIUM' ? 'bg-purple-900/30 text-purple-400 border-purple-500/30' :
                              'bg-surface-top text-secondary border-border'
                            }`}>
                              {severity}
                            </span>
                          )}
                        </div>
                        {description && <p className="text-[11px] text-secondary leading-relaxed">{description}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Action Panel Card */}
        <div className="bg-surface border border-border rounded-[12px] p-6 space-y-6 hover:border-border/80 transition-colors animate-slide-up">
          <div className="border-b border-border pb-4">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider block">Security Actions Panel</h3>
          </div>

          <div className="flex flex-col gap-3">
            
            {/* Disable/Enable Identity Button */}
            {identity.status === 'Disabled' ? (
              <button 
                onClick={() => setModalType('enable')}
                className="bg-[#10B981] hover:bg-[#0D9668] active:bg-[#0A7550] text-[#07070B] font-semibold text-xs py-2 px-3 rounded-[6px] transition-colors flex items-center justify-center gap-2 cursor-pointer h-10"
              >
                <UserCheck className="w-4 h-4" />
                <span>Re-Enable Identity</span>
              </button>
            ) : (
              <button 
                onClick={() => setModalType('disable')}
                className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold text-xs py-2 px-3 rounded-[6px] transition-all flex items-center justify-center gap-2 cursor-pointer h-10"
              >
                <Ban className="w-4 h-4" />
                <span>Disable Identity</span>
              </button>
            )}

            {/* Rotate Credentials Button */}
            <button 
              onClick={() => setModalType('rotate')}
              className="bg-surface-top hover:bg-surface-mid border border-border text-primary-text font-semibold text-xs py-2 px-3 rounded-[6px] transition-all flex items-center justify-center gap-2 cursor-pointer h-10"
            >
              <Key className="w-4 h-4 text-secondary" />
              <span>Rotate Credentials</span>
            </button>

            {/* Revoke Access Button */}
            <button 
              onClick={() => setModalType('revoke')}
              className="bg-surface-top hover:bg-red-500/10 hover:border-red-500/25 border border-border text-red-400 font-semibold text-xs py-2 px-3 rounded-[6px] transition-all flex items-center justify-center gap-2 cursor-pointer h-10"
            >
              <Lock className="w-4 h-4 text-red-400/60" />
              <span>Revoke Permissions</span>
            </button>

          </div>

          <div className="bg-bg-mid border border-border rounded-[6px] p-4 text-[10px] text-muted space-y-2">
            <span className="font-bold text-secondary block">SYSTEM LOG NOTE</span>
            <p>Actions performed are tracked in the immutable audit log. Disabling or rotating credentials will trigger recalculation of the actor risk score within 5 seconds.</p>
          </div>
        </div>

      </div>

      {/* Connected Access & Recent Activity Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* AWS Information Block */}
          {/* AWS Information Block */}
          {(() => {
            const isAWSIAMIdentity = String(identity.provider || '').toLowerCase() === 'aws' && typeof identity.arn === 'string' && identity.arn.startsWith('arn:aws:iam::');
            if (!isAWSIAMIdentity) return null;
            return (
              <div className="bg-surface border border-border rounded-[12px] p-6 space-y-4 hover:border-border/80 transition-colors animate-slide-up">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider block">AWS Information</h3>
                <div className="space-y-3">
                  <div className="bg-bg-mid p-3 rounded-[6px] border border-border">
                    <span className="text-[9px] text-muted uppercase font-bold tracking-wider block mb-1">AWS Identity Type</span>
                    <span className="font-semibold text-white text-xs">{identity.awsType || (identity.type === 'IAM Role' ? 'IAM Role' : 'IAM User')}</span>
                  </div>
                  <div className="bg-bg-mid p-3 rounded-[6px] border border-border">
                    <span className="text-[9px] text-muted uppercase font-bold tracking-wider block mb-1">Amazon Resource Name (ARN)</span>
                    <span className="font-mono text-purple-400 text-[10px] break-all select-all">{identity.arn}</span>
                  </div>
                  {identity.awsPath && (
                    <div className="bg-bg-mid p-3 rounded-[6px] border border-border">
                      <span className="text-[9px] text-muted uppercase font-bold tracking-wider block mb-1">Path</span>
                      <span className="font-mono text-white text-[10px]">{identity.awsPath}</span>
                    </div>
                  )}
                  
                  {/* Phase 4 AWS Security Intelligence */}
                  {identity.awsSecurity && (
                    <div className="mt-4 pt-4 border-t border-border space-y-4">
                      <h4 className="text-[11px] font-bold text-orange-400 uppercase tracking-wider block">AWS Security Intelligence</h4>
                      
                      {/* Credential Security */}
                      {identity.awsType !== 'IAM Role' && (
                        <div className="bg-bg-mid border border-border p-3 rounded-[6px]">
                          <span className="text-[9px] text-muted uppercase font-bold tracking-wider block mb-2">Credential Security</span>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex justify-between items-center text-secondary">
                              <span>Total Keys:</span>
                              <span className="text-white font-semibold">{identity.awsSecurity.accessKeys?.length || 0}</span>
                            </div>
                            <div className="flex justify-between items-center text-secondary">
                              <span>Active:</span>
                              <span className="text-white font-semibold">{identity.awsSecurity.accessKeys?.filter(k => k.status === 'Active').length || 0}</span>
                            </div>
                            <div className="flex justify-between items-center text-secondary">
                              <span>Inactive:</span>
                              <span className="text-white font-semibold">{identity.awsSecurity.accessKeys?.filter(k => k.status === 'Inactive').length || 0}</span>
                            </div>
                            <div className="flex justify-between items-center text-secondary">
                              <span>Oldest (Days):</span>
                              <span className={identity.awsSecurity.accessKeys?.some(k => k.ageDays > 90) ? 'text-warning-text font-bold' : 'text-white font-semibold'}>
                                {identity.awsSecurity.accessKeys?.length ? Math.max(...identity.awsSecurity.accessKeys.map(k => k.ageDays)) : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Permission Security */}
                      <div className="bg-bg-mid border border-border p-3 rounded-[6px]">
                        <span className="text-[9px] text-muted uppercase font-bold tracking-wider block mb-2">Permission Security</span>
                        <div className="grid grid-cols-1 gap-2 text-xs">
                          <div className="flex justify-between items-center text-secondary">
                            <span>Managed Policies:</span>
                            <span className="text-white font-semibold">{identity.awsSecurity.policies?.filter(p => p.source === 'managed').length || 0}</span>
                          </div>
                          <div className="flex justify-between items-center text-secondary">
                            <span>Inline Policies:</span>
                            <span className="text-white font-semibold">{identity.awsSecurity.policies?.filter(p => p.source === 'inline').length || 0}</span>
                          </div>
                          <div className="flex justify-between items-center text-secondary">
                            <span>Admin Access:</span>
                            <span className={identity.awsSecurity.privilegeSummary?.administrator ? 'text-critical-text font-bold' : 'text-white font-semibold'}>
                              {identity.awsSecurity.privilegeSummary?.administrator ? 'YES' : 'NO'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-secondary">
                            <span>Wildcard Actions:</span>
                            <span className={identity.awsSecurity.privilegeSummary?.wildcardActions ? 'text-warning-text font-bold' : 'text-white font-semibold'}>
                              {identity.awsSecurity.privilegeSummary?.wildcardActions ? 'YES' : 'NO'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-secondary">
                            <span>Wildcard Resources:</span>
                            <span className={identity.awsSecurity.privilegeSummary?.wildcardResources ? 'text-warning-text font-bold' : 'text-white font-semibold'}>
                              {identity.awsSecurity.privilegeSummary?.wildcardResources ? 'YES' : 'NO'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-bg-mid p-3 rounded-[6px] border border-border">
                      <span className="text-[9px] text-muted uppercase font-bold tracking-wider block mb-1">Risk Score</span>
                      <span className="font-bold text-white text-xs">{identity.riskScore}</span>
                    </div>
                    <div className="bg-bg-mid p-3 rounded-[6px] border border-border">
                      <span className="text-[9px] text-muted uppercase font-bold tracking-wider block mb-1">Severity</span>
                      <span className={`text-xs font-bold ${identity.riskScore >= 75 ? 'text-critical-text' : identity.riskScore >= 50 ? 'text-warning-text' : 'text-purple-400'}`}>
                        {identity.riskScore >= 75 ? 'CRITICAL' : identity.riskScore >= 50 ? 'HIGH' : identity.riskScore >= 25 ? 'MEDIUM' : 'LOW'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Connected Permissions & Systems */}
          <div className="bg-surface border border-border rounded-[12px] p-6 space-y-4 hover:border-border/80 transition-colors animate-slide-up">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider block">Connected Access</h3>
          
          <div className="space-y-4">
            
            <div className="space-y-2">
              <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Authorizations</span>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs p-2.5 bg-bg-mid border border-border rounded-[6px]">
                  <span className="font-semibold text-white">AWS S3 Write</span>
                  <span className="text-healthy-text font-semibold uppercase text-[9px]">ALLOWED</span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 bg-bg-mid border border-border rounded-[6px]">
                  <span className="font-semibold text-white">ECR Image Push</span>
                  <span className="text-healthy-text font-semibold uppercase text-[9px]">ALLOWED</span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 bg-bg-mid border border-border rounded-[6px]">
                  <span className="font-semibold text-white">AWS IAM Mutate</span>
                  <span className="text-warning-text font-semibold uppercase text-[9px]">REVIEW</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Target Resources</span>
              <div className="flex flex-wrap gap-1.5">
                {['s3-prod-assets', 'github-repo', 'aws-prod-eks', 'stripe-billing'].map((tag) => (
                  <span key={tag} className="text-[9px] font-mono px-2 py-0.5 rounded-[4px] bg-surface-top text-secondary border border-border font-semibold">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

          </div>
        </div>
        </div>

        {/* Recent Activity Timeline */}
        <div className="bg-surface border border-border rounded-[12px] p-6 lg:col-span-2 space-y-4 hover:border-border/80 transition-colors animate-slide-up">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider block">Recent Activity Timeline</h3>
            <Activity className="w-4 h-4 text-muted" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-primary-text border-collapse">
              <thead className="text-[10px] text-muted uppercase tracking-wider border-b border-border bg-surface-mid/30">
                <tr>
                  <th className="px-4 py-2 font-semibold">Timestamp</th>
                  <th className="px-4 py-2 font-semibold">Action</th>
                  <th className="px-4 py-2 font-semibold">Resource</th>
                  <th className="px-4 py-2 font-semibold text-right">Decision</th>
                </tr>
              </thead>
              <tbody>
                {activity.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted">
                      No recorded telemetry for this identity.
                    </td>
                  </tr>
                ) : (
                  activity.map((event) => (
                    <tr key={event.id} className="border-b border-border hover:bg-surface-mid/20 transition-colors">
                      <td className="px-4 py-3 text-secondary">{formatTimestamp(event.timestamp)}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-xs text-white">{event.action}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-secondary">{event.resource}</td>
                      <td className="px-4 py-3 text-right">
                        <StatusBadge status={event.decision} className="text-[9px]" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Confirmation Modals */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !isSubmitting && setModalType(null)}
          />
          
          <div className="relative bg-surface border border-border max-w-md w-full rounded-[12px] p-6 space-y-4 shadow-2xl animate-scale-up z-10">
            
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="text-sm font-bold text-white capitalize">
                {modalType === 'disable' ? 'Disable Identity?' : 
                 modalType === 'enable' ? 'Enable Identity?' :
                 modalType === 'rotate' ? 'Rotate Credentials?' : 'Revoke Permissions?'}
              </h3>
            </div>

            <p className="text-xs text-secondary leading-relaxed">
              {modalType === 'disable' && `This will temporarily freeze "${identity.name}" credentials and deny all API actions. You can re-enable this identity later.`}
              {modalType === 'enable' && `This will restore "${identity.name}" to Active status and resume security monitoring.`}
              {modalType === 'rotate' && `This will rotate access secrets for "${identity.name}" immediately. Connected services must be updated with the rotated token.`}
              {modalType === 'revoke' && `This will completely revoke cloud access privileges. It sets the scope configuration to low risk.`}
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
                  modalType === 'disable' ? handleDisable : 
                  modalType === 'enable' ? handleEnable :
                  modalType === 'rotate' ? handleRotate : handleRevoke
                }
                className={`font-semibold text-xs px-4 py-2 rounded-[6px] text-white flex items-center gap-1.5 transition-colors cursor-pointer ${
                  modalType === 'disable' || modalType === 'revoke'
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-purple-600 hover:bg-purple-500'
                }`}
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
                <span>
                  {modalType === 'disable' ? 'Disable Identity' : 
                   modalType === 'enable' ? 'Enable Identity' :
                   modalType === 'rotate' ? 'Rotate Credentials' : 'Revoke Access'}
                </span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
