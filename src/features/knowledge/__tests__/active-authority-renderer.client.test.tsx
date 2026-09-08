// @vitest-environment jsdom

import { act, createElement, forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const graphMocks = vi.hoisted(() => ({
  twoD: { props: {} as Record<string, unknown>, zoomToFit: vi.fn(), zoom: vi.fn(), centerAt: vi.fn() },
  threeD: { props: {} as Record<string, unknown>, zoomToFit: vi.fn(), cameraPosition: vi.fn(), refresh: vi.fn() },
}));

function graphMock(kind: 'twoD' | 'threeD') {
  return forwardRef(function MockGraph(props: Record<string, unknown>, ref) {
    const state = graphMocks[kind];
    state.props = props;
    const target = useRef(new THREE.Vector3());
    const camera = useRef(new THREE.PerspectiveCamera(50, 4 / 3, 0.1, 2000));
    const zoom = useRef(1);
    const center = useRef({ x: 0, y: 0 });
    camera.current.position.set(0, 0, 1000);
    useImperativeHandle(ref, () => ({
      graph2ScreenCoords: (x: number, y: number) => ({
        x: (x - center.current.x) * zoom.current + Number(props.width) / 2,
        y: (y - center.current.y) * zoom.current + Number(props.height) / 2,
      }),
      zoom: (next?: number) => {
        if (next !== undefined) zoom.current = next;
        return zoom.current;
      },
      zoomToFit: state.zoomToFit,
      centerAt: (x: number, y: number, duration: number) => {
        center.current = { x, y };
        state.centerAt(x, y, duration);
      },
      cameraPosition: (position: { x: number; y: number; z: number }, nextTarget: { x: number; y: number; z: number }) => {
        camera.current.position.set(position.x, position.y, position.z);
        target.current.set(nextTarget.x, nextTarget.y, nextTarget.z);
        state.cameraPosition(position, nextTarget);
      },
      d3ReheatSimulation: vi.fn(),
      pauseAnimation: vi.fn(),
      refresh: kind === 'threeD' ? graphMocks.threeD.refresh : vi.fn(),
      camera: () => camera.current,
      controls: () => ({ target: target.current }),
    }));
    useEffect(() => {
      if (kind === 'twoD') (props.onZoom as ((transform: { k: number; x: number; y: number }) => void) | undefined)?.({ k: zoom.current, ...center.current });
      (props.onEngineStop as (() => void) | undefined)?.();
    }, [props.graphData, props.onEngineStop, props.onZoom]);
    return createElement('canvas', { 'data-mock-force-graph': kind });
  });
}

vi.mock('react-force-graph-2d', () => ({ default: graphMock('twoD') }));
vi.mock('react-force-graph-3d', () => ({ default: graphMock('threeD') }));

import { ActiveAuthorityRenderer } from '../graph/active-renderer/active-authority-renderer';
import type { KnowledgeLinkData, KnowledgeNodeData } from '../knowledge-graph-system';

const nodes: KnowledgeNodeData[] = [
  {
    id: 'node-a', name: '基础概念', nodeType: 'THEORY', description: '',
    positionX: 0, positionY: 0, positionZ: 0,
    conceptKind: 'DomainConcept', metadata: { presentationShape: 'circle' },
  },
  {
    id: 'node-b', name: '系统模型', nodeType: 'THEORY', description: '',
    positionX: 0, positionY: 0, positionZ: 0,
    conceptKind: 'SystemModel', metadata: { presentationShape: 'hexagon' },
  },
];
const links: KnowledgeLinkData[] = [{
  id: 'edge-a-b', sourceId: 'node-a', targetId: 'node-b', relation: 'PREREQUISITE', relationType: 'prerequisite',
}];

function props(overrides: Partial<React.ComponentProps<typeof ActiveAuthorityRenderer>> = {}) {
  return {
    kind: 'domain' as const,
    dimension: '2d' as const,
    nodes,
    links,
    selectedNodeId: null,
    hoveredNodeId: null,
    onNodeClick: vi.fn(),
    onNodeHover: vi.fn(),
    onNodeDragEnd: vi.fn(),
    layoutState: { version: 0, positionsByNodeId: {} },
    fitViewRequest: { id: 0, target: 'current' as const },
    relayoutVersion: 0,
    engineReheatRevision: 0,
    autoFitScopeKey: 'active-domain:modeling:2d',
    autoFitReady: true,
    autoFitConsumed: false,
    autoFitCameraManipulated: false,
    restoredCameraPose: null,
    onAutoFitConsumed: vi.fn(),
    onCameraManipulation: vi.fn(),
    onCameraPoseChange: vi.fn(),
    canvasAriaLabel: '语义关系画布',
    onEngineSettled: vi.fn(),
    ...overrides,
  };
}

const mountedRoots = new Set<Root>();

describe('active authority renderer lifecycle', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mountedRoots.add(root);
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 640 });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 480 });
  });

  afterEach(() => {
    root.unmount();
    mountedRoots.delete(root);
    container.remove();
    vi.clearAllMocks();
  });

  it('uses the real active renderer branch, fits after settle, and keeps labels non-empty', async () => {
    const input = props();
    await act(async () => root.render(createElement(ActiveAuthorityRenderer, input)));
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-active-authority-graph-2d="true"]')).not.toBeNull();
    expect(graphMocks.twoD.centerAt).toHaveBeenCalledTimes(1);
    expect(input.onEngineSettled).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-active-authority-screen-label-layer="true"]')).not.toBeNull();
    expect(container.querySelector('[data-knowledge-2d-node-label="node-a"]')?.textContent).toContain('基础概念');
    expect((graphMocks.twoD.props.graphData as { nodes: Array<{ id: string }>; links: Array<{ id: string }> }).links[0]?.id).toBe('edge-a-b');
  });

  it('does not refit when only selection changes, then fits the switched dimension', async () => {
    const input = props();
    await act(async () => root.render(createElement(ActiveAuthorityRenderer, input)));
    await act(async () => Promise.resolve());
    const initialFits = graphMocks.twoD.centerAt.mock.calls.length;
    await act(async () => root.render(createElement(ActiveAuthorityRenderer, { ...input, selectedNodeId: 'node-b' })));
    await act(async () => Promise.resolve());
    expect(graphMocks.twoD.centerAt).toHaveBeenCalledTimes(initialFits);

    await act(async () => root.render(createElement(ActiveAuthorityRenderer, {
      ...input,
      dimension: '3d',
      autoFitScopeKey: 'active-domain:modeling:3d',
      selectedNodeId: 'node-b',
    })));
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-active-authority-graph-3d="true"]')).not.toBeNull();
    expect(graphMocks.threeD.cameraPosition).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-knowledge-3d-node-label="node-a"]')?.textContent).toContain('基础概念');
  });

  it('recreates engine-disposed 3D bodies and updates focus without flushing the scene', async () => {
    const input = props({ dimension: '3d', autoFitScopeKey: 'active:modeling:3d' });
    await act(async () => root.render(createElement(ActiveAuthorityRenderer, input)));
    const node = (graphMocks.threeD.props.graphData as { nodes: KnowledgeNodeData[] }).nodes[0];
    const createObject = graphMocks.threeD.props.nodeThreeObject as (node: KnowledgeNodeData) => THREE.Group;
    const original = createObject(node);
    expect(original.children.length).toBeGreaterThan(0);
    // three-forcegraph clears custom groups when rebuilding its object mapper.
    original.clear();
    const rebuilt = createObject(node);
    expect(rebuilt).not.toBe(original);
    expect(rebuilt.children.length).toBeGreaterThan(0);
    await act(async () => root.render(createElement(ActiveAuthorityRenderer, { ...input, selectedNodeId: node.id })));
    expect(rebuilt.children.length).toBeGreaterThan(0);
    expect(graphMocks.threeD.refresh).not.toHaveBeenCalled();
  });

  it('accepts a restored zoom without replacing it with the default fitted zoom', async () => {
    const input = props({
      restoredCameraPose: {
        position: { x: 40, y: 50, z: 2 },
        target: { x: 40, y: 50, z: 0 },
        up: { x: 0, y: 1, z: 0 },
      },
    });
    await act(async () => root.render(createElement(ActiveAuthorityRenderer, input)));
    await act(async () => Promise.resolve());
    expect(graphMocks.twoD.centerAt).toHaveBeenCalledTimes(1);
    expect(graphMocks.twoD.centerAt).toHaveBeenLastCalledWith(40, 50, 0);
    expect(input.onEngineSettled).toHaveBeenCalledTimes(1);
  });

  it('does not save the 2D engine initialization transform as a user camera pose', async () => {
    const input = props();
    await act(async () => root.render(createElement(ActiveAuthorityRenderer, input)));
    expect(input.onCameraManipulation).not.toHaveBeenCalled();
    expect(input.onCameraPoseChange).toHaveBeenCalledTimes(1);
    expect(input.onCameraPoseChange.mock.calls[0][1].position.z).not.toBe(1);
    expect(input.onAutoFitConsumed).toHaveBeenCalledTimes(1);
  });

  it('restores 3D camera roll as well as position and target', async () => {
    const pose = { position: { x: 100, y: 200, z: 900 }, target: { x: 0, y: 0, z: 0 }, up: { x: 0.6, y: 0.8, z: 0 } };
    const input = props({ dimension: '3d', autoFitScopeKey: 'active:modeling:3d', restoredCameraPose: pose });
    await act(async () => root.render(createElement(ActiveAuthorityRenderer, input)));
    expect(input.onCameraPoseChange).toHaveBeenLastCalledWith('active:modeling:3d', expect.objectContaining(pose));
  });
});
