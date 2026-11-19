import { prisma } from '@/lib/prisma';
import { listQueuedCourseAttempts } from './course-verification-queue';
import { readSimulationTraceChunk } from '@/lib/data-governance/simulation-trace-cas';
import type { VesselObservedSample, VesselSessionInput } from '@/lib/control-engine/vessel-session';
import type {
  CourseRecoveredRun,
  CourseSessionRecoveryPayload,
  VesselReportProgress,
  VesselRunArchive,
} from '@/features/simulations/course-artifact-upload';
import { recoveryTraceReference, type CourseRunRecovery } from '@/features/simulations/public-api';
import type { VesselReportSections } from '@/features/ilab/course-artifact-contract';
import type { VesselLocalStepAttempt, VesselRunEvidence, VesselTracePoint } from '@/features/simulations/run-evidence';
import { findVesselCourse, type VesselCourseKey } from '@/resources/simulations/experiments/course-catalog';
import { VESSEL_COURSE_VERSION } from '@/resources/simulations/experiments/destroyer-course';
import type {
  FrozenVesselStudentModel,
  IdentificationChannel,
  VesselModelComparison,
} from '@/resources/simulations/experiments/student-analysis';

import { vesselExperimentKey, vesselReportView } from '../course-artifact-service';
import type { VesselEvidenceOpening, VesselTraceChunk } from '../course-evidence-contract';
import { VESSEL_EVIDENCE_DOMAIN, findOwnedVesselRun, vesselRunStorageSummary, vesselRunProgress } from '../course-evidence-service';
import { parseStepDrafts, resolveIlabUploadMode } from './ilab-session-lifecycle';
import { IlabServiceError } from '../run-lock';

const VESSEL_ID_BY_COURSE_KEY: Record<VesselCourseKey, string> = {
  destroyer: 'destroyer-055',
  lng: 'fleet-lng-changheng',
  container: 'fleet-container-msc',
  cruise: 'fleet-cruise-adora',
  drilling: 'fleet-drill-hysy981',
  icebreaker: 'fleet-icebreaker-xuelong',
  dredger: 'fleet-dredger-tianjing',
};

const RECOVERY_STATE_BATCH_SIZE = 4;
type RecoveryCheckpoint = {
  checkpoint?: string;
  reason?: VesselRunEvidence['stopReason'] | 'checkpoint';
  failure?: string | null;
  durationS?: number;
  endTimeS?: number;
  controlCount?: number;
  nativeCount?: number;
  fineCount?: number;
  appliedFinalInput?: VesselSessionInput;
};

function inferModelChannel(lineageKey: string, outputChannel: string, inputChannel: string): IdentificationChannel | 'dp-low-frequency' {
  if (inputChannel === 'WinchReferenceDifferential') return 'winch-reference-to-sway';
  if (inputChannel === 'WinchSpeedDifferential') return 'winch-speed-to-sway';
  if (inputChannel === 'EquivalentAzimuth') return 'azimuth-to-yaw';
  if (outputChannel === 'EquivalentAzimuth') return 'azimuth-servo';
  if (inputChannel === 'EstimatedTauBody3') return 'dp-low-frequency';
  if (outputChannel === 'EstimatedRoll') return 'fin-to-roll';
  if (inputChannel === 'ShaftReference0') return 'shaft-reference-to-speed';
  if (lineageKey.includes('servo') || outputChannel.includes('rudder') || outputChannel.includes('surface')) {
    return 'rudder-servo';
  }
  if (lineageKey.includes('speed') || outputChannel.includes('speed')) {
    return 'shaft-to-speed';
  }
  return 'rudder-to-yaw';
}

function parseStepSeqFromKey(stepKey: string): number {
  const match = /-step-(\d+)$/.exec(stepKey);
  if (!match) return 1;
  const seq = Number(match[1]);
  return Number.isInteger(seq) && seq >= 1 && seq <= 20 ? seq : 1;
}

async function safeReadCas<T>(uri: string | null | undefined): Promise<T | null> {
  if (!uri) return null;
  try {
    return await readSimulationTraceChunk<T>(uri);
  } catch {
    return null;
  }
}

