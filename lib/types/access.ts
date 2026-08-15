export interface GraphNode {
  id: string;
  label: string;
  type: 'Identity' | 'Agent' | 'Application' | 'API' | 'Database' | 'Resource';
  riskScore: number;
  status: string;
  description: string;
  column: number;
  x: number;
  y: number;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationType: string;
  grantedBy: string;
  createdAt: string;
  status: 'normal' | 'warning' | 'critical';
}

export interface AccessGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  totalRelationships: number;
}
