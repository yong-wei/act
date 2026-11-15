import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VesselRunEvidence } from '@/features/simulations/run-evidence';
import type { VesselExperimentDraft } from '@/features/simulations/local-evidence-store';

const storage = vi.hoisted(() => ({
  runs: new Map<string, VesselRunEvidence & { revision: number }>(),
  drafts: new Map<string, VesselExperimentDraft>(),
  saveRun: vi.fn(), saveDraft: vi.fn(), receipt: vi.fn(),
  archive: vi.fn(),
}));
vi.mock('@/features/simulations/local-evidence-store', () => ({
  readRunEvidence: async (id: string) => storage.runs.get(id),
  readRunEvidenceHeader: async (id: string) => {
    const run = storage.runs.get(id);
    return run && { ...run, traceLength: run.trace.length, nativeSampleCount: run.nativeSensorSamples.length,
      fineSampleCount: run.fineStepSamples?.length ?? 0 };
  },
  readExperimentDraft: async (scope: string) => storage.drafts.get(scope),
  saveRunEvidence: storage.saveRun, saveExperimentDraft: storage.saveDraft, saveRunUploadReceipt: storage.receipt,
  saveRunArchive: storage.archive,
  listRunEvidence: async () => [...storage.runs.values()], listFrozenStudentModels: async () => [], listModelComparisons: async () => [],
  listLocalStepAttempts: async () => [], saveFrozenStudentModel: vi.fn(), saveModelComparison: vi.fn(), saveLocalStepAttempt: vi.fn(),
}));
import { fetchCourseSessionRecovery, hydrateRecoveredCourseSession, type CourseSessionRecoveryPayload } from '@/features/simulations/course-artifact-upload';

function run(timeS: number): VesselRunEvidence {
  return { id: 'run-a', scopeKey: 'round-a', courseKey: 'cruise', courseVersion: 'course-v1',
    stepSequence: 1, parameterHash: 'parameters', initialCheckpoint: 'initial', checkpoint: `checkpoint-${timeS}`,
    createdAtMs: 1, lastTimeS: timeS, durationS: 60, stoppedAtMs: null, stopReason: null, failure: null,
    prediction: '', configuration: {} as VesselRunEvidence['configuration'], initialInput: {} as VesselRunEvidence['initialInput'],
    trace: Array.from({ length: timeS }, (_, index) => ({ timeS: index, measurements: {
      WindDirection: { quality: 'Undefined', value: 0, sampledAtS: index, arrivedAtS: index },
    } })) as VesselRunEvidence['trace'], nativeSensorSamples: [], fineStepSamples: [], changes: [] };
}

function draft(): VesselExperimentDraft {
  return { scopeKey: 'round-a', stepSequence: 1, activeRunId: 'run-a', prediction: '', explanation: '',
    durationS: 60, checkpoint: null, runConfiguration: null, completedSteps: [], updatedAtMs: 1,
    reportClientRef: 'report-a', answers: { prediction: 'local answer' } };
}

function recovery(timeS: number): CourseSessionRecoveryPayload {
  return { report: null, reportClientRef: 'report-a', runs: [{ ...run(timeS), resumable: true }],
    models: [], comparisons: [], attempts: [], ilabRun: { originId: 'origin-a', status: 2, uploadStatus: 'local-only',
      retryableUpload: false, stepDrafts: { '1': { prediction: 'cloud answer' } }, draftActiveSeq: 1,
      courseState: { reportClientRef: 'report-a', activeRunId: 'run-a' }, updatedAtMs: 2 } };
}

