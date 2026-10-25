'use client';

import { useEffect, useMemo, useState, type PointerEvent } from 'react';

import { useGlobalAI } from '@/components/providers/global-ai-provider';
import { ILAB_RESOURCE_LINKS } from '@/features/ilab/lab-resources';
import type { IlabSessionView } from '@/features/ilab/session-service';
import { ILAB_EXPERIMENT_TITLE, ILAB_STEPS, type IlabStepDefinition, type IlabStepField } from '@/features/ilab/steps';
import { ILAB_VESSELS, isIlabVesselId, type IlabVessel } from '@/features/ilab/vessels';

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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[1600px] px-4 py-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs tracking-wide text-amber-200">实验空间 · 船舶嵌入 · 24 步</p>
            <h1 className="text-xl font-semibold">{ILAB_EXPERIMENT_TITLE}</h1>
          </div>
          <p className="text-sm text-slate-300">{session ? `${session.displayName} · 操作分 ${earned}` : '等待票据'}</p>
        </div>
        <details className="mb-3 rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
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
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside className="max-h-[860px] overflow-auto rounded-md border border-slate-800 bg-slate-900 p-3">
          <ol className="space-y-1">
            {ILAB_STEPS.map((item) => {
              const record = session?.steps.find((stepRecord) => stepRecord.seq === item.seq);
              return (
                <li key={item.seq}>
                  <button
                    type="button"
                    onClick={() => setSeq(item.seq)}
                    className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm ${item.seq === seq ? 'bg-amber-200 text-slate-950' : 'hover:bg-slate-800'}`}
                  >
                    <span>{item.seq}. {item.title}</span>
                    <span className="text-xs">{record ? `${record.earnedPoints}/${record.maxPoints}` : item.maxPoints}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="space-y-3">
          <div className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm text-amber-200">阶段 {step.stage} · {step.stageName} · 建议 {step.minutes} 分钟 · {step.scoringModel}</p>
          <h2 className="mt-2 text-2xl font-semibold">{step.seq}. {step.title}</h2>
          <p className="mt-3 text-slate-300">{step.goal}</p>
          <p className="mt-3 leading-7 text-slate-200">{step.guidance}</p>
          {vessel ? (
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-slate-400">船型</dt><dd>{vessel.name}</dd></div>
              <div><dt className="text-slate-400">船长</dt><dd>{vessel.lengthM} 米</dd></div>
              <div><dt className="text-slate-400">排水量</dt><dd>{vessel.displacementT} 吨</dd></div>
              <div><dt className="text-slate-400">模型</dt><dd>{vessel.nomoto ? `K ${vessel.nomoto.K} / T ${vessel.nomoto.T} 秒` : '动力定位'}</dd></div>
            </dl>
          ) : null}
          {samplesText ? (
            <p className="mt-4 text-sm text-slate-400">已记录 {samplesText.split(',').filter(Boolean).length} 个采样点。</p>
          ) : null}
          {saved ? <p className="mt-4 rounded bg-slate-800 p-3 text-sm">{saved.evaluation} {saved.remarks}</p> : null}
          </div>
          <ShipStage vesselId={vessel?.id ?? null} seq={step.seq} />
        </section>

        <aside className="space-y-4 rounded-md border border-slate-800 bg-slate-900 p-4">
          <div>
            <p className="text-sm text-slate-400">当前记录</p>
            <p className="text-lg">{session ? `${session.displayName} · ${earned} 分` : '等待票据'}</p>
            <p className="mt-2 text-sm text-slate-300">{message || '从实验空间打开时地址里会带有 ticket。本地演示需把 ILAB_DEV_BYPASS 设为 1，并使用票据 dev-bypass。'}</p>
          </div>
          {fields.map((field) => (
            <label key={field.key} className="block text-sm">
              <span className="text-slate-300">{field.label}{field.unit ? `（${field.unit}）` : ''}</span>
              {field.kind === 'select' ? (
                <select
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2"
                  value={values[field.key] ?? ''}
                  onChange={(event) => setField(field.key, event.target.value)}
                >
                  <option value="">请选择</option>
                  {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : null}
              {field.kind === 'checks' ? (
                <div className="mt-2 space-y-1">
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
                </div>
              ) : null}
              {field.kind === 'number' ? (
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step ?? 'any'}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2"
                  value={values[field.key] ?? ''}
                  onChange={(event) => setField(field.key, event.target.value)}
                />
              ) : null}
              {field.kind === 'text' ? (
                <textarea
                  className="mt-1 min-h-24 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2"
                  value={values[field.key] ?? ''}
                  onChange={(event) => setField(field.key, event.target.value)}
                />
              ) : null}
            </label>
          ))}
          {(step.seq === 7 || step.seq === 14) ? (
            <label className="block text-sm">
              <span className="text-slate-300">采样点，用逗号分隔</span>
              <textarea className="mt-1 min-h-20 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2" value={samplesText} onChange={(event) => setSamplesText(event.target.value)} />
            </label>
          ) : null}
          {(step.seq === 10 || step.seq === 11) ? (
            <CurveSketch onDescribe={step.seq === 10 ? (text) => setField('note', values.note || text) : undefined} />
          ) : null}
          {step.simulation !== 'none' && vessel?.nomoto ? (
            <button type="button" disabled={busy} onClick={() => void simulate()} className="w-full rounded bg-slate-700 px-3 py-2 text-sm disabled:opacity-50">写入航向采样</button>
          ) : null}
          <button type="button" onClick={openSidebar} className="w-full rounded border border-slate-600 px-3 py-2 text-sm">问控灵这一步</button>
          <button type="button" disabled={busy || !session || session.status === 1} onClick={() => void submitStep()} className="w-full rounded bg-amber-200 px-3 py-2 font-medium text-slate-950 disabled:opacity-50">提交本步</button>
          {step.seq === 24 ? (
            <button type="button" disabled={busy || !session} onClick={() => void finish()} className="w-full rounded border border-amber-200 px-3 py-2 text-sm disabled:opacity-50">生成报告并回传</button>
          ) : null}
          {session?.reportReady ? (
            <a className="block text-center text-sm text-amber-200" href={`/api/ilab/session/${session.originId}?report=1`}>查看实验报告</a>
          ) : null}
        </aside>
      </div>
      </div>
    </main>
  );
}

function CurveSketch({ onDescribe }: { onDescribe?: (text: string) => void }) {
  function draw(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const context = canvas.getContext('2d');
    if (!context) return;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    context.strokeStyle = '#fcd34d';
    context.lineWidth = 2;
    context.lineTo((event.clientX - rect.left) * scaleX, (event.clientY - rect.top) * scaleY);
    context.stroke();
  }
  return (
    <div>
      <p className="text-sm text-slate-300">手绘曲线</p>
      <canvas
        width={280}
        height={120}
        className="mt-1 w-full rounded border border-slate-700 bg-slate-950"
        onPointerDown={(event) => {
          const canvas = event.currentTarget;
          const context = canvas.getContext('2d');
          const rect = canvas.getBoundingClientRect();
          context?.beginPath();
          context?.moveTo((event.clientX - rect.left) * canvas.width / rect.width, (event.clientY - rect.top) * canvas.height / rect.height);
        }}
        onPointerMove={(event) => { if (event.buttons === 1) draw(event); }}
      />
      {onDescribe ? (
        <button type="button" className="mt-2 text-sm text-amber-200" onClick={() => onDescribe('已在实验页手绘曲线，判断见上。')}>把手绘记入说明</button>
      ) : null}
    </div>
  );
}
