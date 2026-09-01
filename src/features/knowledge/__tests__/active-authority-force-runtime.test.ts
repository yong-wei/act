/**
 * Behavioral force-runtime parity for the shared Authority graph (#1739).
 *
 * These tests run a real D3 force simulation under the renderers' bounded
 * lifecycle constants and assert observable movement, separation, pin
 * ownership and settle behavior — never zero-tick or source-string
 * mechanism checks.
 */

import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';
import { describe, expect, it } from 'vitest';

import {
  KNOWLEDGE_FORCE_ALPHA_DECAY,
  KNOWLEDGE_FORCE_ALPHA_MIN,
  KNOWLEDGE_FORCE_COOLDOWN_TICKS,
  KNOWLEDGE_FORCE_COOLDOWN_TIME_MS,
  KNOWLEDGE_FORCE_WARMUP_TICKS,
  computeKnowledgeForceStructureSignature,
  resolveKnowledgeForceLifecycle,
} from '../graph/force-lifecycle';
import {
  applyKnowledgeGraphStoredPositions,
  markKnowledgeGraphAutomaticNodeAnchors,
  removeKnowledgeGraphNodePin,
  storeKnowledgeGraphNodePosition,
  syncKnowledgeGraphMutableNodePositions,
  type KnowledgeGraphStoredPosition,
} from '../graph/layout-state';
import { placeKnowledgeGraphLabels } from '../graph/viewport-fit';
import {
  KNOWLEDGE_LABEL_OVERVIEW_MAX_OVERLAP_COUNT,
  KNOWLEDGE_LABEL_OVERVIEW_MIN_VISIBLE_RATIO,
} from '../graph/label-policy';
import {
  freezeKnowledgeGraphUnaffectedScope,
  releaseKnowledgeGraphDragFrame,
  releaseKnowledgeGraphFrozenScope,
} from '../graph/layout-engine';

interface SimNode {
  id: string;
  x: number;
  y: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
  __knowledgeAutomaticAnchor?: { id: string; x: number; y: number; z?: number };
  __knowledgeUserPinned?: true;
  __knowledgeRootPacking?: unknown;
}

function overviewFixture(): { nodes: SimNode[]; links: Array<{ sourceId: string; targetId: string }> } {
  const nodes: SimNode[] = Array.from({ length: 12 }, (_, index) => ({
    id: `concept-${index + 1}`,
    // Deterministic seeds that deliberately overlap: separation must move them.
    x: (index % 3) * 14,
    y: Math.floor(index / 3) * 14,
  }));
  const links = nodes.slice(0, 6).map((node, index) => ({
    sourceId: node.id,
    targetId: nodes[(index + 6) % 12]!.id,
  }));
  return { nodes, links };
}

function createBoundedSimulation(
  nodes: SimNode[],
  links: Array<{ sourceId: string; targetId: string }>,
) {
  return forceSimulation(nodes as never[])
    .alphaDecay(KNOWLEDGE_FORCE_ALPHA_DECAY)
    .alphaMin(KNOWLEDGE_FORCE_ALPHA_MIN)
    .force('charge', forceManyBody().strength(-110))
    .force('link', forceLink(links.map((link) => ({
      source: link.sourceId,
      target: link.targetId,
    })) as never[]).id((datum: never) => (datum as SimNode).id).distance(70))
    .force('collide', forceCollide(22).strength(0.85))
    .force('x', forceX(0).strength(0.05))
    .force('y', forceY(0).strength(0.05))
    .stop();
}

function runTicks(simulation: ReturnType<typeof createBoundedSimulation>, ticks: number): void {
  for (let tick = 0; tick < ticks; tick += 1) simulation.tick();
}

function runBoundedSimulation(
  nodes: SimNode[],
  links: Array<{ sourceId: string; targetId: string }>,
  ticks: number,
): void {
  runTicks(createBoundedSimulation(nodes, links), ticks);
}

