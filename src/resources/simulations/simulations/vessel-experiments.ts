import {
  CONTAINER_MSC_PARAMS,
  CRUISE_ADORA_PARAMS,
  DRILLING_ETHICAL_THRESHOLDS,
  LNG_CHANGHENG_PARAMS,
} from '../core/constants';
import {
  baseCommand,
  choiceReading,
  nearReading,
  noteReading,
  settleVesselStep,
  vesselValue,
  type VesselCommand,
  type VesselExperiment,
  type VesselField,
  type VesselReadings,
  type VesselSample,
  type VesselScore,
  type VesselStep,
} from './vessel-experiment';

const LNG_SPEED = LNG_CHANGHENG_PARAMS.CRUISE_SPEED;
const CONTAINER_SPEED = CONTAINER_MSC_PARAMS.CRUISE_SPEED;
const CRUISE_SPEED = CRUISE_ADORA_PARAMS.CRUISE_SPEED;
const POWER_LIMIT = DRILLING_ETHICAL_THRESHOLDS.MAX_TOTAL_POWER;

function field(key: string, label: string, unit?: string): VesselField {
  return { key, label, unit, kind: 'number' };
}

function choice(label: string, choices: string[]): VesselField {
  return { key: 'choice', label, kind: 'choice', choices };
}

const noteField: VesselField = { key: 'note', label: '实验记录', kind: 'text' };

function makeStep(
  seq: number,
  title: string,
  points: number,
  duration: number,
  minRun: number,
  goal: string,
  watch: string,
  suggestion: string,
  fields: VesselField[],
): VesselStep {
  return {
    seq,
    title,
    goal,
    watch,
    suggestion,
    scene: seq === 10 ? 'review' : 'script',
    duration,
    minRunS: minRun,
    maxPoints: points,
    expectTime: seq === 10 ? 60 : duration,
    fields,
  };
}

function end(samples: VesselSample[], key: string): number {
  return vesselValue(samples[samples.length - 1], key);
}

function peak(samples: VesselSample[], key: string): number {
  return samples.reduce((max, item) => Math.max(max, Math.abs(vesselValue(item, key))), 0);
}

function read(step: VesselStep, samples: VesselSample[], readings: VesselReadings, key: string, tolerance: number, label: string): VesselScore | null {
  return nearReading(step, readings, key, end(samples, key), tolerance, label);
}

const lngSteps: VesselStep[] = [
  makeStep(1, '直航读数', 8, 60, 30, '看大惯性船在零航向指令下能不能稳住。', '实际航向和航速的终点。', '按下开始，等曲线走完这一步，再按终点填写航向和航速。', [field('heading', '实际航向', '°'), field('speed', '航速', 'm/s')]),
  makeStep(2, '手操打舵', 10, 110, 90, '手操固定舵角，看船会不会慢慢转起来。', '指令舵角、舵角和转艏速率。', '舵角由这一步自动打到固定值。等曲线走完，读终点的转艏速率。', [field('yaw', '转艏速率', '°/s'), field('rudder', '舵角', '°')]),
  makeStep(3, '舵回中', 10, 450, 420, '舵回到零之后，看转艏会不会慢慢停下来。', '回中以后的转艏速率终点。', '前一段会打舵，之后舵回到零。请等到曲线后段再提交。', [field('yaw', '转艏速率', '°/s')]),
  makeStep(4, '十度超调', 12, 1220, 1200, '看十度航向指令会先冲过、再在附近摆动。', '实际航向的峰值和终点。', '不要在刚碰到十度时提交。请等到这一步的曲线结束，再读终点航向。', [field('heading', '实际航向', '°')]),
  makeStep(5, '靠泊航速', 10, 50, 30, '看靠泊指令下航速停在哪里。', '航速曲线的终点。', '等航速指令切到靠泊速度并且曲线走完，再填写终点航速。', [field('speed', '航速', 'm/s')]),
  makeStep(6, '剩余距离', 10, 40, 25, '减速以后，看离泊位还剩多少距离。', '剩余距离的终点。', '等减速完成后再读剩余距离，不要读刚起步的那一段。', [field('distance', '剩余距离', 'm')]),
  makeStep(7, '航速响应', 10, 40, 25, '判断航速是跟着指令立刻变，还是会滑很久。', '航速在切换前后的曲线。', '先看切换点附近的航速曲线，再做选择。', [choice('航速怎么跟上', ['航速几乎立刻跟上', '还要滑很久'])]),
  makeStep(8, '液货晃荡', 8, 60, 30, '看这次直航里液货晃荡大不大。', '晃荡角曲线的终点。', '读晃荡角的最后一个点，不要把舱压当成晃荡角。', [field('slosh', '晃荡角', '°')]),
  makeStep(9, '安全距离', 12, 40, 25, '判断减速后离泊位是否还留有余量。', '剩余距离和航速的终点。', '把终点的距离和航速合在一起看，再做选择。', [choice('当前距离', ['距离还够', '距离不够了'])]),
  makeStep(10, '确认记录', 10, 1, 0, '用一句话记下这次看到的现象。', '前面各步的曲线终点。', '写出航向、航速或距离里你实际看到的变化。', [noteField]),
];

function lngCommand(step: VesselStep, time: number): VesselCommand {
  const common = { startX: -800, manualSpeed: LNG_SPEED };
  if (step.seq === 2) return baseCommand({ ...common, mode: 'manual', manualRudder: 12 });
  if (step.seq === 3) return baseCommand({ ...common, mode: 'manual', manualRudder: time < 90 ? 12 : 0 });
  if (step.seq === 4) return baseCommand({ ...common, targetHeading: time < 40 ? 0 : 10 });
  if (step.seq === 5 || step.seq === 6 || step.seq === 7 || step.seq === 9) {
    return baseCommand({ ...common, mode: 'manual', manualRudder: 0, manualSpeed: time < 15 ? LNG_SPEED : 2 });
  }
  return baseCommand(common);
}

