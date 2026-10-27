import {
  CONTAINER_MSC_PARAMS,
  CRUISE_ADORA_PARAMS,
  LNG_CHANGHENG_PARAMS,
} from '../core/constants';
import { sketchLabelForId, sketchReadingError, SKETCH_PLOTS } from '@/features/ilab/sketch-plots';
import {
  baseCommand,
  choiceReading,
  nearReading,
  settleVesselStep,
  vesselValue,
  type VesselCommand,
  type VesselField,
  type VesselReadings,
  type VesselSample,
  type VesselScore,
  type VesselStep,
} from './vessel-experiment';

const LNG_SPEED = LNG_CHANGHENG_PARAMS.CRUISE_SPEED;
const CONTAINER_SPEED = CONTAINER_MSC_PARAMS.CRUISE_SPEED;
const CRUISE_SPEED = CRUISE_ADORA_PARAMS.CRUISE_SPEED;

export type InquiryShip = 'lng' | 'container' | 'cruise' | 'drilling' | 'ice' | 'dredger';

function field(key: string, label: string, unit?: string): VesselField {
  return { key, label, unit, kind: 'number' };
}

function choice(label: string, choices: string[], key = 'choice'): VesselField {
  return { key, label, kind: 'choice', choices };
}

const plotField: VesselField = choice('手绘图种类', SKETCH_PLOTS.map((plot) => plot.label), 'plotKind');
const sketchField: VesselField = { key: 'sketch', label: '手绘曲线', kind: 'sketch' };

function step(
  seq: number,
  title: string,
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
    scene: 'script',
    duration,
    minRunS: minRun,
    maxPoints: 2,
    expectTime: duration,
    fields,
  };
}

const sketchStep = step(
  19,
  '手绘图识别',
  12,
  6,
  '手绘奈奎斯特图、伯德图、根轨迹图或时域响应图，并交给识别核对。',
  '所选图种和手绘形状是否一致。',
  '先选择你要画的图，再在画布上画出对应曲线。识别结果要和你的选择一致。',
  [plotField, sketchField],
);

