'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';

import { useOptionalGlobalAI } from '@/components/providers/global-ai-provider';
import { applyLocalSketchVerdict } from '@/features/ilab/sketch-client';
import {
  assertVesselStepOrder,
  buildVesselReportHtml,
  chooseBetterVesselAttempt,
  thinVesselSamples,
  vesselKonlingBrief,
  type VesselExperiment,
  type VesselReadings,
  type VesselSample,
} from './vessel-experiment';

export interface VesselReportSummary {
  id: string;
  score: number;
  maxScore: number;
  createdAt: string;
}

export function useVesselExperiment(experiment: VesselExperiment, ticket = '') {
  const ai = useOptionalGlobalAI();
  const { data: session, status: sessionStatus } = useSession();
  const [activeSeq, setActiveSeq] = useState(1);
  const [viewSeq, setViewSeq] = useState(1);
  const [samples, setSamples] = useState<VesselSample[]>([]);
  const [records, setRecords] = useState<Array<{
    seq: number;
    title: string;
    earnedPoints: number;
    maxPoints: number;
    evaluation: string;
    remarks: string;
    samples: VesselSample[];
    readings: VesselReadings;
  }>>([]);
  const [readings, setReadings] = useState<VesselReadings>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [originId, setOriginId] = useState('');
  const [reportHtml, setReportHtml] = useState('');
  const [pastReports, setPastReports] = useState<VesselReportSummary[] | null>(null);
  const [reportRevision, setReportRevision] = useState(0);
  const [seriesVisible, setSeriesVisible] = useState<Record<string, boolean>>(
    () => Object.fromEntries(experiment.series.map((series) => [series.id, true])),
  );
  const stepStartedAt = useRef(Date.now());
  const liveRef = useRef<Record<string, number>>({});

  const step = experiment.steps[activeSeq - 1] ?? experiment.steps[0];
  const viewed = experiment.steps[viewSeq - 1] ?? step;
  const doneSeqs = records.map((record) => record.seq);
  const viewedRecord = records.find((record) => record.seq === viewSeq);
  const shownSamples = viewSeq === activeSeq ? samples : viewedRecord?.samples ?? [];
  const reportEnabled = records.some((record) => record.seq === experiment.steps.length) || Boolean(reportHtml);

  const clearSamples = useCallback(() => {
    setSamples([]);
    stepStartedAt.current = Date.now();
  }, []);

  const observe = useCallback((sample: VesselSample) => {
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
    setReadings({});
    setSamples([]);
    stepStartedAt.current = Date.now();
  }, [activeSeq]);

  useEffect(() => {
    const storageKey = `act-vessel-origin:${experiment.key}`;
    let cancelled = false;
    void (async () => {
      if (ticket) {
        const response = await fetch('/api/ilab/vessel/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ticket, experimentKey: experiment.key }),
        });
        const body = await response.json() as { originId?: string; displayName?: string; error?: string };
        if (cancelled) return;
        if (!response.ok || !body.originId) {
          setMessage(body.error || '票据校验失败，本次只在本机记录。');
          return;
        }
        window.sessionStorage.setItem(storageKey, body.originId);
        setOriginId(body.originId);
        window.history.replaceState(null, '', experiment.route);
        setMessage(`已进入实验，学生 ${body.displayName ?? ''}。`);
        return;
      }
      const stored = window.sessionStorage.getItem(storageKey);
      if (!stored) return;
      const response = await fetch(`/api/ilab/vessel/session/${stored}`);
      if (response.status === 404 || response.status === 400) {
        window.sessionStorage.removeItem(storageKey);
        return;
      }
      if (!response.ok) {
        if (!cancelled) setMessage('暂时无法恢复这次实验，请稍后刷新。');
        return;
      }
      const body = await response.json() as {
        originId?: string;
        currentSeq?: number;
        steps?: Array<{
          seq: number;
          title: string;
          earnedPoints: number;
          maxPoints: number;
          evaluation: string;
          remarks: string;
          readings: VesselReadings;
          samples: VesselSample[];
        }>;
      };
      if (cancelled || !body.originId || !body.steps) return;
      setOriginId(body.originId);
      setRecords(body.steps);
      const nextSeq = body.currentSeq && body.currentSeq > 0 ? body.currentSeq : 1;
      setActiveSeq(nextSeq);
      setViewSeq(nextSeq);
      setMessage('已恢复这次实验已保存的步骤。');
    })();
    return () => {
      cancelled = true;
    };
  }, [experiment.key, experiment.route, ticket]);

  useEffect(() => {
    if (sessionStatus !== 'authenticated') {
      setPastReports(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const response = await fetch(`/api/simulations/reports?experimentKey=${encodeURIComponent(experiment.key)}`);
      if (!response.ok) return;
      const body = await response.json() as { reports?: VesselReportSummary[] };
      if (!cancelled) setPastReports(body.reports ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [experiment.key, reportRevision, sessionStatus]);

  const updatePageContext = ai?.updatePageContext;
  const clearDynamicPageContext = ai?.clearDynamicPageContext;
  const hudBucket = Math.floor((liveRef.current.time ?? 0) / 5);
  useEffect(() => {
    if (!updatePageContext) return;
    updatePageContext({
      courseId: experiment.courseId,
      courseTitle: experiment.title,
      pageType: 'practice',
      stepId: `${experiment.key}-step-${step.seq}`,
      topic: step.title,
      learningObjectives: [step.goal],
      knowledgeType: 'X',
      simulationId: experiment.vesselId,
      routeProvenance: 'simulation-route',
      systemPromptExtension: vesselKonlingBrief(experiment, step, liveRef.current.time === undefined ? null : liveRef.current),
      quickQuestions: [{
        label: '这一步怎么做',
        question: `我在做${experiment.title}第 ${step.seq} 步「${step.title}」。请给出操作建议，不要替我填写读数，也不要打分。`,
      }],
    });
  }, [experiment, hudBucket, step, updatePageContext]);

  useEffect(() => () => {
    clearDynamicPageContext?.();
  }, [clearDynamicPageContext]);

  async function saveAccountReport(html: string, stored: typeof records): Promise<boolean> {
    if (sessionStatus !== 'authenticated') return false;
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
    const order = assertVesselStepOrder(experiment.steps, doneSeqs, step.seq);
    if (order) {
      setMessage(order);
      return;
    }
    const hasSketch = step.fields.some((field) => field.kind === 'sketch');
    const prepared = await applyLocalSketchVerdict(readings, hasSketch, Boolean(originId));
    if (!prepared.ok) {
      setMessage(prepared.message);
      return;
    }
    const storedSamples = thinVesselSamples(samples);
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
          steps?: Array<{
            seq: number;
            title: string;
            earnedPoints: number;
            maxPoints: number;
            evaluation: string;
            remarks: string;
            readings: VesselReadings;
            samples: VesselSample[];
          }>;
        };
        if (!response.ok && response.status !== 409) {
          setMessage(body.error || '本步回传失败。');
          return;
        }
        if (response.ok && body.steps) {
          nextRecords.splice(0, nextRecords.length, ...body.steps);
        }
        if (response.status === 409 && body.retryReport) {
          const done = await fetch(`/api/ilab/vessel/session/${originId}/complete`, { method: 'POST' });
          const doneBody = await done.json() as {
            error?: string;
            remote?: { message?: string };
            session?: { steps?: typeof records };
          };
          if (!done.ok) {
            setMessage(doneBody.error || '实验报告回传失败。');
            return;
          }
          const frozenSteps = doneBody.session?.steps ?? records;
          const html = buildVesselReportHtml(experiment, {
            displayName: session?.user?.name || '本次实验',
            steps: frozenSteps,
          });
          setReportHtml(html);
          const saved = await saveAccountReport(html, frozenSteps);
          const remoteMessage = doneBody.remote?.message || '实验报告已生成。';
          setMessage(saved ? `${remoteMessage}报告已保存到账号。` : remoteMessage);
          setRecords(frozenSteps);
          setReadings({});
          return;
        } else if (response.status === 409) {
          if (step.seq === lastSeq) {
            const html = buildVesselReportHtml(experiment, {
              displayName: session?.user?.name || '本次实验',
              steps: nextRecords,
            });
            setReportHtml(html);
            const saved = await saveAccountReport(html, nextRecords);
            setMessage(saved ? '实验空间已经交卷。新的报告已保存到账号。' : '实验空间已经交卷，这次成绩只留在本机。');
          } else {
            setMessage('实验空间已经交卷，这次成绩只留在本机。');
          }
        } else if (step.seq === lastSeq) {
          const done = await fetch(`/api/ilab/vessel/session/${originId}/complete`, { method: 'POST' });
          const doneBody = await done.json() as { error?: string; remote?: { message?: string } };
          if (!done.ok) {
            setMessage(doneBody.error || '实验报告回传失败。');
            return;
          }
          const html = buildVesselReportHtml(experiment, {
            displayName: session?.user?.name || '本次实验',
            steps: nextRecords,
          });
          setReportHtml(html);
          const saved = await saveAccountReport(html, nextRecords);
          const remoteMessage = doneBody.remote?.message || '实验报告已生成。';
          setMessage(saved ? `${remoteMessage}报告已保存到账号。` : remoteMessage);
        } else {
          setMessage('本步已回传。');
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
    setRecords(nextRecords);
    setReadings({});
    if (!redoing && step.seq < lastSeq) {
      setActiveSeq(step.seq + 1);
      setViewSeq(step.seq + 1);
    }
  }

  function openReport() {
    const html = reportHtml || buildVesselReportHtml(experiment, {
      displayName: session?.user?.name || '本次实验',
      steps: records,
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    window.open(URL.createObjectURL(blob), `${experiment.originPrefix}-report`, 'popup,width=960,height=720');
  }

  async function openStoredReport(id: string) {
    const response = await fetch(`/api/simulations/reports/${id}`);
    const body = await response.json() as { reportHtml?: string; error?: string };
    if (!response.ok || !body.reportHtml) {
      setMessage(body.error || '打不开这份报告。');
      return;
    }
    const blob = new Blob([body.reportHtml], { type: 'text/html;charset=utf-8' });
    window.open(URL.createObjectURL(blob), `${experiment.originPrefix}-report`, 'popup,width=960,height=720');
  }

  const command = useMemo(() => experiment.command(step, 0), [experiment, step]);

  return {
    step,
    viewed,
    activeSeq,
    viewSeq,
    openStep: (seq: number) => {
      setViewSeq(seq);
      setActiveSeq(seq);
    },
    samples,
    shownSamples,
    observe,
    clearSamples,
    readings,
    setReading: (key: string, value: string) => setReadings((prev) => ({ ...prev, [key]: value })),
    message,
    busy,
    submitStep,
    openReport,
    openStoredReport,
    pastReports,
    sessionStatus,
    seriesVisible,
    toggleSeries: (id: string) => setSeriesVisible((prev) => ({ ...prev, [id]: prev[id] === false })),
    doneSeqs,
    earnedPoints: records.reduce((sum, record) => sum + record.earnedPoints, 0),
    maxPoints: experiment.steps.reduce((sum, item) => sum + item.maxPoints, 0),
    reportEnabled,
    command,
    liveRef,
    ask: () => ai?.openSidebar(),
  };
}

export type VesselExperimentController = ReturnType<typeof useVesselExperiment>;
