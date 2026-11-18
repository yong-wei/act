'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';

import { useOptionalGlobalAI } from '@/components/providers/global-ai-provider';
import { clearIlabOriginSessionStorage, describeIlabConnection, stripIlabUrlParams } from '@/features/ilab/client-grant';
import { applyLocalSketchVerdict } from '@/features/ilab/sketch-client';
import type { VesselAuditTelemetry } from '@/features/ilab/telemetry-redaction';
import {
  defaultTourNodeForVessel,
  findHighlightTourNode,
  type HighlightTourNodeId,
} from '../experiments/highlight-tour';
import { VesselCourseWorkspace } from '@/features/simulations/course-workspace';
import { listRunEvidence, readRunEvidence, readExperimentDraft, readStepExperimentDraft, saveExperimentDraft,
  listFrozenStudentModels, listModelComparisons, saveModelComparison, listLocalStepAttempts,
  saveLocalStepAttempt, listExperimentDrafts, type VesselExperimentDraft, type VesselRunSummary } from '@/features/simulations/local-evidence-store';
import type { VesselLocalStepAttempt, VesselRunEvidence } from '@/features/simulations/run-evidence';
import { uploadVesselCourseArtifacts, saveVesselCourseDraftToPlatform, saveVesselCourseReport, fetchCourseSessionRecovery, hasRecoverableLocalDraft,
  hydrateRecoveredCourseSession, triggerCourseReportIlabUpload } from '@/features/simulations/course-artifact-upload';
import { buildVesselCourseReportHtml } from '@/features/simulations/course-report';
import type { VesselReportSections } from '@/features/ilab/course-artifact-contract';
import { VESSEL_COURSE_VERSION } from '../experiments/destroyer-course';
import { getMarineCanvasStatus } from '../lib/marine-status-store';
import type { LngCourseSettings } from '../experiments/lng-course';
import { lngCourseAdapter, type VesselCourseAdapter } from '../experiments/course-adapter';
import { evaluateVesselHeadingRun, type FrozenVesselStudentModel, type VesselModelComparison } from '../experiments/student-analysis';
import {
  assertVesselStepOrder,
  buildVesselReportHtml,
  chooseBetterVesselAttempt,
  thinVesselSamples,
  vesselKonlingBrief,
  withLatestSample,
  type VesselExperiment,
  type VesselReadings,
  type VesselSample,
} from './vessel-experiment';

export interface VesselReportSummary {
  id: string;
  score: number | null;
  maxScore: number;
  createdAt: string;
  status?: string;
}

interface StoredStepRecord {
  seq: number;
  title: string;
  earnedPoints: number;
  maxPoints: number;
  evaluation: string;
  remarks: string;
  samples: VesselSample[];
  readings: VesselReadings;
}

interface VesselSessionApiPayload {
  connected?: boolean;
  resumed?: boolean;
  userId?: string | null;
  experimentVersion?: string;
  originId?: string;
  reportClientRef?: string;
  displayName?: string;
  status?: number;
  uploadMode?: 'local-only' | 'dev-bypass' | 'ilab-remote';
  retryableUpload?: boolean;
  currentSeq?: number;
  draftActiveSeq?: number;
  reportHtml?: string | null;
  auditTelemetry?: VesselAuditTelemetry;
  stepDrafts?: Record<string, VesselReadings>;
  steps?: StoredStepRecord[];
  error?: string;
}

function readLocalDraftStore(key: string): { activeSeq?: number; bySeq: Record<string, VesselReadings> } {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { bySeq: {} };
    const parsed = JSON.parse(raw) as { activeSeq?: unknown; bySeq?: unknown };
    const bySeq: Record<string, VesselReadings> = {};
    if (parsed.bySeq && typeof parsed.bySeq === 'object' && !Array.isArray(parsed.bySeq)) {
      for (const [seqKey, value] of Object.entries(parsed.bySeq)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          bySeq[seqKey] = value as VesselReadings;
        }
      }
    }
    return {
      activeSeq: typeof parsed.activeSeq === 'number' && parsed.activeSeq > 0 ? parsed.activeSeq : undefined,
      bySeq,
    };
  } catch {
    return { bySeq: {} };
  }
}

function writeLocalDraftStore(key: string, payload: { activeSeq: number; bySeq: Record<string, VesselReadings> }) {
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // 忽略隐私模式下 localStorage 不可用
  }
}

