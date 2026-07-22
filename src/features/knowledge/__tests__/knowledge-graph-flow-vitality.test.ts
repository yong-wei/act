import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  bindKnowledgeGraphMotionEnvironment,
  getKnowledgeGraphMotionMarkerFrame,
  getKnowledgeGraphMotionPhasedMarkerFrame,
  KNOWLEDGE_GRAPH_FLOW_MOTION,
  KNOWLEDGE_GRAPH_MOTION_TRANSITION_EVENT,
  resolveFlowMarkerSet,
  selectKnowledgeGraphMotionMarkerEdgeIds,
} from '../graph/motion';

describe('resolveFlowMarkerSet', () => {
  const eligible = ['post|a|b', 'post|b|c', 'post|c|d', 'post|d|e', 'post|e|f', 'post|f|g', 'post|g|h', 'post|h|i', 'post|i|j', 'post|j|k'];

  it('selects a deterministic capped ambient set with distinct phase offsets', () => {
    const first = resolveFlowMarkerSet({
      scope: 'ambient',
      active: true,
      motionEligibleEdgeIds: eligible,
      motionSuppressedEdgeIds: [],
    });
    const second = resolveFlowMarkerSet({
      scope: 'ambient',
      active: true,
      motionEligibleEdgeIds: eligible,
      motionSuppressedEdgeIds: [],
    });

    expect(first.edgeIds).toEqual(second.edgeIds);
    expect(first.edgeIds).toHaveLength(KNOWLEDGE_GRAPH_FLOW_MOTION.ambientBudget);
    expect(first.edgeIds).toEqual([...eligible].sort().slice(0, KNOWLEDGE_GRAPH_FLOW_MOTION.ambientBudget));
    const phases = first.edgeIds.map((edgeId) => first.phaseOffsetByEdgeId[edgeId]);
    phases.forEach((phase) => {
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(1);
    });
    expect(new Set(phases).size).toBeGreaterThan(1);
    expect(first.phaseOffsetByEdgeId).toEqual(second.phaseOffsetByEdgeId);
  });

  it('honors suppression, visibility, and custom budgets without duplicates', () => {
    const selection = resolveFlowMarkerSet({
      scope: 'ambient',
      active: true,
      motionEligibleEdgeIds: [...eligible, ...eligible],
      motionSuppressedEdgeIds: ['post|a|b', 'post|b|c'],
      visibleEdgeIds: eligible.slice(2, 6),
      budget: 2,
    });

    expect(selection.edgeIds).toEqual(['post|c|d', 'post|d|e']);
    expect(new Set(selection.edgeIds).size).toBe(selection.edgeIds.length);
  });

  it('returns an empty selection when inactive', () => {
    expect(resolveFlowMarkerSet({
      scope: 'ambient',
      active: false,
      motionEligibleEdgeIds: eligible,
      motionSuppressedEdgeIds: [],
    })).toEqual({ edgeIds: [], phaseOffsetByEdgeId: {} });
  });

  it('keeps the corridor scope byte-identical to the legacy marker selection', () => {
    const input = {
      active: true,
      motionEligibleEdgeIds: eligible,
      motionSuppressedEdgeIds: ['post|a|b'],
      visibleEdgeIds: eligible.slice(0, 6),
    };
    const legacy = selectKnowledgeGraphMotionMarkerEdgeIds(input);
    const scoped = resolveFlowMarkerSet({ scope: 'corridor', ...input });

    expect(scoped.edgeIds).toEqual(legacy);
    expect(scoped.edgeIds).toHaveLength(3);
  });
});

