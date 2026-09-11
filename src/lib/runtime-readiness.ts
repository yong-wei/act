import 'server-only';

import { open, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION,
  type ActRuntimeBlobReleaseManifest,
} from '@/lib/runtime-release';
import { readActiveRuntimeReleaseManifest, RuntimeActiveReleaseError } from '@/lib/runtime-active-release';

export const RUNTIME_READINESS_BLOB_VIEW_MODE = 'ossfs-blob-view';
export const RUNTIME_CONSUMER_VERIFICATION_FILENAME = '.act-runtime-consumer-verification.json';
export const RUNTIME_DEV_DELIVERY_FILENAME = '.act-runtime-dev-delivery.json';
// 与 scripts/runtime-release/developer-oss/runtime_requirements.json 呼应的有界探测文件；
// 一致性由 runtime-readiness 测试守护（生产代码不得跨界读取 scripts/）。
export const RUNTIME_FILESYSTEM_PROBE_PATH = 'resource-governance/micro-tutoring-resource-projection-v2.json';
export const RUNTIME_CONSUMER_VERIFICATION_SCHEMA = 'act-runtime-consumer-verification.v1';

export type RuntimeFilesystemReadiness = { ready: true } | { ready: false; failureClass: string };

export type RuntimeReadinessIdentity = {
  schemaVersion: typeof ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION;
  releaseId: string;
  manifestSha256: string;
  treeSha256: string;
};

export type RuntimeReadinessProjection = {
  required: boolean;
  ready: boolean;
  identity: RuntimeReadinessIdentity | null;
  filesystem: RuntimeFilesystemReadiness;
};

export function isBlobViewRuntimeRequired(
  deliveryMode = process.env.RUNTIME_DELIVERY_MODE,
): boolean {
  return deliveryMode?.trim() === RUNTIME_READINESS_BLOB_VIEW_MODE;
}

export function projectRuntimeIdentity(
  manifest: ActRuntimeBlobReleaseManifest,
): RuntimeReadinessIdentity {
  return {
    schemaVersion: ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION,
    releaseId: manifest.releaseId,
    manifestSha256: manifest.manifestSha256,
    treeSha256: manifest.treeSha256,
  };
}

export async function projectRuntimeReadiness(
  runtimeRoot?: string,
  activeReceiptPath?: string,
  _coordinatedActiveReceiptPath?: string,
  _authorityCurrentPath?: string,
  verificationReceiptPath?: string,
  consumerUid?: number | null,
  probePath?: string,
  devDeliveryMarkerPath?: string,
): Promise<RuntimeReadinessProjection> {
  const required = isBlobViewRuntimeRequired();
  if (!required) {
    return { required: false, ready: true, identity: null, filesystem: { ready: true } };
  }

  try {
    const manifest = await readActiveRuntimeReleaseManifest(runtimeRoot, activeReceiptPath);
    if (!manifest || manifest.schemaVersion !== ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION) {
      return { required: true, ready: false, identity: null, filesystem: { ready: false, failureClass: 'manifest-unavailable' } };
    }
    const identity = projectRuntimeIdentity(manifest);
    const filesystem = await verifyConsumerFilesystem(
      identity, runtimeRoot, verificationReceiptPath, consumerUid, probePath, devDeliveryMarkerPath,
    );
    return {
      required: true,
      ready: filesystem.ready,
      identity,
      filesystem,
    };
  } catch (error) {
    if (error instanceof RuntimeActiveReleaseError) {
      return { required: true, ready: false, identity: null, filesystem: { ready: false, failureClass: 'manifest-unavailable' } };
    }
    throw error;
  }
}

async function readConsumerVerificationReceipt(
  receiptPath: string,
): Promise<{ receipt: Record<string, unknown> | null; exists: boolean }> {
  let raw: string;
  try {
    raw = await readFile(receiptPath, 'utf8');
  } catch {
    return { receipt: null, exists: false };
  }
  try {
    const payload = JSON.parse(raw) as unknown;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { receipt: null, exists: true };
    const receipt = payload as Record<string, unknown>;
    if (receipt.schemaVersion !== RUNTIME_CONSUMER_VERIFICATION_SCHEMA) return { receipt: null, exists: true };
    return { receipt, exists: true };
  } catch {
    return { receipt: null, exists: true };
  }
}

