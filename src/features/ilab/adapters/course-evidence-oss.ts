import { createHash } from 'node:crypto';
import type { Prisma, SimulationRun, SimulationEvidenceObject } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canonicalJson } from '@/lib/student-model-artifact-contract/server-hash';
import { simulationOssLocation } from '@/features/simulations/public-api';
import { authorizeSimulationOssUpload, authorizeSimulationOssDownload, confirmSimulationOssUpload,
  simulationEvidenceDirectUploadEnabled, type SimulationOssObjectReceipt } from '@/features/ilab/adapters/oss-object-store';
import { findOwnedVesselRun, vesselRunStorageSummary } from '../course-evidence-service';
import { closeDirectVesselEvidenceRun } from '../course-evidence-chunks';
import type { VesselEvidenceOssObject, VesselEvidenceSave } from '../course-evidence-contract';
import { vesselEvidenceObjectMetadata, type VesselEvidenceObjectMetadata } from './course-evidence-objects';
import { IlabServiceError } from '../service-error';

type OssObjectMetadata = VesselEvidenceObjectMetadata & {
  upload: { descriptor: VesselEvidenceOssObject; descriptorHash: string; receipt?: SimulationOssObjectReceipt };
};
const hash = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');

function objectMetadata(run: SimulationRun, descriptor: VesselEvidenceOssObject): OssObjectMetadata {
  const binding = vesselEvidenceObjectMetadata(run);
  const summary = vesselRunStorageSummary(run);
  const location = simulationOssLocation(descriptor.reference);
  const sequence = descriptor.purpose === 'chunk' ? descriptor.chunk.chunkIndex
    : descriptor.purpose === 'checkpoint' ? descriptor.close.controlCount : 0;
  if (location.runRef !== run.sourceRefId || location.purpose !== descriptor.purpose || location.sequence !== sequence
    || (location.storedBytes !== undefined && location.storedBytes !== descriptor.storedBytes)
    || (descriptor.purpose === 'chunk' && (descriptor.chunk.runRef !== run.sourceRefId
      || descriptor.chunk.parameterHash !== summary.parameterHash))
    || (descriptor.purpose === 'checkpoint' && descriptor.close.checkpointPreview.parameterHash !== summary.parameterHash)
    || (descriptor.purpose === 'opening' && descriptor.openingHash !== summary.openingHash)) {
    throw new IlabServiceError('上传对象与本次运行、序号或版本不一致。', 409);
  }
  return { ...binding, ...(descriptor.purpose === 'chunk' ? { chunk: descriptor.chunk } : {}),
    upload: { descriptor, descriptorHash: hash({ binding, descriptor }) } };
}

function checkedMetadata(run: SimulationRun, row: SimulationEvidenceObject) {
  const metadata = row.metadata as unknown as OssObjectMetadata;
  if (!metadata?.upload?.descriptor) throw new IlabServiceError('实验对象缺少上传描述。', 409);
  const expected = objectMetadata(run, metadata.upload.descriptor);
  if (row.runId !== run.id || row.reference !== metadata.upload.descriptor.reference
    || row.checksum !== simulationOssLocation(row.reference).checksum
    || row.storedBytes !== metadata.upload.descriptor.storedBytes
    || row.uncompressedBytes !== metadata.upload.descriptor.uncompressedBytes
    || canonicalJson({ ...metadata, upload: undefined }) !== canonicalJson({ ...expected, upload: undefined })
    || metadata.upload.descriptorHash !== expected.upload.descriptorHash) {
    throw new IlabServiceError('实验对象与当前账号、轮次或版本不一致。', 409);
  }
  return metadata;
}

async function requireWritableRun(run: SimulationRun) {
  const report = await prisma.virtualSimulationReport.findUnique({
    where: { id: vesselRunStorageSummary(run).reportId }, select: { userId: true, status: true },
  });
  if (run.status !== 'running' || report?.userId !== run.ownerUserId
    || !['draft', 'revision-requested'].includes(report.status)) {
    throw new IlabServiceError('这次运行已结束或报告已提交，请读取已保存状态。', 409);
  }
}

