import { getKnowledgeGraphRelationContract } from './relation-contract';
import {
  getKnowledgeNodeLabelBounds,
  type KnowledgeNodeLabelBounds,
  type KnowledgeNodeLabelMeasureText,
} from './node-label-layout';
import { getKnowledgeNodeMaximumPresentationRadius } from './visual-config';

interface TeachingOrderNode {
  id: string;
  name?: string;
  metadata?: Record<string, unknown> | null;
  graphDegree?: number | null;
}

interface TeachingOrderLink {
  id?: string;
  relation?: string;
  relationType?: string;
  sourceId: string;
  targetId: string;
}

export interface KnowledgeTeachingOrderDiagnostic {
  code: 'LESSON_POST_REQUISITE_CONFLICT' | 'POST_REQUISITE_CYCLE';
  nodeIds?: string[];
  relationId?: string;
}

export interface KnowledgeTeachingOrderLayoutResult<T extends TeachingOrderNode> {
  bounds: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number };
  collisionBoundsByNodeId: Record<string, KnowledgeNodeLabelBounds>;
  cycleGroups: string[][];
  diagnostics: KnowledgeTeachingOrderDiagnostic[];
  fitScale: number;
  iterations: number;
  /**
   * 确定性教学序坐标是软种子（x/y/z + positionX/Y/Z），不再拥有 fx/fy/fz；
   * 力学引擎从种子出发自然沉降，固定坐标只属于治理锚点与用户 pin（#1739）。
   */
  nodes: Array<T & {
    x: number;
    y: number;
    z: number;
    positionX: number;
    positionY: number;
    positionZ: number;
  }>;
  orderNodeIds: string[];
  positions: Record<string, { x: number; y: number }>;
  unorderedNodeIds: string[];
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function hasDirectedPath(adjacency: ReadonlyMap<string, ReadonlySet<string>>, startId: string, targetId: string): boolean {
  const pending = [startId];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const nodeId = pending.pop()!;
    if (nodeId === targetId) return true;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    for (const nextId of adjacency.get(nodeId) ?? []) pending.push(nextId);
  }
  return false;
}

function stronglyConnectedComponents(nodeIds: readonly string[], links: readonly TeachingOrderLink[]): string[][] {
  const adjacency = new Map(nodeIds.map((id) => [id, [] as string[]]));
  links.forEach((link) => adjacency.get(link.sourceId)?.push(link.targetId));
  adjacency.forEach((targets) => targets.sort(compareIds));
  const indexById = new Map<string, number>();
  const lowLinkById = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  let nextIndex = 0;

  const visit = (nodeId: string) => {
    indexById.set(nodeId, nextIndex);
    lowLinkById.set(nodeId, nextIndex);
    nextIndex += 1;
    stack.push(nodeId);
    onStack.add(nodeId);
    for (const targetId of adjacency.get(nodeId) ?? []) {
      if (!indexById.has(targetId)) {
        visit(targetId);
        lowLinkById.set(nodeId, Math.min(lowLinkById.get(nodeId)!, lowLinkById.get(targetId)!));
      } else if (onStack.has(targetId)) {
        lowLinkById.set(nodeId, Math.min(lowLinkById.get(nodeId)!, indexById.get(targetId)!));
      }
    }
    if (lowLinkById.get(nodeId) !== indexById.get(nodeId)) return;
    const component: string[] = [];
    while (stack.length > 0) {
      const member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
      if (member === nodeId) break;
    }
    components.push(component.sort(compareIds));
  };

  [...nodeIds].sort(compareIds).forEach((nodeId) => {
    if (!indexById.has(nodeId)) visit(nodeId);
  });
  return components;
}

