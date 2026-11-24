import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import type { VesselSample } from '../simulations/vessel-experiment';
import { extractCruiseMetric, getCruiseRunObservation } from './cruise-evidence';
import type { StepWorkbenchSpec } from './cruise-step-specs';
import type { SketchActualCurveSeries } from './sketch-coordinate-templates';

function extractStep2RollDecayOverlay(samples: VesselSample[]): SketchActualCurveSeries[] {
  const pts = samples
    .filter((s) => s.time >= 0 && s.time <= 120)
    .map((s) => ({ x: s.time, y: Number.isFinite(s.values.roll) ? s.values.roll : s.values.actualRoll }))
    .filter((pt) => Number.isFinite(pt.y));
  return pts.length >= 2 ? [{ id: 'cruise-step2-roll-decay', label: '实测横摇衰减响应 (°)', color: '#0ea5e9', points: pts }] : [];
}

function extractStep6ResonanceOverlay(samples: VesselSample[], runs: VesselRunSummary[]): SketchActualCurveSeries[] {
  const step6Runs = runs.filter((r) => r.stepSequence === 6).sort((a, b) => a.createdAtMs - b.createdAtMs);
  const windowSamples = samples.filter((s) => s.time >= 120);
  const pool = windowSamples.length >= 10 ? windowSamples : samples;
  const livePeak = pool.reduce((best, s) => {
    const val = Number.isFinite(s.values.roll) ? s.values.roll : s.values.actualRoll;
    return Number.isFinite(val) ? Math.max(best, Math.abs(val)) : best;
  }, 0);
  const latestRunId = step6Runs.at(-1)?.id;
  const points: Array<{ x: number; y: number }> = [];
  for (const ratio of [0.7, 1, 1.3] as const) {
    const matched = [...step6Runs].reverse().find((r) => r.courseSettings?.resonanceRatio === ratio && r.stoppedAtMs !== null)
      ?? [...step6Runs].reverse().find((r) => r.courseSettings?.resonanceRatio === ratio);
    if (!matched) continue;
    const cached = getCruiseRunObservation(matched.id)?.rollPeakDeg;
    const amp = typeof cached === 'number' && Number.isFinite(cached)
      ? cached : (matched.id === latestRunId || matched.stoppedAtMs === null) && pool.length > 0 && livePeak > 0 ? livePeak : null;
    if (amp !== null && Number.isFinite(amp)) points.push({ x: ratio, y: amp });
  }
  return points.length > 0 ? [{ id: 'cruise-step6-frf', label: '三档周期比实测横摇幅值 (°)', color: '#0ea5e9', points }] : [];
}

