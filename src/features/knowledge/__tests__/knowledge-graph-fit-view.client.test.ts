// @vitest-environment jsdom

import React, { forwardRef, StrictMode, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { act } from 'react';
import { createRoot as createReactRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const forceGraph = vi.hoisted(() => ({
  twoDZoom: vi.fn(),
  twoDCenterAt: vi.fn(),
  threeDCameraPosition: vi.fn(),
  twoDGraph2Screen: vi.fn((x: number, y: number) => ({ x: x * 2 + 180, y: y * 2 + 120 })),
  twoDProps: {} as Record<string, unknown>,
  threeDProps: {} as Record<string, unknown>,
  threeDControlsListeners: new Set<() => void>(),
  threeDCamera: null as THREE.PerspectiveCamera | null,
  threeDTarget: null as THREE.Vector3 | null,
  suppressEngineStop: false,
}));
const activeRoots = new Set<Root>();

function createRoot(container: Element | DocumentFragment) {
  const root = createReactRoot(container);
  const unmount = root.unmount.bind(root);
  root.unmount = () => {
    activeRoots.delete(root);
    unmount();
  };
  activeRoots.add(root);
  return root;
}

function forceGraphMock(kind: 'twoD' | 'threeD') {
  return forwardRef(function ForceGraph(props: Record<string, unknown>, ref) {
    forceGraph[kind === 'twoD' ? 'twoDProps' : 'threeDProps'] = props;
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    if (!cameraRef.current) {
      cameraRef.current = new THREE.PerspectiveCamera(50, 4 / 3, 0.1, 2000);
      cameraRef.current.position.set(0, 0, 500);
      cameraRef.current.lookAt(0, 0, 0);
      cameraRef.current.updateProjectionMatrix();
      cameraRef.current.updateMatrixWorld();
    }
    const camera = cameraRef.current;
    if (kind === 'threeD') {
      camera.aspect = Number(props.width ?? 800) / Math.max(1, Number(props.height ?? 600));
      camera.updateProjectionMatrix();
    }
    const target = useRef(new THREE.Vector3());
    if (kind === 'threeD') {
      forceGraph.threeDCamera = camera;
      forceGraph.threeDTarget = target.current;
    }
    useEffect(() => {
      if (!forceGraph.suppressEngineStop) {
        (props.onEngineStop as (() => void) | undefined)?.();
      }
    }, [props.graphData, props.onEngineStop]);
    useImperativeHandle(ref, () => ({
      graphData: () => props.graphData,
      d3Force: () => ({ strength: () => undefined, distance: () => undefined }),
      refresh: () => undefined,
      zoom: forceGraph.twoDZoom,
      centerAt: forceGraph.twoDCenterAt,
      cameraPosition: (position: THREE.Vector3Like, nextTarget: THREE.Vector3Like) => {
        camera.position.set(position.x, position.y, position.z);
        target.current.set(nextTarget.x, nextTarget.y, nextTarget.z);
        camera.lookAt(target.current);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
        forceGraph.threeDCameraPosition(position, nextTarget, 0);
      },
      graph2ScreenCoords: kind === 'twoD' ? forceGraph.twoDGraph2Screen : (x: number, y: number, z = 0) => {
        const projected = new THREE.Vector3(x, y, z).project(camera);
        return {
          x: (projected.x + 1) * Number(props.width ?? 800) / 2,
          y: (1 - projected.y) * Number(props.height ?? 600) / 2,
        };
      },
      camera: () => camera,
      controls: () => ({
        target: target.current,
        addEventListener: (event: string, listener: () => void) => {
          if (event === 'change') forceGraph.threeDControlsListeners.add(listener);
        },
        removeEventListener: (event: string, listener: () => void) => {
          if (event === 'change') forceGraph.threeDControlsListeners.delete(listener);
        },
      }),
    }));
    return React.createElement('canvas');
  });
}

vi.mock('react-force-graph-2d', () => ({ default: forceGraphMock('twoD') }));
vi.mock('react-force-graph-3d', () => ({ default: forceGraphMock('threeD') }));

import {
  KnowledgeGraph2D,
  KNOWLEDGE_GRAPH_2D_LIBRARY_DEFAULT_MIN_ZOOM,
} from '../graph/knowledge-graph-2d';
import {
  getKnowledgeGraphProjectedSphereBounds,
  getKnowledgeGraphNodeVisualDataSignature,
  KnowledgeGraphCanvas,
} from '../graph/knowledge-graph-canvas';
import { getEmptyKnowledgeGraphLayoutState } from '../graph/layout-state';
import {
  getKnowledgeNodeLabelBounds,
  KNOWLEDGE_ROOT_MINIMUM_PROJECTION_SCALE,
  layoutKnowledgeRootLabel,
} from '../graph/node-label-layout';
import type { KnowledgeGraphFitRequest } from '../graph/root-layout';
import {
  getKnowledgeGraphViewportFit,
  getKnowledgeGraphViewportSafeInsets,
  getKnowledgeProjectionScale,
  projectKnowledgeWorldPoint,
} from '../graph/viewport-fit';
import { getKnowledgeNodeMaximumPresentationRadius } from '../graph/visual-config';

const rootNodes = [
  {
    id: 'chapter-node:基本概念', name: '基本概念', nodeType: 'THEORY' as const,
    description: '', positionX: 0, positionY: 0, positionZ: 0,
    metadata: { isCollapsedRoot: true },
  },
  {
    id: 'chapter-node:系统模型', name: '系统模型', nodeType: 'THEORY' as const,
    description: '', positionX: 0, positionY: 0, positionZ: 0,
    metadata: { isCollapsedRoot: true },
  },
];
const domainNodes = [
  rootNodes[0],
  {
    id: 'member-1', name: '成员', nodeType: 'THEORY' as const,
    description: '', positionX: 80, positionY: 0, positionZ: 0,
    metadata: { chapterName: '基本概念' },
  },
];
const otherDomainNodes = [
  rootNodes[1],
  {
    id: 'member-2', name: '另一领域成员', nodeType: 'THEORY' as const,
    description: '', positionX: -80, positionY: 0, positionZ: 0,
    metadata: { chapterName: '系统模型' },
  },
];
const productionRootNodes = [
  '前沿拓展', '基本概念', '建模专题速通', '时域分析', '根轨迹分析', '状态空间',
  '知识边界与方法迁移层', '离散系统', '系统校正', '系统模型', '约束设计层',
  '结构机理层', '课程全景', '非线性系统', '频域分析',
].map((name) => ({
  id: `chapter-node:${name}`,
  name,
  nodeType: 'THEORY' as const,
  description: '',
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  metadata: { isCollapsedRoot: true },
}));

function rendererProps(
  nodes: typeof rootNodes | typeof domainNodes | typeof otherDomainNodes,
  fitViewRequest: KnowledgeGraphFitRequest
) {
  return {
    nodes, links: [], selectedNode: null, hoveredNode: null,
    onNodeClick: () => undefined, onNodeHover: () => undefined,
    onNodeDragEnd: () => undefined,
    onBackgroundClick: () => undefined, labelMode: 'focus' as const,
    layoutState: getEmptyKnowledgeGraphLayoutState(), fitViewRequest,
    relayoutVersion: 0, expandedNodeIds: [], expandedDirectLinks: [],
    activationSequenceByCenterId: {}, materializedNodeIds: [],
    graphVersion: 'v1', width: 800, height: 600,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    scale: vi.fn(), clearRect: vi.fn(), measureText: (text: string) => ({ width: text.length * 8 }),
    strokeText: vi.fn(), fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,');
  forceGraph.twoDZoom.mockClear();
  forceGraph.twoDCenterAt.mockClear();
  forceGraph.threeDCameraPosition.mockClear();
  forceGraph.threeDControlsListeners.clear();
  forceGraph.threeDCamera = null;
  forceGraph.threeDTarget = null;
  forceGraph.suppressEngineStop = false;
  forceGraph.twoDGraph2Screen.mockClear();
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: true,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
});

function expectCompleteRootProjectedBoundsInsideCanvas(width: number, height: number) {
  const camera = forceGraph.threeDCamera!;
  const graphData = forceGraph.threeDProps.graphData as {
    nodes: Array<Record<string, any>>;
  };
  const project = (point: { x: number; y: number; z: number }) => {
    const projected = new THREE.Vector3(point.x, point.y, point.z).project(camera);
    return { x: projected.x, y: projected.y, z: projected.z };
  };
  graphData.nodes.forEach((node) => {
    const center = projectKnowledgeWorldPoint({
      x: node.x,
      y: node.y,
      z: node.z ?? 0,
      width,
      height,
      project,
    });
    const projectedScale = getKnowledgeProjectionScale({
      center: { x: node.x, y: node.y, z: node.z ?? 0 },
      right: new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion),
      up: new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion),
      width,
      height,
      project,
    });
    const bodyBounds = getKnowledgeGraphProjectedSphereBounds({
      camera,
      center: { x: node.x, y: node.y, z: node.z ?? 0 },
      radius: node.__knowledgeRootPacking.collisionRadius,
      width,
      height,
    })!;
    const label = layoutKnowledgeRootLabel(node.name);
    const fontSize = Math.max(12, label.fontSize * projectedScale);
    const labelHalfWidth = label.width * fontSize / label.fontSize / 2;
    const labelHalfHeight = label.height * fontSize / label.fontSize / 2;
    expect(Math.min(bodyBounds.left, center.x - labelHalfWidth), `${node.name} left projected bound`)
      .toBeGreaterThanOrEqual(8);
    expect(Math.max(bodyBounds.right, center.x + labelHalfWidth), `${node.name} right projected bound`)
      .toBeLessThanOrEqual(width - 8);
    expect(Math.min(bodyBounds.top, center.y - labelHalfHeight), `${node.name} top projected bound`)
      .toBeGreaterThanOrEqual(8);
    expect(Math.max(bodyBounds.bottom, center.y + labelHalfHeight), `${node.name} bottom projected bound`)
      .toBeLessThanOrEqual(height - 8);
  });
}