function scoreLng(step: VesselStep, samples: VesselSample[], readings: VesselReadings): VesselScore {
  const heading = end(samples, 'heading');
  const yaw = end(samples, 'yaw');
  const speed = end(samples, 'speed');
  const distance = end(samples, 'distance');
  if (step.seq === 1) {
    const plant = Math.abs(heading) > 1 || Math.abs(speed - LNG_SPEED) > 0.4 ? '直航航向或航速还没稳住，请跑到这一步结束再读终点。' : null;
    return settleVesselStep(step, samples, plant, [read(step, samples, readings, 'heading', 0.2, '实际航向'), read(step, samples, readings, 'speed', 0.2, '航速')], '直航时航向留在零附近，航速停在巡航值。');
  }
  if (step.seq === 2) {
    const plant = Math.abs(end(samples, 'commandRudder')) < 8 || yaw < 0.12 ? '船还没有在固定舵角下转起来，请等曲线走完。' : null;
    return settleVesselStep(step, samples, plant, [read(step, samples, readings, 'yaw', 0.02, '转艏速率'), read(step, samples, readings, 'rudder', 0.2, '舵角')], '固定舵角下，转艏速率已经起来了。');
  }
  if (step.seq === 3) {
    const swung = samples.some((item) => Math.abs(vesselValue(item, 'commandRudder')) >= 8);
    const plant = !swung || Math.abs(end(samples, 'commandRudder')) > 2 || Math.abs(yaw) > 0.02 ? '舵回到零以后转艏还没慢下来，请把这一步跑完。' : null;
    return settleVesselStep(step, samples, plant, [read(step, samples, readings, 'yaw', 0.02, '转艏速率')], '舵回中后，转艏速率已经降下来。');
  }
  if (step.seq === 4) {
    const peaked = samples.some((item) => item.time >= 40 && vesselValue(item, 'heading') >= 14);
    const plant = !peaked || Math.abs(heading - 10) > 1.6 ? '十度指令还没有走完超调后再回到附近，请等到曲线结束。' : null;
    return settleVesselStep(step, samples, plant, [read(step, samples, readings, 'heading', 0.2, '实际航向')], '航向先冲过十度，终点又落回十度附近。');
  }
  if (step.seq === 5) {
    const plant = Math.abs(speed - 2) > 0.3 ? '航速还没有停在靠泊速度，请等曲线终点。' : null;
    return settleVesselStep(step, samples, plant, [read(step, samples, readings, 'speed', 0.2, '航速')], '靠泊航速指令下，终点航速已经降到低速。');
  }
  if (step.seq === 6) {
    const plant = distance < 595 || distance > 610 ? '剩余距离和这次减速过程对不上，请等曲线走完再读。' : null;
    return settleVesselStep(step, samples, plant, [read(step, samples, readings, 'distance', 1, '剩余距离')], '减速以后，船离泊位仍有一段距离。');
  }
  if (step.seq === 7) {
    const highs = samples.filter((item) => vesselValue(item, 'speed') >= 9);
    const lastHigh = highs[highs.length - 1];
    const low = samples.find((item) => lastHigh && item.time > lastHigh.time && vesselValue(item, 'speed') <= 2.5);
    const plant = !lastHigh || !low || low.time - lastHigh.time > 4 || Math.abs(speed - 2) > 0.3 ? '还看不出航速切换，请把这一步跑完。' : null;
    return settleVesselStep(step, samples, plant, [choiceReading(step, readings, 'choice', '航速几乎立刻跟上')], '航速几乎立刻跟上了新的指令。');
  }
  if (step.seq === 8) {
    const plant = sloshPlant(samples);
    return settleVesselStep(step, samples, plant, [read(step, samples, readings, 'slosh', 0.05, '晃荡角')], '这次直航的晃荡角不大。');
  }
  if (step.seq === 9) {
    const plant = !(distance > 400 && speed <= 3) ? '还不能同时看到低航速和足够的剩余距离。' : null;
    return settleVesselStep(step, samples, plant, [choiceReading(step, readings, 'choice', '距离还够')], '减速后剩余距离仍然足够。');
  }
  return settleVesselStep(step, samples, null, [noteReading(step, readings)], readings.note?.trim() || '已记录实验现象。');
}

function sloshPlant(samples: VesselSample[]): string | null {
  return end(samples, 'slosh') < 1 ? null : '晃荡角已经很大，请再看终点。';
}

export const lngExperiment: VesselExperiment = {
  key: 'lng-berthing',
  originPrefix: 'vlng_',
  vesselId: 'fleet-lng-changheng',
  title: '液化气船大惯性操纵实验',
  sceneLabel: '液化气船靠泊操纵',
  route: '/simulations/lng',
  courseId: 'lng-berthing-experiment',
  steps: lngSteps,
  series: [
    { id: 'heading', label: '实际航向', digits: 1 },
    { id: 'commandHeading', label: '指令航向', digits: 1 },
    { id: 'yaw', label: '转艏速率', digits: 2 },
    { id: 'rudder', label: '舵角', digits: 1 },
    { id: 'commandRudder', label: '指令舵角', digits: 1 },
    { id: 'speed', label: '航速', digits: 1 },
    { id: 'distance', label: '剩余距离', digits: 0 },
    { id: 'slosh', label: '晃荡角', digits: 2 },
  ],
  command: lngCommand,
  score: scoreLng,
};

