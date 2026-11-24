import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import type { StepObservationMetricDef, VesselSample, VesselStep } from '../simulations/vessel-experiment';
import type { SketchActualCurveSeries } from './sketch-coordinate-templates';

export type LngStepWorkbenchSpec = Pick<VesselStep, 'goal' | 'watch' | 'suggestion'> &
  Pick<VesselStep, 'actionSteps' | 'conditionText' | 'predictionSpec' | 'observationSpec' | 'interpretationSpec' | 'sketchSpec'>;

export const choiceOpt = (value: string, label: string, detail: string) => ({ value, label, detail });

export const formatLngParam = (value: unknown, digits: number, scale = 1): string | null =>
  typeof value === 'number' && Number.isFinite(value) ? (value * scale).toFixed(digits) : null;

export function extractLngSpeedActualSeries(samples: VesselSample[]): SketchActualCurveSeries[] {
  const points = samples
    .map((sample) => ({ x: sample.time, y: sample.values.speed }))
    .filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));
  return points.length < 2 ? [] : [{ id: 'lng-actual-water-speed', label: '实测对水航速 (m/s)', color: '#06b6d4', points }];
}

export function extractLngSloshActualSeries(samples: VesselSample[]): SketchActualCurveSeries[] {
  const points = samples
    .map((sample) => ({ x: sample.time, y: sample.values.slosh }))
    .filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));
  return points.length < 2 ? [] : [{ id: 'lng-actual-slosh-height', label: '实测液面幅值 (m)', color: '#0ea5e9', points }];
}

export function extractLngReverseFraction(run: VesselRunSummary): string | null {
  const raw = run.courseSettings?.reverseFraction;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw.toFixed(1);
  const radS = run.finalInput?.actuators.shafts[0]?.speed_reference_rad_s;
  const rated = run.parameters?.shaftConfigurations[0]?.ratedRpm;
  return typeof radS === 'number' && typeof rated === 'number' && rated > 0
    ? Math.abs((radS * 30) / (Math.PI * rated)).toFixed(1)
    : null;
}

export function isDefaultLngBerthPlan(run: VesselRunSummary): boolean {
  const plan = run.initialInput.berthPlan;
  if (!plan) return false;
  return plan.brakingDistanceM === 1200 && plan.nodes.length === 2
    && plan.nodes[0]?.distanceM === 600 && plan.nodes[0]?.speedMps === 2
    && plan.nodes[1]?.distanceM === 30 && plan.nodes[1]?.speedMps === 0;
}

const TIME_1200_TICKS = [0, 240, 480, 720, 960, 1200].map((value) => ({ value, label: String(value) }));
const SPEED_4_BASELINE = [{ value: 4.0, label: '初速 4.0 m/s', color: '#64748b' }];
const STEP1_CAUSAL_CHOICES = [
  '瞬时指令给定（第1阶）',
  '轴系短滞后跟随（第2阶）',
  '推力随轴速建立（第3阶）',
  '船体大惯性慢滞后（第4阶）',
  '速度时间积分位移（第5阶）',
];

const berthPlanMetrics = (labelKey: string, labelTitle: string, extractLabel: (r: VesselRunSummary) => string | null): StepObservationMetricDef[] => [
  { key: labelKey, label: labelTitle, extract: extractLabel },
  { key: 'bow_clear', label: '末态船艏剩余距离', unit: 'm', seriesId: 'distance', pickMode: 'steady' },
  { key: 'end_speed', label: '末态对水航速', unit: 'm/s', seriesId: 'speed', pickMode: 'steady' },
  { key: 'duration', label: '结束时刻', unit: 's', extract: (r) => (r.stoppedAtMs !== null ? r.lastTimeS.toFixed(1) : null) },
];

const reverseMetrics = (): StepObservationMetricDef[] => [
  { key: 'rev_ratio', label: '反车比例', extract: extractLngReverseFraction },
  { key: 'min_rpm', label: '反转轴速谷值', unit: 'r/min', seriesId: 'shaftRpm', pickMode: 'min' },
  { key: 'peak_force', label: '纵向制动合力峰值', unit: 'kN', seriesId: 'actuatorForce', pickMode: 'min' },
  { key: 'north_dist', label: '末态北向位置', unit: 'm', seriesId: 'north', pickMode: 'steady' },
  { key: 'end_speed', label: '末态对水航速', unit: 'm/s', seriesId: 'speed', pickMode: 'steady' },
];