it('restores the force-graph minZoom default after compact root rerenders as a domain', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => root.render(React.createElement(KnowledgeGraph2D, rendererProps(rootNodes, {
    id: 30, target: 'root',
  }))));
  await act(async () => vi.runAllTimers());
  expect(forceGraph.twoDProps.minZoom).toBe(KNOWLEDGE_ROOT_MINIMUM_PROJECTION_SCALE);
  expect(forceGraph.twoDZoom.mock.calls[0]?.[0]).toBeGreaterThanOrEqual(
    KNOWLEDGE_ROOT_MINIMUM_PROJECTION_SCALE
  );

  await act(async () => root.render(React.createElement(KnowledgeGraph2D, rendererProps(domainNodes, {
    id: 30, target: 'current',
  }))));
  await act(async () => vi.runAllTimers());
  expect(forceGraph.twoDProps.minZoom).toBe(KNOWLEDGE_GRAPH_2D_LIBRARY_DEFAULT_MIN_ZOOM);
  expect(forceGraph.twoDProps.minZoom).toBeLessThan(KNOWLEDGE_ROOT_MINIMUM_PROJECTION_SCALE);
  await act(async () => root.unmount());
});

it('clamps a genuinely sub-floor dense root fit to the shared projection floor', async () => {
  const denseRootNodes = Array.from({ length: 24 }, (_, index) => ({
    id: `chapter-node:dense-${index}`,
    name: `第${index + 1}个完整控制系统建模与分析知识领域名称`,
    nodeType: 'THEORY' as const,
    description: '',
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    metadata: { isCollapsedRoot: true },
  }));
  const width = 390;
  const height = 844;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(React.createElement(KnowledgeGraph2D, {
    ...rendererProps(denseRootNodes, { id: 34, target: 'root' }),
    width,
    height,
  })));
  await act(async () => vi.runAllTimers());
  const graphData = forceGraph.twoDProps.graphData as { nodes: Array<Record<string, any>> };
  const fit = getKnowledgeGraphViewportFit({
    nodes: graphData.nodes.map((node) => ({
      id: node.id,
      x: node.x ?? 0,
      y: node.y ?? 0,
      bodyRadius: getKnowledgeNodeMaximumPresentationRadius(node),
      isRootBubble: Boolean(node.__knowledgeRootPacking),
      importance: node.importance,
      labelBounds: getKnowledgeNodeLabelBounds({
        name: node.name,
        bodyRadius: getKnowledgeNodeMaximumPresentationRadius(node),
      }),
    })),
    width,
    height,
    padding: getKnowledgeGraphViewportSafeInsets({ width, height }),
    labelMode: 'focus',
  });
  expect(fit.scale).toBeLessThan(KNOWLEDGE_ROOT_MINIMUM_PROJECTION_SCALE);
  expect(forceGraph.twoDZoom).toHaveBeenLastCalledWith(
    KNOWLEDGE_ROOT_MINIMUM_PROJECTION_SCALE,
    320,
  );
  await act(async () => root.unmount());
});