const containerSteps: VesselStep[] = [
  makeStep(1, '高速读数', 8, 40, 20, '看高速指令下航速停在哪里。', '航速终点。', '等曲线走完，按终点填写航速。', [field('speed', '航速', 'm/s')]),
  makeStep(2, '经济航速', 10, 40, 20, '看经济航速指令下航速停在哪里。', '航速终点。', '等曲线走完，按终点填写航速。', [field('speed', '航速', 'm/s')]),
  makeStep(3, '油耗对比', 12, 80, 70, '比较高速和经济航速哪一段更费油。', '航速和油耗指数。', '先看前半段和后半段的油耗指数，再做选择。', [choice('哪一段更省', ['低速更省', '高速更省'])]),
  makeStep(4, '准点航程', 12, 200, 190, '用稳定航速看这段时间走出多远。', '航程终点。', '等曲线覆盖这一步的时间后再读航程。', [field('range', '航程', 'm')]),
  makeStep(5, '空载时间常数', 8, 20, 5, '读空载时的时间常数。', '时间常数曲线。', '装载已经设成空载，读时间常数的终点。', [field('timeConstant', '时间常数', 's')]),
  makeStep(6, '满载时间常数', 10, 20, 5, '读满载时的时间常数。', '时间常数曲线。', '装载已经设成满载，读时间常数的终点。', [field('timeConstant', '时间常数', 's')]),
  makeStep(7, '横风偏航', 12, 90, 75, '舵保持零，看横风把航向吹到哪里。', '实际航向和舵角。', '不要打舵。等曲线走完，读终点航向。', [field('heading', '实际航向', '°')]),
  makeStep(8, '舵有没有顶满', 10, 520, 480, '看自动舵在转向时舵角有没有顶到上限。', '舵角曲线的峰值。', '看整段舵角有没有贴住上限，再做选择。', [choice('舵角上限', ['顶满了', '没有顶满'])]),
  makeStep(9, '后半段加速', 8, 80, 70, '判断后半段提高航速后，哪一段更快。', '前后两段航速。', '比较切换点前后的航速终点和前段，再做选择。', [choice('哪一段更快', ['后半段更快', '前半段更快'])]),
  makeStep(10, '确认记录', 10, 1, 0, '用一句话记下航速、油耗或偏航里看到的现象。', '前面各步曲线。', '写出你在曲线上看到的差别。', [noteField]),
];

function containerCommand(step: VesselStep, time: number): VesselCommand {
  if (step.seq === 1) return baseCommand({ mode: 'manual', manualSpeed: 12 });
  if (step.seq === 2) return baseCommand({ mode: 'manual', manualSpeed: 7 });
  if (step.seq === 3) return baseCommand({ mode: 'manual', manualSpeed: time < 40 ? 12 : 7 });
  if (step.seq === 4) return baseCommand({ mode: 'manual', manualSpeed: 7.5 });
  if (step.seq === 5) return baseCommand({ mode: 'manual', manualSpeed: CONTAINER_SPEED, loadRatio: 0.2 });
  if (step.seq === 6) return baseCommand({ mode: 'manual', manualSpeed: CONTAINER_SPEED, loadRatio: 0.9 });
  if (step.seq === 7) return baseCommand({ mode: 'manual', manualSpeed: CONTAINER_SPEED, windSpeed: 15, windDirection: 90 });
  if (step.seq === 8) return baseCommand({ manualSpeed: CONTAINER_SPEED, targetHeading: time < 40 ? 0 : 12 });
  if (step.seq === 9) return baseCommand({ mode: 'manual', manualSpeed: time < 40 ? 7 : 12 });
  return baseCommand({ mode: 'manual', manualSpeed: CONTAINER_SPEED });
}

function scoreContainer(step: VesselStep, samples: VesselSample[], readings: VesselReadings): VesselScore {
  const speed = end(samples, 'speed');
  const heading = end(samples, 'heading');
  if (step.seq === 1) {
    return settleVesselStep(step, samples, Math.abs(speed - 12) > 0.3 ? '航速还没有停在高速指令上。' : null, [read(step, samples, readings, 'speed', 0.2, '航速')], '高速指令下，终点航速停在高速。');
  }
  if (step.seq === 2) {
    return settleVesselStep(step, samples, Math.abs(speed - 7) > 0.3 ? '航速还没有停在经济航速上。' : null, [read(step, samples, readings, 'speed', 0.2, '航速')], '经济航速指令下，终点航速更低。');
  }
  if (step.seq === 3) {
    const fast = samples.filter((item) => vesselValue(item, 'speed') >= 11);
    const fastFuel = fast.reduce((max, item) => Math.max(max, vesselValue(item, 'fuel')), 0);
    const plant = fast.length === 0 || Math.abs(speed - 7) > 0.3 || !(fastFuel > end(samples, 'fuel') * 2) ? '还没有同时看到高速段和随后的低速段。' : null;
    return settleVesselStep(step, samples, plant, [choiceReading(step, readings, 'choice', '低速更省')], '同样的船上，低速段的油耗指数更低。');
  }
  if (step.seq === 4) {
    const range = end(samples, 'range');
    return settleVesselStep(step, samples, range < 1490 || range > 1510 ? '航程和这段稳定航速对不上，请把曲线跑完再读。' : null, [read(step, samples, readings, 'range', 1, '航程')], '稳定航速下，终点航程落在这段时间对应的距离上。');
  }
  if (step.seq === 5) {
    return settleVesselStep(step, samples, Math.abs(end(samples, 'timeConstant') - 56) > 3 ? '空载时间常数和当前装载对不上。' : null, [read(step, samples, readings, 'timeConstant', 0.6, '时间常数')], '空载时时间常数更短。');
  }
  if (step.seq === 6) {
    return settleVesselStep(step, samples, Math.abs(end(samples, 'timeConstant') - 112) > 4 ? '满载时间常数和当前装载对不上。' : null, [read(step, samples, readings, 'timeConstant', 0.6, '时间常数')], '满载时时间常数更长。');
  }
  if (step.seq === 7) {
    const plant = Math.abs(heading) < 60 || Math.abs(end(samples, 'rudder')) >= 1 ? '横风下的航向变化还不够清楚，或舵没有保持在零附近。' : null;
    return settleVesselStep(step, samples, plant, [read(step, samples, readings, 'heading', 0.2, '实际航向')], '舵保持在零附近时，横风把航向吹偏了。');
  }
  if (step.seq === 8) {
    const saturated = peak(samples, 'rudder') >= 34;
    const entered = readings.choice?.trim() ?? '';
    if (!entered) return settleVesselStep(step, samples, null, [choiceReading(step, readings, 'choice', '没有顶满')], '');
    if (!saturated && entered === '顶满了') return settleVesselStep(step, samples, '舵角曲线没有顶到上限，请改选“没有顶满”。', [], '');
    if (saturated) return settleVesselStep(step, samples, '舵角曲线已经顶到上限，这一步不能按未顶满通过。', [], '');
    return settleVesselStep(step, samples, null, [choiceReading(step, readings, 'choice', '没有顶满')], '这次转向的舵角没有顶到上限。');
  }
  if (step.seq === 9) {
    const earlySlow = samples.some((item) => item.time <= 40 && vesselValue(item, 'speed') <= 8 && vesselValue(item, 'speed') >= 6);
    const plant = !earlySlow || speed < 11 ? '还没有看到前慢后快的两段航速。' : null;
    return settleVesselStep(step, samples, plant, [choiceReading(step, readings, 'choice', '后半段更快')], '后半段航速更高。');
  }
  return settleVesselStep(step, samples, null, [noteReading(step, readings)], readings.note?.trim() || '已记录实验现象。');
}

