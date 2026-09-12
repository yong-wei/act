import type { Object3D } from 'three';

import type { KnowledgeLinkData, KnowledgeNodeData } from '../../knowledge-graph-system';
import type { ActiveAuthorityCameraPose } from './active-authority-renderer-types';
import type { ActiveAuthorityLayoutNode } from './active-authority-geometry';

export const ACTIVE_TONE_COLORS: Record<string, string> = {
  cyan: '#5b9eb0',
  blue: '#6488b3',
  amber: '#b48b56',
  emerald: '#5b9b8c',
  violet: '#8a77a8',
  muted: '#7f8b9a',
};

export type ActiveAuthorityNodeShape = 'circle' | 'square' | 'hexagon' | 'triangle' | 'diamond' | 'pentagon';

function metadataFor(node: Pick<KnowledgeNodeData, 'metadata'>): Record<string, unknown> {
  return (node.metadata ?? {}) as Record<string, unknown>;
}

export function isActiveRootNode(node: Pick<KnowledgeNodeData, 'id' | 'metadata'>): boolean {
  const metadata = metadataFor(node);
  return metadata.presentationKind === 'domain'
    || metadata.presentationKind === 'aggregate'
    || metadata.presentationKind === 'active-root-navigation'
    || node.id.startsWith('root-entry-');
}

export function activeNodeShape(node: Pick<KnowledgeNodeData, 'id' | 'nodeType' | 'metadata'>): ActiveAuthorityNodeShape {
  if (isActiveRootNode(node)) return 'circle';
  const shape = metadataFor(node).presentationShape;
  if (shape === 'square' || shape === 'diamond' || shape === 'hexagon' || shape === 'triangle' || shape === 'diamond' || shape === 'pentagon') {
    return shape;
  }
  if (shape === 'rounded') return 'square';
  if (node.nodeType === 'ETHICS') return 'hexagon';
  if (node.nodeType === 'SCENARIO') return 'square';
  return 'circle';
}

export function activeNodeTone(node: Pick<KnowledgeNodeData, 'id' | 'nodeType' | 'conceptKind' | 'metadata'>): string {
  const metadataTone = metadataFor(node).activeTone;
  if (typeof metadataTone === 'string' && metadataTone in ACTIVE_TONE_COLORS) return metadataTone;
  if (isActiveRootNode(node)) return metadataFor(node).presentationKind === 'aggregate' ? 'amber' : 'blue';
  switch (node.conceptKind ?? node.nodeType) {
    case 'Formula': return 'amber';
    case 'KnowledgeStatement': return 'violet';
    case 'SystemModel': return 'emerald';
    case 'ModelRepresentation': return 'blue';
    case 'ETHICS': return 'amber';
    case 'SCENARIO': return 'blue';
    default: return 'cyan';
  }
}

export function activeNodeColor(node: Pick<KnowledgeNodeData, 'id' | 'nodeType' | 'conceptKind' | 'metadata'>): string {
  return ACTIVE_TONE_COLORS[activeNodeTone(node)] ?? ACTIVE_TONE_COLORS.muted;
}

export function activeRelationType(link: Pick<KnowledgeLinkData, 'relation' | 'relationType'>): string {
  return link.relationType ?? link.relation ?? 'related';
}

export const ACTIVE_RELATION_STYLES = {
  'prerequisite-order': { color: '#d99b60', dash: null, directed: true },
  structure: { color: '#77acd2', dash: [9, 5], directed: true },
  'derivation-and-representation': { color: '#b29bd5', dash: [2, 5], directed: true },
  'application-and-analysis': { color: '#78baa6', dash: [14, 5], directed: true },
  association: { color: '#a1a9b5', dash: [5, 7], directed: false },
} as const;

export function activeRelationStyle(link: Pick<KnowledgeLinkData, 'relation' | 'relationType' | 'relationFamily'>) {
  const family = link.relationFamily;
  if (family && family in ACTIVE_RELATION_STYLES) return ACTIVE_RELATION_STYLES[family as keyof typeof ACTIVE_RELATION_STYLES];
  const relation = activeRelationType(link).toLowerCase();
  if (relation.includes('prerequisite') || family === 'teaching-prerequisite') return ACTIVE_RELATION_STYLES['prerequisite-order'];
  if (relation === 'contains' || family === 'teaching-containment') return ACTIVE_RELATION_STYLES.structure;
  if (['derives', 'derived_from', 'represented_by', 'visualized_by'].includes(relation)) return ACTIVE_RELATION_STYLES['derivation-and-representation'];
  if (['applies_to', 'quantified_by'].includes(relation)) return ACTIVE_RELATION_STYLES['application-and-analysis'];
  return ACTIVE_RELATION_STYLES.association;
}

export function activeRelationColor(link: Pick<KnowledgeLinkData, 'relation' | 'relationType' | 'relationFamily'>): string {
  return activeRelationStyle(link).color;
}

export function activeRelationIsDirected(link: Pick<KnowledgeLinkData, 'relation' | 'relationType' | 'relationFamily' | 'directed'>): boolean {
  return link.directed ?? activeRelationStyle(link).directed;
}

