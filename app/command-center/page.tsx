'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  RefreshCw,
  Loader2,
  Sparkles,
  Activity,
  Users,
  Bot,
  Link2,
  ChevronDown,
  ChevronUp,
  Cpu,
} from 'lucide-react';
import Link from 'next/link';
import type { CommandCenterIntelligence, CommandCenterFinding, CommandCenterPattern } from '@/lib/types/commandCenter';
import type { NvidiaOrchestrationResult } from '@/lib/security/intelligence/nvidia/orchestrator';

// ============================================================================
// SEVERITY HELPERS
// ============================================================================

type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

function severityBadgeClasses(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-critical-bg text-critical-text border-critical-border';
    case 'HIGH':
      return 'bg-warning-bg text-warning-text border-warning-border';
    case 'MEDIUM':
      return 'bg-info-bg text-info-text border-info-border';
    case 'LOW':
      return 'bg-surface-top text-secondary border-border';
    default:
      return 'bg-surface-top text-muted border-border';
  }
}

function severityBarColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return 'bg-critical-text';
    case 'HIGH': return 'bg-warning-text';
    case 'MEDIUM': return 'bg-info-text';
    case 'LOW': return 'bg-secondary';
    default: return 'bg-muted';
  }
}

function riskScoreColor(score: number): string {
  if (score >= 90) return 'text-critical-text';
  if (score >= 70) return 'text-warning-text';
  if (score >= 40) return 'text-secondary';
  return 'text-healthy-text';
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function subjectLink(subjectId: string, subjectType: string): string | null {
  if (subjectType === 'identity') return `/identities/${subjectId}`;
  if (subjectType === 'ai_agent') return `/ai-agents/${subjectId}`;
  return null;
}

const CATEGORY_LABELS: Record<string, string> = {
  CREDENTIAL: 'Credential',
  PERMISSION: 'Permission',
  IDENTITY: 'Identity',
  AI_AGENT: 'AI Agent',
  AWS: 'AWS',
  RESOURCE: 'Resource',
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function CommandCenterPage() {
  const { user } = useAuth();

  // Deterministic intelligence state
  const [data, setData] = useState<CommandCenterIntelligence | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // NVIDIA advisory state
  const [nvidia, setNvidia] = useState<NvidiaOrchestrationResult | null>(null);
  const [nvidiaLoading, setNvidiaLoading] = useState(false);
  const [nvidiaError, setNvidiaError] = useState<string | null>(null);
  const [nvidiaRequested, setNvidiaRequested] = useState(false);

  // Expandable sections
  const [showAllFindings, setShowAllFindings] = useState(false);
  const [showAllPatterns, setShowAllPatterns] = useState(false);

  // ===== DETERMINISTIC DATA FETCH =====
  const loadIntelligence = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const res = await fetch('/api/security/command-center');
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 401) {
          throw new Error('Session expired. Please re-authenticate.');
        } else if (res.status === 403) {
          throw new Error(errJson.error || 'Authorization error.');
        } else {
          throw new Error(errJson.error || `Intelligence service error (${res.status}).`);
        }
      }
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        throw new Error(json.error || 'Failed to retrieve security intelligence.');
      }
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Unable to load security intelligence.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function initialFetch() {
      try {
        const res = await fetch('/api/security/command-center');
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          if (res.status === 401) {
            throw new Error('Session expired. Please re-authenticate.');
          } else if (res.status === 403) {
            throw new Error(errJson.error || 'Authorization error.');
          } else {
            throw new Error(errJson.error || `Intelligence service error (${res.status}).`);
          }
        }
        const json = await res.json();
        if (active && json.success && json.data) {
          setData(json.data);
        } else if (active) {
          throw new Error(json.error || 'Failed to retrieve security intelligence.');
        }
      } catch (err: unknown) {
        if (active) {
          const msg = (err as Error)?.message || 'Unable to load security intelligence.';
          setError(msg);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void initialFetch();

    return () => {
      active = false;
    };
  }, []);

  // ===== NVIDIA ADVISORY FETCH (explicit trigger only) =====
  const generateAdvisory = useCallback(async () => {
    setNvidiaLoading(true);
    setNvidiaError(null);
    setNvidiaRequested(true);

    try {
      const res = await fetch('/api/security/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'posture' }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) {
          throw new Error('Authorization required for advisory intelligence.');
        }
        throw new Error(errJson?.error?.message || 'Advisory intelligence unavailable.');
      }
      const json = await res.json();
      if (json.success && json.data) {
        setNvidia(json.data);
      } else {
        throw new Error('Advisory intelligence response invalid.');
      }
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'NVIDIA advisory intelligence unavailable.';
      setNvidiaError(msg);
    } finally {
      setNvidiaLoading(false);
    }
  }, []);

  // ===== LOADING STATE =====
  if (isLoading) {
    return (
      <div className="p-4 md:p-8 pb-20 max-w-7xl mx-auto space-y-6 text-primary-text">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <div className="h-7 w-80 bg-surface/80 rounded animate-pulse" />
            <div className="h-4 w-52 bg-surface/40 rounded animate-pulse" />
          </div>
          <div className="h-9 w-44 bg-surface/60 rounded animate-pulse" />
        </div>

        {/* Skeleton KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface border border-border rounded-[12px] p-5 h-28 flex flex-col justify-between animate-pulse">
              <div className="h-3 w-24 bg-surface-top rounded" />
              <div className="h-7 w-16 bg-surface-top rounded" />
            </div>
          ))}
        </div>

        {/* Skeleton grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-surface border border-border rounded-[12px] p-6 h-72 animate-pulse" />
          <div className="bg-surface border border-border rounded-[12px] p-6 lg:col-span-2 h-72 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-[12px] p-6 h-64 animate-pulse" />
          <div className="bg-surface border border-border rounded-[12px] p-6 h-64 animate-pulse" />
        </div>
      </div>
    );
  }

  // ===== ERROR STATE =====
  if (error || !data) {
    return (
      <div className="p-4 md:p-8 pb-20 max-w-7xl mx-auto space-y-6 text-primary-text">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">Command Center</h1>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-[12px] p-8 text-center space-y-4 max-w-xl mx-auto my-12">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">Intelligence Service Error</h2>
            <p className="text-xs text-secondary leading-relaxed">
              {error || 'Unable to retrieve security intelligence for your organization.'}
            </p>
          </div>
          <button
            onClick={() => loadIntelligence()}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 py-2 rounded-[6px] transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  // ===== DATA DERIVED VALUES =====
  const { riskPosture, findings, patterns, patternsSummary } = data;
  const displayFindings = showAllFindings ? findings : findings.slice(0, 8);
  const displayPatterns = showAllPatterns ? patterns : patterns.slice(0, 5);

  const severityEntries: { label: SeverityLevel; count: number }[] = [
    { label: 'CRITICAL', count: riskPosture.severityCounts.critical },
    { label: 'HIGH', count: riskPosture.severityCounts.high },
    { label: 'MEDIUM', count: riskPosture.severityCounts.medium },
    { label: 'LOW', count: riskPosture.severityCounts.low },
  ];
  const maxSeverityCount = Math.max(...severityEntries.map(e => e.count), 1);

  const categoryEntries = Object.entries(riskPosture.categoryBreakdown).map(([key, val]) => ({
    key,
    label: CATEGORY_LABELS[key] || key,
    ...val,
  }));

  const nvidiaAdvisory = nvidia?.nvidia;
  const nvidiaInsights = nvidiaAdvisory?.advisory?.insights ?? [];

  return (
    <div className="p-4 md:p-8 pb-20 max-w-7xl mx-auto space-y-6 animate-fade-in text-primary-text">

      {/* ================================================================ */}
      {/* PAGE HEADER                                                      */}
      {/* ================================================================ */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-400" />
            Security Intelligence Command Center
          </h1>
          <p className="text-xs text-secondary mt-1">
            Role: <span className="text-purple-400 font-semibold uppercase">{user?.role || 'Admin'}</span>
            {' '}&bull;{' '}
            Assessed: <span className="text-white font-semibold">{formatTimestamp(data.assessedAt)}</span>
          </p>
        </div>

        <button
          onClick={() => loadIntelligence(true)}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs px-4 py-2 rounded-[6px] transition-colors flex items-center gap-2 h-9 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Intelligence</span>
        </button>
      </div>

      {/* Authoritative label */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-[4px] bg-purple-500/10 text-purple-400 border border-purple-500/20">
          Authoritative
        </span>
        <span className="text-[10px] text-muted font-medium">NEXUS Deterministic Security Intelligence</span>
      </div>

      {/* ================================================================ */}
      {/* A. SECURITY POSTURE KPI ROW                                      */}
      {/* ================================================================ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* KPI: Risk Score */}
        <div className="bg-surface border border-border rounded-[12px] p-5 flex flex-col justify-between hover:border-purple-500/30 hover:shadow-[0_4px_20px_-4px_rgba(139,92,246,0.1)] transition-all duration-200">
          <span className="text-muted text-[10px] font-bold uppercase tracking-wider block">Risk Score</span>
          <div className="mt-4 flex items-baseline justify-between gap-3 w-full min-w-0">
            <span className={`text-2xl font-bold tracking-tight truncate shrink ${riskScoreColor(riskPosture.overallScore)}`}>
              {riskPosture.overallScore}
              <span className="text-xs text-muted"> / 100</span>
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border shrink-0 whitespace-nowrap ${severityBadgeClasses(riskPosture.severity)}`}>
              {riskPosture.severity}
            </span>
          </div>
        </div>

        {/* KPI: Status */}
        <div className="bg-surface border border-border rounded-[12px] p-5 flex flex-col justify-between hover:border-purple-500/30 hover:shadow-[0_4px_20px_-4px_rgba(139,92,246,0.1)] transition-all duration-200">
          <span className="text-muted text-[10px] font-bold uppercase tracking-wider block">Posture Status</span>
          <div className="mt-4 flex items-baseline justify-between gap-3 w-full min-w-0">
            <span className="text-2xl font-bold text-white tracking-tight truncate shrink">
              {riskPosture.status}
            </span>
          </div>
        </div>

        {/* KPI: Total Findings */}
        <div className="bg-surface border border-border rounded-[12px] p-5 flex flex-col justify-between hover:border-purple-500/30 hover:shadow-[0_4px_20px_-4px_rgba(139,92,246,0.1)] transition-all duration-200">
          <span className="text-muted text-[10px] font-bold uppercase tracking-wider block">Total Findings</span>
          <div className="mt-4 flex items-baseline justify-between gap-3 w-full min-w-0">
            <span className="text-2xl font-bold text-white tracking-tight truncate shrink">
              {riskPosture.totalFindings}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border shrink-0 whitespace-nowrap ${
              riskPosture.severityCounts.critical > 0
                ? 'bg-critical-bg text-critical-text border-critical-border'
                : riskPosture.totalFindings === 0
                  ? 'bg-healthy-bg text-healthy-text border-healthy-border'
                  : 'bg-warning-bg text-warning-text border-warning-border'
            }`}>
              {riskPosture.severityCounts.critical > 0 ? `${riskPosture.severityCounts.critical} Critical` : riskPosture.totalFindings === 0 ? 'Healthy' : 'Active'}
            </span>
          </div>
        </div>

        {/* KPI: Correlated Patterns */}
        <div className="bg-surface border border-border rounded-[12px] p-5 flex flex-col justify-between hover:border-purple-500/30 hover:shadow-[0_4px_20px_-4px_rgba(139,92,246,0.1)] transition-all duration-200">
          <span className="text-muted text-[10px] font-bold uppercase tracking-wider block">Correlated Patterns</span>
          <div className="mt-4 flex items-baseline justify-between gap-3 w-full min-w-0">
            <span className="text-2xl font-bold text-white tracking-tight truncate shrink">
              {patternsSummary.totalPatterns}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border shrink-0 whitespace-nowrap ${
              patternsSummary.criticalPatterns > 0
                ? 'bg-critical-bg text-critical-text border-critical-border'
                : patternsSummary.totalPatterns === 0
                  ? 'bg-healthy-bg text-healthy-text border-healthy-border'
                  : 'bg-warning-bg text-warning-text border-warning-border'
            }`}>
              {patternsSummary.criticalPatterns > 0 ? `${patternsSummary.criticalPatterns} Critical` : patternsSummary.totalPatterns === 0 ? 'None' : 'Active'}
            </span>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* B + C. POSTURE RING + SEVERITY DISTRIBUTION + CATEGORIES         */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Risk Posture Ring */}
        <div className="bg-surface border border-border rounded-[12px] p-6 flex flex-col hover:border-border/80 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Security Posture</h3>
            <Shield className="w-4 h-4 text-purple-400" />
          </div>

          <div className="relative h-32 w-full flex items-center justify-center">
            <div className="relative w-28 h-28">
              <svg className="w-28 h-28 transform -rotate-90" role="img" aria-label={`Risk score ${riskPosture.overallScore} out of 100`}>
                <title>Risk Score: {riskPosture.overallScore}/100</title>
                <circle cx="56" cy="56" r="46" stroke="var(--border)" strokeWidth="8" fill="transparent" />
                <circle
                  cx="56" cy="56" r="46"
                  stroke="url(#ccPostureGradient)"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray="289"
                  strokeDashoffset={289 - (289 * riskPosture.overallScore) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
                <defs>
                  <linearGradient id="ccPostureGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--brand-purple)" />
                    <stop offset="100%" stopColor="var(--brand-indigo)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-bold tracking-tight ${riskScoreColor(riskPosture.overallScore)}`}>
                  {riskPosture.overallScore}
                </span>
                <span className="text-[9px] text-muted uppercase font-bold tracking-wider">Risk</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border space-y-2 text-xs">
            <div className="flex justify-between text-secondary">
              <span>Identities at Risk</span>
              <span className="text-white font-semibold">{riskPosture.subjectBreakdown.identities.atRisk}</span>
            </div>
            <div className="flex justify-between text-secondary">
              <span>AI Agents at Risk</span>
              <span className="text-white font-semibold">{riskPosture.subjectBreakdown.aiAgents.atRisk}</span>
            </div>
            <div className="flex justify-between text-secondary">
              <span>Affected Subjects</span>
              <span className="text-white font-semibold">{patternsSummary.affectedSubjects}</span>
            </div>
          </div>
        </div>

        {/* Severity Distribution + Category Breakdown */}
        <div className="bg-surface border border-border rounded-[12px] p-6 lg:col-span-2 hover:border-border/80 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Severity Distribution</h3>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>

          {/* Severity Bars */}
          <div className="space-y-3 mb-6" role="list" aria-label="Severity distribution">
            {severityEntries.map(({ label, count }) => (
              <div key={label} className="flex items-center gap-3" role="listitem">
                <span className={`text-[10px] font-bold uppercase tracking-wider w-16 shrink-0 ${
                  label === 'CRITICAL' ? 'text-critical-text' :
                  label === 'HIGH' ? 'text-warning-text' :
                  label === 'MEDIUM' ? 'text-info-text' : 'text-secondary'
                }`}>
                  {label}
                </span>
                <div className="flex-1 h-5 bg-background rounded-[4px] overflow-hidden border border-border">
                  <div
                    className={`h-full ${severityBarColor(label)} transition-all duration-500 rounded-[3px]`}
                    style={{ width: `${Math.max((count / maxSeverityCount) * 100, count > 0 ? 4 : 0)}%` }}
                    role="meter"
                    aria-label={`${label}: ${count}`}
                    aria-valuenow={count}
                    aria-valuemin={0}
                    aria-valuemax={maxSeverityCount}
                  />
                </div>
                <span className="text-xs font-bold text-white w-8 text-right tabular-nums">{count}</span>
              </div>
            ))}
          </div>

          {/* Category Breakdown */}
          <div className="border-t border-border pt-4">
            <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Risk Categories</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {categoryEntries.map((cat) => (
                <div key={cat.key} className="p-3 bg-background border border-border rounded-[8px]">
                  <span className="block text-[10px] text-muted font-bold uppercase mb-1">{cat.label}</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-bold text-white">{cat.count}</span>
                    {cat.criticalCount > 0 && (
                      <span className="text-[9px] font-semibold text-critical-text">{cat.criticalCount} crit</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* D. TOP RISK CONTRIBUTORS                                         */}
      {/* ================================================================ */}
      {riskPosture.topRiskContributors.length > 0 && (
        <div className="bg-surface border border-border rounded-[12px] p-6 hover:border-border/80 transition-colors">
          <div className="flex justify-between items-start mb-4 border-b border-border pb-3">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Top Risk Contributors</h3>
            <ShieldAlert className="w-4 h-4 text-critical-text" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs" role="table">
              <thead>
                <tr className="text-muted text-[10px] uppercase tracking-wider border-b border-border">
                  <th className="text-left py-2 pr-3 font-bold">Subject</th>
                  <th className="text-left py-2 pr-3 font-bold">Type</th>
                  <th className="text-left py-2 pr-3 font-bold">Severity</th>
                  <th className="text-left py-2 pr-3 font-bold">Finding</th>
                  <th className="text-right py-2 font-bold">Risk</th>
                </tr>
              </thead>
              <tbody>
                {riskPosture.topRiskContributors.slice(0, 10).map((contributor) => {
                  const href = subjectLink(contributor.subjectId, contributor.subjectType);
                  return (
                    <tr key={contributor.findingId} className="border-b border-border/50 hover:bg-background/50 transition-colors">
                      <td className="py-2.5 pr-3">
                        {href ? (
                          <Link href={href} className="text-white font-semibold hover:text-purple-400 transition-colors inline-flex items-center gap-1">
                            {contributor.subjectName || contributor.subjectId}
                            <Link2 className="w-3 h-3 text-muted" />
                          </Link>
                        ) : (
                          <span className="text-white font-semibold">{contributor.subjectName || contributor.subjectId}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="text-secondary capitalize">{contributor.subjectType.replace('_', ' ')}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${severityBadgeClasses(contributor.severity)}`}>
                          {contributor.severity}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="text-secondary">{contributor.title}</span>
                      </td>
                      <td className="py-2.5 text-right">
                        <span className={`font-bold tabular-nums ${
                          contributor.riskContribution >= 30 ? 'text-critical-text' :
                          contributor.riskContribution >= 15 ? 'text-warning-text' : 'text-white'
                        }`}>
                          {contributor.riskContribution}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* E + F. FINDINGS + PATTERNS                                       */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* E. Active Security Findings */}
        <div className="bg-surface border border-border rounded-[12px] p-6 hover:border-border/80 transition-colors">
          <div className="flex justify-between items-start mb-4 border-b border-border pb-3">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Active Security Findings</h3>
            <ShieldAlert className="w-4 h-4 text-warning-text" />
          </div>

          {findings.length === 0 ? (
            <div className="p-6 bg-background border border-border rounded-[8px] flex items-center gap-3 text-secondary text-xs">
              <ShieldCheck className="w-5 h-5 text-healthy-text shrink-0" />
              <div>
                <h4 className="text-xs font-semibold text-white">No active security findings</h4>
                <p className="text-[11px] text-muted mt-0.5">Deterministic detection engine found no issues.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {(displayFindings as CommandCenterFinding[]).map((finding) => (
                <div key={finding.id} className="p-3 bg-background border border-border rounded-[8px] space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${severityBadgeClasses(finding.severity)}`}>
                      {finding.severity}
                    </span>
                    <span className="text-xs font-semibold text-white truncate">{finding.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted">
                    <span className="capitalize">{finding.subjectType.replace('_', ' ')}</span>
                    <span>&bull;</span>
                    <span>{CATEGORY_LABELS[finding.category] || finding.category}</span>
                    <span>&bull;</span>
                    <span>{formatTimestamp(finding.detectedAt)}</span>
                  </div>
                </div>
              ))}
              {findings.length > 8 && (
                <button
                  onClick={() => setShowAllFindings(!showAllFindings)}
                  className="w-full text-center text-[10px] font-semibold text-purple-400 hover:text-purple-300 py-2 transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  {showAllFindings ? (
                    <><ChevronUp className="w-3 h-3" /> Show Less</>
                  ) : (
                    <><ChevronDown className="w-3 h-3" /> Show All {findings.length} Findings</>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* F. Correlated Security Patterns */}
        <div className="bg-surface border border-border rounded-[12px] p-6 hover:border-border/80 transition-colors">
          <div className="flex justify-between items-start mb-4 border-b border-border pb-3">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Correlated Security Patterns</h3>
            <Activity className="w-4 h-4 text-info-text" />
          </div>

          {patterns.length === 0 ? (
            <div className="p-6 bg-background border border-border rounded-[8px] flex items-center gap-3 text-secondary text-xs">
              <ShieldCheck className="w-5 h-5 text-healthy-text shrink-0" />
              <div>
                <h4 className="text-xs font-semibold text-white">No correlated patterns detected</h4>
                <p className="text-[11px] text-muted mt-0.5">Alert correlation engine found no active attack patterns.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {(displayPatterns as CommandCenterPattern[]).map((pattern) => (
                <div key={pattern.id} className="p-3 bg-background border border-border rounded-[8px] space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${severityBadgeClasses(pattern.severity)}`}>
                      {pattern.severity}
                    </span>
                    <span className="text-xs font-semibold text-white truncate">{pattern.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted">
                    <span className="capitalize">{pattern.patternType.replace(/_/g, ' ').toLowerCase()}</span>
                    <span>&bull;</span>
                    <span>{pattern.subjectName || pattern.subjectId}</span>
                    <span>&bull;</span>
                    <span>{pattern.correlatedFindingIds.length} findings</span>
                    <span>&bull;</span>
                    <span>{formatTimestamp(pattern.detectedAt)}</span>
                  </div>
                </div>
              ))}
              {patterns.length > 5 && (
                <button
                  onClick={() => setShowAllPatterns(!showAllPatterns)}
                  className="w-full text-center text-[10px] font-semibold text-purple-400 hover:text-purple-300 py-2 transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  {showAllPatterns ? (
                    <><ChevronUp className="w-3 h-3" /> Show Less</>
                  ) : (
                    <><ChevronDown className="w-3 h-3" /> Show All {patterns.length} Patterns</>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* G. IDENTITY VS AI AGENT RISK                                     */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Identity Risk */}
        <div className="bg-surface border border-border rounded-[12px] p-6 hover:border-border/80 transition-colors">
          <div className="flex justify-between items-start mb-4 border-b border-border pb-3">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-400" />
              Identity Risk
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-background border border-border rounded-[8px] text-center">
              <span className="block text-[10px] text-muted font-bold uppercase mb-1">Total</span>
              <span className="text-xl font-bold text-white">{riskPosture.subjectBreakdown.identities.total}</span>
            </div>
            <div className="p-3 bg-background border border-border rounded-[8px] text-center">
              <span className="block text-[10px] text-muted font-bold uppercase mb-1">At Risk</span>
              <span className={`text-xl font-bold ${riskPosture.subjectBreakdown.identities.atRisk > 0 ? 'text-warning-text' : 'text-healthy-text'}`}>
                {riskPosture.subjectBreakdown.identities.atRisk}
              </span>
            </div>
            <div className="p-3 bg-background border border-border rounded-[8px] text-center">
              <span className="block text-[10px] text-muted font-bold uppercase mb-1">Avg Risk</span>
              <span className={`text-xl font-bold ${riskScoreColor(riskPosture.subjectBreakdown.identities.averageRiskScore)}`}>
                {riskPosture.subjectBreakdown.identities.averageRiskScore}
              </span>
            </div>
            <div className="p-3 bg-background border border-border rounded-[8px] text-center">
              <span className="block text-[10px] text-muted font-bold uppercase mb-1">Findings</span>
              <span className="text-xl font-bold text-white">{riskPosture.subjectBreakdown.identities.findingsCount}</span>
            </div>
          </div>
        </div>

        {/* AI Agent Risk */}
        <div className="bg-surface border border-border rounded-[12px] p-6 hover:border-border/80 transition-colors">
          <div className="flex justify-between items-start mb-4 border-b border-border pb-3">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-purple-400" />
              AI Agent Risk
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-background border border-border rounded-[8px] text-center">
              <span className="block text-[10px] text-muted font-bold uppercase mb-1">Total</span>
              <span className="text-xl font-bold text-white">{riskPosture.subjectBreakdown.aiAgents.total}</span>
            </div>
            <div className="p-3 bg-background border border-border rounded-[8px] text-center">
              <span className="block text-[10px] text-muted font-bold uppercase mb-1">At Risk</span>
              <span className={`text-xl font-bold ${riskPosture.subjectBreakdown.aiAgents.atRisk > 0 ? 'text-warning-text' : 'text-healthy-text'}`}>
                {riskPosture.subjectBreakdown.aiAgents.atRisk}
              </span>
            </div>
            <div className="p-3 bg-background border border-border rounded-[8px] text-center">
              <span className="block text-[10px] text-muted font-bold uppercase mb-1">Avg Risk</span>
              <span className={`text-xl font-bold ${riskScoreColor(riskPosture.subjectBreakdown.aiAgents.averageRiskScore)}`}>
                {riskPosture.subjectBreakdown.aiAgents.averageRiskScore}
              </span>
            </div>
            <div className="p-3 bg-background border border-border rounded-[8px] text-center">
              <span className="block text-[10px] text-muted font-bold uppercase mb-1">Findings</span>
              <span className="text-xl font-bold text-white">{riskPosture.subjectBreakdown.aiAgents.findingsCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* TRUST BOUNDARY SEPARATOR                                         */}
      {/* ================================================================ */}
      <div className="border-t border-border pt-6 mt-2">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-[4px] bg-teal-500/10 text-teal-400 border border-teal-500/20">
            Advisory
          </span>
          <span className="text-[10px] text-muted font-medium">NVIDIA Security Intelligence — AI-Generated Advisory</span>
        </div>
      </div>

      {/* ================================================================ */}
      {/* H. NVIDIA ADVISORY INTELLIGENCE                                  */}
      {/* ================================================================ */}
      <div className="bg-surface border border-teal-500/15 rounded-[12px] p-6 hover:border-teal-500/25 transition-colors">
        <div className="flex justify-between items-start mb-4 border-b border-border pb-3">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-teal-400" />
            <span>NVIDIA Advisory Intelligence</span>
            <span className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 ml-1">
              AI-Generated Advisory
            </span>
          </h3>
        </div>

        {/* Not requested yet */}
        {!nvidiaRequested && !nvidiaLoading && (
          <div className="text-center py-6 space-y-3">
            <Sparkles className="w-8 h-8 text-teal-400/50 mx-auto" />
            <p className="text-xs text-secondary">
              NVIDIA advisory intelligence provides AI-generated security insights.
            </p>
            <p className="text-[10px] text-muted">
              Advisory analysis is optional and does not affect authoritative security posture.
            </p>
            <button
              onClick={generateAdvisory}
              className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-semibold text-xs px-5 py-2.5 rounded-[6px] transition-colors inline-flex items-center gap-2 cursor-pointer mt-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Advisory</span>
            </button>
          </div>
        )}

        {/* Loading */}
        {nvidiaLoading && (
          <div className="text-center py-8 space-y-3">
            <Loader2 className="w-8 h-8 text-teal-400 mx-auto animate-spin" />
            <p className="text-xs text-secondary">Generating NVIDIA advisory intelligence...</p>
            <p className="text-[10px] text-muted">This may take several seconds. Deterministic intelligence remains active.</p>
          </div>
        )}

        {/* Error */}
        {!nvidiaLoading && nvidiaError && (
          <div className="bg-background border border-border rounded-[8px] p-4 text-center space-y-2">
            <AlertCircle className="w-5 h-5 text-muted mx-auto" />
            <p className="text-xs text-white font-medium">NVIDIA Advisory Intelligence Unavailable</p>
            <p className="text-[10px] text-muted leading-relaxed">
              Deterministic NEXUS intelligence remains active. Advisory analysis is optional.
            </p>
            <button
              onClick={generateAdvisory}
              className="text-[10px] font-semibold text-teal-400 hover:text-teal-300 transition-colors cursor-pointer mt-1"
            >
              Retry Advisory
            </button>
          </div>
        )}

        {/* NVIDIA available but not available */}
        {!nvidiaLoading && !nvidiaError && nvidiaAdvisory && !nvidiaAdvisory.available && (
          <div className="bg-background border border-border rounded-[8px] p-4 text-center space-y-1">
            <ShieldCheck className="w-5 h-5 text-healthy-text mx-auto mb-1" />
            <p className="text-xs text-white font-medium">NVIDIA Advisory Intelligence Unavailable</p>
            <p className="text-[10px] text-muted">
              NVIDIA is disabled or not configured. Deterministic NEXUS intelligence remains active.
            </p>
          </div>
        )}

        {/* NVIDIA advisory results */}
        {!nvidiaLoading && !nvidiaError && nvidiaAdvisory?.available && nvidiaAdvisory.advisory && (
          <div className="space-y-4">
            {/* Advisory metadata */}
            <div className="flex items-center gap-3 text-[10px] text-muted flex-wrap">
              <span>Confidence: <span className="text-white font-semibold">{(nvidiaAdvisory.advisory.confidence * 100).toFixed(0)}%</span></span>
              <span>&bull;</span>
              <span>Model: <span className="text-white font-semibold">{nvidiaAdvisory.advisory.model}</span></span>
              <span>&bull;</span>
              <span>Generated: <span className="text-white font-semibold">{formatTimestamp(nvidiaAdvisory.advisory.generatedAt)}</span></span>
            </div>

            {/* Rationale */}
            {nvidiaAdvisory.advisory.rationale && (
              <div className="bg-background border border-border rounded-[8px] p-3">
                <span className="text-[9px] font-bold uppercase tracking-wider text-teal-400 block mb-1">Advisory Rationale</span>
                <p className="text-[11px] text-secondary leading-relaxed">{nvidiaAdvisory.advisory.rationale}</p>
              </div>
            )}

            {/* Insights */}
            {nvidiaInsights.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider">Advisory Insights</h4>
                {nvidiaInsights.map((insight, idx) => (
                  <div key={idx} className="p-3 bg-background border border-border rounded-[8px] space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${severityBadgeClasses(insight.severity)}`}>
                        {insight.severity}
                      </span>
                      <span className="text-[9px] font-semibold text-teal-400 uppercase">{insight.category.replace(/_/g, ' ')}</span>
                      <span className="text-xs font-semibold text-white truncate">{insight.title}</span>
                    </div>
                    <p className="text-[11px] text-secondary leading-relaxed">{insight.description}</p>
                    {insight.relatedFindingIds.length > 0 && (
                      <p className="text-[10px] text-muted">Related findings: {insight.relatedFindingIds.length}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {nvidiaInsights.length === 0 && (
              <div className="bg-background border border-border rounded-[8px] p-4 text-center">
                <p className="text-xs text-white font-medium">No advisory insights generated</p>
                <p className="text-[10px] text-muted">NVIDIA analysis found no additional observations beyond deterministic intelligence.</p>
              </div>
            )}

            {/* Re-generate button */}
            <div className="pt-2 border-t border-border">
              <button
                onClick={generateAdvisory}
                className="text-[10px] font-semibold text-teal-400 hover:text-teal-300 transition-colors cursor-pointer inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Regenerate Advisory
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
