import type { ControlMode } from '../core/types';

export const DESTROYER_EXPERIMENT_TITLE = '驱逐舰航向控制实验';

export type DestroyerScene =
  | 'straight'
  | 'manual'
  | 'center'
  | 'step15'
  | 'turn90'
  | 'turnLeft90'
  | 'zigzag'
  | 'circle'
  | 'disturbance'
  | 'review';

export type DestroyerGain = 'kp' | 'ki' | 'kd';

export interface DestroyerField {
  key: string;
  label: string;
  unit?: string;
  kind: 'number' | 'choice' | 'text';
  choices?: string[];
}

export interface DestroyerExperimentStep {
  seq: number;
  title: string;
  goal: string;
  watch: string;
  suggestion: string;
  scene: DestroyerScene;
  duration: number;
  minRunS: number;
  modes: ControlMode[];
  defaultMode: ControlMode;
  gains: DestroyerGain[];
  disturbance: boolean;
  maxPoints: number;
  expectTime: number;
  fields: DestroyerField[];
}

export interface DestroyerSample {
  time: number;
  desiredHeading: number;
  actualHeading: number;
  yawRate: number;
  rudder: number;
  manualRudder: number;
  speed: number;
  crossTrackError: number;
}

export interface DestroyerReadings {
  [key: string]: string;
}

export interface DestroyerScore {
  ok: boolean;
  message: string;
  earnedPoints: number;
  maxPoints: number;
  evaluation: string;
  remarks: string;
}

export interface DestroyerSceneMotion {
  duration: number;
  disturbance: boolean;
  start: { x: number; z: number; headingDeg: number };
  desiredHeading: (time: number) => number;
}

export const DESTROYER_CURVE_SERIES = [
  { id: 'desiredHeading', label: '指令航向' },
  { id: 'actualHeading', label: '实际航向' },
  { id: 'yawRate', label: '转艏速率' },
  { id: 'rudder', label: '舵角' },
  { id: 'manualRudder', label: '手操舵角' },
  { id: 'speed', label: '航速' },
  { id: 'crossTrackError', label: '航迹误差' },
] as const;

export type DestroyerSeriesId = (typeof DESTROYER_CURVE_SERIES)[number]['id'];

const numberField = (key: string, label: string, unit: string): DestroyerField => ({ key, label, unit, kind: 'number' });