const INQUIRY: Record<InquiryShip, VesselStep[]> = {
  lng: [
    step(10, '零舵确认', 16, 8, '手操舵角保持为零，确认舵没有离开中位。', '舵角终点。', '这一步舵角保持为零。等曲线走完，读终点舵角。', [field('rudder', '舵角', '°')]),
    step(11, '右舵转艏', 70, 40, '固定右舵，看转艏速率往哪边起来。', '转艏速率终点。', '舵角由这一步自动打到右舷并保持。等曲线走完，读终点转艏速率。', [field('yaw', '转艏速率', '°/s')]),
    step(12, '左舵方向', 70, 40, '换成左舵，判断船往哪边转。', '转艏速率的符号。', '看转艏速率离开零的方向，再做选择。', [choice('转向', ['向左转了', '向右转了'])]),
    step(13, '靠泊低速', 25, 12, '把航速指令放到靠泊低速，读终点航速。', '航速终点。', '等航速曲线落稳后再读最后一个点。', [field('speed', '航速', 'm/s')]),
    step(14, '巡航对比', 20, 10, '回到巡航航速，判断它和靠泊低速哪一个更快。', '航速终点。', '看这一步终点航速落在哪一档，再做选择。', [choice('和靠泊相比', ['比靠泊快', '和靠泊一样慢'])]),
    step(15, '晃荡读数', 25, 12, '直航时再读一次液货晃荡。', '晃荡角终点。', '读晃荡角的最后一个点。', [field('slosh', '晃荡角', '°')]),
    step(16, '航向保持', 25, 12, '零航向指令下，判断航向有没有离开零。', '实际航向终点。', '看航向曲线的终点再做选择。', [choice('实际航向', ['航向留在零附近', '航向已经离开零'])]),
    step(17, '剩余距离读数', 20, 10, '读当前离泊位还剩多少距离。', '剩余距离终点。', '等曲线走完再读剩余距离。', [field('distance', '剩余距离', 'm')]),
    step(18, '低速判断', 20, 10, '判断这一步的航速是不是已经降到低速。', '航速终点。', '看航速终点再做选择。', [choice('当前航速', ['已经改用低速', '还在巡航'])]),
    sketchStep,
  ],
  container: [
    step(10, '高速复核', 25, 12, '再次给出高速指令，读航速是否停在高速。', '航速终点。', '等曲线走完，按终点填写航速。', [field('speed', '航速', 'm/s')]),
    step(11, '经济航速复核', 25, 12, '改回经济航速，读终点航速。', '航速终点。', '等曲线走完再读航速。', [field('speed', '航速', 'm/s')]),
    step(12, '先慢后快', 40, 28, '前段经济航速、后段高速，判断哪一段更快。', '切换前后的航速。', '比较切换点前后的航速，再做选择。', [choice('哪一段更快', ['后段更快', '前段更快'])]),
    step(13, '空载复核', 12, 6, '装载改为空载，再读时间常数。', '时间常数终点。', '读时间常数的最后一个点。', [field('timeConstant', '时间常数', 's')]),
    step(14, '满载复核', 12, 6, '装载改为满载，再读时间常数。', '时间常数终点。', '读时间常数的最后一个点。', [field('timeConstant', '时间常数', 's')]),
    step(15, '横风短时', 50, 30, '舵保持零，看较短时间内横风把航向吹到哪里。', '实际航向终点。', '不要打舵。等曲线走完再读航向。', [field('heading', '实际航向', '°')]),
    step(16, '零舵复核', 16, 8, '无风直航，确认舵留在零附近。', '舵角终点。', '读舵角的最后一个点。', [field('rudder', '舵角', '°')]),
    step(17, '油耗读数', 20, 10, '高速直航时读油耗指数。', '油耗指数终点。', '读油耗指数的最后一个点。', [field('fuel', '油耗指数')]),
    step(18, '短时航程', 30, 18, '用经济航速看这段较短时间走出多远。', '航程终点。', '等曲线覆盖这一步后再读航程。', [field('range', '航程', 'm')]),
    sketchStep,
  ],
  cruise: [
    step(10, '海况复核', 16, 8, '再确认这一组实验的海况。', '海况读数。', '填写曲线上的海况。', [field('sea', '海况')]),
    step(11, '巡航航速', 30, 16, '减摇鳍打开时，读直航航速。', '航速终点。', '读航速最后一个点。', [field('speed', '航速', 'm/s')]),
    step(12, '减摇功率复核', 30, 16, '读减摇鳍打开后的功率。', '减摇鳍功率。', '读功率终点。', [field('finPower', '减摇鳍功率', 'kW')]),
    step(13, '减摇关闭', 40, 20, '关掉减摇鳍，判断它还有没有出力。', '减摇鳍功率。', '看功率曲线再做选择。', [choice('减摇鳍', ['减摇鳍没有出力', '减摇鳍仍在出力'])]),
    step(14, '航向保持', 25, 12, '直航时判断航向有没有离开零。', '实际航向终点。', '看航向终点再做选择。', [choice('实际航向', ['航向留在零附近', '航向已经离开零'])]),
    step(15, '转艏读数', 25, 12, '直航时读转艏速率。', '转艏速率终点。', '读转艏速率的最后一个点。', [field('yaw', '转艏速率', '°/s')]),
    step(16, '横摇读数', 30, 16, '减摇鳍打开时读终点横摇。', '横摇终点。', '读横摇最后一个点。', [field('roll', '横摇', '°')]),
    step(17, '海况判断', 20, 10, '根据海况曲线判断等级。', '海况读数。', '看海况曲线再做选择。', [choice('海况', ['这是四级海况', '这是平静海况'])]),
    step(18, '航速判断', 25, 12, '判断直航航速是否停在巡航附近。', '航速终点。', '看航速终点再做选择。', [choice('航速', ['航速在巡航附近', '航速掉下去了'])]),
    sketchStep,
  ],
  drilling: [
    step(10, '定点复核', 60, 45, '解耦打开时，再读一次位置偏差。', '位置偏差终点。', '等曲线走完再读位置偏差。', [field('position', '位置偏差', 'm')]),
    step(11, '航向偏差复核', 60, 45, '定点时再读航向偏差。', '航向偏差终点。', '读航向偏差的最后一个点。', [field('headingError', '航向偏差', '°')]),
    step(12, '推进器复核', 20, 8, '再读参加工作的推进器数量。', '推进器台数。', '读曲线上的推进器台数。', [field('thrusters', '推进器台数', '台')]),
    step(13, '再次关掉解耦', 60, 45, '再次关掉解耦，判断位置偏差会不会变大。', '位置偏差终点。', '等这一步走完再做选择。', [choice('关掉以后', ['偏差变大了', '偏差差不多'])]),
    step(14, '推进器判断', 20, 8, '判断推进器有没有停机。', '推进器台数。', '看工作台数再做选择。', [choice('推进器状态', ['没有停机', '有推进器停了'])]),
    step(15, '功率复核', 40, 20, '再读定点时的总功率。', '总功率终点。', '按终点填写总功率。', [field('power', '总功率', 'kW')]),
    step(16, '重新守点', 60, 45, '重新打开解耦，判断位置能不能收回来。', '位置偏差终点。', '等曲线结束再做选择。', [choice('打开以后', ['位置收得回来', '位置仍然很大'])]),
    step(17, '解耦标志', 20, 8, '读当前解耦是不是开着。', '解耦标志。', '读解耦曲线的终点。', [field('decoupling', '解耦')]),
    step(18, '功率判断', 30, 15, '判断总功率曲线有没有出现。', '总功率。', '看功率曲线再做选择。', [choice('总功率', ['功率已经出现', '还读不到功率'])]),
    sketchStep,
  ],
  ice: [
    step(10, '开阔水航向', 40, 20, '开阔水域、航向指令为零时，读实际航向。', '实际航向终点。', '等曲线走完再读航向。', [field('heading', '实际航向', '°')]),
    step(11, '冰阻力读数', 60, 40, '进入冰区后读冰阻力指数。', '冰阻力指数终点。', '读冰阻力指数的最后一个点。', [field('iceForce', '冰阻力指数')]),
    step(12, '冰阻力判断', 60, 40, '判断冰区里的冰阻力有没有上来。', '冰阻力指数。', '看冰阻力指数再做选择。', [choice('冰阻力', ['冰阻力上来了', '冰阻力几乎为零'])]),
    step(13, '开阔水航向判断', 30, 15, '开阔水域判断航向有没有离开零。', '实际航向终点。', '看航向终点再做选择。', [choice('实际航向', ['航向留在零附近', '航向已经离开零'])]),
    step(14, '吊舱零位', 30, 15, '没有转向指令时，读吊舱角度。', '吊舱角度终点。', '读吊舱角度的最后一个点。', [field('azimuth', '吊舱角度', '°')]),
    step(15, '冰区航速判断', 60, 40, '判断冰区里航速有没有被压住。', '航速终点。', '看航速终点再做选择。', [choice('冰区航速', ['冰把航速压住了', '航速仍然很高'])]),
    step(16, '开阔水航速', 55, 45, '开阔水域再读一次航速。', '航速终点。', '等曲线走完再读航速。', [field('speed', '航速', 'm/s')]),
    step(17, '开阔水转艏', 30, 15, '开阔水域直航时读转艏速率。', '转艏速率终点。', '读转艏速率的最后一个点。', [field('yaw', '转艏速率', '°/s')]),
    step(18, '无冰判断', 30, 15, '判断开阔水域有没有冰阻力。', '冰阻力指数。', '看冰阻力指数再做选择。', [choice('冰阻力', ['几乎没有冰阻力', '冰阻力已经很大'])]),
    sketchStep,
  ],
  dredger: [
    step(10, '守点复核', 50, 40, '定位打开、疏浚关闭时，再读位置偏差。', '位置偏差终点。', '等曲线走完再读位置偏差。', [field('position', '位置偏差', 'm')]),
    step(11, '漂离读数', 70, 55, '退出定位后，读被流带出的距离。', '漂离距离终点。', '读漂离距离的终点。', [field('drift', '漂离距离', 'm')]),
    step(12, '定位判断', 45, 30, '判断这一步是不是开着定位并且守在原点。', '定位标志和位置偏差。', '看定位标志和位置偏差再做选择。', [choice('当前模式', ['正在定位', '自由漂浮'])]),
    step(13, '疏浚守点', 50, 40, '疏浚打开时再读位置偏差。', '位置偏差终点。', '等曲线走完再读位置偏差。', [field('position', '位置偏差', 'm')]),
    step(14, '航向复核', 50, 40, '守点时再读航向偏差。', '航向偏差终点。', '读航向偏差的最后一个点。', [field('headingError', '航向偏差', '°')]),
    step(15, '漂离判断', 70, 55, '再次退出定位，判断船是不是被流带走。', '漂离距离。', '看终点距离再做选择。', [choice('退出定位以后', ['被流带离', '仍然守在原点'])]),
    step(16, '守点航速', 40, 20, '定位守点时读航速。', '航速终点。', '读航速最后一个点。', [field('speed', '航速', 'm/s')]),
    step(17, '疏浚标志', 20, 8, '确认疏浚已经打开。', '疏浚标志。', '读疏浚曲线的终点。', [field('dredging', '疏浚')]),
    step(18, '远处判断', 50, 30, '从远处打开定位，判断这一段时间里回不回得来。', '位置偏差终点。', '看终点位置再做选择。', [choice('远离原点以后', ['还离原点很远', '已经回到原点'])]),
    sketchStep,
  ],
};

