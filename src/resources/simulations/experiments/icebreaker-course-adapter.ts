import type { VesselCourseAdapter } from './course-adapter';
import { ICEBREAKER_COURSE_STEPS, icebreakerDefaultSettings, icebreakerConfiguration, icebreakerCourseInput,
  icebreakerHeadingReference, validateIcebreakerSettings, type IcebreakerCourseSettings } from './icebreaker-course';
import { icebreakerTraceSamples } from './icebreaker-experiment';
import { validateIcebreakerEvidence } from './icebreaker-evidence';
import { vesselComparisonFactors } from './comparison-factors';
import { computeVirtualSimulationStep } from '../physics/simulation-engine-facade';

export const icebreakerCourseAdapter: VesselCourseAdapter<IcebreakerCourseSettings> = {
  courseKey: 'icebreaker',
  experimentKey: 'icebreaker-ice',
  steps: ICEBREAKER_COURSE_STEPS,
  defaultSettings: icebreakerDefaultSettings,
  restoreSettings(value, sequence) {
    const settings = { ...icebreakerDefaultSettings(sequence), ...value as Partial<IcebreakerCourseSettings> };
    const error = validateIcebreakerSettings(settings);
    if (error) throw new Error(error);
    return settings;
  },
  configuration: icebreakerConfiguration,
  input: icebreakerCourseInput,
  traceSamples: icebreakerTraceSamples,
  validateEvidence: (step, evidence) => validateIcebreakerEvidence(ICEBREAKER_COURSE_STEPS[step.sequence - 1], evidence),
  requiresForecast: (sequence) => ICEBREAKER_COURSE_STEPS[sequence - 1].closedLoop,
  forecast(scopeKey, runId, sequence, configuration, durationS, input, frame, model, settings, models) {
    const actuator = models.find((item) => item.channel === 'azimuth-servo' && item.scopeKey === scopeKey);
    if (model.scopeKey !== scopeKey || model.channel !== 'azimuth-to-yaw' || !actuator) {
      throw new Error('请选择本人冻结的吊舱局部模型，并先保存本人吊舱伺服模型。');
    }
    const timeS = Array.from({ length: Math.round(durationS / .05) + 1 }, (_, index) => index * .05);
    const result = computeVirtualSimulationStep<{ predicted: number[]; commandsDeg: number[]; headingDeg: number[] }>({
      modelId: 'student_model_analysis', operation: 'heading_closed_loop',
      structure: model.payload.structure, dtS: .05,
      inputOrigin: Number(model.payload.operatingPoint.inputOrigin),
      outputOrigin: Number(model.payload.operatingPoint.outputOrigin),
      initialHeadingDeg: configuration.initialHeadingDeg ?? 0,
      initialYawRateDegS: frame.truth.body_velocity[5] * 180 / Math.PI,
      reference: timeS.map((time) => icebreakerHeadingReference(sequence, time, settings)),
      controller: input,
      actuator: { structure: actuator.payload.structure,
        inputOrigin: Number(actuator.payload.operatingPoint.inputOrigin),
        outputOrigin: Number(actuator.payload.operatingPoint.outputOrigin), initialOutput: 0 },
    });
    return {
      id: crypto.randomUUID(), scopeKey, modelId: model.id, actuatorModelId: actuator.id, runId,
      mode: 'independent_closed_loop', startS: 0, endS: durationS, timeS,
      actual: [], predicted: result.predicted, measuredInput: [], predictedInput: result.commandsDeg,
      actualHeadingDeg: [], predictedHeadingDeg: result.headingDeg,
      metrics: {}, createdAtMs: Date.now(), serverId: null, purpose: 'forecast',
      outputUnit: '°/s', outputChannel: 'YawRate', controllerInput: structuredClone(input),
      factorFlags: vesselComparisonFactors(configuration, 'independent_closed_loop'),
    };
  },
};