it.each([
  [390, 844],
  [1440, 900],
] as const)('keeps the production %sx%s compact-root fit unchanged', async (width, height) => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(React.createElement(KnowledgeGraph2D, {
    ...rendererProps(rootNodes, { id: width, target: 'root' }), width, height,
  })));
  await act(async () => vi.runAllTimers());
  const graphData = forceGraph.twoDProps.graphData as { nodes: Array<Record<string, any>> };
  const expected = getKnowledgeGraphViewportFit({
    nodes: graphData.nodes.map((node) => ({
      id: node.id,
      x: node.x ?? 0,
      y: node.y ?? 0,
      bodyRadius: getKnowledgeNodeMaximumPresentationRadius(node),
      isRootBubble: Boolean(node.__knowledgeRootPacking),
      importance: node.importance,
      labelBounds: getKnowledgeNodeLabelBounds({
        name: node.name,
        bodyRadius: getKnowledgeNodeMaximumPresentationRadius(node),
      }),
    })),
    width,
    height,
    padding: getKnowledgeGraphViewportSafeInsets({ width, height }),
    labelMode: 'focus',
  });
  expect(expected.scale).toBeGreaterThanOrEqual(KNOWLEDGE_ROOT_MINIMUM_PROJECTION_SCALE);
  expect(forceGraph.twoDZoom).toHaveBeenLastCalledWith(expected.scale, 320);
  await act(async () => root.unmount());
});

