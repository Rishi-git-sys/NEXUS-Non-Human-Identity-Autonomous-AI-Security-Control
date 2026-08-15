import { RiskPostureSummary, RiskTrendPoint } from '../types/risk';

export const mockRiskPosture: RiskPostureSummary = {
  overallScore: 72,
  criticalCount: 4,
  highCount: 13,
  mediumCount: 52,
  healthyCount: 115
};

export const mockTrend7d: RiskTrendPoint[] = [
  { day: 'Mon', blocked: 8, baseline: 42, violations: 0 },
  { day: 'Tue', blocked: 12, baseline: 48, violations: 1 },
  { day: 'Wed', blocked: 5, baseline: 45, violations: 0 },
  { day: 'Thu', blocked: 19, baseline: 55, violations: 2 },
  { day: 'Fri', blocked: 14, baseline: 50, violations: 1 },
  { day: 'Sat', blocked: 6, baseline: 38, violations: 0 },
  { day: 'Sun', blocked: 11, baseline: 40, violations: 1 }
];

export const mockTrend30d: RiskTrendPoint[] = [
  { day: 'Week 1', blocked: 45, baseline: 280, violations: 3 },
  { day: 'Week 2', blocked: 62, baseline: 310, violations: 5 },
  { day: 'Week 3', blocked: 38, baseline: 295, violations: 2 },
  { day: 'Week 4', blocked: 78, baseline: 340, violations: 7 }
];

export const mockTrend90d: RiskTrendPoint[] = [
  { day: 'May', blocked: 180, baseline: 1150, violations: 12 },
  { day: 'Jun', blocked: 240, baseline: 1280, violations: 18 },
  { day: 'Jul', blocked: 195, baseline: 1210, violations: 10 },
  { day: 'Aug', blocked: 285, baseline: 1400, violations: 22 }
];
