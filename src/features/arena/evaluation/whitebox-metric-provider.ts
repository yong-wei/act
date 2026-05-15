import type { ChallengeObject, ChallengeTask, ControllerArtifact, ControllerMethod } from '../types';
import { estimateMetrics, summarizeController } from './whitebox-evaluator';
import { buildArenaControlAnalysisRequest } from './controller-to-analysis-request';
import { extractMetricsFromAnalysisResult, type ArenaMetricSource } from './metric-extraction';
import { ANALYSIS_WHITEBOX_PROTOCOL_VERSION, TEMPLATE_WHITEBOX_PROTOCOL_VERSION } from './protocol-versions';
import type { ControlAnalysisService } from './control-analysis-service';

export { estimateMetrics, summarizeController };

const ANALYSIS_WHITEBOX_METHODS = new Set<ControllerMethod>([
  'pid',
  'serial-compensator',
]);

const TEMPLATE_WHITEBOX_METHODS = new Set<ControllerMethod>([
  'pid',
  'serial-compensator',
  'composite-compensation',
  'optimized-pid',
  'mpc',
]);

export interface WhiteBoxMetricProviderOutput {
  metrics: Record<string, number>;
  metricSources: Record<string, ArenaMetricSource>;
  analysisClosedLoopStable?: boolean;
  explanation: string[];
}

export interface SyncWhiteBoxMetricProvider {
  id: string;
  protocolVersion: string;
  evaluate(input: {
    task: ChallengeTask;
    object: ChallengeObject;
    artifact: ControllerArtifact;
  }): WhiteBoxMetricProviderOutput | Record<string, number> | Promise<WhiteBoxMetricProviderOutput | Record<string, number>>;
}

export function isTemplateWhiteBoxMethod(method: string): method is ControllerMethod {
  return TEMPLATE_WHITEBOX_METHODS.has(method as ControllerMethod);
}

export function isAnalysisWhiteBoxMethod(method: string): method is ControllerMethod {
  return ANALYSIS_WHITEBOX_METHODS.has(method as ControllerMethod);
}

export function selectWhiteBoxMetricProvider(
  method: string,
  options: { controlAnalysisService?: ControlAnalysisService } = {},
): SyncWhiteBoxMetricProvider {
  if (!isTemplateWhiteBoxMethod(method)) {
    throw new Error(`No white-box metric provider is available for controller method ${method}.`);
  }
  if (isAnalysisWhiteBoxMethod(method)) {
    return createAnalysisWhiteBoxMetricProvider(options.controlAnalysisService);
  }
  return createHeuristicWhiteBoxMetricProvider();
}

export function createHeuristicWhiteBoxMetricProvider(): SyncWhiteBoxMetricProvider {
  return {
    id: 'heuristic-template-whitebox',
    protocolVersion: TEMPLATE_WHITEBOX_PROTOCOL_VERSION,
    evaluate({ object, artifact }) {
      if (!object.model) {
        throw new Error(`Object ${object.id} does not expose a transfer-function model.`);
      }
      const controller = summarizeController(artifact, object.model);
      return {
        metrics: estimateMetrics(object.model, controller),
        metricSources: {},
        explanation: ['template-whitebox-v1 uses deterministic template metrics.'],
      };
    },
  };
}

export function createAnalysisWhiteBoxMetricProvider(
  controlAnalysisService?: ControlAnalysisService,
): SyncWhiteBoxMetricProvider {
  return {
    id: 'analysis-control-result-whitebox',
    protocolVersion: ANALYSIS_WHITEBOX_PROTOCOL_VERSION,
    async evaluate(input) {
      if (!controlAnalysisService) {
        throw new Error('ControlAnalysisService is required for analysis-whitebox-v1 evaluation.');
      }
      const request = buildArenaControlAnalysisRequest(input);
      const analysisResult = await controlAnalysisService.compute(request);
      const extracted = extractMetricsFromAnalysisResult(analysisResult);
      const fields = {
        overshoot: extracted.overshoot,
        settlingTime: extracted.settlingTime,
        steadyStateError: extracted.steadyStateError,
        itae: extracted.itae,
        phaseMargin: extracted.phaseMargin,
        gainMargin: extracted.gainMargin,
        bandwidth: extracted.bandwidth,
        controlEnergy: extracted.controlEnergy,
      };
      const metrics: Record<string, number> = {};
      const metricSources: Record<string, ArenaMetricSource> = {};

      for (const [metricId, field] of Object.entries(fields)) {
        metricSources[metricId] = field.source;
        if (field.value !== null && Number.isFinite(field.value)) {
          metrics[metricId] = Math.round(field.value * 1000) / 1000;
        }
      }

      return {
        metrics,
        metricSources,
        analysisClosedLoopStable: extracted.closedLoopStable,
        explanation: [
          'ControlAnalysisResult metrics are used for official white-box evaluation.',
          'controlEnergy is derived from step response shape, not direct actuator energy.',
        ],
      };
    },
  };
}

export function normalizeWhiteBoxMetricProviderOutput(
  output: WhiteBoxMetricProviderOutput | Record<string, number>,
): WhiteBoxMetricProviderOutput {
  if ('metrics' in output && typeof output.metrics === 'object') {
    return output as WhiteBoxMetricProviderOutput;
  }
  return {
    metrics: output as Record<string, number>,
    metricSources: {},
    explanation: [],
  };
}