afterEach(async () => {
  for (const root of [...activeRoots]) {
    await act(async () => root.unmount());
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe.each([
  ['2D', KnowledgeGraph2D, forceGraph.twoDZoom, 'twoDProps'],
  ['3D', KnowledgeGraphCanvas, forceGraph.threeDCameraPosition, 'threeDProps'],
] as const)('%s fit request lifecycle', (_label, Renderer, fitCall, propsKey) => {
  it('fits first root once, skips domain and domain switches, then fits returned root once', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(React.createElement(Renderer, rendererProps(rootNodes, {
      id: 1,
      target: 'root',
    }))));
    await act(async () => vi.runAllTimers());
    expect(fitCall).toHaveBeenCalledTimes(1);

    const graphData = forceGraph[propsKey].graphData as { nodes: Array<Record<string, unknown>> };
    expect(graphData.nodes.every((node) => node.x === node.fx && node.y === node.fy)).toBe(true);

    await act(async () => root.render(React.createElement(Renderer, rendererProps(domainNodes, {
      id: 1,
      target: 'root',
    }))));
    await act(async () => vi.runAllTimers());
    expect(fitCall).toHaveBeenCalledTimes(1);

    await act(async () => root.render(React.createElement(Renderer, rendererProps(otherDomainNodes, {
      id: 1,
      target: 'root',
    }))));
    await act(async () => vi.runAllTimers());
    expect(fitCall).toHaveBeenCalledTimes(1);

    await act(async () => root.render(React.createElement(Renderer, rendererProps(rootNodes, {
      id: 2,
      target: 'root',
    }))));
    await act(async () => vi.runAllTimers());
    expect(fitCall).toHaveBeenCalledTimes(2);

    await act(async () => root.unmount());
  });

  it('fits an explicitly requested dense teaching layout once without resetting an ordinary domain', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(React.createElement(Renderer, rendererProps(domainNodes, {
      id: 1,
      target: 'teaching-layout',
    }))));
    await act(async () => vi.runAllTimers());
    expect(fitCall).toHaveBeenCalledTimes(1);

    await act(async () => root.render(React.createElement(Renderer, rendererProps(otherDomainNodes, {
      id: 1,
      target: 'teaching-layout',
    }))));
    await act(async () => vi.runAllTimers());
    expect(fitCall).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
  });

  it('refits the same request after viewport and orientation changes', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(React.createElement(Renderer, rendererProps(rootNodes, { id: 3, target: 'root' }))));
    await act(async () => vi.runAllTimers());
    expect(fitCall).toHaveBeenCalledTimes(1);
    await act(async () => root.render(React.createElement(Renderer, {
      ...rendererProps(rootNodes, { id: 3, target: 'root' }), width: 320, height: 270,
    })));
    await act(async () => vi.runAllTimers());
    expect(fitCall).toHaveBeenCalledTimes(2);
    await act(async () => root.render(React.createElement(Renderer, {
      ...rendererProps(rootNodes, { id: 3, target: 'root' }), width: 270, height: 320,
    })));
    await act(async () => vi.runAllTimers());
    expect(fitCall).toHaveBeenCalledTimes(3);
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
    await act(async () => window.dispatchEvent(new Event('resize')));
    await act(async () => vi.runAllTimers());
    expect(fitCall).toHaveBeenCalledTimes(4);
    await act(async () => root.unmount());
  });

  it('cancels a stale scheduled fit when a request is replaced', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(React.createElement(Renderer, rendererProps(rootNodes, { id: 4, target: 'root' }))));
    await act(async () => root.render(React.createElement(Renderer, rendererProps(rootNodes, { id: 5, target: 'root' }))));
    await act(async () => vi.runAllTimers());
    expect(fitCall).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });

  it('replays a cleaned-up StrictMode fit and executes it exactly once', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(React.createElement(StrictMode, null,
      React.createElement(Renderer, rendererProps(rootNodes, { id: 6, target: 'root' }))
    )));
    await act(async () => vi.runAllTimers());
    expect(fitCall).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });

  it('waits for a non-zero canvas before fitting', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(React.createElement(Renderer, {
      ...rendererProps(rootNodes, { id: 7, target: 'root' }), width: 0, height: 0,
    })));
    await act(async () => vi.runAllTimers());
    expect(fitCall).not.toHaveBeenCalled();
    await act(async () => root.render(React.createElement(Renderer, {
      ...rendererProps(rootNodes, { id: 7, target: 'root' }), width: 390, height: 844,
    })));
    await act(async () => vi.runAllTimers());
    expect(fitCall).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });
});

it('3D auto-fits each ready domain scope once and initializes a new scope lock', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, {
    ...rendererProps(domainNodes, { id: 1, target: 'root' }),
    autoFitScopeKey: 'domain-a:post-only',
    autoFitReady: true,
  })));
  await act(async () => vi.runAllTimers());
  expect(forceGraph.threeDCameraPosition).toHaveBeenCalledTimes(1);

  await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, {
    ...rendererProps([domainNodes[0]], { id: 1, target: 'root' }),
    autoFitScopeKey: 'domain-a:post-only',
    autoFitReady: true,
    selectedNode: domainNodes[0],
  })));
  await act(async () => vi.runAllTimers());
  expect(forceGraph.threeDCameraPosition).toHaveBeenCalledTimes(1);

  await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, {
    ...rendererProps(domainNodes, { id: 1, target: 'root' }),
    autoFitScopeKey: 'domain-a:post-only',
    autoFitReady: true,
    labelMode: 'all',
  })));
  await act(async () => vi.runAllTimers());
  expect(forceGraph.threeDCameraPosition).toHaveBeenCalledTimes(1);

  await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, {
    ...rendererProps(otherDomainNodes, { id: 1, target: 'root' }),
    autoFitScopeKey: 'domain-b:post-only',
    autoFitReady: true,
  })));
  await act(async () => vi.runAllTimers());
  expect(forceGraph.threeDCameraPosition).toHaveBeenCalledTimes(2);

  await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, {
    ...rendererProps(domainNodes, { id: 1, target: 'root' }),
    autoFitScopeKey: 'domain-a:post-only',
    autoFitReady: true,
    autoFitConsumed: true,
  })));
  await act(async () => vi.runAllTimers());
  expect(forceGraph.threeDCameraPosition).toHaveBeenCalledTimes(2);

  await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, {
    ...rendererProps(domainNodes, { id: 1, target: 'root' }),
    autoFitScopeKey: 'domain-c:post-only',
    autoFitReady: true,
  })));
  await act(async () => vi.runAllTimers());
  expect(forceGraph.threeDCameraPosition).toHaveBeenCalledTimes(3);

  await act(async () => root.unmount());
});

it('3D keeps complete root sphere and label bounds inside the canvas after first fit, explicit fit, and repeated relayout', async () => {
  const width = 1320;
  const height = 831;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  forceGraph.suppressEngineStop = true;

  const renderFitState = async (fitRequestId: number, relayoutVersion: number) => {
    await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, {
      ...rendererProps(productionRootNodes, { id: fitRequestId, target: 'root' }),
      width,
      height,
      relayoutVersion,
    })));
    await act(async () => (forceGraph.threeDProps.onEngineStop as () => void)());
    await act(async () => vi.runAllTimers());
    expectCompleteRootProjectedBoundsInsideCanvas(width, height);
  };

  await renderFitState(40, 0);
  await renderFitState(41, 0);
  await renderFitState(41, 1);
  await renderFitState(41, 2);
  expect(forceGraph.threeDCameraPosition).toHaveBeenCalledTimes(4);
  await act(async () => root.unmount());
});

