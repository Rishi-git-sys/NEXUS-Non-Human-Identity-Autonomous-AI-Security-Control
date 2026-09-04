'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Alert } from '@/lib/types/alert';
import { RiskBadge, StatusBadge } from '@/components/ui/Badges';
import { Search, Eye, Check, XCircle, Cpu, Key, RefreshCw, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatTimestamp } from '@/lib/utils';
import Link from 'next/link';
import { useToast } from '@/context/ToastContext';

export default function AlertsPage() {
  useAuth();
  const { showToast } = useToast();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  const limit = 50;

  const fetchAlerts = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (search) params.set('search', search);
      if (selectedSeverity !== 'all') params.set('severity', selectedSeverity);
      if (selectedStatus !== 'all') params.set('status', selectedStatus);

      const res = await fetch(`/api/alerts?${params.toString()}`);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to fetch alerts');
      }

      const json = await res.json();

      if (json.success) {
        setAlerts(json.data.data);
        setTotalPages(json.data.pagination.totalPages || 1);
      } else {
        throw new Error(json.error || 'Failed to fetch alerts');
      }
    } catch (err: unknown) {
      console.error('Error fetching alerts from control plane:', err);
      setError('Unable to load security alerts from control plane. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, selectedSeverity, selectedStatus]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchAlerts();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [fetchAlerts]);

  const handleUpdateStatus = async (id: string, status: Alert['status']) => {
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      
      const json = await res.json();
      
      if (res.ok && json.success) {
        showToast(`Alert marked as ${status}.`, 'success');
        await fetchAlerts(true);
      } else {
        showToast(json.error || 'Failed to update alert status.', 'error');
      }
    } catch (err) {
      console.error('Error updating alert status:', err);
      showToast('Failed to update alert status.', 'error');
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1); // reset to page 1 on new search
  };

  const handleSeverityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSeverity(e.target.value);
    setPage(1);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedStatus(e.target.value);
    setPage(1);
  };

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
            placeholder="Search alerts by title, description..."
            value={search}
            onChange={handleSearchChange}
            className="bg-background border border-border text-xs text-primary-text placeholder-muted rounded-[6px] pl-9 pr-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
          />
        </div>

        <div className="w-full md:w-44">
          <select
            value={selectedSeverity}
            onChange={handleSeverityChange}
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
            onChange={handleStatusChange}
            className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40 appearance-none cursor-pointer"
          >
            <option value="active">Active Alerts</option>
            <option value="Open">Open Only</option>
            <option value="Acknowledged">Acknowledged Only</option>
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
          {alerts.length === 0 ? (
            <div className="bg-surface border border-border rounded-[12px] p-12 text-center text-xs text-muted">
               No security alerts found matching the active parameters.
            </div>
          ) : (
            alerts.map((alert) => (
              <div 
                key={alert.id} 
                className={`bg-surface border rounded-[12px] p-5 flex flex-col md:flex-row justify-between items-start gap-4 transition-colors hover:border-border/80 animate-slide-up ${
                  alert.status === 'Open' 
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
                    {alert.recommendation || (alert.severity === 'Critical' 
                      ? 'Immediately restrict actor API key permissions and freeze active execution model workflows.' 
                      : 'Monitor behavioral metrics closely or execute developer credentials rotation.')}
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-[10px] text-muted">
                    <span className="flex items-center gap-1">
                      {alert.agentId ? <Cpu className="w-3.5 h-3.5" /> : <Key className="w-3.5 h-3.5" />}
                      Actor: <span className="font-mono text-secondary">{alert.actor}</span>
                    </span>
                    {alert.provider && <span>Provider: <span className="text-secondary">{alert.provider}</span></span>}
                    {alert.arn && <span>ARN: <span className="font-mono text-secondary truncate max-w-[200px]" title={alert.arn}>{alert.arn}</span></span>}
                    <span>Target: <span className="font-mono text-secondary">{alert.resource}</span></span>
                    <span>Detected: {formatTimestamp(alert.timestamp)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-stretch md:self-auto justify-end border-t md:border-t-0 border-border pt-4 md:pt-0 shrink-0">
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {alert.riskScore !== null && (
                       <RiskBadge score={alert.riskScore} className="text-[10px] px-2 py-0.5 shrink-0" />
                    )}
                    
                    <div className="h-6 w-[1px] bg-border mx-1" />

                    <Link
                      href={`/alerts/${alert.id}`}
                      className="bg-surface-top hover:bg-surface-mid border border-border text-white text-[10px] font-semibold px-2.5 py-1 rounded-[4px] flex items-center gap-1 transition-all h-7 cursor-pointer"
                      title="View Alert Details"
                    >
                      <Eye className="w-3.5 h-3.5 text-muted" />
                      <span>View Details</span>
                    </Link>

                    {/* Quick Resolve */}
                    {(alert.status === 'Open' || alert.status === 'Acknowledged' || alert.status === 'Investigating') && (
                      <button
                        onClick={() => handleUpdateStatus(alert.id, 'Resolved')}
                        className="bg-healthy-bg hover:bg-healthy-bg/25 border border-healthy-border text-healthy-text text-[10px] font-semibold px-2.5 py-1 rounded-[4px] flex items-center gap-1 transition-all cursor-pointer h-7"
                        title="Resolve Alert"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Resolve</span>
                      </button>
                    )}

                    {/* Quick Dismiss */}
                    {(alert.status === 'Open' || alert.status === 'Acknowledged' || alert.status === 'Investigating') && (
                      <button
                        onClick={() => handleUpdateStatus(alert.id, 'Dismissed')}
                        className="text-muted hover:text-secondary p-1 rounded hover:bg-surface-top cursor-pointer"
                        title="Dismiss Alert"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

              </div>
            ))
          )}
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center bg-surface border border-border rounded-[12px] p-4 mt-4">
               <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-[6px] bg-background border border-border text-secondary hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
               >
                 <ChevronLeft className="w-4 h-4" /> Previous
               </button>
               <span className="text-xs text-muted">Page {page} of {totalPages}</span>
               <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-[6px] bg-background border border-border text-secondary hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
               >
                 Next <ChevronRight className="w-4 h-4" />
               </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
