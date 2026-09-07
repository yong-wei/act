/**
 * #2052：领域视图内跨领域关系的画布内聚类布局（`cross-domain-canvas-cluster`）。
 *
 * 跨领域概念节点不参与力导向漂移：按目标领域聚类为虚线领域圆，圆锚定
 * 在有界概览的外圈；圆几何与节点锚点在本模块内确定性计算，沉降冻结对
 * 它们同样生效（anchor 机制与 governed roots 共用）。
 */

import type { KnowledgeNodeData } from '../knowledge-graph-system';
import { markKnowledgeGraphAutomaticNodeAnchors } from './layout-state';

/** 跨领域节点 id 前缀（`cross:<canonicalId>`）。 */
export const CROSS_DOMAIN_NODE_ID_PREFIX = 'cross:';

export function crossDomainNodeId(canonicalId: string): string {
  return `${CROSS_DOMAIN_NODE_ID_PREFIX}${canonicalId}`;
}

export function readCrossDomainCanonicalId(nodeId: string): string | null {
  return nodeId.startsWith(CROSS_DOMAIN_NODE_ID_PREFIX)
    ? nodeId.slice(CROSS_DOMAIN_NODE_ID_PREFIX.length) || null
    : null;
}

export interface CrossDomainClusterCircle {
  readonly domainName: string;
  readonly centerX: number;
  readonly centerY: number;
  readonly radius: number;
  /** 只有簇内 id 最小的节点负责绘制圆与领域名（幂等、不叠画）。 */
  readonly representative: boolean;
}

interface CrossClusterMutableNode {
  readonly id: string;
  readonly crossDomainClusterDomain?: string;
  x?: number;
  y?: number;
  __knowledgeCrossClusterCircle?: CrossDomainClusterCircle;
}

export const CROSS_DOMAIN_CLUSTER_LAYOUT_DEFAULTS = {
  /** 领域圆半径（容纳聚类节点小环 + 呼吸空间）。 */
  circleRadius: 92,
  /** 圆内节点的分布环半径。 */
  nodeRingRadius: 44,
  /** 概览外圈与领域圆的间距。 */
  overviewGap: 132,
} as const;

/**
 * 确定性跨领域聚类布局：同域概念共用一个领域圆；圆心均匀分布在概览
 * 包围盒外圈；圆内节点按小环均布。直接变异节点位置并写圆几何（渲染期
 * 幂等，StrictMode 重放同输入同结果）；随后由既有 anchor 机制冻结。
 */
export function applyCrossDomainClusterLayout(
  nodes: Array<CrossClusterMutableNode & KnowledgeNodeData>,
  input: { viewportWidth: number; viewportHeight: number } = { viewportWidth: 1280, viewportHeight: 720 },
): void {
  const crossNodes = nodes.filter((node): node is CrossClusterMutableNode & KnowledgeNodeData & { crossDomainClusterDomain: string } => Boolean(node.crossDomainClusterDomain));
  if (crossNodes.length === 0) return;

  const inDomainNodes = nodes.filter((node) => !node.crossDomainClusterDomain);
  const xs = inDomainNodes.map((node) => node.x).filter((value): value is number => Number.isFinite(value));
  const ys = inDomainNodes.map((node) => node.y).filter((value): value is number => Number.isFinite(value));
  const fallbackWidth = input.viewportWidth;
  const fallbackHeight = input.viewportHeight;
  const minX = xs.length ? Math.min(...xs) : -fallbackWidth / 2;
  const maxX = xs.length ? Math.max(...xs) : fallbackWidth / 2;
  const minY = ys.length ? Math.min(...ys) : -fallbackHeight / 2;
  const maxY = ys.length ? Math.max(...ys) : fallbackHeight / 2;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const overviewRadius = Math.max((maxX - minX), (maxY - minY), Math.min(fallbackWidth, fallbackHeight) * 0.2) / 2;

  const byDomain = new Map<string, CrossClusterMutableNode[]>();
  for (const node of crossNodes) {
    const domain = node.crossDomainClusterDomain!;
    const bucket = byDomain.get(domain);
    if (bucket) bucket.push(node);
    else byDomain.set(domain, [node]);
  }
  const domains = [...byDomain.keys()].sort((left, right) => left.localeCompare(right));
  const anchorRadius = overviewRadius + CROSS_DOMAIN_CLUSTER_LAYOUT_DEFAULTS.overviewGap;

  domains.forEach((domain, domainIndex) => {
    // 从正上方开始，顺时针均匀分布各领域圆。
    const angle = -Math.PI / 2 + (2 * Math.PI * domainIndex) / Math.max(1, domains.length);
    const circleCenterX = centerX + anchorRadius * Math.cos(angle);
    const circleCenterY = centerY + anchorRadius * Math.sin(angle);
    const members = byDomain.get(domain)!.sort((left, right) => left.id.localeCompare(right.id));
    members.forEach((node, memberIndex) => {
      const memberAngle = (2 * Math.PI * memberIndex) / Math.max(1, members.length);
      node.x = circleCenterX + CROSS_DOMAIN_CLUSTER_LAYOUT_DEFAULTS.nodeRingRadius * Math.cos(memberAngle);
      node.y = circleCenterY + CROSS_DOMAIN_CLUSTER_LAYOUT_DEFAULTS.nodeRingRadius * Math.sin(memberAngle);
      node.__knowledgeCrossClusterCircle = {
        domainName: domain,
        centerX: circleCenterX,
        centerY: circleCenterY,
        radius: CROSS_DOMAIN_CLUSTER_LAYOUT_DEFAULTS.circleRadius,
        representative: memberIndex === 0,
      };
    });
  });
  // 与 governed roots 共用锚点冻结机制：写入 anchor 后力导向不漂移，
  // 沉降冻结与显式 reflow 对跨领域节点同样生效。
  markKnowledgeGraphAutomaticNodeAnchors(crossNodes);
}

/** 供 hover/click 通道读取的圆几何（不暴露给无关节点）。 */
export function readCrossDomainClusterCircle(
  node: Readonly<{ __knowledgeCrossClusterCircle?: CrossDomainClusterCircle }>,
): CrossDomainClusterCircle | null {
  return node.__knowledgeCrossClusterCircle ?? null;
}