it('3D waits for a complete ready domain before consuming an auto-fit scope in StrictMode', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => root.render(React.createElement(StrictMode, null,
    React.createElement(KnowledgeGraphCanvas, {
      ...rendererProps([domainNodes[0]], { id: 1, target: 'root' }),
      autoFitScopeKey: 'domain-a:post-only',
      autoFitReady: false,
    })
  )));
  await act(async () => vi.runAllTimers());
  expect(forceGraph.threeDCameraPosition).not.toHaveBeenCalled();

  await act(async () => root.render(React.createElement(StrictMode, null,
    React.createElement(KnowledgeGraphCanvas, {
      ...rendererProps(domainNodes, { id: 1, target: 'root' }),
      autoFitScopeKey: 'domain-a:post-only',
      autoFitReady: true,
    })
  )));
  await act(async () => vi.runAllTimers());
  expect(forceGraph.threeDCameraPosition).toHaveBeenCalledTimes(1);

  await act(async () => root.unmount());
});

it('3D flushes the latest throttled controls pose to the old scope before A to B to A restoration', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const poses = new Map<string, {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    up: { x: number; y: number; z: number };
  }>();
  const onCameraPoseChange = vi.fn((scopeKey: string, pose: typeof poses extends Map<string, infer T> ? T : never) => {
    poses.set(scopeKey, pose);
  });

  await act(async () => root.render(React.createElement(StrictMode, null,
    React.createElement(KnowledgeGraphCanvas, {
      ...rendererProps(domainNodes, { id: 1, target: 'root' }),
      autoFitScopeKey: 'domain-a:post-only', autoFitReady: true, onCameraPoseChange,
    })
  )));
  await act(async () => vi.runAllTimers());

  const latestPose = {
    position: { x: 47, y: -23, z: 381 },
    target: { x: 9, y: 14, z: -2 },
    up: { x: 0.1, y: 0.98, z: 0.02 },
  };
  forceGraph.threeDCamera!.position.set(latestPose.position.x, latestPose.position.y, latestPose.position.z);
  forceGraph.threeDCamera!.up.set(latestPose.up.x, latestPose.up.y, latestPose.up.z);
  forceGraph.threeDTarget!.set(latestPose.target.x, latestPose.target.y, latestPose.target.z);
  await act(async () => forceGraph.threeDControlsListeners.forEach((listener) => listener()));

  await act(async () => root.render(React.createElement(StrictMode, null,
    React.createElement(KnowledgeGraphCanvas, {
      ...rendererProps(otherDomainNodes, { id: 1, target: 'root' }),
      autoFitScopeKey: 'domain-b:post-only', autoFitReady: true, onCameraPoseChange,
    })
  )));
  expect(poses.get('domain-a:post-only')).toEqual(latestPose);

  await act(async () => root.render(React.createElement(StrictMode, null,
    React.createElement(KnowledgeGraphCanvas, {
      ...rendererProps(domainNodes, { id: 1, target: 'root' }),
      autoFitScopeKey: 'domain-a:post-only', autoFitReady: true,
      autoFitConsumed: true, autoFitCameraManipulated: true,
      restoredCameraPose: poses.get('domain-a:post-only'), onCameraPoseChange,
    })
  )));
  await act(async () => vi.runAllTimers());
  expect(forceGraph.threeDCameraPosition).toHaveBeenLastCalledWith(
    latestPose.position,
    latestPose.target,
    0,
  );
  expect(poses.get('domain-b:post-only')).toBeUndefined();
  await act(async () => root.unmount());
});

it('3D restores a parent-owned pose across remount while explicit fit remains available', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const onCameraManipulation = vi.fn();
  let root = createRoot(container);

  await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, {
    ...rendererProps(domainNodes, { id: 1, target: 'root' }),
    autoFitScopeKey: 'domain-a:post-only',
    autoFitReady: true,
    onCameraManipulation,
  })));
  await act(async () => vi.runAllTimers());
  expect(forceGraph.threeDCameraPosition).toHaveBeenCalledTimes(1);
  await act(async () => container.firstElementChild?.dispatchEvent(new WheelEvent('wheel', { bubbles: true })));
  expect(onCameraManipulation).toHaveBeenCalledWith('domain-a:post-only');
  await act(async () => root.unmount());

  const restoredCameraPose = {
    position: { x: 31, y: -17, z: 420 },
    target: { x: 8, y: 4, z: 0 },
    up: { x: 0, y: 1, z: 0 },
  };
  root = createRoot(container);
  await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, {
    ...rendererProps(domainNodes, { id: 1, target: 'root' }),
    autoFitScopeKey: 'domain-a:post-only',
    autoFitReady: true,
    autoFitConsumed: true,
    autoFitCameraManipulated: true,
    restoredCameraPose,
    onCameraManipulation,
  })));
  await act(async () => vi.runAllTimers());
  expect(forceGraph.threeDCameraPosition).toHaveBeenCalledTimes(2);
  expect(forceGraph.threeDCameraPosition).toHaveBeenLastCalledWith(
    restoredCameraPose.position,
    restoredCameraPose.target,
    0,
  );

  await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, {
    ...rendererProps(domainNodes, { id: 2, target: 'current' }),
    autoFitScopeKey: 'domain-a:post-only',
    autoFitReady: true,
    autoFitConsumed: true,
    autoFitCameraManipulated: true,
    restoredCameraPose,
    onCameraManipulation,
  })));
  await act(async () => vi.runAllTimers());
  expect(forceGraph.threeDCameraPosition).toHaveBeenCalledTimes(3);
  await act(async () => root.unmount());
});

