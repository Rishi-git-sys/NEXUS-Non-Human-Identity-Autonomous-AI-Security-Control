export interface RiskTrendPoint {
  day: string;
  blocked: number;
  baseline: number;
  violations: number;
}

export interface RiskPostureSummary {
  overallScore: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  healthyCount: number;
}