export function shipSteps(steps: VesselStep[], ship: InquiryShip): VesselStep[] {
  const tuned = steps.map((item) => (
    item.seq === 10
      ? { ...item, seq: 20, maxPoints: item.maxPoints - 2, scene: 'review', expectTime: 60 }
      : { ...item, maxPoints: item.maxPoints - 2 }
  ));
  const review = tuned.find((item) => item.seq === 20);
  if (!review) return tuned;
  return [...tuned.filter((item) => item.seq < 20), ...INQUIRY[ship], review];
}

function end(samples: VesselSample[], key: string): number {
  return vesselValue(samples[samples.length - 1], key);
}

function calm(ship: InquiryShip): VesselCommand {
  if (ship === 'lng') return baseCommand({ startX: -800, manualSpeed: LNG_SPEED });
  if (ship === 'container') return baseCommand({ mode: 'manual', manualSpeed: CONTAINER_SPEED });
  if (ship === 'cruise') return baseCommand({ manualSpeed: CRUISE_SPEED, seaState: 4, fin: true });
  if (ship === 'drilling') return baseCommand({ mode: 'dp', decoupling: true, seaState: 3, dp: true });
  if (ship === 'dredger') return baseCommand({ mode: 'dp', dp: true });
  return baseCommand();
}

export function inquiryCommand(ship: InquiryShip, stepDef: VesselStep, time: number): VesselCommand | null {
  if (stepDef.seq < 10 || stepDef.seq > 19) return null;
  if (stepDef.seq === 19) return calm(ship);
  if (ship === 'lng') {
    const common = { startX: -800, manualSpeed: LNG_SPEED };
    if (stepDef.seq === 10) return baseCommand({ ...common, mode: 'manual', manualRudder: 0 });
    if (stepDef.seq === 11) return baseCommand({ ...common, mode: 'manual', manualRudder: 12 });
    if (stepDef.seq === 12) return baseCommand({ ...common, mode: 'manual', manualRudder: -12 });
    if (stepDef.seq === 13 || stepDef.seq === 18) return baseCommand({ ...common, mode: 'manual', manualRudder: 0, manualSpeed: 2 });
    if (stepDef.seq === 17) return baseCommand(common);
    return baseCommand(common);
  }
  if (ship === 'container') {
    if (stepDef.seq === 10 || stepDef.seq === 17) return baseCommand({ mode: 'manual', manualSpeed: 12 });
    if (stepDef.seq === 11) return baseCommand({ mode: 'manual', manualSpeed: 7 });
    if (stepDef.seq === 12) return baseCommand({ mode: 'manual', manualSpeed: time < 15 ? 7 : 12 });
    if (stepDef.seq === 13) return baseCommand({ mode: 'manual', manualSpeed: CONTAINER_SPEED, loadRatio: 0.2 });
    if (stepDef.seq === 14) return baseCommand({ mode: 'manual', manualSpeed: CONTAINER_SPEED, loadRatio: 0.9 });
    if (stepDef.seq === 15) return baseCommand({ mode: 'manual', manualSpeed: CONTAINER_SPEED, windSpeed: 15, windDirection: 90 });
    if (stepDef.seq === 18) return baseCommand({ mode: 'manual', manualSpeed: 7.5 });
    return baseCommand({ mode: 'manual', manualSpeed: CONTAINER_SPEED });
  }
  if (ship === 'cruise') {
    const finOff = stepDef.seq === 13;
    return baseCommand({ manualSpeed: CRUISE_SPEED, seaState: 4, fin: !finOff });
  }
  if (ship === 'drilling') {
    const decoupling = stepDef.seq === 13 ? false : true;
    return baseCommand({ mode: 'dp', decoupling, seaState: 3, dp: true });
  }
  if (ship === 'ice') {
    const inIce = stepDef.seq === 11 || stepDef.seq === 12 || stepDef.seq === 15;
    return baseCommand({ ice: inIce, iceThickness: inIce ? 0.8 : 0 });
  }
  const dpOff = stepDef.seq === 11 || stepDef.seq === 15;
  const digging = stepDef.seq === 13 || stepDef.seq === 17;
  const offset = stepDef.seq === 18;
  return baseCommand({
    mode: 'dp',
    dp: !dpOff,
    dredging: digging,
    startX: offset ? 20 : 0,
    startZ: offset ? 10 : 0,
    startHeading: offset ? 8 : 0,
  });
}

