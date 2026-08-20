import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ControlEffectDebriefCard } from '../simulations/cruise/control-effect-debrief-card';
import {
  CRUISE_COMFORT_COURSE_TURN_TASK,
  FORBIDDEN_DEBRIEF_PHRASES,
  canEmitCruiseCompletionTelemetry,
  debriefContainsForbiddenPhrase,
  projectCruiseControlEffectDebrief,
  resolveCruiseDebriefTaskContract,
} from '../simulations/cruise/control-effect-debrief';
import {
  buildCruiseTelemetryBridgeSummary,
  type CruiseTelemetryBridgeInput,
  type CruiseTelemetryBridgeSummary,
} from '../simulations/cruise/telemetry-bridge';

function buildInput(overrides: Partial<CruiseTelemetryBridgeInput> = {}): CruiseTelemetryBridgeInput {
  return {
    runId: 'cruise-run-1',
    startedAt: '2026-05-25T08:00:00.000Z',
    completedAt: '2026-05-25T08:05:00.000Z',
    seed: 'cruise-run-1',
    sampleFrameCount: 480,
    virtualModeEnabled: true,
    performance: {
      overshoot: 8,
      settlingTime: 40,
      accel: 0.082,
      settled: true,
    },
    consistencyScore: { score: 86 },
    state: {
      time: 300,
      heading: 30.8,
      targetHeading: 30,
      yawRate: 0.12,
      rudder: 3.5,
      speed: 9.3,
      rollAngle: 0.034,
      seaState: 3,
      waveDirection: 90,
      finStabilizerEnabled: true,
      notchFilterEnabled: true,
      finPower: 240,
      controlMode: 'pid',
      pidGains: { kp: 1.2, ki: 0.18, kd: 0.42 },
      targetForm: {
        overshoot: 12,
        settlingTime: 65,
        steadyError: 2,
        maxLateralAccel: 0.15,
      },
      comfort: {
        msi: 8.3,
        rollRms: 1.1,
        rollPeak: 3.4,
        comfortRating: 'good',
        vdv: 0.71,
        frequencyWeightedAccel: 0.032,
      },
    },
    ...overrides,
  };
}

function summaryFrom(overrides: Partial<CruiseTelemetryBridgeInput> = {}): CruiseTelemetryBridgeSummary {
  return buildCruiseTelemetryBridgeSummary(buildInput(overrides));
}

function project(overrides: Partial<Parameters<typeof projectCruiseControlEffectDebrief>[0]> = {}) {
  return projectCruiseControlEffectDebrief({
    currentRunId: 'cruise-run-1',
    isCompleted: true,
    isPaused: false,
    summary: summaryFrom(),
    taskContract: CRUISE_COMFORT_COURSE_TURN_TASK,
    ...overrides,
  });
}