it('3D renders persistent screen-space DOM labels and removes the overlay on unmount', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, rendererProps(rootNodes, {
    id: 9, target: 'root',
  }))));
  await act(async () => vi.runAllTimers());
  expect(container.querySelector('[data-knowledge-3d-dom-label-layer="true"]')).not.toBeNull();
  const labels = [...container.querySelectorAll('[data-knowledge-3d-node-label]')];
  expect(labels).toHaveLength(rootNodes.length);
  labels.forEach((label) => {
    expect(Number(label.getAttribute('data-knowledge-screen-font-size'))).toBeGreaterThanOrEqual(12);
  });
  await act(async () => root.unmount());
  expect(container.querySelector('[data-knowledge-3d-dom-label-layer="true"]')).toBeNull();
});

it('2D projects the full label set once through the live pan and zoom transform', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(React.createElement(KnowledgeGraph2D, {
    ...rendererProps(rootNodes, { id: 8, target: 'root' }),
    selectedNode: rootNodes[0],
    width: 390,
    height: 844,
  })));
  await act(async () => vi.runAllTimers());
  forceGraph.twoDGraph2Screen.mockClear();
  const paint = forceGraph.twoDProps.nodeCanvasObject as (
    node: Record<string, unknown>, ctx: CanvasRenderingContext2D, scale: number
  ) => void;
  const graphData = forceGraph.twoDProps.graphData as { nodes: Array<Record<string, unknown>> };
  const translate = vi.fn();
  const context = new Proxy({
    globalAlpha: 1,
    translate,
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
  } as unknown as CanvasRenderingContext2D, {
    get(target, property) {
      if (property in target) return Reflect.get(target, property);
      return () => undefined;
    },
    set(target, property, value) {
      Reflect.set(target, property, value);
      return true;
    },
  });
  graphData.nodes.forEach((node) => paint(node, context, 2));
  expect(forceGraph.twoDGraph2Screen).toHaveBeenCalledWith(
    graphData.nodes[0].x,
    graphData.nodes[0].y
  );
  expect(forceGraph.twoDGraph2Screen.mock.calls.length).toBe(graphData.nodes.length * 2);
  expect(translate).toHaveBeenCalled();
  const movedNode = graphData.nodes[1] as { x: number; y: number };
  movedNode.x += 37;
  (forceGraph.twoDProps.onEngineTick as () => void)();
  forceGraph.twoDGraph2Screen.mockClear();
  graphData.nodes.forEach((node) => paint(node, context, 2));
  expect(forceGraph.twoDGraph2Screen).toHaveBeenCalledWith(movedNode.x, movedNode.y);
  expect(forceGraph.twoDGraph2Screen.mock.calls.length).toBe(graphData.nodes.length * 2);
  await act(async () => root.unmount());
});

it.each([
  ['desktop', 1440, 900],
  ['mobile', 390, 844],
] as const)('renders complete dimensional root bubbles in 2D at %s size', async (_name, width, height) => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const longRoot = {
    ...rootNodes[0],
    name: '完整系统建模知识领域名称',
  };
  await act(async () => root.render(React.createElement(KnowledgeGraph2D, {
    ...rendererProps([longRoot, rootNodes[1]], { id: 18, target: 'root' }),
    width,
    height,
  })));
  const graphData = forceGraph.twoDProps.graphData as {
    nodes: Array<Record<string, any>>;
  };
  const node = graphData.nodes.find((candidate) => candidate.id === longRoot.id)!;
  const addColorStop = vi.fn();
  const context = new Proxy({
    globalAlpha: 1,
    createRadialGradient: vi.fn(() => ({ addColorStop })),
    arc: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
  } as unknown as CanvasRenderingContext2D, {
    get(target, property) {
      if (property in target) return Reflect.get(target, property);
      return () => undefined;
    },
    set(target, property, value) {
      Reflect.set(target, property, value);
      return true;
    },
  });
  const paint = forceGraph.twoDProps.nodeCanvasObject as (
    node: Record<string, unknown>, ctx: CanvasRenderingContext2D, scale: number
  ) => void;

  paint(node, context, 1);

  expect(node.__knowledgeRootPacking.collisionRadius).toBeGreaterThanOrEqual(28);
  expect(context.createRadialGradient).toHaveBeenCalledTimes(2);
  expect(addColorStop).toHaveBeenCalledTimes(5);
  expect(context.fillStyle).toBe('#f8fafc');
  const arcRadii = (context.arc as ReturnType<typeof vi.fn>).mock.calls
    .map(([, , radius]) => radius as number);
  expect(arcRadii).toContain(node.__knowledgeRootPacking.collisionRadius);
  expect(arcRadii.some((radius) => radius > node.__knowledgeRootPacking.collisionRadius)).toBe(true);
  expect(arcRadii.some((radius) => radius < node.__knowledgeRootPacking.collisionRadius)).toBe(true);
  const paintedName = (context.fillText as ReturnType<typeof vi.fn>).mock.calls
    .map(([line]) => line)
    .join('')
    .replace(/\s+/gu, '');
  expect(paintedName).toBe(longRoot.name.replace(/\s+/gu, ''));
  await act(async () => root.unmount());
});

