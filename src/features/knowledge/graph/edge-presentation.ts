import type { KnowledgeGraphEdgeFocusState, KnowledgeGraphPresentationFamily } from './visual-config';
import {
  getKnowledgeGraphFamilyPresentationStyle,
  getNodeTypeConfig,
} from './visual-config';
import {
  createKnowledgeGraphEdgePath,
  getKnowledgeGraphPathPoint,
  type KnowledgeGraphEdgePath,
  type KnowledgeGraphNodeBoundary,
  type KnowledgeGraphPoint,
  type KnowledgeGraphPointInput,
} from './edge-geometry';
import { getKnowledgeGraphRelationContract } from './relation-contract';

export type KnowledgeGraphEdgeRendererMode = '2d' | '3d';

export interface KnowledgeGraphPresentationLink {
  id?: string;
  sourceId: string;
  targetId: string;
  relation?: string;
  relationType?: string;
}

export interface KnowledgeGraphSelectedCorridorEmphasis {
  selectedNodeId: string | null;
  nodeIds: readonly string[];
  edgeIds: readonly string[];
}

const FAMILY_ORDER: Record<KnowledgeGraphPresentationFamily, number> = {
  child: 0,
  'post-requisite': 1,
  association: 2,
};

export function getKnowledgeGraphPresentationLinkKey(link: KnowledgeGraphPresentationLink): string {
  return link.id ?? `${link.relationType ?? link.relation ?? ''}|${link.sourceId}|${link.targetId}`;
}

export function getKnowledgeGraphPresentationFamily(link: KnowledgeGraphPresentationLink) {
  const relationType = link.relationType ?? link.relation ?? '';
  const contract = getKnowledgeGraphRelationContract(relationType);
  if (!contract) throw new Error(`Unknown knowledge graph relation type: ${relationType}`);
  return contract.family;
}

function unorderedPairKey(link: KnowledgeGraphPresentationLink): string {
  return link.sourceId < link.targetId
    ? `${link.sourceId}|${link.targetId}`
    : `${link.targetId}|${link.sourceId}`;
}

function comparePresentationLinks(
  left: KnowledgeGraphPresentationLink,
  right: KnowledgeGraphPresentationLink,
): number {
  return FAMILY_ORDER[getKnowledgeGraphPresentationFamily(left)]
    - FAMILY_ORDER[getKnowledgeGraphPresentationFamily(right)]
    || left.sourceId.localeCompare(right.sourceId)
    || left.targetId.localeCompare(right.targetId)
    || getKnowledgeGraphPresentationLinkKey(left).localeCompare(getKnowledgeGraphPresentationLinkKey(right));
}

export function buildKnowledgeGraphEdgeLaneCurvatures(
  links: readonly KnowledgeGraphPresentationLink[],
): ReadonlyMap<string, number> {
  const groups = new Map<string, KnowledgeGraphPresentationLink[]>();
  links.forEach((link) => {
    const key = unorderedPairKey(link);
    groups.set(key, [...(groups.get(key) ?? []), link]);
  });

  const result = new Map<string, number>();
  groups.forEach((group) => {
    const sorted = [...group].sort(comparePresentationLinks);
    if (sorted.length === 1) {
      result.set(getKnowledgeGraphPresentationLinkKey(sorted[0]), 0);
      return;
    }

    sorted.forEach((link, index) => {
      const laneIndex = Math.ceil(index / 2);
      const curvature = index === 0
        ? 0
        : (index % 2 === 1 ? 1 : -1) * (0.14 + (laneIndex - 1) * 0.08);
      result.set(getKnowledgeGraphPresentationLinkKey(link), curvature);
    });
  });
  return result;
}

export function getKnowledgeGraphRendererNodeBoundary({
  renderer,
  nodeType,
  presentationRadius,
}: {
  renderer: KnowledgeGraphEdgeRendererMode;
  nodeType?: string;
  presentationRadius: number;
}): KnowledgeGraphNodeBoundary {
  const shape = getNodeTypeConfig(nodeType).shape;
  if (renderer === '3d') {
    if (shape === 'square') return { shape: 'box', presentationRadius };
    if (shape === 'hexagon') return { shape: 'icosahedron', presentationRadius };
    return { shape: 'sphere', presentationRadius };
  }
  if (shape === 'square') return { shape: 'square', presentationRadius };
  if (shape === 'hexagon') return { shape: 'regular-hexagon', presentationRadius };
  return { shape: 'circle', presentationRadius };
}