describe('phased marker frames', () => {
  it('gives distinct progress for distinct phases at the same elapsed time', () => {
    const first = getKnowledgeGraphMotionPhasedMarkerFrame(300, 0);
    const second = getKnowledgeGraphMotionPhasedMarkerFrame(300, 0.5);

    expect(first.progress).not.toBe(second.progress);
    expect(getKnowledgeGraphMotionPhasedMarkerFrame(300, 0)).toEqual(getKnowledgeGraphMotionMarkerFrame(300));
  });

  it('keeps the pause window invisible regardless of phase', () => {
    expect(getKnowledgeGraphMotionPhasedMarkerFrame(0, 0).visible).toBe(true);
    const travel = 1_200;
    const pause = 360;
    expect(getKnowledgeGraphMotionPhasedMarkerFrame(travel + 10, 0).visible).toBe(false);
    expect(getKnowledgeGraphMotionPhasedMarkerFrame(travel + pause + 10, 0).visible).toBe(true);
    expect(getKnowledgeGraphMotionPhasedMarkerFrame(0, 0.99).visible).toBe(false);
  });
});

describe('motion environment suspension', () => {
  function createHarness({ hidden = false, reduced = false } = {}) {
    const listeners = new Map<string, Set<() => void>>();
    const documentTarget = {
      hidden,
      addEventListener: vi.fn((name: string, listener: () => void) => {
        listeners.set(name, (listeners.get(name) ?? new Set()).add(listener));
      }),
      removeEventListener: vi.fn((name: string, listener: () => void) => {
        listeners.get(name)?.delete(listener);
      }),
    };
    const mediaQuery = {
      matches: reduced,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const suspend = vi.fn();
    const resume = vi.fn();
    const fire = (name: string) => listeners.get(name)?.forEach((listener) => listener());
    return { documentTarget, mediaQuery, suspend, resume, fire, listeners };
  }

  it('suspends immediately when the tab is hidden and resumes on visibilitychange', () => {
    const harness = createHarness({ hidden: true });
    const dispose = bindKnowledgeGraphMotionEnvironment(harness);

    expect(harness.suspend).toHaveBeenCalledTimes(1);
    expect(harness.resume).not.toHaveBeenCalled();

    harness.documentTarget.hidden = false;
    harness.fire('visibilitychange');
    expect(harness.resume).toHaveBeenCalledTimes(1);

    harness.documentTarget.hidden = true;
    harness.fire('visibilitychange');
    expect(harness.suspend).toHaveBeenCalledTimes(2);
    dispose();
  });

  it('suspends while the canvas is offscreen and resumes when it re-enters', () => {
    const harness = createHarness();
    const observe = vi.fn();
    const disconnect = vi.fn();
    let ioCallback: (entries: Array<{ isIntersecting: boolean }>) => void = () => undefined;
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
        ioCallback = callback;
      }
      observe = observe;
      disconnect = disconnect;
    });
    const element = {} as Element;
    const dispose = bindKnowledgeGraphMotionEnvironment({
      ...harness,
      offscreenTarget: element,
    });

    expect(observe).toHaveBeenCalledWith(element);
    expect(harness.resume).toHaveBeenCalledTimes(1);

    ioCallback([{ isIntersecting: false }]);
    expect(harness.suspend).toHaveBeenCalledTimes(1);

    ioCallback([{ isIntersecting: true }]);
    expect(harness.resume).toHaveBeenCalledTimes(2);
    dispose();
    expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('suspends while a domain transition is mid-flight and resumes afterwards', () => {
    const harness = createHarness();
    let transitionActive = true;
    const eventTarget = {
      addEventListener: vi.fn((name: string, listener: () => void) => {
        harness.listeners.set(name, (harness.listeners.get(name) ?? new Set()).add(listener));
      }),
      removeEventListener: vi.fn(),
    };
    const dispose = bindKnowledgeGraphMotionEnvironment({
      ...harness,
      transitionEvent: { eventTarget, isActive: () => transitionActive },
    });

    expect(harness.suspend).toHaveBeenCalledTimes(1);
    expect(eventTarget.addEventListener).toHaveBeenCalledWith(
      KNOWLEDGE_GRAPH_MOTION_TRANSITION_EVENT,
      expect.any(Function)
    );

    transitionActive = false;
    harness.fire(KNOWLEDGE_GRAPH_MOTION_TRANSITION_EVENT);
    expect(harness.resume).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('suspends when reduced motion is requested', () => {
    const harness = createHarness({ reduced: true });
    const dispose = bindKnowledgeGraphMotionEnvironment(harness);

    expect(harness.suspend).toHaveBeenCalledTimes(1);
    expect(harness.resume).not.toHaveBeenCalled();
    dispose();
  });
});

describe('renderer ambient flow wiring parity', () => {
  it('resolves the same ambient eligibility, budget, and phasing in both renderers', () => {
    const twoDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-2d.tsx'), 'utf8'
    );
    const threeDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'), 'utf8'
    );

    for (const source of [twoDimensional, threeDimensional]) {
      expect(source).toContain("resolveFlowMarkerSet({");
      expect(source).toContain("scope: 'ambient'");
      expect(source).toContain('structuralForegroundEdgeIdSet');
      expect(source).toContain('ambientFlowSelection.phaseOffsetByEdgeId');
      expect(source).toContain('getKnowledgeGraphMotionPhasedMarkerFrame');
      expect(source).toContain('activeMotionMarkerCount');
    }
    expect(twoDimensional).toContain('KNOWLEDGE_GRAPH_FLOW_MARKER_GEOMETRY');
  });

  it('keeps corridor markers prominent above the subdued ambient layer', () => {
    const twoDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-2d.tsx'), 'utf8'
    );
    const threeDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'), 'utf8'
    );

    // 2D：环境流标记绘制块位于走廊标记绘制块之前（绘制顺序即突出顺序）。
    expect(twoDimensional.indexOf('const ambientEdgeEligible')).toBeLessThan(
      twoDimensional.indexOf('if (motionEdgeEligible && linkProgress >= 0.999')
    );
    // 3D：走廊优先的帧选择与突出参数。
    expect(threeDimensional).toContain('const activeFrame = corridorFrame ?? ambientFrame');
    expect(threeDimensional).toContain("!motionEdgeEligible && ambientFlowEdgeIdSet.has(linkKey)");
  });

  it('stops prominent corridor markers on deselection while ambient continues', () => {
    const corridor = resolveFlowMarkerSet({
      scope: 'corridor',
      active: false,
      motionEligibleEdgeIds: ['post|a|b'],
      motionSuppressedEdgeIds: [],
    });
    const ambient = resolveFlowMarkerSet({
      scope: 'ambient',
      active: true,
      motionEligibleEdgeIds: ['post|a|b'],
      motionSuppressedEdgeIds: [],
    });

    expect(corridor.edgeIds).toEqual([]);
    expect(ambient.edgeIds).toEqual(['post|a|b']);

    const twoDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-2d.tsx'), 'utf8'
    );
    // 走廊选择仍以 selectedNodeId 门控；环境流选择独立于选中态。
    expect(twoDimensional).toContain('active: Boolean(selectedCorridorEmphasis?.selectedNodeId)');
    expect(twoDimensional).toContain("scope: 'ambient',\n    active: true");
  });

  it('suspends the shared frame loop on hidden, offscreen, and mid-transition states in both renderers', () => {
    const twoDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-2d.tsx'), 'utf8'
    );
    const threeDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'), 'utf8'
    );

    for (const source of [twoDimensional, threeDimensional]) {
      expect(source).toContain('offscreenTarget: rootRef.current');
      expect(source).toContain("isActive: () => presentationRef.current.phase !== 'idle'");
      expect(source).toContain('KNOWLEDGE_GRAPH_MOTION_TRANSITION_EVENT');
    }
  });

  it('keeps ambient flow paint-level without touching layout or geometry inputs', () => {
    const twoDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-2d.tsx'), 'utf8'
    );
    const ambientBlock = twoDimensional.slice(
      twoDimensional.indexOf('const ambientEdgeEligible'),
      twoDimensional.indexOf('const motionEdgeEligible')
    );

    expect(ambientBlock).not.toContain('node.x =');
    expect(ambientBlock).not.toContain('node.y =');
    expect(ambientBlock).not.toContain('fx =');
    expect(ambientBlock).not.toContain('fy =');
    expect(ambientBlock).not.toContain('relayout');
  });
});

