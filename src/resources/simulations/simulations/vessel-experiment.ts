import type { ControlMode } from '../core/types';

export interface VesselField {
  key: string;
  label: string;
  unit?: string;
  kind: 'number' | 'choice' | 'text';
  choices?: string[];
}

export interface VesselStep {
  seq: number;
  title: string;
  goal: string;
  watch: string;
  suggestion: string;
  scene: string;
  duration: number;
  minRunS: number;
  maxPoints: number;
  expectTime: number;
  fields: VesselField[];
}

export interface VesselSample {
  time: number;
  values: Record<string, number>;
}

export interface VesselReadings {
  [key: string]: string;
}

export interface VesselScore {
  ok: boolean;
  message: string;
  earnedPoints: number;
  maxPoints: number;
  evaluation: string;
  remarks: string;
}

export interface VesselSeries {
  id: string;
  label: string;
  digits?: number;
}

export interface VesselCommand {
  mode: ControlMode;
  targetHeading: number;
  manualRudder: number;
  manualSpeed: number;
  targetX: number;
  targetZ: number;
  smith: boolean;
  fin: boolean;
  ice: boolean;
  iceThickness: number;
  dredging: boolean;
  dp: boolean;
  decoupling: boolean;
  loadRatio: number;
  windSpeed: number;
  windDirection: number;
  seaState: number;
  startX: number;
  startZ: number;
  startHeading: number;
}

export interface VesselExperiment {
  key: string;
  originPrefix: string;
  vesselId: string;
  title: string;
  sceneLabel: string;
  route: string;
  courseId: string;
  steps: VesselStep[];
  series: VesselSeries[];
  score: (step: VesselStep, samples: VesselSample[], readings: VesselReadings) => VesselScore;
  command: (step: VesselStep, time: number) => VesselCommand;
}

export interface VesselReportDraftStep {
  seq: number;
  title: string;
  earnedPoints: number;
  maxPoints: number;
  evaluation: string;
  remarks: string;
}

export function vesselMaxPoints(steps: VesselStep[]): number {
  return steps.reduce((sum, step) => sum + step.maxPoints, 0);
}

export function vesselFrontierSeq(steps: VesselStep[], doneSeqs: number[]): number {
  for (const step of steps) {
    if (!doneSeqs.includes(step.seq)) return step.seq;
  }
  return steps.length;
}

export function assertVesselStepOrder(steps: VesselStep[], doneSeqs: number[], seq: number): string | null {
  if (!steps.some((step) => step.seq === seq)) return '实验步骤不存在。';
  if (seq > vesselFrontierSeq(steps, doneSeqs)) return '请先完成当前步骤，后面的步骤还不能提交。';
  return null;
}

export function chooseBetterVesselAttempt<T extends { earnedPoints: number }>(
  previous: T | undefined,
  next: T,
): { record: T; keptPrevious: boolean } {
  if (previous && previous.earnedPoints > next.earnedPoints) return { record: previous, keptPrevious: true };
  return { record: next, keptPrevious: false };
}

