import type { ChallengeObject, ChallengeTask, ControllerArtifact } from '../types';
import type { ArenaEvaluationResult } from '../evaluation/types';
import type { ArenaBlackBoxExperimentDataset } from '../blackbox/experiment-service';

export interface ArenaPlantAdapter {
  canRunPublicExperiment(task: ChallengeTask, object: ChallengeObject): boolean;
  runPublicExperiment(input: {
    task: ChallengeTask;
    object: ChallengeObject;
    signalType: 'step' | 'impulse' | 'prbs' | 'sine';
    sampleCount: number;
    seed?: string;
  }): Promise<ArenaBlackBoxExperimentDataset>;
  canRunOfficialEvaluation(task: ChallengeTask, object: ChallengeObject): boolean;
  runOfficialEvaluation(input: {
    task: ChallengeTask;
    object: ChallengeObject;
    artifact: ControllerArtifact;
  }): Promise<ArenaEvaluationResult>;
}

export function createCruiseRollBlackBoxAdapter(): ArenaPlantAdapter {
  return {
    canRunPublicExperiment(task, object) {
      return object.id === 'plant-cruise-roll-blackbox'
        && task.allowedMethods.includes('black-box-control');
    },

    async runPublicExperiment({ signalType, sampleCount }) {
      const maxSamples = Math.min(sampleCount, 2000);
      const timePoints = Array.from({ length: maxSamples }, (_, i) => i * 0.05);
      const datasetHash = `arena-blackbox-dataset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

      const response = timePoints.map((t) => {
        const noise = Math.sin(t * 0.7) * 0.05 + Math.cos(t * 1.3) * 0.03;
        const signalBase = signalType === 'step' ? 1.0
          : signalType === 'sine' ? Math.sin(t)
            : signalType === 'prbs' ? (Math.random() > 0.5 ? 1 : -1)
              : signalType === 'impulse' ? (t < 0.1 ? 10 : 0)
                : 1.0;
        return { time: t, input: signalBase, output: signalBase * 0.8 + noise };
      });

      return {
        datasetHash,
        signalType,
        sampleCount: maxSamples,
        createdAt: new Date().toISOString(),
        data: response,
      };
    },

    canRunOfficialEvaluation(task, object) {
      return this.canRunPublicExperiment(task, object);
    },

    async runOfficialEvaluation() {
      throw new Error('Official blackbox evaluation must use the server-side evaluator via evaluateArenaSubmission.');
    },
  };
}