describe('cruise control-effect debrief projector', () => {
  it('binds a verified completed Cruise run and retires a previous run identity', () => {
    const current = project();
    const previous = project({ currentRunId: 'cruise-run-2', summary: summaryFrom() });

    expect(current.status).toBe('ready');
    expect(current.runId).toBe('cruise-run-1');
    expect(previous.status).toBe('unavailable');
    expect(previous.thresholds).toEqual([]);
  });

  it('fails closed for incomplete, paused-before-completion, and invalid summaries', () => {
    const incomplete = project({ isCompleted: false });
    const paused = project({ isCompleted: false, isPaused: true });
    const invalid = project({
      summary: {
        ...summaryFrom(),
        trace: {
          ...summaryFrom().trace,
          summary: { ...summaryFrom().trace.summary, durationSeconds: 999 },
        },
      },
    });

    expect(incomplete.status).toBe('unavailable');
    expect(paused.status).toBe('unavailable');
    expect(invalid.status).toBe('unavailable');
    expect(incomplete.facts).toEqual([]);
    expect(incomplete.thresholds).toEqual([]);
    expect(canEmitCruiseCompletionTelemetry({
      isCompleted: false,
      runId: 'cruise-run-1',
      emittedRunId: null,
      summary: summaryFrom(),
    })).toBe(false);
  });

  it('keeps finite response facts with units and does not relabel heading error as steady-state error', () => {
    const debrief = project();
    const overshoot = debrief.facts.find((item) => item.metricId === 'turn_overshoot_percent');
    const headingError = debrief.facts.find((item) => item.metricId === 'heading_error_deg');

    expect(overshoot).toMatchObject({
      availability: 'available',
      formattedValue: '8%',
      measurementKind: 'run-aggregate',
    });
    expect(headingError?.factText).toContain('不是稳态误差');
    expect(headingError?.label).toBe('运行结束时航向误差');
    expect(headingError?.label).not.toContain('稳态误差');
  });

  it('labels end-of-run rudder and fin power as observations, not peak, energy, or constraint outcomes', () => {
    const debrief = project();
    const rudder = debrief.facts.find((item) => item.metricId === 'rudder_deg');
    const power = debrief.facts.find((item) => item.metricId === 'fin_power_kw');
    const corpus = `${rudder?.factText}\n${power?.factText}\n${debrief.controlConstraintNote}`;

    expect(rudder?.measurementKind).toBe('run-end-observation');
    expect(power?.measurementKind).toBe('run-end-observation');
    expect(corpus).toContain('结束时刻观察');
    expect(corpus).toContain('不能判断控制需求是否过大');
    expect(corpus).toContain('不能代表全程峰值、控制能量或执行器约束');
  });

  it('evaluates only authoritative partial thresholds and ignores targetForm plus aggregate passed', () => {
    const debrief = project();
    const overshoot = debrief.thresholds.find((item) => item.metricId === 'turn_overshoot_percent');
    const heading = debrief.thresholds.find((item) => item.metricId === 'heading_error_deg');

    expect(resolveCruiseDebriefTaskContract(false)).toBeNull();
    expect(overshoot).toMatchObject({
      satisfied: true,
      comparisonText: '8% ≤ 10%',
      provenance: 'registered-course-task',
      provenanceLabel: '课程任务 cruise-comfort-course-turn',
    });
    expect(heading).toBeUndefined();
    expect(debrief.thresholds.some((item) => item.metricId === 'rudder_deg')).toBe(false);
    expect(summaryFrom().trace.summary.passed).toBe(true);
  });

  it('states unsatisfied overshoot and settling-time requirements without aggregate judgments', () => {
    const overshootFail = project({
      summary: summaryFrom({
        performance: { overshoot: 18, settlingTime: 40, accel: 0.08, settled: true },
      }),
    });
    const settlingFail = project({
      summary: summaryFrom({
        performance: { overshoot: 8, settlingTime: 52, accel: 0.08, settled: true },
      }),
    });

    expect(overshootFail.thresholds.find((item) => item.metricId === 'turn_overshoot_percent')).toMatchObject({
      satisfied: false,
      comparisonText: '18% > 10%',
      outcomeText: '转向超调要求未满足',
    });
    expect(settlingFail.thresholds.find((item) => item.metricId === 'settling_time_s')).toMatchObject({
      satisfied: false,
      comparisonText: '52 s > 45 s',
      outcomeText: '调节时间要求未满足',
    });
    const corpus = JSON.stringify(overshootFail) + JSON.stringify(settlingFail);
    for (const phrase of FORBIDDEN_DEBRIEF_PHRASES) {
      expect(corpus).not.toContain(phrase);
    }
  });

  it('keeps free exploration on the fact layer without 满足 or 未满足', () => {
    const debrief = project({ taskContract: null });
    expect(debrief.status).toBe('ready');
    expect(debrief.hasAuthoritativeTask).toBe(false);
    expect(debrief.thresholds).toEqual([]);
    expect(debrief.taskJudgmentUnavailableReason).toContain('没有权威任务阈值');
    expect(debrief.thresholds).toEqual([]);
    expect(debrief.facts.some((item) => item.factText.includes('要求已满足') || item.factText.includes('要求未满足'))).toBe(false);
  });

  it('does not emit a second completion summary for the same run identity', () => {
    const summary = summaryFrom();
    expect(canEmitCruiseCompletionTelemetry({
      isCompleted: true,
      runId: 'cruise-run-1',
      emittedRunId: null,
      summary,
    })).toBe(true);
    expect(canEmitCruiseCompletionTelemetry({
      isCompleted: true,
      runId: 'cruise-run-1',
      emittedRunId: 'cruise-run-1',
      summary,
    })).toBe(false);
  });
});

