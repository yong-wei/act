import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import {
  getKnowledgeNodeLabelBounds,
  KNOWLEDGE_ROOT_LABEL_POLICY,
  KNOWLEDGE_ROOT_MINIMUM_PROJECTION_SCALE,
} from '../graph/node-label-layout';
import { getKnowledgeNodeLabelPresentation } from '../graph/label-policy';
import {
  applyKnowledgeGraph3DControlsPolicy,
  normalizeKnowledgeRootCameraPose,
  getKnowledgeGraph3DControlsPolicy,
  getKnowledgeGraphViewportFit,
  getKnowledgeGraphViewportSafeInsets,
  getKnowledgeProjectionScale,
  getPerspectiveCameraFitDistance,
  getKnowledgeRootProjectionSafeCameraDistance,
  placeKnowledgeGraphLabels,
  projectKnowledgeWorldPoint,
} from '../graph/viewport-fit';
import { packKnowledgeGraphRootNodes } from '../graph/root-layout';

describe('knowledge graph viewport fit', () => {
  it('derives the shared root projection floor from the readable and natural font sizes', () => {
    expect(KNOWLEDGE_ROOT_MINIMUM_PROJECTION_SCALE).toBe(
      KNOWLEDGE_ROOT_LABEL_POLICY.minimumReadableFontSize / KNOWLEDGE_ROOT_LABEL_POLICY.fontSize
    );
    expect(getKnowledgeRootProjectionSafeCameraDistance({
      viewportHeight: 600, fovDegrees: 50, zoom: 1,
    })).toBe(getPerspectiveCameraFitDistance({
      viewportHeight: 600,
      pixelsPerWorldUnit: KNOWLEDGE_ROOT_MINIMUM_PROJECTION_SCALE,
      fovDegrees: 50,
      zoom: 1,
    }));
  });

  it('normalizes a side-view root pose to a front view while preserving target and up', () => {
    const pose = {
      position: { x: 33, y: 44, z: 12 },
      target: { x: 3, y: 4, z: 12 },
      up: { x: 0, y: 1, z: 0 },
    };
    expect(normalizeKnowledgeRootCameraPose(pose, 25)).toEqual({
      position: { x: 3, y: 4, z: 37 },
      target: pose.target,
      up: pose.up,
    });
    expect(normalizeKnowledgeRootCameraPose(pose, 80)).toEqual({
      position: { x: 3, y: 4, z: 62 },
      target: pose.target,
      up: pose.up,
    });
  });

  it('uses a valid positive maximum when the restored root pose has zero distance', () => {
    const pose = {
      position: { x: 3, y: 4, z: 12 },
      target: { x: 3, y: 4, z: 12 },
      up: { x: 0, y: 1, z: 0 },
    };
    expect(normalizeKnowledgeRootCameraPose(pose, 25).position).toEqual({ x: 3, y: 4, z: 37 });
  });

  it('locks only compact-root 3D controls and leaves domain controls unchanged', () => {
    const rootPolicy = getKnowledgeGraph3DControlsPolicy({
      compactRootView: true,
      viewportHeight: 600,
      fovDegrees: 50,
      zoom: 1,
    });
    expect(rootPolicy).toEqual({
      enablePan: true,
      enableRotate: false,
      enableZoom: true,
      maxDistance: getKnowledgeRootProjectionSafeCameraDistance({
        viewportHeight: 600, fovDegrees: 50, zoom: 1,
      }),
    });
    const controls = {
      enablePan: false,
      enableRotate: true,
      enableZoom: false,
      maxDistance: Number.POSITIVE_INFINITY,
    };
    const restore = applyKnowledgeGraph3DControlsPolicy(controls, rootPolicy);
    expect(controls).toEqual(rootPolicy);
    restore();
    expect(controls).toEqual({
      enablePan: false,
      enableRotate: true,
      enableZoom: false,
      maxDistance: Number.POSITIVE_INFINITY,
    });

    const domainPolicy = getKnowledgeGraph3DControlsPolicy({
      compactRootView: false,
      viewportHeight: 600,
      fovDegrees: 50,
      zoom: 1,
    });
    expect(domainPolicy).toBeNull();
    const domainControls = { ...controls };
    applyKnowledgeGraph3DControlsPolicy(domainControls, domainPolicy)();
    expect(domainControls).toEqual(controls);
  });
  it('fits every visible node body instead of sampling a local anchor subset', () => {
    const nodes = Array.from({ length: 62 }, (_, index) => ({
      id: index === 0 ? 'chapter-node:domain' : `node-${index}`,
      x: index * 80,
      y: index % 3 * 60,
      bodyRadius: 8,
      labelBounds: getKnowledgeNodeLabelBounds({ name: `节点${index}`, bodyRadius: 8 }),
    }));
    const fit = getKnowledgeGraphViewportFit({
      nodes, width: 1280, height: 720, labelMode: 'focus',
    });
    expect(fit.nodes).toHaveLength(nodes.length);
    expect(fit.nodes.map((node) => node.id)).toContain('node-61');
    fit.nodes.forEach((node) => {
      expect(node.left).toBeGreaterThanOrEqual(48 - 0.001);
      expect(node.right).toBeLessThanOrEqual(1280 - 48 + 0.001);
    });
  });
  it.each([[390, 844], [1280, 720]] as const)('keeps fit bounds above the fixed relation-control safe area at %sx%s', (width, height) => {
    const safeInsets = getKnowledgeGraphViewportSafeInsets({ width, height });
    const fit = getKnowledgeGraphViewportFit({
      width, height, padding: safeInsets, labelMode: 'all',
      nodes: Array.from({ length: 12 }, (_, index) => ({
        id: `safe-${index}`,
        x: (index % 4) * 80,
        y: Math.floor(index / 4) * 70,
        bodyRadius: 12,
        labelBounds: getKnowledgeNodeLabelBounds({ name: `安全区节点${index}`, bodyRadius: 12 }),
      })),
    });
    fit.nodes.forEach((node) => {
      expect(node.left).toBeGreaterThanOrEqual(safeInsets.left - 0.001);
      expect(node.right).toBeLessThanOrEqual(width - safeInsets.right + 0.001);
      expect(node.top).toBeGreaterThanOrEqual(safeInsets.top - 0.001);
      expect(node.bottom).toBeLessThanOrEqual(height - safeInsets.bottom + 0.001);
    });
    expect(fit.projectedFontSize).toBeGreaterThanOrEqual(12);
  });
  it.each([
    ['side', [350, 0, 0], [0, 1, 0]],
    ['top', [0, 350, 0], [0, 0, -1]],
    ['oblique', [240, 180, 210], [0, 1, 0]],
  ] as const)('keeps %s-view projected label scale and selected offsets finite', (_name, position, up) => {
    const width = 390;
    const height = 844;
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 2000);
    camera.position.set(position[0], position[1], position[2]);
    camera.up.set(up[0], up[1], up[2]);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const scale = getKnowledgeProjectionScale({
      center: { x: 0, y: 0, z: 0 },
      right: new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion),
      up: new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion),
      width,
      height,
      project: (value) => new THREE.Vector3(value.x, value.y, value.z).project(camera),
    });
    expect(Number.isFinite(scale)).toBe(true);
    expect(scale).toBeGreaterThan(0);
    expect(Number.isFinite(24 / scale)).toBe(true);
    expect(Number.isFinite(-18 / scale)).toBe(true);
  });

  it('uses the actual 50 degree camera fov and zoom for perspective distance', () => {
    expect(getPerspectiveCameraFitDistance({
      viewportHeight: 600, pixelsPerWorldUnit: 2, fovDegrees: 50, zoom: 1,
    })).toBeCloseTo(600 / (4 * Math.tan(25 * Math.PI / 180)), 8);
  });
  it('projects world xyz through a real 50 degree camera matrix', () => {
    const camera = new THREE.PerspectiveCamera(50, 390 / 844, 0.1, 2000);
    camera.position.set(0, 0, 500);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const point = projectKnowledgeWorldPoint({
      x: 0, y: 0, z: 0, width: 390, height: 844,
      project: (value) => new THREE.Vector3(value.x, value.y, value.z).project(camera),
    });
    expect(point.x).toBeCloseTo(195, 6);
    expect(point.y).toBeCloseTo(422, 6);
  });
  it('culls behind-camera, near-plane, far-plane, non-finite, and off-frustum labels before priority placement', () => {
    const width = 640;
    const height = 480;
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const candidates = [
      { id: 'visible', x: 0, y: 0, z: -5 },
      { id: 'behind-selected', x: 0, y: 0, z: 1 },
      { id: 'near-hovered', x: 0, y: 0, z: -0.05 },
      { id: 'far', x: 0, y: 0, z: -101 },
      { id: 'outside', x: 100, y: 0, z: -5 },
      { id: 'non-finite', x: Number.POSITIVE_INFINITY, y: 0, z: -5 },
    ];
    const nodes = candidates.map((node) => {
      const world = new THREE.Vector3(node.x, node.y, node.z);
      const cameraPoint = world.clone().applyMatrix4(camera.matrixWorldInverse);
      const ndc = world.clone().project(camera);
      const depth = -cameraPoint.z;
      const finite = [world.x, world.y, world.z, ndc.x, ndc.y, ndc.z, depth].every(Number.isFinite);
      return {
        ...node,
        screenX: (ndc.x + 1) * width / 2,
        screenY: (1 - ndc.y) * height / 2,
        projectedScale: 2,
        depth,
        isInFrustum: finite && depth >= camera.near && depth <= camera.far
          && ndc.x >= -1 && ndc.x <= 1 && ndc.y >= -1 && ndc.y <= 1
          && ndc.z >= -1 && ndc.z <= 1,
        bodyRadius: 10,
        importance: 5,
        labelBounds: getKnowledgeNodeLabelBounds({ name: node.id, bodyRadius: 10 }),
      };
    });
    const placed = placeKnowledgeGraphLabels({
      nodes, width, height, padding: 16, scale: 2, labelMode: 'all', enforceViewport: true,
      selectedNodeId: 'behind-selected', hoveredNodeId: 'near-hovered',
    });
    expect(placed.get('visible')?.visible).toBe(true);
    for (const id of ['behind-selected', 'near-hovered', 'far', 'outside', 'non-finite']) {
      expect(placed.get(id)?.visible, id).toBe(false);
    }
  });
  it('keeps a production-sized domain inside a 390 by 844 camera projection', () => {
    const width = 390;
    const height = 844;
    const nodes = Array.from({ length: 12 }, (_, index) => ({
      id: `domain-${index}`,
      x: (index % 3) * 90 - 90,
      y: Math.floor(index / 3) * 70 - 105,
      bodyRadius: 28,
      importance: index < 4 ? 5 : 1,
      labelBounds: getKnowledgeNodeLabelBounds({ name: `领域节点${index} WWWMMMM`, bodyRadius: 28 }),
    }));
    const fit = getKnowledgeGraphViewportFit({ nodes, width, height, padding: 24, labelMode: 'all' });
    const distance = getPerspectiveCameraFitDistance({
      viewportHeight: height, pixelsPerWorldUnit: fit.scale, fovDegrees: 50, zoom: 1,
    });
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 4000);
    camera.position.set(fit.centerX, fit.centerY, distance);
    camera.lookAt(fit.centerX, fit.centerY, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    nodes.forEach((node) => {
      const point = projectKnowledgeWorldPoint({
        ...node, z: 0, width, height,
        project: (value) => new THREE.Vector3(value.x, value.y, value.z).project(camera),
      });
      expect(point.x).toBeGreaterThanOrEqual(24);
      expect(point.x).toBeLessThanOrEqual(width - 24);
      expect(point.y).toBeGreaterThanOrEqual(24);
      expect(point.y).toBeLessThanOrEqual(height - 24);
    });
    fit.nodes.filter((node) => node.label.visible).forEach((node) => {
      expect(node.left).toBeGreaterThanOrEqual(24 - 0.001);
      expect(node.right).toBeLessThanOrEqual(width - 24 + 0.001);
      expect(node.top).toBeGreaterThanOrEqual(24 - 0.001);
      expect(node.bottom).toBeLessThanOrEqual(height - 24 + 0.001);
    });
  });
  it('projects body and offset-label unions into an asymmetric 320 by 270 camera safe area', () => {
    const width = 320;
    const height = 270;
    const padding = { top: 34, right: 18, bottom: 72, left: 46 };
    const nodes = [
      { id: 'selected', x: -180, y: 120, bodyRadius: 10 },
      { id: 'hovered', x: 180, y: -120, bodyRadius: 20 },
      { id: 'corner-3', x: -180, y: -120, bodyRadius: 40 },
      { id: 'corner-4', x: 180, y: 120, bodyRadius: 80 },
    ].map((node) => ({
      ...node,
      labelBounds: getKnowledgeNodeLabelBounds({
        name: `${node.id} WWWMMMM 四角标签`, bodyRadius: node.bodyRadius,
      }),
    }));
    const fit = getKnowledgeGraphViewportFit({
      nodes, width, height, padding, labelMode: 'all',
      selectedNodeId: 'selected', hoveredNodeId: 'hovered',
    });
    const distance = getPerspectiveCameraFitDistance({
      viewportHeight: height, pixelsPerWorldUnit: fit.scale, fovDegrees: 50,
    });
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 4000);
    camera.position.set(fit.centerX, fit.cameraCenterY, distance);
    camera.lookAt(fit.centerX, fit.cameraCenterY, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const placements = placeKnowledgeGraphLabels({
      nodes, width, height, padding, scale: fit.scale, labelMode: 'all',
      selectedNodeId: 'selected', hoveredNodeId: 'hovered',
    });
    nodes.forEach((node) => {
      const center = projectKnowledgeWorldPoint({
        ...node, z: 0, width, height,
        project: (value) => new THREE.Vector3(value.x, value.y, value.z).project(camera),
      });
      const radius = node.bodyRadius * fit.scale;
      expect(center.x - radius).toBeGreaterThanOrEqual(padding.left - 0.01);
      expect(center.x + radius).toBeLessThanOrEqual(width - padding.right + 0.01);
      expect(center.y - radius).toBeGreaterThanOrEqual(padding.top - 0.01);
      expect(center.y + radius).toBeLessThanOrEqual(height - padding.bottom + 0.01);
      const placement = placements.get(node.id)!;
      if (!placement.visible) return;
      const halfWidth = node.labelBounds.halfWidth * fit.scale * placement.scale;
      const halfHeight = node.labelBounds.halfHeight * fit.scale * placement.scale;
      expect(center.x + placement.offsetX - halfWidth).toBeGreaterThanOrEqual(padding.left - 0.01);
      expect(center.x + placement.offsetX + halfWidth).toBeLessThanOrEqual(width - padding.right + 0.01);
      expect(center.y + placement.offsetY - halfHeight).toBeGreaterThanOrEqual(padding.top - 0.01);
      expect(center.y + placement.offsetY + halfHeight).toBeLessThanOrEqual(height - padding.bottom + 0.01);
    });
    expect(placements.get('selected')?.visible).toBe(true);
    expect(placements.get('hovered')?.visible).toBe(true);
  });
  it.each([6.07 / 13, 7.64 / 13])('keeps priority candidates eligible at 12px and hides ordinary labels at scale %s', (scale) => {
    for (const renderer of ['2d', '3d']) {
      const chapterCandidate = getKnowledgeNodeLabelPresentation({
        labelMode: 'focus', nodeId: 'chapter-node:root', globalScale: scale,
        isRootBubble: true,
      });
      const deferred = getKnowledgeNodeLabelPresentation({
        labelMode: 'all', nodeId: `ordinary-${renderer}`, globalScale: scale,
      });
      expect(chapterCandidate.visible).toBe(true);
      expect(chapterCandidate.fontSize).toBe(12);
      expect(chapterCandidate.placement).toBe('inside');
      expect(chapterCandidate.complete).toBe(true);
      expect(deferred.visible).toBe(false);
      const keyNode = getKnowledgeNodeLabelPresentation({
        labelMode: 'focus', nodeId: `key-${renderer}`, globalScale: scale, isKeyNode: true,
      });
      expect(keyNode.visible).toBe(true);
      expect(keyNode.fontSize).toBe(12);
    }
  });

  it.each([[320, 270], [390, 844]] as const)('culls 24 long labels deterministically at %sx%s', (width, height) => {
    const scale = 6.07 / 13;
    const nodes = Array.from({ length: 24 }, (_, index) => ({
      id: `node-${index}`,
      x: (64 + (index % 6) * ((width - 112) / 5)) / scale,
      y: (96 + Math.floor(index / 6) * ((height - 128) / 3)) / scale,
      bodyRadius: 12,
      importance: index < 12 ? 5 : 1,
      labelBounds: getKnowledgeNodeLabelBounds({ name: `WWWMMMM超长重点知识节点名称${index}`, bodyRadius: 12 }),
    }));
    const placed = placeKnowledgeGraphLabels({
      nodes, width, height, padding: 16, enforceViewport: true,
      scale, selectedNodeId: 'node-0', hoveredNodeId: 'node-23', labelMode: 'all',
    });
    expect(placed.get('node-0')?.visible).toBe(true);
    const visible = nodes.flatMap((node) => {
      const placement = placed.get(node.id)!;
      if (!placement.visible) return [];
      const halfWidth = node.labelBounds.halfWidth * placement.scale * scale;
      const halfHeight = node.labelBounds.halfHeight * placement.scale * scale;
      return [{ left: node.x * scale + placement.offsetX - halfWidth,
        right: node.x * scale + placement.offsetX + halfWidth,
        top: node.y * scale + placement.offsetY - halfHeight,
        bottom: node.y * scale + placement.offsetY + halfHeight }];
    });
    visible.forEach((rect, index) => visible.slice(index + 1).forEach((other) => {
      expect(rect.left < other.right && rect.right > other.left && rect.top < other.bottom && rect.bottom > other.top).toBe(false);
    }));
  });

  it('keeps selected and delays colliding hover, then sorts mixed ids by Unicode scalar order', () => {
    const makeNode = (id: string, bodyRadius = 12) => ({
      id, x: 160, y: 135, bodyRadius, importance: 5,
      labelBounds: getKnowledgeNodeLabelBounds({ name: `长标签${id}WWWMMMM`, bodyRadius }),
    });
    const collision = placeKnowledgeGraphLabels({
      nodes: [makeNode('selected'), makeNode('hover')], width: 320, height: 270,
      padding: 16, enforceViewport: true, scale: 1, labelMode: 'all',
      selectedNodeId: 'selected', hoveredNodeId: 'hover',
    });
    expect(collision.get('selected')?.visible).toBe(true);
    expect(collision.get('hover')?.visible).toBe(true);

    const mixed = placeKnowledgeGraphLabels({
      nodes: [makeNode('中', 0), makeNode('A', 0), makeNode('é', 0)], width: 320, height: 270,
      padding: 16, enforceViewport: true, scale: 1, labelMode: 'all',
    });
    expect(mixed.get('A')?.visible).toBe(true);
    expect(mixed.get('é')?.visible).toBe(true);
    expect(mixed.get('中')?.visible).toBe(false);
    expect(mixed.get('A')?.offsetY).toBeLessThan(0);
    expect(new Set([...mixed.values()].filter((placement) => placement.visible)
      .map((placement) => `${placement.offsetX}:${placement.offsetY}`)).size).toBe(2);
  });

  it('keeps compact-priority labels visible when no collision-free viewport placement remains', () => {
    const nodes = ['key-a', 'key-b'].map((id) => ({
      id,
      x: -240,
      y: -180,
      bodyRadius: 12,
      isKeyNode: true,
      labelBounds: getKnowledgeNodeLabelBounds({ name: `重点节点${id}WWWMMMM`, bodyRadius: 12 }),
    }));
    const placements = placeKnowledgeGraphLabels({
      nodes,
      width: 320,
      height: 270,
      padding: 16,
      enforceViewport: true,
      scale: 1,
      labelMode: 'focus',
    });
    expect(placements.get('key-a')?.visible).toBe(true);
    expect(placements.get('key-b')?.visible).toBe(true);
  });

  it('uses packing state rather than chapter ids when placing root labels', () => {
    const node = {
      id: 'chapter-node:shared', x: 160, y: 135, bodyRadius: 12,
      labelBounds: getKnowledgeNodeLabelBounds({ name: '同一章节领域', bodyRadius: 12 }),
    };
    const domainPlacement = placeKnowledgeGraphLabels({
      nodes: [node], width: 320, height: 270, padding: 16,
      scale: 1, labelMode: 'all',
    }).get(node.id)!;
    const rootPlacement = placeKnowledgeGraphLabels({
      nodes: [{ ...node, isRootBubble: true }], width: 320, height: 270, padding: 16,
      scale: 0.5, labelMode: 'focus',
    }).get(node.id)!;

    expect(domainPlacement).toMatchObject({
      visible: true, placement: 'external', complete: false,
    });
    expect(domainPlacement.offsetY).not.toBe(0);
    expect(rootPlacement).toMatchObject({
      visible: true, placement: 'inside', complete: true,
      fontSize: 12, offsetX: 0, offsetY: 0,
    });
  });

  it.each([
    ['top-left', 16, 16],
    ['top-right', 304, 16],
    ['bottom-left', 16, 198],
    ['bottom-right', 304, 198],
  ] as const)('never lets selected or hovered %s fallback escape the 320x270 safe area', (_case, x, y) => {
    for (const focus of ['selected', 'hovered'] as const) {
      const node = {
        id: focus, x: 0, y: 0, screenX: x, screenY: y, projectedScale: 1,
        bodyRadius: 10,
        labelBounds: getKnowledgeNodeLabelBounds({ name: '边角超长选中标签WWWMMMM', bodyRadius: 10 }),
      };
      const placement = placeKnowledgeGraphLabels({
        nodes: [node], width: 320, height: 270,
        padding: { top: 16, right: 16, bottom: 72, left: 16 },
        enforceViewport: true, scale: 1, labelMode: 'all',
        selectedNodeId: focus === 'selected' ? focus : null,
        hoveredNodeId: focus === 'hovered' ? focus : null,
      }).get(focus)!;
      expect(placement.visible).toBe(true);
      expect(placement.fontSize).toBeGreaterThanOrEqual(12);
      const halfWidth = node.labelBounds.halfWidth * placement.scale;
      const halfHeight = node.labelBounds.halfHeight * placement.scale;
      expect(x + placement.offsetX - halfWidth).toBeGreaterThanOrEqual(16);
      expect(x + placement.offsetX + halfWidth).toBeLessThanOrEqual(304);
      expect(y + placement.offsetY - halfHeight).toBeGreaterThanOrEqual(16);
      expect(y + placement.offsetY + halfHeight).toBeLessThanOrEqual(198);
    }
  });

  it.each([
    ['single', [{ id: 'chapter-node:single', x: 0, y: 0 }]],
    ['edge', [{ id: 'chapter-node:left', x: -180, y: -90 }, { id: 'chapter-node:right', x: 180, y: 90 }]],
    ['short-chain', Array.from({ length: 4 }, (_, index) => ({ id: `chapter-node:${index}`, x: index * 90, y: index * 30 }))],
    ['dense', Array.from({ length: 16 }, (_, index) => ({ id: `chapter-node:${index}`, x: (index % 4) * 70, y: Math.floor(index / 4) * 55 }))],
  ])('keeps %s presentation bounds inside mobile viewports', (_name, positions) => {
    for (const [width, height] of [[320, 270], [390, 844]] as const) {
      const fit = getKnowledgeGraphViewportFit({
        width, height, padding: 24, labelMode: 'focus',
        nodes: positions.map((node) => ({
          ...node,
          bodyRadius: 32,
          isRootBubble: true,
          labelBounds: getKnowledgeNodeLabelBounds({ name: `${node.id} WWWMMMM`, bodyRadius: 32 }),
        })),
      });
      for (const node of fit.nodes) {
        expect(node.left).toBeGreaterThanOrEqual(24 - 0.001);
        expect(node.right).toBeLessThanOrEqual(width - 24 + 0.001);
        expect(node.top).toBeGreaterThanOrEqual(24 - 0.001);
        expect(node.bottom).toBeLessThanOrEqual(height - 24 + 0.001);
        expect(node.label.visible ? node.label.fontSize : 12).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it.each([[390, 844]] as const)('projects packed root label rectangles without overlap at %sx%s', (width, height) => {
    const packed = packKnowledgeGraphRootNodes(
      Array.from({ length: 8 }, (_, index) => ({
        id: `chapter-node:${index}`,
        name: `第${index + 1}章 WWWMMMM 混合知识领域名称`,
        nodeType: 'THEORY' as const,
        description: '',
        positionX: 0,
        positionY: 0,
        positionZ: 0,
        metadata: { isVirtualChapter: true, isCollapsedRoot: true, nodeCount: 24 },
      })),
      { viewportWidth: width, viewportHeight: height }
    );
    const fit = getKnowledgeGraphViewportFit({
      width, height, padding: 16, labelMode: 'focus',
      nodes: packed.map((node) => ({
        id: node.id,
        x: node.x,
        y: node.y,
        bodyRadius: node.__knowledgeRootPacking.labelBounds.halfHeight,
        isRootBubble: true,
        labelBounds: node.__knowledgeRootPacking.labelBounds,
      })),
    });
    const visibleLabels = fit.nodes.filter((node) => node.labelRect !== null);
    visibleLabels.forEach((node, index) => {
      visibleLabels.slice(index + 1).forEach((other) => {
        const overlap = node.labelRect!.left < other.labelRect!.right
          && node.labelRect!.right > other.labelRect!.left
          && node.labelRect!.top < other.labelRect!.bottom
          && node.labelRect!.bottom > other.labelRect!.top;
        expect(overlap).toBe(false);
      });
    });
  });
});