describe('bounded force lifecycle (#1739)', () => {
  it('exposes explicit warmup, cooldown and time budgets per dimension', () => {
    for (const dimension of ['2d', '3d'] as const) {
      const lifecycle = resolveKnowledgeForceLifecycle({ dimension, liveEngine: true });
      expect(lifecycle.staticLayout).toBe(false);
      expect(lifecycle.warmupTicks).toBe(KNOWLEDGE_FORCE_WARMUP_TICKS[dimension]);
      expect(lifecycle.cooldownTicks).toBe(KNOWLEDGE_FORCE_COOLDOWN_TICKS[dimension]);
      expect(lifecycle.cooldownTicks).toBeGreaterThan(0);
      expect(lifecycle.cooldownTimeMs).toBe(KNOWLEDGE_FORCE_COOLDOWN_TIME_MS);
    }
    const staticLifecycle = resolveKnowledgeForceLifecycle({ dimension: '2d', liveEngine: false });
    expect(staticLifecycle).toMatchObject({ warmupTicks: 0, cooldownTicks: 0, staticLayout: true });
    const reduced = resolveKnowledgeForceLifecycle({ dimension: '3d', liveEngine: true, reducedMotion: true });
    expect(reduced.staticLayout).toBe(true);
  });

  it('moves unpinned nodes, separates collisions and keeps seeds deterministic', () => {
    const { nodes, links } = overviewFixture();
    markKnowledgeGraphAutomaticNodeAnchors(nodes);
    const before = nodes.map((node) => ({ id: node.id, x: node.x, y: node.y }));
    // Ordinary nodes must stay movable: no automatic fixed coordinates.
    for (const node of nodes) {
      expect(node.fx).toBeUndefined();
      expect(node.fy).toBeUndefined();
      expect(node.__knowledgeAutomaticAnchor?.x).toBe(before.find((row) => row.id === node.id)!.x);
    }

    runBoundedSimulation(nodes, links, KNOWLEDGE_FORCE_WARMUP_TICKS['2d']);

    const moved = nodes.filter((node, index) => (
      Math.hypot(node.x - before[index]!.x, node.y - before[index]!.y) > 1
    ));
    expect(moved.length).toBeGreaterThan(0);
    // Collision separation: no two node centers stay within the collide radius.
    for (let left = 0; left < nodes.length; left += 1) {
      for (let right = left + 1; right < nodes.length; right += 1) {
        const distance = Math.hypot(
          nodes[left]!.x - nodes[right]!.x,
          nodes[left]!.y - nodes[right]!.y,
        );
        expect(distance).toBeGreaterThanOrEqual(22 * 0.9);
      }
    }
    // Settlement: one continuous engine runs warmup plus the cooldown
    // budget; the settle tail (final 30 ticks) barely moves the layout,
    // matching the engine-stop milestone the renderers consume.
    const simulation = createBoundedSimulation(nodes, links);
    runTicks(simulation, KNOWLEDGE_FORCE_WARMUP_TICKS['2d'] + KNOWLEDGE_FORCE_COOLDOWN_TICKS['2d'] - 30);
    const settled = nodes.map((node) => ({ id: node.id, x: node.x, y: node.y }));
    runTicks(simulation, 30);
    for (const node of nodes) {
      const prior = settled.find((row) => row.id === node.id)!;
      expect(Math.hypot(node.x - prior.x, node.y - prior.y)).toBeLessThan(6);
    }
  });

  it('reserves fixed coordinates for governed roots and explicit user pins', () => {
    const { nodes, links } = overviewFixture();
    const root: SimNode = {
      id: 'root-entry',
      x: 400,
      y: 300,
      z: 0,
      fx: 400,
      fy: 300,
      fz: 0,
      __knowledgeRootPacking: { order: 1 },
    };
    const pinned: SimNode = { id: 'concept-pinned', x: -120, y: 90 };
    markKnowledgeGraphAutomaticNodeAnchors([root, pinned, ...nodes]);
    let positions: Record<string, KnowledgeGraphStoredPosition> = {
      'concept-pinned': { x: 12, y: 34, pinned: true },
    };
    syncKnowledgeGraphMutableNodePositions([root, pinned, ...nodes], {
      version: 1,
      positionsByNodeId: positions,
    });
    runBoundedSimulation([root, pinned, ...nodes], links, KNOWLEDGE_FORCE_WARMUP_TICKS['3d']);
    expect(root.x).toBe(400);
    expect(root.y).toBe(300);
    expect(pinned.x).toBe(12);
    expect(pinned.y).toBe(34);

    // Unpinning returns only that node to force ownership; root stays fixed.
    positions = removeKnowledgeGraphNodePin(
      { version: 1, positionsByNodeId: positions },
      'concept-pinned',
    ).positionsByNodeId;
    syncKnowledgeGraphMutableNodePositions([root, pinned, ...nodes], {
      version: 2,
      positionsByNodeId: positions,
    });
    expect(pinned.fx).toBeUndefined();
    expect(pinned.fy).toBeUndefined();
    expect(root.fx).toBe(400);
    const pinnedBefore = { x: pinned.x, y: pinned.y };
    runBoundedSimulation([root, pinned, ...nodes], links, KNOWLEDGE_FORCE_COOLDOWN_TICKS['3d']);
    expect(Math.hypot(pinned.x - pinnedBefore.x, pinned.y - pinnedBefore.y)).toBeGreaterThan(0);
    expect(root.x).toBe(400);
  });

  it('keeps unaffected coordinates stable when a bounded subset reheats', () => {
    const { nodes, links } = overviewFixture();
    markKnowledgeGraphAutomaticNodeAnchors(nodes);
    runBoundedSimulation(nodes, links, KNOWLEDGE_FORCE_WARMUP_TICKS['2d']);
    const settledById = new Map(nodes.map((node) => [node.id, { x: node.x, y: node.y } as const]));

    // A disclosed neighborhood adds one connected node. The renderer freezes
    // every unaffected node for the reheat phase, so only the affected scope
    // moves; the frozen frame is released at the settle milestone.
    const newcomer: SimNode = { id: 'neighbor-new', x: nodes[0]!.x + 10, y: nodes[0]!.y + 10 };
    markKnowledgeGraphAutomaticNodeAnchors([newcomer]);
    const nextLinks = [...links, { sourceId: nodes[0]!.id, targetId: 'neighbor-new' }];
    const affected = new Set([newcomer.id, nodes[0]!.id]);
    const frame = [newcomer, ...nodes];
    freezeKnowledgeGraphUnaffectedScope(frame, affected);
    runBoundedSimulation(frame, nextLinks, KNOWLEDGE_FORCE_COOLDOWN_TICKS['2d']);
    expect(Math.hypot(newcomer.x - (nodes[0]!.x + 10), newcomer.y - (nodes[0]!.y + 10))).toBeGreaterThan(0);
    for (const node of nodes) {
      if (affected.has(node.id)) continue;
      const prior = settledById.get(node.id)!;
      expect(node.x).toBeCloseTo(prior.x, 6);
      expect(node.y).toBeCloseTo(prior.y, 6);
    }
    releaseKnowledgeGraphFrozenScope(frame, {
      frozenNodeIds: new Set(nodes.filter((node) => !affected.has(node.id)).map((node) => node.id)),
      pinnedNodeIds: new Set(),
    });
    // After release the unaffected nodes own their coordinates again: they
    // stay put as converged seeds instead of carrying fixed anchors.
    for (const node of nodes) {
      if (affected.has(node.id)) continue;
      expect(node.fx).toBeUndefined();
      expect(node.fy).toBeUndefined();
    }
  });

  it('releases the drag-isolation frame without touching pins, roots or the dragged node', () => {
    const nodes: SimNode[] = [
      { id: 'dragged', x: 1, y: 2, fx: 1, fy: 2 },
      { id: 'frozen-ordinary', x: 3, y: 4, fx: 3, fy: 4 },
      { id: 'pinned', x: 5, y: 6, fx: 5, fy: 6, __knowledgeUserPinned: true },
      {
        id: 'root-entry',
        x: 7,
        y: 8,
        fx: 7,
        fy: 8,
        __knowledgeRootPacking: { order: 1 },
      },
    ];
    releaseKnowledgeGraphDragFrame(nodes, {
      draggedId: 'dragged',
      pinnedNodeIds: new Set(['pinned']),
    });
    expect(nodes[0]!.fx).toBe(1);
    expect(nodes[1]!.fx).toBeUndefined();
    expect(nodes[1]!.fy).toBeUndefined();
    expect(nodes[2]!.fx).toBe(5);
    expect(nodes[3]!.fx).toBe(7);
  });

  it('stores drag-end positions as explicit pins and reapplies them', () => {
    const node: SimNode = { id: 'concept-1', x: 41, y: 42 };
    const stored = storeKnowledgeGraphNodePosition(
      { version: 0, positionsByNodeId: {} },
      { id: node.id, x: node.x, y: node.y },
    );
    expect(stored.positionsByNodeId['concept-1']).toMatchObject({ x: 41, y: 42, pinned: true });
    const projected = applyKnowledgeGraphStoredPositions([node], stored);
    expect(projected[0]).toMatchObject({ fx: 41, fy: 42 });
  });

  it('does not restart the engine when the structure signature is unchanged', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }];
    const links = [
      { sourceId: 'a', targetId: 'b' },
    ];
    const base = computeKnowledgeForceStructureSignature(nodes, links, ['v1']);
    expect(computeKnowledgeForceStructureSignature(
      [{ id: 'b' }, { id: 'a' }],
      [{ source: 'a', target: 'b' }],
      ['v1'],
    )).toBe(base);
    expect(computeKnowledgeForceStructureSignature(nodes, links, ['v2'])).not.toBe(base);
    expect(computeKnowledgeForceStructureSignature(nodes, [], ['v1'])).not.toBe(base);
  });
});

