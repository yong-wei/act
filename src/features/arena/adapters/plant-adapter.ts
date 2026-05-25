import {
  createSeededRng,
  createSimulationRunContext,
  normalizeSeed,
} from '@/resources/simulations/core/seeded-rng';
import { buildSimulationReplayMetadata } from '@/resources/simulations/lib/replay-checksum';
import type { ChallengeObject, ChallengeTask } from '../types';
import type { ArenaBlackBoxExperimentDataset } from '../blackbox/experiment';

export interface ArenaTestPlantAdapter {
  canRunPublicExperiment(task: ChallengeTask, object: ChallengeObject): boolean;
  runPublicExperiment(input: {
    task: ChallengeTask;
    object: ChallengeObject;
    signalType: 'step' | 'impulse' | 'prbs' | 'sine';
    seed?: string;
  }): Promise<ArenaBlackBoxExperimentDataset>;
}

export function createMockCruiseRollBlackBoxAdapterForTests(): ArenaTestPlantAdapter {
  return {
    canRunPublicExperiment(task, object) {
      return object.id === 'plant-cruise-roll-blackbox'
        && task.allowedMethods.includes('black-box-control');
    },

    async runPublicExperiment({ task, object, signalType, seed }) {
      const sampleTime = 0.05;
      const duration = 8;
      const sampleCount = Math.floor(duration / sampleTime);
      const scenarioId = 'default';
      const normalizedSeed = normalizeSeed(seed, `${task.id}:${object.id}:${signalType}:${scenarioId}`);
      const rng = createSeededRng(normalizedSeed, `arena-test-plant/${task.id}/${scenarioId}`);
      const datasetHash = `arena-blackbox-dataset-${normalizedSeed.toString(36)}-${task.id.slice(0, 8)}`;

      const samples = Array.from({ length: sampleCount }, (_, i) => {
        const t = i * sampleTime;
        const noise = Math.sin(t * 0.7) * 0.05 + Math.cos(t * 1.3) * 0.03;
        const input = signalType === 'step' ? 1.0
          : signalType === 'sine' ? Math.sin(t)
            : signalType === 'prbs' ? (rng.next() > 0.5 ? 1 : -1)
              : signalType === 'impulse' ? (t < 0.1 ? 10 : 0)
                : 1.0;
        return { t, input, output: input * 0.8 + noise };
      });

      const peakOutput = Math.max(...samples.map((s) => Math.abs(s.output)));
      const finalOutput = samples[samples.length - 1]?.output ?? 0;
      const meanAbsOutput = samples.reduce((sum, s) => sum + Math.abs(s.output), 0) / samples.length;
      const inputEnergy = samples.reduce((sum, s) => sum + (s.input * s.input * sampleTime), 0);

      const payloadWithoutReplay = {
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
          dataQuality: Math.min(1, 0.7 + 0.3 * rng.next()),
        },
        createdAt: new Date().toISOString(),
      };
      const replay = buildSimulationReplayMetadata(createSimulationRunContext({
        runId: datasetHash,
        sceneId: `arena/${task.id}/test-plant`,
        scenarioId,
        seed: normalizedSeed,
        runtimeVersion: 'arena-test-plant-runtime-v1',
        modelVersion: 'mock-cruise-roll-blackbox-v1',
      }), payloadWithoutReplay);

      return {
        ...payloadWithoutReplay,
        replay,
      };
    },

  };
}
