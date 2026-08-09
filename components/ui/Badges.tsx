import { getRiskBgColor } from '@/lib/risk-utils';

export function RiskBadge({ score, className = '' }: { score: number; className?: string }) {
  return (
    <span className={`px-2.5 py-1 text-xs font-semibold rounded-[6px] border ${getRiskBgColor(score)} ${className}`}>
      {score}
    </span>
  );
}

export function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  let style = 'bg-[#23262b]/50 text-[#9a9da3] border-[#23262b]'; // Default / Idle
  
  if (status === 'Active' || status === 'ALLOWED') {
    style = 'bg-[#5bd48f]/10 text-[#5bd48f] border-[#5bd48f]/20';
  } else if (status === 'BLOCKED' || status === 'Suspended') {
    style = 'bg-[#ff6b6b]/10 text-[#ff6b6b] border-[#ff6b6b]/20';
  } else if (status === 'REVIEW' || status === 'ALERT') {
    style = 'bg-[#f2a623]/10 text-[#f2a623] border-[#f2a623]/20';
  }

  return (
    <span className={`px-2.5 py-1 text-[11px] uppercase tracking-wider font-semibold rounded-[6px] border ${style} ${className}`}>
      {status}
    </span>
  );
}
