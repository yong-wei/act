import { describe, expect, it } from 'vitest';

import {
  evaluateV018HostShadow,
  V018_FROZEN_IMAGE_TAG,
  V018_STAGED_AUTHORITY_RECEIPT_SHA256,
  V018_STAGED_QUALIFICATION_SHA256,
} from '../teaching-projection/publish/v018-host-shadow';

const readyObservation = {
  appImage: V018_FROZEN_IMAGE_TAG,
  workerImage: V018_FROZEN_IMAGE_TAG,
  workerHealth: 'healthy',
  readyz: { app: true, db: true, redis: true },
  publicReadyzStatus: 200,
  authorityReleaseId: 'ctr:release:control-theory-engineering-v0.9',
  authoritySnapshotId: 'snap-7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7',
  projectionId: 'proj-769b1a832622c0abb898becdf7218535ba6ab970ee7a7828afb067d14701e10d',
  projectionSha256: 'cf553630400a297d678a2927940e011e300e756aa59cd46bccac8489dd6ac703',
  prerequisitePublicationId: 'proj-b8100a7f322e588a620a2869b5fccafa22d501de9a85bb5882a7c56e9528a21b',
  prerequisiteSha256: 'a040258e8efef848de45b7b933e0231519d416bd0d9b7c8a3ebb433abb1e6e0e',
  activationId: 'first-cutover-7f4cdd1084af-769b1a832622',
  activationSha256: 'e73ac1abd0d691c615308b215f1941ca5bea9b125cb98b844a0b5d969c6fbc0b',
  stagedAuthorityReceiptSha256: V018_STAGED_AUTHORITY_RECEIPT_SHA256,
  stagedQualificationSha256: V018_STAGED_QUALIFICATION_SHA256,
  activeGraphReleaseId: 'ctr:release:control-theory-engineering-v0.9',
  activeGraphSnapshotId: 'snap-7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7',
  pointersUnchangedAfterStage: true,
  consumerStatuses: [
    { consumerId: 'course-runtime', status: 'READY' },
    { consumerId: 'engineering-graph', status: 'READY' },
    { consumerId: 'engineering-rag', status: 'READY' },
    { consumerId: 'konling', status: 'READY' },
    { consumerId: 'learning-path', status: 'READY' },
    { consumerId: 'teaching-resource-rag', status: 'READY' },
  ],
};

describe('v0.18 host shadow evaluation', () => {
  it('is READY only when production stays on v0.9 and the staged candidate matches', () => {
    expect(evaluateV018HostShadow(readyObservation)).toEqual({ status: 'READY', blockers: [] });
  });

  it('fails closed when the active graph is not the frozen v0.9 snapshot', () => {
    const result = evaluateV018HostShadow({
      ...readyObservation,
      activeGraphReleaseId: 'ctr:release:control-theory-engineering-v0.18',
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('host-active-graph-not-v09');
  });
});