export const containerExperiment: VesselExperiment = {
  key: 'container-voyage',
  originPrefix: 'vcon_',
  vesselId: 'fleet-container-msc',
  title: '集装箱船航速与准点实验',
  sceneLabel: '集装箱船航速与准点',
  route: '/simulations/container',
  courseId: 'container-voyage-experiment',
  steps: containerSteps,
  series: [
    { id: 'speed', label: '航速', digits: 1 },
    { id: 'fuel', label: '油耗指数', digits: 0 },
    { id: 'range', label: '航程', digits: 0 },
    { id: 'heading', label: '实际航向', digits: 1 },
    { id: 'rudder', label: '舵角', digits: 1 },
    { id: 'load', label: '装载率', digits: 2 },
    { id: 'timeConstant', label: '时间常数', digits: 1 },
  ],
  command: containerCommand,
  score: scoreContainer,
};

const cruiseSteps: VesselStep[] = [
  makeStep(1, '减摇开启直航', 10, 180, 150, '减摇鳍打开时，看直航横摇和不适指数。', '横摇和不适指数。', '等直航曲线走完，读终点的不适指数。', [field('msi', '不适指数'), field('roll', '横摇', '°')]),
  makeStep(2, '关掉减摇鳍', 12, 180, 150, '关掉减摇鳍后，看横摇有没有变大。', '横摇峰值和不适指数峰值。', '和上一步对比横摇曲线，再做选择。', [choice('横摇变化', ['横摇变大', '横摇没变化'])]),
  makeStep(3, '再打开减摇鳍', 10, 180, 150, '重新打开减摇鳍，看不适指数能不能小下来。', '不适指数终点。', '等这一步自己的曲线走完再判断，不要沿用上一步的终点。', [choice('再次打开以后', ['横摇小下来', '横摇仍然很大'])]),
  makeStep(4, '转向中的横摇', 12, 160, 140, '减摇鳍开着转向时，看横摇是否仍被压住。', '横摇和实际航向。', '只要航向开始离开零、同时横摇没有明显放大即可提交。', [field('roll', '横摇', '°')]),
  makeStep(5, '不适指数', 10, 180, 150, '减摇鳍关闭时，看不适指数是在过程中升高，还是终点更高。', '不适指数的峰值和终点。', '先看曲线中间有没有抬起来，再和最后一个点比较。', [choice('不适指数', ['过程中明显升高', '终点更高'])]),
  makeStep(6, '航速保持', 8, 60, 30, '看舒适性直航时航速停在哪里。', '航速终点。', '读航速最后一个点。', [field('speed', '航速', 'm/s')]),
  makeStep(7, '减摇鳍功率', 10, 180, 150, '看减摇鳍工作时的功率。', '减摇鳍功率曲线。', '读功率终点。功率要能在曲线上看到。', [field('finPower', '减摇鳍功率', 'kW')]),
  makeStep(8, '终点横摇', 8, 180, 150, '读减摇鳍打开后直航结束时的横摇。', '横摇终点。', '读横摇最后一个点。', [field('roll', '横摇', '°')]),
  makeStep(9, '海况读数', 8, 30, 10, '确认这一组舒适性实验使用的海况。', '海况读数。', '填写曲线上的海况。', [field('sea', '海况')]),
  makeStep(10, '确认记录', 12, 1, 0, '用一句话记下减摇鳍打开和关闭时的差别。', '横摇和不适指数。', '写出你看到的横摇变化。', [noteField]),
];

function cruiseCommand(step: VesselStep, time: number): VesselCommand {
  const finOff = step.seq === 2 || step.seq === 5;
  return baseCommand({
    manualSpeed: CRUISE_SPEED,
    seaState: 4,
    fin: !finOff,
    targetHeading: step.seq === 4 && time >= 40 ? 8 : 0,
  });
}

