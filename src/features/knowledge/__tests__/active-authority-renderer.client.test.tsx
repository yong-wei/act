// @vitest-environment jsdom

import { act, createElement, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const graphMocks = vi.hoisted(() => ({
  zoomDuringRender: false,
  renderingGraph: false,
  twoD: { props: {} as Record<string, unknown>, zoomToFit: vi.fn(), zoom: vi.fn(), centerAt: vi.fn() },
  threeD: { props: {} as Record<string, unknown>, zoomToFit: vi.fn(), cameraPosition: vi.fn(), refresh: vi.fn() },
}));

function graphMock(kind: 'twoD' | 'threeD') {
  return forwardRef(function MockGraph(props: Record<string, unknown>, ref) {
    const state = graphMocks[kind];
    state.props = props;
    if (kind === 'twoD' && graphMocks.zoomDuringRender) {
      graphMocks.renderingGraph = true;
      try { (props.onZoom as ((transform: { k: number; x: number; y: number }) => void))({ k: 2, x: 12, y: 24 }); }
      finally { graphMocks.renderingGraph = false; }
    }
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

import { ActiveAuthorityFilterPanel } from '../active-authority-filter-panel';
import { ACTIVE_RELATION_STYLES } from '../graph/active-renderer/active-authority-visual';
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
    graphMocks.zoomDuringRender = false;
    graphMocks.renderingGraph = false;
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
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
    vi.unstubAllGlobals();
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

  it('activates a node when its visible screen label is clicked', async () => {
    const input = props();
    await act(async () => root.render(createElement(ActiveAuthorityRenderer, input)));
    await act(async () => Promise.resolve());
    const label = container.querySelector<HTMLElement>('[data-knowledge-2d-node-label="node-a"]');
    expect(label).not.toBeNull();
    label!.hidden = false;
    await act(async () => {
      label!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(input.onNodeClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'node-a' }));
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

  it('defers render-time engine zoom callbacks before updating the camera owner', async () => {
    const input = props();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const renderingCalls: boolean[] = [];
    function CameraOwner({ selected }: { selected: string | null }) {
      const [manipulated, setManipulated] = useState(false);
      const onManipulation = useCallback(() => {
        renderingCalls.push(graphMocks.renderingGraph);
        setManipulated(true);
      }, []);
      return createElement('div', null,
        createElement('output', { 'data-camera-manipulated': true }, String(manipulated)),
        createElement(ActiveAuthorityRenderer, { ...input, selectedNodeId: selected, onCameraManipulation: onManipulation }));
    }
    try {
      await act(async () => root.render(createElement(CameraOwner, { selected: null })));
      graphMocks.zoomDuringRender = true;
      await act(async () => root.render(createElement(CameraOwner, { selected: 'node-b' })));
      await act(async () => Promise.resolve());
      expect(renderingCalls.length).toBeGreaterThan(0);
      expect(renderingCalls).not.toContain(true);
      expect(container.querySelector('[data-camera-manipulated]')?.textContent).toBe('true');
      expect(error.mock.calls.some((call) => String(call[0]).includes('Cannot update a component'))).toBe(false);
    } finally {
      graphMocks.zoomDuringRender = false;
      error.mockRestore();
    }
  });

  it('keeps positions and camera through resize and a topology update', async () => {
    const input = props();
    await act(async () => root.render(createElement(ActiveAuthorityRenderer, input)));
    const initial = graphMocks.twoD.props.graphData as { nodes: Array<{ id: string; x: number; y: number }> };
    const points = initial.nodes.map((node) => [node.id, node.x, node.y]);
    const fits = graphMocks.twoD.centerAt.mock.calls.length;
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 800 });
    await act(async () => window.dispatchEvent(new Event('resize')));
    await act(async () => root.render(createElement(ActiveAuthorityRenderer, { ...input, links: [] })));
    const next = graphMocks.twoD.props.graphData as typeof initial;
    expect(next.nodes.map((node) => [node.id, node.x, node.y])).toEqual(points);
    expect(graphMocks.twoD.centerAt).toHaveBeenCalledTimes(fits);
  });

  it('matches legend colors and dash patterns in 2D and 3D while focusing direct neighbors', async () => {
    const styledLinks = Object.keys(ACTIVE_RELATION_STYLES).map((family) => ({
      id: 'style-' + family, sourceId: 'node-a', targetId: 'node-b', relation: family, relationFamily: family,
    }));
    const extraNodes = [...nodes, { ...nodes[0], id: 'node-c', name: '其他节点' }, { ...nodes[0], id: 'node-d', name: '其他端点' }];
    const allLinks = [...styledLinks, { id: 'unrelated', sourceId: 'node-c', targetId: 'node-d', relation: 'association', relationFamily: 'association' }];
    const input = props({ nodes: extraNodes, links: allLinks });
    const panel = createElement(ActiveAuthorityFilterPanel, { locale: 'zh-CN', materializedTypes: [], hiddenNodeTypes: new Set<string>(),
      onToggleNodeType: vi.fn(), enabledFamilies: [], onToggleFamily: vi.fn(), familyFailures: {}, onRetryFamily: vi.fn(),
      teachingCoverageNote: null, teachingRelationsVisible: true, onToggleTeachingRelations: vi.fn() });
    await act(async () => root.render(createElement('div', null, createElement(ActiveAuthorityRenderer, input), panel)));
    for (const link of styledLinks) {
      const style = ACTIVE_RELATION_STYLES[link.relationFamily as keyof typeof ACTIVE_RELATION_STYLES];
      const sample = container.querySelector('[data-active-authority-family-sample="' + (link.relationFamily === 'prerequisite-order' ? 'teaching' : link.relationFamily) + '"] path')!;
      expect(sample.getAttribute('stroke')).toBe(style.color);
      const rgb = [1, 3, 5].map((offset) => Number.parseInt(style.color.slice(offset, offset + 2), 16)).join(', ');
      expect((graphMocks.twoD.props.linkColor as (link: KnowledgeLinkData) => string)(link)).toContain('rgba(' + rgb + ',');
      expect((graphMocks.twoD.props.linkLineDash as (link: KnowledgeLinkData) => number[] | null)(link)).toEqual(style.dash);
    }
    await act(async () => root.render(createElement(ActiveAuthorityRenderer, { ...input, dimension: '3d', autoFitScopeKey: 'styles:3d' })));
    const createLink = graphMocks.threeD.props.linkThreeObject as (link: KnowledgeLinkData) => THREE.Line;
    const renderedLinks = allLinks.map((link) => createLink(link));
    for (const [index, link] of styledLinks.entries()) {
      const style = ACTIVE_RELATION_STYLES[link.relationFamily as keyof typeof ACTIVE_RELATION_STYLES];
      const material = renderedLinks[index].material as THREE.LineBasicMaterial;
      expect('#' + material.color.getHexString()).toBe(style.color);
      expect(material instanceof THREE.LineDashedMaterial).toBe(Boolean(style.dash));
    }
    const graphNodes = (graphMocks.threeD.props.graphData as { nodes: KnowledgeNodeData[] }).nodes;
    const createNode = graphMocks.threeD.props.nodeThreeObject as (node: KnowledgeNodeData) => THREE.Group;
    const objects = new Map(graphNodes.map((node) => [node.id, createNode(node)]));
    await act(async () => root.render(createElement(ActiveAuthorityRenderer, { ...input, dimension: '3d', autoFitScopeKey: 'styles:3d', selectedNodeId: 'node-a', hoveredNodeId: 'node-c' })));
    const opacity = (id: string) => ((objects.get(id)!.children[0] as THREE.Mesh).material as THREE.MeshLambertMaterial).opacity;
    expect(opacity('node-a')).toBe(1);
    expect(opacity('node-b')).toBeGreaterThan(0.9);
    expect(opacity('node-c')).toBeLessThan(0.2);
    expect((renderedLinks[0].material as THREE.LineBasicMaterial).opacity).toBe(1);
    expect((renderedLinks.at(-1)!.material as THREE.LineBasicMaterial).opacity).toBeLessThan(0.1);
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
