import type {VesselCourseAdapter} from './course-adapter';
import {DREDGER_COURSE_STEPS, dredgerConfiguration, dredgerCourseInput, dredgerDefaultSettings,
  validateDredgerSettings, type DredgerCourseSettings} from './dredger-course';
import {dredgerTraceSamples} from './dredger-experiment';
import {validateDredgerEvidence} from './dredger-evidence';
import {computeVirtualSimulationStep} from '../physics/simulation-engine-facade';
import {vesselComparisonFactors} from './comparison-factors';

export const dredgerCourseAdapter: VesselCourseAdapter<DredgerCourseSettings> = {
  courseKey: 'dredger', experimentKey: 'dredger-mode', steps: DREDGER_COURSE_STEPS,
  defaultSettings: dredgerDefaultSettings,
  restoreSettings(value, sequence) {
    const settings = {...dredgerDefaultSettings(sequence), ...value as Partial<DredgerCourseSettings>};
    const error = validateDredgerSettings(settings);
    if (error) throw new Error(error);
    return settings;
  },
  configuration: dredgerConfiguration, input: dredgerCourseInput, traceSamples: dredgerTraceSamples,
  validateEvidence: (step, evidence) => validateDredgerEvidence(DREDGER_COURSE_STEPS[step.sequence - 1], evidence),
  requiresForecast: (sequence) => DREDGER_COURSE_STEPS[sequence - 1].closedLoop,
  forecast(scopeKey, runId, _sequence, configuration, durationS, input, frame, model) {
    const radius = frame.parameters.dredger?.initialSwingRadiusM;
    if (model.scopeKey !== scopeKey || model.channel !== 'winch-reference-to-sway' || !input.dredger || !radius) {
      throw new Error('请选择本人固定作业模式的绞车指令—横移速度联合模型。');
    }
    const timeS = Array.from({length: Math.round(durationS / 0.05) + 1}, (_, index) => index * 0.05);
    const result = computeVirtualSimulationStep<{predicted: number[]; commandsMps: number[]; headingDeg: number[]; eastM: number[]}>({
      modelId: 'student_model_analysis', operation: 'dredger_closed_loop', structure: model.payload.structure,
      inputOrigin: Number(model.payload.operatingPoint.inputOrigin), outputOrigin: Number(model.payload.operatingPoint.outputOrigin),
      initialSpeedMps: 0, initialHeadingDeg: configuration.initialHeadingDeg ?? 0, swingRadiusM: radius,
      durationS, dtS: 0.05, assumedCutStartS: input.dredger.entryHoldS + 8, controller: input.dredger,
    });
    return {id: crypto.randomUUID(), scopeKey, runId, modelId: model.id, actuatorModelId: null,
      mode: 'independent_closed_loop', startS: 0, endS: durationS, timeS, actual: [], predicted: result.predicted,
      measuredInput: [], predictedInput: result.commandsMps, predictedHeadingDeg: result.headingDeg,
      predictedEastM: result.eastM, metrics: {}, createdAtMs: Date.now(), serverId: null, purpose: 'forecast',
      outputUnit: 'm/s', outputChannel: 'DredgerSwaySpeed', controllerInput: structuredClone(input),
      factorFlags: vesselComparisonFactors(configuration, 'independent_closed_loop')};
  },
};
