import { getRiskBgColor } from '@/lib/risk-utils';

export function RiskBadge({ score, className = '' }: { score: number; className?: string }) {
  return (
    <span className={`px-2.5 py-1 text-xs font-semibold rounded-[6px] border shrink-0 whitespace-nowrap ${getRiskBgColor(score)} ${className}`}>
      {score}
    </span>
  );
}

export function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  let style = 'bg-surface-top text-muted border-border'; // Default / Idle
  
  if (status === 'Active' || status === 'ALLOWED') {
    style = 'bg-healthy-bg text-healthy-text border-healthy-border';
  } else if (status === 'BLOCKED' || status === 'Suspended') {
    style = 'bg-critical-bg text-critical-text border-critical-border';
  } else if (status === 'REVIEW' || status === 'ALERT') {
    style = 'bg-warning-bg text-warning-text border-warning-border';
  }

  return (
    <span className={`px-2.5 py-1 text-[11px] uppercase tracking-wider font-semibold rounded-[6px] border shrink-0 whitespace-nowrap ${style} ${className}`}>
      {status}
    </span>
  );
}
