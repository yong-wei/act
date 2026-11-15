import type { VesselCourseKey } from '@/resources/simulations/experiments/course-catalog';
import { VESSEL_COURSE_VERSION } from '@/resources/simulations/experiments/destroyer-course';
import type { VesselReportSections } from '@/features/ilab/course-artifact-contract';
import type { FrozenVesselStudentModel, VesselModelComparison } from '@/resources/simulations/experiments/student-analysis';
import { requestVesselEvidence, uploadVesselRunEvidence, type VesselEvidenceProgress } from './evidence-upload';
import {
  listRunEvidence, readRunEvidence, readRunEvidenceHeader, saveRunEvidence, readExperimentDraft, saveExperimentDraft,
  type VesselExperimentDraft,
  listFrozenStudentModels, listModelComparisons, listLocalStepAttempts,
  saveFrozenStudentModel, saveModelComparison, saveLocalStepAttempt, saveRunUploadReceipt,
} from './local-evidence-store';
import type { VesselLocalStepAttempt, VesselRunEvidence } from './run-evidence';

export interface CourseRecoveredRun extends VesselRunEvidence {
  uploadReceipt?: VesselEvidenceProgress & { reportClientRef: string };
  resumable?: boolean;
  traceManifest?: Pick<VesselEvidenceProgress, 'chunkCount' | 'controlCount' | 'nativeCount' | 'fineCount'>;
}

export interface CourseSessionRecoveryPayload {
  report: VesselReportProgress | null;
  reportClientRef: string | null;
  runs: CourseRecoveredRun[];
  models: FrozenVesselStudentModel[];
  comparisons: VesselModelComparison[];
  attempts: VesselLocalStepAttempt[];
  ilabRun: {
    originId: string;
    status: number;
    uploadStatus: string;
    retryableUpload: boolean;
    stepDrafts: Record<string, Record<string, string>>;
    draftActiveSeq?: number;
    courseState?: Record<string, unknown>;
    updatedAtMs: number;
  } | null;
}

export async function fetchCourseSessionRecovery(
  courseKey: VesselCourseKey,
  courseVersion?: string,
  round?: { originId?: string; reportClientRef?: string },
): Promise<{ authenticated: boolean; userId: string | null; recovery: CourseSessionRecoveryPayload | null }> {
  const params = new URLSearchParams({ courseKey });
  if (courseVersion) params.set('courseVersion', courseVersion);
  if (round?.originId) params.set('originId', round.originId);
  if (round?.reportClientRef) params.set('reportClientRef', round.reportClientRef);
  const response = await fetch(`/api/ilab/course-session-recovery?${params.toString()}`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    const payload = await response.json() as { error?: string };
    throw new Error(payload.error ?? '云端进度暂时无法读取，请稍后重试。');
  }
  return response.json() as Promise<{ authenticated: boolean; userId: string | null; recovery: CourseSessionRecoveryPayload | null }>;
}

function recoveredSampleMatches(local: unknown, remote: unknown): boolean {
  if (local === remote) return true;
  if (Array.isArray(remote)) return Array.isArray(local) && local.length === remote.length
    && remote.every((item, index) => recoveredSampleMatches(local[index], item));
  if (!remote || typeof remote !== 'object' || !local || typeof local !== 'object') return false;
  const saved = remote as Record<string, unknown>;
  const original = local as Record<string, unknown>;
  // 服务端只持久化公开证据合同字段，本机诊断还可能携带滤波器内部状态。
  return Object.entries(saved).every(([key, value]) => key === 'value' && saved.quality === 'Undefined'
    ? original.quality === 'Undefined' : recoveredSampleMatches(original[key], value));
}

function recoveryConflict(): never {
  throw new Error('这次运行在不同设备上产生了不同的记录。本机记录已保留，请选择原实验轮次或新建一轮实验。');
}

function assertRecoveryIdentity(local: Pick<VesselRunEvidence, 'scopeKey' | 'parameterHash' | 'initialCheckpoint' | 'stepSequence' | 'courseKey' | 'courseVersion'>,
  remote: VesselRunEvidence, scopeKey: string) {
  if (local.scopeKey !== scopeKey || local.parameterHash !== remote.parameterHash
    || local.initialCheckpoint !== remote.initialCheckpoint || local.stepSequence !== remote.stepSequence
    || local.courseKey !== remote.courseKey || local.courseVersion !== remote.courseVersion) recoveryConflict();
}

