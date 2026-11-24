import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import type { StepObservationMetricDef, StepObservationSlotDef, VesselSample, VesselStep } from '../simulations/vessel-experiment';
import type { SketchActualCurveSeries } from './sketch-coordinate-templates';

export type IcebreakerStepWorkbenchSpec = Pick<VesselStep, 'goal' | 'watch' | 'suggestion'> &
  Pick<VesselStep, 'actionSteps' | 'conditionText' | 'predictionSpec' | 'observationSpec' | 'interpretationSpec' | 'sketchSpec'> & {
    reportFieldGuides?: Record<string, string>;
  };

export const choiceOpt = (value: string, label: string, detail?: string) => ({ value, label, detail });

export const met = (
  key: string, label: string, unit?: string, seriesId?: string, pickMode?: StepObservationMetricDef['pickMode'],
  placeholder?: string, extract?: (run: VesselRunSummary) => string | null,
): StepObservationMetricDef => ({ key, label, unit, seriesId, pickMode, placeholder, extract });

export const slot = (
  id: string, label: string, conditionHint: string,
  matcher: ((run: VesselRunSummary) => boolean) | undefined, metrics: StepObservationMetricDef[],
): StepObservationSlotDef => ({ id, label, conditionHint, ...(matcher ? { matcher } : {}), metrics });

export const ticksOf = (vals: number[], fixed?: number) =>
  vals.map((value) => ({ value, label: fixed !== undefined ? value.toFixed(fixed) : String(value) }));

function extractSeriesPoints(samples: VesselSample[], key: string, maxPoints = 320): Array<{ x: number; y: number }> {
  const valid = samples.map((s) => ({ x: s.time, y: s.values[key] })).filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));
  if (valid.length <= maxPoints) return valid;
  const bucketCount = maxPoints - 2;
  const result: Array<{ x: number; y: number }> = [valid[0]];
  for (let b = 0; b < bucketCount; b += 1) {
    const start = 1 + Math.floor((b * (valid.length - 2)) / bucketCount);
    const end = Math.max(start + 1, 1 + Math.floor(((b + 1) * (valid.length - 2)) / bucketCount));
    let peak = valid[start];
    for (let i = start + 1; i < end; i += 1) if (Math.abs(valid[i].y) > Math.abs(peak.y)) peak = valid[i];
    result.push(peak);
  }
  result.push(valid[valid.length - 1]);
  return result;
}

const actualSeries = (samples: VesselSample[], key: string, id: string, label: string): SketchActualCurveSeries[] => {
  const points = extractSeriesPoints(samples, key);
  return points.length < 2 ? [] : [{ id, label, color: '#0ea5e9', points }];
};
export const extractIcebreakerYawRateActualSeries = (samples: VesselSample[]) => actualSeries(samples, 'yawRate', 'actual-yaw-rate', '实测转艏速率 (°/s)');
export const extractIcebreakerIceForceActualSeries = (samples: VesselSample[]) => actualSeries(samples, 'iceForce', 'actual-ice-force', '冰接触纵向阻力真值 (kN)');
export const extractIcebreakerHeadingActualSeries = (samples: VesselSample[]) => actualSeries(samples, 'heading', 'actual-heading', '实测航向量测 (°)');
export const extractWaterSpeedMps = (r: VesselRunSummary) => typeof r.configuration.initialWaterSpeedMps === 'number' ? r.configuration.initialWaterSpeedMps.toFixed(1) : null;
export const extractIceThicknessM = (r: VesselRunSummary) => typeof r.configuration.ice?.thicknessM === 'number' ? r.configuration.ice.thicknessM.toFixed(2) : null;
export const extractIceStrengthMpa = (r: VesselRunSummary) => typeof r.configuration.ice?.flexuralStrengthPa === 'number' ? (r.configuration.ice.flexuralStrengthPa / 1e6).toFixed(2) : null;
export const extractRunEndTimeS = (r: VesselRunSummary) => (r.stoppedAtMs === null ? null : r.lastTimeS.toFixed(1));
export const extractFilterTauS = (r: VesselRunSummary) => typeof r.initialInput.derivativeFilterTauS === 'number' ? r.initialInput.derivativeFilterTauS.toFixed(1) : null;
export function extractGainSummary(run: VesselRunSummary): string | null {
  const kp = Number(run.courseSettings?.kpMultiplier ?? 1);
  const kd = Number(run.courseSettings?.kdMultiplier ?? 1);
  const integralOn = Boolean(run.courseSettings?.integralEnabled);
  const ti = Number(run.courseSettings?.integralTimeS ?? 100);
  if (!Number.isFinite(kp) || !Number.isFinite(kd)) return null;
  return integralOn ? `Kp ${kp.toFixed(1)}× / Kd ${kd.toFixed(1)}× / Ti ${ti.toFixed(0)}s (含积分)` : `Kp ${kp.toFixed(1)}× / Kd ${kd.toFixed(1)}× (无积分)`;
}
const headingLoopMetrics = (first: StepObservationMetricDef): StepObservationMetricDef[] => [
  first, met('heading_peak', '航向峰值', '°', 'heading', 'peak'),
  met('equiv_peak', '等效偏转峰值', '°', 'equivalent', 'peak'), met('heading_steady', '末态航向', '°', 'heading', 'steady'),
];

