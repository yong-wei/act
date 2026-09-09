declare module 'd3-force-3d' {
  import type { Simulation, SimulationLinkDatum, SimulationNodeDatum, forceY } from 'd3-force';
  export { forceCollide, forceLink, forceManyBody, forceX, forceY } from 'd3-force';
  export const forceZ: typeof forceY;
  export function forceSimulation<
    Node extends SimulationNodeDatum,
    Link extends SimulationLinkDatum<Node> | undefined = undefined,
  >(nodes?: Node[], dimensions?: number): Simulation<Node, Link>;
}