function readNumber(stepDef: VesselStep, samples: VesselSample[], readings: VesselReadings, key: string, tolerance: number, label: string): VesselScore | null {
  return nearReading(stepDef, readings, key, end(samples, key), tolerance, label);
}

export function inquiryScore(
  ship: InquiryShip,
  stepDef: VesselStep,
  samples: VesselSample[],
  readings: VesselReadings,
): VesselScore | null {
  if (stepDef.seq < 10 || stepDef.seq > 19) return null;
  if (stepDef.seq === 19) {
    const error = sketchReadingError(readings);
    const label = sketchLabelForId(readings.sketchKind ?? '');
    const note = readings.sketchEvaluation?.trim() || '手绘图与所选种类一致。';
    return settleVesselStep(stepDef, samples, error, [], `手绘图识别为${label}。${note}`);
  }
  const score = (plant: string | null, checks: Array<VesselScore | null>, evaluation: string) => (
    settleVesselStep(stepDef, samples, plant, checks, evaluation)
  );
  if (ship === 'lng') return scoreLng(stepDef, samples, readings, score);
  if (ship === 'container') return scoreContainer(stepDef, samples, readings, score);
  if (ship === 'cruise') return scoreCruise(stepDef, samples, readings, score);
  if (ship === 'drilling') return scoreDrilling(stepDef, samples, readings, score);
  if (ship === 'ice') return scoreIce(stepDef, samples, readings, score);
  return scoreDredger(stepDef, samples, readings, score);
}

