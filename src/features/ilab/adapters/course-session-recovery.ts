import { prisma } from '@/lib/prisma';
import { readSimulationTraceChunk } from '@/lib/data-governance/simulation-trace-cas';
import type { VesselObservedSample, VesselSessionInput } from '@/lib/control-engine/vessel-session';
import type {
  CourseRecoveredRun,
  CourseSessionRecoveryPayload,
  VesselReportProgress,
} from '@/features/simulations/course-artifact-upload';
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
import { VESSEL_EVIDENCE_DOMAIN, vesselRunStorageSummary } from '../course-evidence-service';
import { parseStepDrafts, resolveIlabUploadMode } from './ilab-session-lifecycle';

const VESSEL_ID_BY_COURSE_KEY: Record<VesselCourseKey, string> = {
  destroyer: 'destroyer-055',
  lng: 'fleet-lng-changheng',
  container: 'fleet-container-msc',
  cruise: 'fleet-cruise-adora',
  drilling: 'fleet-drill-hysy981',
  icebreaker: 'fleet-icebreaker-xuelong',
  dredger: 'fleet-dredger-tianjing',
};

function inferModelChannel(lineageKey: string, outputChannel: string, inputChannel: string): IdentificationChannel | 'dp-low-frequency' {
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
export async function loadCourseSessionRecovery(input: {
  userId: string;
  courseKey: VesselCourseKey;
  courseVersion?: string;
}): Promise<CourseSessionRecoveryPayload> {
  const course = findVesselCourse(input.courseKey);
  if (!course) {
    throw new Error(`未知课程实验: ${input.courseKey}`);
  }
  const courseVersion = input.courseVersion || VESSEL_COURSE_VERSION;
  const vesselId = VESSEL_ID_BY_COURSE_KEY[course.key];

  const [draftReport, latestAnyReport, activeIlabRun] = await Promise.all([
    prisma.virtualSimulationReport.findFirst({
      where: {
        userId: input.userId,
        experimentKey: course.key,
        experimentVersion: courseVersion,
        clientRef: { not: null },
        status: { in: ['draft', 'revision-requested'] },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.virtualSimulationReport.findFirst({
      where: {
        userId: input.userId,
        experimentKey: course.key,
        experimentVersion: courseVersion,
        clientRef: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.ilabExperimentRun.findFirst({
      where: {
        userId: input.userId,
        vesselId,
        experimentVersion: courseVersion,
        OR: [
          { status: 2 },
          { uploadStatus: { in: ['failed', 'score-uploaded'] } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const activeCourseState = activeIlabRun ? parseStepDrafts(activeIlabRun.stepDrafts).courseState : undefined;
  const activeReportRef = typeof activeCourseState?.reportClientRef === 'string' ? activeCourseState.reportClientRef : null;
  const targetReport = activeReportRef
    ? await prisma.virtualSimulationReport.findFirst({where:{userId:input.userId,experimentKey:course.key,
        experimentVersion:courseVersion,clientRef:activeReportRef}})
    : draftReport ?? latestAnyReport;

  const ilabRunForRecovery = activeIlabRun ?? (
    targetReport
      ? await prisma.ilabExperimentRun.findFirst({
          where: { userId: input.userId, reportId: targetReport.id },
          orderBy: { updatedAt: 'desc' },
        })
      : null
  );

  let ilabRunView: CourseSessionRecoveryPayload['ilabRun'] = null;
  if (ilabRunForRecovery) {
    const drafts = parseStepDrafts(ilabRunForRecovery.stepDrafts);
    const mode = resolveIlabUploadMode(ilabRunForRecovery);
    ilabRunView = {
      originId: ilabRunForRecovery.originId,
      status: ilabRunForRecovery.status,
      uploadStatus: ilabRunForRecovery.uploadStatus,
      retryableUpload: mode === 'ilab-remote' && (ilabRunForRecovery.uploadStatus === 'failed' || ilabRunForRecovery.uploadStatus === 'score-uploaded'),
      stepDrafts: drafts.bySeq,
      ...(drafts.activeSeq !== undefined ? { draftActiveSeq: drafts.activeSeq } : {}),
      ...(drafts.courseState ? { courseState: drafts.courseState } : {}),
      updatedAtMs: ilabRunForRecovery.updatedAt.getTime(),
    };
  }

  if (!targetReport?.clientRef) {
    return {
      report: null,
      reportClientRef: null,
      runs: [],
      models: [],
      comparisons: [],
      attempts: [],
      ilabRun: ilabRunView,
    };
  }

  const experimentKey = vesselExperimentKey(targetReport);

  const [dbRuns, dbModels, dbComparisons, dbAttempts] = await Promise.all([
    prisma.simulationRun.findMany({
      where: {
        ownerUserId: input.userId,
        sourceDomain: VESSEL_EVIDENCE_DOMAIN,
        summary: { path: ['reportId'], equals: targetReport.id },
      },
      orderBy: { createdAt: 'asc' },
      include: { traces: { orderBy: { chunkIndex: 'asc' } } },
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

  const runs: CourseRecoveredRun[] = [];
  for (const run of dbRuns) {
    const summary = vesselRunStorageSummary(run);
    if (summary.reportId !== targetReport.id) continue;
    const opening = await safeReadCas<VesselEvidenceOpening>(summary.openingReference);
    if (!opening) continue;

    const trace: VesselTracePoint[] = [];
    const nativeSensorSamples: VesselObservedSample[] = [];
    const fineStepSamples: NonNullable<VesselRunEvidence['fineStepSamples']> = [];
    const changes: Array<{ timeS: number; input: VesselSessionInput }> = [];

    for (const traceRow of run.traces) {
      const chunk = await safeReadCas<VesselTraceChunk>(traceRow.sampleStorageUri);
      if (!chunk) continue;
      if (Array.isArray(chunk.points)) trace.push(...chunk.points);
      if (Array.isArray(chunk.nativeSamples)) nativeSensorSamples.push(...chunk.nativeSamples);
      if (Array.isArray(chunk.fineSamples)) fineStepSamples.push(...chunk.fineSamples);
      if (Array.isArray(chunk.changes)) changes.push(...chunk.changes);
    }

    const closeChunk = summary.lastCheckpointReference && summary.lastCheckpointReference !== summary.openingReference
      ? await safeReadCas<{
          checkpoint?: string;
          reason?: VesselRunEvidence['stopReason'] | 'checkpoint';
          failure?: string | null;
          durationS?: number;
          endTimeS?: number;
          controlCount?: number;
          nativeCount?: number;
          fineCount?: number;
        }>(summary.lastCheckpointReference)
      : null;

    const stopReason = closeChunk?.reason === 'checkpoint' ? null
      : closeChunk?.reason ?? (run.status === 'failed' ? 'failure' : run.status === 'completed' ? 'duration' : null);
    const resumable = closeChunk ? closeChunk.controlCount === trace.length
      && closeChunk.nativeCount === nativeSensorSamples.length && (closeChunk.fineCount ?? 0) === fineStepSamples.length
      && Math.abs((closeChunk.endTimeS ?? 0)-summary.lastTimeS) < 1e-7 : summary.lastTimeS === 0;

    runs.push({
      id: run.sourceRefId,
      scopeKey: '',
      courseKey: course.key,
      courseVersion,
      stepSequence: summary.stepSequence,
      prediction: opening.prediction ?? '',
      durationS: closeChunk?.durationS ?? summary.lastTimeS,
      createdAtMs: opening.startedAtMs,
      lastTimeS: summary.lastTimeS,
      stoppedAtMs: run.completedAt ? run.completedAt.getTime() : null,
      configuration: opening.configuration,
      initialInput: opening.input,
      controllerSourceRunId: opening.controllerSourceRunId,
      designStudentModelId: opening.designStudentModelId,
      courseSettings: opening.courseSettings,
      parameters: (run.summary as {parameters?: VesselRunEvidence['parameters']}).parameters,
      cruiseComfort: (run.summary as {cruiseComfort?: VesselRunEvidence['cruiseComfort']}).cruiseComfort,
      parameterHash: summary.parameterHash,
      runtimeVersion: run.runtimeVersion,
      initialCheckpoint: opening.initialCheckpoint,
      checkpoint: closeChunk?.checkpoint ?? opening.initialCheckpoint,
      resumable,
      trace,
      nativeSensorSamples,
      fineStepSamples,
      changes,
      stopReason,
      failure: closeChunk?.failure ?? null,
      ...(run.completedAt !== null
        ? {
            uploadReceipt: {
              runRef: run.sourceRefId,
              reportId: targetReport.id,
              experimentKey,
              status: run.status,
              chunkCount: summary.chunkCount,
              controlCount: trace.length,
              nativeCount: nativeSensorSamples.length,
              fineCount: fineStepSamples.length,
              lastTimeS: summary.lastTimeS,
              parameterHash: summary.parameterHash,
              reportClientRef: targetReport.clientRef,
            },
          }
        : {}),
    });
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

  const rawReportView = vesselReportView(targetReport);
  const reportView: VesselReportProgress = {
    id: rawReportView.id,
    clientRef: rawReportView.clientRef ?? '',
    status: rawReportView.status,
    revision: rawReportView.revision,
    score: rawReportView.score,
    maxScore: rawReportView.maxScore,
    teacherFeedback: rawReportView.teacherFeedback,
    sections: (rawReportView.sections && typeof rawReportView.sections === 'object' && !Array.isArray(rawReportView.sections)
      ? rawReportView.sections
      : {}) as VesselReportSections,
    hasReportHtml: rawReportView.hasReportHtml,
    reviewProgress: rawReportView.reviewProgress,
  };

  return {
    report: reportView,
    reportClientRef: targetReport.clientRef,
    runs,
    models,
    comparisons,
    attempts,
    ilabRun: ilabRunView,
  };
}
