import { expect, it, vi } from 'vitest';
import { readRecoveredRunState } from '../run-recovery';
import { downloadVesselObjectInWorker } from '../evidence-worker-client';
import type { CourseRunRecovery } from '../run-evidence';

vi.mock('../evidence-upload', () => ({ requestVesselEvidence: vi.fn(async () => ({ objects: [
  { reference: 'opening', url: 'opening-url' }, { reference: 'checkpoint', url: 'checkpoint-url' },
] })) }));
vi.mock('../evidence-worker-client', () => ({ downloadVesselObjectInWorker: vi.fn() }));

it('引用恢复保留已下载恢复点的浏览器摘要，未推进即可重新同步或提交', async () => {
  const preview = { schema: 'act.vessel-checkpoint-preview.v1', recoverable: true,
    parameterHash: 'parameter', timeS: 5, controllerTicks: 100, fineCount: 5, appliedFinalInput: {}, metrics: {} };
  const opening = { schema: 'act.vessel-run-opening.v1', runRef: 'run', parameterHash: 'parameter',
    initialCheckpoint: 'initial', configuration: {}, input: {} };
  const checkpoint = { schema: 'act.vessel-run-close.v1', checkpoint: 'current', endTimeS: 5,
    controlCount: 100, nativeCount: 2, fineCount: 5, checkpointPreview: preview };
  vi.mocked(downloadVesselObjectInWorker).mockResolvedValueOnce(opening).mockResolvedValueOnce(checkpoint);
  const header = { id: 'run', parameterHash: 'parameter', lastTimeS: 5, configuration: {}, initialInput: {},
    stateObjects: { openingReference: 'opening', checkpointReference: 'checkpoint' },
    traceManifest: { chunkCount: 1, controlCount: 100, nativeCount: 2, fineCount: 5 } } as unknown as CourseRunRecovery;
  const recovered = await readRecoveredRunState(header);
  expect(recovered.checkpoint).toBe('current');
  expect(recovered.checkpointPreview).toEqual(preview);
});