type ScoreFn = (plant: string | null, checks: Array<VesselScore | null>, evaluation: string) => VesselScore;

function scoreLng(stepDef: VesselStep, samples: VesselSample[], readings: VesselReadings, score: ScoreFn): VesselScore {
  const yaw = end(samples, 'yaw');
  const speed = end(samples, 'speed');
  const heading = end(samples, 'heading');
  const rudder = end(samples, 'rudder');
  if (stepDef.seq === 10) {
    return score(Math.abs(rudder) > 3 || Math.abs(end(samples, 'commandRudder')) > 3 ? '舵还没有留在零附近。' : null, [readNumber(stepDef, samples, readings, 'rudder', 0.2, '舵角')], '舵保持在零附近。');
  }
  if (stepDef.seq === 11) {
    return score(yaw <= 0.03 || Math.abs(end(samples, 'commandRudder')) < 8 ? '右舵下转艏还没有起来。' : null, [readNumber(stepDef, samples, readings, 'yaw', 0.05, '转艏速率')], '右舵把转艏速率带了起来。');
  }
  if (stepDef.seq === 12) {
    return score(yaw >= -0.03 ? '左舵下还看不出向左转。' : null, [choiceReading(stepDef, readings, 'choice', '向左转了')], '左舵让船向左转。');
  }
  if (stepDef.seq === 13) {
    return score(Math.abs(speed - 2) > 0.8 ? '航速还没有停在靠泊低速。' : null, [readNumber(stepDef, samples, readings, 'speed', 0.2, '航速')], '终点航速已经降到靠泊低速。');
  }
  if (stepDef.seq === 14) {
    return score(speed < 6 ? '这一步的航速还没有回到比靠泊更快的档。' : null, [choiceReading(stepDef, readings, 'choice', '比靠泊快')], '巡航航速比靠泊低速快。');
  }
  if (stepDef.seq === 15) {
    return score(end(samples, 'slosh') >= 2 ? '晃荡角已经很大，请再看终点。' : null, [readNumber(stepDef, samples, readings, 'slosh', 0.05, '晃荡角')], '这次直航的晃荡角不大。');
  }
  if (stepDef.seq === 16) {
    return score(Math.abs(heading) > 2 ? '航向已经离开零附近。' : null, [choiceReading(stepDef, readings, 'choice', '航向留在零附近')], '零航向指令下，航向留在零附近。');
  }
  if (stepDef.seq === 17) {
    const distance = end(samples, 'distance');
    return score(!(distance > 100 && distance < 5000) ? '剩余距离还读不出来。' : null, [readNumber(stepDef, samples, readings, 'distance', 1, '剩余距离')], '可以读到离泊位的剩余距离。');
  }
  return score(speed >= 4 ? '航速还没有降到低速。' : null, [choiceReading(stepDef, readings, 'choice', '已经改用低速')], '这一步的航速已经降到低速。');
}

