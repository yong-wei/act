'use client';

import { useEffect, useMemo, useState } from 'react';

import { useGlobalAI } from '@/components/providers/global-ai-provider';
import { ILAB_RESOURCE_LINKS } from '@/features/ilab/lab-resources';
import type { IlabSessionView } from '@/features/ilab/session-service';
import { ILAB_EXPERIMENT_TITLE, ILAB_STEPS, type IlabStepDefinition, type IlabStepField } from '@/features/ilab/steps';
import { ILAB_VESSELS, isIlabVesselId, type IlabVessel } from '@/features/ilab/vessels';
import { SketchPad } from '@/resources/simulations/simulations/sketch-pad';

import { IlabDockSteps } from './ilab-dock-steps';
import { ShipStage } from './ship-stage';

const STORAGE_KEY = 'ilab-deep-sea-origin';

function visibleFields(step: IlabStepDefinition, vessel: IlabVessel | null): IlabStepField[] {
  if (!vessel) return step.fields;
  if (step.seq === 2) return vessel.nomoto ? step.fields.filter((field) => field.key !== 'modelKind') : step.fields.filter((field) => field.key === 'modelKind');
  if (step.seq === 5) {
    const keys = vessel.nomoto ? ['commandDeg', 'yawRateDeg', 'headingChangeDeg'] : ['environmentForceKn', 'driftM'];
    return step.fields.filter((field) => keys.includes(field.key));
  }
  if (step.seq === 6) return vessel.nomoto ? step.fields.filter((field) => field.key !== 'displacementT') : step.fields.filter((field) => field.key === 'displacementT');
  return step.fields;
}

async function runNomoto(input: {
  vessel: IlabVessel;
  mode: 'open-loop' | 'closed-loop';
  commandDeg: number;
  kp: number;
  ki: number;
  kd: number;
}): Promise<{ yawRateDeg: number; headingChangeDeg: number; overshootPct: number; settlingTimeS: number; samples: number[] }> {
  const { createNomotoState, nomotoStepRK4 } = await import('@/resources/simulations/physics/simulation-engine-facade');
  if (!input.vessel.nomoto) throw new Error('这艘船没有航向参考模型。');
  const dt = 1 / 60;
  const params = {
    K: input.vessel.nomoto.K,
    T: input.vessel.nomoto.T,
    maxRudderDeg: input.vessel.actuator === 'rudder' ? input.vessel.nomoto.maxRudderDeg : 35,
    speedMps: input.vessel.nomoto.speedMps,
  };
  let state = createNomotoState();
  const duration = input.mode === 'open-loop' ? Math.max(30, input.vessel.nomoto.T * 4) : 120;
  const steps = Math.ceil(duration / dt);
  let integral = 0;
  let previousError = 0;
  const samples: number[] = [];
  for (let index = 0; index < steps; index += 1) {
    const headingDeg = state.headingRad * 180 / Math.PI;
    let rudder = input.commandDeg;
    if (input.mode === 'closed-loop') {
      const error = 10 - headingDeg;
      integral += error * dt;
      const derivative = (error - previousError) / dt;
      previousError = error;
      rudder = input.kp * error + input.ki * integral + input.kd * derivative;
    }
    state = nomotoStepRK4(state, rudder, dt, params);
    if ((index + 1) % 60 === 0) samples.push(Number((state.headingRad * 180 / Math.PI).toFixed(3)));
  }
  const yawRateDeg = state.yawRateRad * 180 / Math.PI;
  const headingChangeDeg = state.headingRad * 180 / Math.PI;
  const extreme = samples.reduce((current, value) => (Math.abs(value) > Math.abs(current) ? value : current), samples[0] ?? 0);
  const overshootPct = Math.max(0, (Math.abs(extreme) - 10) / 10 * 100);
  let settlingTimeS = samples.length;
  for (let index = 0; index < samples.length; index += 1) {
    if (samples.slice(index).every((value) => Math.abs(value - 10) <= 2)) {
      settlingTimeS = index;
      break;
    }
  }
  return {
    yawRateDeg: Number(yawRateDeg.toFixed(4)),
    headingChangeDeg: Number(headingChangeDeg.toFixed(3)),
    overshootPct: Number(overshootPct.toFixed(2)),
    settlingTimeS,
    samples: samples.slice(0, 120),
  };
}