describe('本机与云端运行前缀对账', () => {
  beforeEach(() => {
    vi.clearAllMocks(); storage.runs.clear(); storage.drafts.clear();
    storage.saveDraft.mockImplementation(async (value: VesselExperimentDraft) => { storage.drafts.set(value.scopeKey, value); });
    storage.runs.set('run-a', { ...run(10), revision: 7 }); storage.drafts.set('round-a', draft());
  });

  it('已有本机草稿时补齐另一设备追加的运行、检查点和回执', async () => {
    const remote = recovery(20);
    remote.runs[0].uploadReceipt = { runRef: 'run-a', reportId: 'server-report', experimentKey: 'cruise:report-a',
      status: 'running', chunkCount: 4, controlCount: 20, nativeCount: 0, fineCount: 0, lastTimeS: 20,
      parameterHash: 'parameters', reportClientRef: 'report-a' };
    await hydrateRecoveredCourseSession('round-a', remote);
    expect(storage.saveRun).toHaveBeenCalledWith(expect.objectContaining({ checkpoint: 'checkpoint-20', lastTimeS: 20 }), 7);
    expect(storage.receipt).toHaveBeenCalledWith('run-a', 'report-a', remote.runs[0].uploadReceipt);
    expect(storage.drafts.get('round-a')).toMatchObject({ originId: 'origin-a', answers: { prediction: 'cloud answer' } });
  });

  it('保留本机尚未上传的领先记录与输入', async () => {
    storage.runs.set('run-a', { ...run(30), revision: 9 });
    await hydrateRecoveredCourseSession('round-a', recovery(20));
    expect(storage.saveRun).not.toHaveBeenCalled();
    expect(storage.drafts.get('round-a')).toMatchObject({ answers: { prediction: 'local answer' }, originId: 'origin-a' });
  });

  it('同水位不同恢复点明确拒绝且保留本机记录', async () => {
    const remote = recovery(10); remote.runs[0].checkpoint = 'another-branch';
    await expect(hydrateRecoveredCourseSession('round-a', remote)).rejects.toThrow('不同设备');
    expect(storage.saveRun).not.toHaveBeenCalled(); expect(storage.saveDraft).not.toHaveBeenCalled();
  });

  it('云端领先但公共采样不同，拒绝拼接分叉', async () => {
    const remote = recovery(20); remote.runs[0].trace[3].timeS = 3.1;
    await expect(hydrateRecoveredCourseSession('round-a', remote)).rejects.toThrow('不同设备');
    expect(storage.saveRun).not.toHaveBeenCalled();
  });

  it('JSON字段排序与旧未定义量测的空值投影不产生伪冲突', async () => {
    const remote = recovery(20);
    remote.runs[0].trace = remote.runs[0].trace.map((point) => ({ measurements: {
      WindDirection: { arrivedAtS: point.timeS, sampledAtS: point.timeS, value: null, quality: 'Undefined' },
    }, timeS: point.timeS })) as VesselRunEvidence['trace'];
    await hydrateRecoveredCourseSession('round-a', remote);
    expect(storage.saveRun).toHaveBeenCalledOnce();
  });

  it('轮次不一致时在任何缓存写入前拒绝', async () => {
    const remote = recovery(20); remote.reportClientRef = 'report-b';
    await expect(hydrateRecoveredCourseSession('round-a', remote)).rejects.toThrow('轮次不一致');
    expect(storage.saveRun).not.toHaveBeenCalled(); expect(storage.saveDraft).not.toHaveBeenCalled();
  });

  it('按服务端公开证据字段核对，本机额外滤波器状态继续保留在原记录', async () => {
    const local = storage.runs.get('run-a')!;
    (local.trace[0] as unknown as Record<string, unknown>).cruise = {
      allocatedMomentNm: 0, samples: 1, initialized: true, rateNotch: { input: [0, 0], output: [0, 0] },
    };
    const remote = recovery(20);
    (remote.runs[0].trace[0] as unknown as Record<string, unknown>).cruise = { samples: 1, allocatedMomentNm: 0 };
    await hydrateRecoveredCourseSession('round-a', remote);
    expect(storage.saveRun).toHaveBeenCalledOnce();
    expect(local.trace[0].cruise).toHaveProperty('initialized', true);
    remote.runs[0].trace[0].cruise!.allocatedMomentNm = 2;
    await expect(hydrateRecoveredCourseSession('round-a', remote)).rejects.toThrow('不同设备');
  });

  it('同水位保留较新的未提交草稿', async () => {
    storage.drafts.set('round-a', { ...draft(), updatedAtMs: 5 });
    await hydrateRecoveredCourseSession('round-a', recovery(10));
    expect(storage.drafts.get('round-a')?.answers).toEqual({ prediction: 'local answer' });
  });

  it('按指定轮次请求恢复并显示服务端冲突', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: '所选轮次冲突' }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(fetchCourseSessionRecovery('cruise', 'course-v1', { originId: 'origin-a', reportClientRef: 'report-a' }))
        .rejects.toThrow('所选轮次冲突');
      expect(fetchMock.mock.calls[0][0]).toContain('originId=origin-a&reportClientRef=report-a');
    } finally { vi.unstubAllGlobals(); }
  });

  it('按分块恢复领先记录，相同恢复点重进复用本机采样', async () => {
    const remote = recovery(20);
    const points = remote.runs[0].trace;
    remote.runs[0].trace = [];
    remote.runs[0].traceManifest = { chunkCount: 1, controlCount: 20, nativeCount: 0, fineCount: 0 };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ runRef: 'run-a', chunkIndex: 0,
      parameterHash: 'parameters', controlStart: 0, nativeStart: 0, points, nativeSamples: [], changes: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      await hydrateRecoveredCourseSession('round-a', remote);
      expect(fetchMock).toHaveBeenCalledWith('/api/ilab/experiment-runs/run-a?chunkIndex=0', { cache: 'no-store' });
      expect(storage.saveRun).toHaveBeenCalledWith(expect.objectContaining({ lastTimeS: 20, trace: points }), 7);
      expect(remote.runs[0].trace).toEqual([]);
      storage.runs.set('run-a', { ...run(20), revision: 8 });
      fetchMock.mockClear(); storage.saveRun.mockClear();
      await hydrateRecoveredCourseSession('round-a', remote);
      expect(fetchMock).not.toHaveBeenCalled(); expect(storage.saveRun).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });

  it('另一设备仅提交并切步时，以新提交推进当前步骤', async () => {
    const remote = recovery(10);
    remote.ilabRun!.draftActiveSeq = 2;
    remote.attempts = [{ id: 'new-attempt', scopeKey: '', stepSequence: 1, runIds: ['run-a'], studentModelIds: [],
      comparisonIds: [], answers: {}, createdAtMs: 2, status: 'pending-review', serverId: 'server-attempt' }];
    storage.drafts.set('round-a', { ...draft(), updatedAtMs: 5 });
    await hydrateRecoveredCourseSession('round-a', remote);
    expect(storage.drafts.get('round-a')?.stepSequence).toBe(2);
  });

  it('30条历史仅保存摘要，当前运行照常恢复，进入时没有历史采样请求', async () => {
    const remote = recovery(10);
    remote.archivedRuns = Array.from({ length: 30 }, (_, index) => ({ ...run(600), id: `history-${index}`,
      scopeKey: '', sampleCount: 12000, stoppedAtMs: 2, stopReason: 'duration', remoteOnly: true }));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    try {
      await hydrateRecoveredCourseSession('round-a', remote);
      expect(storage.archive).toHaveBeenCalledTimes(30);
      expect(storage.archive).toHaveBeenCalledWith(expect.objectContaining({ id: 'history-0', scopeKey: 'round-a', remoteOnly: true }));
      expect(fetchMock).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });

  it('本机旧运行已在另一设备结束并归档时仍先对账，保留新检查点', async () => {
    const remote = recovery(20);
    const updated = { ...remote.runs[0], stoppedAtMs: 2, stopReason: 'duration' as const };
    remote.runs = [];
    remote.archivedRuns = [{ ...updated, sampleCount: 20, remoteOnly: true,
      uploadReceipt: { runRef: 'run-a', reportId: 'server-report', experimentKey: 'cruise:report-a',
        status: 'completed', chunkCount: 1, controlCount: 20, nativeCount: 0, fineCount: 0,
        lastTimeS: 20, parameterHash: 'parameters', reportClientRef: 'report-a' } }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => updated }));
    try {
      await hydrateRecoveredCourseSession('round-a', remote);
      expect(storage.saveRun).toHaveBeenCalledWith(expect.objectContaining({ checkpoint: 'checkpoint-20', stoppedAtMs: 2 }), 7);
    } finally { vi.unstubAllGlobals(); }
  });
});