function scoreContainer(stepDef: VesselStep, samples: VesselSample[], readings: VesselReadings, score: ScoreFn): VesselScore {
  const speed = end(samples, 'speed');
  if (stepDef.seq === 10) {
    return score(Math.abs(speed - 12) > 1.5 ? '航速还没有停在高速指令上。' : null, [readNumber(stepDef, samples, readings, 'speed', 0.2, '航速')], '高速指令下，终点航速停在高速。');
  }
  if (stepDef.seq === 11) {
    return score(Math.abs(speed - 7) > 1.5 ? '航速还没有停在经济航速上。' : null, [readNumber(stepDef, samples, readings, 'speed', 0.2, '航速')], '经济航速指令下，终点航速更低。');
  }
  if (stepDef.seq === 12) {
    const earlySlow = samples.some((item) => item.time <= 15 && vesselValue(item, 'speed') <= 9);
    return score(!earlySlow || speed < 10 ? '还没有看到前慢后快的两段航速。' : null, [choiceReading(stepDef, readings, 'choice', '后段更快')], '后段航速更高。');
  }
  if (stepDef.seq === 13) {
    return score(Math.abs(end(samples, 'timeConstant') - 56) > 8 ? '空载时间常数和当前装载对不上。' : null, [readNumber(stepDef, samples, readings, 'timeConstant', 0.6, '时间常数')], '空载时时间常数更短。');
  }
  if (stepDef.seq === 14) {
    return score(Math.abs(end(samples, 'timeConstant') - 112) > 10 ? '满载时间常数和当前装载对不上。' : null, [readNumber(stepDef, samples, readings, 'timeConstant', 0.6, '时间常数')], '满载时时间常数更长。');
  }
  if (stepDef.seq === 15) {
    return score(Math.abs(end(samples, 'heading')) < 15 || Math.abs(end(samples, 'rudder')) >= 2 ? '横风下的航向变化还不够清楚。' : null, [readNumber(stepDef, samples, readings, 'heading', 0.2, '实际航向')], '舵留在零附近时，横风把航向吹偏了。');
  }
  if (stepDef.seq === 16) {
    return score(Math.abs(end(samples, 'rudder')) > 2 ? '舵还没有留在零附近。' : null, [readNumber(stepDef, samples, readings, 'rudder', 0.2, '舵角')], '无风直航时舵留在零附近。');
  }
  if (stepDef.seq === 17) {
    return score(end(samples, 'fuel') <= 0 ? '还读不到油耗指数。' : null, [readNumber(stepDef, samples, readings, 'fuel', 1, '油耗指数')], '高速直航时可以读到油耗指数。');
  }
  const range = end(samples, 'range');
  return score(range < 150 || range > 400 ? '航程和这段航速对不上。' : null, [readNumber(stepDef, samples, readings, 'range', 1, '航程')], '这段时间的航程可以按终点读出。');
}