function scoreCruise(step: VesselStep, samples: VesselSample[], readings: VesselReadings): VesselScore {
  const roll = end(samples, 'roll');
  const msi = end(samples, 'msi');
  if (step.seq === 1) {
    const plant = peak(samples, 'roll') > 0.6 || msi > 8 ? '减摇打开后的横摇或不适指数还没有压住。' : null;
    return settleVesselStep(step, samples, plant, [read(step, samples, readings, 'msi', 0.2, '不适指数'), read(step, samples, readings, 'roll', 0.05, '横摇')], '减摇鳍打开时，直航横摇和不适指数都不大。');
  }
  if (step.seq === 2) {
    const plant = peak(samples, 'roll') < 0.8 || peak(samples, 'msi') < 12 ? '关掉减摇鳍后，横摇或不适指数还没有明显变大。' : null;
    return settleVesselStep(step, samples, plant, [choiceReading(step, readings, 'choice', '横摇变大')], '关掉减摇鳍后横摇变大。');
  }
  if (step.seq === 3) {
    const plant = msi > 8 || peak(samples, 'roll') > 0.6 ? '再次打开减摇鳍后，横摇还没有小下来。' : null;
    return settleVesselStep(step, samples, plant, [choiceReading(step, readings, 'choice', '横摇小下来')], '再次打开减摇鳍后，横摇和不适指数小下来。');
  }
  if (step.seq === 4) {
    const turned = samples.some((item) => item.time >= 40 && Math.abs(vesselValue(item, 'heading')) > 5);
    const plant = !turned || peak(samples, 'roll') > 1.2 ? '转向过程中的横摇还不能说明减摇鳍仍在起作用。' : null;
    return settleVesselStep(step, samples, plant, [read(step, samples, readings, 'roll', 0.05, '横摇')], '转向过程中横摇仍被压在较小范围。');
  }
  if (step.seq === 5) {
    const plant = peak(samples, 'msi') < 12 || end(samples, 'msi') > 8 ? '还看不出不适指数在过程中升高、到终点又落回来。' : null;
    return settleVesselStep(step, samples, plant, [choiceReading(step, readings, 'choice', '过程中明显升高')], '关掉减摇鳍后，不适指数在过程中升高，终点又落回来。');
  }
  if (step.seq === 6) {
    return settleVesselStep(step, samples, Math.abs(end(samples, 'speed') - CRUISE_SPEED) > 0.5 ? '航速还没有停在巡航值附近。' : null, [read(step, samples, readings, 'speed', 0.2, '航速')], '舒适性直航时航速保持在巡航值附近。');
  }
  if (step.seq === 7) {
    const power = end(samples, 'finPower');
    return settleVesselStep(step, samples, power <= 0 || power >= 500 ? '减摇鳍功率还没有形成可读的工作值。' : null, [read(step, samples, readings, 'finPower', 0.2, '减摇鳍功率')], '减摇鳍打开后能读到工作功率。');
  }
  if (step.seq === 8) {
    return settleVesselStep(step, samples, Math.abs(roll) > 0.6 ? '终点横摇还没有落在较小范围。' : null, [read(step, samples, readings, 'roll', 0.05, '横摇')], '减摇鳍打开时，直航结束的横摇不大。');
  }
  if (step.seq === 9) {
    return settleVesselStep(step, samples, end(samples, 'sea') !== 4 ? '海况读数和这一步不一致。' : null, [read(step, samples, readings, 'sea', 0.1, '海况')], '这一组实验的海况是 4 级。');
  }
  return settleVesselStep(step, samples, null, [noteReading(step, readings)], readings.note?.trim() || '已记录实验现象。');
}

export const cruiseExperiment: VesselExperiment = {
  key: 'cruise-comfort',
  originPrefix: 'vcrz_',
  vesselId: 'fleet-cruise-adora',
  title: '邮轮舒适性操纵实验',
  sceneLabel: '邮轮舒适性操纵',
  route: '/simulations/cruise',
  courseId: 'cruise-comfort-experiment',
  steps: cruiseSteps,
  series: [
    { id: 'heading', label: '实际航向', digits: 1 },
    { id: 'roll', label: '横摇', digits: 2 },
    { id: 'msi', label: '不适指数', digits: 1 },
    { id: 'finPower', label: '减摇鳍功率', digits: 1 },
    { id: 'speed', label: '航速', digits: 1 },
    { id: 'yaw', label: '转艏速率', digits: 2 },
    { id: 'sea', label: '海况', digits: 0 },
  ],
  command: cruiseCommand,
  score: scoreCruise,
};

const drillingSteps: VesselStep[] = [
  makeStep(1, '定点读数', 10, 70, 55, '看动力定位能不能把平台留在目标附近。', '位置偏差终点。', '等曲线走完，读位置偏差的最后一个点。', [field('position', '位置偏差', 'm')]),
  makeStep(2, '航向读数', 8, 70, 55, '读定点时的航向偏差。', '航向偏差终点。', '读航向偏差的最后一个点。', [field('headingError', '航向偏差', '°')]),
  makeStep(3, '总功率', 12, 70, 55, '看功率曲线有没有超过平台限额。', '总功率的峰值和终点。', '看整段功率有没有顶过限额，再填写终点功率。', [choice('总功率', ['超过了', '还在限额内']), field('power', '总功率', 'kW')]),
  makeStep(4, '推进器台数', 8, 40, 15, '读当前参加工作的推进器数量。', '推进器台数。', '读曲线上的推进器台数。', [field('thrusters', '推进器台数', '台')]),
  makeStep(5, '关掉解耦', 14, 70, 55, '解耦关掉后，看位置偏差会不会变大。', '位置偏差终点。', '等这一步走完再和打开解耦时对比。', [choice('关掉以后', ['偏差明显变大', '偏差差不多'])]),
  makeStep(6, '打开解耦', 12, 70, 55, '重新打开解耦，看位置偏差能不能小回来。', '位置偏差终点。', '等这一步自己的曲线结束再判断。', [choice('打开以后', ['偏差小回来', '偏差仍然很大'])]),
  makeStep(7, '推进器都在工作', 10, 40, 15, '看八台推进器有没有停机。', '推进器台数。', '看工作台数再做选择。', [choice('推进器状态', ['没有停机', '有推进器停了'])]),
  makeStep(8, '功率读数', 8, 70, 55, '读定点时的总功率。', '总功率终点。', '按终点填写总功率。', [field('power', '总功率', 'kW')]),
  makeStep(9, '解耦对比', 8, 110, 95, '同一步里先开解耦再关掉，看位置能不能守住。', '前段和后段的位置偏差。', '比较切换点前后的位置偏差，再做选择。', [choice('怎样才能守住', ['开解耦才能守住', '关掉也一样'])]),
  makeStep(10, '确认记录', 10, 1, 0, '用一句话记下解耦打开和关闭时的差别。', '位置偏差和功率。', '写出你看到的位置变化。', [noteField]),
];

