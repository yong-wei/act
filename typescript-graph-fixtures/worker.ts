import type { SharedGraphContract } from './shared-contract.declaration';

const fixture: SharedGraphContract = {
  schemaVersion: 'typescript-graph-contract/v1',
  graph: 'worker',
};

export const workerGraphFixture: string = fixture.graph;
