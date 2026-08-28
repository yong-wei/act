import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('control analysis core foundation', () => {
  it('builds a 4-1 analysis request with reserved runtime extension fields', async () => {
    const { buildUnit41AnalysisRequest } = await import(
      '@/resources/control-system/analysis/unit-4-1-request-builder'
    );

    const request = buildUnit41AnalysisRequest('step-04', {
      gain: 2.25,
      structures: [{ kind: 'gain', enabled: true, params: { k: 2.25 } }],
    });

    expect(request.runtimeMode).toBe('analysis');
    expect(request.outputs).toEqual(
      expect.arrayContaining(['step_response', 'root_locus', 'magnitude', 'phase', 'nyquist']),
    );
    expect(request).toHaveProperty('delay');
    expect(request).toHaveProperty('discreteConfig');
    expect(request).toHaveProperty('stateSpaceSpec');
    expect(request).toHaveProperty('referenceProfile');
    expect(request).toHaveProperty('disturbanceProfile');
    expect(request).toHaveProperty('responseType');
    expect(request).toHaveProperty('nyquist');
  });

  it('declares a chart panel shell with overlay slot and fixture fallback support', () => {
    const panelPath = join(repoRoot, 'src/resources/control-system/charts/control-chart-panel.tsx');
    expect(existsSync(panelPath)).toBe(true);

    const source = readFileSync(panelPath, 'utf8');
    expect(source).toContain('overlay');
    expect(source).toContain('fallback');
    expect(source).toContain('isFallback');
  });

  it('retries through the browser facade when the control-analysis worker cannot answer', () => {
    const hookSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/analysis/use-control-engine.ts'),
      'utf8',
    );

    expect(hookSource).toContain('computeAnalysisBrowser');
    expect(hookSource).toContain('runBrowserFacade');
    expect(hookSource).not.toContain("import('../wasm/control_engine/index.js')");
  });

  it('uses metric headers instead of subtitle copy and fixes chart formatting constraints in source', () => {
    const panelShell = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-chart-panel.tsx'),
      'utf8',
    );
    const panelSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-analysis-panels.tsx'),
      'utf8',
    );
    const workspaceSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-figure-workspace.tsx'),
      'utf8',
    );

    expect(panelShell).not.toContain('subtitle:');
    expect(panelSource).toContain('phaseMarginDeg');
    expect(panelSource).toContain('gainMarginDb');
    expect(panelSource).toContain('toFixed(2)');
    expect(panelSource).toContain('ship_heading');
    expect(panelSource).toContain('platform_pitch');
    expect(panelSource).toContain('rootLocusFull');
    expect(panelSource).toContain('rootLocusZoom');
    expect(panelSource).toContain('areaStyle');
    expect(panelSource).not.toContain('markArea');
    expect(workspaceSource).not.toContain('正在计算控制分析曲线');
    expect(workspaceSource).toContain('xl:grid-cols-[minmax(0,1.18fr)_minmax(0,1fr)]');
    expect(workspaceSource).toContain('xl:grid-cols-2');
    expect(workspaceSource).toContain('<BodePanel');
    expect(workspaceSource).toContain('mode="full"');
    expect(workspaceSource).toContain('mode="zoom"');
  });

  it('keeps root-locus sample gain metadata available for trajectory snapping workflows', () => {
    const typeSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/analysis/types.ts'),
      'utf8',
    );
    const panelSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-analysis-panels.tsx'),
      'utf8',
    );

    expect(typeSource).toContain('export interface RootLocusSamplePoint extends ComplexPoint');
    expect(typeSource).toContain('gain?: number;');
    expect(typeSource).toContain('branchId?: number;');
    expect(typeSource).toContain('sampleIndex?: number;');
    expect(typeSource).toContain("samplingMode?: 'adaptive' | 'fixed';");
    expect(typeSource).toContain('increment?: number;');
    expect(typeSource).toContain("responseType?: 'step' | 'impulse' | 'ramp';");
    expect(typeSource).toContain('export interface NyquistConfig');
    expect(typeSource).toContain("mode?: 'full' | 'half';");
    expect(typeSource).toContain('positivePoints?: ComplexPoint[];');
    expect(typeSource).toContain('negativePoints?: ComplexPoint[];');
    expect(typeSource).toContain('export interface NyquistSegment');
    expect(typeSource).toContain('segments?: NyquistSegment[];');
    expect(typeSource).toContain('infinityClosure?: NyquistClosureSegment;');
    expect(typeSource).toContain('keyPoints?: NyquistKeyPoint[];');
    expect(typeSource).toContain('encirclements?: number;');
    expect(typeSource).toContain('export interface NyquistCriterion');
    expect(typeSource).toContain('criterion?: NyquistCriterion;');
    expect(typeSource).toContain('branches: RootLocusSamplePoint[][];');
    expect(typeSource).toContain('fullBranches?: RootLocusSamplePoint[][];');
    expect(typeSource).toContain('export interface RootLocusEvent');
    expect(typeSource).toContain('events?: RootLocusEvent[];');
    expect(typeSource).toContain('branchStructure?: RootLocusBranchStructure;');
    expect(typeSource).toContain('views?: RootLocusViews;');
    expect(typeSource).toContain('suggestedInsets?: RootLocusView[];');
    expect(typeSource).toContain("'near_zero'");
    expect(typeSource).toContain('endpointType?:');
    expect(typeSource).toContain('targetZeroIndex?: number;');
    expect(typeSource).toContain('terminalDistance?: number;');
    expect(typeSource).toContain('samplingParameter?:');
    expect(typeSource).toContain('diagnostics?: RootLocusDiagnostics;');
    expect(typeSource).toContain('finiteZeroCoverage: RootLocusFiniteZeroCoverage;');
    expect(typeSource).toContain('assignmentWarnings: string[];');
    expect(typeSource).toContain('gains?: number[];');
    expect(typeSource).toContain('stationaryPoints?: RootLocusSamplePoint[];');
    expect(typeSource).toContain('realAxisSegments?: RealAxisSegment[];');
    expect(typeSource).toContain('asymptotes?: RootLocusAsymptote[];');
    expect(panelSource).toContain('point.gain');
    expect(panelSource).toContain('无穷远闭合段');
    expect(panelSource).toContain("type: 'dashed'");
    expect(panelSource).toContain('Gain K');
    expect(panelSource).not.toContain('normalizeConjugateBranches');
  });

  it('supports a dedicated closed-pole handle variant for draggable closed-loop markers', () => {
    const panelSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-analysis-panels.tsx'),
      'utf8',
    );

    expect(panelSource).toContain("renderAs?: 'open-pole' | 'open-zero' | 'closed-pole'");
    expect(panelSource).toContain("handle.renderAs === 'closed-pole'");
  });
});