function assertRecoveryPrefix(local: VesselRunEvidence, remote: VesselRunEvidence, scopeKey: string) {
  assertRecoveryIdentity(local, remote, scopeKey);
  for (const [left, right] of [[local.trace, remote.trace], [local.nativeSensorSamples, remote.nativeSensorSamples],
    [local.fineStepSamples ?? [], remote.fineStepSamples ?? []]]) {
    for (let index = 0; index < Math.min(left.length, right.length); index++) {
      if (!recoveredSampleMatches(left[index], right[index])) recoveryConflict();
    }
  }
  const counts = (run: VesselRunEvidence) => [run.lastTimeS, run.trace.length, run.nativeSensorSamples.length, run.fineStepSamples?.length ?? 0];
  const localCounts = counts(local);
  const remoteCounts = counts(remote);
  const localAhead = localCounts.some((count, index) => count > remoteCounts[index]);
  const remoteAhead = remoteCounts.some((count, index) => count > localCounts[index]);
  if ((localAhead && remoteAhead) || (!localAhead && !remoteAhead && local.checkpoint !== remote.checkpoint)
    || (localAhead && remote.stoppedAtMs !== null) || (remoteAhead && local.stoppedAtMs !== null)) recoveryConflict();
  return { localAhead, remoteAhead };
}