export const DESTROYER_EXPERIMENT_STEPS: DestroyerExperimentStep[] = [
  {
    seq: 1,
    title: '直航读数',
    goal: '让船沿直线航行，并从曲线读出航向和航速。',
    watch: '实际航向是否贴着 0°，航速是否平稳。',
    suggestion: '按开始，不要改增益。等实际航向曲线贴着 0° 走平后，再读出航速。',
    scene: 'straight',
    duration: 60,
    minRunS: 20,
    modes: ['pid'],
    defaultMode: 'pid',
    gains: [],
    disturbance: false,
    maxPoints: 8,
    expectTime: 60,
    fields: [numberField('heading', '实际航向', '°'), numberField('speed', '航速', 'm/s')],
  },
  {
    seq: 2,
    title: '手操打舵',
    goal: '用手操舵让船转起来，并读出舵角和转艏速率。',
    watch: '手操舵角曲线和转艏速率曲线是否一起变化。',
    suggestion: '打一个明显的舵并一直保持，直到转艏速率曲线走平，再按曲线终点读数。',
    scene: 'manual',
    duration: 140,
    minRunS: 100,
    modes: ['manual'],
    defaultMode: 'manual',
    gains: [],
    disturbance: false,
    maxPoints: 10,
    expectTime: 140,
    fields: [numberField('rudder', '手操舵角', '°'), numberField('yawRate', '转艏速率', '°/s')],
  },
  {
    seq: 3,
    title: '舵回中',
    goal: '把舵收回中位，观察转艏速率。',
    watch: '手操舵角回到 0 附近之后，转艏速率曲线怎么变。',
    suggestion: '先打舵并保持到转艏速率升高后走平，再把舵收回 0。等到转艏速率明显降下来，按曲线终点读取。',
    scene: 'center',
    duration: 300,
    minRunS: 250,
    modes: ['manual'],
    defaultMode: 'manual',
    gains: [],
    disturbance: false,
    maxPoints: 10,
    expectTime: 300,
    fields: [numberField('yawRate', '回中后转艏速率', '°/s')],
  },
  {
    seq: 4,
    title: '小角度转向',
    goal: '用比例控制跟随 15° 航向阶跃。',
    watch: '指令转到 15° 之后，实际航向曲线的最高点。',
    suggestion: '直航之后指令转到 15°。实际航向会越过 15° 再回来。等它回到 15° 附近后，读这个过程的峰值。这一步只能调比例增益。',
    scene: 'step15',
    duration: 200,
    minRunS: 180,
    modes: ['p'],
    defaultMode: 'p',
    gains: ['kp'],
    disturbance: false,
    maxPoints: 10,
    expectTime: 200,
    fields: [numberField('peakHeading', '航向峰值', '°')],
  },
  {
    seq: 5,
    title: '直角转向',
    goal: '跟随向右 90° 的航向阶跃。',
    watch: '拐角出现后实际航向曲线的峰值。',
    suggestion: '这段航迹是向右的直角。可以调比例和微分。等到实际航向越过 90° 再回到 90° 附近，读这个过程的峰值。',
    scene: 'turn90',
    duration: 290,
    minRunS: 270,
    modes: ['pd'],
    defaultMode: 'pd',
    gains: ['kp', 'kd'],
    disturbance: false,
    maxPoints: 12,
    expectTime: 290,
    fields: [numberField('peakHeading', '航向峰值', '°')],
  },
  {
    seq: 6,
    title: '反向直角',
    goal: '跟随向左 90° 的航向阶跃。',
    watch: '结束时实际航向距离 -90° 还有多少。',
    suggestion: '航迹改成向左的直角。三项增益都可以动。等到实际航向越过 -90° 再回到 -90° 附近，读终点离 -90° 还有多少。',
    scene: 'turnLeft90',
    duration: 280,
    minRunS: 260,
    modes: ['pid'],
    defaultMode: 'pid',
    gains: ['kp', 'ki', 'kd'],
    disturbance: false,
    maxPoints: 12,
    expectTime: 280,
    fields: [numberField('endError', '距 -90° 的偏差', '°')],
  },
  {
    seq: 7,
    title: '连续变向',
    goal: '在折线航迹上观察舵角有没有顶满。',
    watch: '舵角曲线是否顶到上限。',
    suggestion: '航迹会依次转到 45°、回到 0°、再转到 -45°、最后回到 0°。每一段都留有回到指令附近的时间。全部转完后，看舵角曲线有没有顶到上限。',
    scene: 'zigzag',
    duration: 640,
    minRunS: 590,
    modes: ['pid'],
    defaultMode: 'pid',
    gains: ['kp', 'ki', 'kd'],
    disturbance: false,
    maxPoints: 10,
    expectTime: 640,
    fields: [{ key: 'saturated', label: '舵角是否顶满', kind: 'choice', choices: ['顶满了', '没有顶满'] }],
  },
  {
    seq: 8,
    title: '定常回转',
    goal: '进入圆形航迹后读出稳住的转艏速率和舵角。',
    watch: '转艏速率和舵角曲线后段是否走平。',
    suggestion: '航迹改成船能够稳住的缓圆弧。等到转艏速率和舵角曲线走平，读这两条线末段的数值。',
    scene: 'circle',
    duration: 280,
    minRunS: 240,
    modes: ['pid'],
    defaultMode: 'pid',
    gains: ['kp', 'ki', 'kd'],
    disturbance: false,
    maxPoints: 10,
    expectTime: 280,
    fields: [numberField('yawRate', '末段转艏速率', '°/s'), numberField('rudder', '末段舵角', '°')],
  },
  {
    seq: 9,
    title: '扰动直航',
    goal: '指令保持直线时，读出扰动造成的最大航向偏离。',
    watch: '实际航向曲线离开 0° 的最大绝对值。',
    suggestion: '指令航迹仍是直线，扰动会把船推开。看到航向离开 0° 再回到 0° 附近后，读这段曲线里偏离的最大绝对值。',
    scene: 'disturbance',
    duration: 180,
    minRunS: 150,
    modes: ['pid'],
    defaultMode: 'pid',
    gains: ['kp', 'ki', 'kd'],
    disturbance: true,
    maxPoints: 10,
    expectTime: 180,
    fields: [numberField('maxHeadingDev', '最大航向偏离', '°')],
  },
  {
    seq: 10,
    title: '确认报告',
    goal: '写下操船记录并查看实验报告。',
    watch: '可以回看前面各步已经保存的曲线。',
    suggestion: '操舵已经锁定。用一两句话写下舵和航向的关系，然后点查看实验报告。',
    scene: 'review',
    duration: 1,
    minRunS: 0,
    modes: ['pid'],
    defaultMode: 'pid',
    gains: [],
    disturbance: false,
    maxPoints: 8,
    expectTime: 120,
    fields: [{ key: 'note', label: '操作记录', kind: 'text' }],
  },
];