function drillingCommand(step: VesselStep, time: number): VesselCommand {
  const decoupling = step.seq === 5 ? false : step.seq === 9 ? time < 40 : true;
  return baseCommand({ mode: 'dp', decoupling, seaState: 3, dp: true });
}

function scoreDrilling(step: VesselStep, samples: VesselSample[], readings: VesselReadings): VesselScore {
  const position = end(samples, 'position');
  const power = end(samples, 'power');
  if (step.seq === 1) {
    return settleVesselStep(step, samples, position > 1.5 ? '位置还没有收到目标附近。' : null, [read(step, samples, readings, 'position', 0.05, '位置偏差')], '打开解耦后，终点位置留在目标附近。');
  }
  if (step.seq === 2) {
    return settleVesselStep(step, samples, Math.abs(end(samples, 'headingError')) > 5 ? '航向偏差还没有留在较小范围。' : null, [read(step, samples, readings, 'headingError', 0.05, '航向偏差')], '定点时航向偏差不大。');
  }
  if (step.seq === 3) {
    const over = samples.some((item) => vesselValue(item, 'power') > POWER_LIMIT);
    return settleVesselStep(step, samples, over ? null : '功率曲线还没有超过平台限额。', [choiceReading(step, readings, 'choice', '超过了'), read(step, samples, readings, 'power', 1, '总功率')], '功率曲线曾经超过平台限额。');
  }
  if (step.seq === 4) {
    return settleVesselStep(step, samples, end(samples, 'thrusters') !== 8 ? '参加工作的推进器不是八台。' : null, [read(step, samples, readings, 'thrusters', 0.1, '推进器台数')], '八台推进器都在工作。');
  }
  if (step.seq === 5) {
    return settleVesselStep(step, samples, position < 4 ? '关掉解耦后位置偏差还没有明显变大。' : null, [choiceReading(step, readings, 'choice', '偏差明显变大')], '关掉解耦后，位置偏差明显变大。');
  }
  if (step.seq === 6) {
    return settleVesselStep(step, samples, position > 1.5 ? '打开解耦后位置还没有小回来。' : null, [choiceReading(step, readings, 'choice', '偏差小回来')], '重新打开解耦后，位置偏差小回来。');
  }
  if (step.seq === 7) {
    return settleVesselStep(step, samples, end(samples, 'thrusters') !== 8 ? '有推进器没有参加工作。' : null, [choiceReading(step, readings, 'choice', '没有停机')], '八台推进器都没有停机。');
  }
  if (step.seq === 8) {
    return settleVesselStep(step, samples, power <= 0 ? '还读不到总功率。' : null, [read(step, samples, readings, 'power', 1, '总功率')], '定点时可以读到总功率。');
  }
  if (step.seq === 9) {
    let atSwitch = samples[0];
    for (const item of samples) {
      if (!atSwitch || Math.abs(item.time - 39) < Math.abs(atSwitch.time - 39)) atSwitch = item;
    }
    const earlyHeld = vesselValue(atSwitch, 'position') <= 1.5;
    const plant = !earlyHeld || position < 4 ? '这一步还没有同时看到守住和随后偏差变大。' : null;
    return settleVesselStep(step, samples, plant, [choiceReading(step, readings, 'choice', '开解耦才能守住')], '前段开着解耦能守住，关掉以后偏差变大。');
  }
  return settleVesselStep(step, samples, null, [noteReading(step, readings)], readings.note?.trim() || '已记录实验现象。');
}

export const drillingExperiment: VesselExperiment = {
  key: 'drilling-dp',
  originPrefix: 'vdrl_',
  vesselId: 'fleet-drill-hysy981',
  title: '钻井平台动力定位实验',
  sceneLabel: '钻井平台动力定位',
  route: '/simulations/drilling',
  courseId: 'drilling-dp-experiment',
  steps: drillingSteps,
  series: [
    { id: 'position', label: '位置偏差', digits: 2 },
    { id: 'headingError', label: '航向偏差', digits: 2 },
    { id: 'power', label: '总功率', digits: 0 },
    { id: 'thrusters', label: '推进器台数', digits: 0 },
    { id: 'decoupling', label: '解耦', digits: 0 },
  ],
  command: drillingCommand,
  score: scoreDrilling,
};

const iceSteps: VesselStep[] = [
  makeStep(1, '吊舱角度', 12, 180, 150, '十度航向指令下，看吊舱角度停在哪里。', '吊舱角度终点。', '等曲线走完，读吊舱角度的最后一个点。', [field('azimuth', '吊舱角度', '°')]),
  makeStep(2, '航向有没有跟上', 10, 180, 150, '吊舱转出去以后，看船的航向有没有跟着到十度。', '实际航向终点。', '对照航向曲线的终点再做选择。', [choice('实际航向', ['航向仍在零附近', '已经转到十度附近'])]),
  makeStep(3, '转艏速率', 10, 180, 150, '看这次转向里转艏速率有没有抬起来。', '转艏速率终点。', '读转艏速率的最后一个点。', [field('yaw', '转艏速率', '°/s')]),
  makeStep(4, '开阔水航速', 8, 60, 50, '航向指令为零时，读开阔水域的航速。', '航速终点。', '等曲线走完再读航速。', [field('speed', '航速', 'm/s')]),
  makeStep(5, '冰区航速', 8, 80, 50, '进入冰区后，看航速被压到哪里。', '航速终点。', '读冰区航速的最后一个点。', [field('speed', '航速', 'm/s')]),
  makeStep(6, '冰阻力', 12, 80, 50, '看冰区里冰阻力指数有没有上来。', '冰阻力指数。', '看冰阻力指数是不是明显高于零，再做选择。', [choice('冰阻力', ['冰阻力明显上来了', '冰阻力几乎为零'])]),
  makeStep(7, '冰区吊舱', 10, 160, 130, '冰区里给出十度航向指令，读吊舱角度。', '吊舱角度终点。', '等曲线走完再读吊舱角度。', [field('azimuth', '吊舱角度', '°')]),
  makeStep(8, '冰区航向', 10, 160, 130, '冰区里看航向离开零没有。', '实际航向终点。', '看航向终点再做选择。', [choice('冰区航向', ['几乎没转到', '已经转到十度附近'])]),
  makeStep(9, '冰区里的航速', 10, 160, 130, '吊舱已经转出角度时，看冰区航速有没有一起升高。', '航速和吊舱角度。', '把这一步的航速和吊舱角度放在一起看。', [choice('冰区航速', ['冰把航速压住了', '航速和吊舱一起升高'])]),
  makeStep(10, '确认记录', 10, 1, 0, '用一句话记下吊舱、航向和冰区航速。', '吊舱角度、航向和航速。', '写出你在曲线上看到的差别。', [noteField]),
];