export function createKnowledgeGraphRendererEdgePath({
  renderer,
  link,
  source,
  target,
  sourceNodeType,
  targetNodeType,
  sourcePresentationRadius,
  targetPresentationRadius,
  laneCurvature,
}: {
  renderer: KnowledgeGraphEdgeRendererMode;
  link: KnowledgeGraphPresentationLink;
  source: KnowledgeGraphPointInput;
  target: KnowledgeGraphPointInput;
  sourceNodeType?: string;
  targetNodeType?: string;
  sourcePresentationRadius: number;
  targetPresentationRadius: number;
  laneCurvature: number;
}): KnowledgeGraphEdgePath {
  return createKnowledgeGraphEdgePath({
    source,
    target,
    sourceKey: link.sourceId,
    targetKey: link.targetId,
    sourceBoundary: getKnowledgeGraphRendererNodeBoundary({
      renderer,
      nodeType: sourceNodeType,
      presentationRadius: sourcePresentationRadius,
    }),
    targetBoundary: getKnowledgeGraphRendererNodeBoundary({
      renderer,
      nodeType: targetNodeType,
      presentationRadius: targetPresentationRadius,
    }),
    laneCurvature,
  });
}

export function getKnowledgeGraphPartialEdgePath(
  path: KnowledgeGraphEdgePath,
  progress: number,
): KnowledgeGraphEdgePath {
  const boundedProgress = Math.min(1, Math.max(0, progress));
  if (path.kind === 'line') {
    return { ...path, end: getKnowledgeGraphPathPoint(path, boundedProgress) };
  }
  return {
    ...path,
    control: {
      x: path.start.x + (path.control.x - path.start.x) * boundedProgress,
      y: path.start.y + (path.control.y - path.start.y) * boundedProgress,
      z: path.start.z + (path.control.z - path.start.z) * boundedProgress,
    },
    end: getKnowledgeGraphPathPoint(path, boundedProgress),
  };
}

export function sampleKnowledgeGraphEdgePath(
  path: KnowledgeGraphEdgePath,
  segments = path.kind === 'quadratic' ? 24 : 1,
): KnowledgeGraphPoint[] {
  const count = Math.max(1, Math.floor(segments));
  return Array.from({ length: count + 1 }, (_, index) => (
    getKnowledgeGraphPathPoint(path, index / count)
  ));
}

export function getKnowledgeGraphEdgeEmphasisState({
  link,
  emphasis,
}: {
  link: KnowledgeGraphPresentationLink;
  emphasis?: KnowledgeGraphSelectedCorridorEmphasis | null;
}): KnowledgeGraphEdgeFocusState {
  if (!emphasis?.selectedNodeId) return 'neutral';
  if (emphasis.edgeIds.length > 0) {
    return emphasis.edgeIds.includes(getKnowledgeGraphPresentationLinkKey(link))
      || (link.id ? emphasis.edgeIds.includes(link.id) : false)
      ? 'active'
      : 'dimmed';
  }
  return link.sourceId === emphasis.selectedNodeId || link.targetId === emphasis.selectedNodeId
    ? 'active'
    : 'dimmed';
}

export function getKnowledgeGraphNodeEmphasisOpacity(
  nodeId: string,
  emphasis?: KnowledgeGraphSelectedCorridorEmphasis | null,
): number {
  if (!emphasis?.selectedNodeId) return 1;
  return emphasis.nodeIds.includes(nodeId) ? 1 : 0.56;
}

export function getKnowledgeGraphEdgePresentation(link: KnowledgeGraphPresentationLink) {
  const family = getKnowledgeGraphPresentationFamily(link);
  return {
    family,
    style: getKnowledgeGraphFamilyPresentationStyle(link.relationType ?? link.relation),
    directed: family !== 'association',
  };
}