export const DESTROYER_MAX_POINTS = DESTROYER_EXPERIMENT_STEPS.reduce((sum, step) => sum + step.maxPoints, 0);

export const DESTROYER_STEP_BY_SEQ = new Map(DESTROYER_EXPERIMENT_STEPS.map((step) => [step.seq, step]));

export function destroyerSceneMotion(step: DestroyerExperimentStep, speedMps: number): DestroyerSceneMotion {
  const speed = speedMps > 0 ? speedMps : 15;
  const straight = { x: -1800, z: 0, headingDeg: 0 };
  // 满舵时这艘船的稳定转艏大约每秒 1°。450 米半径需要约 1.9°/s，指令会一直把舵顶满也追不上。
  // 0.55°/s 对应半径约 1560 米，默认增益下舵角能在限位内走平。
  if (step.scene === 'circle') {
    const yawRateDegS = 0.55;
    const radius = speed / (yawRateDegS * Math.PI / 180);
    return {
      duration: step.duration,
      disturbance: false,
      start: { x: 0, z: -(radius + 500), headingDeg: 0 },
      desiredHeading: (time) => (time < 40 ? 0 : yawRateDegS * (time - 40)),
    };
  }
  const desiredHeading = (time: number) => {
    if (step.scene === 'step15') return time < 40 ? 0 : 15;
    if (step.scene === 'turn90') return time < 40 ? 0 : 90;
    if (step.scene === 'turnLeft90') return time < 40 ? 0 : -90;
    // 默认增益下，45° 约 139 秒首次回到指令，-45° 约 145 秒，回到 0° 约 65 秒。每段都留出余量。
    if (step.scene === 'zigzag') {
      if (time < 40) return 0;
      if (time < 220) return 45;
      if (time < 320) return 0;
      if (time < 510) return -45;
      return 0;
    }
    return 0;
  };
  const start = step.scene === 'turn90' || step.scene === 'turnLeft90'
    ? { x: -3200, z: 0, headingDeg: 0 }
    : straight;
  return {
    duration: step.duration,
    disturbance: step.disturbance,
    start,
    desiredHeading,
  };
}