function scoreCruise(stepDef: VesselStep, samples: VesselSample[], readings: VesselReadings, score: ScoreFn): VesselScore {
  const speed = end(samples, 'speed');
  if (stepDef.seq === 10) {
    return score(end(samples, 'sea') !== 4 ? '海况读数和这一步不一致。' : null, [readNumber(stepDef, samples, readings, 'sea', 0.1, '海况')], '这一组实验的海况是 4 级。');
  }
  if (stepDef.seq === 11) {
    return score(Math.abs(speed - CRUISE_SPEED) > 1.5 ? '航速还没有停在巡航值附近。' : null, [readNumber(stepDef, samples, readings, 'speed', 0.2, '航速')], '直航航速停在巡航值附近。');
  }
  if (stepDef.seq === 12) {
    const power = end(samples, 'finPower');
    return score(power <= 0 || power >= 800 ? '减摇鳍功率还没有形成可读的工作值。' : null, [readNumber(stepDef, samples, readings, 'finPower', 0.2, '减摇鳍功率')], '减摇鳍打开后能读到工作功率。');
  }
  if (stepDef.seq === 13) {
    return score(end(samples, 'finPower') >= 1 ? '减摇鳍功率还没有降下来。' : null, [choiceReading(stepDef, readings, 'choice', '减摇鳍没有出力')], '关掉减摇鳍后，功率降下来了。');
  }
  if (stepDef.seq === 14) {
    return score(Math.abs(end(samples, 'heading')) > 3 ? '航向已经离开零附近。' : null, [choiceReading(stepDef, readings, 'choice', '航向留在零附近')], '直航时航向留在零附近。');
  }
  if (stepDef.seq === 15) {
    return score(Math.abs(end(samples, 'yaw')) > 1 ? '转艏速率还没有留在较小范围。' : null, [readNumber(stepDef, samples, readings, 'yaw', 0.05, '转艏速率')], '直航时转艏速率不大。');
  }
  if (stepDef.seq === 16) {
    return score(Math.abs(end(samples, 'roll')) > 5 ? '终点横摇还读不稳。' : null, [readNumber(stepDef, samples, readings, 'roll', 0.05, '横摇')], '可以读到终点横摇。');
  }
  if (stepDef.seq === 17) {
    return score(end(samples, 'sea') !== 4 ? '海况不是这一步的等级。' : null, [choiceReading(stepDef, readings, 'choice', '这是四级海况')], '这一步的海况是 4 级。');
  }
  return score(Math.abs(speed - CRUISE_SPEED) > 1.5 ? '航速还没有停在巡航附近。' : null, [choiceReading(stepDef, readings, 'choice', '航速在巡航附近')], '直航航速停在巡航附近。');
}

function scoreDrilling(stepDef: VesselStep, samples: VesselSample[], readings: VesselReadings, score: ScoreFn): VesselScore {
  const position = end(samples, 'position');
  const power = end(samples, 'power');
  if (stepDef.seq === 10) {
    return score(position > 2 ? '位置还没有收到目标附近。' : null, [readNumber(stepDef, samples, readings, 'position', 0.05, '位置偏差')], '打开解耦后，终点位置留在目标附近。');
  }
  if (stepDef.seq === 11) {
    return score(Math.abs(end(samples, 'headingError')) > 8 ? '航向偏差还没有留在较小范围。' : null, [readNumber(stepDef, samples, readings, 'headingError', 0.05, '航向偏差')], '定点时航向偏差不大。');
  }
  if (stepDef.seq === 12) {
    return score(end(samples, 'thrusters') !== 8 ? '参加工作的推进器不是八台。' : null, [readNumber(stepDef, samples, readings, 'thrusters', 0.1, '推进器台数')], '八台推进器都在工作。');
  }
  if (stepDef.seq === 13) {
    return score(position < 2 ? '关掉解耦后位置偏差还没有变大。' : null, [choiceReading(stepDef, readings, 'choice', '偏差变大了')], '关掉解耦后，位置偏差变大。');
  }
  if (stepDef.seq === 14) {
    return score(end(samples, 'thrusters') !== 8 ? '有推进器没有参加工作。' : null, [choiceReading(stepDef, readings, 'choice', '没有停机')], '八台推进器都没有停机。');
  }
  if (stepDef.seq === 15) {
    return score(power <= 0 ? '还读不到总功率。' : null, [readNumber(stepDef, samples, readings, 'power', 1, '总功率')], '定点时可以读到总功率。');
  }
  if (stepDef.seq === 16) {
    return score(position > 2 ? '打开解耦后位置还没有收回来。' : null, [choiceReading(stepDef, readings, 'choice', '位置收得回来')], '重新打开解耦后，位置偏差小回来。');
  }
  if (stepDef.seq === 17) {
    return score(end(samples, 'decoupling') !== 1 ? '解耦没有开着。' : null, [readNumber(stepDef, samples, readings, 'decoupling', 0.1, '解耦')], '这一步的解耦是开着的。');
  }
  return score(power <= 0 ? '还读不到总功率。' : null, [choiceReading(stepDef, readings, 'choice', '功率已经出现')], '这一步可以读到总功率。');
}

