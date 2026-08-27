// Stable declaration boundary for the Web-owned shared graph contract.
// The source owner is typescript-graph-fixtures/shared-contract.ts.
export interface SharedGraphContract {
  readonly schemaVersion: 'typescript-graph-contract/v1';
  readonly graph: 'web' | 'worker' | 'tools' | 'test';
}