export function buildKnowledgeTeachingOrderLayout<T extends TeachingOrderNode>(input: {
  nodes: readonly T[];
  links: readonly TeachingOrderLink[];
  lessonOrderNodeIds: readonly string[];
  viewportWidth: number;
  viewportHeight: number;
  measureText?: KnowledgeNodeLabelMeasureText;
}): KnowledgeTeachingOrderLayoutResult<T> {
  const maximumIterations = 512;
  let iterations = 0;
  const nodeIds = new Set(input.nodes.map((node) => node.id));
  const lessonOrderNodeIds = [...new Set(input.lessonOrderNodeIds.filter((id) => nodeIds.has(id)))];
  const lessonIndex = new Map(lessonOrderNodeIds.map((id, index) => [id, index]));
  const diagnostics: KnowledgeTeachingOrderDiagnostic[] = [];
  const postLinks = input.links.filter((link) => {
    if (!nodeIds.has(link.sourceId) || !nodeIds.has(link.targetId)) return false;
    const contract = getKnowledgeGraphRelationContract(link.relationType ?? link.relation);
    return contract?.family === 'post-requisite';
  });
  const precedenceAdjacency = new Map<string, Set<string>>(
    [...nodeIds].map((nodeId) => [nodeId, new Set<string>()])
  );
  lessonOrderNodeIds.slice(1).forEach((nodeId, index) => {
    precedenceAdjacency.get(lessonOrderNodeIds[index])!.add(nodeId);
  });
  const eligiblePostLinks: TeachingOrderLink[] = [];
  [...postLinks].sort((left, right) => (
    compareIds(left.sourceId, right.sourceId)
    || compareIds(left.targetId, right.targetId)
    || compareIds(left.relationType ?? left.relation ?? '', right.relationType ?? right.relation ?? '')
    || compareIds(left.id ?? '', right.id ?? '')
  )).forEach((link) => {
    const targets = precedenceAdjacency.get(link.sourceId)!;
    const alreadyPresent = targets.has(link.targetId);
    targets.add(link.targetId);
    const contradictsLessonOrder = lessonOrderNodeIds.some((earlierId, earlierIndex) => (
      lessonOrderNodeIds.slice(earlierIndex + 1).some((laterId) => (
        hasDirectedPath(precedenceAdjacency, laterId, earlierId)
      ))
    ));
    if (contradictsLessonOrder) {
      if (!alreadyPresent) targets.delete(link.targetId);
      diagnostics.push({
        code: 'LESSON_POST_REQUISITE_CONFLICT',
        relationId: link.id ?? '',
        nodeIds: [link.sourceId, link.targetId],
      });
      return;
    }
    eligiblePostLinks.push(link);
  });
  const components = stronglyConnectedComponents([...nodeIds], eligiblePostLinks);
  const componentByNodeId = new Map<string, number>();
  components.forEach((component, index) => component.forEach((nodeId) => componentByNodeId.set(nodeId, index)));
  const selfLoopNodeIds = new Set(
    eligiblePostLinks.filter((link) => link.sourceId === link.targetId).map((link) => link.sourceId)
  );
  const cycleGroups = components.filter((component) => (
    component.length > 1 || component.some((nodeId) => selfLoopNodeIds.has(nodeId))
  ));
  cycleGroups.forEach((nodeIdsInCycle) => diagnostics.push({
    code: 'POST_REQUISITE_CYCLE',
    nodeIds: nodeIdsInCycle,
  }));

  const orderedComponentEdges = new Map<number, Set<number>>();
  const indegree = new Map(components.map((_, index) => [index, 0]));
  const addEdge = (source: number, target: number) => {
    if (source === target) return;
    const targets = orderedComponentEdges.get(source) ?? new Set<number>();
    if (targets.has(target)) return;
    targets.add(target);
    orderedComponentEdges.set(source, targets);
    indegree.set(target, (indegree.get(target) ?? 0) + 1);
  };
  eligiblePostLinks.forEach((link) => addEdge(componentByNodeId.get(link.sourceId)!, componentByNodeId.get(link.targetId)!));
  lessonOrderNodeIds.slice(1).forEach((nodeId, index) => {
    addEdge(componentByNodeId.get(lessonOrderNodeIds[index])!, componentByNodeId.get(nodeId)!);
  });
  const componentRank = (componentIndex: number) => {
    const ranks = components[componentIndex].flatMap((nodeId) => {
      const rank = lessonIndex.get(nodeId);
      return rank === undefined ? [] : [rank];
    });
    return ranks.length > 0 ? Math.min(...ranks) : Number.POSITIVE_INFINITY;
  };
  const ready = components.map((_, index) => index).filter((index) => indegree.get(index) === 0);
  const sortReady = () => ready.sort((left, right) => (
    componentRank(left) - componentRank(right)
    || compareIds(components[left][0], components[right][0])
  ));
  sortReady();
  const orderedComponents: number[] = [];
  const depthByComponent = new Map(components.map((_, index) => [index, 0]));
  while (ready.length > 0) {
    const component = ready.shift()!;
    orderedComponents.push(component);
    for (const target of orderedComponentEdges.get(component) ?? []) {
      depthByComponent.set(
        target,
        Math.max(depthByComponent.get(target) ?? 0, (depthByComponent.get(component) ?? 0) + 1)
      );
      indegree.set(target, indegree.get(target)! - 1);
      if (indegree.get(target) === 0) ready.push(target);
    }
    sortReady();
  }
  components.forEach((_, index) => {
    if (!orderedComponents.includes(index)) orderedComponents.push(index);
  });
  const incidentPostNodeIds = new Set(postLinks.flatMap((link) => [link.sourceId, link.targetId]));
  const unorderedNodeIds = [...nodeIds]
    .filter((nodeId) => !lessonIndex.has(nodeId) && !incidentPostNodeIds.has(nodeId))
    .sort(compareIds);
  const unorderedSet = new Set(unorderedNodeIds);
  const orderNodeIds = orderedComponents.flatMap((componentIndex) => (
    [...components[componentIndex]]
      .filter((nodeId) => !unorderedSet.has(nodeId))
      .sort((left, right) => (
        (lessonIndex.get(left) ?? Number.POSITIVE_INFINITY)
        - (lessonIndex.get(right) ?? Number.POSITIVE_INFINITY)
        || compareIds(left, right)
      ))
  ));
  const positions: Record<string, { x: number; y: number }> = {};
  const collisionBoundsByNodeId = Object.fromEntries(input.nodes.map((node) => [
    node.id,
    getKnowledgeNodeLabelBounds({
      name: node.name ?? node.id,
      bodyRadius: getKnowledgeNodeMaximumPresentationRadius(node),
      measureText: input.measureText,
    }),
  ]));
  const collisionRadiusById = new Map(input.nodes.map((node) => [
    node.id,
    collisionBoundsByNodeId[node.id].collisionRadius,
  ]));
  const maximumCollisionRadius = Math.max(0, ...collisionRadiusById.values());
  const placedOrderedNodeIds: string[] = [];
  const orderedNonEmptyComponents = orderedComponents.filter((componentIndex) => (
    components[componentIndex].some((nodeId) => !unorderedSet.has(nodeId))
  ));
  const componentsByDepth = new Map<number, number[]>();
  orderedNonEmptyComponents.forEach((componentIndex) => {
    const depth = depthByComponent.get(componentIndex) ?? 0;
    componentsByDepth.set(depth, [...(componentsByDepth.get(depth) ?? []), componentIndex]);
  });
  [...componentsByDepth.entries()].sort(([left], [right]) => left - right).forEach(([depth, componentIndices]) => {
    const members = componentIndices.flatMap((componentIndex) => (
      components[componentIndex].filter((nodeId) => !unorderedSet.has(nodeId))
    )).sort((left, right) => orderNodeIds.indexOf(left) - orderNodeIds.indexOf(right));
    const baseAngle = -Math.PI / 2 + depth * 2.399963229728653;
    const candidatePositions = (radius: number) => members.map((nodeId, memberIndex) => {
      const offset = members.length === 1
        ? 0
        : (memberIndex - (members.length - 1) / 2) * (2 * Math.PI / members.length);
      const angle = baseAngle + offset;
      return { nodeId, x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
    });
    let radius = Math.max(
      48 + depth * (maximumCollisionRadius * 2 + 12),
      members.reduce((sum, nodeId) => sum + collisionRadiusById.get(nodeId)!, 0) / Math.PI
    );
    let candidates = candidatePositions(radius);
    const hasCollision = () => candidates.some((candidate, candidateIndex) => {
      const collidesWithPlaced = placedOrderedNodeIds.some((placedNodeId) => {
        const placed = positions[placedNodeId];
        const minimumDistance = collisionRadiusById.get(candidate.nodeId)!
          + collisionRadiusById.get(placedNodeId)!
          + 12;
        return Math.hypot(candidate.x - placed.x, candidate.y - placed.y) < minimumDistance;
      });
      if (collidesWithPlaced) return true;
      return candidates.slice(candidateIndex + 1).some((other) => {
        const minimumDistance = collisionRadiusById.get(candidate.nodeId)!
          + collisionRadiusById.get(other.nodeId)!
          + 12;
        return Math.hypot(candidate.x - other.x, candidate.y - other.y) < minimumDistance;
      });
    });
    while (hasCollision() && iterations < maximumIterations) {
      radius += 12;
      candidates = candidatePositions(radius);
      iterations += 1;
    }
    candidates.forEach(({ nodeId, x, y }) => {
      positions[nodeId] = { x, y };
      placedOrderedNodeIds.push(nodeId);
    });
  });
  const orderedBottom = placedOrderedNodeIds.reduce((bottom, nodeId) => Math.max(
    bottom,
    positions[nodeId].y + collisionRadiusById.get(nodeId)!
  ), 0);
  const viewportAspect = Math.max(0.25, Math.min(4, input.viewportWidth / Math.max(1, input.viewportHeight)));
  const unorderedColumns = Math.max(1, Math.ceil(Math.sqrt(unorderedNodeIds.length * viewportAspect)));
  const unorderedSpacing = 168;
  unorderedNodeIds.forEach((nodeId, index) => {
    const row = Math.floor(index / unorderedColumns);
    const column = index % unorderedColumns;
    const columnsInRow = Math.min(unorderedColumns, unorderedNodeIds.length - row * unorderedColumns);
    positions[nodeId] = {
      x: (column - (columnsInRow - 1) / 2) * unorderedSpacing,
      y: orderedBottom + 72 + row * unorderedSpacing,
    };
  });
  const positionedNodes = input.nodes.map((node) => {
    const position = positions[node.id] ?? { x: 0, y: 0 };
    return {
      ...node,
      x: position.x,
      y: position.y,
      z: 0,
      positionX: position.x,
      positionY: position.y,
      positionZ: 0,
    };
  });
  const extents = input.nodes.map((node) => {
    const position = positions[node.id] ?? { x: 0, y: 0 };
    const collisionBounds = collisionBoundsByNodeId[node.id]
      ?? getKnowledgeNodeLabelBounds({
        name: node.name ?? node.id,
        bodyRadius: getKnowledgeNodeMaximumPresentationRadius(node),
        measureText: input.measureText,
      });
    return {
      minX: position.x - collisionBounds.halfWidth,
      maxX: position.x + collisionBounds.halfWidth,
      minY: position.y - collisionBounds.halfHeight,
      maxY: position.y + collisionBounds.halfHeight,
    };
  });
  const minX = extents.length > 0 ? Math.min(...extents.map((extent) => extent.minX)) : 0;
  const maxX = extents.length > 0 ? Math.max(...extents.map((extent) => extent.maxX)) : 0;
  const minY = extents.length > 0 ? Math.min(...extents.map((extent) => extent.minY)) : 0;
  const maxY = extents.length > 0 ? Math.max(...extents.map((extent) => extent.maxY)) : 0;
  const bounds = { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  const fitScale = Math.min(
    1,
    Math.max(0.01, (input.viewportWidth - 48) / Math.max(1, bounds.width)),
    Math.max(0.01, (input.viewportHeight - 48) / Math.max(1, bounds.height))
  );
  return {
    bounds,
    collisionBoundsByNodeId,
    cycleGroups,
    diagnostics,
    fitScale,
    iterations,
    nodes: positionedNodes,
    orderNodeIds,
    positions,
    unorderedNodeIds,
  };
}