export const CRUISE_STEP_SPECS_EARLY: readonly StepWorkbenchSpec[] = [
  {
    seq: 1,
    goal: '辨识双吊舱推进器与左右减摇鳍的安装方位及主受力通道，分清转向与减摇执行器的职责边界。',
    actionSteps: [
      '运行前先预估双吊舱与减摇鳍各自主要改变哪一自由度。',
      '点击「开始」完成 60 s 直航，在左侧执行器图依次点选四台执行器并核对坐标与六维合力读数。',
      '完成下方执行器与主受力通道配对，说明为何不能把吊舱角直接当成常规舵角。',
    ],
    watch: '四台执行器的船体安装坐标、纵向/横向/垂向力与横摇/纵摇/艏摇六维力矩分量。',
    conditionText: '平静水面、初速 8 m/s、直航无额外转向指令、无测量噪声，时长 60 s。',
    suggestion: '重点留意吊舱垂向安装偏心激发的横摇耦合力矩，以及减摇鳍两侧对称安装带来的差动横摇力臂。',
    predictionSpec: {
      kind: 'choice',
      prompt: '运行前预估：在转向与横向减摇中，双吊舱与双减摇鳍的主导力矩通道如何分工？',
      options: [
        { value: 'pod_yaw_fin_roll', label: '双吊舱主导艏摇与纵横向推进，差动减摇鳍主导横摇力矩（均伴随空间耦合）' },
        { value: 'pod_roll_fin_yaw', label: '双吊舱只负责横摇阻尼，减摇鳍主要提供纵向推力与转向' },
        { value: 'identical', label: '吊舱与减摇鳍产生完全相同的纯单自由度力矩，彼此可任意替代' },
      ],
      allowRationale: true,
      rationalePlaceholder: '简述安装坐标和流体来流方向如何决定各自的主通道与耦合项…',
    },
    observationSpec: {
      kind: 'channel_match',
      prompt: '结合左侧「执行器与六自由度」图依次点选设备，为四台执行器匹配正确的动力学角色：',
      pairs: [
        { id: 'port_pod', item: '左吊舱方位偏转', hint: '艉部左舷全回转推进器', choices: ['产生纵横向推力并主导艏摇（耦合横摇/纵摇）', '仅产生纯横摇阻尼力矩且无艏摇耦合', '只改变静水吃水'] },
        { id: 'starboard_pod', item: '右吊舱方位偏转', hint: '艉部右舷全回转推进器', choices: ['产生纵横向推力并主导艏摇（耦合横摇/纵摇）', '仅产生纯横摇阻尼力矩且无艏摇耦合', '只改变静水吃水'] },
        { id: 'port_fin', item: '左减摇鳍差动偏转', hint: '舯后左舷水翼减摇鳍', choices: ['靠来流升力主导横摇力矩（耦合升沉/纵摇）', '主导大角度航向转艏控制', '零航速时仍提供满额升力'] },
        { id: 'starboard_fin', item: '右减摇鳍差动偏转', hint: '舯后右舷水翼减摇鳍', choices: ['靠来流升力主导横摇力矩（耦合升沉/纵摇）', '主导大角度航向转艏控制', '零航速时仍提供满额升力'] },
      ],
    },
    interpretationSpec: {
      checklist: ['说明安装高度引起的耦合力矩', '解释为何吊舱角不可等同于常规舵角'],
      placeholder: '从执行器位置、矢量推进方向与水翼升力机理阐明两者在六自由度上的差异…',
    },
  },
  {
    seq: 2,
    goal: '测量静水自由横摇衰减周期与相邻峰值衰减比，在「评估」页签辨识并冻结固有频率与阻尼比。',
    actionSteps: [
      '运行前填写预估固有周期，并在 0–120 s 坐标系手绘预期衰减包络后点击「识图核验」。',
      '保持减摇鳍关闭运行完整 300 s，前往「评估」页签选定衰减窗口冻结二阶横摇振子模型。',
      '对比手绘板自动叠加的实测横摇曲线，回到本栏点击「一键引用已冻结工件摘要」。',
    ],
    watch: '0–120 s 横摇姿态估计曲线的相邻波峰时刻差、峰值衰减比及模型拟合残差。',
    conditionText: '平静水面、初速 8 m/s、初始横摇 +2°、减摇鳍关闭、无测量噪声，时长 300 s。',
    suggestion: '选取包含多个完整衰减波峰的 10–150 s 窗口辨识，可获得稳定的自然频率与阻尼比初值。',
    predictionSpec: {
      kind: 'numeric_target',
      prompt: '预估邮轮在该巡航初态下的自由横摇固有周期，并在下方坐标系手绘 0–120 s 衰减包络。',
      unit: 's',
      targetPlaceholder: '输入预估固有周期（如 16–22 s）',
      allowRationale: true,
      rationalePlaceholder: '结合邮轮大排水量与横稳心高判断周期范围与阻尼强弱…',
      sketch: {
        mode: 'prediction', plotId: 'time-response', lockPlotId: true,
        label: '自由衰减横摇预测草图（0–120 s）',
        hint: '从 t=0 s、φ=+2° 起笔手绘等周期衰减振荡曲线，运行后可叠合实船衰减曲线对照。',
        promptFocus: '重点关注横摇首波峰值、正负摆幅衰减包络与过零振荡周期。',
        coordinateOverride: {
          title: '横摇自由衰减预测坐标系', subtitle: '时间 0–120 s，横摇角 -3° 至 +3°',
          xMin: 0, xMax: 120, yMin: -3, yMax: 3, xLabel: '时间', yLabel: '横摇角', xUnit: 's', yUnit: '°',
          xTicks: [0, 30, 60, 90, 120].map((v) => ({ value: v, label: String(v) })),
          yTicks: [-3, -2, -1, 0, 1, 2, 3].map((v) => ({ value: v, label: String(v) })),
          verticalMarkers: [{ value: 0, label: '初始横摇 +2°', color: '#0ea5e9' }],
          horizontalMarkers: [{ value: 0, label: '平衡零线', color: '#64748b' }],
        },
        overlayExtractor: (samples) => extractStep2RollDecayOverlay(samples),
      },
    },
    observationSpec: { kind: 'artifact_binding', artifactKind: 'model', prompt: '在「评估」页签冻结第 2 步自由衰减模型后，点击右侧按钮引用固有频率与阻尼比摘要：' },
    interpretationSpec: { checklist: ['记录实测衰减周期与手绘包络偏差', '阐明无鳍自由衰减不包含鳍控制效能'], placeholder: '对比预测与实测固有周期及衰减快慢，说明二阶阻尼振子假设及适用条件…' },
  },
  {
    seq: 3,
    goal: '利用差动鳍 ±2° 脉冲激励联合第 2 步自由衰减记录，辨识并冻结含完整鳍控制效能的横摇模型。',
    actionSteps: [
      '运行前判断差动鳍脉冲除激励横摇外对其他通道的耦合影响及选窗原则。',
      '运行 300 s 记录 20–30 s 正脉冲与 60–70 s 反脉冲响应。',
      '前往「评估」页签同时选中本步脉冲记录与第 2 步自由衰减记录，冻结完整模型并回填摘要。',
    ],
    watch: '脉冲期左/右鳍对称反向偏转角、分配横摇力矩峰值及伴随出现的转艏角速度耦合。',
    conditionText: '平静水面、初速 8 m/s，20–30 s 施加 +2°、60–70 s 施加 −2° 差动鳍脉冲，时长 300 s。',
    suggestion: '切勿遗漏「评估」页签中的第 2 步自由衰减记录选择，两者联合才能辨识出正的控制效能增益。',
    predictionSpec: {
      kind: 'choice',
      prompt: '运行前预估：施加对称差动鳍脉冲时，除横摇振荡外船体还会有哪些响应特征？',
      options: [
        { value: 'coupled_yaw_sway', label: '主激励横摇，同时因水动力不对称与垂向偏心伴随小幅横荡/转艏耦合' },
        { value: 'pure_roll_only', label: '全船仅发生纯横摇，转艏与横荡读数绝对为零' },
        { value: 'unstable', label: '脉冲撤除后横摇角将持续发散无法回零' },
      ],
    },
    observationSpec: { kind: 'artifact_binding', artifactKind: 'model', prompt: '联合第 2 步自由衰减记录与第 3 步脉冲窗冻结完整横摇模型后，点击引用参数摘要：' },
    interpretationSpec: { checklist: ['报告冻结后的自然频率、阻尼比与控制效能', '说明多通道耦合与局部线性增益域'], placeholder: '结合残差均方根分析脉冲激励窗选取依据，解释差动鳍引起的耦合现象…' },
  },
  {
    seq: 4,
    goal: '在不重拟合参数的条件下，于全新初态与小幅脉冲工况上完成已冻结横摇模型的独立验证对照。',
    actionSteps: [
      '运行前预估冻结模型在该留出小信号工况下的预测偏差水平。',
      '运行完整 300 s 获取留出测试轨迹。',
      '前往「评估」页签选用第 3 步完整模型运行实际差动鳍角对照，保存后在此引用验证指标。',
    ],
    watch: '对照曲线中的实际横摇估计与模型预测吻合度、均方根误差及拟合优度百分比。',
    conditionText: '平静水面、初速 8 m/s、初始横摇 +1°、20–30 s 叠加 +1° 差动鳍小脉冲，时长 300 s。',
    suggestion: '独立验证严禁重拟合；若预测与实测接近，证明模型在该工况邻域具备外推可信度。',
    predictionSpec: {
      kind: 'choice',
      prompt: '运行前预估：第 3 步冻结的线性模型应用于本步全新小扰动工况时预测精度如何？',
      options: [
        { value: 'high_fit', label: '在同航速小幅线性区内拟合优度较高，仅在非线性耦合段存在微弱残差' },
        { value: 'complete_mismatch', label: '因初始横摇从 2° 变为 1° 而彻底失效，完全无法跟踪振荡相位' },
        { value: 'zero_error', label: '由于使用相同仿真器，独立验证残差必然严格等于零' },
      ],
    },
    observationSpec: { kind: 'artifact_binding', artifactKind: 'comparison', prompt: '在「评估」页签保存本步实际输入对照后，点击引用验证均方根误差与拟合优度：' },
    interpretationSpec: { checklist: ['区分训练集残差与独立留出验证误差', '界定小幅线性横摇模型外推前提'], placeholder: '结合验证曲线与残差指标，讨论局部线性模型在航速或波高大幅变化时的局限…' },
  },
  {
    seq: 5,
    goal: '计算波浪横摇力矩与横摇响应频谱并标定各自峰值频率，区分外部波浪激励频率与船体固有频率。',
    actionSteps: [
      '运行前预测横浪条件下横摇主峰更靠近波浪遭遇频率还是船体固有频率。',
      '保持减摇鳍关闭运行完整 600 s。',
      '在「评估」页签选 120–600 s 窗分别计算「波浪横摇力矩诊断」与「横摇姿态估计」频谱，并填入下方读数。',
    ],
    watch: '120–600 s 窗口内波浪激励谱峰、横摇响应谱峰及横摇角速度频带能量聚集位置。',
    conditionText: '轻度不规则横浪、初速 8 m/s、减摇鳍关闭、无测量噪声，时长 600 s（稳态统计窗 120–600 s）。',
    suggestion: '外部波浪能量集中在波频附近，而船体阻尼较低时固有频率处亦会呈现显著选择性放大。',
    predictionSpec: {
      kind: 'choice',
      prompt: '运行前预估：轻度不规则横浪下无鳍横摇姿态的主峰频率更接近哪一物理量？',
      options: [
        { value: 'natural_dominant', label: '受低阻尼选频放大影响，主峰显著靠近第 2 步辨识的船体固有频率' },
        { value: 'wave_only', label: '完全重合波浪谱最高点，与船体自身固有频率毫无关系' },
        { value: 'dc_zero', label: '能量集中于零频静态横倾，不会出现动态频谱峰' },
      ],
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '在「评估」页签计算 120–600 s 频谱后，填入关键频率读数及对比值：',
      metrics: [
        { key: 'wavePeakHz', label: '波浪力矩主峰频率', unit: 'Hz', placeholder: '如 0.145' },
        { key: 'rollPeakHz', label: '横摇响应主峰频率', unit: 'Hz', placeholder: '如 0.052' },
        { key: 'freqRatio', label: '响应主频 / 第 2 步固有频率比值', unit: 'x', placeholder: '如 1.02' },
      ],
    },
    interpretationSpec: { checklist: ['明确区分激励频率与固有频率', '阐明低阻尼振子在波谱下的选频放大效应'], placeholder: '结合双通道频谱峰频率差异，说明波浪力矩与横摇响应为何不在同一频率取最大…' },
  },
  {
    seq: 6,
    goal: '在 0.7、1.0 与 1.3 倍固有周期规则横浪下测量稳态横摇幅值，检验共振放大范围及实际阻尼削峰效应。',
    actionSteps: [
      '运行前排序三档周期比的预期横摇幅值，并在幅频坐标系手绘幅频响应曲线后「识图核验」。',
      '选中第 3 步冻结模型，依次在 0.7、1.0、1.3 倍周期下各自运行完整 600 s（每次结束先重置再切下一档）。',
      '观察手绘板自动叠合的三档实测折线，并在下方三档记录槽逐一提取横摇峰值与均方根。',
    ],
    watch: '120–600 s 规则波稳态区横摇振幅随周期比变化规律，确认共振峰值与粘性/辐射阻尼限制。',
    conditionText: '规则横浪波高 0.5 m、初速 8 m/s、减摇鳍关闭，周期分别取固有周期的 0.7、1.0、1.3 倍，各 600 s。',
    suggestion: '切勿在未重置时直接修改倍率，确保每次完整运行 600 s 以进入稳态统计窗口。',
    predictionSpec: {
      kind: 'ranking',
      prompt: '将三档规则波周期按预期稳态横摇幅值由大到小排序，并在幅频坐标系手绘预测曲线：',
      rankItems: ['1.0 倍固有周期（共振区）', '1.3 倍固有周期（长周期区）', '0.7 倍固有周期（短周期区）'],
      sketch: {
        mode: 'prediction', plotId: 'frequency-amplitude', lockPlotId: true,
        label: '规则波共振幅频响应预测草图（0.6–1.4 倍周期）',
        hint: '横轴为周期比 (0.6..1.4，虚线标出 1.0 倍线)，纵轴为横摇幅值 (°)。收集三档运行后自动叠合实测折线。',
        promptFocus: '标出 1.0 倍附近共振峰隆起高度及 0.7/1.3 倍两侧滚降趋势。',
        coordinateOverride: {
          title: '横摇共振幅频预测坐标系', subtitle: '周期倍率 0.6–1.4（1.0 为固有周期），纵轴横摇幅值 (°)',
          xMin: 0.6, xMax: 1.4, yMin: 0, yMax: 6, xLabel: '周期倍率', yLabel: '横摇幅值', xUnit: '倍', yUnit: '°',
          xTicks: [0.6, 0.7, 1.0, 1.3, 1.4].map((v) => ({ value: v, label: v.toFixed(1) })),
          yTicks: [0, 1.5, 3, 4.5, 6].map((v) => ({ value: v, label: v.toFixed(1) })),
          verticalMarkers: [{ value: 1.0, label: '1.0x 固有周期', color: '#f59e0b' }],
          horizontalMarkers: [],
        },
        overlayExtractor: (samples, runs) => extractStep6ResonanceOverlay(samples, runs),
      },
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成三档规则波运行后，点击「一键提取本工况读数」采集各自稳态峰值与均方根：',
      slots: ([0.7, 1, 1.3] as const).map((ratio) => ({
        id: `ratio_${String(ratio).replace('.', '')}`, label: `${ratio.toFixed(1)} 倍固有周期`, conditionHint: '波高 0.5 m 规则横浪 · 600 s',
        matcher: (run) => run.courseSettings?.resonanceRatio === ratio,
        metrics: [
          { key: 'rollPeak', label: '稳态横摇峰值', unit: '°', seriesId: 'roll', pickMode: 'peak', extract: (r) => extractCruiseMetric(r, 'rollPeakDeg', 3) },
          { key: 'rollRms', label: '窗口横摇均方根', unit: '°', extract: (r) => extractCruiseMetric(r, 'rollRmsDeg', 3) },
        ],
      })),
    },
    interpretationSpec: { checklist: ['核对三档幅值排序是否一致', '分析水动力阻尼与耦合对共振尖峰的抑制'], placeholder: '结合实测叠合折线解释为何实际共振峰值有限且峰值位置可能略偏离理论 1.0 倍…' },
  },
  {
    seq: 7,
    goal: '对比 0、2、8 m/s 三档航速下的恒定差动鳍角力矩，量化水翼减摇鳍控制能力对来流速度的依赖性。',
    actionSteps: [
      '运行前按产生横摇力矩大小排序三档航速，并阐明零航速静水下常规减摇鳍的工作边界。',
      '依次将初始航速设为 0、2、8 m/s 并各运行完整 120 s（每档结束先重置再切航速）。',
      '在下方三档航速对比表一键提取稳态分配横摇力矩与实际横摇响应角。',
    ],
    watch: '20 s 鳍偏转至 +5° 后「分配横摇力矩」「可用横摇力矩」及「低速减摇能力提示」随航速的变化。',
    conditionText: '平静水面、20 s 起差动鳍维持 +5° 偏转，分别测试 0、2、8 m/s 三档航速，各 120 s。',
    suggestion: '切勿把零速减摇设想为常量比例增益；常规鳍升力与来流速度平方成正比。',
    predictionSpec: {
      kind: 'ranking',
      prompt: '将三档航速按差动鳍偏转 +5° 时能产生的实际横摇控制力矩从大到小排序：',
      rankItems: ['8 m/s 巡航来流', '2 m/s 极低速来流', '0 m/s 零航速静水'],
      allowRationale: true,
      rationalePlaceholder: '结合水翼升力公式估算 2 m/s 与 8 m/s 的力矩比值，并预估 0 m/s 时力矩值…',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成 0 / 2 / 8 m/s 三档运行后，分别提取分配横摇力矩与稳态横摇角：',
      slots: ([0, 2, 8] as const).map((speed) => ({
        id: `speed_${speed}`, label: `航速 ${speed} m/s`, conditionHint: '静水 +5° 鳍阶跃 · 120 s',
        matcher: (run) => run.configuration.initialWaterSpeedMps === speed,
        metrics: [
          { key: 'finMoment', label: '分配横摇力矩', unit: 'N·m', seriesId: 'finMoment', pickMode: 'steady', extract: (r) => extractCruiseMetric(r, 'finMomentSteadyNm', 0) },
          { key: 'rollAngle', label: '稳态横摇角', unit: '°', seriesId: 'roll', pickMode: 'steady', extract: (r) => extractCruiseMetric(r, 'rollSteadyDeg', 3) },
        ],
      })),
    },
    interpretationSpec: { checklist: ['验证力矩与航速平方成正比', '说明低速或停泊工况不能靠常规鳍减摇'], placeholder: '定量对比 0、2、8 m/s 的实际力矩比，阐述低速鳍效丧失对靠泊或低速减摇设计的约束…' },
  },
  {
    seq: 8,
    goal: '基于第 3 步冻结模型设计目标阻尼比 0.5 的横摇速率反馈，先绘伯德图再以 600 s 实船运行检验闭环差异。',
    actionSteps: [
      '运行前预估开鳍后的横摇均方根降幅百分比，在下方伯德图手绘开/闭环幅频曲线并点击「识图核验」，开启参考叠加比对本人振子理论线。',
      '确认选中第 3 步完整模型（本步已锁定鳍反馈开启、目标阻尼比 0.5、恢复刚度 0），运行完整 600 s。',
      '记录理想速率增益及实船 120–600 s 横摇均方根与不适度评价指数，分析理想与实际的偏差根源。',
    ],
    watch: '控制面板理想设计曲线与增益值，以及实船运行中请求力矩与可用力矩差额、横摇均方根与不适度指数。',
    conditionText: '轻度不规则横浪、初速 8 m/s、锁定目标阻尼比 0.5 与纯速率反馈，时长 600 s。',
    suggestion: '理想设计曲线假设无限力矩且无量测滤波延迟；实船鳍角受 ±25° 与来流限制，需对比两者真实差距。',
    predictionSpec: {
      kind: 'numeric_target',
      prompt: '运行前预估：采用目标阻尼比 0.5 速率反馈后，稳态横摇均方根相对无鳍自由横摇的下降幅度（%）。',
      unit: '%', targetPlaceholder: '输入预估降幅百分比（如 45）',
      allowRationale: true, rationalePlaceholder: '结合第 3 步辨识阻尼比与目标阻尼比 0.5 的倍数关系估计共振峰衰减幅度…',
    },
    sketchSpec: {
      mode: 'analysis', plotId: 'bode', lockPlotId: false,
      label: '横摇闭环设计伯德图分析草图',
      hint: '在伯德图绘制开环（主笔）与速率反馈闭环（对比笔）幅频走势；点击「识图核验」即可叠加本人冻结横摇振子解析参考线。',
      promptFocus: '关注谐振峰处阻尼增大带来的峰值抑制，以及高频斜率与转折频率一致性。',
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '记录理想速率反馈增益及实船 120–600 s 闭环表现：',
      metrics: [
        { key: 'idealRateGain', label: '理想角速度反馈增益', unit: 'MN·m·s/rad', placeholder: '见控制面板设计初值' },
        { key: 'actualRollRms', label: '实船横摇均方根', unit: '°', placeholder: '见评估/状态舒适度读数' },
        { key: 'actualMsi', label: '实船教学不适度评价指数', unit: '%', placeholder: '见舒适度仪表读数' },
      ],
    },
    interpretationSpec: { checklist: ['对照理想闭环设计图与实船结果', '列举无限力矩假设与真实滤波/饱和约束差异'], placeholder: '解释为何实船减摇效果往往略低于理想线性设计预测，分析力矩限幅与观测滞后的作用…' },
  },
  {
    seq: 9,
    goal: '保持同一种子与相同统计窗口公平对比减摇鳍关闭与开启，综合评价横摇抑制收益与伺服电能代价。',
    actionSteps: [
      '运行前预估开启减摇鳍后横摇与伺服能耗的同步变化。',
      '保持基线阻尼与滤波不变，先在「减摇鳍关闭」下运行 600 s，重置后切换「减摇鳍开启」再运行 600 s。',
      '在下方「鳍关」「鳍开」槽位提取 120–600 s 同窗口横摇均方根、峰值与伺服电能。',
    ],
    watch: '相同 120–600 s 统计窗内的横摇均方根、峰值、不适度评价指数以及鳍伺服电能变化。',
    conditionText: '轻度不规则横浪、初速 8 m/s、相同随机种子与基线控制器，仅对比减摇鳍关闭与开启，各 600 s。',
    suggestion: '切勿仅凭结束时刻的瞬时横摇读数判断优劣，必须比较同一 120–600 s 稳态统计窗口指标。',
    predictionSpec: {
      kind: 'choice',
      prompt: '运行前预估：在相同海况与统计窗内开启减摇鳍反馈，哪种变化最符合能量与舒适性规律？',
      options: [
        { value: 'roll_down_work_up', label: '窗口横摇均方根与峰值明显降低，同时付出非零的鳍伺服电能与磨损代价' },
        { value: 'both_zero_cost', label: '横摇降为零且减摇鳍伺服电能几乎不增加' },
        { value: 'roll_up', label: '开启速率阻尼反馈必然放大所有频段横摇角' },
      ],
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '分别完成「鳍关」「鳍开」600 s 运行后，一键提取同统计窗口量化指标：',
      slots: ([false, true] as const).map((enabled) => ({
        id: enabled ? 'fins_on' : 'fins_off', label: enabled ? '减摇鳍开启' : '减摇鳍关闭',
        conditionHint: enabled ? '120–600 s 速率反馈闭环' : '120–600 s 自由横摇基线',
        matcher: (run) => run.courseSettings?.finsEnabled === enabled,
        metrics: [
          { key: 'rollRms', label: '横摇均方根', unit: '°', extract: (r) => extractCruiseMetric(r, 'rollRmsDeg', 3) },
          { key: 'rollPeak', label: '横摇峰值', unit: '°', seriesId: 'roll', pickMode: 'peak', extract: (r) => extractCruiseMetric(r, 'rollPeakDeg', 3) },
          { key: 'finWork', label: '鳍伺服电能', unit: 'MJ', extract: (r) => extractCruiseMetric(r, 'finWorkMj', 3) },
        ],
      })),
    },
    interpretationSpec: { checklist: ['使用同统计窗 RMS/峰值/能耗比较', '说明为何不能用末端瞬时值替代窗口指标'], placeholder: '量化减摇百分比与伺服电能投入比，解释统计窗口选取对波浪随机工况公平对比的必要性…' },
  },
  {
    seq: 10,
    goal: '在较高海况下对比目标阻尼比 0.3 与 0.7 的性能与饱和代价，揭示有限执行器能力下的高增益收益边界。',
    actionSteps: [
      '运行前预估将目标阻尼比从 0.3 提升至 0.7 对减摇收益与鳍角饱和的影响。',
      '保持基线参数一致，依次以目标阻尼比 0.3 与 0.7 运行完整 600 s。',
      '提取并比对两组在横摇均方根、最大鳍角及鳍伺服电能上的差异。',
    ],
    watch: '高海况波浪下请求横摇力矩超出可用横摇力矩的饱和频率、25° 限幅告警灯与高频磨损积分。',
    conditionText: '中高海况不规则横浪、初速 8 m/s、减摇鳍开启，分别对比目标阻尼比 0.3 与 0.7，各 600 s。',
    suggestion: '增益越高并非必定越好；当鳍角持续触及 25° 限幅或速率极限时，继续加增益只会空耗伺服能量。',
    predictionSpec: {
      kind: 'choice',
      prompt: '运行前预估：在较高海况下把目标阻尼比从 0.3 提高到 0.7，可能发生哪种现象？',
      options: [
        { value: 'diminishing_saturation', label: '请求力矩大幅攀升并频繁触发鳍角/速率限幅，舒适性改善有限而伺服功耗激增' },
        { value: 'linear_halving', label: '横摇幅值严格按比例等幅减半且永不饱和' },
        { value: 'zero_fin_motion', label: '高阻尼比会使减摇鳍动作幅度和伺服能耗反而降低' },
      ],
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成阻尼比 0.3 与 0.7 对照运行后，采集以下对比指标：',
      slots: ([0.3, 0.7] as const).map((ratio) => ({
        id: `damping_${String(ratio).replace('.', '')}`, label: `目标阻尼比 ${ratio}`, conditionHint: '中高海况 · 600 s',
        matcher: (run) => run.initialInput.cruiseFins?.dampingRatio === ratio,
        metrics: [
          { key: 'rollRms', label: '横摇均方根', unit: '°', extract: (r) => extractCruiseMetric(r, 'rollRmsDeg', 3) },
          { key: 'maxFin', label: '最大鳍角', unit: '°', seriesId: 'portFin', pickMode: 'peak', extract: (r) => extractCruiseMetric(r, 'maxFinAbsDeg', 1) },
          { key: 'finWork', label: '鳍伺服电能', unit: 'MJ', extract: (r) => extractCruiseMetric(r, 'finWorkMj', 3) },
        ],
      })),
    },
    interpretationSpec: { checklist: ['记录请求力矩与可用力矩差额', '阐明有限控制能力导致高增益边际递减'], placeholder: '结合饱和告警、磨损积分和横摇均方根降幅，解释为什么工程调参不能只靠盲目调大阻尼增益…' },
  },
];