export function signedHeading(heading: number): number {
  const wrapped = ((heading % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

export function thinVesselSamples(samples: VesselSample[], max = 360): VesselSample[] {
  const finite = samples.filter((sample) => Number.isFinite(sample.time) && Object.values(sample.values).every((value) => Number.isFinite(value)));
  if (finite.length <= max) return finite.map((sample) => ({ time: sample.time, values: { ...sample.values } }));
  const stride = Math.ceil(finite.length / max);
  const thinned = finite.filter((_, index) => index % stride === 0);
  const last = finite[finite.length - 1];
  if (thinned[thinned.length - 1] !== last) thinned.push(last);
  return thinned.map((sample) => ({ time: sample.time, values: { ...sample.values } }));
}

export function readVesselSamples(value: unknown): VesselSample[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as { time?: unknown; values?: unknown };
    if (typeof record.time !== 'number' || !Number.isFinite(record.time)) return [];
    if (!record.values || typeof record.values !== 'object' || Array.isArray(record.values)) return [];
    const values: Record<string, number> = {};
    for (const [key, entry] of Object.entries(record.values)) {
      if (typeof entry === 'number' && Number.isFinite(entry)) values[key] = entry;
    }
    return [{ time: record.time, values }];
  }).slice(0, 480);
}

export function vesselSampleMark(time: number): number {
  return Math.floor(time + 1e-6);
}

export function collectSamples(
  duration: number,
  dt: number,
  advance: (time: number, dt: number) => VesselSample,
): VesselSample[] {
  const samples: VesselSample[] = [];
  let lastMark = -1;
  let time = 0;
  while (time <= duration + 1e-6) {
    const sample = advance(time, dt);
    const mark = vesselSampleMark(sample.time);
    if (mark > lastMark) {
      samples.push(sample);
      lastMark = mark;
    }
    if (sample.time >= duration - 1e-6) break;
    time += dt;
  }
  return samples;
}

export function vesselValue(sample: VesselSample | undefined, key: string): number {
  const value = sample?.values[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN;
}

export function failStep(step: VesselStep, message: string): VesselScore {
  return { ok: false, message, earnedPoints: 0, maxPoints: step.maxPoints, evaluation: message, remarks: message };
}

export function passStep(step: VesselStep, evaluation: string, remarks: string): VesselScore {
  return { ok: true, message: evaluation, earnedPoints: step.maxPoints, maxPoints: step.maxPoints, evaluation, remarks };
}

export function requireSamples(step: VesselStep, samples: VesselSample[]): VesselScore | null {
  if (step.fields.every((field) => field.kind === 'text')) return null;
  if (samples.length < 4) return failStep(step, '请先运行仿真，让曲线留下数据。');
  const lastTime = samples[samples.length - 1]?.time ?? 0;
  if (lastTime + 0.001 < step.minRunS) return failStep(step, `请至少运行 ${step.minRunS} 秒，曲线还没有覆盖这一步的机动。`);
  return null;
}

export function numberReading(readings: VesselReadings, key: string): number {
  const value = Number(readings[key]?.trim());
  return Number.isFinite(value) ? value : Number.NaN;
}

export function nearReading(step: VesselStep, readings: VesselReadings, key: string, expected: number, tolerance: number, label: string): VesselScore | null {
  const entered = numberReading(readings, key);
  if (!Number.isFinite(entered)) return failStep(step, `请按曲线终点填写${label}。`);
  if (Math.abs(entered - expected) > tolerance) return failStep(step, `${label}和曲线终点对不上，请读最后一个点。`);
  return null;
}

export function choiceReading(step: VesselStep, readings: VesselReadings, key: string, expected: string): VesselScore | null {
  const entered = readings[key]?.trim() ?? '';
  if (!entered) return failStep(step, '请先选择这一步的判断。');
  if (entered !== expected) return failStep(step, '这个判断和曲线不一致，请再看终点和过程。');
  return null;
}

export function noteReading(step: VesselStep, readings: VesselReadings, key = 'note'): VesselScore | null {
  const note = readings[key]?.trim() ?? '';
  if (note.length < 8) return failStep(step, '请用至少一句话写下这次实验里看到的现象。');
  return null;
}

export function vesselKonlingBrief(experiment: VesselExperiment, step: VesselStep, live: Record<string, number> | null): string {
  const liveText = live
    ? `当前画面：仿真 ${Number(live.time ?? 0).toFixed(0)} 秒。${experiment.series.map((series) => `${series.label} ${Number(live[series.id] ?? Number.NaN).toFixed(series.digits ?? 1)}`).join('，')}。`
    : '仿真尚未给出读数。';
  return [
    `学生正在做${experiment.title}第 ${step.seq} 步「${step.title}」。`,
    `目标：${step.goal}`,
    `建议观察：${step.watch}`,
    `操作建议：${step.suggestion}`,
    liveText,
    '只根据这一步回答。可以说明该看哪条曲线、下一步手该怎么动。不要替学生填写读数，不要打分，不要提前讲后面步骤的操作。',
  ].join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildVesselReportHtml(experiment: VesselExperiment, input: {
  displayName: string;
  steps: VesselReportDraftStep[];
}): string {
  const maxPoints = vesselMaxPoints(experiment.steps);
  const earned = input.steps.reduce((sum, step) => sum + step.earnedPoints, 0);
  const rows = [...input.steps]
    .sort((left, right) => left.seq - right.seq)
    .map((step) => `<tr><td>${step.seq}</td><td>${escapeHtml(step.title)}</td><td>${step.earnedPoints}/${step.maxPoints}</td><td>${escapeHtml(step.evaluation)}</td><td>${escapeHtml(step.remarks)}</td></tr>`)
    .join('');
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>${escapeHtml(experiment.title)}实验报告</title></head>
<body>
<h1>${escapeHtml(experiment.title)}</h1>
<p>学生：${escapeHtml(input.displayName || '未命名')}</p>
<p>场景：${escapeHtml(experiment.sceneLabel)}</p>
<p>实验得分：${earned}/${maxPoints}</p>
<table>
<thead><tr><th>序号</th><th>步骤</th><th>得分</th><th>评价</th><th>记录</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body>
</html>`;
  if (new TextEncoder().encode(html).byteLength > 5 * 1024 * 1024) throw new Error('实验报告超过 5MB。');
  return html;
}

export function validateVesselReportDraft(experiment: VesselExperiment, input: {
  reportHtml: string;
  steps: VesselReportDraftStep[];
}): { ok: true; score: number; steps: VesselReportDraftStep[] } | { ok: false; message: string } {
  if (typeof input.reportHtml !== 'string' || input.reportHtml.trim().length < 20) return { ok: false, message: '实验报告是空的。' };
  if (new TextEncoder().encode(input.reportHtml).byteLength > 5 * 1024 * 1024) return { ok: false, message: '实验报告超过 5MB。' };
  if (!Array.isArray(input.steps) || input.steps.length !== experiment.steps.length) return { ok: false, message: '报告需要包含全部实验步骤。' };
  const steps: VesselReportDraftStep[] = [];
  for (const definition of experiment.steps) {
    const step = input.steps.find((item) => item?.seq === definition.seq);
    if (!step || step.title !== definition.title || step.maxPoints !== definition.maxPoints) return { ok: false, message: '实验步骤和报告对不上。' };
    if (!Number.isInteger(step.earnedPoints) || step.earnedPoints < 0 || step.earnedPoints > definition.maxPoints) return { ok: false, message: '步骤成绩不在允许范围内。' };
    if (typeof step.evaluation !== 'string' || typeof step.remarks !== 'string') return { ok: false, message: '实验记录不完整。' };
    if (step.evaluation.length > 500 || step.remarks.length > 2000) return { ok: false, message: '实验记录过长。' };
    steps.push({
      seq: step.seq,
      title: step.title,
      earnedPoints: step.earnedPoints,
      maxPoints: step.maxPoints,
      evaluation: step.evaluation,
      remarks: step.remarks,
    });
  }
  const score = steps.reduce((sum, step) => sum + step.earnedPoints, 0);
  const maxPoints = vesselMaxPoints(experiment.steps);
  if (!input.reportHtml.includes(`实验得分：${score}/${maxPoints}`)) return { ok: false, message: '报告里的总分和各步成绩不一致。' };
  return { ok: true, score, steps };
}

export function baseCommand(patch: Partial<VesselCommand> = {}): VesselCommand {
  return {
    mode: 'pid',
    targetHeading: 0,
    manualRudder: 0,
    manualSpeed: 0,
    targetX: 0,
    targetZ: 0,
    smith: false,
    fin: true,
    ice: false,
    iceThickness: 0,
    dredging: false,
    dp: true,
    decoupling: true,
    loadRatio: 0.5,
    windSpeed: 0,
    windDirection: 0,
    seaState: 3,
    startX: 0,
    startZ: 0,
    startHeading: 0,
    ...patch,
  };
}

export function takeVesselSubstep(
  step: VesselStep,
  commandAt: (time: number) => VesselCommand,
  stepDrive: (command: VesselCommand, dt: number, time: number) => VesselSample,
  time: number,
  dt: number,
): { time: number; command: VesselCommand; sample: VesselSample | null } {
  if (time >= step.duration) return { time, command: commandAt(time), sample: null };
  const command = commandAt(time);
  const sample = stepDrive(command, dt, time);
  return { time: sample.time, command, sample };
}

export function settleVesselStep(
  step: VesselStep,
  samples: VesselSample[],
  plant: string | null,
  checks: Array<VesselScore | null>,
  evaluation: string,
): VesselScore {
  const missing = requireSamples(step, samples);
  if (missing) return missing;
  if (plant) return failStep(step, plant);
  for (const check of checks) {
    if (check) return check;
  }
  return passStep(step, evaluation, evaluation);
}
