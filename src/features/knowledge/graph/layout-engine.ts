import { KnowledgeNodeData, KnowledgeLinkData } from '../knowledge-graph-system';

/**
 * Calculates a Radial Layout for the graph.
 * Since the data might not be a strict tree, we use a BFS approach to determine "levels" (hops from center).
 * 
 * @param nodes List of nodes
 * @param links List of links
 * @param centerId Optional ID of the center node. If omitted, the node with highest degree is chosen.
 * @param radiusStep Distance between concentric circles
 */
export function applyRadialLayout(
  nodes: KnowledgeNodeData[],
  links: KnowledgeLinkData[],
  centerId?: string,
  radiusStep: number = 150
): KnowledgeNodeData[] {
  if (nodes.length === 0) return [];

  // 1. Build Adjacency List & Degree Count
  const adjacency: Record<string, string[]> = {};
  const degrees: Record<string, number> = {};
  
  nodes.forEach(n => {
    adjacency[n.id] = [];
    degrees[n.id] = 0;
  });

  links.forEach(link => {
    if (adjacency[link.sourceId]) adjacency[link.sourceId].push(link.targetId);
    if (adjacency[link.targetId]) adjacency[link.targetId].push(link.sourceId);
    
    degrees[link.sourceId] = (degrees[link.sourceId] || 0) + 1;
    degrees[link.targetId] = (degrees[link.targetId] || 0) + 1;
  });

  // 2. Determine Center Node
  let rootId = centerId;
  if (!rootId) {
    // Find node with max degree
    let maxDegree = -1;
    for (const id in degrees) {
      if (degrees[id] > maxDegree) {
        maxDegree = degrees[id];
        rootId = id;
      }
    }
  }

  if (!rootId) return nodes; // Should not happen if nodes > 0

  // 3. BFS to assign levels (depth)
  const levels: Record<string, number> = {};
  const visited = new Set<string>();
  const queue: { id: string; level: number }[] = [{ id: rootId, level: 0 }];
  
  visited.add(rootId);
  levels[rootId] = 0;

  let maxLevel = 0;

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    maxLevel = Math.max(maxLevel, level);

    const neighbors = adjacency[id] || [];
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        levels[neighborId] = level + 1;
        queue.push({ id: neighborId, level: level + 1 });
      }
    }
  }

  // Handle disconnected nodes (assign to maxLevel + 1)
  nodes.forEach(n => {
    if (!visited.has(n.id)) {
      levels[n.id] = maxLevel + 1;
    }
  });

  // 4. Assign Coordinates
  // Group nodes by level
  const nodesByLevel: Record<number, KnowledgeNodeData[]> = {};
  nodes.forEach(n => {
    const lvl = levels[n.id];
    if (!nodesByLevel[lvl]) nodesByLevel[lvl] = [];
    nodesByLevel[lvl].push(n);
  });

  // Assign x, y
  // Level 0 is at (0,0)
  const resultNodes = nodes.map(n => ({ ...n })); // Clone to avoid mutating original state refs if any

  resultNodes.forEach(n => {
    const lvl = levels[n.id];
    
    if (lvl === 0) {
      n.positionX = 0;
      n.positionY = 0; // Using 2D plane, mapping to positionX/Y (or we can use x/y for the library)
      // Note: react-force-graph uses x, y. Our data has positionX, positionY, positionZ.
      // We will inject x, y properties.
      (n as any).x = 0;
      (n as any).y = 0;
      (n as any).fx = 0; // Fix the center? Optional. Let's not fix it so it can drift slightly.
      (n as any).fy = 0;
      return;
    }

    const levelNodes = nodesByLevel[lvl];
    const index = levelNodes.findIndex(node => node.id === n.id);
    const totalInLevel = levelNodes.length;
    
    // Spread evenly around the circle
    // We add a random phase shift per level to avoid alignment artifacts
    const phaseShift = lvl * (Math.PI / 4); 
    const angle = (index / totalInLevel) * 2 * Math.PI + phaseShift;
    const radius = lvl * radiusStep;

    (n as any).x = radius * Math.cos(angle);
    (n as any).y = radius * Math.sin(angle);
  });

  return resultNodes;
}