export function useVesselExperiment<Settings extends object = LngCourseSettings>(experiment: VesselExperiment, ticket = '',
  courseAdapter: VesselCourseAdapter<Settings> = lngCourseAdapter as unknown as VesselCourseAdapter<Settings>) {
  const ai = useOptionalGlobalAI();
  const { data: session, status: sessionStatus, update: updateSession } = useSession();
  const [activeSeq, setActiveSeq] = useState(1);
  const [viewSeq, setViewSeq] = useState(1);
  const [samples, setSamples] = useState<VesselSample[]>([]);
  const [records, setRecords] = useState<StoredStepRecord[]>([]);
  const [readings, setReadings] = useState<VesselReadings>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [originId, setOriginId] = useState('');
  const [ilabUserId, setIlabUserId] = useState<string | null>(null);
  const [verifiedTicket, setVerifiedTicket] = useState('');
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [uploadMode, setUploadMode] = useState<'local-only' | 'dev-bypass' | 'ilab-remote'>('local-only');
  const [auditTelemetry, setAuditTelemetry] = useState<VesselAuditTelemetry | null>(null);
  const [tourNodeId, setTourNodeId] = useState<HighlightTourNodeId | null>(null);
  const [tourReadingsMap, setTourReadingsMap] = useState<Record<string, VesselReadings>>({});
  const preTourMessageRef = useRef<string | null>(null);
  const tourActiveRef = useRef(false);
  const [tourSettings, setTourSettings] = useState<Settings>(() => courseAdapter.defaultSettings(1));
  const [tourDesignModelId, setTourDesignModelId] = useState('');
  const [tourReportRunIds, setTourReportRunIds] = useState<string[]>([]);
  const [reportHtml, setReportHtml] = useState('');
  const [pastReports, setPastReports] = useState<VesselReportSummary[] | null>(null);
  const [reportRevision, setReportRevision] = useState(0);
  const [seriesVisible, setSeriesVisible] = useState<Record<string, boolean>>(
    () => Object.fromEntries(experiment.series.map((series) => [series.id, true])),
  );
  const stepStartedAt = useRef(Date.now());
  const liveRef = useRef<Record<string, number>>({});
  const latestSampleRef = useRef<VesselSample | null>(null);
  const stepDraftsRef = useRef<Record<string, VesselReadings>>({});
  const updateSessionRef = useRef(updateSession);
  const sessionSyncTarget = useRef('');
  const originIdRef = useRef(originId);
  updateSessionRef.current = updateSession;
  originIdRef.current = originId;
  const draftStorageKey = `act-vessel-drafts:${experiment.key}`;
  const nativeCourse = experiment.key === courseAdapter.experimentKey && experiment.courseVersion === VESSEL_COURSE_VERSION;
  const tourVesselId = experiment.route.split('/').at(-1) ?? experiment.vesselId;
  const [connectionReady, setConnectionReady] = useState(false);
  const [readyScope, setReadyScope] = useState('');
  const [recoveryFailed, setRecoveryFailed] = useState(false);
  const [round, setRound] = useState<{base: string; scope: string} | null>(null);
  const effectiveUserId = ilabUserId ?? session?.user?.id;
  const awaitingIlabIdentity = Boolean(ticket && ticket !== verifiedTicket);
  const canUseCloudEvidence = !awaitingIlabIdentity && sessionStatus === 'authenticated'
    && (!ilabUserId || session?.user?.id === ilabUserId);
  const accountReady = !awaitingIlabIdentity && (!ilabUserId || canUseCloudEvidence);

  useEffect(() => {
    if (!connectionReady || !ilabUserId || sessionStatus === 'loading'
      || session?.user?.id === ilabUserId || sessionSyncTarget.current === ilabUserId) return;
    sessionSyncTarget.current = ilabUserId;
    if (sessionStatus === 'unauthenticated') {
      // NextAuth v4 update() ignores calls without an existing client session.
      window.location.replace(stripIlabUrlParams(experiment.route, window.location.search));
      return;
    }
    void updateSessionRef.current().catch(() => {
      setMessage('账号状态暂时无法同步，请刷新重试。已保存的实验记录将继续保留。');
    });
  }, [connectionReady, ilabUserId, sessionStatus, session?.user?.id, experiment.route]);
  const baseScope = `${effectiveUserId ? `account:${effectiveUserId}` : originId ? `ilab:${originId}` : 'local'}:${experiment.key}:${experiment.courseVersion ?? 'legacy-v1'}`;
  const scopeKey = round?.base === baseScope ? round.scope : baseScope;
  const baseScopeRef = useRef(baseScope);
  baseScopeRef.current = baseScope;
  const [readyRoundBase, setReadyRoundBase] = useState('');
  const [rounds, setRounds] = useState<VesselExperimentDraft[]>([]);
  const scopeRef = useRef(scopeKey);
  scopeRef.current = scopeKey;
  const workspace = useRef<VesselCourseWorkspace | null>(null);
  const activation = useRef(0);
  const reportRef = useRef('');
  const roundOriginRef = useRef<{ scope: string; originId?: string }>({ scope: '' });
  const roundWaveProfile = useRef({ scope: '', legacy: false });
  const savedCourseReportId = useRef('');
  const plannedRunRef = useRef('');
  const courseUploads = useRef<Promise<unknown>>(Promise.resolve());
  const [courseRunning, setCourseRunning] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => courseAdapter.defaultSettings(1));
  const [models, setModels] = useState<FrozenVesselStudentModel[]>([]);
  const [comparisons, setComparisons] = useState<VesselModelComparison[]>([]);
  const [runs, setRuns] = useState<VesselRunSummary[]>([]);
  const [attempts, setAttempts] = useState<VesselLocalStepAttempt[]>([]);
  const [designModelId, setDesignModelId] = useState('');
  const [reportRunIds, setReportRunIds] = useState<string[]>([]);
  const courseLive = useRef({settings, models, designModelId, readings, activeSeq, reportRunIds, attempts});
  courseLive.current = {settings, models, designModelId, readings, activeSeq, reportRunIds, attempts};

  const activeTourNode = useMemo(
    () => (tourNodeId ? findHighlightTourNode(tourNodeId) ?? defaultTourNodeForVessel(tourVesselId) : null),
    [tourVesselId, tourNodeId],
  );
  const tourActive = Boolean(activeTourNode);
  tourActiveRef.current = tourActive;

  useEffect(() => {
    if (!activeTourNode) return;
    setTourSettings(courseAdapter.defaultSettings(activeTourNode.stepSeq));
    setTourDesignModelId(activeTourNode.models[0]?.id ?? '');
    setTourReportRunIds(activeTourNode.runs.map((item) => item.id));
  }, [activeTourNode, courseAdapter]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('tour') !== '1') return;
    const node = findHighlightTourNode(params.get('node')) ?? defaultTourNodeForVessel(tourVesselId);
    tourActiveRef.current = true;
    setTourNodeId(node.id);
  }, [tourVesselId]);

  const enterHighlightTour = useCallback(
    (nodeId?: HighlightTourNodeId) => {
      if (!tourNodeId) {
        preTourMessageRef.current = message;
        if (courseRunning || workspace.current?.running) {
          setCourseRunning(false);
          void workspace.current?.pause().catch(() => undefined);
        }
      }
      const next = findHighlightTourNode(nodeId) ?? defaultTourNodeForVessel(tourVesselId);
      tourActiveRef.current = true;
      setTourNodeId(next.id);
      setMessage('已切换至只读高光工况导览模式：严禁正式提交与成绩回传。');
    },
    [courseRunning, tourVesselId, message, tourNodeId],
  );

  const exitHighlightTour = useCallback(() => {
    tourActiveRef.current = false;
    setTourNodeId(null);
    setTourReadingsMap({});
    if (preTourMessageRef.current !== null) {
      setMessage(preTourMessageRef.current);
      preTourMessageRef.current = null;
    } else {
      setMessage('');
    }
    if (typeof window !== 'undefined' && window.location.search.includes('tour=')) {
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.delete('tour');
      nextParams.delete('node');
      const query = nextParams.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    }
  }, []);

  const displayActiveSeq = activeTourNode ? activeTourNode.stepSeq : activeSeq;
  const displayViewSeq = activeTourNode ? activeTourNode.stepSeq : viewSeq;
  const step = experiment.steps[displayActiveSeq - 1] ?? experiment.steps[0];
  const viewed = experiment.steps[displayViewSeq - 1] ?? step;
  const doneSeqs = nativeCourse ? [...new Set(attempts.filter((attempt) => attempt.scopeKey === scopeKey
    && !['invalid_run', 'model_mismatch'].includes(attempt.status)).map((attempt) => attempt.stepSequence))]
    : records.map((record) => record.seq);
  const viewedRecord = records.find((record) => record.seq === viewSeq);
  const shownSamples = activeTourNode
    ? activeTourNode.samples
    : viewSeq === activeSeq
      ? samples
      : viewedRecord?.samples ?? [];
  const effectiveReadings = activeTourNode
    ? (tourReadingsMap[activeTourNode.id] ?? activeTourNode.readings)
    : readings;
  const reportEnabled = nativeCourse ? doneSeqs.includes(20)
    : records.some((record) => record.seq === experiment.steps.length) || Boolean(reportHtml);

  const reloadCourseEvidence = useCallback(async (scope = scopeRef.current) => {
    const [nextRuns, nextModels, nextComparisons, nextAttempts] = await Promise.all([
      listRunEvidence(scope), listFrozenStudentModels(scope), listModelComparisons(scope), listLocalStepAttempts(scope)]);
    if (scopeRef.current !== scope) return;
    setRuns(nextRuns); setModels(nextModels); setComparisons(nextComparisons); setAttempts(nextAttempts);
  }, []);

  const saveCourseDraft = useCallback(async () => {
    if (tourActiveRef.current) return;
    const current = workspace.current;
    if (!current || current.plan.scopeKey !== scopeRef.current) return;
    const live = courseLive.current;
    await saveExperimentDraft({scopeKey: current.plan.scopeKey, stepSequence: live.activeSeq,
      activeRunId: current.run()?.id ?? null, prediction: live.readings.prediction ?? '',
      explanation: live.readings.interpretation ?? '', durationS: current.plan.durationS,
      checkpoint: null, runConfiguration: current.plan.configuration,
      completedSteps: [...new Set(live.attempts.filter((attempt) => attempt.scopeKey === current.plan.scopeKey
        && !['invalid_run', 'model_mismatch'].includes(attempt.status)).map((attempt) => attempt.stepSequence))], updatedAtMs: Date.now(),
      answers: live.readings, plannedRunId: plannedRunRef.current, reportClientRef: reportRef.current,
      originId: roundOriginRef.current.scope === current.plan.scopeKey ? roundOriginRef.current.originId : undefined,
      reportRunIds: live.reportRunIds, courseSettings: Object.fromEntries(Object.entries(live.settings)), designStudentModelId: live.designModelId});
    const nextRounds = await listExperimentDrafts(baseScopeRef.current);
    if (current.plan.scopeKey === scopeRef.current) setRounds(nextRounds);
  }, []);

  const refreshAuditTelemetry = useCallback(async (explicitOriginId?: string) => {
    if (tourActiveRef.current) return;
    const activeOrigin = explicitOriginId
      ?? ((nativeCourse && roundOriginRef.current.scope === scopeRef.current
        ? roundOriginRef.current.originId
        : undefined)
        || originIdRef.current);
    if (!activeOrigin) return;
    try {
      const response = await fetch(`/api/ilab/vessel/session/${encodeURIComponent(activeOrigin)}`, {
        cache: 'no-store',
      });
      if (!response.ok || tourActiveRef.current) return;
      const body = await response.json() as VesselSessionApiPayload;
      if (body.auditTelemetry) {
        setAuditTelemetry(body.auditTelemetry);
      }
    } catch {
      // 网络波动时保留最近一次已取得的脱敏审计遥测
    }
  }, [nativeCourse]);

  const activateCourseStep = useCallback(async (sequence: number, scope: string, initial = false,
    replacementSettings?: Settings) => {
    const token = ++activation.current;
    setCourseRunning(false);
    setReadyScope('');
    setRecoveryFailed(false);
    const previous = workspace.current;
    await previous?.dispose();
    if (token !== activation.current || scopeRef.current !== scope) return;
    let draft = replacementSettings ? undefined : initial ? await readExperimentDraft(scope)
      : await readStepExperimentDraft(scope, sequence);
    if (initial && courseAdapter.courseKey === 'drilling') {
      const history = await listRunEvidence(scope);
      roundWaveProfile.current = { scope, legacy: history.some((run) => run.configuration.waveTableProfile === undefined) };
    }
    const localReady = initial && await hasRecoverableLocalDraft(scope, draft);
    if (initial) savedCourseReportId.current = '';
    if (initial && canUseCloudEvidence) {
      const restored = await fetchCourseSessionRecovery(courseAdapter.courseKey, VESSEL_COURSE_VERSION,
        draft ? { originId: draft.originId, reportClientRef: draft.reportClientRef, localScope: localReady ? scope : undefined }
          : scope === baseScopeRef.current ? { originId: originIdRef.current || undefined }
            : { reportClientRef: scope.slice(`${baseScopeRef.current}:round:`.length) }).catch((error: unknown) => {
        if (!localReady) throw error;
        return null;
      });
      if (token !== activation.current || scopeRef.current !== scope) return;
      if (restored && (!restored.authenticated || restored.userId !== effectiveUserId || !restored.recovery)) {
        throw new Error('账号或云端进度暂时无法恢复，请刷新重试。已保存的实验记录将继续保留。');
      }
      if (restored?.recovery) {
        const recovery = restored.recovery;
        if (courseAdapter.courseKey === 'drilling' && [...recovery.runs, ...(recovery.archivedRuns ?? [])]
          .some((run) => run.configuration.waveTableProfile === undefined)) {
          roundWaveProfile.current = { scope, legacy: true };
        }
        if (recovery.ilabRun) {
          stepDraftsRef.current = {...recovery.ilabRun.stepDrafts};
          setUploadFailed(recovery.ilabRun.retryableUpload);
        }
        savedCourseReportId.current = recovery.report?.id ?? '';
        if (!recovery.matchesLocalSave && (recovery.reportClientRef || recovery.ilabRun)) {
          await hydrateRecoveredCourseSession(scope, recovery);
          draft = await readExperimentDraft(scope);
        }
      }
    }
    if (token !== activation.current || scopeRef.current !== scope) return;
    if (initial) roundOriginRef.current = { scope,
      originId: draft?.originId ?? (scope === baseScopeRef.current ? originIdRef.current || undefined : undefined) };
    if (initial) sequence = draft?.stepSequence ?? sequence;
    const previousPlan = courseAdapter.previousPlanSequence?.(sequence);
    const planDraft = draft ?? (previousPlan && !replacementSettings ? await readStepExperimentDraft(scope, previousPlan) : undefined);
    const restoredSettings = courseAdapter.restoreSettings(replacementSettings ?? planDraft?.courseSettings
      ?? (courseAdapter.courseKey === 'lng' ? planDraft?.lngSettings : undefined), sequence);
    const nativeSequence = courseAdapter.nativeSequence?.(sequence) ?? sequence;
    let run = planDraft?.activeRunId ? await readRunEvidence(planDraft.activeRunId) : undefined;
    if (run && (run.scopeKey !== scope || run.stepSequence !== nativeSequence)) run = undefined;
    const configuration = courseAdapter.configuration(nativeSequence, restoredSettings);
    if (roundWaveProfile.current.scope === scope && roundWaveProfile.current.legacy) delete configuration.waveTableProfile;
    const current = await VesselCourseWorkspace.open({scopeKey: scope, courseKey: courseAdapter.courseKey, courseVersion: VESSEL_COURSE_VERSION,
      stepSequence: nativeSequence, durationS: courseAdapter.steps[nativeSequence - 1].runDurationS ?? 1200,
      configuration, courseSettings: Object.fromEntries(Object.entries(restoredSettings))}, run);
    if (token !== activation.current || scopeRef.current !== scope) { await current.dispose(); return; }
    workspace.current = current;
    if (initial) reportRef.current = draft?.reportClientRef ?? crypto.randomUUID();
    plannedRunRef.current = run?.id ?? planDraft?.plannedRunId ?? crypto.randomUUID();
    const restoredModel = replacementSettings ? courseLive.current.designModelId
      : run?.designStudentModelId ?? planDraft?.designStudentModelId ?? '';
    const restoredAnswers = replacementSettings ? courseLive.current.readings : draft?.answers ?? {};
    setSettings(restoredSettings); setDesignModelId(restoredModel);
    setReadings(restoredAnswers); setReportRunIds(draft?.reportRunIds ?? (initial ? [] : courseLive.current.reportRunIds));
    setActiveSeq(sequence); setViewSeq(sequence); setSamples(run ? courseAdapter.traceSamples(run.trace) : []); latestSampleRef.current = null;
    courseLive.current = {...courseLive.current, settings: restoredSettings, designModelId: restoredModel,
      readings: restoredAnswers, activeSeq: sequence};
    await reloadCourseEvidence(scope);
    if (token === activation.current) setReadyScope(scope);
    if (initial && (draft?.originId || originIdRef.current)) {
      void refreshAuditTelemetry(draft?.originId);
    }
  }, [reloadCourseEvidence, courseAdapter, canUseCloudEvidence, effectiveUserId, refreshAuditTelemetry]);

  useEffect(() => {
    if (!nativeCourse || !connectionReady || !accountReady || sessionStatus === 'loading') return;
    const selected = window.localStorage.getItem(`act-vessel-course-round:${baseScope}`);
    const valid = selected === baseScope || selected?.startsWith(`${baseScope}:round:`);
    setRound({base: baseScope, scope: valid ? selected! : baseScope});
    setReadyRoundBase(baseScope);
  }, [nativeCourse, connectionReady, accountReady, sessionStatus, baseScope]);

  useEffect(() => {
    if (!nativeCourse || !connectionReady || !accountReady || sessionStatus === 'loading' || readyRoundBase !== baseScope) return;
    void activateCourseStep(1, scopeKey, true).catch((error: unknown) => {
      setRecoveryFailed(true);
      setMessage(error instanceof Error ? error.message : '实验恢复失败。');
    });
    return () => {
      activation.current += 1;
      const previous = workspace.current;
      void previous?.dispose().catch((error: unknown) => console.error(error));
    };
  }, [nativeCourse, connectionReady, accountReady, sessionStatus, scopeKey, baseScope, readyRoundBase, activateCourseStep]);

  useEffect(() => {
    if (!nativeCourse || readyScope !== scopeKey || tourActive) return;
    const timer = window.setTimeout(() => { void saveCourseDraft().catch((error: unknown) =>
      setMessage(error instanceof Error ? error.message : '草稿保存失败。')); }, 200);
    return () => window.clearTimeout(timer);
  }, [nativeCourse, readyScope, scopeKey, tourActive, activeSeq, readings, settings, designModelId, reportRunIds, attempts, saveCourseDraft]);

  useEffect(() => {
    if (!nativeCourse) return;
    const persist = () => {
      if (tourActiveRef.current) return;
      const current = workspace.current;
      if (!current) return;
      setCourseRunning(false);
      void current.pause().then(saveCourseDraft).catch((error: unknown) => console.error(error));
    };
    const onHidden = () => { if (document.visibilityState === 'hidden') persist(); };
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', onHidden);
    return () => { window.removeEventListener('pagehide', persist); document.removeEventListener('visibilitychange', onHidden); };
  }, [nativeCourse, saveCourseDraft]);

  const clearSamples = useCallback(() => {
    if (tourActiveRef.current) return;
    setSamples([]);
    latestSampleRef.current = null;
    stepStartedAt.current = Date.now();
  }, []);

  /** 每个子步调用；曲线按整秒抽样，交卷时用最新时刻补齐曲线终点。 */
  const trackLatest = useCallback((sample: VesselSample) => {
    if (tourActiveRef.current) return;
    if (sample.time > step.duration + 0.05) return;
    latestSampleRef.current = sample;
  }, [step.duration]);

  const observe = useCallback((sample: VesselSample) => {
    if (tourActiveRef.current) return;
    liveRef.current = { time: sample.time, ...sample.values };
    setSamples((prev) => {
      const last = prev[prev.length - 1];
      if (last && sample.time < last.time + 0.9) return prev;
      if (sample.time > step.duration + 0.05) return prev;
      const next = [...prev, sample];
      return next.length > 2000 ? next.slice(next.length - 2000) : next;
    });
  }, [step.duration]);

  useEffect(() => {
    if (nativeCourse) return;
    setReadings(stepDraftsRef.current[String(activeSeq)] ?? {});
    setSamples([]);
    latestSampleRef.current = null;
    stepStartedAt.current = Date.now();
  }, [activeSeq, nativeCourse]);

  useEffect(() => {
    if (tourActive || nativeCourse) return;
    stepDraftsRef.current = {...stepDraftsRef.current, [String(activeSeq)]: readings};
    writeLocalDraftStore(draftStorageKey, {
      activeSeq,
      bySeq: stepDraftsRef.current,
    });
    if (!originId) return;
    const timer = window.setTimeout(() => {
      void fetch(`/api/ilab/vessel/session/${originId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          activeSeq,
          seq: activeSeq,
          readings: stepDraftsRef.current[String(activeSeq)] ?? {},
        }),
      }).catch(() => undefined);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [activeSeq, draftStorageKey, originId, readings, nativeCourse, tourActive]);

  useEffect(() => {
    if (ticket && ticket === verifiedTicket) return;
    setConnectionReady(false);
    const storageKey = `act-vessel-origin:${experiment.key}`;
    let cancelled = false;

    const localSeed = readLocalDraftStore(draftStorageKey);
    if (Object.keys(localSeed.bySeq).length > 0) {
      stepDraftsRef.current = { ...localSeed.bySeq, ...stepDraftsRef.current };
    }

    const hydrateFromSession = (body: VesselSessionApiPayload, customMessage?: string) => {
      if (!body.originId) return;
      window.sessionStorage.setItem(storageKey, body.originId);
      setOriginId(body.originId);
      setIlabUserId(body.uploadMode === 'local-only' ? null : body.userId ?? null);
      sessionSyncTarget.current = '';
      const mode = body.uploadMode ?? 'ilab-remote';
      setUploadMode(mode);
      if (body.auditTelemetry) {
        setAuditTelemetry(body.auditTelemetry);
      }
      setSessionCompleted(body.status === 1);
      setUploadFailed(Boolean(body.retryableUpload));
      if (body.reportHtml) {
        setReportHtml(body.reportHtml);
      }
      const serverSteps = body.steps ?? [];
      setRecords(serverSteps);
      const serverDrafts = body.stepDrafts ?? {};
      const mergedDrafts: Record<string, VesselReadings> = {
        ...stepDraftsRef.current,
        ...serverDrafts,
      };
      stepDraftsRef.current = mergedDrafts;
      const nextSeq = body.draftActiveSeq && body.draftActiveSeq > 0
        ? body.draftActiveSeq
        : body.currentSeq && body.currentSeq > 0
          ? body.currentSeq
          : localSeed.activeSeq ?? 1;
      setActiveSeq(nextSeq);
      setViewSeq(nextSeq);
      setReadings(mergedDrafts[String(nextSeq)] ?? {});
      writeLocalDraftStore(draftStorageKey, { activeSeq: nextSeq, bySeq: mergedDrafts });

      if (customMessage) {
        setMessage(customMessage);
        return;
      }
      if (body.retryableUpload) {
        setMessage('实验成绩和报告已保留，上次实验空间回传暂未成功，请点击“重新回传实验空间”重试。');
        return;
      }
      if (body.status === 1) {
        setMessage('本次实验已完成并生成报告，如需再次测试可点击“开启新一轮实验”。');
        return;
      }
      if (nativeCourse) {
        setMessage('');
        return;
      }
      if (serverSteps.length > 0 || Object.keys(mergedDrafts).length > 0) {
        setMessage(
          mode === 'local-only'
            ? `已恢复上次实验进度（已完成 ${serverSteps.length} 步），继续完成后可保存到账号。`
            : `已连接实验空间并恢复进度（已完成 ${serverSteps.length} 步），完成后将自动回传。`,
        );
        return;
      }
      setMessage(
        mode === 'local-only'
          ? `已连接本平台账号（学生 ${body.displayName ?? ''}），实验步骤与草稿会自动保存。`
          : `已连接实验空间（学生 ${body.displayName ?? ''}），完成全部 ${experiment.steps.length} 步将自动回传。`,
      );
    };

    const openFromSession = async () => {
      const response = await fetch('/api/ilab/vessel/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ experimentKey: experiment.key, ...(nativeCourse ? {experimentVersion: VESSEL_COURSE_VERSION} : {}) }),
      });
      if (!response.ok || cancelled) {
        if (!cancelled && localSeed.activeSeq) {
          setActiveSeq(localSeed.activeSeq);
          setViewSeq(localSeed.activeSeq);
          setReadings(localSeed.bySeq[String(localSeed.activeSeq)] ?? {});
        }
        return;
      }
      const body = await response.json() as VesselSessionApiPayload;
      if (cancelled || !body.connected || !body.originId) {
        if (!cancelled && localSeed.activeSeq) {
          setActiveSeq(localSeed.activeSeq);
          setViewSeq(localSeed.activeSeq);
          setReadings(localSeed.bySeq[String(localSeed.activeSeq)] ?? {});
        }
        return;
      }
      hydrateFromSession(body);
    };

    void (async () => {
      if (ticket) {
        const response = await fetch('/api/ilab/vessel/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ticket, experimentKey: experiment.key, ...(nativeCourse ? {experimentVersion: VESSEL_COURSE_VERSION} : {}) }),
        });
        const body = await response.json() as VesselSessionApiPayload;
        if (cancelled) return;
        if (!response.ok || !body.originId) {
          setMessage(body.error || '票据校验失败，请保留当前链接并刷新重试。');
          return;
        }
        window.history.replaceState(
          null,
          '',
          stripIlabUrlParams(experiment.route, window.location.search),
        );
        clearIlabOriginSessionStorage();
        hydrateFromSession(body);
        setConnectionReady(true);
        setVerifiedTicket(ticket);
        return;
      }
      const stored = window.sessionStorage.getItem(storageKey);
      if (!stored) {
        await openFromSession();
        return;
      }
      const response = await fetch(`/api/ilab/vessel/session/${stored}`);
      if (response.status === 404 || response.status === 400 || response.status === 403) {
        window.sessionStorage.removeItem(storageKey);
        await openFromSession();
        return;
      }
      if (!response.ok) {
        if (!cancelled) setMessage('暂时无法恢复这次实验，请稍后刷新。');
        return;
      }
      const body = await response.json() as VesselSessionApiPayload;
      if (cancelled || !body.originId || !body.steps) return;
      if (nativeCourse && body.experimentVersion !== VESSEL_COURSE_VERSION) {
        window.sessionStorage.removeItem(storageKey);
        await openFromSession();
        return;
      }
      hydrateFromSession(body);
    })().catch((error: unknown) => { if (!cancelled) setMessage(error instanceof Error ? error.message : '实验连接暂时不可用。'); })
      .finally(() => { if (!cancelled) setConnectionReady(true); });
    return () => {
      cancelled = true;
    };
  }, [draftStorageKey, experiment.key, experiment.route, experiment.steps.length, ticket, verifiedTicket, nativeCourse]);

  useEffect(() => {
    if (sessionStatus !== 'authenticated') {
      setPastReports(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const response = await fetch(nativeCourse ? `/api/ilab/experiment-reports?courseKey=${courseAdapter.courseKey}`
        : `/api/simulations/reports?experimentKey=${encodeURIComponent(experiment.key)}`);
      if (!response.ok) return;
      const body = await response.json() as { reports?: Array<VesselReportSummary & {updatedAt?:string}> };
      if (!cancelled) setPastReports((body.reports ?? []).map((report) => ({...report, createdAt: report.createdAt ?? report.updatedAt ?? ''})));
    })();
    return () => {
      cancelled = true;
    };
  }, [experiment.key, nativeCourse, reportRevision, sessionStatus, courseAdapter.courseKey]);

  const updatePageContext = ai?.updatePageContext;
  const clearDynamicPageContext = ai?.clearDynamicPageContext;
  const hudBucket = Math.floor((liveRef.current.time ?? 0) / 5);
  useEffect(() => {
    if (!updatePageContext) return;
    const current = workspace.current;
    const frame = nativeCourse && !tourActive && current?.plan.stepSequence === step.seq ? current.read() : undefined;
    const point = frame ? current?.run()?.trace.at(-1) : undefined;
    const observed = (key: string) => point?.measurements[key]?.quality === 'Good'
      ? point.measurements[key].value ?? undefined : undefined;
    updatePageContext({
      courseId: experiment.courseId,
      courseTitle: experiment.title,
      pageType: 'practice',
      stepId: `${experiment.key}-step-${step.seq}`,
      topic: step.title,
      learningObjectives: [step.goal],
      knowledgeType: 'X',
      simulationId: experiment.vesselId,
      simulationOriginId:
        (nativeCourse && roundOriginRef.current.scope === scopeKey
          ? roundOriginRef.current.originId
          : undefined) ||
        originId ||
        undefined,
      routeProvenance: 'simulation-route',
      simulationObservation: frame ? {
        timeS: point?.timeS ?? frame.timeS,
        loadingRatio: current?.plan.configuration.loadingRatio,
        effectiveGmM: frame.parameters.effectiveGmTransverseM ?? undefined,
        windSideAreaM2: frame.parameters.windAreasM2?.lateral,
        headingDeg: observed('Heading'), waterSpeedMps: observed('SpeedLog'),
        northM: observed('North'), eastM: observed('East'),
        dredgerMode: frame.dredger?.mode,
        dredgerDepthM: observed('DredgerDepth'), dredgerSwayMps: observed('DredgerSwaySpeed'),
        dredgerCutterRpm: observed('DredgerCutterRpm'),
        dredgerPortTensionN: observed('DredgerCableTension0'),
        dredgerStarboardTensionN: observed('DredgerCableTension1'),
        dredgerSpudForceN: observed('DredgerSpudForce'),
      } : undefined,
      systemPromptExtension: vesselKonlingBrief(experiment, step, liveRef.current.time === undefined ? null : liveRef.current),
      quickQuestions: [{
        label: '这一步怎么做',
        question: `我在做${experiment.title}第 ${step.seq} 步「${step.title}」。请给出操作建议，不要替我填写读数，也不要打分。`,
      }],
    });
  }, [experiment, hudBucket, step, updatePageContext, scopeKey, readyScope, originId, nativeCourse, tourActive]);

  const aiTurnSeq = ai?.aiTurnSeq ?? 0;
  useEffect(() => {
    if (aiTurnSeq <= 0 || tourActive) return;
    void refreshAuditTelemetry();
    const timer = window.setTimeout(() => {
      void refreshAuditTelemetry();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [aiTurnSeq, tourActive, refreshAuditTelemetry]);

  useEffect(() => () => {
    clearDynamicPageContext?.();
  }, [clearDynamicPageContext]);

  function courseFailure(error: unknown) {
    setCourseRunning(false);
    if (workspace.current?.plan.scopeKey === scopeRef.current) setReadyScope(scopeRef.current);
    const message = error instanceof Error ? error.message : '这次操作未完成，请读取已保存的运行后继续。';
    setMessage(message);
    void workspace.current?.pause().catch((failure: unknown) => console.error(failure));
  }

  function courseInput(current: VesselCourseWorkspace) {
    const live = courseLive.current;
    return courseAdapter.input(current.plan.stepSequence, live.settings, current.initialInput, current.read(),
      live.models, live.designModelId);
  }

  async function pauseCourseRun() {
    if (tourActiveRef.current) return;
    setCourseRunning(false);
    await workspace.current?.pause();
    await saveCourseDraft();
    await reloadCourseEvidence();
  }

  async function startCourseRun() {
    if (tourActiveRef.current) {
      setMessage('只读高光工况导览模式下严禁运行正式实验工作区，请先退出导览。');
      return;
    }
    if (!nativeCourse || !accountReady || readyScope !== scopeKey || busy
      || courseAdapter.steps[activeSeq - 1].stepKind === 'analysis') return;
    if (getMarineCanvasStatus() !== 'runnable') { setMessage('请等待三维画面就绪后开始。'); return; }
    setBusy(true); setMessage('');
    try {
      let current = workspace.current;
      if (!current) throw new Error('请等待实验初态就绪。');
      if (current.run()?.stoppedAtMs != null) throw new Error('这次运行已结束，请重置后保留新的独立运行。');
      if (JSON.stringify(current.plan.courseSettings) !== JSON.stringify(settings)) {
        if (current.read().timeS > 0) throw new Error('控制方案已随本次运行冻结，请先重置，再应用修订参数。');
        await activateCourseStep(activeSeq, scopeKey, false, settings);
        current = workspace.current!;
      }
      const input = current.run() ? courseInput(current) : current.previewInput(courseInput(current));
      const openingInput = current.run()?.initialInput ?? input;
      if (courseAdapter.requiresForecast?.(activeSeq) && !(await listModelComparisons(scopeKey)).some((comparison) =>
        comparison.runId === plannedRunRef.current && comparison.purpose === 'forecast'
        && comparison.modelId === designModelId && JSON.stringify(comparison.controllerInput) === JSON.stringify(openingInput))) {
        throw new Error('请先冻结与本次方案一致的本人模型预测，再执行本步。');
      }
      await current.start(plannedRunRef.current, readings.prediction ?? '', input, designModelId || undefined);
      await saveCourseDraft();
      setCourseRunning(true);
    } catch (error) { courseFailure(error); }
    finally { setBusy(false); }
  }

  async function resetCourseRun() {
    if (tourActiveRef.current) {
      setMessage('只读高光工况导览模式下严禁重置正式实验工作区，请先退出导览。');
      return;
    }
    if (busy || !accountReady || readyScope !== scopeKey) return;
    setBusy(true);
    try {
      await workspace.current?.pause('student');
      await saveCourseDraft();
      await activateCourseStep(activeSeq, scopeKey, false, settings);
      await saveCourseDraft();
    } catch (error) { courseFailure(error); }
    finally { setBusy(false); }
  }

  async function finishCourseRun() {
    if (tourActiveRef.current) {
      setMessage('只读高光工况导览模式下严禁结束或写入正式实验工作区，请先退出导览。');
      return;
    }
    const current = workspace.current;
    const run = current?.run();
    const canFinish = current && ((current.plan.configuration.berth && current.read().timeS >= 60)
      || (current.plan.configuration.ice && current.plan.configuration.azimuthJamFault && current.read().timeS >= 180));
    if (busy || !canFinish || !current || !run
      || run.stoppedAtMs !== null) return;
    setBusy(true); setCourseRunning(false);
    try {
      await current.pause('student'); await saveCourseDraft(); await reloadCourseEvidence();
      setMessage(current.plan.configuration.ice
        ? '本次故障工况已按实际时刻结束，请解释停桨、停滞、通道与能量记录。'
        : '本次靠泊已按实际时刻结束，请核对停止距离、对地航速、末60秒横偏、航向和液面适用域。');
    } catch (error) { courseFailure(error); }
    finally { setBusy(false); }
  }

  function advanceCourse(seconds: number) {
    if (tourActiveRef.current) return null;
    const current = workspace.current;
    if (!current || !current.running) return current?.read() ?? null;
    try {
      const result = current.advance(seconds, courseInput(current));
      if (result.saved) void result.saved.then(async () => {
        if (workspace.current !== current || current.plan.scopeKey !== scopeRef.current) return;
        await saveCourseDraft();
        if (!current.running) await reloadCourseEvidence();
      }).catch((error: unknown) => { if (workspace.current === current) courseFailure(error); });
      if (!current.running) {
        setCourseRunning(false);
        setMessage(result.frame.berth?.termination?.reason === 'stop_line_crossed'
          ? '船艏已越过停止线，本次未满足靠泊目标，实际轨迹已保留。'
          : '本次运行已结束，请结合完整记录评价目标与约束。');
      }
      return result.frame;
    } catch (error) {
      void current.fail(error instanceof Error ? error.message : '本次数值运行已中断。')
        .then(() => reloadCourseEvidence()).catch(courseFailure);
      courseFailure(error); return current.read();
    }
  }

  async function freezeCoursePrediction() {
    if (tourActiveRef.current) {
      setMessage('只读高光工况导览模式下严禁冻结或修改正式预测工件，请先退出导览。');
      return;
    }
    if (busy || !workspace.current || workspace.current.read().timeS > 0) return;
    setBusy(true);
    try {
      if (JSON.stringify(workspace.current.plan.courseSettings) !== JSON.stringify(settings)) {
        await activateCourseStep(activeSeq, scopeKey, false, settings);
      }
      const current = workspace.current!;
      const model = courseLive.current.models.find((item) => item.id === courseLive.current.designModelId);
      if (!model) throw new Error('请选择本人冻结的局部模型。');
      if (!courseAdapter.forecast) throw new Error('请在评估页签中保存本步骤需要的分析工件。');
      const forecast = courseAdapter.forecast(scopeKey, plannedRunRef.current, current.plan.stepSequence, current.plan.configuration,
        current.plan.durationS, current.previewInput(courseInput(current)), current.read(), model, settings, courseLive.current.models);
      await saveModelComparison(forecast);
      await saveCourseDraft();
      await reloadCourseEvidence();
      setMessage('本人模型预测已冻结，开始对应的独立运行后可上传证据。');
    } catch (error) { courseFailure(error); }
    finally { setBusy(false); }
  }

  async function uploadCourseEvidence() {
    if (activeTourNode) {
      setMessage('只读高光工况导览模式下严禁上传或回传正式证据。');
      return;
    }
    const reportClientRef = reportRef.current;
    if (scopeRef.current !== scopeKey) return;
    const upload = courseUploads.current.catch(() => undefined).then(() => {
      if (scopeRef.current !== scopeKey || tourActiveRef.current) return;
      return uploadVesselCourseArtifacts(reportClientRef, courseAdapter.courseKey, scopeKey);
    });
    courseUploads.current = upload;
    const result = await upload;
    if (scopeRef.current === scopeKey) await reloadCourseEvidence();
    return result;
  }

  async function saveCourseToPlatform() {
    if (activeTourNode || busy || !canUseCloudEvidence || readyScope !== scopeKey) return;
    setBusy(true);
    setMessage('');
    try {
      await pauseCourseRun();
      const saved = await uploadCourseEvidence();
      if (!saved || scopeRef.current !== scopeKey) return;
      await saveVesselCourseDraftToPlatform(courseAdapter.courseKey, scopeKey, reportRef.current, roundOriginRef.current.originId);
      setMessage(saved.pendingCount
        ? '进度已保存到平台。尚未关联运行的预测仍保存在本机。'
        : '已保存到平台，可在其他设备继续本次实验。');
      void refreshAuditTelemetry();
    } catch (error) { courseFailure(error); }
    finally { setBusy(false); }
  }

  async function submitCourseStep() {
    if (activeTourNode) {
      setMessage('只读高光工况导览模式下严禁正式提交或触发成绩回传，请先退出导览。');
      return;
    }
    setBusy(true);
    try {
      await workspace.current?.pause(); setCourseRunning(false);
      await saveCourseDraft();
      const [allRuns, allModels, allComparisons] = await Promise.all([
        listRunEvidence(scopeKey), listFrozenStudentModels(scopeKey), listModelComparisons(scopeKey)]);
      const usedRuns = activeSeq === 20 ? allRuns.filter((run) => reportRunIds.includes(run.id)) : allRuns;
      const definition = courseAdapter.steps[activeSeq - 1];
      const evidenceComparisons = activeSeq === courseAdapter.forecastOnlySequence ? allComparisons.filter((comparison) => comparison.purpose === 'forecast'
        && comparison.runId === plannedRunRef.current && comparison.modelId === designModelId
        && JSON.stringify(workspace.current?.plan.courseSettings) === JSON.stringify(settings)) : allComparisons;
      let problem = courseAdapter.validateEvidence(definition, {runs: usedRuns, models: allModels,
        comparisons: evidenceComparisons.map((item) => ({...item, actualSampleCount: item.actual.length})), answers: readings});
      const runIds = new Set(activeSeq === 20 ? reportRunIds : allRuns.filter((run) => run.stepSequence === activeSeq).map((run) => run.id));
      if (definition.stepKind === 'analysis') for (const model of allModels) for (const training of model.payload.trainingRuns) runIds.add(training.runRef);
      if (activeSeq === courseAdapter.forecastOnlySequence) for (const comparison of evidenceComparisons) runIds.add(comparison.runId);
      const attempt: VesselLocalStepAttempt = {id: crypto.randomUUID(), scopeKey, stepSequence: activeSeq,
        runIds: [...runIds], studentModelIds: allModels.map((model) => model.id),
        comparisonIds: evidenceComparisons.filter((comparison) => runIds.has(comparison.runId)).map((comparison) => comparison.id),
        answers: {...readings}, createdAtMs: Date.now(),
        status: problem ? 'model_mismatch' : 'pending-review', validationFeedback: problem, serverId: null};
      await saveLocalStepAttempt(attempt); await reloadCourseEvidence();
      let uploadFailure: string | null = null;
      if (canUseCloudEvidence) {
        try {
          if (scopeRef.current !== scopeKey) return;
          await uploadCourseEvidence();
          const savedAttempt = (await listLocalStepAttempts(scopeKey)).find((item) => item.id === attempt.id);
          problem = savedAttempt?.validationFeedback ?? problem;
          if (savedAttempt?.serverId && scopeRef.current === scopeKey) {
            await saveVesselCourseDraftToPlatform(courseAdapter.courseKey, scopeKey, reportRef.current,
              roundOriginRef.current.originId, !problem && !doneSeqs.includes(activeSeq) && activeSeq < 20 ? activeSeq + 1 : undefined);
          }
          if (activeSeq === 20 && !problem) {
            const report = await saveVesselCourseReport(reportRef.current, courseAdapter.courseKey, readings as unknown as VesselReportSections, reportRunIds, 'submit');
            savedCourseReportId.current = report.id;
            await syncNativeCourseReport(report.id);
            setReportRevision((value) => value + 1);
          }
        } catch (error) { uploadFailure = error instanceof Error ? error.message : '上传失败，本机证据已保留。'; }
      }
      if (problem) { setMessage(`这次尝试已保留。${problem}`); return; }
      void refreshAuditTelemetry();
      setMessage(`本步证据已保存，各次尝试均会保留，成绩由教师复核。${uploadFailure ? `上传尚未完成。${uploadFailure}` : ''}`);
      if (!doneSeqs.includes(activeSeq) && activeSeq < 20) {
        await activateCourseStep(activeSeq + 1, scopeKey);
        await saveCourseDraft();
      }
    } catch (error) { courseFailure(error); }
    finally { setBusy(false); }
  }

  async function openCourseReport() {
    const reportWindow = window.open('', '_blank');
    try {
      if (savedCourseReportId.current && doneSeqs.includes(20)) {
        const response = await fetch(`/api/ilab/experiment-reports/${savedCourseReportId.current}`);
        const report = await response.json() as { reportHtml?: string; error?: string };
        if (!response.ok || !report.reportHtml) throw new Error(report.error ?? '这份报告暂时无法读取。');
        if (reportWindow) reportWindow.location.href = URL.createObjectURL(new Blob([report.reportHtml], {type: 'text/html;charset=utf-8'}));
        return;
      }
      const [allRuns, allModels, allComparisons] = await Promise.all([
        listRunEvidence(scopeKey), listFrozenStudentModels(scopeKey), listModelComparisons(scopeKey)]);
      const selected = [];
      for (const summary of allRuns.filter((run) => reportRunIds.includes(run.id))) {
        const run = await readRunEvidence(summary.id);
        if (!run || run.stoppedAtMs === null) continue;
        selected.push({id: run.id, stepSequence: run.stepSequence, timeS: run.lastTimeS,
          status: run.stopReason === 'failure' ? 'failed' : 'completed', configuration: run.configuration,
          input: summary.finalInput ?? run.initialInput, ...evaluateVesselHeadingRun(run)});
      }
      const html = buildVesselCourseReportHtml(experiment.title, readings, {runs: selected,
        models: allModels.map((model) => ({id: model.id, label: model.label, payload: model.payload, frozenAtMs: model.createdAtMs})),
        comparisons: allComparisons.filter((comparison) => reportRunIds.includes(comparison.runId))});
      if (reportWindow) reportWindow.location.href = URL.createObjectURL(new Blob([html], {type: 'text/html;charset=utf-8'}));
    } catch (error) { reportWindow?.close(); courseFailure(error); }
  }

  async function openStep(sequence: number) {
    if (activeTourNode) {
      setMessage('只读高光工况导览中，请通过顶部导览节点切换或退出导览后进入正式步骤。');
      return;
    }
    if (!nativeCourse) { setViewSeq(sequence); setActiveSeq(sequence); return; }
    if (busy || readyScope !== scopeKey || assertVesselStepOrder(experiment.steps, doneSeqs, sequence)) return;
    setBusy(true);
    try { await pauseCourseRun(); await activateCourseStep(sequence, scopeKey); await saveCourseDraft(); }
    catch (error) { courseFailure(error); }
    finally { setBusy(false); }
  }

  async function selectCourseRound(nextScope: string) {
    if (tourActiveRef.current) {
      setMessage('只读高光工况导览模式下严禁切换正式实验轮次，请先退出导览。');
      return;
    }
    if (busy || (nextScope !== baseScope && !nextScope.startsWith(`${baseScope}:round:`))) return;
    setBusy(true);
    try {
      await pauseCourseRun();
      setReadyScope('');
      window.localStorage.setItem(`act-vessel-course-round:${baseScope}`, nextScope);
      setRound({base: baseScope, scope: nextScope});
    } catch (error) { courseFailure(error); }
    finally { setBusy(false); }
  }

  async function saveAccountReport(html: string, stored: typeof records): Promise<boolean> {
    if (activeTourNode || sessionStatus !== 'authenticated') return false;
    const response = await fetch('/api/simulations/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        experimentKey: experiment.key,
        reportHtml: html,
        steps: stored.map((item) => ({
          seq: item.seq,
          title: item.title,
          earnedPoints: item.earnedPoints,
          maxPoints: item.maxPoints,
          evaluation: item.evaluation,
          remarks: item.remarks,
        })),
      }),
    });
    if (!response.ok) return false;
    setReportRevision((value) => value + 1);
    return true;
  }

  async function submitStep() {
    if (activeTourNode) {
      setMessage('只读高光工况导览模式下严禁正式提交或触发成绩回传，请先退出导览。');
      return;
    }
    const order = assertVesselStepOrder(experiment.steps, doneSeqs, step.seq);
    if (order) {
      setMessage(order);
      return;
    }
    if (nativeCourse) { await submitCourseStep(); return; }
    const hasSketch = step.fields.some((field) => field.kind === 'sketch');
    const prepared = await applyLocalSketchVerdict(readings, hasSketch, Boolean(originId));
    if (!prepared.ok) {
      setMessage(prepared.message);
      return;
    }
    const storedSamples = thinVesselSamples(withLatestSample(samples, latestSampleRef.current));
    const scored = prepared.skipLocalScore ? null : experiment.score(step, storedSamples, prepared.readings);
    if (scored && !scored.ok) {
      setMessage(scored.message);
      return;
    }
    const record = scored ? {
      seq: step.seq,
      title: step.title,
      earnedPoints: scored.earnedPoints,
      maxPoints: scored.maxPoints,
      evaluation: scored.evaluation,
      remarks: scored.remarks,
      samples: storedSamples,
      readings: prepared.readings,
    } : null;
    const previous = records.find((item) => item.seq === step.seq);
    const chosen = record ? chooseBetterVesselAttempt(previous, record) : null;
    if (chosen?.keptPrevious) {
      setMessage('这次没有超过已保存的成绩，仍保留较好的一次。');
      return;
    }
    const nextRecords = chosen
      ? [...records.filter((item) => item.seq !== step.seq), chosen.record]
      : records;
    const redoing = doneSeqs.includes(step.seq);
    const lastSeq = experiment.steps.length;
    const clearStepDraft = (seqToClear: number) => {
      delete stepDraftsRef.current[String(seqToClear)];
      writeLocalDraftStore(draftStorageKey, { activeSeq, bySeq: stepDraftsRef.current });
    };

    const applyCompleteResponse = async (
      done: Response,
      fallbackSteps: StoredStepRecord[],
    ): Promise<boolean> => {
      const doneBody = await done.json() as {
        error?: string;
        remote?: { message?: string };
        reportSaved?: boolean;
        retryableUpload?: boolean;
        session?: VesselSessionApiPayload;
      };
      if (!done.ok) {
        setUploadFailed(true);
        setMessage(doneBody.error || '实验报告保存或回传失败，请重试。');
        return false;
      }
      const finalSteps = doneBody.session?.steps ?? fallbackSteps;
      const html = doneBody.session?.reportHtml || buildVesselReportHtml(experiment, {
        displayName: session?.user?.name || '本次实验',
        steps: finalSteps,
      });
      setReportHtml(html);
      setRecords(finalSteps);
      if (doneBody.session?.auditTelemetry) {
        setAuditTelemetry(doneBody.session.auditTelemetry);
      }
      const retryable = Boolean(doneBody.retryableUpload);
      setUploadFailed(retryable);
      if (doneBody.session?.status === 1) {
        setSessionCompleted(true);
      }
      if (doneBody.reportSaved) {
        setReportRevision((value) => value + 1);
        setMessage(doneBody.remote?.message || '实验报告已生成并保存到账号。');
        return true;
      }
      const saved = await saveAccountReport(html, finalSteps);
      const remoteMessage = doneBody.remote?.message || '实验报告已生成。';
      setMessage(saved ? `${remoteMessage}报告已保存到账号。` : remoteMessage);
      return true;
    };

    if (originId) {
      setBusy(true);
      try {
        const response = await fetch(`/api/ilab/vessel/session/${originId}/steps`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            experimentKey: experiment.key,
            seq: step.seq,
            readings: prepared.readings,
            sketchImage: prepared.sketchImage,
            samples: storedSamples,
            startedAtMs: stepStartedAt.current,
          }),
        });
        const body = await response.json() as {
          error?: string;
          retryReport?: boolean;
          steps?: StoredStepRecord[];
          auditTelemetry?: VesselAuditTelemetry;
        };
        if (!response.ok && response.status !== 409) {
          setMessage(body.error || '本步保存失败。');
          return;
        }
        if (body.auditTelemetry) {
          setAuditTelemetry(body.auditTelemetry);
        } else if (response.ok) {
          void refreshAuditTelemetry();
        }
        if (response.ok && body.steps) {
          nextRecords.splice(0, nextRecords.length, ...body.steps);
        }
        if (response.status === 409 && body.retryReport) {
          const done = await fetch(`/api/ilab/vessel/session/${originId}/complete`, { method: 'POST' });
          await applyCompleteResponse(done, records);
          clearStepDraft(step.seq);
          setReadings({});
          return;
        } else if (response.status === 409) {
          setSessionCompleted(true);
          if (step.seq === lastSeq) {
            const html = buildVesselReportHtml(experiment, {
              displayName: session?.user?.name || '本次实验',
              steps: nextRecords,
            });
            setReportHtml(html);
            const saved = await saveAccountReport(html, nextRecords);
            setMessage(saved ? '本次实验已经交卷。新的报告已保存到账号。' : '本次实验已经交卷，这次成绩只留在本机。');
          } else {
            setMessage('本次实验已经交卷，这次成绩只留在本机。');
          }
        } else if (step.seq === lastSeq) {
          const done = await fetch(`/api/ilab/vessel/session/${originId}/complete`, { method: 'POST' });
          const ok = await applyCompleteResponse(done, nextRecords);
          if (!ok) return;
        } else {
          setMessage(uploadMode === 'local-only' ? '本步已保存到账号。' : '本步已回传并保存。');
        }
      } finally {
        setBusy(false);
      }
    } else if (step.seq === lastSeq) {
      const html = buildVesselReportHtml(experiment, {
        displayName: session?.user?.name || '本次实验',
        steps: nextRecords,
      });
      setReportHtml(html);
      const saved = await saveAccountReport(html, nextRecords);
      setMessage(saved
        ? '报告已保存到账号。没有实验空间票据，尚未回传。'
        : '报告已在本机生成。没有实验空间票据，尚未回传。登录后可以保存到账号。');
    } else {
      setMessage('本步已记录。没有实验空间票据，尚未回传。');
    }
    clearStepDraft(step.seq);
    setRecords(nextRecords);
    setReadings({});
    if (!redoing && step.seq < lastSeq) {
      setActiveSeq(step.seq + 1);
      setViewSeq(step.seq + 1);
    }
  }

  async function retryIlabUpload() {
    if (activeTourNode) {
      setMessage('只读高光工况导览模式下严禁触发实验空间成绩回传。');
      return;
    }
    if (busy || !originId) return;
    setBusy(true);
    try {
      if (nativeCourse) {
        let reportId = savedCourseReportId.current;
        if (!reportId) {
          const response = await fetch(`/api/ilab/experiment-reports?clientRef=${encodeURIComponent(reportRef.current)}`);
          if (!response.ok) throw new Error('暂时无法读取本轮实验报告，请稍后重试。');
          const body = await response.json() as {reports: Array<{id: string}>};
          reportId = body.reports[0]?.id ?? '';
        }
        if (!reportId) throw new Error('请先提交本轮实验报告。');
        await syncNativeCourseReport(reportId);
        return;
      }
      const done = await fetch(`/api/ilab/vessel/session/${originId}/complete`, { method: 'POST' });
      const doneBody = await done.json() as {
        error?: string;
        remote?: { message?: string };
        reportSaved?: boolean;
        retryableUpload?: boolean;
        session?: VesselSessionApiPayload;
      };
      if (!done.ok) {
        setUploadFailed(true);
        setMessage(doneBody.error || '重新回传实验空间失败，请稍后重试。');
        return;
      }
      if (doneBody.session?.steps) {
        setRecords(doneBody.session.steps);
      }
      if (doneBody.session?.reportHtml) {
        setReportHtml(doneBody.session.reportHtml);
      }
      if (doneBody.session?.auditTelemetry) {
        setAuditTelemetry(doneBody.session.auditTelemetry);
      } else {
        void refreshAuditTelemetry();
      }
      const retryable = Boolean(doneBody.retryableUpload);
      setUploadFailed(retryable);
      if (doneBody.session?.status === 1) {
        setSessionCompleted(true);
      }
      if (doneBody.reportSaved) {
        setReportRevision((value) => value + 1);
      }
      setMessage(doneBody.remote?.message || (retryable ? '实验空间回传仍未成功，请稍后再试。' : '成绩和实验报告已重新回传。'));
    } finally {
      setBusy(false);
    }
  }

  async function syncNativeCourseReport(reportId: string) {
    const result = await triggerCourseReportIlabUpload(reportId,
      roundOriginRef.current.scope === scopeKey ? roundOriginRef.current.originId : null);
    savedCourseReportId.current = reportId;
    setUploadFailed(result.retryableUpload);
    setUploadMode(result.uploadMode);
    if (result.uploaded) setSessionCompleted(true);
    setMessage(result.message);
    void refreshAuditTelemetry(result.originId ?? undefined);
  }

  function openReport() {
    if (nativeCourse) { void openCourseReport(); return; }
    const html = reportHtml || buildVesselReportHtml(experiment, {
      displayName: session?.user?.name || '本次实验',
      steps: records,
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    window.open(URL.createObjectURL(blob), `${experiment.originPrefix}-report`, 'popup,width=960,height=720');
  }

  async function openStoredReport(id: string) {
    const response = await fetch(nativeCourse ? `/api/ilab/experiment-reports/${id}` : `/api/simulations/reports/${id}`);
    const body = await response.json() as { reportHtml?: string; error?: string };
    if (!response.ok || !body.reportHtml) {
      setMessage(body.error || '打不开这份报告。');
      return;
    }
    const blob = new Blob([body.reportHtml], { type: 'text/html;charset=utf-8' });
    window.open(URL.createObjectURL(blob), `${experiment.originPrefix}-report`, 'popup,width=960,height=720');
  }

  async function restartIlabSession() {
    if (activeTourNode) {
      setMessage('只读高光工况导览模式下禁止新建正式实验轮次，请先退出导览。');
      return;
    }
    if (busy) return;
    if (nativeCourse) {
      setBusy(true);
      try {
        await pauseCourseRun();
        setReadyScope('');
        const response = await fetch('/api/ilab/vessel/session', {method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({experimentKey:experiment.key,experimentVersion:VESSEL_COURSE_VERSION,forceNew:true})});
        const body = await response.json() as VesselSessionApiPayload;
        if (!response.ok) throw new Error(body.error ?? '新一轮实验暂时无法建立，原记录已保留。');
        const clientRef = body.reportClientRef ?? crypto.randomUUID();
        const nextScope = `${baseScope}:round:${clientRef}`;
        await saveExperimentDraft({scopeKey:nextScope,stepSequence:1,activeRunId:null,prediction:'',explanation:'',
          durationS:courseAdapter.steps[0].runDurationS ?? 1200,checkpoint:null,runConfiguration:null,
          completedSteps:[],updatedAtMs:Date.now(),reportClientRef:clientRef,originId:body.originId,
          answers:{},reportRunIds:[],plannedRunId:crypto.randomUUID()});
        if (body.connected && body.originId) {
          window.sessionStorage.setItem(`act-vessel-origin:${experiment.key}`,body.originId);
          setOriginId(body.originId);
          setUploadMode(body.uploadMode ?? 'local-only');
        }
        setAuditTelemetry(body.auditTelemetry ?? null);
        savedCourseReportId.current = '';
        stepDraftsRef.current = {};
        setSessionCompleted(false);setUploadFailed(false);setRecords([]);setReportHtml('');
        window.localStorage.setItem(`act-vessel-course-round:${baseScope}`, nextScope);
        setRound({base: baseScope, scope: nextScope});
      } catch (error) { courseFailure(error); }
      finally { setBusy(false); }
      return;
    }
    setBusy(true);
    try {
      window.sessionStorage.removeItem(`act-vessel-origin:${experiment.key}`);
      window.localStorage.removeItem(draftStorageKey);
      stepDraftsRef.current = {};
      setOriginId('');
      setSessionCompleted(false);
      setUploadFailed(false);
      setRecords([]);
      setReadings({});
      setReportHtml('');
      clearSamples();
      setActiveSeq(1);
      setViewSeq(1);
      const response = await fetch('/api/ilab/vessel/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ experimentKey: experiment.key, forceNew: true, ...(nativeCourse ? {experimentVersion: VESSEL_COURSE_VERSION} : {}) }),
      });
      const body = await response.json() as VesselSessionApiPayload;
      if (response.ok && body.connected && body.originId) {
        window.sessionStorage.setItem(`act-vessel-origin:${experiment.key}`, body.originId);
        setOriginId(body.originId);
        setUploadMode(body.uploadMode ?? 'ilab-remote');
        setAuditTelemetry(body.auditTelemetry ?? null);
        setSessionCompleted(body.status === 1);
        setUploadFailed(Boolean(body.retryableUpload));
        setMessage(`已开启新一轮实验（学生 ${body.displayName ?? ''}），请从第 1 步开始。`);
        return;
      }
      setAuditTelemetry(null);
      setMessage(body.error || '已重置本机实验记录，请从第 1 步开始。');
    } finally {
      setBusy(false);
    }
  }

  const command = useMemo(() => experiment.command(step, 0), [experiment, step]);
  const onArtifactsChange = useCallback((nextModels: FrozenVesselStudentModel[], nextComparisons: VesselModelComparison[], scope: string) => {
    if (tourActiveRef.current || scopeRef.current !== scope) return;
    setModels(nextModels); setComparisons(nextComparisons);
  }, []);

  return {
    step,
    viewed,
    activeSeq: displayActiveSeq,
    viewSeq: displayViewSeq,
    openStep,
    samples,
    shownSamples,
    observe,
    trackLatest,
    clearSamples,
    readings: effectiveReadings,
    setReading: (key: string, value: string) => {
      if (activeTourNode) {
        setTourReadingsMap((prev) => ({
          ...prev,
          [activeTourNode.id]: {
            ...(prev[activeTourNode.id] ?? activeTourNode.readings),
            [key]: value,
          },
        }));
        return;
      }
      setReadings((prev) => {
        const next = { ...prev, [key]: value };
        stepDraftsRef.current = { ...stepDraftsRef.current, [String(activeSeq)]: next };
        return next;
      });
    },
    originId,
    auditTelemetry,
    refreshAuditTelemetry,
    tour: {
      active: tourActive,
      node: activeTourNode,
      enter: enterHighlightTour,
      exit: exitHighlightTour,
    },
    message,
    connectionStatus: originId ? describeIlabConnection(uploadMode) : '',
    busy: busy || awaitingIlabIdentity,
    sessionCompleted,
    uploadFailed,
    retryIlabUpload,
    submitStep,
    openReport,
    openStoredReport,
    restartIlabSession,
    pastReports,
    sessionStatus,
    seriesVisible,
    toggleSeries: (id: string) => setSeriesVisible((prev) => ({ ...prev, [id]: prev[id] === false })),
    doneSeqs,
    earnedPoints: nativeCourse ? null : records.reduce((sum, record) => sum + record.earnedPoints, 0),
    maxPoints: experiment.steps.reduce((sum, item) => sum + item.maxPoints, 0),
    reportEnabled,
    command,
    liveRef,
    ask: () => ai?.openSidebar(),
    course: nativeCourse
      ? activeTourNode
        ? {
            scopeKey: `tour-readonly:${activeTourNode.id}`,
            plannedRunId: 'tour-planned-run',
            ready: false,
            running: false,
            canSelectRound: false,
            rounds: [] as VesselExperimentDraft[],
            selectRound: selectCourseRound,
            settings: tourSettings,
            setSettings: setTourSettings,
            designModelId: tourDesignModelId,
            setDesignModelId: setTourDesignModelId,
            reportRunIds: tourReportRunIds,
            setReportRunIds: setTourReportRunIds,
            models: activeTourNode.models,
            comparisons: activeTourNode.comparisons,
            runs: [] as VesselRunSummary[],
            onArtifactsChange,
            hasStarted: false,
            completed: false,
            canFinish: false,
            finish: finishCourseRun,
            read: (): ReturnType<VesselCourseWorkspace['read']> | null => null,
            latestPoint: (): VesselRunEvidence['trace'][number] | undefined => undefined,
            start: startCourseRun,
            pause: async () => undefined,
            reset: resetCourseRun,
            advance: (_seconds: number): ReturnType<typeof advanceCourse> => null,
            freezePrediction: freezeCoursePrediction,
            upload: saveCourseToPlatform, canSaveToPlatform: false,
          }
        : {
            scopeKey, plannedRunId: plannedRunRef.current, ready: accountReady && readyScope === scopeKey, running: courseRunning,
            canSelectRound: accountReady && connectionReady && (readyScope === scopeKey || recoveryFailed),
            rounds, selectRound: selectCourseRound,
            settings, setSettings, designModelId, setDesignModelId, reportRunIds, setReportRunIds,
            models: models.filter((model) => model.scopeKey === scopeKey),
            comparisons: comparisons.filter((comparison) => comparison.scopeKey === scopeKey),
            runs: runs.filter((run) => run.scopeKey === scopeKey), onArtifactsChange,
            hasStarted: Boolean(workspace.current?.run()),
            completed: workspace.current?.run()?.stoppedAtMs != null,
            canFinish: Boolean(workspace.current && ((workspace.current.plan.configuration.berth && workspace.current.read().timeS >= 60)
              || (workspace.current.plan.configuration.ice && workspace.current.plan.configuration.azimuthJamFault && workspace.current.read().timeS >= 180))
              && workspace.current.run()?.stoppedAtMs === null), finish: finishCourseRun,
            read: (): ReturnType<VesselCourseWorkspace['read']> | null => workspace.current?.read() ?? null,
            latestPoint: (): VesselRunEvidence['trace'][number] | undefined => workspace.current?.run()?.trace.at(-1),
            start: startCourseRun, pause: () => pauseCourseRun().catch(courseFailure), reset: resetCourseRun, advance: advanceCourse,
            freezePrediction: freezeCoursePrediction, upload: saveCourseToPlatform, canSaveToPlatform: canUseCloudEvidence,
          }
      : undefined,
  };
}

export type VesselExperimentController<Settings extends object = LngCourseSettings> = ReturnType<typeof useVesselExperiment<Settings>>;
