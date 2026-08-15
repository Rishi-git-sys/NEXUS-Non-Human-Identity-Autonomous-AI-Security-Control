export interface Integration {
  id: string;
  name: string;
  description: string;
  type: string;
  status: 'Connected' | 'Available' | 'Coming Soon';
  category: 'Cloud' | 'VCS' | 'Orchestration' | 'Identity' | 'Agent Framework';
}
