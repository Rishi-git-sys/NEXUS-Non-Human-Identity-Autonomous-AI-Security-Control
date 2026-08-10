'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { auditService } from '@/lib/services/auditService';
import { AuditEvent } from '@/lib/types/audit';
import { RiskBadge, StatusBadge } from '@/components/ui/Badges';
import { Search, Download, X, Terminal, Code, RefreshCw, AlertCircle } from 'lucide-react';
import { formatTimestamp } from '@/lib/utils';
import { useToast } from '@/context/ToastContext';

export default function AuditPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedEnv, setSelectedEnv] = useState<string>('all');
  const [selectedDecision, setSelectedDecision] = useState<string>('all');
  
  // Selected event for details drawer
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const fetchEvents = useCallback(async (isRefresh = false) => {
    if (!user?.organization_id) {
      setIsLoading(false);
      return;
    }

    if (!isRefresh) setIsLoading(true);
    setError(null);

    try {
      const data = await auditService.getAuditEvents(user.organization_id);
      setEvents(data);
    } catch (err: unknown) {
      console.error('Error loading audit events from control plane:', err);
      setError('Unable to load audit ledger telemetry from control plane. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.organization_id) {
      requestAnimationFrame(() => {
        fetchEvents();
      });
    } else if (!user) {
      requestAnimationFrame(() => {
        setIsLoading(false);
      });
    }
  }, [user, fetchEvents]);

  const handleExport = (format: 'csv' | 'json') => {
    if (events.length === 0) {
      showToast('No audit events available to export.', 'error');
      return;
    }

    if (format === 'json') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(events, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `nexus_audit_ledger_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else {
      const headers = ['id', 'timestamp', 'actor', 'actorId', 'action', 'resource', 'environment', 'decision', 'riskScore'];
      const rows = events.map(e => [
        e.id,
        e.timestamp,
        `"${e.actor.replace(/"/g, '""')}"`,
        e.actorId,
        `"${e.action.replace(/"/g, '""')}"`,
        `"${e.resource.replace(/"/g, '""')}"`,
        e.environment,
        e.decision,
        e.riskScore
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', encodeURI(csvContent));
      downloadAnchor.setAttribute('download', `nexus_audit_ledger_${Date.now()}.csv`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }

    showToast(`Audit log database exported successfully as ${format.toUpperCase()}.`, 'success');
  };

  const filteredEvents = events.filter((e) => {
    const matchesSearch = e.actor.toLowerCase().includes(search.toLowerCase()) ||
                          e.action.toLowerCase().includes(search.toLowerCase()) ||
                          e.resource.toLowerCase().includes(search.toLowerCase()) ||
                          (e.reason && e.reason.toLowerCase().includes(search.toLowerCase())) ||
                          e.id.toLowerCase().includes(search.toLowerCase());
    
    const matchesEnv = selectedEnv === 'all' || e.environment === selectedEnv;
    const matchesDecision = selectedDecision === 'all' || e.decision === selectedDecision;

    return matchesSearch && matchesEnv && matchesDecision;
  });

  const environments = Array.from(new Set(events.map((e) => e.environment)));
  const decisions = ['ALLOWED', 'BLOCKED', 'REVIEW', 'ALERT'];

  return (
    <div className="p-4 md:p-8 pb-20 max-w-7xl mx-auto space-y-6 relative flex flex-col h-[calc(100vh-4rem)] overflow-hidden text-primary-text">
      
      {/* Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Immutable Audit Ledger</h2>
          <p className="text-xs text-secondary mt-1">Compliance logs of all programmatic tool executions, credentials rotations, and boundary controls.</p>
        </div>
        
        {/* Export & Refresh Buttons */}
        <div className="flex gap-2 items-center">
          <button
            onClick={() => fetchEvents(true)}
            className="p-2 bg-surface hover:bg-surface-top border border-border text-secondary hover:text-white rounded-[6px] transition-colors cursor-pointer"
            title="Refresh Audit Logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => handleExport('csv')}
            className="bg-surface-top hover:bg-surface-mid border border-border text-white text-xs font-semibold px-3 py-1.5 rounded-[6px] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-muted" />
            <span>Export CSV</span>
          </button>
          
          <button
            onClick={() => handleExport('json')}
            className="bg-surface-top hover:bg-surface-mid border border-border text-white text-xs font-semibold px-3 py-1.5 rounded-[6px] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Code className="w-3.5 h-3.5 text-muted" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="shrink-0 bg-surface border border-border rounded-[12px] p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search by event actor, action type, resource path, reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-background border border-border text-xs text-primary-text placeholder-muted rounded-[6px] pl-9 pr-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
          />
        </div>

        <div className="w-full sm:w-44">
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

        <div className="w-full sm:w-44">
          <select
            value={selectedDecision}
            onChange={(e) => setSelectedDecision(e.target.value)}
            className="bg-background border border-border text-xs text-secondary rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40 appearance-none cursor-pointer"
          >
            <option value="all">All Decisions</option>
            {decisions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error State Banner */}
      {error && (
        <div className="shrink-0 bg-red-500/10 border border-red-500/20 rounded-[12px] p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-xs text-white font-medium">{error}</p>
          <button
            onClick={() => fetchEvents()}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-[6px] transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Main Table / Detail Drawer Layout */}
      <div className="flex-1 flex gap-6 min-h-0 min-w-0">
        
        {/* Table Area */}
        <div className="flex-1 bg-surface border border-border rounded-[12px] overflow-hidden flex flex-col min-h-[300px] min-w-0">
          <div className="flex-1 overflow-auto min-w-0">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="bg-surface-top border border-border/50 rounded-[8px] h-12 animate-pulse" />
                ))}
              </div>
            ) : (
              <table className="w-full text-left text-xs text-primary-text border-collapse">
                <thead className="text-[10px] text-muted uppercase tracking-wider border-b border-border bg-surface-mid/40 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Timestamp</th>
                    <th className="px-6 py-3 font-semibold">Actor / Identity</th>
                    <th className="px-6 py-3 font-semibold">Action</th>
                    <th className="px-6 py-3 font-semibold">Resource</th>
                    <th className="px-6 py-3 font-semibold">Environment</th>
                    <th className="px-6 py-3 font-semibold">Decision</th>
                    <th className="px-6 py-3 font-semibold">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-muted">
                        {events.length === 0 ? 'No audit activity recorded' : 'No audit logs match active filter parameters.'}
                      </td>
                    </tr>
                  ) : (
                    filteredEvents.map((event) => (
                      <tr 
                        key={event.id} 
                        onClick={() => setSelectedEvent(event)}
                        className={`border-b border-border hover:bg-surface-mid/20 transition-colors cursor-pointer select-none ${
                          selectedEvent?.id === event.id ? 'bg-surface-mid/30' : ''
                        }`}
                      >
                        <td className="px-6 py-4 text-secondary whitespace-nowrap">
                          {formatTimestamp(event.timestamp)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-white">{event.actor}</span>
                          <span className="block text-[9px] text-muted font-mono mt-0.5">{event.actorId}</span>
                        </td>
                        <td className="px-6 py-4 font-mono font-semibold text-[11px] text-white">
                          {event.action}
                        </td>
                        <td className="px-6 py-4 font-mono text-[10px] text-secondary max-w-[220px] truncate">
                          {event.resource}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded-[4px] bg-background text-secondary border border-border font-medium text-[9px]">
                            {event.environment}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={event.decision} className="text-[9px]" />
                        </td>
                        <td className="px-6 py-4">
                          <RiskBadge score={event.riskScore} className="text-[9px]" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* JSON Details Inspector Drawer (Right Side) */}
        {selectedEvent && (
          <div className="w-96 bg-surface border border-border rounded-[12px] p-5 shrink-0 flex flex-col justify-between overflow-hidden min-h-[300px] animate-slide-left">
            <div className="flex-1 flex flex-col overflow-hidden space-y-4">
              
              <div className="flex justify-between items-start border-b border-border pb-3 shrink-0">
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-mono text-muted uppercase tracking-wider block">Raw Telemetry</span>
                  <h3 className="text-xs font-bold text-white font-mono truncate max-w-full">{selectedEvent.id}</h3>
                </div>
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="p-1 rounded text-secondary hover:text-white hover:bg-surface-top cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs shrink-0 w-full min-w-0">
                <div className="col-span-2">
                  <span className="text-muted block text-[9px] uppercase font-bold tracking-wider">Timestamp</span>
                  <span className="text-secondary font-mono mt-0.5 block">{selectedEvent.timestamp}</span>
                </div>
                <div>
                  <span className="text-muted block text-[9px] uppercase font-bold tracking-wider">Client IP</span>
                  <span className="text-white font-mono mt-0.5 block">{selectedEvent.ipAddress || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-muted block text-[9px] uppercase font-bold tracking-wider">Enforcement</span>
                  <span className="text-white font-mono mt-0.5 block">{selectedEvent.decision}</span>
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0 space-y-1">
                <span className="text-muted text-[9px] uppercase font-bold tracking-wider shrink-0 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-purple-400" />
                  <span>Payload Schema (Sanitized)</span>
                </span>
                
                <div className="flex-grow bg-background border border-border rounded-[6px] p-3 overflow-auto font-mono text-[10px] text-purple-400 min-h-[120px]">
                  <pre>{JSON.stringify(selectedEvent, null, 2)}</pre>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

    </div>
  );
}
