import assert from 'node:assert/strict';

import {
  assertCaptureCompletedWithoutDrift,
  assertCleanCaptureStart,
  assertServedRevision,
} from '../../artifacts/commercial-ui/pid-turn-calibration-1038/evidence-contract.mjs';

const revision = 'a'.repeat(40);
const hashes = {
  'src/resources/simulations/lib/monte-carlo-optimizer.ts': 'b'.repeat(64),
};

assert.doesNotThrow(() => assertCleanCaptureStart({ head: revision, status: '' }));
assert.throws(
  () => assertCleanCaptureStart({ head: revision, status: ' M src/app/evidence-pid/page.tsx\0' }),
  /干净工作区/,
);

assert.throws(
  () => assertServedRevision({ captureRevision: revision, servedRevision: undefined, sourceHashes: hashes, servedSourceHashes: hashes }),
  /未公开完整 APP_REVISION/,
);
assert.throws(
  () => assertServedRevision({ captureRevision: revision, servedRevision: 'c'.repeat(40), sourceHashes: hashes, servedSourceHashes: hashes }),
  /运行实例修订与采集提交不一致/,
);
assert.throws(
  () => assertServedRevision({
    captureRevision: revision,
    servedRevision: revision,
    sourceHashes: hashes,
    servedSourceHashes: { ...hashes, forged: 'c'.repeat(64) },
  }),
  /运行实例源码或 WASM 哈希/,
);

assert.doesNotThrow(() => assertCaptureCompletedWithoutDrift({
  captureRevision: revision,
  postRevision: revision,
  postStatus: ' M artifacts/commercial-ui/pid-turn-calibration-1038/browser-evidence.json\0',
  beforeHashes: hashes,
  afterHashes: hashes,
}));

assert.throws(
  () => assertCaptureCompletedWithoutDrift({
    captureRevision: revision,
    postRevision: revision,
    postStatus: ' M src/resources/simulations/lib/monte-carlo-optimizer.ts\0',
    beforeHashes: hashes,
    afterHashes: hashes,
  }),
  /证据目录以外的漂移/,
);

assert.throws(
  () => assertCaptureCompletedWithoutDrift({
    captureRevision: revision,
    postRevision: revision,
    postStatus: '',
    beforeHashes: hashes,
    afterHashes: { ...hashes, extra: 'd'.repeat(64) },
  }),
  /源码或 WASM 发生变化/,
);

console.log('PID recommendation evidence contract tests passed');
