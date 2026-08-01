import assert from 'node:assert/strict';

export const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

export const EVIDENCE_OUTPUT_PATHS = new Set([
  'artifacts/commercial-ui/pid-turn-calibration-1038/browser-evidence.json',
  'artifacts/commercial-ui/pid-turn-calibration-1038/pid-recommendation-1440-metrics.json',
  'artifacts/commercial-ui/pid-turn-calibration-1038/pid-recommendation-1440.png',
  'artifacts/commercial-ui/pid-turn-calibration-1038/pid-recommendation-320-metrics.json',
  'artifacts/commercial-ui/pid-turn-calibration-1038/pid-recommendation-320.png',
]);

export function parsePorcelainPaths(status) {
  const entries = status.split('\0').filter(Boolean);
  const paths = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    assert.ok(entry.length >= 4, `无法解析 Git 状态项：${JSON.stringify(entry)}`);
    const code = entry.slice(0, 2);
    paths.push(entry.slice(3));
    if (code.includes('R') || code.includes('C')) {
      index += 1;
      assert.ok(entries[index], `Git ${code.trim()} 状态缺少来源路径`);
      paths.push(entries[index]);
    }
  }

  return paths;
}

export function assertCleanCaptureStart({ head, status }) {
  assert.match(head, COMMIT_SHA_PATTERN, '采集前 Git HEAD 必须是完整的 40 位提交 SHA');
  assert.deepEqual(parsePorcelainPaths(status), [], '采集必须从干净工作区开始');
}

export function assertServedRevision({ captureRevision, servedRevision, sourceHashes, servedSourceHashes }) {
  assert.match(servedRevision ?? '', COMMIT_SHA_PATTERN, '运行实例未公开完整 APP_REVISION');
  assert.equal(servedRevision, captureRevision, '运行实例修订与采集提交不一致');
  assert.deepEqual(servedSourceHashes, sourceHashes, '运行实例源码或 WASM 哈希与采集 checkout 不一致');
}

export function assertCaptureCompletedWithoutDrift({
  captureRevision,
  postRevision,
  postStatus,
  beforeHashes,
  afterHashes,
  allowedOutputPaths = EVIDENCE_OUTPUT_PATHS,
}) {
  assert.equal(postRevision, captureRevision, '采集期间 Git HEAD 发生变化');
  assert.deepEqual(afterHashes, beforeHashes, '采集期间生成器、生产源码或 WASM 发生变化');

  const changedPaths = parsePorcelainPaths(postStatus);
  const unexpectedPaths = changedPaths.filter((path) => !allowedOutputPaths.has(path));
  assert.deepEqual(unexpectedPaths, [], `采集产生了证据目录以外的漂移：${unexpectedPaths.join(', ')}`);

  return changedPaths;
}
