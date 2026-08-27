import type { SharedGraphContract } from './shared-contract.declaration';

const fixture: SharedGraphContract = {
  schemaVersion: 'typescript-graph-contract/v1',
  graph: 'test',
};

export const testGraphFixture: string = fixture.graph;
