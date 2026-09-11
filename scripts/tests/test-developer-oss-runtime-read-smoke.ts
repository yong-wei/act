/**
 * #2083 本地 OSS Runtime 读取验收。
 * 活环境端到端（生成路径 → 打开资源 → verified 记录）须在 runtime:activate
 * 完成之后执行，避开发布/激活窗口的身份切换。
 */
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { promoteIndexedObjectKeyReads } from '@/features/personalization/path-planning/adaptive-path-oss-provenance';
import {
  createBoundRuntimeObjectKeyVerifier,
  verifyBoundRuntimeObject,
} from '@/lib/runtime-bound-object-read';

function fail(message: string): never {
  throw new Error(message);
}

async function main() {
  const root = mkdtempSync(path.join(tmpdir(), 'oss-runtime-read-smoke-'));
  const body = Buffer.from('smoke-media\n');
  const sha256 = createHash('sha256').update(body).digest('hex');
  mkdirSync(path.join(root, '.act-runtime-blobs'));
  mkdirSync(path.join(root, 'lessons/1-1/media'), { recursive: true });
  writeFileSync(path.join(root, '.act-runtime-blobs', sha256), body);
  symlinkSync(
    path.join('..', '..', '..', '.act-runtime-blobs', sha256),
    path.join(root, 'lessons/1-1/media/intro.mp4'),
  );
  try {
    const opened = await verifyBoundRuntimeObject(root, 'lessons/1-1/media/intro.mp4', sha256);
    if (opened.state !== 'verified' || opened.contentSha256 !== sha256) {
      fail(`expected verified open, got ${JSON.stringify(opened)}`);
    }
    const missing = await verifyBoundRuntimeObject(root, 'lessons/1-1/media/gone.mp4', sha256);
    if (missing.state !== 'missing') fail(`expected missing, got ${missing.state}`);
    const mismatch = await verifyBoundRuntimeObject(root, 'lessons/1-1/media/intro.mp4', 'c'.repeat(64));
    if (mismatch.state !== 'checksum-mismatch') fail(`expected checksum-mismatch, got ${mismatch.state}`);
    writeFileSync(path.join(root, '.act-runtime-blobs', sha256), Buffer.from('stale-helper\n'));
    const stale = await verifyBoundRuntimeObject(root, 'lessons/1-1/media/intro.mp4', sha256);
    if (stale.state !== 'checksum-mismatch') fail(`expected stale helper checksum-mismatch, got ${stale.state}`);
    writeFileSync(path.join(root, '.act-runtime-blobs', sha256), body);

    const records = await promoteIndexedObjectKeyReads([
      {
        objectKey: 'lessons/1-1/media/intro.mp4',
        resourceId: 'act:video:1-1',
        candidateStyleId: 'foundation-remediation',
        nodeNodeId: 'generated-node',
        state: 'index-verified',
        contentSha256: sha256,
        verifiedAt: '2026-09-11T00:00:00.000Z',
        runtimeReleaseId: 'runtime-smoke',
      },
    ], createBoundRuntimeObjectKeyVerifier(root), '2026-09-11T00:00:00.000Z');
    const record = records[0];
    if (
      record?.state !== 'verified'
      || record.runtimeReleaseId !== 'runtime-smoke'
      || record.contentSha256 !== sha256
      || record.objectKey !== 'lessons/1-1/media/intro.mp4'
    ) {
      fail(`incomplete verified record: ${JSON.stringify(record)}`);
    }
    process.stdout.write('developer-oss-runtime-read-smoke ok\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