describe('root bubble vitality tokens and timing', () => {
  it('defines bounded vitality tokens from platform tokens', async () => {
    const { KNOWLEDGE_ROOT_BUBBLE_VITALITY } = await import('../graph/visual-config');

    expect(KNOWLEDGE_ROOT_BUBBLE_VITALITY.halo.color).toContain('hsl(var(--platform-');
    expect(KNOWLEDGE_ROOT_BUBBLE_VITALITY.rimArc.color).toContain('hsl(var(--platform-');
    expect(KNOWLEDGE_ROOT_BUBBLE_VITALITY.halo.radiusGain).toBeGreaterThan(1);
    expect(KNOWLEDGE_ROOT_BUBBLE_VITALITY.halo.alphaMin).toBeGreaterThan(0);
    expect(KNOWLEDGE_ROOT_BUBBLE_VITALITY.halo.alphaMax).toBeGreaterThan(KNOWLEDGE_ROOT_BUBBLE_VITALITY.halo.alphaMin);
    expect(KNOWLEDGE_ROOT_BUBBLE_VITALITY.halo.alphaMax).toBeLessThanOrEqual(0.3);
    expect(KNOWLEDGE_ROOT_BUBBLE_VITALITY.breathing.periodMs).toBeGreaterThanOrEqual(2000);
    expect(KNOWLEDGE_ROOT_BUBBLE_VITALITY.entrance.totalDurationMs).toBeLessThanOrEqual(400);
    expect(KNOWLEDGE_ROOT_BUBBLE_VITALITY.rimArc.activeAlpha).toBeGreaterThan(KNOWLEDGE_ROOT_BUBBLE_VITALITY.rimArc.inactiveAlpha);
  });

  it('produces a deterministic bounded breathing wave with the documented period', async () => {
    const { getKnowledgeGraphBreathingIntensity } = await import('../graph/motion');

    const periodMs = 2400;
    for (const elapsed of [0, 300, 600, 1200, 1800, 2400, 3200, 4711]) {
      const wave = getKnowledgeGraphBreathingIntensity(elapsed, { periodMs });
      expect(wave).toBeGreaterThanOrEqual(0);
      expect(wave).toBeLessThanOrEqual(1);
      expect(wave).toBeCloseTo(getKnowledgeGraphBreathingIntensity(elapsed + periodMs, { periodMs }), 10);
    }
    expect(getKnowledgeGraphBreathingIntensity(0, { periodMs })).toBe(0);
    expect(getKnowledgeGraphBreathingIntensity(periodMs / 2, { periodMs })).toBe(1);
  });

  it('settles the entrance fade to the identical static presentation', async () => {
    const { getKnowledgeGraphEntranceFade } = await import('../graph/motion');

    expect(getKnowledgeGraphEntranceFade(0, 100, 200)).toBe(0);
    expect(getKnowledgeGraphEntranceFade(150, 100, 200)).toBeCloseTo(0.25, 6);
    expect(getKnowledgeGraphEntranceFade(300, 100, 200)).toBe(1);
    expect(getKnowledgeGraphEntranceFade(9999, 100, 200)).toBe(1);
    expect(getKnowledgeGraphEntranceFade(-50, 100, 200)).toBe(0);
    expect(getKnowledgeGraphEntranceFade(50, 100, 0)).toBe(1);
  });
});

