import {createHash} from 'node:crypto';
import {appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {marked} from 'marked';
import {stringify as yaml} from 'yaml';
import * as echarts from 'echarts';
import {chromium, type Page} from '@playwright/test';
import {VESSEL_COURSES, VESSEL_GUIDE_EDITION, VESSEL_TEACHING_CARDS, type VesselCourseKey} from '../../src/resources/simulations/experiments/course-catalog';
import {DESTROYER_COURSE_STEPS, VESSEL_COURSE_VERSION} from '../../src/resources/simulations/experiments/destroyer-course';
import {LNG_COURSE_STEPS} from '../../src/resources/simulations/experiments/lng-course';
import {CONTAINER_COURSE_STEPS} from '../../src/resources/simulations/experiments/container-course';
import {CRUISE_COURSE_STEPS} from '../../src/resources/simulations/experiments/cruise-course';
import {DRILLING_COURSE_STEPS} from '../../src/resources/simulations/experiments/drilling-course';
import {ICEBREAKER_COURSE_STEPS} from '../../src/resources/simulations/experiments/icebreaker-course';
import {DREDGER_COURSE_STEPS} from '../../src/resources/simulations/experiments/dredger-course';
import {DESTROYER_STEP_SPECS} from '../../src/resources/simulations/experiments/destroyer-step-specs';
import {LNG_STEP_SPECS} from '../../src/resources/simulations/experiments/lng-step-specs';
import {CONTAINER_STEP_SPECS} from '../../src/resources/simulations/experiments/container-step-specs';
import {CRUISE_STEP_SPECS} from '../../src/resources/simulations/experiments/cruise-step-specs';
import {DRILLING_STEP_SPECS} from '../../src/resources/simulations/experiments/drilling-step-specs';
import {ICEBREAKER_STEP_SPECS} from '../../src/resources/simulations/experiments/icebreaker-step-specs';
import {DREDGER_STEP_SPECS} from '../../src/resources/simulations/experiments/dredger-step-specs';
import {getVesselWorkbenchPolicy, WORKBENCH_CHANNEL_LABELS} from '../../src/resources/simulations/experiments/vessel-workbench-policy';
import {vesselCourseStepReviewLimits} from '../../src/features/ilab/course-report-review-contract';
import {VESSEL_REPORT_SECTION_LABELS} from '../../src/features/ilab/course-artifact-contract';
import {createServerVesselSession} from '../../src/lib/control-engine/wasm-server';
import type {VesselSessionFrame} from '../../src/lib/control-engine/vessel-session';
import type {ExperimentStep} from '../../src/resources/simulations/contracts/experiment-step';
import type {VesselStep} from '../../src/resources/simulations/simulations/vessel-experiment';
import {DESTROYER_EXPERIMENT_STEPS} from '../../src/resources/simulations/simulations/destroyer-experiment';
import {VESSEL_EXPERIMENTS} from '../../src/resources/simulations/simulations/vessel-experiments';

const sourceRoot = path.resolve('docs/teaching/virtual-simulations');
const publicRoot = path.resolve('public/supporting');
const check = process.argv.includes('--check');
const printPdf = process.argv.includes('--pdf');
const stepsByCourse = {destroyer: DESTROYER_COURSE_STEPS, lng: LNG_COURSE_STEPS, container: CONTAINER_COURSE_STEPS,
  cruise: CRUISE_COURSE_STEPS, drilling: DRILLING_COURSE_STEPS, icebreaker: ICEBREAKER_COURSE_STEPS, dredger: DREDGER_COURSE_STEPS};
type GuideStepWorkbenchSpec = Partial<Pick<VesselStep,
  'goal' | 'actionSteps' | 'watch' | 'conditionText' | 'suggestion' |
  'predictionSpec' | 'observationSpec' | 'interpretationSpec' | 'sketchSpec'>>;
const stepSpecsByCourse: Record<VesselCourseKey, Readonly<Record<number, GuideStepWorkbenchSpec>>> = {
  destroyer: DESTROYER_STEP_SPECS, lng: LNG_STEP_SPECS, container: CONTAINER_STEP_SPECS,
  cruise: CRUISE_STEP_SPECS, drilling: DRILLING_STEP_SPECS, icebreaker: ICEBREAKER_STEP_SPECS, dredger: DREDGER_STEP_SPECS,
};
interface Example {
  courseVersion: string; outputChannel: string; outputUnit: string; outputKind: string; sourceKind: string; sourceDigest: string;
  timeS: number[]; measured: number[]; predicted: number[]; metrics: Record<string, number | null>;
  observation?: {label: string; unit: string; values: Array<number | null>};
  estimate?: {label: string; unit: string; values: Array<number | null>};
}
const examples = JSON.parse(readFileSync(path.join(sourceRoot, 'examples.json'), 'utf8')) as Record<VesselCourseKey, Example>;
const cognitive: Record<string, string> = {understand: '理解', apply: '应用', analyze: '分析', design: '设计',
  evaluate: '评价', synthesize: '综合设计', 'engineering-judgment': '工程判断'};
const signalLabels: Record<string, string> = {Heading: '航向', YawRate: '转艏速率', SpeedLog: '对水航速',
  SurfaceEncoder: '实际舵角', ShaftSpeed: '实际轴速', North: '北向位置', East: '东向位置',
  ShaftSpeed0: '左轴转速', ShaftSpeed1: '右轴转速', RollRate: '横摇角速度', SpecificForceY: '横向比力',
  SpecificForceZ: '垂向比力', SurfaceEncoder0: '左侧翼面角', SurfaceEncoder1: '右侧翼面角',
  WindSpeed: '相对风速', WindDirection: '相对风向', AzimuthEncoder0: '左吊舱偏转', AzimuthEncoder1: '右吊舱偏转',
  DredgerDepth: '刀位包络深度', DredgerSwaySpeed: '刀位横移速度', DredgerCutterRpm: '绞刀转速',
  DredgerCableTension0: '左锚缆张力', DredgerCableTension1: '右锚缆张力', DredgerSpudForce: '钢桩反力',
  EstimatedRoll: '观测估计横摇角', LowFrequencyNorth: '低频北向位置估计'};
const artifactLabels: Record<string, string> = {prediction: '运行前预测', run: '实际运行记录',
  'signal-annotations': '信号与受力标注', interpretation: '证据解释', 'actuator-time-constant': '执行器时间常数',
  'measurement-window': '本人量测窗口', 'training-run': '训练运行', 'student-model': '本人辨识模型',
  'fit-residual': '拟合残差', 'frozen-model': '冻结模型', 'independent-validation': '独立验证', comparison: '实际对照',
  'two-operating-point-runs': '两个工作点的实际运行', 'student-models': '本人局部模型组', 'parameter-table': '参数比较表',
  sketch: '本人手绘分析', 'model-characteristics': '模型特征分析', 'independent-closed-loop': '独立闭环对照',
  'frozen-controller': '冻结控制方案', 'fair-comparison': '同条件方案对比', 'unseen-validation': '未见工况验证',
  'constraint-check': '实际约束核验', 'boundary-judgment': '边界判断', 'model-assumptions': '模型假设',
  'four-own-runs': '至少四组本人运行', 'controller-comparison': '至少两种控制方案比较',
  'applicability-boundary': '适用边界', report: '六部分报告', 'braking-plan': '靠泊制动计划',
  'frozen-prediction': '运行前冻结预测', 'five-own-runs': '至少五组本人运行', 'six-own-runs': '至少六组本人运行'};
const sourceFiles = ['scripts/simulations/generate-teaching-guides.mts',
  'src/resources/simulations/experiments/catalog/teaching-cards.json', 'src/resources/simulations/experiments/course-catalog.ts',
  'src/resources/simulations/experiments/vessel-workbench-policy.ts',
  'src/features/ilab/course-report-review-contract.ts',
  ...Object.keys(stepsByCourse).flatMap((key) => [
    `src/resources/simulations/experiments/${key}-course.ts`,
    `src/resources/simulations/experiments/${key}-step-specs.ts`,
    `src/resources/simulations/experiments/${key}-step-specs-early.ts`,
    `src/resources/simulations/experiments/${key}-step-specs-late.ts`,
  ]),
  'docs/teaching/virtual-simulations/examples.json',
  'src/resources/simulations/simulations/destroyer-experiment.ts', 'src/resources/simulations/simulations/vessel-experiments.ts'];
const sanitizeCell = (text: string) => text.replace(/\r?\n+/g, ' ').replace(/\|/g, '\\|').trim();
const predictionKindLabels: Record<string, string> = {
  choice: '定向选择判断', numeric_target: '定量数值预估', ranking: '因果/性能排序', text: '机理预测说明',
};
const observationKindLabels: Record<string, string> = {
  channel_match: '通道物理角色配对', structured_metrics: '结构化指标读数（支持从曲线一键提取）',
  multi_run_slots: '多工况槽位对比读数（支持分槽位一键提取）', artifact_binding: '模型或独立对照作品绑定', text: '文本记录',
};
const artifactKindLabels: Record<string, string> = {
  model: '冻结局部模型', comparison: '独立对照曲线与指标', dual_model: '多工况/双工况局部模型组',
  dp_model: '三通道低频定位模型', spectrum: '频谱分析峰值', capacity: '受限控制与能力包络',
};
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const inputFiles = Object.fromEntries(sourceFiles.map((file) => [file, sha256(readFileSync(file))]));
const plotCache = new Map<VesselCourseKey, string>();
const parameterCache = new Map<VesselCourseKey, string>();

/** 文本按400行分批写入，检查模式逐项比较生成内容。 */
function writeText(filename: string, text: string) {
  const normalized = text.replace(/[–—−]/g, '-');
  if (check) {
    if (!existsSync(filename) || readFileSync(filename, 'utf8') !== normalized) throw new Error(`教学材料需要重新生成 ${filename}`);
    return;
  }
  mkdirSync(path.dirname(filename), {recursive: true});
  const lines = normalized.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  writeFileSync(filename, '');
  for (let index = 0; index < lines.length; index += 400) appendFileSync(filename, lines.slice(index, index + 400).join(''));
}

function examplePlot(key: VesselCourseKey) {
  const cached = plotCache.get(key);
  if (cached) return cached;
  const example = examples[key];
  if (example.courseVersion !== VESSEL_COURSE_VERSION || !example.sourceKind.includes('acceptance')
    || example.timeS.length < 2 || example.timeS.length > 400
    || example.measured.length !== example.timeS.length || example.predicted.length !== example.timeS.length) {
    throw new Error(`对照示例缺少同版本的软件验收来源 ${key}`);
  }
  const panels = [example.observation, example.estimate].filter((value) => Boolean(value)) as NonNullable<Example['observation']>[];
  const chart = echarts.init(null, undefined, {renderer: 'svg', ssr: true, width: 1000, height: 340 + panels.length * 145});
  const grids = panels.map((_panel, index) => ({left: 95, right: 30, top: 45 + index * 145, height: 95}));
  grids.push({left: 95, right: 30, top: 45 + panels.length * 145, height: 235});
  const axes = grids.map((_grid, index) => ({type: 'value', gridIndex: index, name: index === grids.length - 1 ? '实验时间 / s' : '',
    min: example.timeS[0], max: example.timeS.at(-1), axisLabel: {fontSize: 12}, splitLine: {show: false}}));
  const labels = [...panels.map((panel) => panel.label), example.outputKind === 'estimate' ? '实际观测估计' : '实际量测', '本人独立预测'];
  const series = panels.map((panel, index) => ({name: panel.label, type: 'line', xAxisIndex: index, yAxisIndex: index,
    showSymbol: false, lineStyle: {width: 1.5}, data: example.timeS.map((time, i) => [time, panel.values[i]])}));
  for (const [index, values] of [example.measured, example.predicted].entries()) series.push({
    name: labels[panels.length + index], type: 'line', xAxisIndex: panels.length, yAxisIndex: panels.length,
    showSymbol: false, lineStyle: {width: 2}, data: example.timeS.map((time, i) => [time, values[i]])});
  chart.setOption({animation: false, color: ['#64748b', '#16a085', '#0b729a', '#dc8635'],
    textStyle: {fontFamily: 'Inter, PingFang SC, Hiragino Sans GB, sans-serif'},
    legend: {top: 5, data: labels}, grid: grids, xAxis: axes,
    yAxis: [...panels.map((panel, index) => ({type: 'value', gridIndex: index, name: `${panel.label} / ${panel.unit}`, scale: true})),
      {type: 'value', gridIndex: panels.length, name: `${signalLabels[example.outputChannel] ?? '模型输出'} / ${example.outputUnit}`, scale: true}], series});
  const svg = chart.renderToSVGString();
  chart.dispose();
  plotCache.set(key, svg);
  return svg;
}

function staticParameters(key: VesselCourseKey) {
  const cached = parameterCache.get(key);
  if (cached) return cached;
  const course = VESSEL_COURSES[key];
  const session = createServerVesselSession({vessel: course.vessel, parameterVersion: course.parameterVersion, environment: 'P0', noiseLevel: 'N0'});
  try {
    const frame = JSON.parse(session.read()) as VesselSessionFrame;
    const rows = [['教学排水质量', frame.parameters.massKg, 'kg'], ['默认吃水', frame.parameters.draftM, 'm'],
      ['默认有效横稳心高', frame.parameters.effectiveGmTransverseM, 'm']]
      .map(([name, value, unit]) => `| ${name} | ${Number(value).toFixed(4)} | ${unit} | T / 同一冻结装配 |`).join('\n');
    if (rows.includes('NaN')) throw new Error(`默认参数不可用 ${key}`);
    parameterCache.set(key, rows);
    return rows;
  } finally {session.free();}
}

function stepMarkdown(key: VesselCourseKey, step: ExperimentStep & {sequence: number; minimumRuns: number}) {
  const sequence = step.sequence;
  const card = VESSEL_TEACHING_CARDS[key];
  const limits = vesselCourseStepReviewLimits(key, sequence);
  const spec = stepSpecsByCourse[key]?.[sequence];
  const policy = getVesselWorkbenchPolicy(key, sequence);
  const initialLabels: Record<string, string> = {speedMps: '初始对水航速 / m/s', headingDeg: '初始航向 / °', loadingRatio: '装载率', seed: '随机种子'};
  const initial = Object.entries(step.initialCondition).map(([name, value]) => `${initialLabels[name]} ${value}`).join('，');
  const conditionDesc = spec?.conditionText ? `${spec.conditionText}（${initial}）` : initial;
  const controls = step.studentControls.map((control) => `${control.label} ${control.min}-${control.max}${control.unit}${control.lockedReason ? `（${control.lockedReason}）` : ''}`).join('，');
  const goals = card.goals.filter((goal) => goal.steps.includes(sequence)).map((goal) => goal.text).join('，');
  const score = sequence === 20 ? '模型假设3分，本人证据3分，方案比较2分，适用边界2分'
    : `预测${limits.prediction}分，证据${limits.operation}分，性能${limits.performance}分，解释${limits.interpretation}分`;
  const actionSummary = spec?.actionSteps?.length ? spec.actionSteps.map((line, i) => `${i + 1}. ${line}`).join(' ') : null;
  const predSpec = spec?.predictionSpec;
  const sketchSpec = predSpec?.sketch ?? spec?.sketchSpec;
  const predParts: string[] = [];
  if (predSpec) predParts.push(`${predictionKindLabels[predSpec.kind] ?? '运行前预测'}：${predSpec.prompt}`);
  if (predSpec?.options?.length) predParts.push(`候选项：${predSpec.options.map((o) => o.label).join('；')}`);
  if (predSpec?.rankItems?.length) predParts.push(`排序对象：${predSpec.rankItems.join('、')}`);
  if (sketchSpec) predParts.push(`坐标轴多模态手绘板「${sketchSpec.label}」：${sketchSpec.hint}`);
  const obsSpec = spec?.observationSpec;
  const obsParts: string[] = [];
  if (obsSpec) {
    obsParts.push(`${observationKindLabels[obsSpec.kind] ?? '观测记录'}：${obsSpec.prompt}`);
    if (obsSpec.pairs?.length) obsParts.push(`配对项目：${obsSpec.pairs.map((p) => p.item).join('、')}`);
    if (obsSpec.metrics?.length) obsParts.push(`读数指标：${obsSpec.metrics.map((m) => (m.unit ? `${m.label}(${m.unit})` : m.label)).join('、')}`);
    if (obsSpec.slots?.length) obsParts.push(`工况槽位：${obsSpec.slots.map((s) => `${s.label}[${s.metrics.map((m) => (m.unit ? `${m.label}(${m.unit})` : m.label)).join('、')}]`).join('；')}`);
    if (obsSpec.artifactKind) obsParts.push(`绑定工件：${artifactKindLabels[obsSpec.artifactKind] ?? '模型或对照工件'}`);
  }
  const interpSummary = spec?.interpretationSpec?.checklist?.length
    ? spec.interpretationSpec.checklist.map((item, i) => `${i + 1}. ${item}`).join(' ')
    : null;
  const channels = policy.allowedChannels.map((ch) => WORKBENCH_CHANNEL_LABELS[ch]).filter(Boolean);
  const workbenchSummary = [policy.stepFocusNote, (policy.showIdentify || policy.showValidate) && channels.length ? `开放通道：${channels.join('、')}` : '']
    .filter(Boolean).join(' ');
  const rows = [
    `| 目标与认知 | ${sanitizeCell(`${spec?.goal ?? step.learningObjective}（${cognitive[step.cognitiveLevel]}）`)} |`,
    `| 能力证据 | ${sanitizeCell(goals)} |`,
    `| 初态与条件 | ${sanitizeCell(conditionDesc)} |`,
    `| 本步启用因素 | ${sanitizeCell(step.factorMask.join('、'))} |`,
    `| 合同参数范围 | ${sanitizeCell(controls)} |`,
    actionSummary ? `| 三阶段操作流程 | ${sanitizeCell(actionSummary)} |` : null,
    predParts.length ? `| 阶段一 · 运行前预测 | ${sanitizeCell(predParts.join('；'))} |` : null,
    obsParts.length ? `| 阶段二 · 观测与提取 | ${sanitizeCell(obsParts.join('；'))} |` : null,
    interpSummary ? `| 阶段三 · 解释核对 | ${sanitizeCell(interpSummary)} |` : null,
    workbenchSummary ? `| 评估工作台要点 | ${sanitizeCell(workbenchSummary)} |` : null,
    `| 事件与操作 | ${sanitizeCell(step.eventTimeline.join('。') || '整理本人已有证据')} |`,
    `| 时长与结束 | ${sanitizeCell(`${step.runDurationS === undefined ? '分析步骤' : `${step.runDurationS}s`}，${step.termination}`)} |`,
    `| 量测与统计窗 | ${sanitizeCell(`${step.measurementSignals.map((signal) => signalLabels[signal]).join('、')}，${step.observationWindowS.join('-')}s`)} |`,
    `| 最少运行 | ${step.minimumRuns}组${step.stepKind === 'analysis' ? '已有证据，按本步工件要求引用' : '实际记录'} |`,
    `| 训练与验证 | ${{training: '训练或方案设计', validation: '独立验证', none: '汇总分析'}[step.trainValidationRole]} |`,
    `| 提交工件 | ${sanitizeCell(step.requiredArtifacts.map((artifact) => artifactLabels[artifact]).join('、'))} |`,
    `| 评价 | ${sanitizeCell(`${score}，${step.rubric.performanceCriteria ?? step.rubric.evidenceCriteria ?? '按本人证据与解释复核'}`)} |`,
    `| 观察问题 | ${sanitizeCell(step.hints.join('。'))} |`,
    `| 常见误判与核对 | ${sanitizeCell(card.misconception)} |`,
  ].filter((line): line is string => Boolean(line));
  return [`<a id="${key}-step-${sequence}"></a>`, `### 第${sequence}步 ${step.title}`, '',
    '| 项目 | 本步要求 |', '| --- | --- |', ...rows, '',
    '先完成阶段一预测（含必需的坐标轴多模态手绘），再运行仿真并用阶段二结构化观测/一键提取记录实测证据，最后按阶段三核对清单解释差异。实际未达目标、缺测或保护退出的记录与分析继续保存。', ''].join('\n');
}

function guideMarkdown(key: VesselCourseKey, pages: Record<string, number> = {}) {
  const course = VESSEL_COURSES[key], card = VESSEL_TEACHING_CARDS[key], steps = stepsByCourse[key];
  const prefix = `实验${card.number} ${course.title}`;
  const conditions = steps.map((step) => `| ${step.sequence} | ${step.factorMask.join('、')} | ${step.studentControls.map((control) => control.label).join('、')} | 船型、参数包和本步预置事件 |`).join('\n');
  const rows = steps.map((step) => `| ${step.sequence} | [${step.title}](#${key}-step-${step.sequence}) | ${pages[`${key}-${step.sequence}`] ?? '待排页'} |`).join('\n');
  const objectives = card.goals.map((goal) => `- ${goal.text}。认知层级为${goal.level}，通过第${goal.steps.join('、')}步形成证据。`).join('\n');
  const references = card.references.map((reference) => `- ${reference.title}。[查看来源](${reference.url})`).join('\n');
  const legacy = key === 'destroyer' ? DESTROYER_EXPERIMENT_STEPS : Object.values(VESSEL_EXPERIMENTS).find((experiment) => experiment.key.startsWith(key))?.steps;
  if (!legacy || legacy.length !== 20) throw new Error(`旧步骤迁移源缺失 ${key}`);
  const migration = steps.map((step, index) => `| ${index + 1} | ${legacy[index].title} | ${step.title} | ${legacy[index].title === step.title ? '保留目标并补齐版本证据' : '替换并增加当前能力证据'} |`).join('\n');
  return [`# ${prefix}`, '', `课程版本 ${VESSEL_COURSE_VERSION}，指导书版本 ${VESSEL_GUIDE_EDITION}。`, '',
    '## 课程卡', '', card.audience, '', `先修知识包括${card.prerequisites.join('、')}。`, '',
    `设计用时为预习${card.minutes[0]}分钟、操作分析${card.minutes[1]}分钟、报告${card.minutes[2]}分钟，合计${card.minutes.reduce((sum, value) => sum + value, 0)}分钟。`, '',
    '用时为教学设计起点。任课教师结合学校课时长度、课前课后安排和实际试教学记录登记课表。七个实验分别启动、完成和复核，可按课程安排组合使用。', '', objectives, '',
    '## 原型、物理对象与参数', '', card.mechanism, '',
    '物理对象保留纵荡、横荡、升沉、横摇、纵摇与艏摇。世界坐标为北、东、下，船体坐标为艏、右舷、下。正航向为俯视顺时针。力矩按实际作用点的叉积计算。', '',
    '| 默认教学参数 | 数值 | 单位 | 来源等级 |', '| --- | --- | --- | --- |', staticParameters(key), '',
    'P表示公开原型资料，B表示公开基准，D表示计算与校准，T表示教学设定。上表为冻结装配的默认教学值。装载、姿态和工况变化后的参数按本次运行显示并记录。原始数值残差、参数来源和有效域随版本保存。', '',
    card.scope, '', '## 本人理想模型与独立对照', '', card.model, '', card.control, '',
    '三维船体由物理对象的实际受力推进。仪器提供带采样时刻、延迟和质量标志的量测，观测器据此形成状态估计。本人理想模型从所选量测窗口辨识，并独立生成预测曲线。', '',
    key === 'cruise' ? '本实验以A模式的实际差动鳍角和观测横摇角独立验证局部模型，理想力矩反馈另通过频率响应和实际有限鳍方案比较。'
      : key === 'drilling' ? '本实验以A模式的三通道低频记录检验本人模型，保留北、东和航向的独立预测，再比较实际受约束定位方案。'
        : 'A模式以实际执行器量测检验局部模型。B模式使用指令和声明的执行器模型，或已包含执行器的联合模型。C模式以本人模型的独立反馈预测闭环。每种对照均保存模型版本、输入通道、单位和窗口，训练与独立验证分别取证。', '',
    '图1采用同课程版本的软件验收记录，并保留原始预测偏差。图中量测、观测估计及预测按各自标签读取。', '', '![图1 本人模型与实际记录的时间对照](example.svg)', '',
    '## 二十步目录', '', '| 步骤 | 名称 | 页码 |', '| --- | --- | --- |', rows, '',
    '## 二十步操作、证据与评价', '', ...steps.map((step) => stepMarkdown(key, step)),
    '## 现实因素与操作权限', '',
    '物理后台持续支持执行器、六自由度、风、浪、流和观测链。本步启用情况由课程预置条件和实际开关回执确定，学生在解锁控件的范围内调整参数。', '',
    '| 步骤 | 启用因素 | 合同调整项 | 固定条件 |', '| --- | --- | --- | --- |', conditions, '',
    'P0表示平静环境，N0表示理想仪器等级。W表示风，V表示波浪，C表示流，E表示组合环境，N1/N2表示相应噪声与时延等级。冰区和专项机构按本步工况独立记录。', '',
    '## 评分与六部分报告', '',
    '右侧任务区采用「运行前预测（含坐标轴多模态手绘） → 仿真控制与结构化观测（支持一键提取与实测叠合） → 因果解释核对」三阶段交互工作台；控制区按当前步骤仅开放合同允许的参数，评估页签按步骤切换辨识通道并在跨步及刷新后持久保存已冻结模型与对照状态。', '',
    '每个实验满分100分，二十步分值依次为3、3、3、3、4、4、4、4、5、5、5、5、6、6、6、6、6、6、6、10分。前19步的预测占30%、操作与证据占40%、解释占30%。设计步骤将40%分为证据与性能各20%。', '',
    '第20步按模型假设3分、本人证据3分、方案比较2分和适用边界2分复核。缺证据、数值无效、模型失配、性能不足和解释错误分别记录。', '',
    ...Object.values(VESSEL_REPORT_SECTION_LABELS).map((label, index) => `${index + 1}. ${label}。引用本人运行、模型、独立对照和修改依据。`), '',
    '报告按步骤序号升序整理本人运行汇总表与单次详情，汇总表以「仿真时长 (s)」标明物理仿真秒数，与实验空间记录的学生操作用时相区分；报告内附冻结模型公式、实测与预测曲线及教师分步量规表。报告比较至少两种方案，并保留独立验证与未见工况。教师依据固定量规查看尝试、反馈、退回修改并确认最终成绩。', '',
    '## 设备准备、恢复与数据', '',
    '使用支持硬件加速的现代桌面浏览器，先完成页面中的网络与图形检查。三维场景就绪后开始，按需要暂停、折叠面板、调整视图和运行速率。图形接口与质量档由页面统一管理。', '',
    '普通平台账号和实验空间入口均将实验保存到当前账号。实验空间核验身份后建立专用来源账号并绑定本轮记录，控灵使用同一账号及本页步骤。刷新、重新打开或更换设备后核对原轮次、草稿与运行时间，再继续实验。', '',
    '网络失败时保留本机结果并按页面入口继续上传。教师确认最终成绩后按实验空间规则回传：实验名称自动拼接当前船型标题，20个步骤名称自动加注船型短标签前缀（如`[055舰]`、`[LNG船]`、`[集装箱]`、`[邮轮]`、`[981平台]`、`[雪龙2]`、`[天鲸号]`），步骤操作用时依据各步首次保存提交时刻计算，便于教师与学生在多船共用入口中准确区分各船过程记录与HTML附件。附件重试复用已成功成绩，新的独立实验轮次通过“重新开始新一轮实验”建立，历史结果分别保留。', '',
    '控灵提供本步机理与有来源的观察提示。学生保留本人预测、量测和解释，报告引用实际作品。账号资料、原始答案和私有运行记录按平台访问权限保存，公开示例采用脱敏的软件验收数据。', '',
    '## 旧版迁移与教学证据', '', card.legacyMigration, '',
    '旧步骤的操作背景与新能力目标按本册二十步重新对应，旧成绩保留其原课程版本。新版报告固定引用本次材料版本。旧版PDF可由历史发布标签追溯。', '',
    '下表按旧、新编号核对替换位置，当前教学目标和需提交的证据以本册各步为准。', '',
    '| 编号 | 原操作版 | 当前步骤 | 迁移处理 |', '| --- | --- | --- | --- |', migration, '',
    '当前图例和脚本记录用于软件验收。正式教学需另外登记实际课表、学生用时、低中高水平报告样例、独立迁移任务、教师交叉评分与改进反馈，相关证据以教学证据索引核验。', '',
    '## 参考资料', '', references, '', '参数与步骤的详细来源、校准误差和本课程适用域由同版本参数清单及本步运行报告共同保留。', ''].join('\n');
}

const css = `
  @page { size:A4; }
  body { color:#172839; font:10pt/1.65 Inter,'PingFang SC','Hiragino Sans GB',sans-serif; }
  article + article { break-before:page; }
  h1 { color:#073b55; font-size:23pt; line-height:1.4; margin:8mm 0 5mm; }
  h2 { color:#075b78; font-size:14pt; margin-top:7mm; break-after:avoid; }
  h3 { color:#075b78; font-size:11.5pt; margin-top:6mm; break-after:avoid; }
  p { margin:2.5mm 0; orphans:3; widows:3; }
  table { border-collapse:collapse; width:100%; font-size:8.7pt; line-height:1.55; margin:3mm 0; }
  thead { display:table-header-group; background:#eaf3f7; }
  th,td { border:0.25mm solid #c6d6df; padding:1.5mm 2mm; text-align:left; vertical-align:top; }
  tr { break-inside:avoid; } th:first-child,td:first-child { min-width:18mm; }
  img { display:block; width:100%; height:auto; margin:4mm 0; break-inside:avoid; }
  ul,ol { padding-left:7mm; } li { margin:1.5mm 0; } a { color:#075b78; overflow-wrap:anywhere; }
`;

async function htmlArticle(markdown: string, key?: VesselCourseKey) {
  let html = await marked.parse(markdown);
  if (key) html = html.replace('src="example.svg"', `src="data:image/svg+xml;base64,${Buffer.from(examplePlot(key)).toString('base64')}"`);
  return `<article>${html}</article>`;
}

function pdfPages(filename: string, keys: VesselCourseKey[]) {
  const pages = execFileSync('pdftotext', ['-enc', 'UTF-8', '-layout', filename, '-'], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024})
    .split('\f').filter((page) => page.trim());
  const normalize = (text: string) => text.replace(/\s+/g, '').replace(/[–—−]/g, '-');
  const text = pages.map(normalize);
  const starts = keys.map((key) => text.findIndex((page) => page.includes(normalize(`实验${VESSEL_TEACHING_CARDS[key].number} ${VESSEL_COURSES[key].title}`))));
  const numbers: Record<string, number> = {};
  for (const [index, key] of keys.entries()) {
    const begin = starts[index], end = starts[index + 1] ?? text.length;
    if (begin < 0) throw new Error(`PDF课程标题缺失 ${key}`);
    numbers[key] = begin + 1;
    for (const step of stepsByCourse[key]) {
      const marker = normalize(`第${step.sequence}步 ${step.title}`);
      const page = text.findIndex((value, pageIndex) => pageIndex >= begin && pageIndex < end && value.includes(marker));
      if (page < 0) throw new Error(`PDF步骤缺失 ${key} ${step.sequence}`);
      numbers[`${key}-${step.sequence}`] = page + 1;
    }
  }
  return {numbers, count: pages.length};
}

