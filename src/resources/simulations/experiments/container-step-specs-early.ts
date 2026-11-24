import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import type { StepObservationMetricDef, VesselSample, VesselStep } from '../simulations/vessel-experiment';
import type { SketchActualCurveSeries } from './sketch-coordinate-templates';

export type ContainerStepWorkbenchSpec = Pick<VesselStep, 'goal' | 'watch' | 'suggestion'> &
  Pick<VesselStep, 'actionSteps' | 'conditionText' | 'predictionSpec' | 'observationSpec' | 'interpretationSpec' | 'sketchSpec'>;

export function extractContainerSpeedActualSeries(samples: VesselSample[]): SketchActualCurveSeries[] {
  const points = samples
    .map((sample) => ({ x: sample.time, y: sample.values.speed }))
    .filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));
  return points.length < 2 ? [] : [{ id: 'actual-water-speed', label: '实测对水航速 (m/s)', color: '#06b6d4', points }];
}

export function extractContainerLoadingRatio(run: VesselRunSummary): string | null {
  return typeof run.configuration.loadingRatio === 'number' ? run.configuration.loadingRatio.toFixed(2) : null;
}

export function extractContainerArrivalEta(run: VesselRunSummary): string | null {
  return run.stoppedAtMs === null ? null : run.lastTimeS.toFixed(1);
}

export const choiceOpt = (value: string, label: string, detail: string) => ({ value, label, detail });

const formatFixedParam = (value: unknown, digits: number, scale = 1): string | null =>
  typeof value === 'number' && Number.isFinite(value) ? (value * scale).toFixed(digits) : null;

const loadSlotMetrics = (): StepObservationMetricDef[] => [
  { key: 'loading', label: '装载率', extract: extractContainerLoadingRatio, placeholder: '一键提取或看左侧状态栏' },
  { key: 'mass_kt', label: '质量', unit: '千吨', extract: (r) => formatFixedParam(r.parameters?.massKg, 3, 1e-6), placeholder: '一键提取或看左侧状态栏' },
  { key: 'draft_m', label: '吃水', unit: 'm', extract: (r) => formatFixedParam(r.parameters?.draftM, 2), placeholder: '一键提取或看左侧状态栏' },
  { key: 'gm_m', label: '横稳心高', unit: 'm', extract: (r) => formatFixedParam(r.parameters?.effectiveGmTransverseM, 3), placeholder: '一键提取或看左侧状态栏' },
  { key: 'wind_lat', label: '侧向风面积', unit: 'm²', extract: (r) => formatFixedParam(r.parameters?.windAreasM2?.lateral, 1), placeholder: '一键提取或看左侧状态栏' },
  { key: 'wind_front', label: '正向风面积', unit: 'm²', extract: (r) => formatFixedParam(r.parameters?.windAreasM2?.frontal, 1), placeholder: '一键提取或看左侧状态栏' },
];

const opPointMetrics = (first: StepObservationMetricDef): StepObservationMetricDef[] => [
  first,
  { key: 'steady_speed', label: '稳态航速', unit: 'm/s', seriesId: 'speed', pickMode: 'steady' },
  { key: 'model_k', label: '冻结模型 K', unit: '(m/s)/rpm', placeholder: '从评估页签读取' },
  { key: 'model_t', label: '冻结模型 T', unit: 's', placeholder: '从评估页签读取' },
];

const loopMetrics = (first: StepObservationMetricDef, peakKey = 'peak_speed', peakLabel = '峰值航速', peakUnit = 'm/s', peakSeries = 'speed'): StepObservationMetricDef[] => [
  first,
  { key: peakKey, label: peakLabel, unit: peakUnit, seriesId: peakSeries, pickMode: 'max' },
  { key: 'steady_speed', label: '末态航速', unit: 'm/s', seriesId: 'speed', pickMode: 'steady' },
];

const SPEED_30S_MARKER = [{ value: 30, label: 't=30s 阶跃', color: '#0ea5e9' }];
const SPEED_8_BASELINE = [{ value: 8.0, label: '初态 8.0 m/s', color: '#64748b' }];
const TIME_600_TICKS = [0, 120, 240, 360, 480, 600].map((value) => ({ value, label: String(value) }));
const isLoad = (run: VesselRunSummary, target: number) => Math.abs((run.configuration.loadingRatio ?? -1) - target) < 1e-6;