describe('root bubble vitality renderer wiring', () => {
  it('keeps halo, body, rim arc, and label in paint order with the label untouched by effects', () => {
    const twoDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-2d.tsx'), 'utf8'
    );

    const haloIndex = twoDimensional.indexOf('外晕 halo');
    const bodyIndex = twoDimensional.indexOf('KNOWLEDGE_ROOT_BUBBLE_STYLE.highlight');
    const rimArcIndex = twoDimensional.indexOf('轮缘光弧');
    const labelIndex = twoDimensional.indexOf('getKnowledgeRootLabelPaintModel(node.name)');

    expect(haloIndex).toBeGreaterThan(-1);
    expect(haloIndex).toBeLessThan(bodyIndex);
    expect(bodyIndex).toBeLessThan(rimArcIndex);
    expect(rimArcIndex).toBeLessThan(labelIndex);
    // 入场淡入只出现在根气泡块内，标签绘制不受其影响。
    const entranceIndex = twoDimensional.indexOf('const entranceAlpha');
    const rootBubbleBlock = twoDimensional.slice(entranceIndex, labelIndex);
    const labelBlock = twoDimensional.slice(labelIndex);
    expect(rootBubbleBlock).toContain('entranceAlpha');
    expect(entranceIndex).toBeLessThan(haloIndex);
    expect(labelBlock).not.toContain('entranceAlpha');
  });

  it('keeps vitality paint-level with no geometry, packing, or hit-area writes', () => {
    const twoDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-2d.tsx'), 'utf8'
    );
    const threeDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'), 'utf8'
    );

    const twoDBubbleBlock = twoDimensional.slice(
      twoDimensional.indexOf('const entranceAlpha'),
      twoDimensional.indexOf('} else if (glowColor)')
    );
    expect(twoDBubbleBlock).not.toContain('node.x =');
    expect(twoDBubbleBlock).not.toContain('node.y =');
    expect(twoDBubbleBlock).not.toContain('node.fx =');
    expect(twoDBubbleBlock).not.toContain('node.fy =');
    expect(twoDBubbleBlock).not.toContain('baseRadius =');

    const vitalityFrame = threeDimensional.slice(
      threeDimensional.indexOf('const applyRootBubbleVitalityFrame'),
      threeDimensional.indexOf('useEffect(() => {\n    const motionDisabled')
    );
    expect(vitalityFrame).toContain('material.opacity');
    expect(vitalityFrame).not.toContain('position.set');
    expect(vitalityFrame).not.toContain('scale.setScalar');
    expect(vitalityFrame).not.toContain('node.x =');
    expect(threeDimensional).toContain('knowledgeVitalityHalo');
    expect(threeDimensional).toContain('knowledgeVitalityRimArc');
    expect(threeDimensional).toContain('if (isRootBubble) {');
  });

  it('collapses breathing and entrance to static equivalents under reduced motion', () => {
    const twoDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-2d.tsx'), 'utf8'
    );
    const threeDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'), 'utf8'
    );

    expect(twoDimensional).toContain('reducedMotion || rootEntranceStartMsRef.current === null');
    expect(twoDimensional).toContain('isActive && !reducedMotion');
    expect(threeDimensional).toContain('reducedMotion || entranceStartMs === null');
    expect(threeDimensional).toContain('isActive && !reducedMotion');
    // 静态层次仍在：reduced-motion 下轮缘光弧继续区分激活与非激活。
    expect(twoDimensional).toContain('isActive ? rimArc.activeAlpha : rimArc.inactiveAlpha');
  });
});

