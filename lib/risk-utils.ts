import { RiskLevel } from '../types/nexus';

export function getRiskLevel(score: number): RiskLevel {
  if (score < 40) return 'Healthy';
  if (score < 70) return 'Medium';
  if (score < 90) return 'High';
  return 'Critical';
}

export function getRiskColor(score: number): string {
  const level = getRiskLevel(score);
  switch (level) {
    case 'Healthy':
      return 'text-healthy-text';
    case 'Medium':
      return 'text-secondary';
    case 'High':
      return 'text-warning-text';
    case 'Critical':
      return 'text-critical-text';
    default:
      return 'text-muted';
  }
}

export function getRiskBgColor(score: number): string {
  const level = getRiskLevel(score);
  switch (level) {
    case 'Healthy':
      return 'bg-healthy-bg text-healthy-text border-healthy-border';
    case 'Medium':
      return 'bg-surface-top text-secondary border-border';
    case 'High':
      return 'bg-warning-bg text-warning-text border-warning-border';
    case 'Critical':
      return 'bg-critical-bg text-critical-text border-critical-border';
    default:
      return 'bg-surface-top text-muted border-border';
  }
}