export function signedHeading(heading: number): number {
  const wrapped = ((heading % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

export function thinDestroyerSamples(samples: DestroyerSample[], max = 360): DestroyerSample[] {
  if (samples.length <= max) return samples.slice();
  const stride = Math.ceil(samples.length / max);
  const thinned = samples.filter((_, index) => index % stride === 0);
  const last = samples[samples.length - 1];
  if (thinned[thinned.length - 1] !== last) thinned.push(last);
  return thinned;
}

export function emptyDestroyerSamples(): DestroyerSample[] {
  return [];
}

function finiteSample(value: unknown): value is DestroyerSample {
  if (!value || typeof value !== 'object') return false;
  const sample = value as DestroyerSample;
  return [sample.time, sample.desiredHeading, sample.actualHeading, sample.yawRate, sample.rudder, sample.manualRudder, sample.speed, sample.crossTrackError]
    .every((item) => typeof item === 'number' && Number.isFinite(item));
}

export function readDestroyerSamples(value: unknown): DestroyerSample[] {
  if (!Array.isArray(value)) return [];
  return value.filter(finiteSample).slice(0, 480);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function tail(samples: DestroyerSample[], fraction: number): DestroyerSample[] {
  const count = Math.max(1, Math.ceil(samples.length * fraction));
  return samples.slice(samples.length - count);
}

function near(actual: number, expected: number, tolerance: number): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

function headingNear(entered: number, expected: number, tolerance: number): boolean {
  return near(signedHeading(entered), signedHeading(expected), tolerance);
}

function fail(step: DestroyerExperimentStep, message: string): DestroyerScore {
  return { ok: false, message, earnedPoints: 0, maxPoints: step.maxPoints, evaluation: message, remarks: message };
}

function pass(step: DestroyerExperimentStep, evaluation: string, remarks: string): DestroyerScore {
  return { ok: true, message: evaluation, earnedPoints: step.maxPoints, maxPoints: step.maxPoints, evaluation, remarks };
}

function requireRun(step: DestroyerExperimentStep, samples: DestroyerSample[]): DestroyerScore | null {
  if (samples.length < 4) return fail(step, '请先运行仿真，让曲线留下数据。');
  const lastTime = samples[samples.length - 1]?.time ?? 0;
  if (lastTime + 0.001 < step.minRunS) return fail(step, `请至少运行 ${step.minRunS} 秒，曲线还没有覆盖这一步的机动。`);
  return null;
}

function sceneReady(step: DestroyerExperimentStep, samples: DestroyerSample[]): string | null {
  const desired = samples.map((sample) => signedHeading(sample.desiredHeading));
  const has = (target: number) => desired.some((value) => Math.abs(value - target) <= 1.5);
  if (step.scene === 'step15' && !(has(0) && has(15))) return '请把 15° 转向跑出来，曲线里要同时看见直线和 15° 指令。';
  if (step.scene === 'turn90' && !(has(0) && has(90))) return '请把直角转向跑出来，曲线里要出现 90° 指令。';
  if (step.scene === 'turnLeft90' && !(has(0) && has(-90))) return '请把向左的直角跑出来，曲线里要出现 -90° 指令。';
  if (step.scene === 'zigzag' && !(has(45) && has(-45))) return '请把左右两个转向都跑完。';
  if (step.scene === 'circle') {
    const span = Math.max(...desired) - Math.min(...desired);
    if (span < 25) return '请把圆弧航迹再跑一段，指令航向还没有明显变化。';
  }
  if ((step.scene === 'straight' || step.scene === 'manual' || step.scene === 'center' || step.scene === 'disturbance') && desired.some((value) => Math.abs(value) > 1.5)) {
    return '这一步的指令航向应保持直线。';
  }
  return null;
}

function numberReading(readings: DestroyerReadings, key: string): number | null {
  const value = Number(readings[key]);
  return Number.isFinite(value) ? value : null;
}

export function scoreDestroyerStep(seq: number, samples: DestroyerSample[], readings: DestroyerReadings): DestroyerScore {
  const step = DESTROYER_STEP_BY_SEQ.get(seq);
  if (!step) return { ok: false, message: '实验步骤不存在。', earnedPoints: 0, maxPoints: 0, evaluation: '实验步骤不存在。', remarks: '实验步骤不存在。' };
  if (step.scene === 'review') {
    const note = (readings.note ?? '').replace(/\s+/g, ' ').trim();
    if (note.length < 8) return fail(step, '请用至少一句话写下这次操船记录。');
    return pass(step, '操作记录已收入实验报告。', note);
  }
  const blocked = requireRun(step, samples);
  if (blocked) return blocked;
  const sceneMessage = sceneReady(step, samples);
  if (sceneMessage) return fail(step, sceneMessage);
  const late = tail(samples, 0.25);

  const last = samples[samples.length - 1];
  if (!last) return fail(step, '请先运行仿真，让曲线留下数据。');
  if (step.seq === 1) {
    const heading = mean(late.map((sample) => sample.actualHeading));
    if (Math.abs(heading) > 12) return fail(step, '直航时实际航向偏离 0° 较多，请重置后再走一段直线。');
    const enteredHeading = numberReading(readings, 'heading');
    const enteredSpeed = numberReading(readings, 'speed');
    if (enteredHeading === null || enteredSpeed === null) return fail(step, '请按曲线填写航向和航速。');
    if (!headingNear(enteredHeading, last.actualHeading, 3) || !near(enteredSpeed, last.speed, 1.5)) {
      return fail(step, '填写的航向或航速和曲线终点对不上。');
    }
    return pass(step, '直航读数与曲线一致。', `航向 ${enteredHeading}°，航速 ${enteredSpeed} m/s。`);
  }

  if (step.seq === 2) {
    const held = samples.filter((sample) => Math.abs(sample.manualRudder) >= 5);
    if (held.length < 3 || Math.abs(last.manualRudder) < 5) return fail(step, '请把舵打到明显角度并保持到提交。');
    if (samples.every((sample) => Math.abs(sample.yawRate) < 0.01)) return fail(step, '打舵后转艏速率几乎没有变化，请再保持一会儿。');
    const enteredRudder = numberReading(readings, 'rudder');
    const enteredYaw = numberReading(readings, 'yawRate');
    if (enteredRudder === null || enteredYaw === null) return fail(step, '请按曲线填写手操舵角和转艏速率。');
    if (!near(enteredRudder, last.manualRudder, 3) || !near(enteredYaw, last.yawRate, 0.4)) {
      return fail(step, '填写的舵角或转艏速率和曲线终点对不上。');
    }
    return pass(step, '手操舵角与转艏速率已对照曲线记录。', `舵角 ${enteredRudder}°，转艏速率 ${enteredYaw} °/s。`);
  }

  if (step.seq === 3) {
    const steered = samples.some((sample) => Math.abs(sample.manualRudder) >= 5);
    if (!steered || Math.abs(last.manualRudder) > 2) return fail(step, '请先打舵，再把舵收回 0，并在舵回到中位后提交。');
    const entered = numberReading(readings, 'yawRate');
    if (entered === null) return fail(step, '请按曲线填写回中后的转艏速率。');
    if (!near(entered, last.yawRate, 0.4)) return fail(step, '填写的转艏速率和曲线终点对不上。');
    return pass(step, '舵已回中，转艏速率已按曲线记录。', `回中后转艏速率 ${entered} °/s。`);
  }

  if (step.seq === 4 || step.seq === 5) {
    const target = step.seq === 4 ? 15 : 90;
    const after = samples.filter((sample) => Math.abs(signedHeading(sample.desiredHeading) - target) <= 1.5);
    const peak = after.reduce((best, sample) => Math.max(best, sample.actualHeading), -Infinity);
    const entered = numberReading(readings, 'peakHeading');
    if (entered === null || !Number.isFinite(peak)) return fail(step, '请按曲线填写航向峰值。');
    if (!near(entered, peak, 5)) return fail(step, '填写的航向峰值和曲线对不上。');
    return pass(step, `航向峰值 ${entered}° 与曲线一致。`, `峰值 ${entered}°，指令 ${target}°。`);
  }

  if (step.seq === 6) {
    const endHeading = samples[samples.length - 1]?.actualHeading ?? 0;
    const error = Math.abs(signedHeading(endHeading) - (-90));
    const entered = numberReading(readings, 'endError');
    if (entered === null) return fail(step, '请按曲线填写距离 -90° 的偏差。');
    if (!near(entered, error, 4)) return fail(step, '填写的偏差和曲线终点对不上。');
    return pass(step, `终点距 -90° 为 ${entered}°。`, `偏差 ${entered}°。`);
  }

  if (step.seq === 7) {
    const saturated = samples.some((sample) => Math.abs(sample.rudder) >= 34);
    const expected = saturated ? '顶满了' : '没有顶满';
    if (readings.saturated !== expected) return fail(step, saturated ? '舵角曲线已经顶到上限，请改选“顶满了”。' : '舵角曲线没有顶到上限，请改选“没有顶满”。');
    return pass(step, `舵角${expected}。`, expected);
  }

  if (step.seq === 8) {
    const enteredYaw = numberReading(readings, 'yawRate');
    const enteredRudder = numberReading(readings, 'rudder');
    if (enteredYaw === null || enteredRudder === null) return fail(step, '请按曲线填写末段转艏速率和舵角。');
    if (!near(enteredYaw, last.yawRate, 0.4) || !near(enteredRudder, last.rudder, 3)) return fail(step, '填写的末段读数和曲线终点对不上。');
    return pass(step, '定常回转末段读数与曲线一致。', `转艏速率 ${enteredYaw} °/s，舵角 ${enteredRudder}°。`);
  }

  const deviation = samples.reduce((best, sample) => Math.max(best, Math.abs(sample.actualHeading)), 0);
  const entered = numberReading(readings, 'maxHeadingDev');
  if (entered === null) return fail(step, '请按曲线填写最大航向偏离。');
  if (!near(entered, deviation, 4)) return fail(step, '填写的最大偏离和曲线对不上。');
  return pass(step, `最大航向偏离 ${entered}°。`, `偏离 ${entered}°。`);
}

export function destroyerFrontierSeq(doneSeqs: number[]): number {
  for (const step of DESTROYER_EXPERIMENT_STEPS) {
    if (!doneSeqs.includes(step.seq)) return step.seq;
  }
  return DESTROYER_EXPERIMENT_STEPS.length;
}

export function assertDestroyerStepOrder(doneSeqs: number[], seq: number): string | null {
  if (!DESTROYER_STEP_BY_SEQ.has(seq)) return '实验步骤不存在。';
  if (seq > destroyerFrontierSeq(doneSeqs)) return '请先完成当前步骤，后面的步骤还不能提交。';
  return null;
}

export function chooseBetterDestroyerAttempt<T extends { earnedPoints: number }>(
  previous: T | undefined,
  next: T,
): { record: T; keptPrevious: boolean } {
  if (previous && previous.earnedPoints > next.earnedPoints) {
    return { record: previous, keptPrevious: true };
  }
  return { record: next, keptPrevious: false };
}

export function destroyerKonlingBrief(step: DestroyerExperimentStep, live: {
  heading: number;
  yawRate: number;
  rudder: number;
  manualRudder: number;
  speed: number;
  time: number;
  mode: string;
} | null): string {
  const liveText = live
    ? `当前画面：仿真 ${live.time.toFixed(0)} 秒，模式 ${live.mode}，航向 ${live.heading.toFixed(1)}°，转艏速率 ${live.yawRate.toFixed(2)} °/s，舵角 ${live.rudder.toFixed(1)}°，手操舵角 ${live.manualRudder.toFixed(1)}°，航速 ${live.speed.toFixed(1)} m/s。`
    : '仿真尚未给出读数。';
  return [
    `学生正在做驱逐舰航向控制实验第 ${step.seq} 步「${step.title}」。`,
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

export function buildDestroyerReportHtml(input: {
  displayName: string;
  steps: Array<{ seq: number; title: string; earnedPoints: number; maxPoints: number; evaluation: string; remarks: string }>;
}): string {
  const earned = input.steps.reduce((sum, step) => sum + step.earnedPoints, 0);
  const rows = [...input.steps]
    .sort((left, right) => left.seq - right.seq)
    .map((step) => `<tr><td>${step.seq}</td><td>${escapeHtml(step.title)}</td><td>${step.earnedPoints}/${step.maxPoints}</td><td>${escapeHtml(step.evaluation)}</td><td>${escapeHtml(step.remarks)}</td></tr>`)
    .join('');
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>${escapeHtml(DESTROYER_EXPERIMENT_TITLE)}实验报告</title></head>
<body>
<h1>${escapeHtml(DESTROYER_EXPERIMENT_TITLE)}</h1>
<p>学生：${escapeHtml(input.displayName || '未命名')}</p>
<p>场景：055型驱逐舰航向控制</p>
<p>实验得分：${earned}/${DESTROYER_MAX_POINTS}</p>
<table>
<thead><tr><th>序号</th><th>步骤</th><th>得分</th><th>评价</th><th>记录</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body>
</html>`;
  if (new TextEncoder().encode(html).byteLength > 5 * 1024 * 1024) {
    throw new Error('实验报告超过 5MB。');
  }
  return html;
}

export const DESTROYER_EXPERIMENT_KEY = 'destroyer-heading';

export interface DestroyerReportDraftStep {
  seq: number;
  title: string;
  earnedPoints: number;
  maxPoints: number;
  evaluation: string;
  remarks: string;
}

export function validateDestroyerReportDraft(input: {
  reportHtml: string;
  steps: DestroyerReportDraftStep[];
}): { ok: true; score: number; steps: DestroyerReportDraftStep[] } | { ok: false; message: string } {
  if (typeof input.reportHtml !== 'string' || input.reportHtml.trim().length < 20) {
    return { ok: false, message: '实验报告是空的。' };
  }
  if (new TextEncoder().encode(input.reportHtml).byteLength > 5 * 1024 * 1024) {
    return { ok: false, message: '实验报告超过 5MB。' };
  }
  if (!Array.isArray(input.steps) || input.steps.length !== DESTROYER_EXPERIMENT_STEPS.length) {
    return { ok: false, message: '报告需要包含全部实验步骤。' };
  }
  const steps: DestroyerReportDraftStep[] = [];
  for (const definition of DESTROYER_EXPERIMENT_STEPS) {
    const step = input.steps.find((item) => item?.seq === definition.seq);
    if (!step || step.title !== definition.title || step.maxPoints !== definition.maxPoints) {
      return { ok: false, message: '实验步骤和报告对不上。' };
    }
    if (!Number.isInteger(step.earnedPoints) || step.earnedPoints < 0 || step.earnedPoints > definition.maxPoints) {
      return { ok: false, message: '步骤成绩不在允许范围内。' };
    }
    if (typeof step.evaluation !== 'string' || typeof step.remarks !== 'string') {
      return { ok: false, message: '实验记录不完整。' };
    }
    if (step.evaluation.length > 500 || step.remarks.length > 2000) {
      return { ok: false, message: '实验记录过长。' };
    }
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
  if (!input.reportHtml.includes(`实验得分：${score}/${DESTROYER_MAX_POINTS}`)) {
    return { ok: false, message: '报告里的总分和各步成绩不一致。' };
  }
  return { ok: true, score, steps };
}
