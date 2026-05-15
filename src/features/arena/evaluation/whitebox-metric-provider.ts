import type { ChallengeObject, ChallengeTask, ControllerArtifact, ControllerMethod } from '../types';
import { estimateMetrics, summarizeController } from './whitebox-evaluator';
import { TEMPLATE_WHITEBOX_PROTOCOL_VERSION } from './protocol-versions';

export { estimateMetrics, summarizeController };

const TEMPLATE_WHITEBOX_METHODS = new Set<ControllerMethod>([
  'pid',
  'serial-compensator',
  'composite-compensation',
  'optimized-pid',
  'mpc',
]);

export interface SyncWhiteBoxMetricProvider {
  id: string;
  protocolVersion: string;
  evaluate(input: {
    task: ChallengeTask;
    object: ChallengeObject;
    artifact: ControllerArtifact;
  }): Record<string, number>;
}

export function isTemplateWhiteBoxMethod(method: string): method is ControllerMethod {
  return TEMPLATE_WHITEBOX_METHODS.has(method as ControllerMethod);
}

export function selectWhiteBoxMetricProvider(method: string): SyncWhiteBoxMetricProvider {
  if (!isTemplateWhiteBoxMethod(method)) {
    throw new Error(`No white-box metric provider is available for controller method ${method}.`);
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
      return estimateMetrics(object.model, controller);
    },
  };
}
