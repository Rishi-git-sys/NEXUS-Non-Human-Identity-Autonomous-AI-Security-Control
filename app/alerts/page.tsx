'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { alertService } from '@/lib/services/alertService';
import { Alert } from '@/lib/types/alert';
import { RiskBadge, StatusBadge } from '@/components/ui/Badges';
import { Search, Eye, Check, XCircle, Cpu, Key, RefreshCw, AlertCircle } from 'lucide-react';
import { formatTimestamp } from '@/lib/utils';
import Link from 'next/link';
import { useToast } from '@/context/ToastContext';

export default function AlertsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');

  const fetchAlerts = useCallback(async (isRefresh = false) => {
    if (!user?.organization_id) {
      setIsLoading(false);
      return;
    }

    if (!isRefresh) setIsLoading(true);
    setError(null);

    try {
      const data = await alertService.getAlerts(user.organization_id);
      setAlerts(data);
    } catch (err: unknown) {
      console.error('Error fetching alerts from control plane:', err);
      setError('Unable to load security alerts from control plane. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.organization_id) {
      requestAnimationFrame(() => {
        fetchAlerts();
      });
    } else if (!user) {
      requestAnimationFrame(() => {
        setIsLoading(false);
      });
    }
  }, [user, fetchAlerts]);

  const handleUpdateStatus = async (id: string, status: Alert['status']) => {
    if (!user?.organization_id) return;

    try {
      const res = await alertService.updateAlertStatus(
        user.organization_id,
        user.id,
        id,
        status
      );
      if (res.success) {
        showToast(`Alert marked as ${status}.`, 'success');
        await fetchAlerts(true);
      } else {
        showToast(res.message, 'error');
      }
    } catch (err) {
      console.error('Error updating alert status:', err);
      showToast('Failed to update alert status.', 'error');
    }
  };

  const filteredAlerts = alerts.filter((alert) => {
    const matchesSearch = alert.title.toLowerCase().includes(search.toLowerCase()) || 
                          alert.reason.toLowerCase().includes(search.toLowerCase()) ||
                          alert.actor.toLowerCase().includes(search.toLowerCase()) ||
                          alert.resource.toLowerCase().includes(search.toLowerCase());
    
    const matchesSeverity = selectedSeverity === 'all' || alert.severity === selectedSeverity;
    
    let matchesStatus = true;
    if (selectedStatus === 'active') {
      matchesStatus = alert.status === 'New' || alert.status === 'Investigating';
    } else if (selectedStatus !== 'all') {
      matchesStatus = alert.status.toLowerCase() === selectedStatus.toLowerCase();
    }

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  return (
    <div className="p-4 md:p-8 pb-20 max-w-7xl mx-auto space-y-6 relative text-primary-text">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Alert Response Center</h2>
          <p className="text-xs text-secondary mt-1">Real-time alert dispatch of critical boundary violations and credential leakage risks.</p>
        </div>

        <button
          onClick={() => fetchAlerts(true)}
          className="p-2 bg-surface hover:bg-surface-top border border-border text-secondary hover:text-white rounded-[6px] transition-colors cursor-pointer self-start sm:self-auto"
          title="Refresh Alerts"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-surface border border-border rounded-[12px] p-4 flex flex-col md:flex-row gap-4">
        
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search alerts by title, actor, reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-background border border-border text-xs text-primary-text placeholder-muted rounded-[6px] pl-9 pr-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
          />
        </div>

        <div className="w-full md:w-44">
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40 appearance-none cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        <div className="w-full md:w-44">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40 appearance-none cursor-pointer"
          >
            <option value="active">Active Alerts</option>
            <option value="New">New Only</option>
            <option value="Investigating">Investigating Only</option>
            <option value="Resolved">Resolved</option>
            <option value="Dismissed">Dismissed</option>
            <option value="all">All Statuses</option>
          </select>
        </div>

      </div>

      {/* Error State Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-[12px] p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-xs text-white font-medium">{error}</p>
          <button
            onClick={() => fetchAlerts()}
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
        /* Alerts list */
        <div className="space-y-4">
          {filteredAlerts.length === 0 ? (
            <div className="bg-surface border border-border rounded-[12px] p-12 text-center text-xs text-muted">
              {alerts.length === 0 ? 'No active security alerts' : 'No security alerts found matching the active parameters.'}
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div 
                key={alert.id} 
                className={`bg-surface border rounded-[12px] p-5 flex flex-col md:flex-row justify-between items-start gap-4 transition-colors hover:border-border/80 animate-slide-up ${
                  alert.status === 'New' 
                    ? 'border-red-500/20' 
                    : 'border-border'
                }`}
              >
                
                <div className="space-y-2.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 w-full min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      alert.severity === 'Critical' ? 'bg-critical-text' :
                      alert.severity === 'High' ? 'bg-warning-text' : 'bg-info-text'
                    }`} />
                    <h3 className="font-semibold text-xs text-white leading-none truncate max-w-full">{alert.title}</h3>
                    <StatusBadge status={alert.status} className="text-[9px]" />
                  </div>
                  
                  <p className="text-xs text-secondary leading-relaxed max-w-3xl">{alert.reason}</p>

                  <div className="bg-background border border-border rounded-[6px] p-2 text-[10px] text-secondary max-w-2xl">
                    <span className="font-bold text-muted uppercase tracking-wider block mb-0.5">RECOMMENDED RESOLUTION ACTION</span>
                    {alert.severity === 'Critical' 
                      ? 'Immediately restrict actor API key permissions and freeze active execution model workflows.' 
                      : 'Monitor behavioral metrics closely or execute developer credentials rotation.'
                    }
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-[10px] text-muted">
                    <span className="flex items-center gap-1">
                      {alert.agentId ? <Cpu className="w-3.5 h-3.5" /> : <Key className="w-3.5 h-3.5" />}
                      Actor: <span className="font-mono text-secondary">{alert.actor}</span>
                    </span>
                    <span>Target: <span className="font-mono text-secondary">{alert.resource}</span></span>
                    <span>Detected: {formatTimestamp(alert.timestamp)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-stretch md:self-auto justify-end border-t md:border-t-0 border-border pt-4 md:pt-0 shrink-0">
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <RiskBadge score={alert.riskScore} className="text-[10px] px-2 py-0.5 shrink-0" />
                    
                    <div className="h-6 w-[1px] bg-border" />

                    {/* Investigate */}
                    {alert.status === 'New' && (
                      <button
                        onClick={() => handleUpdateStatus(alert.id, 'Investigating')}
                        className="bg-surface-top hover:bg-surface-mid border border-border text-white text-[10px] font-semibold px-2.5 py-1 rounded-[4px] flex items-center gap-1 transition-all cursor-pointer h-7"
                        title="Mark as Investigating"
                      >
                        <Eye className="w-3.5 h-3.5 text-muted" />
                        <span>Investigate</span>
                      </button>
                    )}

                    {/* Resolve */}
                    {(alert.status === 'New' || alert.status === 'Investigating') && (
                      <button
                        onClick={() => handleUpdateStatus(alert.id, 'Resolved')}
                        className="bg-healthy-bg hover:bg-healthy-bg/25 border border-healthy-border text-healthy-text text-[10px] font-semibold px-2.5 py-1 rounded-[4px] flex items-center gap-1 transition-all cursor-pointer h-7"
                        title="Resolve Alert"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Resolve</span>
                      </button>
                    )}

                    {/* Dismiss */}
                    {(alert.status === 'New' || alert.status === 'Investigating') && (
                      <button
                        onClick={() => handleUpdateStatus(alert.id, 'Dismissed')}
                        className="text-muted hover:text-secondary p-1 rounded hover:bg-surface-top cursor-pointer"
                        title="Dismiss Alert"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    
                    {/* Re-Open */}
                    {(alert.status === 'Resolved' || alert.status === 'Dismissed') && (
                      <button
                        onClick={() => handleUpdateStatus(alert.id, 'New')}
                        className="bg-surface-top hover:bg-surface-mid border border-border text-secondary text-[10px] font-semibold px-2.5 py-1 rounded-[4px] transition-all cursor-pointer h-7"
                      >
                        Re-Open
                      </button>
                    )}

                    {/* Investigate deep link redirects */}
                    {alert.agentId && (
                      <Link href={`/agents/${alert.agentId}`} className="text-purple-400 hover:text-purple-300 text-[10px] font-semibold px-2 py-1 shrink-0">
                        Deep Profile &rarr;
                      </Link>
                    )}
                    {alert.identityId && (
                      <Link href={`/identities/${alert.identityId}`} className="text-purple-400 hover:text-purple-300 text-[10px] font-semibold px-2 py-1 shrink-0">
                        Deep Profile &rarr;
                      </Link>
                    )}
                  </div>
                </div>

              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
}