function iceCommand(step: VesselStep, time: number): VesselCommand {
  const turning = step.seq === 1 || step.seq === 2 || step.seq === 3 || step.seq === 7 || step.seq === 8 || step.seq === 9;
  const inIce = step.seq === 5 || step.seq === 6 || step.seq === 7 || step.seq === 8 || step.seq === 9;
  return baseCommand({
    targetHeading: turning && time >= 30 ? 10 : 0,
    ice: inIce,
    iceThickness: inIce ? 0.8 : 0,
  });
}

function scoreIce(step: VesselStep, samples: VesselSample[], readings: VesselReadings): VesselScore {
  const heading = end(samples, 'heading');
  const speed = end(samples, 'speed');
  if (step.seq === 1 || step.seq === 7) {
    return settleVesselStep(step, samples, peak(samples, 'azimuth') < 15 ? '吊舱角度还没有明显离开零。' : null, [read(step, samples, readings, 'azimuth', 0.2, '吊舱角度')], '十度航向指令下，吊舱角度离开了零。');
  }
  if (step.seq === 2) {
    const plant = Math.abs(heading) > 2 || peak(samples, 'azimuth') < 10 ? '还不能同时看到吊舱转出、航向留在零附近。' : null;
    return settleVesselStep(step, samples, plant, [choiceReading(step, readings, 'choice', '航向仍在零附近')], '吊舱转出以后，航向仍留在零附近。');
  }
  if (step.seq === 3) {
    const plant = peak(samples, 'yaw') > 0.2 || peak(samples, 'azimuth') < 10 ? '转艏速率已经抬起来，或吊舱还没有转出。' : null;
    return settleVesselStep(step, samples, plant, [read(step, samples, readings, 'yaw', 0.02, '转艏速率')], '吊舱转出时，转艏速率仍接近零。');
  }
  if (step.seq === 4) {
    return settleVesselStep(step, samples, Math.abs(speed - 16) > 1.5 ? '开阔水域航速还没有走到这一步的终点。' : null, [read(step, samples, readings, 'speed', 0.2, '航速')], '开阔水域直航时，终点航速已经升起来。');
  }
  if (step.seq === 5) {
    return settleVesselStep(step, samples, speed > 1 || end(samples, 'iceForce') < 100 ? '冰区航速还没有被压住。' : null, [read(step, samples, readings, 'speed', 0.2, '航速')], '进入冰区后，航速被压在很低的值。');
  }
  if (step.seq === 6) {
    return settleVesselStep(step, samples, end(samples, 'iceForce') < 100 ? '冰阻力指数还没有明显上来。' : null, [choiceReading(step, readings, 'choice', '冰阻力明显上来了')], '冰区里的冰阻力指数明显高于零。');
  }
  if (step.seq === 8) {
    const plant = Math.abs(heading) > 2 || end(samples, 'iceForce') < 100 ? '冰区航向已经离开零，或还看不出冰阻力。' : null;
    return settleVesselStep(step, samples, plant, [choiceReading(step, readings, 'choice', '几乎没转到')], '冰区里给出十度指令后，航向几乎没有离开零。');
  }
  if (step.seq === 9) {
    const plant = speed > 1 || peak(samples, 'azimuth') < 10 ? '还不能同时看到吊舱转出和航速被压住。' : null;
    return settleVesselStep(step, samples, plant, [choiceReading(step, readings, 'choice', '冰把航速压住了')], '吊舱已经转出角度，冰仍把航速压住。');
  }
  return settleVesselStep(step, samples, null, [noteReading(step, readings)], readings.note?.trim() || '已记录实验现象。');
}

export const iceExperiment: VesselExperiment = {
  key: 'icebreaker-ice',
  originPrefix: 'vice_',
  vesselId: 'fleet-icebreaker-xuelong',
  title: '破冰船吊舱与冰区实验',
  sceneLabel: '破冰船吊舱与冰区',
  route: '/simulations/icebreaker',
  courseId: 'icebreaker-ice-experiment',
  steps: iceSteps,
  series: [
    { id: 'heading', label: '实际航向', digits: 1 },
    { id: 'commandHeading', label: '指令航向', digits: 1 },
    { id: 'yaw', label: '转艏速率', digits: 2 },
    { id: 'azimuth', label: '吊舱角度', digits: 1 },
    { id: 'iceForce', label: '冰阻力指数', digits: 1 },
    { id: 'speed', label: '航速', digits: 1 },
  ],
  command: iceCommand,
  score: scoreIce,
};