/** 上传意向不改变实验进度，重复请求只续签同一个不可变对象。 */
export async function authorizeOwnedVesselUploads(userId: string, runRef: string, descriptors: VesselEvidenceOssObject[]) {
  if (!simulationEvidenceDirectUploadEnabled()) throw new IlabServiceError('实验直传暂不可用，请保留本机记录后重试。', 503);
  const run = await findOwnedVesselRun(userId, runRef);
  const objects = descriptors.map(descriptor => ({ descriptor, metadata: objectMetadata(run, descriptor) }));
  const references = objects.map(object => object.descriptor.reference);
  if (new Set(references).size !== references.length) throw new IlabServiceError('上传对象引用重复。', 400);
  const rows = await prisma.simulationEvidenceObject.findMany({ where: { runId: run.id, reference: { in: references } } });
  const existing = new Map(rows.map(row => [row.reference, row]));
  for (const { descriptor, metadata } of objects) {
    const previous = existing.get(descriptor.reference);
    if (previous && checkedMetadata(run, previous).upload.descriptorHash !== metadata.upload.descriptorHash) {
      throw new IlabServiceError('相同实验对象的上传描述发生变化。', 409);
    }
  }
  if (objects.some(({ descriptor }) => {
    const row = existing.get(descriptor.reference);
    return !row || row.purpose !== descriptor.purpose || !checkedMetadata(run, row).upload.receipt;
  })) await requireWritableRun(run);
  if (objects.some(object => !existing.get(object.descriptor.reference))) {
    await prisma.simulationEvidenceObject.createMany({ skipDuplicates: true, data: objects
      .filter(object => !existing.has(object.descriptor.reference))
      .map(({ descriptor, metadata }) => ({ runId: run.id, purpose: 'upload', reference: descriptor.reference,
        checksum: simulationOssLocation(descriptor.reference).checksum, uncompressedBytes: descriptor.uncompressedBytes,
        storedBytes: descriptor.storedBytes, chunkIndex: descriptor.purpose === 'chunk' ? descriptor.chunk.chunkIndex : null,
        metadata: metadata as unknown as Prisma.InputJsonValue })) });
    // 并发签发可能先登记相同引用，重新核对持久化的描述。
    const registered = await prisma.simulationEvidenceObject.findMany({ where: { runId: run.id, reference: { in: references } } });
    for (const row of registered) existing.set(row.reference, row);
  }
  const authorizations = [];
  for (const { descriptor, metadata } of objects) {
    const row = existing.get(descriptor.reference);
    if (!row || checkedMetadata(run, row).upload.descriptorHash !== metadata.upload.descriptorHash) {
      throw new IlabServiceError('实验对象登记发生冲突，请读取上传状态。', 409);
    }
    const confirmed = row.purpose === descriptor.purpose && Boolean(checkedMetadata(run, row).upload.receipt);
    authorizations.push(confirmed ? { reference: descriptor.reference, confirmed: true as const }
      : { ...await authorizeSimulationOssUpload(descriptor.reference, descriptor.storedBytes, metadata.upload.descriptorHash),
        confirmed: false as const });
  }
  return { objects: authorizations };
}

async function confirmOwnedObjects(run: SimulationRun, references: string[]) {
  if (new Set(references).size !== references.length) throw new IlabServiceError('保存的对象引用重复。', 400);
  const rows = await prisma.simulationEvidenceObject.findMany({ where: { runId: run.id, reference: { in: references } } });
  const indexed = new Map(rows.map(row => [row.reference, row]));
  const confirmed = new Map<string, { row: SimulationEvidenceObject; metadata: OssObjectMetadata }>();
  for (let start = 0; start < references.length; start += 4) {
    await Promise.all(references.slice(start, start + 4).map(async reference => {
      const row = indexed.get(reference);
      if (!row) throw new IlabServiceError('实验对象尚未登记上传，请重新请求保存。', 409);
      const metadata = checkedMetadata(run, row);
      const { descriptor, descriptorHash } = metadata.upload;
      if (row.purpose !== descriptor.purpose || !metadata.upload.receipt) {
        const receipt = await confirmSimulationOssUpload(reference, descriptor.storedBytes, descriptorHash);
        metadata.upload = { ...metadata.upload, receipt };
        await prisma.simulationEvidenceObject.updateMany({ where: { id: row.id, runId: run.id, purpose: 'upload' },
          data: { purpose: descriptor.purpose, metadata: metadata as unknown as Prisma.InputJsonValue } });
      }
      confirmed.set(reference, { row, metadata });
    }));
  }
  return confirmed;
}

/** 先确认对象回执，再复用既有报告/运行事务原子提交连续前缀与恢复点。 */
export async function commitOwnedVesselUpload(userId: string, runRef: string,
  input: VesselEvidenceSave & { checkpointReference: string }) {
  const run = await findOwnedVesselRun(userId, runRef);
  const { checkpointReference, ...close } = input;
  const confirmed = await confirmOwnedObjects(run, [...(close.pendingChunks ?? []),
    ...(close.openingReference ? [close.openingReference] : []), checkpointReference]);
  const checkpoint = confirmed.get(checkpointReference)!;
  const descriptor = checkpoint.metadata.upload.descriptor;
  if (descriptor.purpose !== 'checkpoint' || canonicalJson(descriptor.close) !== canonicalJson(close)) {
    throw new IlabServiceError('恢复点与本次保存的描述不一致。', 409);
  }
  return closeDirectVesselEvidenceRun(userId, runRef, close, { uri: checkpointReference,
    checksum: checkpoint.row.checksum, storedBytes: descriptor.storedBytes, uncompressedBytes: descriptor.uncompressedBytes });
}

export async function authorizeOwnedVesselDownloads(userId: string, runRef: string, references: string[]) {
  const run = await findOwnedVesselRun(userId, runRef);
  const rows = await prisma.simulationEvidenceObject.findMany({ where: { runId: run.id,
    reference: { in: references }, purpose: { in: ['opening', 'chunk', 'checkpoint'] } } });
  const indexed = new Map(rows.map(row => [row.reference, row]));
  return { objects: await Promise.all(references.map(async reference => {
    const row = indexed.get(reference);
    if (!row) throw new IlabServiceError('实验对象尚未确认或无权读取。', 404);
    const metadata = checkedMetadata(run, row);
    if (!metadata.upload.receipt) throw new IlabServiceError('实验对象尚未确认上传。', 409);
    return { ...await authorizeSimulationOssDownload(reference, metadata.upload.receipt.versionId),
      uncompressedBytes: row.uncompressedBytes, storedBytes: row.storedBytes };
  })) };
}