/**
 * 为 course-v1（七船统一课程体系）从服务端数据库与 CAS 分块存储重建断点恢复负载，
 * 同时覆盖实验空间自动建号用户与本平台登录用户跨刷新/重新进入的完整状态恢复。
 */
type CourseSessionRecoveryInput = {
  userId: string;
  courseKey: VesselCourseKey;
  courseVersion?: string;
  originId?: string;
  reportClientRef?: string;
  deferTraceChunks?: boolean;
  lazyHistory?: boolean;
  onlyRunRef?: string;
  deferStateObjects?: boolean;
  supportsTraceColumns?: boolean;
  knownSave?: string;
};

export function loadCourseSessionRecovery(input: CourseSessionRecoveryInput & { deferStateObjects?: false }): Promise<CourseSessionRecoveryPayload>;
export function loadCourseSessionRecovery(input: CourseSessionRecoveryInput): Promise<CourseSessionRecoveryPayload<CourseRunRecovery>>;
export async function loadCourseSessionRecovery(input: CourseSessionRecoveryInput): Promise<CourseSessionRecoveryPayload<CourseRunRecovery>> {
  const course = findVesselCourse(input.courseKey);
  if (!course) {
    throw new Error(`未知课程实验: ${input.courseKey}`);
  }
  const courseVersion = input.courseVersion || VESSEL_COURSE_VERSION;
  const vesselId = VESSEL_ID_BY_COURSE_KEY[course.key];

  const reportWhere = { userId: input.userId, experimentKey: course.key, experimentVersion: courseVersion };
  const requestedReport = input.reportClientRef ? await prisma.virtualSimulationReport.findFirst({
    where: { ...reportWhere, clientRef: input.reportClientRef },
  }) : null;
  const ilabRunForRecovery = await prisma.ilabExperimentRun.findFirst({
    where: {
      userId: input.userId, vesselId, experimentVersion: courseVersion,
      ...(input.originId ? { originId: input.originId } : input.reportClientRef ? {
        OR: [
          ...(requestedReport ? [{ reportId: requestedReport.id }] : []),
          { reportId: null, stepDrafts: { path: ['courseState', 'reportClientRef'], equals: input.reportClientRef } },
        ],
      } : { OR: [{ status: 2 }, { uploadStatus: { in: ['failed', 'score-uploaded'] } }] }),
    },
    orderBy: [{ startTimeMs: input.reportClientRef && !input.originId ? 'asc' : 'desc' }, { id: 'desc' }],
  });
  if (input.originId && !ilabRunForRecovery) throw new IlabServiceError('实验记录不存在。', 404);

  const activeCourseState = ilabRunForRecovery ? parseStepDrafts(ilabRunForRecovery.stepDrafts).courseState : undefined;
  const linkedReport = ilabRunForRecovery?.reportId ? await prisma.virtualSimulationReport.findFirst({
    where: { ...reportWhere, id: ilabRunForRecovery.reportId },
  }) : null;
  const boundReportRef = linkedReport?.clientRef
    ?? (typeof activeCourseState?.reportClientRef === 'string' ? activeCourseState.reportClientRef : null);
  if (input.reportClientRef && boundReportRef && input.reportClientRef !== boundReportRef) {
    throw new IlabServiceError('所选实验与报告的轮次不一致，请重新读取该轮进度。', 409);
  }
  const reportClientRef = input.reportClientRef ?? boundReportRef;
  const targetReport = linkedReport ?? requestedReport ?? await prisma.virtualSimulationReport.findFirst({
    where: { ...reportWhere, clientRef: reportClientRef ?? { not: null } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  let ilabRunView: CourseSessionRecoveryPayload['ilabRun'] = null;
  if (ilabRunForRecovery) {
    const storedDrafts = parseStepDrafts(ilabRunForRecovery.stepDrafts);
    const drafts = linkedReport?.clientRef && storedDrafts.courseState?.reportClientRef
      && storedDrafts.courseState.reportClientRef !== linkedReport.clientRef
      ? { bySeq: {}, courseState: { reportClientRef: linkedReport.clientRef } } : storedDrafts;
    const mode = resolveIlabUploadMode(ilabRunForRecovery);
    ilabRunView = {
      originId: ilabRunForRecovery.originId,
      status: ilabRunForRecovery.status,
      uploadStatus: ilabRunForRecovery.uploadStatus,
      retryableUpload: mode === 'ilab-remote' && (ilabRunForRecovery.uploadStatus === 'failed' || ilabRunForRecovery.uploadStatus === 'score-uploaded'),
      stepDrafts: drafts.bySeq,
      ...(drafts.activeSeq !== undefined ? { draftActiveSeq: drafts.activeSeq } : {}),
      courseState: { ...drafts.courseState, ...(boundReportRef ? { reportClientRef: boundReportRef } : {}) },
      updatedAtMs: storedDrafts.updatedAtMs ?? ilabRunForRecovery.updatedAt.getTime(),
    };
  }

  if (!targetReport?.clientRef) {
    return {
      report: null,
      reportClientRef: reportClientRef ?? null,
      runs: [],
      models: [],
      comparisons: [],
      attempts: boundReportRef ? await listQueuedCourseAttempts(input.userId, boundReportRef, course.key) : [],
      ilabRun: ilabRunView,
    };
  }

  const experimentKey = vesselExperimentKey(targetReport);
  const rawReportView = vesselReportView(targetReport);
  const reportView: VesselReportProgress = {
    id: rawReportView.id,
    clientRef: targetReport.clientRef,
    status: rawReportView.status,
    revision: rawReportView.revision,
    score: rawReportView.score,
    maxScore: rawReportView.maxScore,
    teacherFeedback: rawReportView.teacherFeedback,
    sections: (rawReportView.sections && typeof rawReportView.sections === 'object' && !Array.isArray(rawReportView.sections)
      ? rawReportView.sections : {}) as VesselReportSections,
    hasReportHtml: rawReportView.hasReportHtml,
    reviewProgress: rawReportView.reviewProgress,
  };

  if (input.knownSave && targetReport.clientRef === input.reportClientRef
    && activeCourseState?.reportClientRef === targetReport.clientRef
    && activeCourseState.platformSaveId === input.knownSave) {
    return { report: reportView, reportClientRef: targetReport.clientRef,
      runs: [], models: [], comparisons: [], attempts: await listQueuedCourseAttempts(input.userId, targetReport.clientRef, course.key),
      ilabRun: ilabRunView, matchesLocalSave: true };
  }

  const [dbRuns, dbModels, dbComparisons, dbAttempts] = await Promise.all([
    prisma.simulationRun.findMany({
      where: {
        ownerUserId: input.userId,
        sourceDomain: VESSEL_EVIDENCE_DOMAIN,
        summary: { path: ['reportId'], equals: targetReport.id },
        ...(input.onlyRunRef ? { sourceRefId: input.onlyRunRef } : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: { traces: input.deferTraceChunks ? false : { orderBy: { chunkIndex: 'asc' } } },
    }),
    prisma.studentModelArtifact.findMany({
      where: { userId: input.userId, experimentKey },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.comparisonArtifact.findMany({
      where: { userId: input.userId, experimentKey },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.stepSubmissionAttempt.findMany({
      where: { userId: input.userId, experimentKey },
      orderBy: [{ stepKey: 'asc' }, { attemptSeq: 'asc' }],
    }),
  ]);

  const runs: CourseRunRecovery[] = [];
  const archivedRuns: VesselRunArchive[] = [];
  const resumableRuns = dbRuns.filter((run) => run.status === 'running'
    && !vesselRunStorageSummary(run).stopReason
    && (!vesselRunStorageSummary(run).recoveryCheckpoint?.reason
      || vesselRunStorageSummary(run).recoveryCheckpoint?.reason === 'checkpoint'));
  const activeRunRef = resumableRuns.find((run) => run.sourceRefId === activeCourseState?.activeRunId)?.sourceRefId
    ?? resumableRuns.at(-1)?.sourceRefId;
  for (let offset = 0; offset < dbRuns.length; offset += RECOVERY_STATE_BATCH_SIZE) {
    const states = await Promise.all(dbRuns.slice(offset, offset + RECOVERY_STATE_BATCH_SIZE).map(async (run) => {
      const summary = vesselRunStorageSummary(run);
      if (summary.reportId !== targetReport.id) return null;
      const archiveOnly = Boolean(input.lazyHistory && !input.onlyRunRef && run.sourceRefId !== activeRunRef);
      const deferred = Boolean(input.deferStateObjects && input.deferTraceChunks
        && summary.openingReference.startsWith('simulation-cas:oss:')
        && summary.lastCheckpointReference.startsWith('simulation-cas:oss:'));
      const useMetadata = input.deferStateObjects && (archiveOnly || deferred);
      const cachedCheckpoint = (run.summary as { recoveryCheckpoint?: RecoveryCheckpoint }).recoveryCheckpoint;
      const hasCheckpoint = summary.lastCheckpointReference !== summary.openingReference;
      const [opening, closeChunk] = await Promise.all([
        useMetadata && summary.recoveryHeader ? Promise.resolve(summary.recoveryHeader)
          : safeReadCas<VesselEvidenceOpening>(summary.openingReference),
        useMetadata && cachedCheckpoint ? Promise.resolve(cachedCheckpoint) : hasCheckpoint
          ? safeReadCas<RecoveryCheckpoint>(summary.lastCheckpointReference)
          : Promise.resolve(null),
      ]);
      if (input.deferStateObjects && opening && (!summary.recoveryHeader || (hasCheckpoint && !cachedCheckpoint))) {
        const { initialCheckpoint: _initialCheckpoint, schema: _schema, ...header } = opening as VesselEvidenceOpening & { schema?: string };
        const checkpointMetadata = closeChunk ? { reason: closeChunk.reason, failure: closeChunk.failure,
          durationS: closeChunk.durationS, endTimeS: closeChunk.endTimeS, controlCount: closeChunk.controlCount,
          nativeCount: closeChunk.nativeCount, fineCount: closeChunk.fineCount, appliedFinalInput: closeChunk.appliedFinalInput } : null;
        // 只回填JSON缓存字段，条件绑定同一不可变恢复点，保留并发保存的其他进度。
        await prisma.$executeRaw`UPDATE "SimulationRun" SET "summary" =
          jsonb_set(jsonb_set("summary", '{recoveryHeader}', ${JSON.stringify(header)}::jsonb, true),
            '{recoveryCheckpoint}', ${JSON.stringify(checkpointMetadata)}::jsonb, true)
          WHERE "id" = ${run.id} AND "ownerUserId" = ${input.userId}
            AND "summary"->>'lastCheckpointReference' = ${summary.lastCheckpointReference}`;
      }
      return { run, summary, opening, closeChunk, archiveOnly, deferred };
    }));
    for (const state of states) {
      if (!state?.opening) continue;
      const { run, summary, opening, closeChunk } = state;

      const trace: VesselTracePoint[] = [];
      const nativeSensorSamples: VesselObservedSample[] = [];
      const fineStepSamples: NonNullable<VesselRunEvidence['fineStepSamples']> = [];
      const changes: Array<{ timeS: number; input: VesselSessionInput }> = [];

      for (const traceRow of input.deferTraceChunks ? [] : run.traces) {
        const chunk = await safeReadCas<VesselTraceChunk>(traceRow.sampleStorageUri);
        if (!chunk) continue;
        if (Array.isArray(chunk.points)) trace.push(...chunk.points);
        if (Array.isArray(chunk.nativeSamples)) nativeSensorSamples.push(...chunk.nativeSamples);
        if (Array.isArray(chunk.fineSamples)) fineStepSamples.push(...chunk.fineSamples);
        if (Array.isArray(chunk.changes)) changes.push(...chunk.changes);
      }

      const stopReason = closeChunk?.reason === 'checkpoint' ? null
        : closeChunk?.reason ?? (run.status === 'failed' ? 'failure' : run.status === 'completed' ? 'duration' : null);
      const stoppedAtMs = run.completedAt?.getTime()
        ?? (stopReason ? opening.startedAtMs + Math.round(summary.lastTimeS * 1000) : null);
      const controlCount = input.deferTraceChunks ? summary.controlCount : trace.length;
      const nativeCount = input.deferTraceChunks ? summary.nativeCount : nativeSensorSamples.length;
      const fineCount = input.deferTraceChunks ? summary.fineCount ?? 0 : fineStepSamples.length;
      const resumable = closeChunk ? closeChunk.controlCount === controlCount
        && closeChunk.nativeCount === nativeCount && (closeChunk.fineCount ?? 0) === fineCount
        && Math.abs((closeChunk.endTimeS ?? 0)-summary.lastTimeS) < 1e-7 : summary.lastTimeS === 0;

      if (state.archiveOnly) {
        archivedRuns.push({
          id: run.sourceRefId, scopeKey: '', courseKey: course.key, courseVersion,
          stepSequence: summary.stepSequence, createdAtMs: opening.startedAtMs,
          durationS: summary.lastTimeS, lastTimeS: summary.lastTimeS,
          stoppedAtMs, stopReason,
          configuration: opening.configuration, initialInput: opening.input,
          finalInput: closeChunk?.appliedFinalInput ?? opening.input,
          controllerSourceRunId: opening.controllerSourceRunId, designStudentModelId: opening.designStudentModelId,
          courseSettings: opening.courseSettings, parameterHash: summary.parameterHash,
          sampleCount: controlCount,
          dredgerModeEvents: summary.dredgerModeEvents,
          remoteOnly: true,
          ...(resumable ? { uploadReceipt: { ...vesselRunProgress(run), reportClientRef: targetReport.clientRef },
            uploadedToReportRef: targetReport.clientRef } : {}),
        });
        continue;
      }

      const references = input.deferStateObjects && input.deferTraceChunks ? await prisma.simulationTrace.findMany({
        where: { runId: run.id, chunkIndex: { lt: summary.chunkCount } }, orderBy: { chunkIndex: 'asc' },
        select: { sampleStorageUri: true },
      }) : undefined;
      if (references && (references.length !== summary.chunkCount || references.some(trace => !trace.sampleStorageUri))) {
        throw new IlabServiceError('实验采样索引暂时不完整，请重新读取进度。', 409);
      }
      const recovered: Omit<CourseRecoveredRun, 'initialCheckpoint' | 'checkpoint'> = {
        id: run.sourceRefId,
        scopeKey: '',
        courseKey: course.key,
        courseVersion,
        stepSequence: summary.stepSequence,
        prediction: opening.prediction ?? '',
        durationS: closeChunk?.durationS ?? summary.lastTimeS,
        createdAtMs: opening.startedAtMs,
        lastTimeS: summary.lastTimeS,
        stoppedAtMs,
        configuration: opening.configuration,
        initialInput: opening.input,
        controllerSourceRunId: opening.controllerSourceRunId,
        designStudentModelId: opening.designStudentModelId,
        courseSettings: opening.courseSettings,
        parameters: (run.summary as {parameters?: VesselRunEvidence['parameters']}).parameters,
        cruiseComfort: (run.summary as {cruiseComfort?: VesselRunEvidence['cruiseComfort']}).cruiseComfort ?? undefined,
        dredgerModeEvents: summary.dredgerModeEvents,
        parameterHash: summary.parameterHash,
        runtimeVersion: run.runtimeVersion,
        resumable,
        trace,
        nativeSensorSamples,
        fineStepSamples,
        changes,
        ...(input.deferTraceChunks ? { traceManifest: { chunkCount: summary.chunkCount, controlCount, nativeCount, fineCount,
          ...(references ? { references: references.map(trace => recoveryTraceReference(trace.sampleStorageUri!, input.supportsTraceColumns)) } : {}) } } : {}),
        stopReason,
        failure: closeChunk?.failure ?? null,
        ...(resumable
          ? {
              uploadReceipt: { ...vesselRunProgress(run), reportClientRef: targetReport.clientRef },
            }
          : {}),
      };
      if (state.deferred) runs.push({ ...recovered,
        stateObjects: { openingReference: summary.openingReference, checkpointReference: summary.lastCheckpointReference } });
      else {
        const initialCheckpoint = (opening as VesselEvidenceOpening).initialCheckpoint;
        runs.push({ ...recovered, initialCheckpoint, checkpoint: closeChunk?.checkpoint ?? initialCheckpoint });
      }
    }
  }

  const modelsByServerId = new Map<string, string>();
  const models: FrozenVesselStudentModel[] = dbModels.map((model) => {
    const clientId = model.clientRef || model.id;
    modelsByServerId.set(model.id, clientId);
    const ioContract = model.ioContract as unknown as FrozenVesselStudentModel['payload']['ioContract'];
    const operatingPoint = model.operatingPoint as unknown as FrozenVesselStudentModel['payload']['operatingPoint'];
    const clientFrozenAtMs = typeof operatingPoint.clientFrozenAtMs === 'number'
      ? operatingPoint.clientFrozenAtMs
      : model.frozenAt.getTime();
    return {
      id: clientId,
      scopeKey: '',
      label: typeof operatingPoint.label === 'string' && operatingPoint.label.trim()
        ? operatingPoint.label
        : `${model.lineageKey} · v${model.version}`,
      channel: inferModelChannel(model.lineageKey, ioContract.outputChannel, ioContract.inputChannel),
      createdAtMs: clientFrozenAtMs,
      payload: {
        experimentKey: course.key,
        lineageKey: model.lineageKey,
        structure: model.structure as unknown as FrozenVesselStudentModel['payload']['structure'],
        ioContract,
        operatingPoint,
        identification: model.identification as unknown as FrozenVesselStudentModel['payload']['identification'],
        trainingRuns: model.trainingRuns as unknown as FrozenVesselStudentModel['payload']['trainingRuns'],
        validationRuns: model.validationRuns as unknown as FrozenVesselStudentModel['payload']['validationRuns'],
        sampleDt: model.sampleDt,
      },
      serverId: model.id,
      contentHash: model.contentHash,
    };
  });

  const comparisons: VesselModelComparison[] = [];
  for (const comparison of dbComparisons) {
    const curveRefs = comparison.curveRefs as { uri?: string } | null;
    const curve = await safeReadCas<{
      modelClientRef?: string;
      actuatorModelClientRef?: string | null;
      timeS?: number[];
      actual?: number[];
      predicted?: number[];
      measuredInput?: number[];
      predictedInput?: number[] | null;
      purpose?: 'forecast' | 'validation';
      controllerInput?: VesselSessionInput;
      outputUnit?: string;
      outputChannel?: string;
      actualHeadingDeg?: Array<number | null>;
      predictedHeadingDeg?: number[];
      actualEastM?: number[];
      predictedEastM?: number[];
      actualBowClearanceM?: number[];
      predictedBowClearanceM?: number[];
      createdAtMs?: number;
    }>(curveRefs?.uri);
    const window = comparison.alignmentWindow as { startS?: number; endS?: number };
    const factorFlags = comparison.factorFlags as unknown as VesselModelComparison['factorFlags'];
    comparisons.push({
      id: comparison.clientRef || comparison.id,
      scopeKey: '',
      modelId: modelsByServerId.get(comparison.studentModelId) ?? curve?.modelClientRef ?? comparison.studentModelId,
      actuatorModelId: curve?.actuatorModelClientRef ?? null,
      runId: comparison.physicalRunRef,
      mode: comparison.mode as VesselModelComparison['mode'],
      startS: Number(window.startS ?? 0),
      endS: Number(window.endS ?? 0),
      timeS: curve?.timeS ?? [],
      actual: curve?.actual ?? [],
      predicted: curve?.predicted ?? [],
      measuredInput: curve?.measuredInput ?? [],
      predictedInput: curve?.predictedInput ?? null,
      metrics: comparison.metrics as Record<string, number | null>,
      createdAtMs: typeof curve?.createdAtMs === 'number' ? curve.createdAtMs : comparison.createdAt.getTime(),
      serverId: comparison.id,
      purpose: curve?.purpose,
      controllerInput: curve?.controllerInput,
      outputUnit: curve?.outputUnit,
      outputChannel: curve?.outputChannel,
      actualHeadingDeg: curve?.actualHeadingDeg,
      predictedHeadingDeg: curve?.predictedHeadingDeg,
      actualEastM: curve?.actualEastM,
      predictedEastM: curve?.predictedEastM,
      actualBowClearanceM: curve?.actualBowClearanceM,
      predictedBowClearanceM: curve?.predictedBowClearanceM,
      factorFlags,
    });
  }

  const attempts: VesselLocalStepAttempt[] = [];
  for (const attempt of dbAttempts) {
    const scoreResult = (attempt.scoreResult ?? {}) as {
      workReference?: string;
      validationFeedback?: string | null;
    };
    const work = await safeReadCas<{
      answers?: Record<string, string>;
      runRefs?: string[];
      modelClientRefs?: string[];
      comparisonClientRefs?: string[];
    }>(scoreResult.workReference);
    const statusMap: Record<string, VesselLocalStepAttempt['status']> = {
      submitted: 'pending-review',
      scored: 'pending-review',
      invalid_run: 'invalid_run',
      model_mismatch: 'model_mismatch',
      below_target: 'below_target',
    };
    attempts.push({
      id: attempt.clientRef || attempt.id,
      scopeKey: '',
      stepSequence: parseStepSeqFromKey(attempt.stepKey),
      runIds: work?.runRefs ?? (Array.isArray(attempt.runRefs) ? (attempt.runRefs as string[]) : []),
      studentModelIds: work?.modelClientRefs ?? (Array.isArray(attempt.studentModelIds) ? (attempt.studentModelIds as string[]) : []),
      comparisonIds: work?.comparisonClientRefs ?? (Array.isArray(attempt.comparisonIds) ? (attempt.comparisonIds as string[]) : []),
      answers: work?.answers ?? (attempt.explanation ? { interpretation: attempt.explanation } : {}),
      createdAtMs: attempt.createdAt.getTime(),
      status: statusMap[attempt.status] ?? 'pending-review',
      validationFeedback: scoreResult.validationFeedback ?? null,
      serverId: attempt.id,
    });
  }

  return {
    report: reportView,
    reportClientRef: targetReport.clientRef,
    runs,
    archivedRuns,
    models,
    comparisons,
    attempts: [...attempts, ...(await listQueuedCourseAttempts(input.userId, targetReport.clientRef, course.key))
      .filter(receipt => !attempts.some(attempt => attempt.id === receipt.id))],
    ilabRun: ilabRunView,
  };
}

export function loadOwnedCourseRunRecovery(userId: string, runRef: string, deferStateObjects?: false): Promise<CourseRecoveredRun>;
export function loadOwnedCourseRunRecovery(userId: string, runRef: string, deferStateObjects: boolean, supportsTraceColumns?: boolean): Promise<CourseRunRecovery>;
export async function loadOwnedCourseRunRecovery(userId: string, runRef: string, deferStateObjects = false,
  supportsTraceColumns = false): Promise<CourseRunRecovery> {
  const run = await findOwnedVesselRun(userId, runRef);
  const summary = vesselRunStorageSummary(run);
  const report = await prisma.virtualSimulationReport.findFirst({
    where: { id: summary.reportId, userId }, select: { clientRef: true },
  });
  if (!report?.clientRef || !findVesselCourse(summary.courseKey)) throw new IlabServiceError('实验运行记录不存在。', 404);
  const recovery = await loadCourseSessionRecovery({
    userId, courseKey: summary.courseKey as VesselCourseKey, courseVersion: summary.courseVersion,
    reportClientRef: report.clientRef, onlyRunRef: runRef, deferTraceChunks: true, deferStateObjects, supportsTraceColumns,
  });
  const recovered = recovery.runs.find((item) => item.id === runRef);
  if (!recovered) throw new IlabServiceError('实验恢复记录暂时不可用。', 409);
  return recovered;
}
