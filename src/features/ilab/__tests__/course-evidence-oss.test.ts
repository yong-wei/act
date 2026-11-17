import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { authorizeSimulationOssUpload, authorizeSimulationOssDownload, confirmSimulationOssUpload } from '@/features/ilab/adapters/oss-object-store';
import { simulationOssReference } from '@/features/simulations/public-api';
import { authorizeOwnedVesselUploads, commitOwnedVesselUpload, authorizeOwnedVesselDownloads } from '../adapters/course-evidence-oss';
import { closeDirectVesselEvidenceRun } from '../course-evidence-chunks';
import { findOwnedVesselRun } from '../course-evidence-service';
import type { VesselEvidenceOssObject } from '../course-evidence-contract';

vi.mock('@/lib/prisma', () => ({ prisma: {
  simulationEvidenceObject: { findMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
  virtualSimulationReport: { findUnique: vi.fn() },
} }));
vi.mock('@/features/ilab/adapters/oss-object-store', () => ({
  simulationEvidenceDirectUploadEnabled: () => true,
  authorizeSimulationOssUpload: vi.fn(), authorizeSimulationOssDownload: vi.fn(), confirmSimulationOssUpload: vi.fn(),
}));
vi.mock('../course-evidence-chunks', () => ({ closeDirectVesselEvidenceRun: vi.fn() }));
vi.mock('../course-evidence-service', () => ({ findOwnedVesselRun: vi.fn(),
  vesselRunStorageSummary: (run: { summary: unknown }) => run.summary,
}));

const runRef = '00000000-0000-4000-8000-000000000001';
const reference = simulationOssReference(runRef, 'checkpoint', 0, 'a'.repeat(64));
const close = { endTimeS: 0, controlCount: 0, nativeCount: 0, reason: 'checkpoint' as const, failure: null,
  baseCheckpointReference: `simulation-cas:file:sha256:${'0'.repeat(64)}`,
  pendingChunks: [], checkpointPreview: { schema: 'act.vessel-checkpoint-preview.v1' as const,
    recoverable: true as const, parameterHash: 'p', timeS: 0, controllerTicks: 0, fineCount: 0,
    appliedFinalInput: {}, metrics: {} } };
const descriptor: VesselEvidenceOssObject = { reference, purpose: 'checkpoint', storedBytes: 100, uncompressedBytes: 200, close };
const receipt = { etag: 'opaque-etag', crc64: '123456', storedBytes: 100 };
let run: Record<string, unknown>;
type ObjectRow = { id: string; runId: string; reference: string; purpose: string; checksum: string;
  storedBytes: number; uncompressedBytes: number; chunkIndex: number | null; metadata: unknown };
const rows = new Map<string, ObjectRow>();

beforeEach(() => {
  vi.resetAllMocks();
  rows.clear();
  run = { id: 'run', ownerUserId: 'owner', sourceRefId: runRef, status: 'running', runtimeVersion: 'runtime', modelVersion: 'model',
    summary: { reportId: 'report', courseVersion: 'course', parameterHash: 'p', openingHash: '0'.repeat(64) } };
  vi.mocked(findOwnedVesselRun).mockResolvedValue(run as never);
  vi.mocked(prisma.virtualSimulationReport.findUnique).mockResolvedValue({ userId: 'owner', status: 'draft' } as never);
  vi.mocked(prisma.simulationEvidenceObject.findMany).mockImplementation((async ({ where }: {
    where: { runId: string; reference: { in: string[] }; purpose?: { in: string[] } };
  }) => [...rows.values()].filter(row =>
    row.runId === where.runId && where.reference.in.includes(row.reference)
    && (!where.purpose || where.purpose.in.includes(row.purpose)))) as never);
  vi.mocked(prisma.simulationEvidenceObject.createMany).mockImplementation((async ({ data }: { data: Omit<ObjectRow, 'id'>[] }) => {
    for (const item of data) if (!rows.has(item.reference)) rows.set(item.reference,
      structuredClone({ ...item, id: `object-${rows.size}` }));
    return { count: data.length };
  }) as never);
  vi.mocked(prisma.simulationEvidenceObject.updateMany).mockImplementation((async ({ where, data }: {
    where: { id: string; purpose: string }; data: Partial<ObjectRow>;
  }) => {
    const row = [...rows.values()].find(row => row.id === where.id && row.purpose === where.purpose);
    if (!row) return { count: 0 };
    Object.assign(row, structuredClone(data));
    return { count: 1 };
  }) as never);
  vi.mocked(authorizeSimulationOssUpload).mockImplementation(async ref => ({ reference: ref,
    url: 'https://private.example', fields: {}, expiresAt: '2026-11-18T00:05:00Z' }));
  vi.mocked(confirmSimulationOssUpload).mockResolvedValue(receipt);
  vi.mocked(closeDirectVesselEvidenceRun).mockResolvedValue({ status: 'running', saveStatus: 'saved' } as never);
  vi.mocked(authorizeSimulationOssDownload).mockImplementation(async ref => ({ reference: ref,
    url: 'https://private.example/temporary', expiresAt: '2026-11-18T00:05:00Z' }));
});

describe('本人实验OSS上传、确认与下载', () => {
  it('不同gzip长度共享正文哈希，分别登记并拒绝引用长度与描述不一致', async () => {
    const first = { ...descriptor, reference: simulationOssReference(runRef, 'checkpoint', 0, 'a'.repeat(64), 100) };
    const second = { ...descriptor, reference: simulationOssReference(runRef, 'checkpoint', 0, 'a'.repeat(64), 120), storedBytes: 120 };
    await authorizeOwnedVesselUploads('owner', runRef, [first]);
    await authorizeOwnedVesselUploads('owner', runRef, [second]);
    expect(rows.size).toBe(2);
    await expect(authorizeOwnedVesselUploads('owner', runRef, [{ ...first, storedBytes: 101 }]))
      .rejects.toMatchObject({ status: 409 });
  });

  it('重复签发复用同一意向，精确对象描述变化时拒绝', async () => {
    await authorizeOwnedVesselUploads('owner', runRef, [descriptor]);
    await authorizeOwnedVesselUploads('owner', runRef, [descriptor]);
    expect(rows.size).toBe(1);
    expect(prisma.simulationEvidenceObject.createMany).toHaveBeenCalledOnce();
    expect(authorizeSimulationOssUpload).toHaveBeenCalledWith(reference, 100, expect.stringMatching(/^[0-9a-f]{64}$/));
    await expect(authorizeOwnedVesselUploads('owner', runRef, [{ ...descriptor, storedBytes: 101 }]))
      .rejects.toMatchObject({ status: 409 });
  });

  it('回执丢失后重复确认复用OSS回执，并只向保存事务传递元数据', async () => {
    await authorizeOwnedVesselUploads('owner', runRef, [descriptor]);
    await commitOwnedVesselUpload('owner', runRef, { ...close, checkpointReference: reference });
    await commitOwnedVesselUpload('owner', runRef, { ...close, checkpointReference: reference });
    expect(confirmSimulationOssUpload).toHaveBeenCalledOnce();
    expect(rows.get(reference)).toMatchObject({ purpose: 'checkpoint', metadata: { upload: { receipt } } });
    expect(closeDirectVesselEvidenceRun).toHaveBeenCalledWith('owner', runRef, close,
      { uri: reference, checksum: 'a'.repeat(64), storedBytes: 100, uncompressedBytes: 200 });
    expect((await authorizeOwnedVesselUploads('owner', runRef, [descriptor])).objects)
      .toEqual([{ reference, confirmed: true }]);
  });

  it('迟到的对象确认失败保留并发成功回执，随后可直接重试保存', async () => {
    await authorizeOwnedVesselUploads('owner', runRef, [descriptor]);
    let rejectFirst!: (error: Error) => void;
    vi.mocked(confirmSimulationOssUpload).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }));
    const first = commitOwnedVesselUpload('owner', runRef, { ...close, checkpointReference: reference }).catch(error => error);
    await vi.waitFor(() => expect(confirmSimulationOssUpload).toHaveBeenCalledOnce());
    await commitOwnedVesselUpload('owner', runRef, { ...close, checkpointReference: reference });
    rejectFirst(new Error('late network failure'));
    expect(await first).toBeInstanceOf(Error);
    expect(rows.get(reference)).toMatchObject({ purpose: 'checkpoint', metadata: { upload: { receipt } } });
    await commitOwnedVesselUpload('owner', runRef, { ...close, checkpointReference: reference });
    expect(confirmSimulationOssUpload).toHaveBeenCalledTimes(2);
  });

  it('对象未上传或保存描述不同均不能提交进度', async () => {
    await authorizeOwnedVesselUploads('owner', runRef, [descriptor]);
    vi.mocked(confirmSimulationOssUpload).mockRejectedValueOnce(new Error('missing object'));
    await expect(commitOwnedVesselUpload('owner', runRef, { ...close, checkpointReference: reference })).rejects.toThrow('missing');
    expect(closeDirectVesselEvidenceRun).not.toHaveBeenCalled();
    await expect(commitOwnedVesselUpload('owner', runRef, { ...close, failure: 'changed', checkpointReference: reference }))
      .rejects.toMatchObject({ status: 409 });
    expect(closeDirectVesselEvidenceRun).not.toHaveBeenCalled();
  });

  it('异主、异轮次、异运行及已提交报告不能获得新上传或下载授权', async () => {
    await authorizeOwnedVesselUploads('owner', runRef, [descriptor]);
    run.summary = { ...run.summary as object, reportId: 'another-round' };
    await expect(authorizeOwnedVesselUploads('owner', runRef, [descriptor])).rejects.toMatchObject({ status: 409 });
    await expect(authorizeOwnedVesselDownloads('owner', runRef, [reference])).rejects.toMatchObject({ status: 404 });
    vi.mocked(findOwnedVesselRun).mockRejectedValueOnce({ status: 404 });
    await expect(authorizeOwnedVesselDownloads('other', runRef, [reference])).rejects.toMatchObject({ status: 404 });
    const other = simulationOssReference('00000000-0000-4000-8000-000000000002', 'checkpoint', 0, 'a'.repeat(64));
    await expect(authorizeOwnedVesselUploads('owner', runRef, [{ ...descriptor, reference: other }])).rejects.toMatchObject({ status: 409 });
    vi.mocked(prisma.virtualSimulationReport.findUnique).mockResolvedValue({ userId: 'owner', status: 'submitted' } as never);
    await expect(authorizeOwnedVesselUploads('owner', runRef, [{ ...descriptor,
      reference: simulationOssReference(runRef, 'checkpoint', 0, 'b'.repeat(64)) }])).rejects.toMatchObject({ status: 409 });
    expect(authorizeSimulationOssDownload).not.toHaveBeenCalled();
  });

  it('本人已确认的对象可取得短期下载授权，确认之前保持拒绝', async () => {
    await authorizeOwnedVesselUploads('owner', runRef, [descriptor]);
    await expect(authorizeOwnedVesselDownloads('owner', runRef, [reference])).rejects.toMatchObject({ status: 404 });
    await commitOwnedVesselUpload('owner', runRef, { ...close, checkpointReference: reference });
    const result = await authorizeOwnedVesselDownloads('owner', runRef, [reference]);
    expect(result.objects[0]).toMatchObject({ reference, storedBytes: 100, uncompressedBytes: 200 });
    expect(authorizeSimulationOssDownload).toHaveBeenCalledExactlyOnceWith(reference, undefined);
  });
});
