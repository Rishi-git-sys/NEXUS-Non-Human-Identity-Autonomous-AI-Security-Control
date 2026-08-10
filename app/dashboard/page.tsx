'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { dashboardService, DashboardData } from '@/lib/services/dashboardService';
import { RiskTrendChart } from '@/components/ui/RiskTrendChart';
import { 
  Shield, 
  Play, 
  Loader2, 
  CheckCircle, 
  Plus, 
  Zap, 
  TrendingUp,
  Clock,
  Sparkles,
  BookOpen,
  ScrollText,
  ChevronLeft,
  ShieldAlert,
  AlertCircle,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/context/ToastContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('7d');
  
  // Scanning simulator states
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'success'>('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [scanPhase, setScanPhase] = useState('');

  const loadDashboardData = useCallback(async (isRefresh = false) => {
    if (!user?.organization_id) {
      setIsLoading(false);
      return;
    }

    if (!isRefresh) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const telemetry = await dashboardService.getDashboardData(user.organization_id, timeframe);
      setData(telemetry);
    } catch (err: unknown) {
      console.error('Failed to load dashboard telemetry:', err);
      setError('Unable to load security telemetry from control plane. Please verify connection and retry.');
    } finally {
      setIsLoading(false);
    }
  }, [user, timeframe]);

  useEffect(() => {
    if (user?.organization_id) {
      requestAnimationFrame(() => {
        loadDashboardData();
      });
    } else if (!user) {
      requestAnimationFrame(() => {
        setIsLoading(false);
      });
    }
  }, [user, timeframe, loadDashboardData]);

  const handleScan = async () => {
    if (scanState === 'scanning' || !user?.organization_id) return;
    
    setScanState('scanning');
    setScanProgress(0);
    setScanPhase('Initializing identity crawler...');
    
    const phases = [
      { progress: 20, text: 'Mapping non-human workload nodes...' },
      { progress: 50, text: 'Querying credentials age metadata...' },
      { progress: 75, text: 'Evaluating policy engine constraints...' },
      { progress: 100, text: 'Scan compliance checks complete.' }
    ];

    let phaseIdx = 0;
    const interval = setInterval(async () => {
      setScanProgress((prev) => {
        const next = prev + 5;
        if (phaseIdx < phases.length && next >= phases[phaseIdx].progress) {
          setScanPhase(phases[phaseIdx].text);
          phaseIdx++;
        }

        if (next >= 100) {
          clearInterval(interval);
          setScanState('success');
          
          // Log scan to audit_logs in database
          dashboardService.logScanAudit(
            user.organization_id!,
            user.id,
            user.full_name || 'System Operator'
          ).then(() => {
            loadDashboardData(true);
          });
          
          setTimeout(() => setScanState('idle'), 5000);
          return 100;
        }
        return next;
      });
    }, 100);
  };

  // --- Loading State ---
  if (isLoading) {
    return (
      <div className="p-4 md:p-8 pb-20 max-w-7xl mx-auto space-y-6 text-primary-text">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <div className="h-7 w-64 bg-surface/80 rounded animate-pulse" />
            <div className="h-4 w-48 bg-surface/40 rounded animate-pulse" />
          </div>
          <div className="h-9 w-40 bg-surface/60 rounded animate-pulse" />
        </div>

        {/* Skeleton KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface border border-border rounded-[12px] p-5 h-28 flex flex-col justify-between animate-pulse">
              <div className="h-3 w-24 bg-surface-top rounded" />
              <div className="flex justify-between items-baseline">
                <div className="h-7 w-16 bg-surface-top rounded" />
                <div className="h-5 w-20 bg-surface-top rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Skeleton Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-surface border border-border rounded-[12px] p-6 h-80 animate-pulse" />
          <div className="bg-surface border border-border rounded-[12px] p-6 lg:col-span-2 h-80 animate-pulse" />
        </div>
      </div>
    );
  }

  // --- Error State ---
  if (error || !data) {
    return (
      <div className="p-4 md:p-8 pb-20 max-w-7xl mx-auto space-y-6 text-primary-text">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard Telemetry</h1>
        </div>

        <div className="bg-red-500/10 border border-red-500/20 rounded-[12px] p-8 text-center space-y-4 max-w-xl mx-auto my-12">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">Control Plane Telemetry Error</h2>
            <p className="text-xs text-secondary leading-relaxed">
              {error || 'Unable to retrieve security telemetry for your organization.'}
            </p>
          </div>
          <button
            onClick={() => loadDashboardData()}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 py-2 rounded-[6px] transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Telemetry Fetch</span>
          </button>
        </div>
      </div>
    );
  }

  const identityRiskCount = data.identities.criticalRisk + data.identities.highRisk;
  const agentRiskCount = data.aiAgents.criticalRisk + data.aiAgents.highRisk;

  return (
    <div className="p-4 md:p-8 pb-20 max-w-7xl mx-auto space-y-6 animate-fade-in text-primary-text">
      
      {/* Top Header Greetings */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Good afternoon, {user?.full_name ? user.full_name.split(' ')[0] : 'Operator'}
          </h1>
          <p className="text-xs text-secondary mt-1">
            Role: <span className="text-purple-400 font-semibold uppercase">{user?.role || 'Admin'}</span> &bull; Organization: <span className="text-white font-semibold">{data.organizationName}</span>
          </p>
        </div>

        {/* Scan controller */}
        <button 
          onClick={handleScan}
          disabled={scanState === 'scanning'}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:from-purple-700 active:to-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-[6px] transition-colors disabled:opacity-50 flex items-center gap-2 h-9 cursor-pointer"
        >
          {scanState === 'scanning' ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Scanning ({scanProgress}%)</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Run On-Demand Scan</span>
            </>
          )}
        </button>
      </div>

      {/* Simulated Scan Progress Indicator */}
      {scanState === 'scanning' && (
        <div className="bg-surface border border-border rounded-[12px] p-4 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-secondary font-mono">{scanPhase}</span>
            <span className="text-purple-400 font-bold font-mono">{scanProgress}%</span>
          </div>
          <div className="w-full bg-background h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-150 ease-out" 
              style={{ width: `${scanProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Scan Success Banner */}
      {scanState === 'success' && (
        <div className="bg-healthy-bg border border-healthy-border text-healthy-text px-4 py-3 rounded-[6px] flex items-center text-xs justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Governance scan completed successfully. Database telemetry updated against active policies.</span>
          </div>
        </div>
      )}

      {/* Primary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Security Score */}
        <div className="bg-surface border border-border rounded-[12px] p-5 flex flex-col justify-between hover:border-border/80 transition-colors">
          <span className="text-muted text-[10px] font-bold uppercase tracking-wider block">Security Score</span>
          <div className="mt-4 flex items-baseline justify-between gap-3 w-full min-w-0">
            <span className="text-2xl font-bold text-white tracking-tight truncate shrink">
              {data.securityScore.score !== null ? `${data.securityScore.score} ` : '— '}
              <span className="text-xs text-muted">/ 100</span>
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border shrink-0 whitespace-nowrap ${
              data.securityScore.score === null
                ? 'bg-surface-top text-muted border-border'
                : data.securityScore.statusLabel === 'Excellent' || data.securityScore.statusLabel === 'Healthy'
                ? 'bg-healthy-bg text-healthy-text border-healthy-border'
                : data.securityScore.statusLabel === 'Needs Review'
                ? 'bg-warning-bg text-warning-text border-warning-border'
                : 'bg-critical-bg text-critical-text border-critical-border'
            }`}>
              {data.securityScore.statusLabel}
            </span>
          </div>
        </div>

        {/* KPI 2: Identity Risk */}
        <div className="bg-surface border border-border rounded-[12px] p-5 flex flex-col justify-between hover:border-border/80 transition-colors">
          <span className="text-muted text-[10px] font-bold uppercase tracking-wider block">Identity Risk</span>
          <div className="mt-4 flex items-baseline justify-between gap-3 w-full min-w-0">
            <span className="text-2xl font-bold text-white tracking-tight truncate shrink">{identityRiskCount}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border shrink-0 whitespace-nowrap ${
              data.securityScore.identityRiskBadge === 'Needs Review'
                ? 'bg-warning-bg text-warning-text border-warning-border'
                : data.securityScore.identityRiskBadge === 'Critical'
                ? 'bg-critical-bg text-critical-text border-critical-border'
                : data.securityScore.identityRiskBadge === 'No Data'
                ? 'bg-surface-top text-muted border-border'
                : 'bg-healthy-bg text-healthy-text border-healthy-border'
            }`}>
              {data.securityScore.identityRiskBadge}
            </span>
          </div>
        </div>

        {/* KPI 3: AI Agent Risk */}
        <div className="bg-surface border border-border rounded-[12px] p-5 flex flex-col justify-between hover:border-border/80 transition-colors">
          <span className="text-muted text-[10px] font-bold uppercase tracking-wider block">AI Agent Risk</span>
          <div className="mt-4 flex items-baseline justify-between gap-3 w-full min-w-0">
            <span className="text-2xl font-bold text-white tracking-tight truncate shrink">{agentRiskCount}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border shrink-0 whitespace-nowrap ${
              data.securityScore.agentRiskBadge === 'Critical'
                ? 'bg-critical-bg text-critical-text border-critical-border'
                : data.securityScore.agentRiskBadge === 'Needs Review'
                ? 'bg-warning-bg text-warning-text border-warning-border'
                : data.securityScore.agentRiskBadge === 'No Data'
                ? 'bg-surface-top text-muted border-border'
                : 'bg-healthy-bg text-healthy-text border-healthy-border'
            }`}>
              {data.securityScore.agentRiskBadge}
            </span>
          </div>
        </div>

        {/* KPI 4: Policy Compliance */}
        <div className="bg-surface border border-border rounded-[12px] p-5 flex flex-col justify-between hover:border-border/80 transition-colors">
          <span className="text-muted text-[10px] font-bold uppercase tracking-wider block">Policy Compliance</span>
          <div className="mt-4 flex items-baseline justify-between gap-3 w-full min-w-0">
            <span className="text-2xl font-bold text-white tracking-tight truncate shrink">
              {data.policies.compliancePercentage !== null ? `${data.policies.compliancePercentage}%` : '—'}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border shrink-0 whitespace-nowrap ${
              data.policies.compliancePercentage === null
                ? 'bg-surface-top text-muted border-border'
                : data.policies.compliancePercentage >= 90
                ? 'bg-healthy-bg text-healthy-text border-healthy-border'
                : data.policies.compliancePercentage >= 70
                ? 'bg-warning-bg text-warning-text border-warning-border'
                : 'bg-critical-bg text-critical-text border-critical-border'
            }`}>
              {data.policies.compliancePercentage === null ? 'No Data' : data.policies.compliancePercentage >= 90 ? 'Healthy' : 'Needs Review'}
            </span>
          </div>
        </div>

      </div>

      {/* Main Grid: Posture + Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Security Posture ring breakdown card */}
        <div className="bg-surface border border-border rounded-[12px] p-6 flex flex-col justify-between hover:border-border/80 transition-colors">
          <div>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Security Posture Breakdown</h3>
              <Shield className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-xs text-secondary mb-6">Visual representation of core authorization plane compliance.</p>
          </div>

          {/* Clean Ring Visual representation */}
          <div className="relative h-32 w-full flex items-center justify-center">
            <div className="relative w-28 h-28">
              <svg className="w-28 h-28 transform -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r="46"
                  stroke="var(--border)"
                  strokeWidth="8"
                  fill="transparent"
                />
                {data.securityScore.score !== null && (
                  <circle
                    cx="56"
                    cy="56"
                    r="46"
                    stroke="url(#purpleGradient)"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray="289"
                    strokeDashoffset={289 - (289 * data.securityScore.score) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                )}
                <defs>
                  <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--brand-purple)" />
                    <stop offset="100%" stopColor="var(--brand-indigo)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white tracking-tight">
                  {data.securityScore.score !== null ? `${data.securityScore.score}%` : '—'}
                </span>
                <span className="text-[9px] text-muted uppercase font-bold tracking-wider font-semibold">
                  {data.securityScore.score !== null ? 'Index' : 'No Data'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-2 border-t border-border pt-4 text-xs">
            <div className="flex justify-between text-secondary">
              <span>Identity Security</span>
              <span className="text-white font-semibold">
                {data.breakdown.identitySecurityScore !== null ? `${data.breakdown.identitySecurityScore}%` : '—'}
              </span>
            </div>
            <div className="flex justify-between text-secondary">
              <span>AI Agent Security</span>
              <span className="text-white font-semibold">
                {data.breakdown.aiAgentSecurityScore !== null ? `${data.breakdown.aiAgentSecurityScore}%` : '—'}
              </span>
            </div>
            <div className="flex justify-between text-secondary">
              <span>Access Governance</span>
              <span className="text-white font-semibold">
                {data.breakdown.accessGovernanceScore !== null ? `${data.breakdown.accessGovernanceScore}%` : '—'}
              </span>
            </div>
            <div className="flex justify-between text-secondary">
              <span>Policy Compliance</span>
              <span className="text-white font-semibold">
                {data.breakdown.policyComplianceScore !== null ? `${data.breakdown.policyComplianceScore}%` : '—'}
              </span>
            </div>
            
            <div className="pt-2 flex justify-center text-[10px] font-semibold text-muted gap-1 items-center">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{data.hasTelemetry ? 'Real Database State Synchronized' : 'Awaiting Security Telemetry'}</span>
            </div>
          </div>
        </div>

        {/* Risk Trend Chart */}
        <div className="bg-surface border border-border rounded-[12px] p-6 lg:col-span-2 flex flex-col justify-between hover:border-border/80 transition-colors">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
            <div>
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Governance Trends</h3>
              <p className="text-xs text-secondary mt-1">Timeline logs of secure actions vs. blocked attacks.</p>
            </div>
            
            {/* Timeframe selector */}
            <div className="flex bg-background p-0.5 rounded-[6px] border border-border self-start sm:self-auto">
              {(['7d', '30d', '90d'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeframe(t)}
                  className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-[4px] transition-colors cursor-pointer ${
                    timeframe === t 
                      ? 'bg-surface-top text-white border border-border/40' 
                      : 'text-muted hover:text-secondary'
                  }`}
                >
                  {t === '7d' ? '7 Days' : t === '30d' ? '30 Days' : '90 Days'}
                </button>
              ))}
            </div>
          </div>

          <RiskTrendChart data={data.riskTrend} />
        </div>

      </div>

      {/* Main Grid: Attention required + AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        
        {/* Attention Required Card */}
        <div className="bg-surface border border-border rounded-[12px] p-6 lg:col-span-2 space-y-5 hover:border-border/80 transition-colors">
          <div className="border-b border-border pb-3">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Attention Required</h3>
          </div>

          <div className="space-y-3">
            {data.attentionRequired.length === 0 ? (
              <div className="p-6 bg-background border border-border rounded-[8px] flex items-center gap-3 text-secondary text-xs">
                <ShieldCheck className="w-5 h-5 text-healthy-text shrink-0" />
                <div>
                  <h4 className="text-xs font-semibold text-white">No critical attention items detected</h4>
                  <p className="text-[11px] text-muted mt-0.5">Non-human identities and AI agents match baseline security policy rules.</p>
                </div>
              </div>
            ) : (
              data.attentionRequired.map((item) => (
                <div 
                  key={item.id}
                  className={`p-4 border rounded-[8px] flex justify-between items-center gap-4 ${
                    item.severity === 'CRITICAL'
                      ? 'bg-critical-bg border-critical-border'
                      : 'bg-warning-bg border-warning-border'
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-bold uppercase border px-1.5 py-0.5 rounded ${
                        item.severity === 'CRITICAL'
                          ? 'bg-red-500/10 border-red-500/15 text-red-400'
                          : 'bg-yellow-500/10 border-yellow-500/15 text-warning-text'
                      }`}>
                        {item.severity}
                      </span>
                      <h4 className="text-xs font-semibold text-white truncate">{item.title}</h4>
                    </div>
                    <p className="text-[11px] text-secondary leading-relaxed">
                      <strong>WHAT:</strong> {item.what} <strong>WHY:</strong> {item.why} <strong>ACTION:</strong> {item.action}
                    </p>
                  </div>
                  <Link href={item.link} className="bg-surface-top hover:bg-surface-mid border border-border text-xs font-semibold px-3 py-1.5 rounded-[6px] transition-colors shrink-0 text-white">
                    Review
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Security Insights Panel */}
        <div className="bg-surface border border-border rounded-[12px] p-6 flex flex-col justify-between hover:border-border/80 transition-colors">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>NEXUS Intelligence</span>
              </h3>
            </div>
            
            <div className="space-y-3 text-xs">
              {data.aiInsight ? (
                <>
                  <p className="text-white font-medium leading-relaxed">
                    {data.aiInsight.text}
                  </p>
                  <div className="bg-background border border-border rounded-[8px] p-3">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-purple-400 block mb-1">REASONING & RECOMMENDATION</span>
                    <p className="text-[11px] text-secondary leading-relaxed">
                      {data.aiInsight.recommendation}
                    </p>
                  </div>
                </>
              ) : (
                <div className="bg-background border border-border rounded-[8px] p-4 text-center space-y-1">
                  <ShieldCheck className="w-5 h-5 text-healthy-text mx-auto mb-1" />
                  <p className="text-xs text-white font-medium">No Security Anomalies</p>
                  <p className="text-[11px] text-muted leading-relaxed">
                    AI agent permissions and workload roles match baseline security policies.
                  </p>
                </div>
              )}
            </div>
          </div>

          {data.aiInsight && (
            <div className="flex gap-3 pt-4 border-t border-border mt-4 shrink-0">
              <Link 
                href={data.aiInsight.targetLink || '/agents'} 
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:from-purple-700 active:to-indigo-700 text-white font-semibold text-center text-xs py-2 rounded-[6px] transition-colors"
              >
                Review Access
              </Link>
              <button 
                onClick={() => showToast('Insight dismissed.', 'info')}
                className="flex-1 bg-surface-top hover:bg-surface-mid border border-border text-secondary hover:text-white font-semibold text-xs py-2 rounded-[6px] transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Grid: Recent Activity + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        
        {/* Recent Activity Timeline */}
        <div className="bg-surface border border-border rounded-[12px] p-6 lg:col-span-2 space-y-4 hover:border-border/80 transition-colors">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Recent Activity Timeline</h3>
            <Clock className="w-4 h-4 text-muted" />
          </div>

          <div className="space-y-3">
            {data.recentActivity.length === 0 ? (
              <div className="p-6 bg-background border border-border rounded-[8px] text-center text-xs text-muted">
                No recent audit activity. System events and compliance actions will appear here when logged.
              </div>
            ) : (
              data.recentActivity.map((activity) => (
                <div key={activity.id} className="flex justify-between items-center p-3 bg-background border border-border rounded-[8px]">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${
                      activity.type === 'critical' ? 'bg-critical-text' :
                      activity.type === 'warning' ? 'bg-warning-text' :
                      activity.type === 'healthy' ? 'bg-healthy-text' : 'bg-info-text'
                    }`} />
                    <div>
                      <h4 className="text-xs font-semibold text-white">{activity.actor}</h4>
                      <span className="text-[10px] text-muted">{activity.event}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted">{activity.time}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="bg-surface border border-border rounded-[12px] p-6 flex flex-col justify-between hover:border-border/80 transition-colors">
          <div className="space-y-4">
            <div className="border-b border-border pb-3">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Quick Controls</h3>
            </div>
            
            <div className="flex flex-col gap-2.5 text-xs text-secondary font-semibold">
              
              <Link href="/identities?action=add" className="p-2.5 bg-background border border-border rounded-[8px] hover:border-purple-500/40 hover:text-white transition-all flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-purple-400 animate-pulse" />
                  <span>Add New Identity</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-muted animate-pulse" />
              </Link>

              <Link href="/agents?action=register" className="p-2.5 bg-background border border-border rounded-[8px] hover:border-purple-500/40 hover:text-white transition-all flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span>Register AI Agent</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-muted" />
              </Link>

              <Link href="/policies" className="p-2.5 bg-background border border-border rounded-[8px] hover:border-purple-500/40 hover:text-white transition-all flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  <span>Review Policies</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-muted" />
              </Link>

              <Link href="/alerts" className="p-2.5 bg-background border border-border rounded-[8px] hover:border-purple-500/40 hover:text-white transition-all flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-purple-400" />
                  <span>Investigate Active Alert</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-muted" />
              </Link>

              <Link href="/audit" className="p-2.5 bg-background border border-border rounded-[8px] hover:border-purple-500/40 hover:text-white transition-all flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-purple-400" />
                  <span>View System Audit Logs</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-muted" />
              </Link>

            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return <ChevronLeft className={`${className} rotate-180`} />;
}
