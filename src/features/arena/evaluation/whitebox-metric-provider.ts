import type { ChallengeObject, ChallengeTask, ControllerArtifact } from '../types';
import { estimateMetrics, summarizeController } from './whitebox-evaluator';

export { estimateMetrics, summarizeController };

export interface WhiteBoxMetricProvider {
  evaluate(input: {
    task: ChallengeTask;
    object: ChallengeObject;
    artifact: ControllerArtifact;
  }): Promise<Record<string, number>>;
}

export function createHeuristicWhiteBoxMetricProvider(): WhiteBoxMetricProvider {
  return {
    async evaluate({ task, object, artifact }) {
      if (!object.model) {
        throw new Error(`Object ${object.id} does not expose a transfer-function model.`);
      }
      const controller = summarizeController(artifact, object.model);
      return estimateMetrics(object.model, controller);
    },
  };
}