describe('cruise control-effect debrief isolation', () => {
  it('does not persist runs, call Arena, or write learner evidence from the projector or card', () => {
    const projector = readFileSync(join(process.cwd(), 'src/resources/simulations/simulations/cruise/control-effect-debrief.ts'), 'utf8');
    const card = readFileSync(join(process.cwd(), 'src/resources/simulations/simulations/cruise/control-effect-debrief-card.tsx'), 'utf8');
    const scene = readFileSync(join(process.cwd(), 'src/resources/simulations/simulations/cruise-simulation.tsx'), 'utf8');
    for (const source of [projector, card]) {
      expect(source).not.toContain('persistSceneTraceRun');
      expect(source).not.toContain('/api/arena');
      expect(source).not.toContain('LearningFact');
    }
    expect(scene).toContain('canEmitCruiseCompletionTelemetry');
    expect(scene).toContain('isCompleted={state.isCompleted}');
    expect(scene).toContain('resolveCruiseDebriefTaskContract(isCourseMode)');
    expect(scene).not.toContain('taskContract: state.targetForm');
  });
});

describe('cruise control-effect debrief card', () => {
  it('renders the five acceptance states with permitted wording and landmark structure', () => {
    const satisfied = project();
    const overshootFail = project({
      summary: summaryFrom({
        performance: { overshoot: 18, settlingTime: 40, accel: 0.08, settled: true },
      }),
    });
    const settlingFail = project({
      summary: summaryFrom({
        performance: { overshoot: 8, settlingTime: 52, accel: 0.08, settled: true },
      }),
    });
    const freeExplore = project({ taskContract: null });
    const incomplete = project({ isCompleted: false });

    const satisfiedHtml = renderToStaticMarkup(createElement(ControlEffectDebriefCard, { debrief: satisfied }));
    const overshootHtml = renderToStaticMarkup(createElement(ControlEffectDebriefCard, { debrief: overshootFail }));
    const settlingHtml = renderToStaticMarkup(createElement(ControlEffectDebriefCard, { debrief: settlingFail }));
    const controlHtml = renderToStaticMarkup(createElement(ControlEffectDebriefCard, { debrief: freeExplore }));
    const incompleteHtml = renderToStaticMarkup(createElement(ControlEffectDebriefCard, { debrief: incomplete }));

    expect(satisfiedHtml).toContain('控制效果复盘');
    expect(satisfiedHtml).toContain('role="region"');
    expect(satisfiedHtml).toContain('8% ≤ 10%');
    expect(satisfiedHtml).toContain('课程任务 cruise-comfort-course-turn');
    expect(overshootHtml).toContain('转向超调要求未满足');
    expect(settlingHtml).toContain('52 s &gt; 45 s');
    expect(controlHtml).toContain('不能判断控制需求是否过大');
    expect(controlHtml).not.toContain('已满足');
    expect(incompleteHtml).toContain('运行尚未完成');
    expect(incompleteHtml).not.toContain('转向超调要求');
    for (const html of [satisfiedHtml, overshootHtml, settlingHtml, controlHtml, incompleteHtml]) {
      expect(debriefContainsForbiddenPhrase(html)).toBe(false);
    }
  });
});