it.each([
  ['desktop', 1440, 900],
  ['mobile', 390, 844],
] as const)('renders equivalent complete spherical root bubbles in 3D at %s size', async (_name, width, height) => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const longRoot = {
    ...rootNodes[0],
    name: '完整系统建模知识领域名称',
  };
  forceGraph.suppressEngineStop = true;
  await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, {
    ...rendererProps([longRoot, rootNodes[1]], { id: 19, target: 'root' }),
    width,
    height,
  })));
  await act(async () => {
    (forceGraph.threeDProps.onEngineStop as () => void)();
    vi.runAllTimers();
  });
  const graphData = forceGraph.threeDProps.graphData as { nodes: Array<Record<string, any>> };
  const node = graphData.nodes.find((candidate) => candidate.id === longRoot.id)!;
  const factory = forceGraph.threeDProps.nodeThreeObject as (node: unknown) => THREE.Group;
  const object = factory(node);
  const body = object.userData.knowledgeBodyMesh as THREE.Mesh<
    THREE.SphereGeometry,
    THREE.MeshPhongMaterial
  >;
  const label = container.querySelector(`[data-knowledge-3d-node-label="${longRoot.id}"]`);

  expect(object.userData.knowledgeIsRootBubble).toBe(true);
  expect(object.userData.knowledgeRootLabelComplete).toBe(true);
  expect(object.userData.knowledgePresentationRadius).toBe(
    node.__knowledgeRootPacking.collisionRadius
  );
  expect(body.geometry).toBeInstanceOf(THREE.SphereGeometry);
  expect(body.material.shininess).toBe(72);
  expect(body.material.emissiveIntensity).toBeCloseTo(0.22);
  expect(label?.getAttribute('data-knowledge-root-label')).toBe('inside-complete');
  expect(label?.getAttribute('data-knowledge-complete-name')).toBe(longRoot.name);
  expect(label?.textContent?.replace(/\s+/gu, '')).toBe(longRoot.name.replace(/\s+/gu, ''));
  await act(async () => root.unmount());
});

it('keeps ordinary node geometry and external label policy outside the root map', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  forceGraph.suppressEngineStop = true;
  await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, {
    ...rendererProps(domainNodes, { id: 20, target: 'current' }),
    selectedNode: domainNodes[1],
  })));
  const graphData = forceGraph.threeDProps.graphData as { nodes: Array<Record<string, any>> };
  const member = graphData.nodes.find((node) => node.id === 'member-1')!;
  const factory = forceGraph.threeDProps.nodeThreeObject as (node: unknown) => THREE.Group;
  const object = factory(member);
  const label = container.querySelector('[data-knowledge-3d-node-label="member-1"]');

  expect(member.__knowledgeRootPacking).toBeUndefined();
  expect(object.userData.knowledgeIsRootBubble).toBe(false);
  expect(object.userData.knowledgeRootLabelComplete).toBe(false);
  expect(label?.getAttribute('data-knowledge-root-label')).toBeNull();
  await act(async () => root.unmount());
});

it('3D refreshes projection in place without replacing the node factory or Object3D', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, rendererProps(rootNodes, {
    id: 9, target: 'root',
  }))));
  await act(async () => vi.runAllTimers());
  const graphData = forceGraph.threeDProps.graphData as { nodes: Array<{ x: number }> };
  const beforeFactory = forceGraph.threeDProps.nodeThreeObject as (node: unknown) => THREE.Group;
  const nodeObject = beforeFactory(graphData.nodes[1]);
  const beforeChildren = [...nodeObject.children];
  graphData.nodes[1].x += 41;
  await act(async () => {
    (forceGraph.threeDProps.onEngineTick as () => void)();
    vi.runAllTimers();
  });
  expect(forceGraph.threeDProps.nodeThreeObject).toBe(beforeFactory);
  expect(nodeObject.children).toEqual(beforeChildren);
  await act(async () => root.unmount());
});

it('3D keeps authored teaching coordinates fixed instead of restarting force simulation', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, rendererProps(domainNodes, {
    id: 9, target: 'current',
  }))));
  await act(async () => vi.runAllTimers());
  const graphData = forceGraph.threeDProps.graphData as {
    nodes: Array<{ x: number; y: number; z?: number; fx: number; fy: number; fz: number }>;
  };
  graphData.nodes.forEach((node) => {
    expect(node.fx).toBe(node.x);
    expect(node.fy).toBe(node.y);
    expect(node.fz).toBe(node.z ?? 0);
  });
  expect(forceGraph.threeDProps.warmupTicks).toBe(0);
  expect(forceGraph.threeDProps.cooldownTicks).toBe(0);
  await act(async () => root.unmount());
});

it('3D leaves removed Group resource ownership to three-forcegraph', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, rendererProps(rootNodes, {
    id: 10, target: 'root',
  }))));
  await act(async () => vi.runAllTimers());
  const factory = forceGraph.threeDProps.nodeThreeObject as (node: unknown) => THREE.Group;
  const graphData = forceGraph.threeDProps.graphData as { nodes: Array<Record<string, unknown>> };
  const removedObject = factory(graphData.nodes[1]);
  const body = removedObject.userData.knowledgeBodyMesh as THREE.Mesh;
  const dispose = vi.spyOn(body.geometry, 'dispose');
  expect(removedObject.userData.knowledgeLabelSprite).toBeUndefined();

  await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, rendererProps([rootNodes[0]], {
    id: 10, target: 'root',
  }))));
  await act(async () => vi.runAllTimers());
  expect(dispose).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});