const dredgerSteps: VesselStep[] = [
  makeStep(1, '定点读数', 12, 70, 40, '定位打开、疏浚关闭时，看船能不能守在原点。', '位置偏差终点。', '等曲线走完，读位置偏差。', [field('position', '位置偏差', 'm')]),
  makeStep(2, '疏浚中守点', 12, 70, 40, '疏浚打开时，看定位还能不能守住原点。', '位置偏差终点。', '等曲线走完再读位置偏差。', [field('position', '位置偏差', 'm')]),
  makeStep(3, '退出定位', 12, 80, 60, '退出定位后，看船被流带出多远。', '离开原点的距离。', '读漂离距离的终点。', [field('drift', '漂离距离', 'm')]),
  makeStep(4, '拉不回来', 12, 80, 60, '从远处打开定位，看这一段时间里回不回得来。', '位置偏差终点。', '等曲线走完再判断有没有回到原点。', [choice('远离原点以后', ['还没有回到原点', '已经回到原点'])]),
  makeStep(5, '疏浚仍能守住', 10, 70, 40, '判断疏浚打开时原点还能不能守住。', '位置偏差终点。', '看终点位置偏差再做选择。', [choice('疏浚时的船位', ['还能守住', '守不住了'])]),
  makeStep(6, '被流带离', 8, 80, 60, '判断退出定位后船是不是被流带走。', '漂离距离。', '看终点离开原点的距离再做选择。', [choice('退出定位以后', ['被流带离', '仍然守在原点'])]),
  makeStep(7, '定位模式', 8, 70, 40, '确认这一步开着定位，并且船守在原点。', '定位模式和位置偏差。', '看定位标志和位置偏差再做选择。', [choice('当前模式', ['定位', '自由漂浮'])]),
  makeStep(8, '航向读数', 8, 70, 40, '读守在原点时的航向偏差。', '航向偏差终点。', '读航向偏差的最后一个点。', [field('headingError', '航向偏差', '°')]),
  makeStep(9, '工况结论', 8, 80, 60, '判断是不是离开定位以后才会漂走。', '漂离距离终点。', '看这一步退出定位后的距离再做选择。', [choice('什么时候会漂', ['离开定位才会漂', '开着定位也会漂'])]),
  makeStep(10, '确认记录', 10, 1, 0, '用一句话记下定位打开和退出时的差别。', '位置和漂离距离。', '写出你看到的船位变化。', [noteField]),
];

function dredgerCommand(step: VesselStep, _time: number): VesselCommand {
  const dpOff = step.seq === 3 || step.seq === 6 || step.seq === 9;
  const digging = step.seq === 2 || step.seq === 5;
  const offset = step.seq === 4;
  return baseCommand({
    mode: 'dp',
    dp: !dpOff,
    dredging: digging,
    startX: offset ? 20 : 0,
    startZ: offset ? 10 : 0,
    startHeading: offset ? 8 : 0,
  });
}

function scoreDredger(step: VesselStep, samples: VesselSample[], readings: VesselReadings): VesselScore {
  const position = end(samples, 'position');
  const drift = end(samples, 'drift');
  if (step.seq === 1 || step.seq === 2) {
    return settleVesselStep(step, samples, position > 0.2 ? '船还没有守在原点附近。' : null, [read(step, samples, readings, 'position', 0.05, '位置偏差')], '定位打开时，终点位置守在原点附近。');
  }
  if (step.seq === 3) {
    return settleVesselStep(step, samples, drift < 4 ? '退出定位后还没有明显离开原点。' : null, [read(step, samples, readings, 'drift', 0.2, '漂离距离')], '退出定位后，船被流带离原点。');
  }
  if (step.seq === 4) {
    return settleVesselStep(step, samples, position < 10 ? '船已经靠近原点，这一步没有形成拉不回来的现象。' : null, [choiceReading(step, readings, 'choice', '还没有回到原点')], '从远处打开定位后，这一段时间里还没有回到原点。');
  }
  if (step.seq === 5) {
    return settleVesselStep(step, samples, position > 0.2 ? '疏浚打开时没有守住原点。' : null, [choiceReading(step, readings, 'choice', '还能守住')], '疏浚打开时，定位仍然守住原点。');
  }
  if (step.seq === 6) {
    return settleVesselStep(step, samples, drift <= 3 ? '退出定位后还没有被带走。' : null, [choiceReading(step, readings, 'choice', '被流带离')], '退出定位后船被流带离原点。');
  }
  if (step.seq === 7) {
    const plant = end(samples, 'locating') !== 1 || position > 0.2 ? '这一步没有在定位状态下守住原点。' : null;
    return settleVesselStep(step, samples, plant, [choiceReading(step, readings, 'choice', '定位')], '这一步开着定位，船守在原点。');
  }
  if (step.seq === 8) {
    return settleVesselStep(step, samples, Math.abs(end(samples, 'headingError')) > 1 ? '航向偏差还没有留在原点附近。' : null, [read(step, samples, readings, 'headingError', 0.05, '航向偏差')], '守点时航向偏差很小。');
  }
  if (step.seq === 9) {
    return settleVesselStep(step, samples, drift <= 3 ? '退出定位后还没有漂起来。' : null, [choiceReading(step, readings, 'choice', '离开定位才会漂')], '离开定位以后船才会被带走。');
  }
  return settleVesselStep(step, samples, null, [noteReading(step, readings)], readings.note?.trim() || '已记录实验现象。');
}

export const dredgerExperiment: VesselExperiment = {
  key: 'dredger-mode',
  originPrefix: 'vdrg_',
  vesselId: 'fleet-dredger-tianjing',
  title: '挖泥船工况切换实验',
  sceneLabel: '挖泥船工况切换',
  route: '/simulations/dredger',
  courseId: 'dredger-mode-experiment',
  steps: dredgerSteps,
  series: [
    { id: 'position', label: '位置偏差', digits: 2 },
    { id: 'headingError', label: '航向偏差', digits: 2 },
    { id: 'speed', label: '航速', digits: 2 },
    { id: 'dredging', label: '疏浚', digits: 0 },
    { id: 'locating', label: '定位模式', digits: 0 },
    { id: 'drift', label: '漂离距离', digits: 1 },
  ],
  command: dredgerCommand,
  score: scoreDredger,
};

export const VESSEL_EXPERIMENTS: VesselExperiment[] = [
  lngExperiment,
  containerExperiment,
  cruiseExperiment,
  drillingExperiment,
  iceExperiment,
  dredgerExperiment,
];

export function findVesselExperiment(key: string): VesselExperiment | null {
  return VESSEL_EXPERIMENTS.find((experiment) => experiment.key === key) ?? null;
}