async function readRecoveredRunChunks(recovered: CourseRecoveredRun): Promise<CourseRecoveredRun> {
  const { traceManifest, ...metadata } = recovered;
  if (!traceManifest) return metadata;
  const run = { ...metadata, trace: [] as VesselRunEvidence['trace'], nativeSensorSamples: [] as VesselRunEvidence['nativeSensorSamples'],
    fineStepSamples: [] as NonNullable<VesselRunEvidence['fineStepSamples']>, changes: [] as VesselRunEvidence['changes'] };
  for (let first = 0; first < traceManifest.chunkCount; first += 4) {
    const chunks = await Promise.all(Array.from({ length: Math.min(4, traceManifest.chunkCount - first) }, async (_, offset) => {
      const response = await fetch(`/api/ilab/experiment-runs/${encodeURIComponent(run.id)}?chunkIndex=${first + offset}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('实验采样暂时无法恢复，本机记录已保留，请稍后重试。');
      return response.json() as Promise<Pick<VesselEvidenceProgress, 'runRef' | 'parameterHash'> & {
        chunkIndex: number; controlStart: number; nativeStart: number; fineStart?: number;
        points: VesselRunEvidence['trace']; nativeSamples: VesselRunEvidence['nativeSensorSamples'];
        fineSamples?: VesselRunEvidence['fineStepSamples']; changes: VesselRunEvidence['changes'];
      }>;
    }));
    for (const [offset, chunk] of chunks.entries()) {
      if (chunk.runRef !== run.id || chunk.chunkIndex !== first + offset || chunk.parameterHash !== run.parameterHash
        || chunk.controlStart !== run.trace.length || chunk.nativeStart !== run.nativeSensorSamples.length
        || (chunk.fineStart ?? 0) !== (run.fineStepSamples?.length ?? 0)) recoveryConflict();
      run.trace.push(...chunk.points);
      run.nativeSensorSamples.push(...chunk.nativeSamples);
      run.fineStepSamples ??= [];
      run.fineStepSamples.push(...(chunk.fineSamples ?? []));
      run.changes.push(...chunk.changes);
    }
  }
  if (run.trace.length !== traceManifest.controlCount || run.nativeSensorSamples.length !== traceManifest.nativeCount
    || (run.fineStepSamples?.length ?? 0) !== (traceManifest.fineCount ?? 0)) recoveryConflict();
  return run;
}

/** 将服务端恢复的运行证据、辨识模型、对照、步骤尝试及草稿写入当前 scopeKey 的 IndexedDB 缓存。 */
export async function hydrateRecoveredCourseSession(
  scopeKey: string,
  recovery: CourseSessionRecoveryPayload,
): Promise<{ hydratedCount: number }> {
  let hydratedCount = 0;
  const localDraft = await readExperimentDraft(scopeKey);
  if (localDraft?.reportClientRef && recovery.reportClientRef && localDraft.reportClientRef !== recovery.reportClientRef) {
    throw new Error('本机草稿与云端实验的轮次不一致，请重新选择该轮实验。');
  }
  const recoveredIds = new Set(recovery.runs.map((run) => run.id));
  let hasLocalAdvance = (await listRunEvidence(scopeKey)).some((run) => !recoveredIds.has(run.id));
  let hasRemoteAdvance = false;
  // 按运行逐一恢复，已有相同恢复点仅同步回执，避免读取整份实验的全部采样。
  for (const header of recovery.runs) {
    const stored = header.traceManifest ? await readRunEvidenceHeader(header.id) : undefined;
    if (header.resumable === false) { hasLocalAdvance ||= Boolean(stored); continue; }
    if (stored && header.traceManifest) {
      assertRecoveryIdentity(stored, header, scopeKey);
      if (stored.lastTimeS === header.lastTimeS && stored.traceLength === header.traceManifest.controlCount
        && stored.nativeSampleCount === header.traceManifest.nativeCount
        && (stored.fineSampleCount ?? 0) === (header.traceManifest.fineCount ?? 0)) {
        if (stored.checkpoint !== header.checkpoint) recoveryConflict();
        const pendingLocalStop = stored.stoppedAtMs !== null && header.stoppedAtMs === null;
        const endingMatches = (stored.stoppedAtMs === null) === (header.stoppedAtMs === null)
          && stored.stopReason === header.stopReason && stored.failure === header.failure && stored.durationS === header.durationS;
        hasLocalAdvance ||= pendingLocalStop;
        if (pendingLocalStop || endingMatches) {
          if (header.uploadReceipt) await saveRunUploadReceipt(header.id, header.uploadReceipt.reportClientRef, header.uploadReceipt);
          continue;
        }
      }
    }
    const recovered = await readRecoveredRunChunks(header);
    const existing = await readRunEvidence(recovered.id);
    const progress = existing ? assertRecoveryPrefix(existing, recovered, scopeKey) : { localAhead: false, remoteAhead: true };
    hasLocalAdvance ||= progress.localAhead;
    hasRemoteAdvance ||= progress.remoteAhead;
    if (!progress.localAhead) {
      const { uploadReceipt, resumable: _resumable, ...rawEvidence } = recovered;
      const pendingLocalStop = existing && existing.stoppedAtMs !== null && recovered.stoppedAtMs === null ? existing : {};
      await saveRunEvidence({ ...rawEvidence, ...pendingLocalStop, scopeKey }, existing?.revision ?? 0);
      if (uploadReceipt) {
        await saveRunUploadReceipt(recovered.id, uploadReceipt.reportClientRef, uploadReceipt);
      }
      hydratedCount += 1;
    }
  }

  const existingModels = new Set((await listFrozenStudentModels(scopeKey)).map((item) => item.id));
  for (const model of recovery.models) {
    if (!existingModels.has(model.id)) {
      await saveFrozenStudentModel({ ...model, scopeKey });
      hydratedCount += 1;
    }
  }

  const existingComparisons = new Set((await listModelComparisons(scopeKey)).map((item) => item.id));
  for (const comparison of recovery.comparisons) {
    if (!existingComparisons.has(comparison.id)) {
      await saveModelComparison({ ...comparison, scopeKey });
      hydratedCount += 1;
    }
  }

  const existingAttempts = new Set((await listLocalStepAttempts(scopeKey)).map((item) => item.id));
  for (const attempt of recovery.attempts) {
    if (!existingAttempts.has(attempt.id)) {
      await saveLocalStepAttempt({ ...attempt, scopeKey });
      hasRemoteAdvance = true;
      hydratedCount += 1;
    }
  }

  const doneSeqs = Array.from(new Set(recovery.attempts.filter((item) => item.status === 'pending-review').map((item) => item.stepSequence)));
  const draftStep = recovery.ilabRun?.draftActiveSeq ?? Math.min(20, Math.max(1, (doneSeqs.length ? Math.max(...doneSeqs) + 1 : 1)));
  if (recovery.reportClientRef || recovery.ilabRun) {
    const draftAnswers = recovery.ilabRun?.stepDrafts[String(draftStep)] ?? {};
    const courseState = recovery.ilabRun?.courseState as Partial<VesselExperimentDraft> | undefined;
    const stepRuns = recovery.runs.filter((run) => run.stepSequence === draftStep && run.resumable !== false);
    const savedRun = stepRuns.find((run) => run.id === courseState?.activeRunId)
      ?? stepRuns.filter((run) => run.stoppedAtMs === null).at(-1);
    const preserveLocalDraft = localDraft && (hasLocalAdvance
      || (!hasRemoteAdvance && localDraft.updatedAtMs > (recovery.ilabRun?.updatedAtMs ?? 0)));
    await saveExperimentDraft({
      scopeKey,
      stepSequence: draftStep,
      activeRunId: savedRun?.id ?? null,
      prediction: draftAnswers.prediction ?? '',
      explanation: draftAnswers.explanation ?? '',
      durationS: savedRun?.durationS ?? 0,
      checkpoint: null,
      runConfiguration: savedRun?.configuration ?? null,
      completedSteps: doneSeqs,
      updatedAtMs: recovery.ilabRun?.updatedAtMs ?? Date.now(),
      answers: draftAnswers,
      reportClientRef: recovery.reportClientRef ?? (typeof courseState?.reportClientRef === 'string' ? courseState.reportClientRef : undefined),
      plannedRunId: typeof courseState?.plannedRunId === 'string' ? courseState.plannedRunId : savedRun?.id,
      reportRunIds: Array.isArray(courseState?.reportRunIds) ? courseState.reportRunIds : [],
      courseSettings: courseState?.courseSettings ?? savedRun?.courseSettings,
      designStudentModelId: courseState?.designStudentModelId ?? savedRun?.designStudentModelId,
      controls: courseState?.controls,
      ...(preserveLocalDraft ? localDraft : {}),
      originId: recovery.ilabRun?.originId ?? localDraft?.originId,
    });
  }

  return { hydratedCount };
}

export async function triggerCourseReportIlabUpload(
  reportId: string,
  originId?: string | null,
): Promise<{
  uploaded: boolean;
  retryableUpload: boolean;
  uploadMode: 'local-only' | 'dev-bypass' | 'ilab-remote';
  originId: string | null;
  message: string;
}> {
  const response = await fetch(`/api/ilab/experiment-reports/${encodeURIComponent(reportId)}/ilab-upload`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...(originId ? { originId } : {}) }),
  });
  const payload = await response.json() as {
    uploaded?: boolean;
    retryableUpload?: boolean;
    uploadMode?: 'local-only' | 'dev-bypass' | 'ilab-remote';
    originId?: string | null;
    message?: string;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error ?? '同步实验空间报告失败。');
  }
  return {
    uploaded: Boolean(payload.uploaded),
    retryableUpload: Boolean(payload.retryableUpload),
    uploadMode: payload.uploadMode ?? 'local-only',
    originId: payload.originId ?? null,
    message: payload.message ?? '实验报告已保存。',
  };
}

export interface VesselReportProgress {
  id:string;
  clientRef:string;
  status:string;
  revision:number;
  score:number | null;
  maxScore:number;
  teacherFeedback:string | null;
  sections:VesselReportSections;
  hasReportHtml?:boolean;
  reviewProgress?:{earned:number;complete:boolean;finalScore:number|null}|null;
}

export async function uploadVesselCourseRun(reportClientRef:string,run:VesselRunEvidence) {
  const receipt = await uploadVesselRunEvidence(reportClientRef,run);
  await saveRunUploadReceipt(run.id,reportClientRef,receipt);
  return receipt;
}

/** 模型和对照按本人引用顺序上传，回执保存后重试沿用同一工件标识。 */
export async function uploadVesselCourseArtifacts(reportClientRef: string, courseKey: VesselCourseKey, scopeKey: string) {
  const context = {reportClientRef,courseKey,courseVersion:VESSEL_COURSE_VERSION};
  const uploadedRunIds = new Set<string>();
  let pendingCount = 0;
  for (const summary of await listRunEvidence(scopeKey)) {
    if (summary.uploadedToReportRef === reportClientRef) {uploadedRunIds.add(summary.id);continue;}
    const run = await readRunEvidence(summary.id);
    if (run) {await uploadVesselCourseRun(reportClientRef,run);uploadedRunIds.add(run.id);}
  }
  const models = await listFrozenStudentModels(scopeKey);
  const uploadedModelIds = new Set<string>();
  for (const model of models) {
    if (model.serverId) {uploadedModelIds.add(model.id);continue;}
    if (model.payload.trainingRuns.some((window) => !uploadedRunIds.has(window.runRef))) {pendingCount++;continue;}
    const receipt = await requestVesselEvidence<{id:string;contentHash:string}>('/api/ilab/experiment-reports', {
      ...context,model:{clientRef:model.id,payload:{...model.payload,
        operatingPoint:{...model.payload.operatingPoint,clientFrozenAtMs:model.createdAtMs}}},
    });
    await saveFrozenStudentModel({...model,serverId:receipt.id,contentHash:receipt.contentHash});
    uploadedModelIds.add(model.id);
  }
  const uploadedComparisonIds = new Set<string>();
  for (const comparison of await listModelComparisons(scopeKey)) {
    if (comparison.serverId) {uploadedComparisonIds.add(comparison.id);continue;}
    if (!uploadedRunIds.has(comparison.runId) || !uploadedModelIds.has(comparison.modelId)
      || (comparison.actuatorModelId && !uploadedModelIds.has(comparison.actuatorModelId))) {pendingCount++;continue;}
    const receipt = await requestVesselEvidence<{id:string}>('/api/ilab/experiment-reports', {
      ...context, comparison:{clientRef:comparison.id,modelClientRef:comparison.modelId,
        actuatorModelClientRef:comparison.actuatorModelId,runRef:comparison.runId,mode:comparison.mode,
        startS:comparison.startS,endS:comparison.endS,timeS:comparison.timeS,actual:comparison.actual,
        predicted:comparison.predicted,measuredInput:comparison.measuredInput,predictedInput:comparison.predictedInput,
        metrics:comparison.metrics,purpose:comparison.purpose ?? 'validation',controllerInput:comparison.controllerInput,
        outputUnit:comparison.outputUnit,outputChannel:comparison.outputChannel,
        actualHeadingDeg:comparison.actualHeadingDeg,predictedHeadingDeg:comparison.predictedHeadingDeg,
        actualEastM:comparison.actualEastM,predictedEastM:comparison.predictedEastM,
        actualBowClearanceM:comparison.actualBowClearanceM,predictedBowClearanceM:comparison.predictedBowClearanceM,
        createdAtMs:comparison.createdAtMs},
    });
    await saveModelComparison({...comparison,serverId:receipt.id});
    uploadedComparisonIds.add(comparison.id);
  }
  for (const attempt of await listLocalStepAttempts(scopeKey)) {
    if (attempt.serverId) continue;
    if (attempt.runIds.some((id) => !uploadedRunIds.has(id))
      || attempt.studentModelIds.some((id) => !uploadedModelIds.has(id))
      || attempt.comparisonIds.some((id) => !uploadedComparisonIds.has(id))) {pendingCount++;continue;}
    const receipt = await requestVesselEvidence<{id:string;status:'submitted'|VesselLocalStepAttempt['status'];validationFeedback:string|null}>('/api/ilab/experiment-reports', {
      ...context, attempt:{clientRef:attempt.id,stepSequence:attempt.stepSequence,runRefs:attempt.runIds,
        modelClientRefs:attempt.studentModelIds,comparisonClientRefs:attempt.comparisonIds,answers:attempt.answers,
        validationFeedback:attempt.validationFeedback ?? null,outcome:attempt.status === 'pending-review' ? 'submitted' : attempt.status},
    });
    await saveLocalStepAttempt({...attempt,serverId:receipt.id,
      status:receipt.status === 'submitted' ? 'pending-review' : receipt.status,validationFeedback:receipt.validationFeedback});
  }
  return {pendingCount};
}

export async function saveVesselCourseReport(reportClientRef: string, courseKey: VesselCourseKey,
  sections:VesselReportSections, runRefs:string[], action:'save'|'submit', expectedRevision?:number) {
  const result = await requestVesselEvidence<{report:VesselReportProgress}>('/api/ilab/experiment-reports', {
    reportClientRef,courseKey,courseVersion:VESSEL_COURSE_VERSION,report:{sections,runRefs,action,expectedRevision},
  });
  return result.report;
}