async function createPdf(page: Page, filename: string, keys: VesselCourseKey[], compilation = false) {
  let previous: Record<string, number> = {};
  for (let pass = 0; pass < 3; pass++) {
    const contents = [];
    if (compilation) {
      const index = keys.map((key) => `| ${VESSEL_TEACHING_CARDS[key].number} | ${VESSEL_COURSES[key].title} | ${previous[key] ?? '见书签'} |`).join('\n');
      contents.push(await htmlArticle(`# 七船独立仿真实验指导书汇编\n\n课程版本 ${VESSEL_COURSE_VERSION}，指导书版本 ${VESSEL_GUIDE_EDITION}。\n\n七个实验分别完成与评价。各册包括课程卡、物理与理想模型、二十步、量规、独立验证、报告和恢复说明。\n\n| 实验 | 名称 | 起始页 |\n| --- | --- | --- |\n${index}\n`));
    }
    for (const key of keys) contents.push(await htmlArticle(guideMarkdown(key, previous), key));
    await page.setContent(`<html lang="zh-CN"><head><meta charset="UTF-8"><style>${css}</style></head><body>${contents.join('')}</body></html>`);
    await page.evaluate(async () => {await document.fonts.ready;});
    await page.pdf({path: filename, format: 'A4', printBackground: true, tagged: true, outline: true,
      displayHeaderFooter: true, headerTemplate: '<span></span>',
      footerTemplate: `<div style="font:9px sans-serif;color:#6b7d89;width:100%;text-align:center">指导书 ${VESSEL_GUIDE_EDITION}　<span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
      margin: {top: '16mm', bottom: '17mm', left: '17mm', right: '17mm'}});
    const result = pdfPages(filename, keys);
    if (JSON.stringify(previous) === JSON.stringify(result.numbers)) return result;
    previous = result.numbers;
  }
  throw new Error('PDF目录页码未能稳定');
}

const keys = Object.keys(VESSEL_COURSES) as VesselCourseKey[];
const manifestPath = path.join(publicRoot, 'teaching-guides.json');
const paginationPath = path.join(sourceRoot, 'pagination.json');
let pagination: Record<string, Record<string, number>> = existsSync(paginationPath) ? JSON.parse(readFileSync(paginationPath, 'utf8')) : {};
const manualSourcePath = path.join(sourceRoot, 'platform-operation-manual.source.md');
inputFiles['docs/teaching/virtual-simulations/platform-operation-manual.source.md'] = sha256(readFileSync(manualSourcePath));
const completeInputHash = sha256(JSON.stringify(inputFiles));

if (printPdf) {
  if (check) throw new Error('检查模式与PDF写入分别执行');
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  try {
    const page = await browser.newPage();
    const target = path.join(publicRoot, VESSEL_GUIDE_EDITION);
    mkdirSync(target, {recursive: true});
    pagination = {};
    const files: Array<{name: string; pages: number; bytes: number; sha256: string}> = [];
    for (const key of keys) {
      const filename = path.join(target, VESSEL_COURSES[key].guideFile);
      const result = await createPdf(page, filename, [key]);
      pagination[key] = result.numbers;
      const bytes = readFileSync(filename);
      files.push({name: path.basename(filename), pages: result.count, bytes: bytes.length, sha256: sha256(bytes)});
      console.log(JSON.stringify({course: key, pages: result.count, bytes: bytes.length}));
    }
    const compilationName = 'experiment-guide-compilation.pdf';
    const compilation = await createPdf(page, path.join(target, compilationName), keys, true);
    pagination.compilation = compilation.numbers;
    const compilationBytes = readFileSync(path.join(target, compilationName));
    files.push({name: compilationName, pages: compilation.count, bytes: compilationBytes.length, sha256: sha256(compilationBytes)});
    const manual = readFileSync(manualSourcePath, 'utf8').replaceAll('{{COURSE_VERSION}}', VESSEL_COURSE_VERSION).replaceAll('{{GUIDE_EDITION}}', VESSEL_GUIDE_EDITION);
    await page.setContent(`<html lang="zh-CN"><head><meta charset="UTF-8"><style>${css}</style></head><body>${await htmlArticle(manual)}</body></html>`);
    await page.pdf({path: path.join(target, 'platform-operation-manual.pdf'), format: 'A4', printBackground: true, tagged: true, outline: true,
      displayHeaderFooter: true, headerTemplate: '<span></span>',
      footerTemplate: `<div style="font:9px sans-serif;color:#6b7d89;width:100%;text-align:center">操作说明 ${VESSEL_GUIDE_EDITION}　<span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
      margin: {top: '16mm', bottom: '17mm', left: '17mm', right: '17mm'}});
    const manualBytes = readFileSync(path.join(target, 'platform-operation-manual.pdf'));
    const manualText = execFileSync('pdftotext', [path.join(target, 'platform-operation-manual.pdf'), '-'], {encoding: 'utf8'});
    files.push({name: 'platform-operation-manual.pdf', pages: manualText.split('\f').filter((value) => value.trim()).length,
      bytes: manualBytes.length, sha256: sha256(manualBytes)});
    for (const file of files) copyFileSync(path.join(target, file.name), path.join(publicRoot, file.name));
    writeText(paginationPath, JSON.stringify(pagination, null, 2) + '\n');
    writeText(manifestPath, JSON.stringify({schema: 'act.virtual-simulation-guides.v1', courseVersion: VESSEL_COURSE_VERSION,
      edition: VESSEL_GUIDE_EDITION, inputHash: completeInputHash, inputFiles, files}, null, 2) + '\n');
  } finally {await browser.close();}
}