it('3D updates same-id node data in place and disposes replaced resources exactly once', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, rendererProps(rootNodes, {
    id: 11, target: 'root',
  }))));
  await act(async () => vi.runAllTimers());
  const factory = forceGraph.threeDProps.nodeThreeObject as (node: unknown) => THREE.Group;
  const graphData = forceGraph.threeDProps.graphData as { nodes: Array<Record<string, unknown>> };
  const retainedId = graphData.nodes[0].id;
  const retained = factory(graphData.nodes[0]);
  const oldBody = retained.userData.knowledgeBodyMesh as THREE.Mesh;
  const oldGeometryDispose = vi.spyOn(oldBody.geometry, 'dispose');
  const oldMaterial = oldBody.material as THREE.MeshPhongMaterial;
  const oldMaterialDispose = vi.spyOn(oldMaterial, 'dispose');
  expect(retained.userData.knowledgeLabelSprite).toBeUndefined();

  const updatedNodes = [{
    ...rootNodes[0],
    name: '更新后的领域名称',
    knowledgeDim: 'PROCEDURAL',
    graphImportanceScore: 1,
    metadata: { isCollapsedRoot: true, chapterName: '更新语义区域' },
  }, rootNodes[1]];
  await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, rendererProps(updatedNodes, {
    id: 11, target: 'root',
  }))));
  await act(async () => vi.runAllTimers());
  const updatedGraphData = forceGraph.threeDProps.graphData as { nodes: Array<Record<string, unknown>> };
  expect(forceGraph.threeDProps.nodeThreeObject).toBe(factory);
  expect(updatedGraphData.nodes.find((node) => node.id === retainedId)).toBeDefined();
  const sameObject = retained;

  expect(sameObject).toBe(retained);
  expect(sameObject.userData.knowledgeBodyMesh).not.toBe(oldBody);
  expect(oldGeometryDispose).toHaveBeenCalledTimes(1);
  expect(oldMaterialDispose).toHaveBeenCalledTimes(1);
  expect(sameObject.userData.knowledgeLabelSprite).toBeUndefined();
  await act(async () => root.unmount());
});

it('3D visual signature distinguishes same-id root packing state and collision geometry', () => {
  const domainNode = { ...rootNodes[0] };
  const rootNode = {
    ...domainNode,
    __knowledgeRootPacking: {
      collisionRadius: 32,
      labelBounds: { halfWidth: 24, halfHeight: 12 },
    },
  };
  const resizedRootNode = {
    ...rootNode,
    __knowledgeRootPacking: {
      ...rootNode.__knowledgeRootPacking,
      collisionRadius: 36,
    },
  };
  const relabeledRootNode = {
    ...rootNode,
    __knowledgeRootPacking: {
      ...rootNode.__knowledgeRootPacking,
      labelBounds: { halfWidth: 28, halfHeight: 12 },
    },
  };

  expect(getKnowledgeGraphNodeVisualDataSignature(rootNode))
    .not.toBe(getKnowledgeGraphNodeVisualDataSignature(domainNode));
  expect(getKnowledgeGraphNodeVisualDataSignature(resizedRootNode))
    .not.toBe(getKnowledgeGraphNodeVisualDataSignature(rootNode));
  expect(getKnowledgeGraphNodeVisualDataSignature(relabeledRootNode))
    .not.toBe(getKnowledgeGraphNodeVisualDataSignature(rootNode));
});

it('3D hover changes update retained objects without recreating or disposing node resources', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const props = rendererProps(rootNodes, { id: 12, target: 'root' });
  await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, props)));
  await act(async () => vi.runAllTimers());
  const factory = forceGraph.threeDProps.nodeThreeObject as (node: unknown) => THREE.Group;
  const graphData = forceGraph.threeDProps.graphData as { nodes: Array<Record<string, unknown>> };
  const retained = graphData.nodes.map((node) => factory(node));
  const children = retained.map((group) => [...group.children]);
  const disposals = retained.flatMap((group) => group.children.map((child) => {
    if (!(child instanceof THREE.Mesh)) return null;
    const geometry = (child as THREE.Mesh).geometry;
    return geometry ? vi.spyOn(geometry, 'dispose') : null;
  })).filter((spy): spy is ReturnType<typeof vi.spyOn> => Boolean(spy));
  retained.forEach((group) => expect(group.userData.knowledgeLabelSprite).toBeUndefined());

  for (const hoveredNode of [rootNodes[0], rootNodes[1], rootNodes[0], null]) {
    await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, {
      ...props, hoveredNode,
    })));
    await act(async () => vi.runAllTimers());
  }

  retained.forEach((group, index) => expect(group.children).toEqual(children[index]));
  disposals.forEach((dispose) => expect(dispose).not.toHaveBeenCalled());
  await act(async () => root.unmount());
  disposals.forEach((dispose) => expect(dispose).not.toHaveBeenCalled());
});

it('3D factory creates a fresh same-id Group without disposing the dependency-owned old Group', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(React.createElement(KnowledgeGraphCanvas, rendererProps(rootNodes, {
    id: 13, target: 'root',
  }))));
  await act(async () => vi.runAllTimers());
  const factory = forceGraph.threeDProps.nodeThreeObject as (node: unknown) => THREE.Group;
  const graphData = forceGraph.threeDProps.graphData as { nodes: Array<Record<string, unknown>> };
  const retained = factory(graphData.nodes[0]);
  const body = retained.userData.knowledgeBodyMesh as THREE.Mesh;
  const bodyDispose = vi.spyOn(body.geometry, 'dispose');
  expect(body).toBeInstanceOf(THREE.Mesh);
  const replacement = factory(graphData.nodes[0]);
  expect(replacement).not.toBe(retained);
  expect(replacement.children.length).toBeGreaterThan(0);
  expect(replacement.userData.knowledgeBodyMesh).toBeInstanceOf(THREE.Mesh);
  expect(replacement.userData.knowledgeLabelSprite).toBeUndefined();
  expect(bodyDispose).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});
