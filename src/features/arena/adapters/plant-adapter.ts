import type { ChallengeObject, ChallengeTask, ControllerArtifact } from '../types';
import type { ArenaEvaluationResult } from '../evaluation/types';
import type { ArenaBlackBoxExperimentDataset } from '../blackbox/experiment';

export interface ArenaPlantAdapter {
  canRunPublicExperiment(task: ChallengeTask, object: ChallengeObject): boolean;
  runPublicExperiment(input: {
    task: ChallengeTask;
    object: ChallengeObject;
    signalType: 'step' | 'impulse' | 'prbs' | 'sine';
    seed?: string;
  }): Promise<ArenaBlackBoxExperimentDataset>;
  canRunOfficialEvaluation(task: ChallengeTask, object: ChallengeObject): boolean;
  runOfficialEvaluation(input: {
    task: ChallengeTask;
    object: ChallengeObject;
    artifact: ControllerArtifact;
  }): Promise<ArenaEvaluationResult>;
}

export function createMockCruiseRollBlackBoxAdapterForTests(): ArenaPlantAdapter {
  return {
    canRunPublicExperiment(task, object) {
      return object.id === 'plant-cruise-roll-blackbox'
        && task.allowedMethods.includes('black-box-control');
    },

    async runPublicExperiment({ task, object, signalType }) {
      const sampleTime = 0.05;
      const duration = 8;
      const sampleCount = Math.floor(duration / sampleTime);
      const datasetHash = `arena-blackbox-dataset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      const scenarioId = 'default';

      const samples = Array.from({ length: sampleCount }, (_, i) => {
        const t = i * sampleTime;
        const noise = Math.sin(t * 0.7) * 0.05 + Math.cos(t * 1.3) * 0.03;
        const input = signalType === 'step' ? 1.0
          : signalType === 'sine' ? Math.sin(t)
            : signalType === 'prbs' ? (Math.random() > 0.5 ? 1 : -1)
              : signalType === 'impulse' ? (t < 0.1 ? 10 : 0)
                : 1.0;
        return { t, input, output: input * 0.8 + noise };
      });

      const peakOutput = Math.max(...samples.map((s) => Math.abs(s.output)));
      const finalOutput = samples[samples.length - 1]?.output ?? 0;
      const meanAbsOutput = samples.reduce((sum, s) => sum + Math.abs(s.output), 0) / samples.length;
      const inputEnergy = samples.reduce((sum, s) => sum + (s.input * s.input * sampleTime), 0);

      return {
        taskId: task.id,
        objectId: object.id,
        datasetHash,
        scenarioId,
        signalType,
        sampleTime,
        duration,
        budgetCost: 1,
        samples,
        summary: {
          peakOutput,
          finalOutput,
          meanAbsOutput,
          inputEnergy,
          dataQuality: Math.min(1, 0.7 + 0.3 * Math.random()),
        },
        createdAt: new Date().toISOString(),
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