for (const key of keys) {
  const course = VESSEL_COURSES[key], card = VESSEL_TEACHING_CARDS[key], steps = stepsByCourse[key];
  const directory = path.join(sourceRoot, course.experimentId);
  const guide = guideMarkdown(key, pagination[key]);
  writeText(path.join(directory, 'guide.md'), guide);
  writeText(path.join(directory, 'course-card.md'), guide.split('## 原型、物理对象与参数')[0].trimEnd() + '\n');
  writeText(path.join(directory, 'example.svg'), examplePlot(key));
  writeText(path.join(directory, 'alignment.yaml'), yaml({courseVersion: VESSEL_COURSE_VERSION, guideEdition: VESSEL_GUIDE_EDITION,
    experimentId: course.experimentId, title: course.title, minutes: {preparation: card.minutes[0], practice: card.minutes[1], report: card.minutes[2]},
    objectives: card.goals, steps: steps.map((step) => ({id: step.stepId, sequence: step.sequence,
      objectiveRefs: card.goals.filter((goal) => goal.steps.includes(step.sequence)).map((goal) => goal.id), cognitiveLevel: step.cognitiveLevel,
      evidence: step.requiredArtifacts, measurementSignals: step.measurementSignals, trainValidationRole: step.trainValidationRole}))}));
  writeText(path.join(directory, 'rubric.yaml'), yaml({courseVersion: VESSEL_COURSE_VERSION, guideEdition: VESSEL_GUIDE_EDITION,
    experimentId: course.experimentId, total: 100, finalStepLabels: {prediction: '模型假设', operation: '本人证据', performance: '方案比较', interpretation: '适用边界'},
    steps: steps.map((step) => ({id: step.stepId, sequence: step.sequence, ...vesselCourseStepReviewLimits(key, step.sequence)}))}));
}
writeText(path.join(sourceRoot, 'compilation.md'), keys.map((key) => guideMarkdown(key, pagination.compilation)).join('\n\n'));
if (check || printPdf) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.inputHash !== completeInputHash || manifest.files.length !== 9) throw new Error('PDF来源或数量与当前课程不一致');
  for (const file of manifest.files) for (const filename of [path.join(publicRoot, file.name), path.join(publicRoot, VESSEL_GUIDE_EDITION, file.name)]) {
    if (sha256(readFileSync(filename)) !== file.sha256) throw new Error(`PDF版本或内容发生漂移 ${filename}`);
  }
}
console.log(JSON.stringify({status: 'passed', courses: keys.length, steps: keys.reduce((sum, key) => sum + stepsByCourse[key].length, 0),
  courseVersion: VESSEL_COURSE_VERSION, edition: VESSEL_GUIDE_EDITION, inputHash: completeInputHash}));