describe('default overview label budgets (#1739 task 4.2)', () => {
  it('keeps the settled overview readable within the visible-ratio and overlap budgets', () => {
    const { nodes, links } = overviewFixture();
    markKnowledgeGraphAutomaticNodeAnchors(nodes);
    const simulation = createBoundedSimulation(nodes, links);
    runTicks(simulation, KNOWLEDGE_FORCE_WARMUP_TICKS['2d'] + KNOWLEDGE_FORCE_COOLDOWN_TICKS['2d']);

    // Model the renderer's camera-fit step: the settled layout is centered
    // and scaled into the viewport before label placement runs.
    const xs = nodes.map((node) => node.x);
    const ys = nodes.map((node) => node.y);
    const minX = Math.min(...xs) - 60;
    const maxX = Math.max(...xs) + 60;
    const minY = Math.min(...ys) - 40;
    const maxY = Math.max(...ys) + 40;
    const fitScale = Math.min(1, 1280 / (maxX - minX), 720 / (maxY - minY));
    const placements = placeKnowledgeGraphLabels({
      nodes: nodes.map((node) => ({
        id: node.id,
        x: node.x,
        y: node.y,
        screenX: (node.x - (minX + maxX) / 2) * fitScale + 640,
        screenY: (node.y - (minY + maxY) / 2) * fitScale + 360,
        projectedScale: fitScale,
        bodyRadius: 22,
        labelBounds: { halfWidth: 48, halfHeight: 11 },
      })),
      labelMode: 'all',
      scale: fitScale,
      width: 1280,
      height: 720,
      padding: { top: 16, right: 16, bottom: 16, left: 16 },
      enforceViewport: true,
    });

    const entries = [...placements.values()];
    const eligible = entries.length;
    const visible = entries.filter((placement) => placement.visible);
    expect(eligible).toBe(nodes.length);
    // Desktop overview budget: at least 80% of concept labels stay visible
    // in the ordinary state after separation and collision deferral.
    expect(visible.length / eligible).toBeGreaterThanOrEqual(
      KNOWLEDGE_LABEL_OVERVIEW_MIN_VISIBLE_RATIO.desktop,
    );

    // Visible labels never overlap one another.
    // Reconstruct the placed label boxes from the solver's own offsets.
    const rectById = new Map(nodes.map((node) => {
      const placement = placements.get(node.id);
      const centerX = (node.x - (minX + maxX) / 2) * fitScale + 640 + (placement?.offsetX ?? 0);
      const centerY = (node.y - (minY + maxY) / 2) * fitScale + 360 + (placement?.offsetY ?? 0);
      const halfWidth = 48 * fitScale * (placement?.scale || 1);
      const halfHeight = 11 * fitScale * (placement?.scale || 1);
      return [node.id, {
        left: centerX - halfWidth,
        right: centerX + halfWidth,
        top: centerY - halfHeight,
        bottom: centerY + halfHeight,
      }];
    }));
    const visibleIds = nodes
      .map((node) => node.id)
      .filter((id) => placements.get(id)?.visible);
    let overlaps = 0;
    for (let left = 0; left < visibleIds.length; left += 1) {
      for (let right = left + 1; right < visibleIds.length; right += 1) {
        const a = rectById.get(visibleIds[left]!)!;
        const b = rectById.get(visibleIds[right]!)!;
        if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) overlaps += 1;
      }
    }
    expect(overlaps).toBeLessThanOrEqual(KNOWLEDGE_LABEL_OVERVIEW_MAX_OVERLAP_COUNT);
  });
});
