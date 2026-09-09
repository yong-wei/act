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

export const ACTIVE_RELATION_COLORS: Record<string, string> = {
  prerequisite: '#c98a50',
  contains: '#638fb0',
  association: '#71808e',
  cross_domain: '#5cabb6',
  related: '#71808e',
  derives: '#9a79a4',
  derived_from: '#9a79a4',
  applies_to: '#638fb0',
  quantified_by: '#8f7eaa',
  visualized_by: '#5b9b8c',
  instance_of: '#6488b3',
  follows: '#c98a50',
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
  if (shape === 'square' || shape === 'hexagon' || shape === 'triangle' || shape === 'diamond' || shape === 'pentagon') {
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

export function activeRelationColor(link: Pick<KnowledgeLinkData, 'relation' | 'relationType'>): string {
  const relation = activeRelationType(link);
  if (relation.toLowerCase().includes('prerequisite')) return ACTIVE_RELATION_COLORS.prerequisite;
  return ACTIVE_RELATION_COLORS[relation] ?? ACTIVE_RELATION_COLORS[relation.toLowerCase()] ?? ACTIVE_RELATION_COLORS.related;
}

export function activeRelationIsDirected(link: Pick<KnowledgeLinkData, 'relation' | 'relationType'>): boolean {
  const relation = activeRelationType(link).toLowerCase();
  return relation !== 'association' && relation !== 'related';
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
  return isFiniteActiveCameraPose(pose) && (!pose.viewport
    || (Math.abs(pose.viewport.width - width) <= 1 && Math.abs(pose.viewport.height - height) <= 1));
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
