import { mockRiskPosture, mockTrend7d, mockTrend30d, mockTrend90d } from '../mock/risk';
import { RiskPostureSummary, RiskTrendPoint } from '../types/risk';

export const riskService = {
  getRiskPosture(): RiskPostureSummary {
    return mockRiskPosture;
  },

  getRiskTrend(timeframe: '7d' | '30d' | '90d'): RiskTrendPoint[] {
    switch (timeframe) {
      case '7d':
        return mockTrend7d;
      case '30d':
        return mockTrend30d;
      case '90d':
        return mockTrend90d;
      default:
        return mockTrend7d;
    }
  }
};
