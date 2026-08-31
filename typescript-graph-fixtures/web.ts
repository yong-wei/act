import type { SharedGraphContract } from './shared-contract';

const fixture: SharedGraphContract = {
  schemaVersion: 'typescript-graph-contract/v1',
  graph: 'web',
};

export const webGraphFixture: string = fixture.graph;