export function activeFocusNodeIds(links: readonly Pick<KnowledgeLinkData, 'sourceId' | 'targetId'>[], selected: string | null): ReadonlySet<string> {
  const ids = new Set<string>();
  if (!selected) return ids;
  ids.add(selected);
  for (const link of links) if (link.sourceId === selected || link.targetId === selected) {
    ids.add(link.sourceId);
    ids.add(link.targetId);
  }
  return ids;
}

export function activeNodeOpacity(id: string, selected: string | null, hovered: string | null, focusedNodes?: ReadonlySet<string>): number {
  if (selected) return id === selected ? 1 : focusedNodes?.has(id) ? 0.94 : 0.13;
  return id === hovered ? 1 : 0.88;
}

export function activeLinkOpacity(link: Pick<KnowledgeLinkData, 'sourceId' | 'targetId'>, selected: string | null, hovered: string | null): number {
  const focus = selected ?? hovered;
  if (!focus) return 0.68;
  if (link.sourceId === focus || link.targetId === focus) return 1;
  return selected ? 0.06 : 0.32;
}

export function activeNodeAccessibleName(node: Pick<KnowledgeNodeData, 'name' | 'richTitle' | 'mathematics'> & { accessibleName?: string }): string {
  if (node.mathematics?.state === 'available' && node.mathematics.accessibleLabel.trim()) {
    return node.mathematics.accessibleLabel;
  }
  if (node.richTitle?.state === 'available' && node.richTitle.accessibleName.trim()) {
    return node.richTitle.accessibleName;
  }
  const accessibleName = typeof node.accessibleName === 'string' ? node.accessibleName.trim() : '';
  return accessibleName || node.name.trim() || '未命名知识节点';
}

export function activeAuthorityCameraPoseFrom2DTransform(transform: {
  k: number;
  x: number;
  y: number;
}, width: number, height: number): ActiveAuthorityCameraPose {
  const zoom = Math.max(0.0001, transform.k);
  // ForceGraph reports centerAt() world coordinates here, not the raw D3 translation.
  const targetX = transform.x;
  const targetY = transform.y;
  return {
    viewport: { width, height },
    position: { x: targetX, y: targetY, z: 1 / zoom },
    target: { x: targetX, y: targetY, z: 0 },
    up: { x: 0, y: 1, z: 0 },
  };
}

export function isFiniteActiveCameraPose(pose: ActiveAuthorityCameraPose | null | undefined): pose is ActiveAuthorityCameraPose {
  if (!pose) return false;
  return [
    pose.position.x, pose.position.y, pose.position.z,
    pose.target.x, pose.target.y, pose.target.z,
    pose.up.x, pose.up.y, pose.up.z,
  ].every(Number.isFinite);
}

export function canRestoreActiveCameraPose(pose: ActiveAuthorityCameraPose | null | undefined, width: number, height: number): boolean {
  return isFiniteActiveCameraPose(pose) && width > 0 && height > 0;
}

export function disposeActiveObject3D(object: Object3D): void {
  object.traverse((child) => {
    const candidate = child as Object3D & {
      geometry?: { dispose?: () => void };
      material?: { dispose?: () => void } | Array<{ dispose?: () => void }>;
    };
    candidate.geometry?.dispose?.();
    if (Array.isArray(candidate.material)) candidate.material.forEach((material) => material.dispose?.());
    else candidate.material?.dispose?.();
  });
}

export function drawActivePolygon(
  ctx: CanvasRenderingContext2D,
  shape: ActiveAuthorityNodeShape,
  x: number,
  y: number,
  radius: number,
): void {
  if (shape === 'circle') {
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    return;
  }
  const sides = shape === 'square' ? 4 : shape === 'hexagon' ? 6 : shape === 'triangle' ? 3 : shape === 'diamond' ? 4 : 5;
  const rotation = shape === 'square' ? Math.PI / 4 : shape === 'diamond' ? 0 : -Math.PI / 2;
  for (let index = 0; index < sides; index += 1) {
    const angle = rotation + (index * Math.PI * 2) / sides;
    const pointX = x + Math.cos(angle) * radius;
    const pointY = y + Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(pointX, pointY);
    else ctx.lineTo(pointX, pointY);
  }
  ctx.closePath();
}

export function activeNodeRadius(node: Pick<ActiveAuthorityLayoutNode, 'renderRadius' | 'id' | 'metadata'>): number {
  return Math.max(9, node.renderRadius || (isActiveRootNode(node) ? 42 : 12));
}

/** Pointer hit must cover the visible name, not only the painted glyph. */
export function activeNodePointerRadius(
  node: Pick<ActiveAuthorityLayoutNode, 'renderRadius' | 'id' | 'metadata'>,
  globalScale = 1,
): number {
  const base = activeNodeRadius(node);
  if (isActiveRootNode(node)) {
    const presentation = metadataFor(node).presentationRadius;
    const labelRadius = typeof presentation === 'number' && Number.isFinite(presentation) ? presentation : 42;
    return Math.max(base, labelRadius);
  }
  return base + 18 / Math.max(0.2, globalScale);
}