describe('3D vitality frame corridor emphasis parity', () => {
  it('keeps corridor emphasis dimming and the builder-active definition inside the 3D vitality frame', () => {
    const threeDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'), 'utf8'
    );
    const frame = threeDimensional.slice(
      threeDimensional.indexOf('const applyRootBubbleVitalityFrame'),
      threeDimensional.indexOf('useEffect(() => {\n    const motionDisabled')
    );

    expect(frame).toContain('getKnowledgeGraphNodeEmphasisOpacity(nodeId, selectedCorridorEmphasis)');
    expect(frame).toContain('selectedCorridorEmphasis?.nodeIds.includes(nodeId)');
    expect(frame).toContain('getKnowledgeGraphPresentationNodeOpacity({ ...presentationRef.current, nodeId })\n        * getKnowledgeGraphNodeEmphasisOpacity');
  });
});

describe('root bubble vitality data sources and corridor dedup', () => {
  it('derives entrance and breathing inputs from the packed node collection in both renderers', () => {
    const twoDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-2d.tsx'), 'utf8'
    );
    const threeDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'), 'utf8'
    );

    for (const source of [twoDimensional, threeDimensional]) {
      // __knowledgeRootPacking 只在打包后的 graphData.nodes 上存在；
      // 从 props.nodes 读取会让入场与呼吸永不启动。
      expect(source).toContain('graphData.nodes\n      .filter((node: any) => Boolean(node.__knowledgeRootPacking))');
      expect(source).toContain('graphData.nodes.some((node: any) => (');
      expect(source).not.toContain('const rootBubbleIds = nodes');
    }
  });

  it('excludes selected corridor edges from the 2D ambient layer like the 3D path', () => {
    const twoDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-2d.tsx'), 'utf8'
    );

    expect(twoDimensional).toContain('const ambientEdgeEligible = !motionEdgeEligible');
    expect(twoDimensional.indexOf('const motionEdgeEligible')).toBeLessThan(
      twoDimensional.indexOf('const ambientEdgeEligible')
    );
  });
});

