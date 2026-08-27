export interface SharedGraphContract {
  readonly schemaVersion: 'typescript-graph-contract/v1';
  readonly graph: 'web' | 'worker' | 'tools' | 'test';
}
