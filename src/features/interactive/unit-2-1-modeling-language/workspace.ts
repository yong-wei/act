export interface WorkspaceParameterChange {
  key: string;
  value: number | string;
  source: 'slider' | 'toggle' | 'input' | 'preset';
}