describe('render pump lifecycle for continuous motion', () => {
  it('toggles autoPauseRedraw in 2D and uses the real refresh() in 3D so repaints run only while motion is active', () => {
    const twoDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-2d.tsx'), 'utf8'
    );
    const threeDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'), 'utf8'
    );

    // force-graph-2d 的 ref 句柄没有 refresh()，历史上 refresh?.() 在 2D 是静默空操作；
    // autoPauseRedraw=false 只在运动活动时逐帧重绘，空闲时恢复冻结与指针交互。
    expect(twoDimensional).toContain('autoPauseRedraw={!motionPaintActive}');
    expect(twoDimensional).toContain('activeMotionMarkerCount > 0 || rootBreathingActive || entranceActive');
    // react-force-graph-3d 的 ref 暴露真实 refresh()，帧循环活动时按需重绘。
    const loopSection = threeDimensional.slice(
      threeDimensional.indexOf('loop.start(motionScopeKey'),
      threeDimensional.indexOf('loop.start(motionScopeKey') + 1_400
    );
    expect(loopSection).toContain('fgRef.current?.refresh?.()');
  });
});


describe('root entrance lifecycle closure', () => {
  const renderers: Array<[string, string]> = [
    ['2D', 'knowledge-graph-2d.tsx'],
    ['3D', 'knowledge-graph-canvas.tsx'],
  ];

  it.each(renderers)('%s closes the entrance gate after the stagger finishes so the render pump can freeze', (_label, file) => {
    const source = readFileSync(
      path.join(process.cwd(), `src/features/knowledge/graph/${file}`), 'utf8'
    );
    // 入场活动态必须能收敛：rootEntranceStartMsRef 布防后永不清除的话，
    // entranceActive 会永远为真，motionPaintActive 随之卡真，
    // autoPauseRedraw 门控失效，空闲时画布仍在逐帧重绘。
    expect(source).toContain('rootEntranceStartMsRef.current !== null && !entranceDone');
    const armIndex = source.indexOf('entranceScopeKeyRef.current !== entranceScopeKey');
    expect(armIndex).toBeGreaterThan(-1);
    const armSection = source.slice(armIndex, armIndex + 400);
    expect(armSection).toContain('setEntranceDone(false)');
    const stopIndex = source.indexOf('KNOWLEDGE_ROOT_BUBBLE_VITALITY.entrance.totalDurationMs');
    expect(stopIndex).toBeGreaterThan(-1);
    const stopSection = source.slice(stopIndex, stopIndex + 400);
    expect(stopSection).toContain('setEntranceDone(true)');
  });
});
