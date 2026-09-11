import React from 'react';
import { getRiskBgColor } from '@/lib/risk-utils';

export function RiskBadge({ score, className = '' }: { score: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center font-mono tabular-nums px-2.5 py-0.5 text-xs font-semibold rounded-[6px] border shrink-0 transition-all duration-150 ${getRiskBgColor(
        score
      )} ${className}`}
    >
      {score}
    </span>
  );
}

export function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  let style = 'bg-surface-top text-muted border-border';
  let dotColor = 'bg-muted';

  if (status === 'Active' || status === 'ALLOWED') {
    style = 'bg-healthy-bg text-healthy-text border-healthy-border';
    dotColor = 'bg-emerald-400';
  } else if (status === 'BLOCKED' || status === 'Suspended') {
    style = 'bg-critical-bg text-critical-text border-critical-border';
    dotColor = 'bg-red-400';
  } else if (status === 'REVIEW' || status === 'ALERT') {
    style = 'bg-warning-bg text-warning-text border-warning-border';
    dotColor = 'bg-amber-400';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-semibold rounded-[6px] border shrink-0 transition-all duration-150 ${style} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{status}</span>
    </span>
  );
}