const antiWindupMetrics = (): StepObservationMetricDef[] => [
  { key: 'aw', label: '抗饱和状态', extract: (r) => (r.initialInput.longitudinal?.antiWindup ? '开启' : '关闭') },
  { key: 'min_speed', label: '航速下冲谷值', unit: 'm/s', seriesId: 'speed', pickMode: 'min' },
  { key: 'peak_force', label: '纵向推力极值', unit: 'kN', seriesId: 'actuatorForce', pickMode: 'peak' },
  { key: 'steady_speed', label: '末态对水航速', unit: 'm/s', seriesId: 'speed', pickMode: 'steady' },
];

export const LNG_STEP_SPECS_EARLY: Record<number, LngStepWorkbenchSpec> = {
  1: {
    goal: '标注双轴推进系统从轴速指令到航程位移的因果传递阶梯，区分瞬时给定与多级惯性滞后。',
    actionSteps: [
      '运行前在预测区按响应由先到后排定 5 个推进与运动通道的因果先后顺序。',
      '点击「开始」完成 120 秒静水直航基线运行。',
      '观察左侧曲线响应节奏后，完成下方 5 个通道的瞬时/滞后因果阶梯配对。',
    ],
    watch: '轴速指令 (r/min) 先于实际轴速与纵向推力变化，而对水航速 (m/s) 与北向位置 (m) 受大排水量惯性和积分关系约束呈逐级滞后。',
    conditionText: '平静无风浪流环境与无噪基准，85% 装载率，初始对水航速 4.0 m/s 直航 120 秒。',
    suggestion: '注意区分船艏剩余距离与船体重心北向位移，切勿把航速变化视为随轴速指令瞬时跳变。',
    predictionSpec: {
      kind: 'ranking',
      prompt: '按激励发生后响应由先到后的顺序排列 LNG 船推进与运动因果链（#1 为最先响应）：',
      rankItems: [
        '轴速指令（控制器发出的转速参考）',
        '实际轴速（经电机转矩与轴系惯量爬升）',
        '执行器纵向合力（螺旋桨与来流产生的推力）',
        '对水航速（推力克服阻力经船体大惯性积分变化）',
        '北向位置与航程（航速对时间积分形成的位移）',
      ],
      allowRationale: true,
      rationalePlaceholder: '结合轴系旋转惯量、船体纵向排水量惯性与位置积分说明因果滞后理由...',
    },
    observationSpec: {
      kind: 'channel_match',
      prompt: '对照 120 秒实测曲线，将 5 个关键物理量分别归入对应的瞬时或滞后因果阶梯：',
      pairs: [
        { id: 'ref_rpm', item: '轴速指令 (r/min)', choices: STEP1_CAUSAL_CHOICES, hint: '控制端输出参考' },
        { id: 'shaft_rpm', item: '实际轴速 (r/min)', choices: STEP1_CAUSAL_CHOICES, hint: '经轴系伺服惯性跟随' },
        { id: 'thrust_force', item: '执行器纵向合力 (kN)', choices: STEP1_CAUSAL_CHOICES, hint: '桨转速与水动力耦合产生' },
        { id: 'water_speed', item: '对水航速 (m/s)', choices: STEP1_CAUSAL_CHOICES, hint: '计程仪量测船体纵荡速度' },
        { id: 'north_dist', item: '北向位置 / 航程 (m)', choices: STEP1_CAUSAL_CHOICES, hint: '对水/对地速度时间积分' },
      ],
    },
    interpretationSpec: {
      checklist: ['写明 5 个通道的因果传递顺序', '区分轴系短滞后与船体大惯性积分滞后', '说明船艏距离与重心位置的读数口径'],
      placeholder: '结合推进轴系与六自由度船体惯性差异，解释各通道为何不能同步瞬时变化...',
    },
  },
  2: {
    goal: '选定小信号轴速参考阶跃幅值并采集 600 秒输入输出轨迹，在保持局部线性区前提下激发清晰航速响应。',
    actionSteps: [
      '运行前输入预期稳态对水航速靶标，并说明选用小幅阶跃而非大幅满车阶跃的理由。',
      '在控制区选择轴速参考阶跃百分比（+3%、+5% 或 +8%），点击「开始」运行 600 秒。',
      '运行结束后从曲线提取阶跃后轴速指令、稳态实际轴速、稳态对水航速与纵向推力峰值。',
    ],
    watch: 't=20 s 轴速参考阶跃后实际轴速先快速跟上，对水航速从 4.0 m/s 经纯滞后平滑过渡至新稳态；切勿在运行中人工改写航速真值。',
    conditionText: '平静无风浪流环境与无噪基准，85% 装载率，初始对水航速 4.0 m/s，t=20 s 自动施加选定幅度轴速参考阶跃，时长 600 秒。',
    suggestion: '激励太小则响应增量不易分辨，过大则会使二次水阻力显著偏离局部线性假设；推荐以 +5% 作为基准。',
    predictionSpec: {
      kind: 'numeric_target', unit: 'm/s', targetPlaceholder: '如 4.20',
      prompt: '在初始对水航速 4.0 m/s 下施加所选小信号轴速阶跃（默认 +5%），预估 600 秒末稳态对水航速 (m/s)：',
      allowRationale: true, rationalePlaceholder: '结合小扰动工作点附近转速增量与航速增量近似比例关系说明预估依据...',
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '完成 600 秒阶跃运行后，一键从曲线读取稳态输入输出与推力极值：',
      metrics: [
        { key: 'ref_rpm', label: '阶跃后轴速指令', unit: 'r/min', seriesId: 'referenceRpm', pickMode: 'steady' },
        { key: 'shaft_rpm', label: '稳态实际轴速', unit: 'r/min', seriesId: 'shaftRpm', pickMode: 'steady' },
        { key: 'steady_speed', label: '稳态对水航速', unit: 'm/s', seriesId: 'speed', pickMode: 'steady' },
        { key: 'force_peak', label: '纵向推力峰值', unit: 'kN', seriesId: 'actuatorForce', pickMode: 'peak' },
      ],
    },
    interpretationSpec: {
      checklist: ['记录所选阶跃幅值及输入输出稳态增量', '说明小信号实验兼顾信噪比与局部线性区', '确认未人为更改实际航速初值'],
      placeholder: '对比预估与实测航速增量，阐明小信号激励幅值选择的物理权衡...',
    },
  },
  3: {
    goal: '从第 2 步阶跃响应中划定包含起跳与稳态段的窗口，辨识并冻结「轴速参考 → 对水航速」一阶惯性与纯时延模型。',
    actionSteps: [
      '运行前判断推进轴系响应与船体纵向加速惯性对等效时间常数和纯时延的贡献分工。',
      '前往右侧「评估」页签选中第 2 步运行，框选分析窗口（起点设在 t=20 s 前，如 10–580 s）并点击「辨识并冻结模型」。',
      '回到本栏点击「一键引用已冻结工件摘要」，核对模型增益、时间常数、纯时延与拟合残差。',
    ],
    watch: '对比轴速通道起升耗时与对水航速曲线起点纯时延、主体指数爬升时间常数，检查拟合残差均方根是否收敛。',
    conditionText: '汇总辨识步骤（无需新开仿真运行），基于第 2 步 85% 装载、4.0 m/s 阶跃运行记录冻结局部航速模型。',
    suggestion: '分析窗口起点须早于 t=20 s 阶跃时刻（推荐 10 s），以确保准确估计阶跃前参考基线与纯时延。',
    predictionSpec: {
      kind: 'choice',
      prompt: '在「轴速参考 → 对水航速」局部模型辨识中，执行器轴系动态与船体纵向惯性分别主要体现在哪个特征上？',
      options: [
        choiceOpt('servo_delay_hull_inertia', '轴系伺服跟随与流体建推贡献等效纯时延及小时间常数，船体大排水量惯性主导长主时间常数', '船体质量达十万吨级，纵荡加速时间常数远大于轴系转速调节时间'),
        choiceOpt('hull_instant_servo_slow', '船体航速瞬时变化，全部长滞后均来自螺旋桨电机滞后', '把执行器快动态与大惯性船体慢动态的量级颠倒'),
        choiceOpt('zero_delay', '从轴速指令到对水航速不存在任何纯时延或高阶相位滞后', '忽略了轴系建立、推力延迟与测量采样链路带来的等效纯滞后'),
      ],
      allowRationale: true, rationalePlaceholder: '结合第 1、2 步观察到的轴速爬升速度与航速慢变化说明理由...',
    },
    observationSpec: {
      kind: 'artifact_binding', artifactKind: 'model',
      prompt: '在「评估」页签冻结第 3 步局部航速模型后，点击右侧按钮引用模型参数 K、T、L 与训练残差：',
    },
    interpretationSpec: {
      checklist: ['完整记录冻结模型增益 K、时间常数 T 与时延 L', '区分执行器动态与船体惯性贡献', '界定该局部模型在工作点邻域的有效域'],
      placeholder: '写出冻结的 K、T、L 数值与拟合残差，说明等效一阶惯性与纯时延模型的物理由来与工作点边界...',
    },
  },
  4: {
    goal: '在不重新拟合参数的条件下，利用第 3 步冻结模型对 −4% 独立减速阶跃实施留出验证，量化外推误差来源。',
    actionSteps: [
      '运行前预判用正向 +5% 加速模型外推预测 −4% 减速响应时的误差方向。',
      '点击「开始」完成 600 秒 −4% 轴速参考减速运行。',
      '前往「评估」页签选用第 3 步已冻结模型执行独立对照（严禁重拟合），再回到下方点击一键引用验证 RMSE 与 FIT。',
    ],
    watch: 't=20 s 轴速降低 4% 后计程仪航速平滑降至新稳态的轨迹，以及独立对照图中实测曲线与模型预测之间的系统性微小偏差。',
    conditionText: '平静无风浪流环境与无噪基准，85% 装载率，初速 4.0 m/s，t=20 s 自动施加 −4% 轴速参考阶跃，时长 600 秒（独立留出验证）。',
    suggestion: '严禁对本步轨迹重新拟合；独立验证的目的正是检验已冻结模型在未参与训练的方向上的外推可信度。',
    predictionSpec: {
      kind: 'choice',
      prompt: '将基于正向小阶跃冻结的线性模型直接外推预测 −4% 减速阶跃时，最可能观察到哪种现象？',
      options: [
        choiceOpt('small_asymmetric_residual', '整体衰减趋势吻合较好，但受水动力二次阻力与工作点略微下移影响存在轻微非零验证残差', '减速方向局部阻尼斜率略低于加速方向，导致线性模型在暂态或末态有小幅偏差'),
        choiceOpt('exact_zero_error', '模型预测与实船航速分毫不差，验证 RMSE 严格为零', '忽略了螺旋桨四象限特性与阻力平方项在工作点两侧的非对称性'),
        choiceOpt('wrong_sign', '减速指令下模型会错误地预测航速持续加速升高', '线性模型增益为正，负向阶跃必然产生下降趋势'),
      ],
      allowRationale: true, rationalePlaceholder: '从流体阻力随速度平方变化及工作点偏移角度说明留出残差来源...',
    },
    observationSpec: {
      kind: 'artifact_binding', artifactKind: 'comparison',
      prompt: '在「评估」页签以第 3 步冻结模型保存本步独立对照后，点击一键引用验证 RMSE 与 FIT 指标：',
    },
    interpretationSpec: {
      checklist: ['对比第 3 步训练残差与第 4 步留出验证 RMSE/FIT', '分析加减速局部斜率非对称原因', '阐明不得对验证轨迹重拟合的原因'],
      placeholder: '结合留出验证均方根误差与拟合优度，分析小信号线性模型的泛化能力与局部外推边界...',
    },
  },
  5: {
    goal: '开展 1200 秒驱动转矩置零的自由停车滑行实验，测量大惯性 LNG 船降至 0.2 m/s 的耗时与距离并据实核验是否达标。',
    actionSteps: [
      '运行前预估 1200 秒自由滑行末速，并在下方坐标画板绘制 t=20 s 停车滑行后的对水航速衰减曲线（注意 0.2 m/s 参考线）。',
      '点击「开始」跑完完整 1200 秒自由停车运行。',
      '对照画板叠加的实测曲线，从曲线与左侧状态读取 1200 s 末速、北向航程及降至 0.2 m/s 的时间与距离（未达到须如实记录）。',
    ],
    watch: 't=20 s 转矩置零后轴速滑降、低速段阻力按速度平方急剧变小导致的长拖尾现象，核查 1200 s 末对水航速是否落到 0.2 m/s 以下。',
    conditionText: '平静无风浪流环境与无噪基准，85% 装载率，初速 4.0 m/s，t=20 s 自动将推进电机转矩置零自由滑行，总时长 1200 秒。',
    suggestion: '大惯性船停车绝非瞬停；若 1200 秒窗口结束时航速仍高于 0.2 m/s，必须在记录中明确填写「窗口内未达到」。',
    predictionSpec: {
      kind: 'numeric_target', unit: 'm/s', targetPlaceholder: '如 0.45',
      prompt: '在初速 4.0 m/s 下于 t=20 s 切断驱动转矩自由滑行，预估 1200 秒末剩余对水航速 (m/s) 并手绘衰减曲线：',
      allowRationale: true, rationalePlaceholder: '结合船体巨大惯性及低速段阻力随速度平方迅速减小的非线性滑行规律说明预估依据...',
      sketch: {
        mode: 'prediction', plotId: 'time-response', lockPlotId: true,
        label: '运行前手绘预测：t=20s 自由停车滑行对水航速响应',
        hint: '从 4.0 m/s 起笔，经过 t=20 s 停车滑行竖线后，绘制随时间渐近衰减的曲线并与 0.2 m/s 参考线比较。',
        promptFocus: '关注 t=20s 停车后长惯性拖尾斜率及末态与 0.2 m/s 参考线的相对位置',
        coordinateOverride: {
          title: '自由停车滑行航速预测坐标系', subtitle: '0–1200 s 时域响应（t=20 s 停车滑行，含 0.2 m/s 停车参考线）',
          xMin: 0, xMax: 1200, yMin: 0, yMax: 4.5, xLabel: '时间 t', yLabel: '对水航速', xUnit: 's', yUnit: 'm/s',
          xTicks: TIME_1200_TICKS,
          yTicks: [0, 1.0, 2.0, 3.0, 4.0, 4.5].map((value) => ({ value, label: value.toFixed(1) })),
          verticalMarkers: [{ value: 20, label: 't=20s 停车滑行', color: '#0ea5e9' }],
          horizontalMarkers: [{ value: 0.2, label: '0.2 m/s 参考线', color: '#f59e0b' }, ...SPEED_4_BASELINE],
        },
        overlayExtractor: (samples) => extractLngSpeedActualSeries(samples),
      },
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '1200 秒自由滑行结束后，读取末态航速与航程，并核对降至 0.2 m/s 的实际达标情况：',
      metrics: [
        { key: 'end_speed', label: '1200 s 末态对水航速', unit: 'm/s', seriesId: 'speed', pickMode: 'steady' },
        { key: 'travel_north', label: '1200 s 北向滑行航程', unit: 'm', seriesId: 'north', pickMode: 'steady' },
        { key: 'reach_02_time', label: '降至 0.2 m/s 耗时', unit: 's', placeholder: '未降至 0.2 m/s 请填「未达到」' },
        { key: 'reach_02_dist', label: '降至 0.2 m/s 距离', unit: 'm', placeholder: '未降至 0.2 m/s 请填「未达到」' },
      ],
    },
    interpretationSpec: {
      checklist: ['写明 1200 s 末态航速与是否达到 0.2 m/s', '解释低速平方阻力衰减导致的超长滑行惯性', '论证为何靠泊不能依赖自由滑行停船'],
      placeholder: '结合滑行实测数据与手绘对比偏差，说明低速阻尼机制及仅靠自由停车在狭小水域靠泊的风险...',
    },
  },
  6: {
    goal: '比较 0.3 与 0.6 两档额定转速比例反车制动与第 5 步自由停车，厘清四象限轴系过零时间与制动力/功率物理约束。',
    actionSteps: [
      '运行前判断两档反车强度的停船效果，并在下方坐标画板手绘 t=20 s 下达反车后的对水航速走势（含负向倒退区间）。',
      '依次选择反车额定转速比例 0.3 与 0.6，分别运行完整 1200 秒（每次结束后先点击「重置」再切换下一档）。',
      '在下方两档反车工况槽一键提取反转轴速谷值、纵向制动合力峰值、北向停船滑行距离与末态航速。',
    ],
    watch: 't=20 s 下达倒车后实际轴速 (r/min) 先经水动力拖拽减速再过零反转的耗时，以及纵向制动力峰值与推进电机功率限幅特性。',
    conditionText: '平静无风浪流环境与无噪基准，85% 装载率，初速 4.0 m/s，t=20 s 下达反车命令，需完成 0.3 与 0.6 两档反车各 1200 秒运行。',
    suggestion: '切勿把反车视作瞬间反向满推力；四象限水动力倒车阻力与电机功率上限共同限制实际轴速过零和制动加速度。',
    predictionSpec: {
      kind: 'choice',
      prompt: '相比第 5 步自由停车，于 t=20 s 下达 0.3 与 0.6 两档反车制动时最符合实船特性的判断是？',
      options: [
        choiceOpt('four_quadrant_limited', '反车显著缩短停船距离且 0.6 档制动更快，但轴速过零滞后且受四象限推进力与功率上限约束', '正车水流冲击下螺旋桨须先克服转矩倒转过零，且电机功率/转速均存在物理限幅'),
        choiceOpt('instant_reverse_stop', '反车瞬间产生无穷大反向制动力，船在数秒内原地停稳', '忽略了十万吨级惯性、螺旋桨四象限转换动态及推进功率限制'),
        choiceOpt('same_as_coast', '0.3 与 0.6 两档反车制动距离与第 5 步自由停车完全相同', '低估了倒车反转螺旋桨提供持续反向制动力矩的能力'),
      ],
      allowRationale: true, rationalePlaceholder: '结合轴速过零滞后、电机功率上限与制动距离缩短机理简述判断理由...',
      sketch: {
        mode: 'prediction', plotId: 'time-response', lockPlotId: true,
        label: '运行前手绘预测：t=20s 下达反车制动后对水航速变化',
        hint: '从 4.0 m/s 起笔，于 t=20 s 下达反车点后画出先平缓过渡过零、再逐步退入负速区（或停稳）的曲线。',
        promptFocus: '重点关注 t=20s 后制动力建立滞后、过零时刻及 0 m/s 穿越走势',
        coordinateOverride: {
          title: '反车制动航速预测坐标系', subtitle: '0–1200 s 时域响应（t=20 s 下达反车制动，含负速退行区间）',
          xMin: 0, xMax: 1200, yMin: -0.5, yMax: 4.5, xLabel: '时间 t', yLabel: '对水航速', xUnit: 's', yUnit: 'm/s',
          xTicks: TIME_1200_TICKS,
          yTicks: [-0.5, 0, 1.0, 2.0, 3.0, 4.0, 4.5].map((value) => ({ value, label: value.toFixed(1) })),
          verticalMarkers: [{ value: 20, label: 't=20s 下达反车', color: '#0ea5e9' }],
          horizontalMarkers: [{ value: 0, label: '0 m/s 停船线', color: '#ef4444' }, ...SPEED_4_BASELINE],
        },
        overlayExtractor: (samples) => extractLngSpeedActualSeries(samples),
      },
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成 0.3 与 0.6 两档反车制动运行后，分别一键提取轴速谷值、制动合力峰值、北向位移与末态航速：',
      slots: [
        { id: 'rev_03', label: '轻度反车 0.3 档', conditionHint: '反车额定转速比例 0.3 · 1200 s', matcher: (r) => extractLngReverseFraction(r) === '0.3', metrics: reverseMetrics() },
        { id: 'rev_06', label: '强力反车 0.6 档', conditionHint: '反车额定转速比例 0.6 · 1200 s', matcher: (r) => extractLngReverseFraction(r) === '0.6', metrics: reverseMetrics() },
      ],
    },
    interpretationSpec: {
      checklist: ['对比第 5 步自由停车与 0.3/0.6 两档反车的停船距离', '阐明四象限螺旋桨水动力与轴速过零滞后', '分析倒车功率上限对制动强度的约束'],
      placeholder: '定量比较自由滑行与两档倒车制动，解释螺旋桨四象限特性与功率限幅下反车制动的工程代价...',
    },
  },
  7: {
    goal: '应用第 3 步冻结的局部航速模型设计靠泊 PI 增益、减速起点与分段速度节点，冻结运行前的独立速度与距离预测。',
    actionSteps: [
      '运行前在预测区输入本靠泊方案预估的停船滑行总距离（m）并说明控制参数整定思路。',
      '在控制区选中本人冻结模型，设定 Kp/Ti 倍率、减速起点（300–1500 m）与递减速度节点。',
      '点击「冻结速度与距离预测」生成理想预测曲线，并在下方点击「一键引用已冻结工件摘要」。',
    ],
    watch: '控制区「冻结速度与距离预测」曲线的减速过渡平滑性、理想预测停船所需距离与初态 1500 m 可用航程的安全余量。',
    conditionText: '靠泊规划分析步骤（平静无风浪流、水深 40 m、初态距停泊线 1500 m、初速 4.0 m/s），需保存用于第 8 步实船对照的冻结预测。',
    suggestion: '必须先点击「冻结速度与距离预测」保存运行前预测工件，再进入第 8 步开展同方案实船验证。',
    predictionSpec: {
      kind: 'numeric_target', unit: 'm', targetPlaceholder: '如 1150',
      prompt: '基于你当前配置的减速起点、分段速度节点与本人模型整定参数，预估本次靠泊减速阶段总滑行距离 (m)：',
      allowRationale: true, rationalePlaceholder: '结合减速起点位置、末段目标速度与船体响应时间常数说明停船距离预估理由...',
    },
    observationSpec: {
      kind: 'artifact_binding', artifactKind: 'comparison',
      prompt: '在控制区点击「冻结速度与距离预测」后，一键引用运行前冻结预测摘要：',
    },
    interpretationSpec: {
      checklist: ['记录选用的减速起点与分段速度节点', '对比理想预测滑行距离与 1500 m 初始余量', '指出理想模型用于大范围减速决策的潜在外推风险'],
      placeholder: '阐述如何利用局部航速模型决定减速时机，并预判大幅减速向低速外推时可能出现的偏差...',
    },
  },
  8: {
    goal: '严格执行第 7 步冻结预测对应的真实六自由度靠泊运行并保存独立对照，定量定位大幅减速与低速段偏差来源。',
    actionSteps: [
      '运行前判断实船六自由度在低速大减速区相对第 7 步理想模型在停船距离上的偏离方向。',
      '保持第 7 步冻结方案参数不变直接点击「开始」执行靠泊，待观察充分（≥60 s）后可点击「结束本次靠泊并保留记录」。',
      '前往「评估」页签以第 3 步冻结模型保存本步独立闭环对照，再回到下方一键引用验证 RMSE/FIT 与偏差摘要。',
    ],
    watch: '实船对水航速 (m/s) 与船艏剩余距离真值 (m) 随时间的演变，重点排查低速段推力衰减、阻力非线性及执行器限幅引起的实际滞后。',
    conditionText: '平静无风浪流环境与无噪基准，85% 装载率，水深 40 m、初态船艏剩余距离 1500 m、初速 4.0 m/s，执行与第 7 步一致的靠泊方案。',
    suggestion: '禁止通过放宽评价阈值掩盖模型误差；若实际减速距离长于理想预测，须从物理与外推机理如实定位原因。',
    predictionSpec: {
      kind: 'choice',
      prompt: '将基于 4.0 m/s 小信号模型设计的第 7 步方案投入 4→0 m/s 真实靠泊时，理想与实际最可能出现何种差异？',
      options: [
        choiceOpt('low_speed_extrapolation_gap', '实际停船距离与低速段减速耗时通常与理想线性预测存在显著偏差（低速阻尼减弱与推力非线性放大外推误差）', '4 m/s 局部线性模型在大跨度降速至近零速时工作点剧变且执行器四象限限幅凸显'),
        choiceOpt('zero_mismatch', '实船六自由度曲线与第 7 步单回路理想预测在 4→0 m/s 全程完全重合', '忽略了大幅度外推条件下阻力平方非线性、水深浅水效应与执行器饱和差异'),
        choiceOpt('instant_linear_stop', '实船会在抵达减速起点瞬间立刻线性归零，不产生额外滑行距离', '忽视大惯性滑行在低速段阻尼减小后的长拖尾效应'),
      ],
      allowRationale: true, rationalePlaceholder: '结合低速工作点阻力平方衰减与螺旋桨四象限倒车效率变化说明偏差原因...',
    },
    observationSpec: {
      kind: 'artifact_binding', artifactKind: 'comparison',
      prompt: '在「评估」页签对本步靠泊运行保存独立对照后，点击一键引用实测—理想偏差摘要：',
    },
    interpretationSpec: {
      checklist: ['对齐第 7 步理想预测与第 8 步实船停止距离/末速', '定位低速阻力非线性和推力特性的偏差来源', '明确不能通过改阈值掩盖物理外推误差'],
      placeholder: '定量比较第 7 步理想距离/速度与第 8 步六自由度实测响应，剖析大跨度外推产生偏差的物理机制...',
    },
  },
  9: {
    goal: '保持其余条件与控制增益不变对比至少两套减速起点或分段速度曲线，权衡靠泊安全余量与作业总耗时（含保留失败轨迹）。',
    actionSteps: [
      '运行前预判提前减速（较大减速起点）与延后激进减速（较小减速起点）在安全余量与耗时上的取舍。',
      '固定控制增益，先后调整减速起点或速度节点完成至少 2 次完整靠泊运行（观察 ≥60 s 后可点击「结束本次靠泊并保留记录」；如越线亦自动保留）。',
      '在下方两套方案槽一键提取各自减速起点、末态船艏剩余距离、末态航速与结束时刻。',
    ],
    watch: '船艏剩余距离真值 (m) 是否始终保持正值（避免越过 0 m 停泊线）、末态对水航速衰减充分度与全程靠泊时间对比。',
    conditionText: '平静无风浪流环境与无噪基准，85% 装载率，水深 40 m、初态距停泊线 1500 m、初速 4.0 m/s，保持 PI 增益不变对比至少 2 套靠泊计划。',
    suggestion: '切勿删除或隐藏越线失败记录；失败边界与成功余量的对照正是论证合理靠泊裕度的直接证据。',
    predictionSpec: {
      kind: 'choice',
      prompt: '保持航速 PI 增益不变而改变靠泊减速计划时，安全余量与靠泊耗时呈现何种工程权衡？',
      options: [
        choiceOpt('safety_vs_time_tradeoff', '提前设置较大减速起点或早降速可增加船艏安全余量但延长靠泊耗时；过晚减速虽省时却易导致越线或剧烈倒车', '减速过渡消耗的时空积分受最大反向推力制约，早减留余量、晚减压缩安全边际'),
        choiceOpt('simultaneous_best', '减速起点越晚、节点速度越低越能同时取得最短靠泊时间与最大安全余量', '晚减速会缩短可用制动行程，一旦超出执行器制动能力极易触发越线'),
        choiceOpt('plan_irrelevant', '只要控制器增益不变，改变减速起点与分段速度节点对停船位置毫无影响', '减速计划直接决定参考航速下行剖面及其积分航程'),
      ],
      allowRationale: true, rationalePlaceholder: '结合第 6 步测得的制动距离极限说明减速起点与末段速度安排依据...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成至少两套不同减速起点或速度节点方案的靠泊运行后，在下方提取对照指标：',
      slots: [
        {
          id: 'plan_base', label: '方案一（稳健早减速或基准计划）', conditionHint: '默认计划或减速起点 > 1200 m',
          matcher: (r) => isDefaultLngBerthPlan(r) || (r.initialInput.berthPlan?.brakingDistanceM ?? 0) > 1200,
          metrics: berthPlanMetrics('braking_m', '减速起点(m)', (r) => (r.initialInput.berthPlan ? String(r.initialInput.berthPlan.brakingDistanceM) : null)),
        },
        {
          id: 'plan_alt', label: '方案二（修订减速起点或速度曲线）', conditionHint: '修改节点或减速起点 ≤ 1200 m',
          matcher: (r) => !isDefaultLngBerthPlan(r) && (r.initialInput.berthPlan?.brakingDistanceM ?? 0) <= 1200,
          metrics: berthPlanMetrics('braking_m', '减速起点(m)', (r) => (r.initialInput.berthPlan ? String(r.initialInput.berthPlan.brakingDistanceM) : null)),
        },
      ],
    },
    interpretationSpec: {
      checklist: ['定量比较两方案的停船余量、末速与靠泊耗时', '说明失败越线边界（如有发生）的成因', '总结兼顾安全裕量与靠泊效率的设计准则'],
      placeholder: '对比两套靠泊计划实测表现，论证安全停船距离余量与时间代价之间的折中选择...',
    },
  },
  10: {
    goal: '在 4→3 m/s 航速参考阶跃下对比关闭与开启积分抗饱和回算，揭示执行器饱和引起的积分积累与超调抑制机理。',
    actionSteps: [
      '运行前判断开启「积分抗饱和回算」对限幅恢复期航速下冲、峰值推力及末段误差的作用。',
      '保持本人模型与 Kp/Ti 倍率完全一致，先关闭「积分抗饱和回算」跑完第 1 次 600 秒运行。',
      '点击「重置」，仅开启「积分抗饱和回算」跑完第 2 次 600 秒运行，并在下方两槽提取对比指标。',
    ],
    watch: 't=20 s 航速参考从 4 跳至 3 m/s 后轴速限幅阶段的积分器累积差异、执行器纵向推力极值 (kN)、航速下冲幅度与 600 s 末段跟踪误差。',
    conditionText: '平静无风浪流环境与无噪基准，85% 装载率，t=20 s 航速参考由 4.0 阶跃至 3.0 m/s，固定 Kp/Ti 对比抗饱和关闭与开启（各 600 秒）。',
    suggestion: '两次运行仅允许拨动「积分抗饱和回算」开关；比较性能时必须同时核对真实对水航速状态与推力峰值代价。',
    predictionSpec: {
      kind: 'choice',
      prompt: '当 4→3 m/s 减速阶跃迫使推进轴速指令触及限幅时，开启「积分抗饱和回算」相比关闭原始 PI 会产生何种差异？',
      options: [
        choiceOpt('less_overshoot_faster_recovery', '有效抑制饱和期间积分误差过度累积，明显减小航速下冲超调并加快退饱和回到 3.0 m/s 的收敛过程', '回算追踪实际执行器输出与未限幅指令之差，防止积分器深度饱和'),
        choiceOpt('more_oscillation', '进一步放大积分积累并引起持续大幅发散振荡', '把抗饱和回算的限幅抑制效应与无抗饱和积分饱和现象颠倒'),
        choiceOpt('alter_steady_target', '使最终稳态航速永久偏移 3.0 m/s 产生静差', '执行器退出限幅回归线性区后积分作用仍可消除稳态静差'),
      ],
      allowRationale: true, rationalePlaceholder: '结合执行器输出限幅下比例项与积分项的退饱和同步过程说明机理...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成抗饱和关闭与开启两次 600 秒运行后，在下方提取下冲谷值、推力极值与末态航速进行对照：',
      slots: [
        { id: 'aw_off', label: '原始 PI（抗饱和关闭）', conditionHint: '抗饱和关闭 · 600 s', matcher: (r) => r.initialInput.longitudinal?.antiWindup === false, metrics: antiWindupMetrics() },
        { id: 'aw_on', label: '改进 PI（抗饱和开启）', conditionHint: '抗饱和开启 · 600 s', matcher: (r) => r.initialInput.longitudinal?.antiWindup === true, metrics: antiWindupMetrics() },
      ],
    },
    interpretationSpec: {
      checklist: ['对比关闭与开启抗饱和下的下冲超调与推力峰值', '解释饱和积分积聚成因与回算消除机理', '核验末段稳态航速真实无静差'],
      placeholder: '结合两次 600 秒实测下冲谷值、推力峰值和末态速度数据，阐述抗饱和回算在工程限幅回路中的作用...',
    },
  },
};
