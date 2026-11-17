import { randomUUID } from 'node:crypto';
import type { SimulationRun } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { readSimulationTraceChunk } from '@/lib/data-governance/simulation-trace-cas';
import { vesselTraceChunkSchema, type VesselTraceChunk, type VesselTraceChunkMetadata } from '../course-evidence-contract';
import { describeVesselTraceChunk, type StoredChunk } from '../course-evidence-prefix';
import { vesselRunStorageSummary } from '../course-evidence-service';
import { IlabServiceError } from '../service-error';

type ObjectMetadata = {
  schema: 'act.vessel-evidence-object.v1';
  ownerUserId: string;
  reportId: string;
  openingHash: string;
  courseVersion: string;
  runtimeVersion: string;
  modelVersion: string;
  chunk?: VesselTraceChunkMetadata;
};

/** 内容确认不推进采样水位，唯一引用可以在丢失回执后重复确认。 */
export async function confirmVesselEvidenceObject(run: SimulationRun, stored: StoredChunk,
  purpose: 'chunk' | 'checkpoint', chunk?: VesselTraceChunkMetadata) {
  const summary = vesselRunStorageSummary(run);
  if (!run.ownerUserId || (chunk && (chunk.runRef !== run.sourceRefId || chunk.parameterHash !== summary.parameterHash))) {
    throw new IlabServiceError('采样对象与本次运行不一致。', 409);
  }
  const metadata: ObjectMetadata = { schema: 'act.vessel-evidence-object.v1', ownerUserId: run.ownerUserId,
    reportId: summary.reportId, openingHash: summary.openingHash, courseVersion: summary.courseVersion,
    runtimeVersion: run.runtimeVersion, modelVersion: run.modelVersion, ...(chunk ? { chunk } : {}) };
  await prisma.$executeRaw`INSERT INTO "SimulationEvidenceObject"
    ("id", "runId", "purpose", "reference", "checksum", "uncompressedBytes", "storedBytes", "chunkIndex", "metadata")
    VALUES (${randomUUID()}, ${run.id}, ${purpose}, ${stored.uri}, ${stored.checksum},
      ${stored.uncompressedBytes ?? null}, ${stored.storedBytes ?? null}, ${chunk?.chunkIndex ?? null},
      ${JSON.stringify(metadata)}::jsonb)
    ON CONFLICT ("runId", "reference") DO NOTHING`;
}

export async function loadConfirmedVesselChunks(run: SimulationRun, references: string[]) {
  if (!references.length) return [];
  const summary = vesselRunStorageSummary(run);
  const rows = await prisma.simulationEvidenceObject.findMany({ where: {
    runId: run.id, purpose: 'chunk', reference: { in: references },
  } });
  const indexed = new Map(rows.map(row => [row.reference, row]));
  const confirmed: Array<{ metadata: VesselTraceChunkMetadata; stored: StoredChunk }> = [];
  for (const reference of references) {
    const row = indexed.get(reference);
    if (row) {
      const value = row.metadata as unknown as ObjectMetadata;
      if (value.schema !== 'act.vessel-evidence-object.v1' || value.ownerUserId !== run.ownerUserId
        || value.reportId !== summary.reportId || value.openingHash !== summary.openingHash
        || value.courseVersion !== summary.courseVersion || value.runtimeVersion !== run.runtimeVersion
        || value.modelVersion !== run.modelVersion || value.chunk?.runRef !== run.sourceRefId
        || value.chunk.schema !== 'act.vessel-trace-metadata.v1'
        || row.checksum !== reference.slice(reference.lastIndexOf(':') + 1)) {
        throw new IlabServiceError('已确认对象与本次实验版本不一致。', 409);
      }
      confirmed.push({ metadata: value.chunk, stored: { uri: reference, checksum: row.checksum,
        uncompressedBytes: row.uncompressedBytes ?? undefined, storedBytes: row.storedBytes ?? undefined } });
      continue;
    }
    // 历史暂存引用没有对象目录，仅首次使用时读取并登记边界元数据。
    const parsed = vesselTraceChunkSchema.safeParse(await readSimulationTraceChunk(reference));
    if (!parsed.success || parsed.data.runRef !== run.sourceRefId) {
      throw new IlabServiceError('暂存采样与当前运行不一致。', 409);
    }
    const metadata = describeVesselTraceChunk(parsed.data as unknown as VesselTraceChunk);
    const stored = { uri: reference, checksum: reference.slice(reference.lastIndexOf(':') + 1) };
    await confirmVesselEvidenceObject(run, stored, 'chunk', metadata);
    confirmed.push({ metadata, stored });
  }
  return confirmed;
}