function scoreIce(stepDef: VesselStep, samples: VesselSample[], readings: VesselReadings, score: ScoreFn): VesselScore {
  const heading = end(samples, 'heading');
  const speed = end(samples, 'speed');
  const iceForce = end(samples, 'iceForce');
  if (stepDef.seq === 10) {
    return score(Math.abs(heading) > 2 ? '开阔水域的航向已经离开零。' : null, [readNumber(stepDef, samples, readings, 'heading', 0.2, '实际航向')], '开阔水域直航时，航向留在零附近。');
  }
  if (stepDef.seq === 11) {
    return score(iceForce < 20 ? '冰阻力指数还没有上来。' : null, [readNumber(stepDef, samples, readings, 'iceForce', 0.2, '冰阻力指数')], '进入冰区后可以读到冰阻力指数。');
  }
  if (stepDef.seq === 12) {
    return score(iceForce < 20 ? '冰阻力指数还没有上来。' : null, [choiceReading(stepDef, readings, 'choice', '冰阻力上来了')], '冰区里的冰阻力指数明显高于零。');
  }
  if (stepDef.seq === 13) {
    return score(Math.abs(heading) > 2 ? '航向已经离开零附近。' : null, [choiceReading(stepDef, readings, 'choice', '航向留在零附近')], '开阔水域的航向留在零附近。');
  }
  if (stepDef.seq === 14) {
    return score(Math.abs(end(samples, 'azimuth')) > 8 ? '没有转向指令时吊舱角度不该离开零这么多。' : null, [readNumber(stepDef, samples, readings, 'azimuth', 0.2, '吊舱角度')], '没有转向指令时，吊舱角度留在零附近。');
  }
  if (stepDef.seq === 15) {
    return score(speed > 2 ? '冰区航速还没有被压住。' : null, [choiceReading(stepDef, readings, 'choice', '冰把航速压住了')], '冰把航速压在很低的值。');
  }
  if (stepDef.seq === 16) {
    return score(speed < 10 ? '开阔水域航速还没有升起来。' : null, [readNumber(stepDef, samples, readings, 'speed', 0.2, '航速')], '开阔水域直航时，航速已经升起来。');
  }
  if (stepDef.seq === 17) {
    return score(Math.abs(end(samples, 'yaw')) > 0.5 ? '转艏速率还没有留在较小范围。' : null, [readNumber(stepDef, samples, readings, 'yaw', 0.05, '转艏速率')], '开阔水域直航时转艏速率不大。');
  }
  return score(iceForce > 20 ? '开阔水域不该出现明显冰阻力。' : null, [choiceReading(stepDef, readings, 'choice', '几乎没有冰阻力')], '开阔水域几乎没有冰阻力。');
}

function scoreDredger(stepDef: VesselStep, samples: VesselSample[], readings: VesselReadings, score: ScoreFn): VesselScore {
  const position = end(samples, 'position');
  const drift = end(samples, 'drift');
  if (stepDef.seq === 10 || stepDef.seq === 13) {
    return score(position > 0.5 ? '船还没有守在原点附近。' : null, [readNumber(stepDef, samples, readings, 'position', 0.05, '位置偏差')], '定位打开时，终点位置守在原点附近。');
  }
  if (stepDef.seq === 11) {
    return score(drift < 2 ? '退出定位后还没有明显离开原点。' : null, [readNumber(stepDef, samples, readings, 'drift', 0.2, '漂离距离')], '退出定位后，船被流带离原点。');
  }
  if (stepDef.seq === 12) {
    return score(end(samples, 'locating') !== 1 || position > 0.5 ? '这一步没有在定位状态下守住原点。' : null, [choiceReading(stepDef, readings, 'choice', '正在定位')], '这一步开着定位，船守在原点。');
  }
  if (stepDef.seq === 14) {
    return score(Math.abs(end(samples, 'headingError')) > 2 ? '航向偏差还没有留在原点附近。' : null, [readNumber(stepDef, samples, readings, 'headingError', 0.05, '航向偏差')], '守点时航向偏差很小。');
  }
  if (stepDef.seq === 15) {
    return score(drift < 2 ? '退出定位后还没有被带走。' : null, [choiceReading(stepDef, readings, 'choice', '被流带离')], '退出定位后船被流带离原点。');
  }
  if (stepDef.seq === 16) {
    return score(end(samples, 'speed') > 3 ? '守点时航速还没有降下来。' : null, [readNumber(stepDef, samples, readings, 'speed', 0.05, '航速')], '定位守点时航速不高。');
  }
  if (stepDef.seq === 17) {
    return score(end(samples, 'dredging') !== 1 ? '疏浚没有打开。' : null, [readNumber(stepDef, samples, readings, 'dredging', 0.1, '疏浚')], '这一步的疏浚是打开的。');
  }
  return score(position < 8 ? '船已经靠近原点，这一步没有形成拉不回来的现象。' : null, [choiceReading(stepDef, readings, 'choice', '还离原点很远')], '从远处打开定位后，这一段时间里还离原点很远。');
}
