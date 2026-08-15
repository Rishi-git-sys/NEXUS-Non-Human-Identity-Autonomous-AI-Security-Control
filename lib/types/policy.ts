import { ActionDecision } from '@/types/nexus';

export interface PolicyCondition {
  field: string;
  operator: string;
  value: string;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  scope: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Active' | 'Inactive' | 'Draft';
  lastUpdated: string;
  violations: number;
  conditions: PolicyCondition[];
  decision: ActionDecision;
}
