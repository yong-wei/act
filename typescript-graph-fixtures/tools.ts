import type { SharedGraphContract } from './shared-contract.declaration';

const fixture: SharedGraphContract = {
  schemaVersion: 'typescript-graph-contract/v1',
  graph: 'tools',
};

export const toolsGraphFixture: string = fixture.graph;