export function DeepSeaControlExperiment({ initialTicket }: { initialTicket: string }) {
  const { updatePageContext, openSidebar } = useGlobalAI();
  const [session, setSession] = useState<IlabSessionView | null>(null);
  const [seq, setSeq] = useState(1);
  const [values, setValues] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<string[]>([]);
  const [samplesText, setSamplesText] = useState('');
  const [sketchImage, setSketchImage] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [openedAt, setOpenedAt] = useState(() => Date.now());
  const step = ILAB_STEPS[seq - 1] ?? ILAB_STEPS[0];
  const vessel = session && isIlabVesselId(session.vesselId) ? ILAB_VESSELS[session.vesselId] : null;
  const fields = useMemo(() => visibleFields(step, vessel), [step, vessel]);
  const saved = session?.steps.find((item) => item.seq === step.seq) ?? null;

  useEffect(() => {
    updatePageContext({
      courseId: 'ilab-deep-sea-control',
      courseTitle: ILAB_EXPERIMENT_TITLE,
      stepId: `ilab-step-${step.seq}`,
      pageType: 'practice',
      topic: step.title,
      learningObjectives: [step.goal],
      systemPromptExtension: step.konlingHint ?? `当前实验步骤：${step.title}。${step.goal}`,
      quickQuestions: [{ label: '这一步看什么', question: `我在做「${step.title}」。请只根据这一步的目标提示我该观察什么，不要代写结论，也不要打分。` }],
    });
  }, [step, updatePageContext]);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (!initialTicket && stored) {
      void loadSession(stored);
      return;
    }
    if (!initialTicket) return;
    void createSession(initialTicket);
    // The ticket is single use for this page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTicket]);

  useEffect(() => {
    setOpenedAt(Date.now());
    setSketchImage('');
  }, [seq]);

  async function loadSession(originId: string) {
    const response = await fetch(`/api/ilab/session/${originId}`);
    if (!response.ok) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    setSession(await response.json() as IlabSessionView);
  }

  async function createSession(ticket: string) {
    setBusy(true);
    setMessage('正在校验实验空间票据。');
    try {
      const response = await fetch('/api/ilab/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ticket }),
      });
      const body = await response.json() as IlabSessionView & { error?: string };
      if (!response.ok) throw new Error(body.error || '票据校验失败。');
      window.sessionStorage.setItem(STORAGE_KEY, body.originId);
      window.history.replaceState(null, '', '/ilab/deep-sea-control');
      setSession(body);
      setMessage(`已进入实验，学生 ${body.displayName}。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '票据校验失败。');
    } finally {
      setBusy(false);
    }
  }

  function setField(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function simulate() {
    if (!vessel || step.simulation === 'none') return;
    setBusy(true);
    setMessage('正在用现有航向模型推进。');
    try {
      const result = await runNomoto({
        vessel,
        mode: step.simulation,
        commandDeg: Number(values.commandDeg || 10),
        kp: Number(values.kp || vessel.pid.kp),
        ki: Number(values.ki || vessel.pid.ki),
        kd: Number(values.kd || vessel.pid.kd),
      });
      setValues((current) => ({
        ...current,
        yawRateDeg: String(result.yawRateDeg),
        headingChangeDeg: String(result.headingChangeDeg),
        overshootPct: String(result.overshootPct),
        settlingTimeS: String(result.settlingTimeS),
      }));
      setSamplesText(result.samples.join(','));
      setMessage(`仿真完成。转艏角速度 ${result.yawRateDeg} °/s，超调 ${result.overshootPct}%。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '航向模型没有就绪，可以改为手填读数。');
    } finally {
      setBusy(false);
    }
  }

  async function submitStep() {
    if (!session) {
      setMessage('还没有实验票据，不能提交。');
      return;
    }
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.kind === 'checks') payload[field.key] = checked;
      else if (field.kind === 'number') payload[field.key] = values[field.key] ?? '';
      else payload[field.key] = values[field.key] ?? '';
    }
    if (step.seq === 7 || step.seq === 14) {
      const samples = samplesText.split(/[，,\s]+/).map(Number).filter((item) => Number.isFinite(item));
      payload.samples = samples;
      payload.sampleDtS = 1;
    }
    if (step.seq === 10 || step.seq === 11) {
      if (!sketchImage.startsWith('data:image/')) {
        setMessage('请先在画布上画出曲线。');
        return;
      }
      payload.sketchImage = sketchImage;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/ilab/session/${session.originId}/steps`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seq: step.seq, payload, startedAtMs: openedAt }),
      });
      const body = await response.json() as IlabSessionView & { error?: string };
      if (!response.ok) throw new Error(body.error || '步骤没有保存。');
      setSession(body);
      const current = body.steps.find((item) => item.seq === step.seq);
      setMessage(current ? `${current.evaluation} ${current.remarks}` : '步骤已保存。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '步骤没有保存。');
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!session) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/ilab/session/${session.originId}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          reflection: values.reflection || '',
          pretestNote: window.sessionStorage.getItem('ilab-deep-sea-pretest') || '',
          paperNote: window.sessionStorage.getItem('ilab-deep-sea-paper') || '',
        }),
      });
      const body = await response.json() as { error?: string; session?: IlabSessionView; remote?: { message?: string } };
      if (!response.ok) throw new Error(body.error || '实验没有完成。');
      if (body.session) setSession(body.session);
      setMessage(body.remote?.message || '实验已完成。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '实验没有完成。');
    } finally {
      setBusy(false);
    }
  }

  const earned = session?.steps.reduce((sum, item) => sum + item.earnedPoints, 0) ?? 0;
  const vesselSpec = vessel
    ? `船型 ${vessel.name}，船长 ${vessel.lengthM} 米，排水量 ${vessel.displacementT} 吨。${vessel.nomoto ? `参考读数 K ${vessel.nomoto.K}，T ${vessel.nomoto.T} 秒。` : '这艘平台用动力定位。'}`
    : '';
  const hostBrief = {
    seq: step.seq,
    title: step.title,
    goal: step.goal,
    watch: `${step.stageName}，建议 ${step.minutes} 分钟。`,
    hint: vesselSpec ? `${step.guidance} ${vesselSpec}` : step.guidance,
  };
  const fieldClass = 'mt-1 w-full rounded-md border border-platform-border bg-platform-surface px-2 py-1 text-sm text-platform-fg-primary';

  return (
    <main className="h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="mx-auto flex h-full max-w-[1600px] flex-col px-4 py-3">
        <div className="mb-3 flex shrink-0 flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs tracking-wide text-amber-200">实验空间 · 船舶嵌入 · 24 步</p>
            <h1 className="text-xl font-semibold">{ILAB_EXPERIMENT_TITLE}</h1>
          </div>
          <p className="text-sm text-slate-300">{session ? `${session.displayName} · 操作分 ${earned}` : '等待票据'}</p>
        </div>
        <details className="mb-3 shrink-0 rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
          <summary className="cursor-pointer text-sm text-amber-200">实验资源</summary>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {ILAB_RESOURCE_LINKS.map((link) => (
              <li key={link.href}>
                <a className="block rounded border border-slate-800 px-2 py-2 hover:border-amber-200" href={link.href}>
                  <span className="block text-sm">{link.title}</span>
                  <span className="block text-xs text-slate-400">{link.note}</span>
                </a>
              </li>
            ))}
          </ul>
        </details>
        <div className="min-h-0 flex-1">
          <ShipStage
            vesselId={vessel?.id ?? null}
            seq={step.seq}
            hostBrief={hostBrief}
            stepNav={(
              <IlabDockSteps
                seq={step.seq}
                records={session?.steps}
                onOpen={setSeq}
              />
            )}
            hostSubmission={(
              <div className="space-y-3 text-xs text-platform-fg-secondary">
                <p>{session ? `${session.displayName} · 操作分 ${earned}` : '等待票据'}</p>
                <p>{message || '从实验空间打开后，地址里会带有票据。'}</p>
                {saved ? <p className="text-platform-fg-primary">{saved.evaluation} {saved.remarks}</p> : null}
                {fields.map((field) => (
                  <label key={field.key} className="block space-y-1">
                    <span>{field.label}{field.unit ? `（${field.unit}）` : ''}</span>
                    {field.kind === 'select' ? (
                      <select
                        className={fieldClass}
                        value={values[field.key] ?? ''}
                        onChange={(event) => setField(field.key, event.target.value)}
                      >
                        <option value="">请选择</option>
                        {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    ) : null}
                    {field.kind === 'checks' ? (
                      <span className="mt-1 block space-y-1">
                        {field.options?.map((option) => (
                          <label key={option.value} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked.includes(option.value)}
                              onChange={(event) => {
                                setChecked((current) => event.target.checked ? [...current, option.value] : current.filter((item) => item !== option.value));
                              }}
                            />
                            {option.label}
                          </label>
                        ))}
                      </span>
                    ) : null}
                    {field.kind === 'number' ? (
                      <input
                        type="number"
                        min={field.min}
                        max={field.max}
                        step={field.step ?? 'any'}
                        aria-label={field.label}
                        className={fieldClass}
                        value={values[field.key] ?? ''}
                        onChange={(event) => setField(field.key, event.target.value)}
                      />
                    ) : null}
                    {field.kind === 'text' ? (
                      <textarea
                        aria-label={field.label}
                        className={`${fieldClass} min-h-24`}
                        value={values[field.key] ?? ''}
                        onChange={(event) => setField(field.key, event.target.value)}
                      />
                    ) : null}
                  </label>
                ))}
                {(step.seq === 7 || step.seq === 14) ? (
                  <label className="block space-y-1">
                    <span>采样点，用逗号分隔</span>
                    <textarea className={`${fieldClass} min-h-20`} value={samplesText} onChange={(event) => setSamplesText(event.target.value)} />
                  </label>
                ) : null}
                {(step.seq === 10 || step.seq === 11) ? (
                  <SketchPad
                    key={step.seq}
                    label="手绘曲线"
                    hint={step.seq === 10 ? '请手绘奈奎斯特图。' : '请手绘伯德图。'}
                    onChange={setSketchImage}
                  />
                ) : null}
                {samplesText ? <p>已记录 {samplesText.split(',').filter(Boolean).length} 个采样点。</p> : null}
                {step.simulation !== 'none' && vessel?.nomoto ? (
                  <button type="button" disabled={busy} onClick={() => void simulate()} className="w-full rounded-md border border-platform-border px-3 py-2 text-sm disabled:opacity-50">写入航向采样</button>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy || !session || session.status === 1} onClick={() => void submitStep()} className="rounded-md bg-platform-action-primary px-3 py-2 text-sm font-medium text-platform-fg-inverse disabled:opacity-50">提交本步</button>
                  <button type="button" onClick={openSidebar} className="rounded-md border border-platform-border px-3 py-2 text-sm">问控灵这一步</button>
                  {step.seq === 24 ? (
                    <button type="button" disabled={busy || !session} onClick={() => void finish()} className="rounded-md border border-platform-border px-3 py-2 text-sm disabled:opacity-50">生成报告并回传</button>
                  ) : null}
                </div>
                {session?.reportReady ? (
                  <a className="block text-platform-action-primary" href={`/api/ilab/session/${session.originId}?report=1`}>查看实验报告</a>
                ) : null}
              </div>
            )}
          />
        </div>
      </div>
    </main>
  );
}