export const ICEBREAKER_STEP_SPECS_EARLY: Record<number, IcebreakerStepWorkbenchSpec> = {
  1: {
    goal: '辨识双全回转吊舱的矢量推力方向、转艏力臂与六自由度耦合通道，明确其与传统舵船及功率/推力量纲的边界。',
    actionSteps: [
      '运行前在预测区选择双吊舱转向原理及与传统单舵船的本质区别。',
      '点击控制区「开始」运行 60 秒平静开阔水域直航，观察左侧推进器实时读数与航行姿态。',
      '在下方通道配对卡依次完成 6 项物理量归类，填写物理依据后提交。',
    ],
    watch: '左右舷吊舱实际偏转 (°)、轴速 (rpm)、单机推力 (kN)、正机械功率 (MW) 及横摇/纵摇/转艏速率的基准变化。',
    conditionText: '平静无风浪流开阔水域，无测量附加噪声，初始对水航速 4.0 m/s 零偏转直航 60 秒。',
    suggestion: '雪龙2号依赖艉部双全回转吊舱实现推进与转向一体化，全船不设传统独立舵叶；注意区分推力 (kN) 与功率 (MW)。',
    predictionSpec: {
      kind: 'choice',
      prompt: '双全回转吊舱破冰船与传统舵桨船相比，在推进与航向转向通道上的核心结构差异是什么？',
      options: [
        choiceOpt('integrated_azipod', '无传统独立舵叶，由左右双全回转吊舱转向带动推力矢量偏转，兼顾推进与转艏并伴随六自由度耦合', '吊舱既有推进轴向力又产生相对船体纵轴的横向转艏力矩及垂向偏心横摇耦合'),
        choiceOpt('passive_rudder', '吊舱只负责纵向推动，转向完全靠艉部独立的被动平板舵完成', '忽略了雪龙2号双全回转吊舱推进转向一体化特征'),
        choiceOpt('pure_single_dof', '吊舱偏转仅改变纯转艏力矩，推力与机械功率单位可以互相直接等价替换', '混淆了力 (kN) 与功率 (MW) 的物理量纲及空间多自由度耦合'),
      ],
      allowRationale: true, rationalePlaceholder: '结合吊舱布置位置、推力矢量分解与力/功率量纲说明判断依据...',
    },
    observationSpec: {
      kind: 'channel_match',
      prompt: '对照左侧推进器状态面板与实时曲线，将下列 6 个核心物理量匹配至正确的通道定义：',
      pairs: [
        { id: 'port_pod', item: '左舷吊舱偏转 (°)', hint: '艉部左舷全回转推进器', choices: ['偏转矢量同时贡献推力与艏摇力矩', '仅产生纯侧向升力不提供推力', '仅控制船体静态吃水'] },
        { id: 'stbd_pod', item: '右舷吊舱偏转 (°)', hint: '艉部右舷全回转推进器', choices: ['与左舷协同生成等效转向输入并耦合横纵摇', '无推力的传统被动舵叶', '只消除破冰纵摇振荡'] },
        { id: 'thrust_kn', item: '单机推力 (kN)', hint: '推进器流体反作用力', choices: ['力学矢量通道（单位千牛）', '电机输出机械功率（单位兆瓦）', '船体转艏角速度'] },
        { id: 'power_mw', item: '正机械功率 (MW)', hint: '轴转矩与角速度乘积', choices: ['能量传输速率通道（单位兆瓦）', '沿船艏向净推进力（单位千牛）', '推进器角度偏置量'] },
        { id: 'equiv_az', item: '实际等效偏转 (°)', hint: '双吊舱实测方位合成量', choices: ['用于船体转向模型辨识的实际等效输入', '外部海流引起的船体漂角', '冰阻力折算等效角'] },
        { id: 'roll_pitch', item: '横摇与纵摇 (°)', hint: '姿态耦合通道', choices: ['受吊舱垂向偏心力臂耦合影响', '直航与转向中恒定为零', '由独立减摇水翼闭环控制'] },
      ],
    },
    interpretationSpec: {
      checklist: ['明确区分单机推力 (kN) 与正机械功率 (MW)', '说明无传统独立舵叶的双吊舱一体化机理', '解释吊舱偏心推力引发多自由度耦合的成因'],
      placeholder: '结合实测直航读数，阐述双吊舱推进与转向耦合特性及推力、功率的物理量纲边界...',
    },
  },
  2: {
    goal: '实测双吊舱对 ±3° 等效偏转阶跃指令的跟随响应，估计伺服滞后与转向速率限制，并辨识冻结吊舱伺服模型。',
    actionSteps: [
      '运行前判断吊舱执行器面对阶跃方位指令时是否受限于惯性滞后与最大转向速率。',
      '点击「开始」完成 180 秒阶跃运行（t=20 s 偏转 +3°、t=80 s 切至 −3°、t=140 s 回 0°）。',
      '前往「评估」页签选择「等效偏转指令 → 实际偏转」与一阶惯性与时延结构，框选 15–150 s 辨识并冻结伺服模型，再回填下方读数。',
    ],
    watch: '「实际等效偏转量测 (°)」在 t=20 s 与 t=80 s 指令跳变后的爬升斜率限制与收敛滞后，核对最终归零情况。',
    conditionText: '平静无风浪流开阔水域，无测量噪声，初始航速 4.0 m/s，t=20 s 起依次施加 +3°、−3°、0° 等效偏转指令，总时长 180 秒。',
    suggestion: '务必在「评估」页签冻结吊舱伺服模型；后续第 4 步指令级联对照及第 5–19 步闭环预测都依赖这一伺服模型。',
    predictionSpec: {
      kind: 'choice',
      prompt: '当控制指令要求双吊舱方位在 t=20 s 从 0° 瞬时阶跃至 +3° 时，实际等效偏转角如何变化？',
      options: [
        choiceOpt('rate_and_lag', '受伺服机械惯性与最大转向角速率约束，实际等效偏转呈带斜坡与滞后的平滑过渡，无法瞬时跳变', '物理执行器转矩与转动惯量决定了转向角速度存在明确上限'),
        choiceOpt('instant_jump', '实际等效偏转角在 0 秒内立即精确跳变到 +3° 并保持不变', '忽略了伺服驱动动力学与角速率限幅约束'),
        choiceOpt('reverse_move', '吊舱会先向 −3° 反向偏转再回到 0°', '无反向预冲特性，正指令对应正向偏转跟随'),
      ],
      allowRationale: true, rationalePlaceholder: '结合全回转液压/电力回转机构转动惯量与最大转角速率说明依据...',
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '在「评估」页签冻结伺服模型后，从曲线读取实际等效偏转峰值并填入冻结伺服参数：',
      metrics: [
        met('equiv_peak', '实际等效偏转峰值', '°', 'equivalent', 'peak'),
        met('equiv_end', '180 s 末态等效偏转', '°', 'equivalent', 'steady'),
        met('servo_k', '冻结伺服静态增益 K', '°/°', undefined, undefined, '从评估页签冻结模型公式读取'),
        met('servo_t', '冻结伺服时间常数 T', 's', undefined, undefined, '从评估页签冻结模型公式读取'),
        met('servo_delay', '伺服纯时延 L 与速率印象', 's', undefined, undefined, '记录纯时延 L 及指令切换处爬升速率'),
      ],
    },
    interpretationSpec: {
      checklist: ['报告冻结伺服模型的 K、T、L 与拟合残差', '说明执行器角度不能瞬时跳变的速率限制约束', '指出未计及伺服滞后对高速航向闭环稳定裕度的影响'],
      placeholder: '结合 ±3° 切换段曲线斜率与冻结模型参数，解释吊舱伺服惯性与速率限幅在控制回路中的作用...',
    },
  },
  3: {
    goal: '在开阔水域 +3° 等效偏转阶跃下，手绘转艏速率响应预期并辨识冻结「双吊舱等效偏转 → 转艏速率」开水局部模型。',
    actionSteps: [
      '运行前输入预估稳态转艏速率，并在坐标系手绘板绘制 t=20 s 等效偏转 +3° 后的转艏速率曲线。',
      '点击「开始」完成 300 秒开水阶跃运行，并在手绘板核对自动叠加的实测转艏速率曲线。',
      '前往「评估」页签选「双吊舱等效偏转 → 转艏速率」与一阶模型，框选阶跃响应段（如 0–120 s）点击「辨识并冻结模型」，返回本栏引用摘要。',
    ],
    watch: 't=20 s 起转艏速率 (°/s) 的指数上升规律、实际等效偏转作为辨识输入的定义，以及伴随出现的横摇耦合 (°)。',
    conditionText: '平静无风浪流开阔水域，无测量噪声，初始航速 4.0 m/s，t=20 s 自动施加 +3° 双吊舱等效偏转阶跃，总时长 300 秒。',
    suggestion: '船体航向辨识的输入通道是「双吊舱实际等效偏转量测」而非指令角，窗口需覆盖稳态建立前后的清晰过渡段。',
    predictionSpec: {
      kind: 'numeric_target', unit: '°/s', targetPlaceholder: '如 0.85',
      prompt: '预估 4.0 m/s 开水工况下施加 +3° 等效偏转后转艏速率的近似稳态值 (°/s)，并在坐标系手绘响应曲线：',
      allowRationale: true, rationalePlaceholder: '结合一阶转向惯性时间常数与等效偏转增量估算上升快慢及稳态幅值...',
      sketch: {
        mode: 'prediction', plotId: 'time-response', lockPlotId: true,
        label: '运行前手绘预测：t=20 s 等效偏转 +3° 后的转艏速率响应',
        hint: '在 0–300 s、-0.2 至 1.5 °/s 坐标系中从 0 起笔，于 t=20 s 蓝色虚线后画出转艏速率爬升至稳态的曲线。',
        promptFocus: '重点标出 t=20 s 起步延迟/爬升斜率及后续稳态转艏速率平台。',
        coordinateOverride: {
          title: '开阔水域转艏速率阶跃预测坐标系', subtitle: '0–300 s 时域响应（t=20 s 等效偏转 +3°）',
          xMin: 0, xMax: 300, yMin: -0.2, yMax: 1.5, xLabel: '时间 t', yLabel: '转艏速率', xUnit: 's', yUnit: '°/s',
          xTicks: ticksOf([0, 60, 120, 180, 240, 300]), yTicks: ticksOf([-0.2, 0, 0.5, 1.0, 1.5], 1),
          verticalMarkers: [{ value: 20, label: 't=20s 等效偏转 +3°', color: '#0ea5e9' }],
          horizontalMarkers: [{ value: 0, label: '0 °/s 基线', color: '#64748b' }],
        },
        overlayExtractor: extractIcebreakerYawRateActualSeries,
      },
    },
    observationSpec: {
      kind: 'artifact_binding', artifactKind: 'model',
      prompt: '在「评估」页签冻结开水一阶转向模型后，点击下方按钮一键引用局部模型 K、T 与训练残差摘要：',
    },
    interpretationSpec: {
      checklist: ['报告冻结开水模型的 K、T 与残差', '阐明以实际等效偏转作输入的原因', '说明转向伴随的横移与横摇耦合效应'],
      placeholder: '写出冻结的开水局部模型 K、T 与残差数值，分析实际等效偏转输入定义及与横摇/横移通道的耦合机理...',
    },
  },
  4: {
    goal: '在不重拟合的前提下，以第 3 步冻结的开水模型独立验证 −2° 反向阶跃新运行，检验小信号外推精度与非对称残差。',
    actionSteps: [
      '运行前判断基于 +3° 辨识的开水模型直接预测 −2° 反向偏转新运行时的误差特征。',
      '点击「开始」完成 300 秒 −2° 反向偏转开水运行。',
      '前往「评估」页签选中第 3 步开水模型执行独立对照（严禁重新辨识），回到本栏一键引用验证 RMSE 与 FIT。',
    ],
    watch: '预测与实测转艏速率在下降段与末态的贴合度、拟合优度 FIT (%) 及均方根误差 RMSE (°/s)。',
    conditionText: '平静无风浪流开阔水域，无测量噪声，初始航速 4.0 m/s，t=20 s 自动施加 −2° 等效偏转反向阶跃（独立留出验证），总时长 300 秒。',
    suggestion: '禁止使用同一训练序列自证或在本步重拟合；方式 A 检验船体响应，方式 B 级联第 2 步伺服模型可同时检验执行器链精度。',
    predictionSpec: {
      kind: 'choice',
      prompt: '用第 3 步 +3° 数据冻结的开水线性模型，直接预测本步 −2° 反向新运行的转艏速率响应，结果最可能如何？',
      options: [
        choiceOpt('good_fit_small_residual', '整体趋势与稳态符号吻合且 FIT 较高，仅因幅值降速与水动力非线性存在轻微外推残差', '对称水动力小信号范围内线性化近似有效，但大转向角减速与交叉耦合带来微弱偏差'),
        choiceOpt('zero_error_identical', '独立验证集残差严格等于零且与实测曲线完全重合', '真实水动力方程含高阶非线性阻尼与航速耦合，线性低阶模型必有残差'),
        choiceOpt('sign_flipped', '模型预测转艏速率的符号会与实测完全相反', '正向对称双吊舱输入增益符号在反向偏转时依然一致'),
      ],
      allowRationale: true, rationalePlaceholder: '结合小扰动线性化工作点邻域及转向减速非线性耦合解释依据...',
    },
    observationSpec: {
      kind: 'artifact_binding', artifactKind: 'comparison',
      prompt: '在「评估」页签以第 3 步冻结模型运行独立对照后，点击一键引用留出验证集的 RMSE 与 FIT 摘要：',
    },
    interpretationSpec: {
      checklist: ['对比第 3 步训练残差与第 4 步独立验证误差', '解释水动力阻尼与减速耦合引发的残差来源', '明确开水局部模型在小幅值转向内的适用边界'],
      placeholder: '对比训练与独立验证 RMSE/FIT 数据，阐述为何独立留出验证是评估局部模型可信度的必要步骤...',
    },
  },
  5: {
    goal: '基于本人冻结开水模型设计并比较两组不同增益的航向闭环控制器，对比理想模型闭环预测与双吊舱受限实船响应。',
    actionSteps: [
      '运行前判断调高比例增益倍率对 10° 航向阶跃响应速度、超调量及双吊舱动作幅度的影响。',
      '保持控制模式一致（推荐均关闭积分），先以基准倍率（Kp=1.0、Kd=1.0）点击「冻结独立航向预测」后运行 400 秒。',
      '点击「重置」，调整 Kp 或 Kd 倍率（如 Kp=1.8），再次冻结预测并运行 400 秒，随后在下方两槽分别提取实测读数。',
    ],
    watch: '冻结预测曲线与实船航向 (°) 的超调量、调节时间对比，以及等效偏转量测 (°) 是否发生限幅滞后。',
    conditionText: '平静无风浪流开阔水域，无测量噪声，初始航速 4.0 m/s，t=20 s 起 10 秒斜坡转向 +10°，航速 PI 开启，对比两组不同增益方案各 400 秒。',
    suggestion: '两组对比需保持相同的控制模式（同为无积分 PD 或同为含积分 PID）与同一冻结开水模型，且每次启动前必须先冻结预测。',
    predictionSpec: {
      kind: 'choice',
      prompt: '保持同一冻结开水模型与阻尼结构，显著增大比例增益倍率 Kp 时，开阔水域 10° 航向阶跃闭环通常如何变化？',
      options: [
        choiceOpt('faster_more_overshoot', '起步转向加快、调节时间缩短，但超调量增大且易触发吊舱转向速率或偏角限幅，甚至加剧理想预测与实船差异', '比例增益提升提高了闭环带宽，同时对未建模伺服饱和更敏感'),
        choiceOpt('slower_zero_effort', '增大 Kp 会使吊舱偏转角变得更小、航向收敛明显变慢', '与比例反馈放大航向误差驱动力的作用方向相反'),
        choiceOpt('identical_to_ideal', '无论增益多大，双吊舱实船曲线与理想线性闭环预测始终丝毫不差', '忽视了实际双吊舱功率与方位速率约束'),
      ],
      allowRationale: true, rationalePlaceholder: '结合闭环自然频率、阻尼比变化与执行器受限饱和效应说明判断理由...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成两组不同增益倍率的 400 秒闭环运行后，点击各工况槽「一键提取本工况读数」采集实测对比指标：',
      slots: [
        slot('gains_base', '第一组：基准增益设计 (1.0×)', 'Kp=1.0× · Kd=1.0× · 400 s',
          (r) => Math.abs(Number(r.courseSettings?.kpMultiplier ?? 1) - 1) < 1e-6 && Math.abs(Number(r.courseSettings?.kdMultiplier ?? 1) - 1) < 1e-6
            && (!r.courseSettings?.integralEnabled || Math.abs(Number(r.courseSettings?.integralTimeS ?? 100) - 100) < 1e-6),
          headingLoopMetrics(met('gains', '增益配置', undefined, undefined, undefined, undefined, extractGainSummary))),
        slot('gains_alt', '第二组：调整增益对照', '修改 Kp/Kd 倍率 · 400 s',
          (r) => Math.abs(Number(r.courseSettings?.kpMultiplier ?? 1) - 1) >= 1e-6 || Math.abs(Number(r.courseSettings?.kdMultiplier ?? 1) - 1) >= 1e-6
            || (Boolean(r.courseSettings?.integralEnabled) && Math.abs(Number(r.courseSettings?.integralTimeS ?? 100) - 100) >= 1e-6),
          headingLoopMetrics(met('gains', '增益配置', undefined, undefined, undefined, undefined, extractGainSummary))),
      ],
    },
    interpretationSpec: {
      checklist: ['定量对比两组增益的超调量与等效偏转峰值', '分析理想预测与双吊舱受限实际闭环的差异', '确定兼具响应速度与阻尼余量的稳健增益'],
      placeholder: '对比两组控制器在航向超调、稳态偏差与等效偏转代价上的实测差异，解释执行器约束对高增益设计的制约...',
    },
  },
  6: {
    goal: '在 0.5 m/s 极低速与 4.0 m/s 巡航初速下检验开阔水域航向控制能力，对比双吊舱矢量推进与传统舵船低速操控机理差异。',
    actionSteps: [
      '运行前判断双吊舱在 0.5 m/s 极低速下的转艏控制能力，以及沿用 4.0 m/s 开水模型进行预测可能出现的误差。',
      '固定第 5 步控制器增益与模型，依次选择初始航速 4.0 m/s 与 0.5 m/s，每次先点击「冻结独立航向预测」再完成 400 秒运行。',
      '在下方两档航速槽一键提取航向峰值、末态航向与等效偏转，结合机理阐明低速控制特性。',
    ],
    watch: '0.5 m/s 低速工况下等效偏转产生的有效转艏响应，以及 4.0 m/s 冻结模型预测 0.5 m/s 工况时稳态精度与动态速度的偏差。',
    conditionText: '平静无风浪流开阔水域，无测量噪声，t=20 s 起 10 秒斜坡转向 +10°，固定控制器分别测试 0.5 m/s 与 4.0 m/s 初始航速各 400 秒。',
    suggestion: '常规舵船依靠船速来流产生舵升力，0.5 m/s 时几乎失去舵效；而全回转吊舱依靠螺旋桨加速尾流矢量转向，在极低速下仍能控制航向。',
    predictionSpec: {
      kind: 'choice',
      prompt: '当初始航速从 4.0 m/s 降至 0.5 m/s 极低速时，双全回转吊舱控制与传统平板舵船相比最突出的区别是什么？',
      options: [
        choiceOpt('vector_thrust_works', '双吊舱靠螺旋桨射流矢量转向，0.5 m/s 下仍具备强控制能力，而传统舵船舵效按来流速度平方锐减；但局部模型 K/T 仍随工况变化', '主动矢量推进不完全依赖船体前进来流，不过水动力阻尼降低会改变时间常数与稳态转艏响应'),
        choiceOpt('zero_control_at_low', '双吊舱与传统平板舵完全相同，0.5 m/s 时会彻底丧失转艏力矩', '忽视了全回转推进器主动矢量推力的本质优势'),
        choiceOpt('exact_same_kt', '4.0 m/s 与 0.5 m/s 两个工作点的转向增益 K 与时间常数 T 完全一致', '船体纵向来流速度改变会显著影响水动力线性阻尼与横向升力'),
      ],
      allowRationale: true, rationalePlaceholder: '对比螺旋桨主动尾流矢量与被动水翼升力随航速变化的流体动力学差异...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成 4.0 m/s 与 0.5 m/s 两次 400 秒运行后，一键提取各自航向控制表现：',
      slots: [
        slot('speed_40', '4.0 m/s 巡航基准工况', '初始航速 4.0 m/s · 400 s', (r) => r.configuration.initialWaterSpeedMps === 4,
          headingLoopMetrics(met('init_speed', '初始航速', 'm/s', undefined, undefined, undefined, extractWaterSpeedMps))),
        slot('speed_05', '0.5 m/s 极低速工况', '初始航速 0.5 m/s · 400 s', (r) => r.configuration.initialWaterSpeedMps === 0.5,
          headingLoopMetrics(met('init_speed', '初始航速', 'm/s', undefined, undefined, undefined, extractWaterSpeedMps))),
      ],
    },
    interpretationSpec: {
      checklist: ['验证双吊舱在 0.5 m/s 低速下仍能有效转向', '说明低速响应与 4.0 m/s 模型预测之间的工作点偏差', '对比双吊舱矢量推进与常规舵船的工程适用边界'],
      placeholder: '结合 4.0 m/s 与 0.5 m/s 的实际航向响应及模型预测差异，解释低速操纵优势与工况模型外推误差...',
    },
  },
  7: {
    goal: '在开阔水域波浪与测量噪声下对比不同微分滤波时间常数，权衡控制抖动抑制、相位滞后与回转速率平滑度。',
    actionSteps: [
      '运行前判断增大测量微分滤波时间常数对吊舱高频摆动幅度、转艏平稳性及响应滞后的双面效应。',
      '保持模型、增益与航速完全不变，先以 0.2 s 滤波时间常数点击「冻结独立航向预测」并运行 600 秒。',
      '点击「重置」，切换至 1.0 s 或 3.0 s 滤波时间常数，重新冻结预测并运行 600 秒，提取两档实测对照。',
    ],
    watch: '「实际等效偏转量测 (°)」的高频毛刺振荡、「转艏速率量测 (°/s)」起伏与航向跟踪平滑度。',
    conditionText: '开阔水域轻度不规则波浪干扰并叠加测量噪声，初始航速 4.0 m/s，t=20 s 起 10 秒斜坡转向 +10°，固定控制器对比至少两档微分滤波时间常数各 600 秒。',
    suggestion: '必须保证两次运行除「测量微分滤波 / s」外其余控制参数完全一致，且每档切换后先重新冻结独立航向预测再启动。',
    predictionSpec: {
      kind: 'choice',
      prompt: '面对叠加波浪扰动与传感器高频噪声的航向量测，把微分滤波时间常数由 0.2 s 增大至 3.0 s 会带来什么权衡？',
      options: [
        choiceOpt('smooth_vs_lag', '有效滤除波频与噪声引发的吊舱高频摆动与机械磨耗，但引入显著相位滞后可能放大超调或拖慢调节', '低通滤波在衰减高频微分噪声增益的同时不可避免地损失控制相位裕度'),
        choiceOpt('zero_lag_zero_noise', '既彻底消除全部吊舱抖动，又没有任何相位延迟或超调变化', '线性滤波器必然在抑制幅值与引入相移之间存在权衡'),
        choiceOpt('amplify_noise', '滤波时间常数越大，微分环节放大的高频传感器噪声反而越剧烈', '一阶低通环节随时间常数增大而降低截止频率，从而削弱高频透传'),
      ],
      allowRationale: true, rationalePlaceholder: '结合微分项对高频传感器噪声的放大特性与相位滞后对阻尼的影响说明依据...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成至少两档滤波时间常数的 600 秒运行后，一键提取各自等效偏转峰值、转艏速率与稳态航向：',
      slots: [
        slot('filter_fast', '弱滤波档（0 或 0.2 s）', '滤波时间常数 ≤ 0.2 s · 600 s', (r) => (r.initialInput.derivativeFilterTauS ?? 0.2) <= 0.2, [
          met('filter_tau', '滤波时间常数', 's', undefined, undefined, undefined, extractFilterTauS),
          met('equiv_peak', '等效偏转峰值', '°', 'equivalent', 'peak'), met('yaw_peak', '转艏速率峰值', '°/s', 'yawRate', 'peak'),
          met('heading_steady', '末态航向', '°', 'heading', 'steady'),
        ]),
        slot('filter_smooth', '强滤波档（1.0 或 3.0 s）', '滤波时间常数 ≥ 1.0 s · 600 s', (r) => (r.initialInput.derivativeFilterTauS ?? 0.2) >= 1, [
          met('filter_tau', '滤波时间常数', 's', undefined, undefined, undefined, extractFilterTauS),
          met('equiv_peak', '等效偏转峰值', '°', 'equivalent', 'peak'), met('yaw_peak', '转艏速率峰值', '°/s', 'yawRate', 'peak'),
          met('heading_steady', '末态航向', '°', 'heading', 'steady'),
        ]),
      ],
    },
    interpretationSpec: {
      checklist: ['对比两档滤波下等效偏转抖动幅度与稳态航向', '阐明噪声抑制与控制相位滞后的物理权衡', '给出平衡执行器疲劳与航向精度的选型结论'],
      placeholder: '结合波浪加噪声工况实测曲线，分析增大微分滤波时间常数在平抑吊舱动作与增加闭环超调滞后间的折中...',
    },
  },
  8: {
    goal: '在 0.30 m 平整冰区开展直航入冰试验，手绘预测冰接触纵向阻力历程，标定首次冰接触时刻并核对六自由度动力学响应。',
    actionSteps: [
      '运行前在预测区选择入冰后多通道耦合响应判断，并在下方坐标系手绘 0–1200 秒冰接触纵向阻力预期曲线。',
      '点击「开始」以 1.0 m/s 初速直航入冰完成运行（到达北向 800 m 或 1200 s 结束），观察手绘板自动叠合的实测阻力曲线。',
      '前往「评估」页签点击「定位首次接触前后1秒」读取首次接触时刻，回填阻力峰值、航速及横纵摇读数。',
    ],
    watch: '船艏进入北向 200 m 冰缘瞬间，冰接触纵向阻力跃升、对水航速下降、纵摇抬艏、横摇晃动及破碎面积累计变化。',
    conditionText: '无风浪流、无测量噪声平整冰区（北向 200–700 m，冰厚 0.30 m、抗弯强度 0.50 MPa），初始航速 1.0 m/s 直航，最长 1200 秒或抵达 800 m。',
    suggestion: '入冰接触绝不只是航向时间常数的变化，冰力实时作用在船体纵荡、横荡、垂荡、横摇、纵摇与艏摇六个自由度上。',
    predictionSpec: {
      kind: 'choice',
      prompt: '当破冰船以 1.0 m/s 从开阔水驶入 0.30 m 平整冰区发生首次船冰接触时，船体各通道将呈现何种响应？',
      options: [
        choiceOpt('ice_6dof_coupling', '冰接触纵向阻力陡增并伴有锯齿脉动，使对水航速迅速下降，同时船艏倾斜挤压激发纵摇与横摇多自由度响应', '冰力通过船体三维水线面法向压碎与弯折力臂同时作用于六自由度运动方程'),
        choiceOpt('only_kt_color', '仅转向模型的系数符号微变，航速、横摇与纵摇在入冰前后全程保持完全恒定', '忽视了冰接触载荷对纵向减速、垂向抬艏与横向滚转的真实物理耦合'),
        choiceOpt('speed_increases', '冰板挤压反作用力会推动船体加速前进，使航速高于 1.0 m/s', '破冰与碎冰清排始终消耗船体动能并形成巨大附加阻力'),
      ],
      allowRationale: true, rationalePlaceholder: '结合船艏斜坡破冰受力分解与六自由度耦合阐明预期变化...',
      sketch: {
        mode: 'prediction', plotId: 'time-response', lockPlotId: true,
        label: '运行前手绘预测：入冰过程冰接触纵向阻力历程 (0–1200 s)',
        hint: '在 0–1200 s、-50 至 2500 kN 坐标系中画出入冰前 0 kN 平直段，以及入冰接触过渡区起始后锯齿上升与离冰回落趋势。',
        promptFocus: '标出入冰接触过渡区间的阻力跃升起始时刻、锯齿波动包络与出冰回落段。',
        coordinateOverride: {
          title: '入冰接触纵向阻力预测坐标系', subtitle: '0–1200 s 时域历程（北向 200–700 m 平整冰区）',
          xMin: 0, xMax: 1200, yMin: -50, yMax: 2500, xLabel: '时间 t', yLabel: '冰接触纵向阻力', xUnit: 's', yUnit: 'kN',
          xTicks: ticksOf([0, 200, 400, 600, 800, 1000, 1200]), yTicks: ticksOf([0, 500, 1000, 1500, 2000, 2500]),
          verticalMarkers: [{ value: 140, label: '入冰接触过渡起始', color: '#0ea5e9' }, { value: 700, label: '冰区后段过渡', color: '#f59e0b' }],
          horizontalMarkers: [{ value: 0, label: '0 kN 开水基线', color: '#64748b' }],
        },
        overlayExtractor: extractIcebreakerIceForceActualSeries,
      },
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '运行结束后前往「评估」页签点击「定位首次接触前后1秒」读取接触时刻，并从曲线读取阻力、航速与横纵摇指标：',
      metrics: [
        met('first_contact_s', '首次冰接触时刻', 's', undefined, undefined, '在评估页签点击「定位首次接触前后1秒」读取'),
        met('ice_force_peak', '冰接触纵向阻力峰值', 'kN', 'iceForce', 'peak'),
        met('speed_steady', '入冰通行末态航速', 'm/s', 'speed', 'steady'),
        met('roll_peak', '入冰过程横摇峰值', '°', 'roll', 'peak'),
        met('pitch_peak', '入冰过程纵摇峰值', '°', 'pitch', 'peak'),
      ],
    },
    interpretationSpec: {
      checklist: ['标明实测首次接触时刻与入冰前后航速变化', '分析冰力引起的纵摇、横摇与纵向减速六自由度特征', '对照手绘曲线阐述实际锯齿冰阻与开水阻力的机理差异'],
      placeholder: '结合首次接触时刻与实测多通道响应，解释船冰接触如何同时作用于纵向推进与六自由度姿态...',
    },
  },
  9: {
    goal: '复用第 8 步入冰高采样记录，展开一次压碎—弯折—滑移事件并核对接触力、力矩与各类耗散功守恒。',
    actionSteps: [
      '运行前先在预测区判断高频冰阻力脉冲与多类耗散功产生的力学因果链。',
      '前往右侧「评估」页签打开第 8 步运行记录，点击「定位首次接触前后1秒」，依次切换「接触力真值」「接触力矩真值」与「累计功与耗散真值」。',
      '在下方引用关联证据摘要并在备注栏记录压碎、弯折、摩擦、水阻耗散与船体/浮冰接触功读数后提交（本步无需新运行）。',
    ],
    watch: '1 秒局部事件窗口内纵向/横向/垂向峰值力 (kN)、三轴接触力矩 (MN·m)，以及压碎、弯折、摩擦、浮冰水阻耗散与接触功 (MJ) 的累计值。',
    conditionText: '复用第 8 步 0.30 m 平整冰区实测记录开展离线接触事件与能量核对（本步为分析步，无需启动新仿真）。',
    suggestion: '切勿将锯齿状接触载荷误认为随机噪声；每次尖峰上升对应冰板局部压碎接触面积增大，陡降则对应触发弯曲断裂卸荷。',
    predictionSpec: {
      kind: 'choice',
      prompt: '第 8 步入冰过程中观测到的锯齿状高频力脉冲与能量消耗，其真实力学来源是什么？',
      options: [
        choiceOpt('crushing_bending_slip', '船体与冰缘间周期性的挤压压碎—弯折断裂—碎冰滑移清排过程，伴随压碎、弯折、摩擦与浮冰水阻耗散做功', '每次接触力爬升与断裂卸荷均由船冰几何侵入深度和冰抗弯强度共同触发'),
        choiceOpt('random_script_pulse', '后台在固定时间戳随机叠加的伪脉冲序列，与船舶位置及冰参数无关', '接触脉冲严格来源于三维水线接触几何与断裂力学积分'),
        choiceOpt('zero_dissipation', '破冰过程属于完全弹性碰撞，所有接触功在离冰后全额返还船体动能', '冰体压碎、断裂与浮冰水阻均为不可逆机械能消耗过程'),
      ],
      allowRationale: true, rationalePlaceholder: '结合压碎加载、弯折极限断裂及浮冰滑移耗散四条能量路径说明理由...',
    },
    observationSpec: {
      kind: 'artifact_binding', artifactKind: 'capacity',
      prompt: '在「评估」页签核对第 8 步首次接触窗的力/力矩峰值及压碎、弯折、摩擦、水阻耗散与接触功后，可引用已有对比摘要并在备注中逐项记下实际能量与力读数：',
      placeholder: '请填入第 8 步首次接触窗口实测：峰值纵向/垂向力(kN)、纵摇/横摇力矩(MN·m)，压碎/弯折/摩擦/水阻耗散与船体/浮冰接触功(MJ)...',
    },
    interpretationSpec: {
      checklist: ['还原一次压碎—弯折—滑移事件中力与力矩变化顺序', '写出压碎、弯折、摩擦、浮冰水阻与接触功的量级关系', '证明接触载荷脉动源自真实破冰力学而非人工随机脚本'],
      placeholder: '结合第 8 步高采样接触力、力矩与各类累计功数值，详细说明破冰机械能消耗与接触断裂物理因果...',
    },
  },
  10: {
    goal: '在 0.60 m 平整冰区沿用第 3 步开水模型执行闭环运行与独立对照，定位模型失配时间段并手绘分析航向响应偏差机理。',
    actionSteps: [
      '运行前在预测区判断开水冻结模型迁移到 0.60 m 冰区后发生失配的时段特征。',
      '选中第 3 步开水航向模型，点击「冻结独立航向预测」后运行 0.60 m 冰区试验（最长 1200 s 或抵达 800 m）。',
      '前往「评估」页签选用第 3 步开水模型运行本步独立对照（严禁重拟合），在下方指标卡填写失配时刻与 RMSE/FIT，并在「分析对照手绘板」完成轨迹对比标注。',
    ],
    watch: '开水段与入冰接触后的响应分离点、开水模型对照中实测与预测航向/转艏速率的偏差扩大区，以及实际冰阻对航速的压制。',
    conditionText: '无风浪流、无测量噪声平整冰区（冰厚 0.60 m、抗弯强度 0.50 MPa），初始航速 1.0 m/s，闭环沿用第 3 步开水模型（无速度 PI），最长 1200 秒。',
    suggestion: '本步禁止重新辨识新模型！如实定位开阔水模型入冰后何处失效，这是第 11 步在冰区重辨识局部模型的直接实证前提。',
    predictionSpec: {
      kind: 'choice',
      prompt: '把第 3 步 4.0 m/s 开阔水域辨识的航向模型直接用于 0.60 m 平整冰区独立对照时，误差最可能在何时显著放大？',
      options: [
        choiceOpt('mismatch_after_ice_entry', '开水推进段偏差较小，一旦船艏接触 0.60 m 冰板且航速、冰阻与接触力矩剧变，模型预测与实船迅速出现显著失配', '冰接触外力矩与高阻尼使实际被控对象动力学显著偏离开阔水工作点'),
        choiceOpt('constant_zero_error', '因为双吊舱本身未更换，开水模型在 0.60 m 冰区下的 FIT 依然接近 100%', '忽略了外部冰接触力矩与船体降速对航向传递特性的本质改变'),
        choiceOpt('mismatch_only_at_t0', '仅在开水起步前 10 秒有误差，进入厚冰区后模型反而变得无比精确', '入冰后未建模冰载荷与时变耦合才是最主要失配源'),
      ],
      allowRationale: true, rationalePlaceholder: '结合入冰时刻位置、对水航速衰减与冰接触偏航力矩解释模型失配区间...',
    },
    sketchSpec: {
      mode: 'analysis', plotId: 'time-response', lockPlotId: true,
      label: '分析对照手绘：本人冻结模型预测 vs 0.60 m 冰区实测航向响应对比',
      hint: '坐标系横轴 0–1200 s、纵轴航向响应 -10° 至 +25°（标注 t=20 s 参考）。请对比绘制开水冻结模型预期（主笔）与入冰后实测偏移/失配走势（对比笔），完成后点击「识图核验」叠加模型解析参考。',
      promptFocus: '重点标出开水段与入冰失配段之间的航向斜率、波动分岔及模型有效域边界。',
      coordinateOverride: {
        title: '入冰模型失配与航向响应分析坐标系', subtitle: '0–1200 s 时域对比（开水冻结模型预测 vs 冰区实测）',
        xMin: 0, xMax: 1200, yMin: -10, yMax: 25, xLabel: '时间 t', yLabel: '航向响应', xUnit: 's', yUnit: '°',
        xTicks: ticksOf([0, 200, 400, 600, 800, 1000, 1200]), yTicks: ticksOf([-10, 0, 10, 20, 25]),
        verticalMarkers: [{ value: 20, label: 't=20s 航向阶跃 +10°', color: '#0ea5e9' }],
        horizontalMarkers: [{ value: 0, label: '0° 航向基线', color: '#64748b' }],
      },
      overlayExtractor: extractIcebreakerHeadingActualSeries,
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '在「评估」页签以第 3 步开水模型完成独立对照后，记录失配起始时刻与验证误差，并从曲线读取冰阻、航速与航向：',
      metrics: [
        met('mismatch_start_s', '显著失配起始时刻', 's', undefined, undefined, '对照曲线读取入冰失配起点（约 140–200 s）'),
        met('open_rmse', '开水模型独立对照 RMSE', '°/s', undefined, undefined, '从评估页签对照指标读取'),
        met('open_fit', '开水模型独立对照 FIT', '%', undefined, undefined, '从评估页签对照指标读取'),
        met('ice_force_peak', '冰接触纵向阻力峰值', 'kN', 'iceForce', 'peak'),
        met('end_speed', '末态对水航速', 'm/s', 'speed', 'steady'),
        met('end_heading', '末态航向量测', '°', 'heading', 'steady'),
      ],
    },
    interpretationSpec: {
      checklist: ['定位并定量描述开水模型失配时间段', '给出独立对照的 RMSE/FIT 与实测航速降幅', '论证工况改变导致原局部模型有效域失效的因果机制'],
      placeholder: '结合失配时刻、对照误差与画板分析，说明为什么必须针对冰区工作点重新辨识局部航向模型...',
    },
  },
};
