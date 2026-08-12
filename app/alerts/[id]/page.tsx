'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Alert } from '@/lib/types/alert';
import { RiskBadge, StatusBadge } from '@/components/ui/Badges';
import { formatTimestamp } from '@/lib/utils';
import { 
  ArrowLeft, ShieldAlert, Cpu, Key, 
  CheckCircle, Server, Activity, ShieldCheck, XCircle, AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/context/ToastContext';

export default function AlertDetailPage() {
  const params = useParams();
  const router = useRouter();
  const alertId = params.id as string;
  
  const { user } = useAuth();
  const { showToast } = useToast();

  const [alert, setAlert] = useState<Alert | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAlert() {
      if (!user?.organization_id || !alertId) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/alerts/${alertId}`);
        if (!res.ok) throw new Error('Failed to fetch alert details.');
        
        const json = await res.json();
        if (json.success && json.data) {
          setAlert(json.data);
        } else {
          throw new Error(json.error || 'Alert not found.');
        }
      } catch (err: unknown) {
        console.error(err);
        setError('Failed to load alert details.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchAlert();
  }, [user, alertId]);

  const handleUpdateStatus = async (status: Alert['status']) => {
    try {
      const res = await fetch(`/api/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      
      if (res.ok && json.success) {
        showToast(`Alert marked as ${status}.`, 'success');
        setAlert(json.data);
      } else {
        showToast(json.error || 'Failed to update status.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to update alert status.', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin text-purple-500"><Activity className="w-8 h-8" /></div>
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        <button onClick={() => router.back()} className="text-muted hover:text-white flex items-center gap-2 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-red-500/10 border border-red-500/20 rounded-[12px] p-6 text-center space-y-3">
           <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
           <p className="text-white font-medium">{error || 'Alert not found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 pb-20 max-w-5xl mx-auto space-y-6 relative text-primary-text animate-slide-up">
      {/* Top Nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="text-muted hover:text-white flex items-center gap-2 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Alerts
        </button>
        
        {/* Status Actions */}
        <div className="flex items-center gap-2">
           {alert.status === 'Open' && (
             <button
               onClick={() => handleUpdateStatus('Acknowledged')}
               className="bg-surface-top hover:bg-surface-mid border border-border text-white text-xs font-semibold px-3 py-1.5 rounded-[6px] transition-colors"
             >
               Acknowledge
             </button>
           )}
           {(alert.status === 'Open' || alert.status === 'Acknowledged') && (
             <button
               onClick={() => handleUpdateStatus('Investigating')}
               className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3 py-1.5 rounded-[6px] transition-colors"
             >
               Investigate
             </button>
           )}
           {(alert.status === 'Open' || alert.status === 'Acknowledged' || alert.status === 'Investigating') && (
             <>
               <button
                 onClick={() => handleUpdateStatus('Resolved')}
                 className="bg-healthy-bg hover:bg-healthy-bg/25 border border-healthy-border text-healthy-text text-xs font-semibold px-3 py-1.5 rounded-[6px] transition-colors flex items-center gap-1.5"
               >
                 <CheckCircle className="w-3.5 h-3.5" /> Resolve
               </button>
               <button
                 onClick={() => handleUpdateStatus('Dismissed')}
                 className="bg-surface-top hover:bg-surface-mid border border-border text-secondary hover:text-white text-xs font-semibold px-3 py-1.5 rounded-[6px] transition-colors flex items-center gap-1.5"
               >
                 <XCircle className="w-3.5 h-3.5" /> Dismiss
               </button>
             </>
           )}
           {(alert.status === 'Resolved' || alert.status === 'Dismissed') && (
             <button
               onClick={() => handleUpdateStatus('Open')}
               className="bg-surface-top hover:bg-surface-mid border border-border text-white text-xs font-semibold px-3 py-1.5 rounded-[6px] transition-colors"
             >
               Re-Open
             </button>
           )}
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-surface border border-border rounded-[12px] overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-border space-y-4">
          <div className="flex flex-wrap items-center gap-3">
             <StatusBadge status={alert.status} />
             <span className={`w-2 h-2 rounded-full ${
               alert.severity === 'Critical' ? 'bg-critical-text' :
               alert.severity === 'High' ? 'bg-warning-text' : 'bg-info-text'
             }`} />
             <span className="text-xs font-bold uppercase tracking-wider text-muted">{alert.severity} SEVERITY</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">
             {alert.title}
          </h1>
          <p className="text-sm text-secondary leading-relaxed max-w-4xl">
             {alert.reason}
          </p>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
          
          <div className="p-6 space-y-6">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-4">Identity & Context</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-background border border-border p-3 rounded-[8px]">
                <div className="flex items-center gap-3">
                  {alert.agentId ? <Cpu className="w-5 h-5 text-purple-400" /> : <Key className="w-5 h-5 text-purple-400" />}
                  <div>
                    <div className="text-[10px] text-muted font-semibold uppercase">Actor</div>
                    <div className="text-sm font-mono text-white">{alert.actor}</div>
                  </div>
                </div>
                {alert.identityId && (
                  <Link href={`/identities/${alert.identityId}`} className="text-xs text-purple-400 hover:text-purple-300 transition-colors font-semibold">
                    View Identity &rarr;
                  </Link>
                )}
                {alert.agentId && (
                  <Link href={`/agents/${alert.agentId}`} className="text-xs text-purple-400 hover:text-purple-300 transition-colors font-semibold">
                    View Agent &rarr;
                  </Link>
                )}
              </div>

              <div className="flex justify-between items-center bg-background border border-border p-3 rounded-[8px]">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-secondary" />
                  <div>
                    <div className="text-[10px] text-muted font-semibold uppercase">Target Resource</div>
                    <div className="text-sm font-mono text-white">{alert.resource}</div>
                  </div>
                </div>
              </div>

              {alert.provider && (
                <div className="flex justify-between items-center bg-background border border-border p-3 rounded-[8px]">
                  <div>
                    <div className="text-[10px] text-muted font-semibold uppercase">Provider</div>
                    <div className="text-sm text-white">{alert.provider}</div>
                  </div>
                  {alert.awsType && (
                    <div className="text-right">
                      <div className="text-[10px] text-muted font-semibold uppercase">Type</div>
                      <div className="text-sm text-white">{alert.awsType}</div>
                    </div>
                  )}
                </div>
              )}

              {alert.arn && (
                <div className="bg-background border border-border p-3 rounded-[8px]">
                   <div className="text-[10px] text-muted font-semibold uppercase mb-1">AWS ARN</div>
                   <div className="text-xs font-mono text-secondary break-all">{alert.arn}</div>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 space-y-6">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-4">Risk & Remediation</h3>
            
            <div className="flex items-center gap-4 bg-background border border-border p-4 rounded-[8px]">
               <ShieldAlert className={`w-8 h-8 ${alert.riskScore && alert.riskScore >= 75 ? 'text-critical-text' : 'text-warning-text'}`} />
               <div>
                  <div className="text-[10px] text-muted font-semibold uppercase">Calculated Risk Score</div>
                  <div className="flex items-center gap-2">
                     <span className="text-2xl font-bold text-white">{alert.riskScore ?? 'N/A'}</span>
                     {alert.riskScore !== null && <RiskBadge score={alert.riskScore} className="text-xs px-2" />}
                  </div>
               </div>
            </div>

            <div className="bg-background border border-border rounded-[8px] p-4 space-y-2">
               <div className="flex items-center gap-2 text-muted">
                 <ShieldCheck className="w-4 h-4" />
                 <span className="text-xs font-bold uppercase tracking-wider">Recommended Action</span>
               </div>
               <p className="text-sm text-white leading-relaxed">
                 {alert.recommendation || (alert.severity === 'Critical' 
                   ? 'Immediately restrict actor API key permissions and freeze active execution model workflows.' 
                   : 'Monitor behavioral metrics closely or execute developer credentials rotation.')}
               </p>
            </div>
            
            <div className="bg-surface-top border border-border rounded-[8px] p-4 text-xs space-y-3">
               <div className="flex justify-between">
                 <span className="text-muted">Detected</span>
                 <span className="text-white font-mono">{formatTimestamp(alert.timestamp)}</span>
               </div>
               {alert.acknowledgedAt && (
                 <div className="flex justify-between">
                   <span className="text-muted">Acknowledged</span>
                   <span className="text-white font-mono">{formatTimestamp(alert.acknowledgedAt)}</span>
                 </div>
               )}
               {alert.resolvedAt && (
                 <div className="flex justify-between">
                   <span className="text-muted">Resolved</span>
                   <span className="text-white font-mono">{formatTimestamp(alert.resolvedAt)}</span>
                 </div>
               )}
            </div>
            
          </div>
        </div>

      </div>
    </div>
  );
}
