import type { ExperimentStep } from '../contracts/experiment-step';
import type { VesselSessionConfiguration, VesselSessionFrame, VesselSessionInput } from '@/lib/control-engine/vessel-session';
import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import type { VesselSample } from '../simulations/vessel-experiment';
import type { VesselTracePoint } from '@/features/simulations/run-evidence';
import type { DestroyerComparisonEvidence, DestroyerModelEvidence } from './destroyer-evidence';
import type { FrozenVesselStudentModel, VesselModelComparison } from './student-analysis';
import type { VesselCourseKey } from './course-catalog';
import { LNG_COURSE_STEPS, lngCourseConfiguration, lngCourseDefaultSettings, lngCourseInput,
  lngStudentSpeedModel, validateLngCourseSettings, type LngCourseSettings } from './lng-course';
import { lngCourseTraceSamples } from './lng-experiment';
import { validateLngCourseEvidence } from './lng-evidence';
import { forecastVesselSpeed } from './student-analysis';

export interface VesselCourseStep extends ExperimentStep {
  sequence: number;
  minimumRuns: number;
}

export interface VesselCourseEvidence {
  runs: VesselRunSummary[];
  models: DestroyerModelEvidence[];
  comparisons: DestroyerComparisonEvidence[];
  answers: Record<string, string>;
}

/** 船型教学命令与验收差异，运行、恢复和工件持久化继续由原业务流程负责。 */
export interface VesselCourseAdapter<Settings extends object> {
  courseKey: VesselCourseKey;
  experimentKey: string;
  steps: readonly VesselCourseStep[];
  defaultSettings(sequence: number): Settings;
  restoreSettings(value: unknown, sequence: number): Settings;
  configuration(sequence: number, settings: Settings): VesselSessionConfiguration;
  input(sequence: number, settings: Settings, initial: VesselSessionInput, frame: VesselSessionFrame,
    models: FrozenVesselStudentModel[], designModelId: string): VesselSessionInput;
  traceSamples(trace: VesselTracePoint[]): VesselSample[];
  validateEvidence(step: VesselCourseStep, evidence: VesselCourseEvidence): string | null;
  nativeSequence?(sequence: number): number;
  previousPlanSequence?(sequence: number): number | undefined;
  forecastOnlySequence?: number;
  requiresForecastSequence?: number;
  forecast?(scopeKey: string, runId: string, sequence: number, configuration: VesselSessionConfiguration,
    durationS: number, input: VesselSessionInput, frame: VesselSessionFrame,
    model: FrozenVesselStudentModel): VesselModelComparison;
}

export const lngCourseAdapter: VesselCourseAdapter<LngCourseSettings> = {
  courseKey: 'lng', experimentKey: 'lng-berthing', steps: LNG_COURSE_STEPS,
  defaultSettings: lngCourseDefaultSettings,
  restoreSettings(value, sequence) {
    const settings = (value ?? lngCourseDefaultSettings(sequence)) as LngCourseSettings;
    const error = validateLngCourseSettings(settings);
    if (error) throw new Error(error);
    return settings;
  },
  configuration: lngCourseConfiguration,
  input(sequence, settings, initial, frame, models, designModelId) {
    const step = LNG_COURSE_STEPS[sequence - 1];
    const model = step.speedControl ? lngStudentSpeedModel(models.find((item) => item.id === designModelId)) : undefined;
    return lngCourseInput(step, settings, initial, frame, model);
  },
  traceSamples: lngCourseTraceSamples,
  validateEvidence: (step, evidence) => validateLngCourseEvidence(LNG_COURSE_STEPS[step.sequence - 1], evidence),
  nativeSequence: (sequence) => sequence === 7 ? 8 : sequence,
  previousPlanSequence: (sequence) => sequence === 8 ? 7 : undefined,
  forecastOnlySequence: 7, requiresForecastSequence: 8,
  forecast: (scope, id, _sequence, configuration, duration, input, frame, model) =>
    forecastVesselSpeed(scope, id, configuration, duration, input, frame.parameters, model),
};