async function probeReadableFile(target: string): Promise<boolean> {
  try {
    const handle = await open(target, 'r');
    try {
      const buffer = Buffer.alloc(1);
      const read = await handle.read(buffer, 0, 1, 0);
      return read.bytesRead === 1;
    } finally {
      await handle.close();
    }
  } catch {
    return false;
  }
}

type MarkerState = 'absent' | 'readable' | 'unreadable';

/**
 * 标志判定必须区分"不存在"（生产形态）与"存在但读取失败"（Developer 交付但
 * 权限/遍历故障）：后者按 fail-closed 处理，绝不退化为生产语义报 ready。
 */
async function readDevDeliveryMarker(markerPath: string): Promise<MarkerState> {
  try {
    const handle = await open(markerPath, 'r');
    try {
      const buffer = Buffer.alloc(1);
      const read = await handle.read(buffer, 0, 1, 0);
      return read.bytesRead === 1 ? 'readable' : 'unreadable';
    } finally {
      await handle.close();
    }
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (code === 'ENOENT') return 'absent';
    return 'unreadable';
  }
}

/**
 * Issue #1713：readyz 不得仅凭挂载存在报告 runtime ready——该回执门禁以
 * Developer OSS 交付标志（`.act-runtime-dev-delivery.json`，由 Developer
 * bootstrap 成功 prepare 后写入并持久保留）界定作用域：标志不存在 = 生产形态，
 * 保持生产既有语义；标志存在则验证回执必须有效——Release 身份、消费者 UID、
 * bind 路径，以及回执登记的全部必需治理工件的有界读取探测（P1：任一先前
 * 接受的工件不可读都必须让 readiness 为 false，而不是等业务消费时才失败）。
 */
export async function verifyConsumerFilesystem(
  identity: RuntimeReadinessIdentity,
  runtimeRoot = path.join(/*turbopackIgnore: true*/ process.cwd(), 'course-content', 'runtime'),
  receiptPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'course-content', RUNTIME_CONSUMER_VERIFICATION_FILENAME),
  consumerUid: number | null = typeof process.getuid === 'function' ? process.getuid() : null,
  probePath?: string,
  devDeliveryMarkerPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'course-content', RUNTIME_DEV_DELIVERY_FILENAME),
): Promise<RuntimeFilesystemReadiness> {
  const marker = await readDevDeliveryMarker(devDeliveryMarkerPath);
  if (marker === 'absent') return { ready: true };
  if (marker === 'unreadable') return { ready: false, failureClass: 'dev-delivery-unreadable' };
  const { receipt, exists } = await readConsumerVerificationReceipt(receiptPath);
  if (!exists) return { ready: false, failureClass: 'consumer-verification-missing' };
  if (!receipt) return { ready: false, failureClass: 'consumer-verification-invalid' };
  const fields = [
    receipt.releaseId, receipt.manifestSha256, receipt.treeSha256,
    receipt.consumerUid, receipt.runtimeRoot, receipt.verifierVersion,
  ];
  if (fields.some((value) => typeof value !== 'string' && typeof value !== 'number')) {
    return { ready: false, failureClass: 'consumer-verification-invalid' };
  }
  if (receipt.releaseId !== identity.releaseId
    || receipt.manifestSha256 !== identity.manifestSha256
    || receipt.treeSha256 !== identity.treeSha256) {
    return { ready: false, failureClass: 'consumer-verification-identity-drift' };
  }
  if (receipt.runtimeRoot !== runtimeRoot
    || receipt.verifierVersion !== 'consumer-verification.v1') {
    return { ready: false, failureClass: 'consumer-verification-invalid' };
  }
  if (consumerUid !== null && receipt.consumerUid !== consumerUid) {
    return { ready: false, failureClass: 'consumer-identity-mismatch' };
  }
  const requiredPaths = Array.isArray(receipt.requiredArtifacts)
    ? receipt.requiredArtifacts
      .filter((artifact): artifact is { path: string } => (
        Boolean(artifact) && typeof artifact === 'object' && typeof (artifact as { path?: unknown }).path === 'string'
      ))
      .map((artifact) => artifact.path)
    : [];
  const probeTargets = requiredPaths.length > 0
    ? requiredPaths.map((relative) => path.join(runtimeRoot, relative))
    : [probePath ?? path.join(runtimeRoot, RUNTIME_FILESYSTEM_PROBE_PATH)];
  for (const target of probeTargets) {
    if (!await probeReadableFile(target)) {
      return { ready: false, failureClass: 'required-artifact-unreadable' };
    }
  }
  return { ready: true };
}
