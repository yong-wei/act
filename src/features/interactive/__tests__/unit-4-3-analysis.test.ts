import { describe, expect, it } from 'vitest';

describe('unit 4-3 control analysis builder', () => {
  it('normalizes pi+lead parameters and builds a cascaded analysis request', async () => {
    const {
      buildUnit43AnalysisRequest,
      normalizeUnit43PanelParams,
      formatUnit43ControllerFormula,
    } = await import('@/resources/control-system/analysis/unit-4-3-request-builder');

    const normalized = normalizeUnit43PanelParams('pi_lead', {
      gain: 6,
      piPoleFrequency: -0.5,
      leadZeroFrequency: 5,
      leadPoleFrequency: 2,
    });

    expect(normalized.piPoleFrequency).toBeGreaterThan(0);
    expect(normalized.leadZeroFrequency).toBeDefined();
    expect(normalized.leadPoleFrequency).toBeDefined();
    expect(normalized.leadZeroFrequency!).toBeLessThan(normalized.leadPoleFrequency!);

    const request = buildUnit43AnalysisRequest('pi_lead', normalized);

    expect(request.runtimeMode).toBe('analysis');
    expect(request.caseId).toBe('unit43_pi_lead');
    expect(request.structures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'gain', params: expect.objectContaining({ k: normalized.gain }) }),
        expect.objectContaining({ kind: 'pi' }),
        expect.objectContaining({ kind: 'lead' }),
      ]),
    );
    expect(formatUnit43ControllerFormula('pi_lead', normalized)).toContain('C(s)=');
    expect(formatUnit43ControllerFormula('pi_lead', normalized)).toContain('\\left(1+\\dfrac{1}{');
  }, 15000);

  it('builds filtered pid requests with a fixed filter constant and emits the actual controller formula', async () => {
    const {
      buildUnit43AnalysisRequest,
      normalizeUnit43PanelParams,
      formatUnit43ControllerFormula,
    } = await import('@/resources/control-system/analysis/unit-4-3-request-builder');

    const normalized = normalizeUnit43PanelParams('pid_filtered', {
      kp: 3.5,
      ki: 2.3333333333,
      kd: 0.25,
    });
    const request = buildUnit43AnalysisRequest('pid_filtered', normalized);
    const firstStructure = request.structures[0];
    expect(firstStructure).toBeDefined();

    expect(request.caseId).toBe('unit43_pid_filtered');
    expect(Object.values(normalized).every((value) => Number.isFinite(value))).toBe(true);
    expect(Object.values(firstStructure!.params).every((value) => Number.isFinite(Number(value)))).toBe(true);
    expect(request.structures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'pid',
          params: expect.objectContaining({
            kp: 3.5,
            ki: 2.3333333333,
            kd: 0.25,
            tf: 0.05,
          }),
        }),
      ]),
    );
    expect(formatUnit43ControllerFormula('pid_filtered', normalized)).toContain('0.05s+1');
    expect(formatUnit43ControllerFormula('pid_filtered', normalized)).toContain('\\dfrac{0.25s}{0.05s+1}');
  });

  it('formats plant and controller formulas as standard fractions instead of slash-style text', async () => {
    const {
      formatUnit43ControllerFormula,
      formatUnit43PlantFormula,
    } = await import('@/resources/control-system/analysis/unit-4-3-request-builder');

    expect(formatUnit43PlantFormula('pi_lead')).toBe('P_1(s)=\\dfrac{1}{(s+1)(0.4s+1)}');
    expect(formatUnit43PlantFormula('lag_lead')).toBe('P_2(s)=\\dfrac{1}{(s+1)(0.5s+1)(0.1s+1)}');
    expect(formatUnit43PlantFormula('pid_filtered')).toBe('P_3(s)=\\dfrac{1}{(s+1)(s+2)}');
    expect(formatUnit43PlantFormula('heading_case')).toBe('P_h(s)=\\dfrac{0.01715}{s(s+0.1)(s+2.14375)}');
    expect(formatUnit43PlantFormula('roll_boundary')).toBe('G_{\\varphi M_f}(s)=\\dfrac{1}{2.052s^2+0.3929s+1}');

    expect(formatUnit43ControllerFormula('pi_lead', {
      gain: 6,
      piPoleFrequency: 1 / 1.8,
      leadZeroFrequency: 1 / 0.9,
      leadPoleFrequency: 1 / 0.18,
    })).toBe('C(s)=6\\left(1+\\dfrac{1}{1.8s}\\right)\\dfrac{0.9s+1}{0.18s+1}');

    expect(formatUnit43ControllerFormula('lag_lead', {
      gain: 6,
      lagPoleFrequency: 1 / 20,
      lagZeroFrequency: 1 / 5,
      leadZeroFrequency: 1 / 0.8,
      leadPoleFrequency: 1 / 0.16,
    })).toBe('C(s)=6\\dfrac{5s+1}{20s+1}\\dfrac{0.8s+1}{0.16s+1}');

    expect(formatUnit43ControllerFormula('heading_case', {
      gain: 2.8,
      leadZeroFrequency: 0.1,
      leadPoleFrequency: 0.25,
    })).toBe('C(s)=2.8\\dfrac{10s+1}{4s+1}');

    expect(formatUnit43ControllerFormula('roll_boundary', {
      kp: 0.7858,
      ki: 2,
      kd: 4.104,
    })).toContain('\\dfrac{2}{s}');
  });

  it('keeps the heading-case and roll-boundary frequency constraints ordered', async () => {
    const {
      normalizeUnit43PanelParams,
      buildUnit43AnalysisRequest,
      getUnit43FallbackResult,
    } = await import('@/resources/control-system/analysis/unit-4-3-request-builder');

    const headingParams = normalizeUnit43PanelParams('heading_case', {
      gain: 2.8,
      leadZeroFrequency: 0.25,
      leadPoleFrequency: 0.12,
    });
    expect(headingParams.leadZeroFrequency).toBeDefined();
    expect(headingParams.leadPoleFrequency).toBeDefined();
    expect(headingParams.leadZeroFrequency!).toBeLessThan(headingParams.leadPoleFrequency!);

    const rollParams = normalizeUnit43PanelParams('roll_boundary', {
      kp: 0.7858,
      ki: 2,
      kd: 4.104,
    });

    const rollRequest = buildUnit43AnalysisRequest('roll_boundary', rollParams);
    expect(rollRequest.caseId).toBe('unit43_roll_boundary');
    expect(getUnit43FallbackResult('roll_boundary').metrics.phaseMarginDeg).not.toBeNull();
  });

  it('builds roll-boundary disturbance comparison data from the disturbance channel instead of the generic closed-loop tracking output', async () => {
    const { buildUnit43RollBoundaryComparison } = await import(
      '@/resources/control-system/analysis/unit-4-3-roll-boundary'
    );

    const comparison = buildUnit43RollBoundaryComparison({
      kp: 0.7858,
      ki: 2,
      kd: 4.104,
    });

    expect(comparison.metrics.resonancePeakDb.current).toBeCloseTo(1.774126956, 3);
    expect(comparison.metrics.resonanceFrequencyRadPerSec.current).toBeCloseTo(0.686925868, 3);
    expect(comparison.metrics.amplitudeRatio.current).toBeCloseTo(0.333333333, 3);
    expect(comparison.timeSeries.current.length).toBeGreaterThan(100);
    expect(comparison.magnitudeSeries.current.length).toBeGreaterThan(100);
    expect(comparison.magnitudeSeries.current[0]?.y).toBeLessThan(0);
  });
});