export const CONTAINER_STEP_SPECS_EARLY: Record<number, ContainerStepWorkbenchSpec> = {
  1: {
    goal: '辨析匀速直航中推进与航行通道的瞬时率量与时间累计量，明确功率、航程与教学燃油的量纲边界。',
    actionSteps: [
      '在预测区选定匀速直航下轴功率与累计燃油曲线的预期形态。',
      '点击控制区「开始」，等待 60 秒静水直航运行自动完成。',
      '对照左侧实时读数与时程曲线，完成下方 6 项通道的瞬时量/累计量配对。',
    ],
    watch: '轴速 (r/min)、对水速度 (m/s) 与轴功率 (MW) 在稳态后趋于水平直线，而航程 (m) 与累计燃油 (kg) 随时间持续单调爬升。',
    conditionText: '平静无风浪无海流环境，60% 中载，初始对水航速 8.0 m/s 定速直航 60 秒，无传感附加噪声。',
    suggestion: '切勿把瞬时功率 (MW) 与积分累计燃油 (kg) 的曲线斜率趋势混为一谈。',
    predictionSpec: {
      kind: 'choice',
      prompt: '当集装箱船以 8.0 m/s 匀速直航 60 秒时，轴功率与累计教学燃油曲线最可能呈现何种形态？',
      options: [
        choiceOpt('const_power_linear_fuel', '轴功率趋于水平恒定，累计燃油随时间近似线性上升', '稳态推力平衡阻力使功率稳定，功率对时间积分使燃油消耗持续累积'),
        choiceOpt('both_linear', '轴功率与累计燃油均随时间线性上升', '误以为航程增长会导致匀速所需的瞬时推进功率持续增加'),
        choiceOpt('both_const', '轴功率与累计燃油均保持水平恒定', '忽略了累计燃油作为时间积分量随运行时间不可逆增长的特性'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合瞬时功率与时间积分的关系说明判断依据...',
    },
    observationSpec: {
      kind: 'channel_match',
      prompt: '根据 60 秒实测曲线的水平稳态或持续增长特征，将下列 6 个物理量配对归类：',
      pairs: [
        { id: 'shaft_rpm', item: '轴速 (r/min)', choices: ['瞬时量', '累计量'], hint: '螺旋桨当前转速读数' },
        { id: 'thrust_kn', item: '推力 (kN)', choices: ['瞬时量', '累计量'], hint: '推进器当前产生推力' },
        { id: 'water_speed', item: '对水速度 (m/s)', choices: ['瞬时量', '累计量'], hint: '计程仪当前瞬时航速' },
        { id: 'distance', item: '航程 (m)', choices: ['瞬时量', '累计量'], hint: '速度随时间积分的位移' },
        { id: 'power_mw', item: '轴功率 (MW)', choices: ['瞬时量', '累计量'], hint: '轴转矩与角速度乘积' },
        { id: 'fuel_kg', item: '累计油耗 (kg)', choices: ['瞬时量', '累计量'], hint: '由功率积分折算的油耗' },
      ],
    },
    interpretationSpec: {
      checklist: ['区分瞬时率量与累计量的物理单位', '解释稳态功率恒定但燃油单调递增的积分因果', '说明功率积分与教学燃油的口径边界'],
      placeholder: '结合单位差异说明瞬时状态量与累计积分量的区别，并解释匀速时能耗仍持续增加的机理...',
    },
  },
  2: {
    goal: '对比轻载、中载与重载三种配载下的质量、吃水、稳性与受风面积联动规律，理解配载变化的多条物理作用链。',
    actionSteps: [
      '运行前在预测区按从小到大排定 0.2、0.6、0.9 三档装载的质量与吃水顺序。',
      '依次选择装载率 0.2、0.6、0.9，每次点击「开始」完成 20 秒静水平衡后点击「重置」切换下一档。',
      '在下方三档工况槽点击「一键提取本工况读数」，自动回填装载率、质量、吃水、横稳心高及侧向与正向风面积 6 项状态参数。',
    ],
    watch: '随装载率由 0.2 增至 0.9，排水质量 (千吨) 与吃水 (m) 单调增大，横稳心高 (m) 与侧向/正向受风面积 (m²) 随甲板堆箱与压载同步改变。',
    conditionText: '平静静水静止平衡工况，分别采集 20% 轻载、60% 中载与 90% 重载三档各 20 秒静水平衡状态，需保留全部 3 次运行。',
    suggestion: '每测完一档装载的 20 秒平衡后，必须先点击「重置」再切换下一档装载率。',
    predictionSpec: {
      kind: 'ranking',
      prompt: '按排水质量与吃水从小到大的顺序排列三种真实装载状态（排在最前为质量与吃水最小工况）：',
      rankItems: [
        '0.2 轻载（排水质量与吃水最小，压载比例与甲板受风形态显著不同）',
        '0.6 中载（甲板堆箱趋于满载层，吃水与惯量居于中间）',
        '0.9 重载（舱内货重继续增加，总质量与吃水达到最大）',
      ],
      allowRationale: true,
      rationalePlaceholder: '简述装载变化如何同时作用于水下吃水惯量与水上甲板受风面积...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成 0.2、0.6、0.9 三次 20 秒平衡运行后，点击各工况槽「一键提取本工况读数」，即可自动提取装载率、质量、吃水、横稳心高及侧向与正向风面积：',
      slots: [
        { id: 'load_02', label: '轻载 0.2 工况', conditionHint: '装载率 0.20 静水平衡', matcher: (r) => isLoad(r, 0.2), metrics: loadSlotMetrics() },
        { id: 'load_06', label: '中载 0.6 工况', conditionHint: '装载率 0.60 静水平衡', matcher: (r) => isLoad(r, 0.6), metrics: loadSlotMetrics() },
        { id: 'load_09', label: '重载 0.9 工况', conditionHint: '装载率 0.90 静水平衡', matcher: (r) => isLoad(r, 0.9), metrics: loadSlotMetrics() },
      ],
    },
    interpretationSpec: {
      checklist: ['列举 0.2/0.6/0.9 三组质量与吃水实测读数', '分析稳性高与受风面积的变化规律', '说明为何装载改变不能简化为仅调整时间常数'],
      placeholder: '结合三组平衡读数，说明装载改变怎样同时影响惯性、吃水阻力、横稳心高复原力与受风外力链...',
    },
  },
  3: {
    goal: '辨识并冻结中载局部一阶惯性与时延航速模型，分离推进轴系执行器动态与船体纵向加速惯性。',
    actionSteps: [
      '运行前填写预期稳态航速靶标，并在预测画板上绘制 t=30 s 起 +5% 阶跃的对水航速响应曲线。',
      '点击「开始」完成 600 秒航速阶跃运行，并在运行结束后开关实测曲线叠加对照。',
      '前往右侧「评估」页签框选有效阶跃窗口，点击「辨识并冻结模型」后在下方引用模型摘要。',
    ],
    watch: 't=30 s 轴速参考跳升 +5% 后，实测轴速先经伺服惯性爬升，对水航速由 8.0 m/s 经纯时滞后指数上升至约 8.3–8.5 m/s 新稳态。',
    conditionText: '平静无风浪流环境，60% 中载、初始航速 8.0 m/s，t=30 s 自动施加 +5% 轴速参考阶跃，总时长 600 秒。',
    suggestion: '辨识分析窗口起点请设在阶跃前（约 15–25 s），终点延伸至曲线走平阶段。',
    predictionSpec: {
      kind: 'numeric_target',
      unit: 'm/s',
      targetPlaceholder: '如 8.38',
      prompt: '基于初始对水航速 8.0 m/s 与 +5% 轴速参考小阶跃，预估 600 秒末稳态航速 (m/s) 并手绘预期响应曲线：',
      allowRationale: true,
      rationalePlaceholder: '说明推进功率—阻力平方关系下小阶跃航速增量为何近似与转速增量成比例...',
      sketch: {
        mode: 'prediction',
        plotId: 'time-response',
        lockPlotId: true,
        label: '运行前手绘预测：+5% 轴速参考阶跃后的对水航速响应',
        hint: '以 t=30 s 为阶跃起点，从 8.0 m/s 起笔描绘包含纯时滞平直段与一阶惯性上升的曲线。',
        promptFocus: '预期 +5% 轴速参考阶跃后的对水航速响应与 30s 阶跃起点',
        coordinateOverride: {
          title: '航速阶跃辨识预测坐标系',
          subtitle: '0–600 s 时域响应（t=30 s 施加 +5% 轴速参考阶跃）',
          xMin: 0,
          xMax: 600,
          yMin: 7.5,
          yMax: 9.0,
          xTicks: TIME_600_TICKS,
          yTicks: [7.5, 8.0, 8.5, 9.0].map((value) => ({ value, label: value.toFixed(1) })),
          verticalMarkers: SPEED_30S_MARKER,
          horizontalMarkers: SPEED_8_BASELINE,
        },
        overlayExtractor: (samples) => extractContainerSpeedActualSeries(samples),
      },
    },
    observationSpec: {
      kind: 'artifact_binding',
      artifactKind: 'model',
      prompt: '在「评估」页签冻结中载一阶惯性与时延航速模型后，点击下方按钮引用模型参数 K、T、L 与拟合残差：',
    },
    interpretationSpec: {
      checklist: ['记录冻结模型的增益 K、时间常数 T 与时延 L', '说明轴系加速动态与船体惯性如何共同形成等效时延与时间常数', '界定中载局部模型的适用范围'],
      placeholder: '写出冻结的 K、T、L 数值与训练残差，解释局部线性航速模型的物理来源与工作点边界...',
    },
  },
  4: {
    goal: '利用第 3 步已冻结模型对留出 −4% 减速阶跃运行实施独立验证，量化反向小阶跃外推精度与非线性残差。',
    actionSteps: [
      '运行前判断正向加速模型外推预测 −4% 减速响应时的偏差方向，并在坐标画板绘制预期减速曲线。',
      '点击「开始」完成 600 秒 −4% 轴速减速运行，并在运行结束后叠加真实航速对比手绘预期。',
      '前往「评估」页签选用第 3 步冻结模型运行指令对照（严禁重拟合），再点击下方按钮引用验证 RMSE 与 FIT。',
    ],
    watch: 't=30 s 轴速下降 4% 后，对水航速从 8.0 m/s 平滑降至约 7.6–7.7 m/s；重点观察线性模型预测与真实减速末态及中段斜率的差异。',
    conditionText: '平静无风浪流环境，60% 中载、初始航速 8.0 m/s，t=30 s 自动施加 −4% 轴速参考阶跃，总时长 600 秒（独立留出验证）。',
    suggestion: '本步禁止重新辨识模型，必须直接使用第 3 步已冻结模型执行独立对照。',
    predictionSpec: {
      kind: 'choice',
      prompt: '用 +5% 加速数据辨识的线性模型预测 −4% 减速阶跃响应，实船真实曲线与模型预测相比最可能出现何种关系？',
      options: [
        choiceOpt('asymmetric_damping_residual', '整体方向与稳态接近，但因阻力平方非线性在暂态与末态存在轻微外推残差', '减速区间工作点略低使阻尼与推力导数微变，导致模型时间常数和增益略有偏差'),
        choiceOpt('exact_match_zero_error', '完全精确重合，验证集残差严格为零', '忽视水动力平方阻力随航速变化的本质非线性特征'),
        choiceOpt('reverse_sign', '航速会向更高速度偏移而非减速', '正增益模型对负向阶跃指令必然产生下降趋势'),
      ],
      allowRationale: true,
      rationalePlaceholder: '从流体阻力随速度二次变化及加减速工作点偏移说明理由...',
      sketch: {
        mode: 'prediction',
        plotId: 'time-response',
        lockPlotId: true,
        label: '运行前手绘预测：-4% 减速阶跃下的对水航速下降曲线',
        hint: '从 8.0 m/s 起笔，于 t=30 s 阶跃点后画出带纯时滞的指数减速轨迹。',
        promptFocus: '预期 -4% 减速阶跃的航速下降趋势与模型外推方向',
        coordinateOverride: {
          title: '减速独立验证预测坐标系',
          subtitle: '0–600 s 时域响应（t=30 s 施加 -4% 轴速参考阶跃）',
          xMin: 0,
          xMax: 600,
          yMin: 7.2,
          yMax: 8.4,
          xTicks: TIME_600_TICKS,
          yTicks: [7.2, 7.6, 8.0, 8.4].map((value) => ({ value, label: value.toFixed(1) })),
          verticalMarkers: SPEED_30S_MARKER,
          horizontalMarkers: SPEED_8_BASELINE,
        },
        overlayExtractor: (samples) => extractContainerSpeedActualSeries(samples),
      },
    },
    observationSpec: {
      kind: 'artifact_binding',
      artifactKind: 'comparison',
      prompt: '在「评估」页签以第 3 步模型对本步运行执行指令对照后，点击一键引用独立验证集 RMSE、FIT 与峰值误差：',
    },
    interpretationSpec: {
      checklist: ['对比第 3 步训练残差与第 4 步留出验证 RMSE/FIT', '解释加/减速水动力非对称残差原因', '评估单点线性模型在 ±5% 邻域内的有效边界'],
      placeholder: '结合验证集 RMSE、FIT 与残差走势，解释小信号线性模型反向外推出现误差的物理机理...',
    },
  },
  5: {
    goal: '分别在 0.2 轻载与 0.9 重载下辨识冻结航速模型并对比原中载模型外推误差，厘清工况参数漂移与纯粹辨识误差的边界。',
    actionSteps: [
      '在预测区按时间常数 T 从短到长排列 0.2、0.6、0.9 三档装载的响应快慢顺序。',
      '依次选择装载率 0.2 与 0.9 完成各 600 秒阶跃运行，在「评估」页签先用第 3 步中载模型外推对照。',
      '随后分别框选 0.2 与 0.9 运行窗口辨识冻结新模型，并在下方录入两端稳态航速与 K/T 参数。',
    ],
    watch: '相同激励幅值下，0.2 轻载加速响应快、T 更短；0.9 重载质量与水动力附加质量剧增，导致过渡段明显拉长、T 显著增大。',
    conditionText: '平静无风浪流环境，初始航速 8.0 m/s，分别在 20% 轻载与 90% 重载工况施加轴速参考阶跃（各 600 秒，需保留 2 次运行与 2 个冻结模型）。',
    suggestion: '务必确保第 5 步的 0.2 与 0.9 两次运行各自都已在「评估」页签冻结对应局部航速模型。',
    predictionSpec: {
      kind: 'ranking',
      prompt: '按一阶模型时间常数 T 从小到大（过渡过程由快到慢）排列三种装载工况：',
      rankItems: [
        '0.2 轻载（质量与附加质量最小，惯性滞后时间常数 T 最短）',
        '0.6 中载（中等排水质量，时间常数 T 居于中间）',
        '0.9 重载（总排水质量最大，时间常数 T 最长）',
      ],
      allowRationale: true,
      rationalePlaceholder: '结合纵向运动惯性质量与水动力线性阻尼之比说明 T 随装载变化规律...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成 0.2 与 0.9 阶跃运行并冻结各自模型后，提取稳态航速并补录「评估」页签冻结的 K 与 T 参数：',
      slots: [
        { id: 'op_02', label: '轻载 0.2 工作点', conditionHint: '装载率 0.20 · 8.0 m/s', matcher: (r) => isLoad(r, 0.2), metrics: opPointMetrics({ key: 'loading', label: '装载率', extract: extractContainerLoadingRatio }) },
        { id: 'op_09', label: '重载 0.9 工作点', conditionHint: '装载率 0.90 · 8.0 m/s', matcher: (r) => isLoad(r, 0.9), metrics: opPointMetrics({ key: 'loading', label: '装载率', extract: extractContainerLoadingRatio }) },
      ],
    },
    interpretationSpec: {
      checklist: ['对比 0.2 与 0.9 的 K、T 参数差异', '对比中载模型直接外推失配误差与重辨识残差', '说明工况参数漂移对固定控制律的挑战'],
      placeholder: '对比轻载与重载局部模型参数，解释为何中载模型外推误差主要来自工况参数变化而非算法识别偏差...',
    },
  },
  6: {
    goal: '在 6 m/s 与 10 m/s 航速工作点辨识并冻结局部航速模型，量化非线性水阻力对局部线性化增益与惯性的影响。',
    actionSteps: [
      '在预测区判断航速从 6 m/s 提高至 10 m/s 时时间常数 T 的变化方向。',
      '保持 60% 中载，分别选择初始航速 6 m/s 与 10 m/s（推荐 10 m/s 可选用 −5% 阶跃）各完成 600 秒运行。',
      '前往「评估」页签分别从 6 m/s 与 10 m/s 运行窗口冻结局部模型，并在下方录入参数比较表。',
    ],
    watch: '高速 10 m/s 处阻尼斜率增大，使航速达到新稳态所需的时间常数 T 明显小于 6 m/s 低速工况，且相同百分比阶跃对应的绝对航速变化幅值不同。',
    conditionText: '平静无风浪流环境，60% 中载，分别在初始对水航速 6.0 m/s 与 10.0 m/s 工作点施加 ±5% 轴速参考阶跃（各 600 秒）。',
    suggestion: '建议为第 7 步保留至少 3 个互不相同的工况冻结模型（来自第 3、5、6 步）。',
    predictionSpec: {
      kind: 'choice',
      prompt: '在相同 0.6 装载率下，将工作点由 6 m/s 提升至 10 m/s 时，局部线性化时间常数 T 将如何变化？',
      options: [
        choiceOpt('smaller_t_at_10', '10 m/s 高速工作点的时间常数 T 明显小于 6 m/s 低速工作点', '阻力 R∝U² 使高速处的局部线性化阻尼 ∂R/∂U 更大，等效惯性时间常数 T=M/(∂R/∂U) 缩短'),
        choiceOpt('larger_t_at_10', '10 m/s 高速工作点的时间常数 T 反而比 6 m/s 更长', '误以为高速下需要更长时间衰减扰动'),
        choiceOpt('same_t', '由于船体质量未变，6 m/s 与 10 m/s 的时间常数 T 完全相等', '忽略了阻力非线性的局部导数随基准航速显著变化'),
      ],
      allowRationale: true,
      rationalePlaceholder: '利用二次阻力定律在基准航速 U₀ 处的局部斜率说明时间常数变化机理...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成 6 m/s 与 10 m/s 阶跃运行并冻结两套模型后，提取稳态航速并填写两端冻结的 K 与 T 参数：',
      slots: [
        { id: 'speed_6', label: '6 m/s 低速工作点', conditionHint: '60% 中载 · 6.0 m/s', matcher: (r) => r.configuration.initialWaterSpeedMps === 6, metrics: opPointMetrics({ key: 'init_speed', label: '初始航速', unit: 'm/s', extract: (r) => r.configuration.initialWaterSpeedMps?.toFixed(1) ?? null }) },
        { id: 'speed_10', label: '10 m/s 高速工作点', conditionHint: '60% 中载 · 10.0 m/s', matcher: (r) => r.configuration.initialWaterSpeedMps === 10, metrics: opPointMetrics({ key: 'init_speed', label: '初始航速', unit: 'm/s', extract: (r) => r.configuration.initialWaterSpeedMps?.toFixed(1) ?? null }) },
      ],
    },
    interpretationSpec: {
      checklist: ['定量对比 6 m/s 与 10 m/s 的 K 与 T 值', '阐明非线性阻力的局部线性化随工作航速移动规律', '说明宽航速范围航次需要分段或调度模型的必要性'],
      placeholder: '对比低速与高速工作点冻结参数，解释二次水阻力局部线性化如何改变等效增益与时间常数...',
    },
  },
  7: {
    goal: '基于本人冻结模型整定并微调航速 PI 控制器，通过先冻结理想闭环预测再对照实船运行揭示执行器与非线性因素造成的闭环偏差。',
    actionSteps: [
      '选定主工作点模型（默认中载 8 m/s）并微调比例/积分倍率，在预测区填写预期超调百分比。',
      '点击「冻结理想速度与航次预测」生成基于本人模型的理想闭环响应曲线。',
      '点击「开始」完成 600 秒 8→9 m/s 闭环阶跃运行，再于「评估」页签执行独立闭环对照并引用对比指标。',
    ],
    watch: 't=30 s 航速参考从 8 跳至 9 m/s 后，观察实际轴速 (r/min) 的爬升斜率、对水航速的超调百分比与调节时间，以及理想闭环预测与实船曲线间的 RMSE。',
    conditionText: '平静无风浪流环境，60% 中载、初始航速 8.0 m/s，t=30 s 航速参考阶跃至 9.0 m/s，总时长 600 秒。',
    suggestion: '必须先点击「冻结理想速度与航次预测」后再启动实船运行，否则无法通过闭环预测一致性核查。',
    predictionSpec: {
      kind: 'numeric_target',
      unit: '%',
      targetPlaceholder: '如 4.0',
      prompt: '基于你当前选定的主模型与 Kp/Ti 相对倍率，预估 8→9 m/s 实船闭环阶跃响应的最大超调百分比 (%)：',
      allowRationale: true,
      rationalePlaceholder: '说明 Kp/Ti 倍率与模型纯时延/执行器限幅如何影响闭环超调量...',
    },
    observationSpec: {
      kind: 'artifact_binding',
      artifactKind: 'comparison',
      prompt: '在「评估」页签选择主模型完成独立闭环对照后，点击一键引用理想闭环预测与实船响应的 RMSE、FIT 摘要：',
    },
    interpretationSpec: {
      checklist: ['对比理想预测与实船闭环的超调、调节时间及 RMSE', '分析执行器响应限幅或局部增益误差导致的闭环偏差', '说明必须由本人辨识模型整定参数而非直接套用默认分值的意义'],
      placeholder: '结合第 7 步理想闭环与实船曲线残差，阐明内模 PI 参数整定规律与实船非理想因素影响...',
    },
  },
  8: {
    goal: '锁定沿用第 7 步固定 PI 控制器并在轻载与重载工况下测试闭环阶跃，量化固定控制器的鲁棒性失效边界。',
    actionSteps: [
      '在预测区判断同一套固定 PI 迁移到 0.2 轻载与 0.9 重载时的超调与调节时间偏离方向。',
      '确认控制区已锁定沿用第 7 步固定增益与主模型，依次选择装载率 0.2 与 0.9 各完成 600 秒闭环阶跃。',
      '在下方两档装载槽中提取峰值航速与稳态航速，记录两端性能失配幅度。',
    ],
    watch: '0.2 轻载因惯性骤减容易出现明显超调甚至轴速指令大幅波动；0.9 重载惯性骤增使航速上升拖尾、调节时间成倍拉长。',
    conditionText: '平静无风浪流环境，沿用第 7 步固定 PI 增益与主工作点模型，分别在 20% 轻载与 90% 重载下执行 8→9 m/s 闭环阶跃（各 600 秒）。',
    suggestion: '本步禁止改动 Kp/Ti 与模型选择，仅切换装载率 0.2 与 0.9 完成两次固定控制对照。',
    predictionSpec: {
      kind: 'choice',
      prompt: '沿用第 7 步中载固定 PI 控制器分别控制 0.2 轻载与 0.9 重载时，闭环响应最可能呈现哪种差异？',
      options: [
        choiceOpt('light_overshoot_heavy_sluggish', '0.2 轻载响应过快并易产生更大超调，0.9 重载则变得迟缓、调节时间明显延长', '中载固定增益相对轻载惯性偏大、相对重载惯性偏小'),
        choiceOpt('light_sluggish_heavy_oscillatory', '0.2 轻载极为迟缓，0.9 重载激烈超调振荡', '把质量惯性减小与增大对闭环阻尼比的影响方向判断颠倒'),
        choiceOpt('uniform_robustness', '两种装载下的调节时间与超调与中载完全一致', '忽视船体质量与时间常数成倍变动对固定回路稳定裕度的冲击'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合开环交叉频率随船体时间常数 T 漂移的规律说明超调与快慢差异...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成 0.2 与 0.9 两次固定控制器运行后，分别一键提取峰值对水航速与稳态航速：',
      slots: [
        { id: 'fixed_02', label: '轻载 0.2 固定 PI', conditionHint: '装载率 0.20 · 关闭调度', matcher: (r) => isLoad(r, 0.2) && !r.initialInput.containerSpeed?.schedulingEnabled, metrics: loopMetrics({ key: 'loading', label: '装载率', extract: extractContainerLoadingRatio }) },
        { id: 'fixed_09', label: '重载 0.9 固定 PI', conditionHint: '装载率 0.90 · 关闭调度', matcher: (r) => isLoad(r, 0.9) && !r.initialInput.containerSpeed?.schedulingEnabled, metrics: loopMetrics({ key: 'loading', label: '装载率', extract: extractContainerLoadingRatio }) },
      ],
    },
    interpretationSpec: {
      checklist: ['对比 0.2 与 0.9 的超调幅度与到达 9 m/s 稳态速度时间', '解释固定 PI 控制律在非设计工作点失配机理', '指明多工作点增益调度的工程必要性'],
      placeholder: '结合两端实测峰值航速与收敛快慢差异，论证固定控制器的鲁棒性边界...',
    },
  },
  9: {
    goal: '填写三点工作点调度表并启用线性增益调度，在轻载与重载两端验证其相比第 8 步固定 PI 的动态一致性改善。',
    actionSteps: [
      '在预测区选择开启三点线性增益调度后 0.2 与 0.9 闭环响应一致性的预期变化。',
      '在控制区核对轻/中/重三点工作点模型，确保「三点线性增益调度」开关处于开启状态。',
      '依次选择装载率 0.2 与 0.9 运行 600 秒闭环阶跃，提取指标并与第 8 步固定 PI 对比。',
    ],
    watch: '开启三点调度后，轻载与重载的航速超调量收敛至相近水平，重载爬升加快而轻载峰值受到有效压制，控制输出与当前装载相匹配。',
    conditionText: '平静无风浪流环境，开启三点线性增益调度，分别在 20% 轻载与 90% 重载下执行 8→9 m/s 闭环阶跃（各 600 秒）。',
    suggestion: '务必保证三个工作点选取了互不相同的本人冻结模型，且全程保持三点线性增益调度开启。',
    predictionSpec: {
      kind: 'choice',
      prompt: '相比第 8 步固定 PI，启用本人三点工作点线性增益调度后，0.2 与 0.9 工况的 8→9 m/s 响应将发生何种改善？',
      options: [
        choiceOpt('consistent_scheduled', '轻载超调显著减小、重载响应加快，两端闭环一致性明显优于第 8 步固定 PI', '控制器依当前装载与航速权重插值生成匹配本地工作点 K/T 的 PI 增益'),
        choiceOpt('worse_than_fixed', '两端性能比固定 PI 更加发散且超调成倍增加', '基于真实辨识工作点的合法调度插值可改善而非破坏被控对象匹配度'),
        choiceOpt('no_effect', '与第 8 步固定 PI 曲线完全相同', '误认为调度开启后控制器参数仍固定在中载基准点'),
      ],
      allowRationale: true,
      rationalePlaceholder: '阐明三点线性插值增益调度为何能同时照顾轻载阻尼与重载响应速度...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成三点调度下 0.2 与 0.9 两次运行后，一键提取峰值与末态航速并对照第 8 步固定 PI 记录：',
      slots: [
        { id: 'sched_02', label: '轻载 0.2 三点调度（对照第 8 步固定 PI）', conditionHint: '装载率 0.20 · 调度开启', matcher: (r) => isLoad(r, 0.2) && Boolean(r.initialInput.containerSpeed?.schedulingEnabled), metrics: loopMetrics({ key: 'mode', label: '控制模式', extract: (r) => (r.initialInput.containerSpeed?.schedulingEnabled ? '三点调度' : '固定 PI') }) },
        { id: 'sched_09', label: '重载 0.9 三点调度（对照第 8 步固定 PI）', conditionHint: '装载率 0.90 · 调度开启', matcher: (r) => isLoad(r, 0.9) && Boolean(r.initialInput.containerSpeed?.schedulingEnabled), metrics: loopMetrics({ key: 'mode', label: '控制模式', extract: (r) => (r.initialInput.containerSpeed?.schedulingEnabled ? '三点调度' : '固定 PI') }) },
      ],
    },
    interpretationSpec: {
      checklist: ['定量比较第 8 步固定 PI 与第 9 步三点调度的两端差异', '说明线性插值权重如何随装载点迁移', '强调增益调度是基于工况模型设计而非随机调参'],
      placeholder: '对比第 8 步固定控制与第 9 步三点调度的超调与响应一致性，论证随工况设计调度的依据与局限...',
    },
  },
  10: {
    goal: '在往返变速参考切换下对比直接切换与无扰积分跟踪，揭示积分状态预对齐在抑制切换冲击与执行器饱和中的物理机制。',
    actionSteps: [
      '在预测区选择开启无扰积分跟踪后对轴速指令切换冲击与航速平顺性的影响。',
      '保持基线控制与调度参数不变，先关闭「无扰积分跟踪」跑完 1 次 900 秒（8→10→8 m/s）运行。',
      '点击「重置」，开启「无扰积分跟踪」跑完第 2 次 900 秒运行，并在下方两槽提取切换峰值对比。',
    ],
    watch: '重点比较 t=30 s 提速与 t=450 s 降速瞬间轴速指令 (r/min) 是否出现阶跃毛刺、螺旋桨转速是否触及限幅及航速过冲幅度。',
    conditionText: '平静无风浪流环境，60% 中载，900 秒往返参考序列（t=30 s 目标 8→10 m/s，t=450 s 回落 10→8 m/s），其余控制参数锁定基线。',
    suggestion: '本步仅允许拨动「无扰积分跟踪」开关，不要更改三点模型、Kp/Ti 倍率或抗饱和配置。',
    predictionSpec: {
      kind: 'choice',
      prompt: '在 8→10→8 m/s 大跨度参考切换与调度权重变化过程中，开启「无扰积分跟踪」相比关闭时主要起什么作用？',
      options: [
        choiceOpt('prevent_bump', '在工作点/限幅切换时按实际执行器出力对齐积分状态，显著削弱轴速指令突跳与切换冲击', '无扰切换确保比例与积分之和在参数重算或退饱和瞬间保持连续'),
        choiceOpt('amplify_bump', '放大轴速指令突跳并引发剧烈功率振荡', '误解无扰积分跟踪的平滑衔接功能'),
        choiceOpt('change_steady_target', '永久改变 10 m/s 与 8 m/s 的稳态航速设定值', '积分跟踪仅消除切换瞬态冲击而不改变稳态参考目标'),
      ],
      allowRationale: true,
      rationalePlaceholder: '解释工作点增益变化或执行器饱和退出时积分项未跟踪导致的瞬时跃变机理...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成无扰积分跟踪关闭与开启两次 900 秒运行后，一键提取切换峰值轴速与末态航速进行对照：',
      slots: [
        { id: 'bumpless_off', label: '无扰积分跟踪关闭', conditionHint: '直接切换 · 900 s', matcher: (r) => r.initialInput.containerSpeed?.bumpless === false, metrics: loopMetrics({ key: 'bumpless', label: '无扰状态', extract: (r) => (r.initialInput.containerSpeed?.bumpless ? '开启' : '关闭') }, 'peak_rpm', '峰值轴速', 'r/min', 'shaftRpm') },
        { id: 'bumpless_on', label: '无扰积分跟踪开启', conditionHint: '无扰跟踪 · 900 s', matcher: (r) => r.initialInput.containerSpeed?.bumpless === true, metrics: loopMetrics({ key: 'bumpless', label: '无扰状态', extract: (r) => (r.initialInput.containerSpeed?.bumpless ? '开启' : '关闭') }, 'peak_rpm', '峰值轴速', 'r/min', 'shaftRpm') },
      ],
    },
    interpretationSpec: {
      checklist: ['对比两次运行在切换时刻的轴速/功率峰值差异', '阐明积分状态、执行器限幅与无扰跟踪的联动机理', '总结在增益调度系统中启用无扰切换的必要性'],
      placeholder: '结合两次 900 秒切换过程中的轴速指令毛刺与稳态过渡差异，解释无扰积分跟踪如何保护执行器并减小超调...',
    },
  },
};
