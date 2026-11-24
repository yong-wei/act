import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import type {
  StepInterpretationSpec,
  StepObservationSlotDef,
  StepObservationSpec,
  StepPredictionSpec,
  StepSketchSpec,
  VesselSample,
} from '../simulations/vessel-experiment';
import type { SketchActualCurveSeries } from './sketch-coordinate-templates';

export interface DestroyerStepWorkbenchSpec {
  seq: number;
  goal: string;
  actionSteps: string[];
  watch: string;
  conditionText: string;
  suggestion: string;
  predictionSpec?: StepPredictionSpec;
  observationSpec?: StepObservationSpec;
  interpretationSpec?: StepInterpretationSpec;
  sketchSpec?: StepSketchSpec;
}

export const choiceOpt = (value: string, label: string, detail: string) => ({ value, label, detail });

export const ticksOf = (vals: number[], fixed?: number) =>
  vals.map((value) => ({ value, label: fixed !== undefined ? value.toFixed(fixed) : String(value) }));

export function extractDestroyerYawRateOverlay(samples: VesselSample[]): SketchActualCurveSeries[] {
  const points = samples
    .filter((sample) => sample.time >= 0 && sample.time <= 300)
    .map((sample) => ({ x: sample.time, y: sample.values.yawRate }))
    .filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));
  return points.length < 2
    ? []
    : [{ id: 'destroyer-actual-yaw-rate', label: '实测转艏速率 (°/s)', color: '#06b6d4', points }];
}

export function extractDestroyerHeadingOverlay(samples: VesselSample[], maxTimeS = 500): SketchActualCurveSeries[] {
  const points = samples
    .filter((sample) => sample.time >= 0 && sample.time <= maxTimeS)
    .map((sample) => ({ x: sample.time, y: sample.values.actualHeading }))
    .filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));
  return points.length < 2
    ? []
    : [{ id: 'destroyer-actual-heading', label: '实测实际航向 (°)', color: '#06b6d4', points }];
}

export function extractDestroyerKpMultiplier(run: VesselRunSummary): number | null {
  const value = run.courseSettings?.kpMultiplier;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function step7SpeedSlot(id: string, label: string, speedMps: number): StepObservationSlotDef {
  return {
    id,
    label,
    conditionHint: `初始航速 ${speedMps} m/s · +5° 舵阶跃`,
    matcher: (r) => Number(r.configuration.initialWaterSpeedMps) === speedMps,
    metrics: [
      { key: 'init_speed', label: '初始航速', unit: 'm/s', extract: (r) => r.configuration.initialWaterSpeedMps?.toFixed(1) ?? null },
      { key: 'steady_yaw_rate', label: '稳态转艏速率', unit: '°/s', seriesId: 'yawRate', pickMode: 'steady' },
      { key: 'model_k', label: '冻结模型 K', unit: '1/s', placeholder: '见评估页签' },
      { key: 'model_t', label: '冻结模型 T', unit: 's', placeholder: '见评估页签' },
    ],
  };
}

export const DESTROYER_STEP_SPECS_EARLY: readonly DestroyerStepWorkbenchSpec[] = [
  {
    seq: 1,
    goal: '辨析舵指令、实际舵角、转艏速率、航向、对水航速与横摇耦合通道的因果顺序及单位，区分控制输入与船体姿态响应。',
    actionSteps: [
      '在预测区选定手操舵角变化时最先响应的物理量与逐级传导顺序。',
      '点击控制区「开始」，在 60 秒内轻打手操舵角并切换左侧曲线观察各通道响应。',
      '完成下方 6 项通道角色配对，明确为何不能把航向角或横摇姿态当成舵角输入。',
    ],
    watch: '手操舵角指令、实际舵角、转艏速率 (°/s)、实际航向 (°)、航速 (m/s) 的启动先后顺序与正负方向，以及舵偏引发的横倾耦合。',
    conditionText: '平静无风浪无海流环境，无传感附加噪声，初始对水航速 8 m/s，手操操舵模式，总时长 60 秒。',
    suggestion: '重点沿着“舵指令 → 实际舵角 → 转艏速率 → 航向”的传导链对比各通道单位，切勿混淆姿态输出与控制输入。',
    predictionSpec: {
      kind: 'choice',
      prompt: '运行前预估：当手操舵角施加阶跃变化时，哪个物理量最先变化，后续按什么顺序传导？',
      options: [
        choiceOpt('command_servo_yaw_heading', '手操舵指令最先阶跃，实际舵角经舵机滞后跟随，随后激发转艏速率并积分改变航向', '控制指令先于机械偏转，舵叶产生水动力转矩带动转艏速率，转艏速率对时间积分形成航向变化'),
        choiceOpt('heading_instant', '航向角在舵指令变化瞬间直接跳变到位，不受舵机跟随与船体惯性约束', '忽视了舵机物理作动速率限制及船体转动惯量对航向的二阶积分效应'),
        choiceOpt('roll_is_rudder', '横摇角与舵角始终大小相等且物理意义相同，可互为控制输入', '混淆了执行器偏转输入通道与多自由度横倾姿态耦合通道'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合舵机随动过程与角速率积分关系简述传导链依据...',
    },
    observationSpec: {
      kind: 'channel_match',
      prompt: '对照左侧实时读数与曲线开关，将下列 6 个物理通道与其在航向控制中的角色配对：',
      pairs: [
        { id: 'manual_rudder', item: '手操舵角 / 舵指令 (°)', choices: ['控制输入指令 (°)', '执行器实际位置 (°)', '船体航向角输出 (°)'], hint: '操控台发出的期望舵角' },
        { id: 'actual_rudder', item: '实际舵角 (°)', choices: ['控制输入指令 (°)', '执行器实际位置 (°)', '船体横摇姿态角 (°)'], hint: '舵叶编码器反馈角度' },
        { id: 'yaw_rate', item: '转艏速率 (°/s)', choices: ['角速率状态量 (°/s)', '航向角度积分量 (°)', '执行器实际位置 (°)'], hint: '船体绕竖轴转动快慢' },
        { id: 'heading', item: '航向角 (°)', choices: ['航向角度积分输出 (°)', '角速率状态量 (°/s)', '舵机输入指令 (°)'], hint: '转艏速率对时间的积分' },
        { id: 'speed', item: '对水航速 (m/s)', choices: ['纵向前进速度 (m/s)', '转艏角速率 (°/s)', '舵角反馈信号 (°)'], hint: '计程仪测得的前进速度' },
        { id: 'roll', item: '横摇角 (°)', choices: ['转向横倾耦合姿态 (°)', '舵角反馈输入 (°)', '航向积分输出 (°)'], hint: '舵力与离心力耦合横倾' },
      ],
    },
    interpretationSpec: {
      checklist: ['写清输入、状态与输出各自物理单位', '阐述舵角至航向角的级联传导关系', '说明不可将姿态角等同于舵角的原因'],
      placeholder: '总结各控制与量测通道的单位和因果传导关系，解释为何横摇角等船体姿态不能视为舵角输入...',
    },
  },
  {
    seq: 2,
    goal: '在给定阶跃舵指令下测量舵机随动过程，通过两点坐标估计舵机时间常数与最大操舵速率上限。',
    actionSteps: [
      '运行前在预测区填写预估舵机等效时间常数并简述判断依据。',
      '点击「开始」完成 120 秒自动舵阶跃运行（t=20 s 舵指令 +5°，t=60 s 回 0°）。',
      '利用下方「量测窗口与两点依据」拖选爬升段窗口获取两点读数，填写时间常数与舵速估计，并前往「评估」页签冻结舵机模型。',
    ],
    watch: 't=20 s 舵指令跃升至 +5° 及 t=60 s 回零时，实际舵角的起始斜坡限速段、到达 63.2% 稳态值的耗时及稳态跟随精度。',
    conditionText: '平静无风浪无海流环境，无传感附加噪声，初始对水航速 8 m/s，t=20 s 自动施加 +5° 舵指令、t=60 s 回零，总时长 120 秒。',
    suggestion: '将量测窗口起点对准 t=20 s 跃升沿、终点置于斜坡上升段或 63.2% 处可读出速率与时间常数，并请务必在「评估」页签冻结舵机模型。',
    predictionSpec: {
      kind: 'numeric_target',
      unit: 's',
      targetPlaceholder: '如 1.2',
      prompt: '预估舵机响应 +5° 舵指令阶跃时的等效一阶时间常数 (s)，并说明舵指令与实际舵角偏离的原因：',
      allowRationale: true,
      rationalePlaceholder: '结合液压/电动随动机构惯性与最大舵速限幅说明动态滞后特性...',
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '在「量测窗口与两点依据」采集爬升段两点后，拾取舵机阶跃稳态特性，并在「评估」页签冻结舵机模型：',
      metrics: [
        { key: 'steadyRudderDeg', label: '稳态实际舵角', unit: '°', seriesId: 'rudder', pickMode: 'steady', placeholder: '点击从当前曲线读取' },
        { key: 'peakYawRateDegS', label: '峰值转艏速率', unit: '°/s', seriesId: 'yawRate', pickMode: 'peak', placeholder: '点击从当前曲线读取' },
      ],
    },
    interpretationSpec: {
      checklist: ['依据窗口两点读数说明舵机时间常数与速率上限估算过程', '区分舵指令阶跃与实际舵角随动差异', '确认已在评估页签冻结舵机模型'],
      placeholder: '结合两点读数说明如何计算时间常数与舵速上限，阐述忽略执行器动态对高频控制分析的影响...',
    },
  },
  {
    seq: 3,
    goal: '观察 +5° 舵角持续阶跃下的转艏速率趋稳特性与航向积分增长规律，确认以实际舵角作为船体局部模型输入。',
    actionSteps: [
      '运行前填写预期稳态转艏速率，并在时域坐标系手绘 t=20 s 起 +5° 舵阶跃后的转艏速率响应后点击「识图核验」。',
      '点击「开始」运行完整 300 秒 +5° 舵阶跃，运行后开关实测曲线叠合对照手绘预期。',
      '点击下方「从当前曲线读取」采集稳态转艏速率、实际舵角与末态航向，保留轨迹供第 4 步辨识。',
    ],
    watch: 't=20 s 后转艏速率先经舵机随动滞后、再指数爬升并稳定在平台值，同时实际航向以近似恒定斜率单调累加增长。',
    conditionText: '平静无风浪无海流环境，无传感附加噪声，初始对水航速 8 m/s，t=20 s 自动施加并保持 +5° 舵阶跃，总时长 300 秒。',
    suggestion: '切勿混淆稳态有界的转艏速率通道与含积分环节的航向角通道；本步轨迹将作为第 4 步辨识 8 m/s 船体模型的训练集。',
    predictionSpec: {
      kind: 'numeric_target',
      unit: '°/s',
      targetPlaceholder: '如 0.45',
      prompt: '预估 +5° 舵阶跃达到稳态后的转艏速率 (°/s)，并在坐标系中手绘 0–300 s 转艏速率曲线：',
      allowRationale: true,
      rationalePlaceholder: '说明水动力阻尼平衡舵力矩使转艏速率趋于稳态、航向对时间积分持续增长的机理...',
      sketch: {
        mode: 'prediction',
        plotId: 'time-response',
        lockPlotId: true,
        label: '运行前手绘预测：+5° 舵阶跃下的转艏速率响应',
        hint: '以 t=20 s 蓝虚线为阶跃起点，从 0 °/s 起笔描绘包含起步随动滞后与一阶趋稳的转艏速率轨迹。',
        promptFocus: '关注 t=20s 舵阶跃 +5° 后的上升过渡快慢与稳态平台高度。',
        coordinateOverride: {
          title: '转艏速率阶跃响应预测坐标系',
          subtitle: '0–300 s 时域响应（t=20 s 舵阶跃 +5°）',
          xMin: 0, xMax: 300, yMin: -0.2, yMax: 1.5,
          xLabel: '时间 t', yLabel: '转艏速率', xUnit: 's', yUnit: '°/s',
          xTicks: ticksOf([0, 60, 120, 180, 240, 300]),
          yTicks: ticksOf([-0.2, 0.2, 0.6, 1.0, 1.4], 1),
          verticalMarkers: [{ value: 20, label: 't=20s 舵阶跃 +5°', color: '#0ea5e9' }],
          horizontalMarkers: [{ value: 0, label: '0 基线', color: '#64748b' }],
        },
        overlayExtractor: (samples) => extractDestroyerYawRateOverlay(samples),
      },
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '300 秒运行结束后，点击「从当前曲线读取」采集稳态转艏速率、稳态实际舵角与末态航向：',
      metrics: [
        { key: 'steadyYawRateDegS', label: '所选稳态窗口的转艏速率', unit: '°/s', seriesId: 'yawRate', pickMode: 'steady', placeholder: '点击从当前曲线读取' },
        { key: 'steadyRudderDeg', label: '稳态实际舵角', unit: '°', seriesId: 'rudder', pickMode: 'steady', placeholder: '点击从当前曲线读取' },
        { key: 'endHeadingDeg', label: '300 s 末实际航向角', unit: '°', seriesId: 'actualHeading', pickMode: 'steady', placeholder: '点击从当前曲线读取' },
      ],
    },
    interpretationSpec: {
      checklist: ['对比转艏速率一阶响应与航向积分响应形态', '复盘手绘预测与实测叠合偏差', '说明第 4 步选择实际舵角作船体输入的物理原因'],
      placeholder: '对比手绘预期与实测转艏速率曲线，解释一阶转艏速率响应与积分航向响应的本质差异及实际舵角选型依据...',
    },
  },
  {
    seq: 4,
    goal: '基于第 3 步阶跃响应拖选有效辨识窗口，剔除启动伺服畸变段或按物理输入辨识并冻结 8 m/s 船体局部模型。',
    actionSteps: [
      '前往右侧「评估」页签，选用第 3 步 +5° 舵阶跃运行，核对量测通道为「实际舵角 → 转艏速率」。',
      '将分析窗口起点设在 t=20 s 之后的有效阶跃段（比较一阶与二阶拟合残差），点击「辨识并冻结模型」。',
      '回到本栏点击「一键引用已冻结工件摘要」绑定模型公式与残差，并阐明物理输入与窗口处理依据。',
    ],
    watch: '不同窗口起止时间与一阶/二阶结构下模型增益 K、时间常数 T 及拟合残差均方根的变化。',
    conditionText: '分析第 3 步 8 m/s 工况 +5° 舵阶跃历史记录（无需重新运行仿真），辨识并冻结船体局部模型。',
    suggestion: '严禁抄录任何参考或默认数值；以实际舵角为输入可避免把舵机延迟混入船体惯性模型，请记录清楚窗口选择依据。',
    observationSpec: {
      kind: 'artifact_binding',
      artifactKind: 'model',
      prompt: '在「评估」页签选定第 3 步运行窗口并冻结 8 m/s 船体模型后，点击下方按钮引用模型参数与残差：',
    },
    interpretationSpec: {
      checklist: ['写明冻结模型的增益 K、时间常数 T 及物理单位', '说明选择实际舵角输入与伺服启动段处理的依据', '界定 8 m/s 小信号模型工作点范围'],
      placeholder: '写出本人冻结船体模型的参数数值、单位与训练残差均方根，说明所选窗口起止时刻与伺服初始段处理原因...',
    },
  },
  {
    seq: 5,
    goal: '利用第 4 步已冻结模型对未见 −3° 反向小舵阶跃实施独立留出验证（严禁重拟合），检验正负向小信号外推有效域。',
    actionSteps: [
      '运行前在预测区判断 8 m/s 正向模型外推预测 −3° 反向阶跃时的偏差特性。',
      '点击「开始」完成 300 秒 −3° 舵阶跃独立验证运行。',
      '前往「评估」页签选用第 4 步已冻结模型保存「A · 实际执行器量测驱动船体模型」对照，再回本栏引用验证误差。',
    ],
    watch: '反向 −3° 舵阶跃期间实际转艏速率与冻结模型预测曲线的波形贴合度、验证 RMSE 与 FIT 百分比。',
    conditionText: '平静无风浪无海流环境，无传感附加噪声，初始对水航速 8 m/s，t=20 s 自动施加 −3° 反向小舵阶跃，总时长 300 秒。',
    suggestion: '本步必须选用在本次验证运行开始前已经冻结的第 4 步模型执行独立对照，禁止对验证集重新拟合模型参数。',
    predictionSpec: {
      kind: 'choice',
      prompt: '运行前预估：将第 4 步基于 +5° 舵阶跃冻结的 8 m/s 线性模型直接外推至 −3° 反向小舵阶跃时，预测精度如何？',
      options: [
        choiceOpt('symmetric_valid_small_signal', '同属 8 m/s 小信号线性邻域且左右舷水动力近似对称，预测轨迹与实测高度吻合，仅留有轻微非线性残差', '左右对称船体在小舵角区间内的局部线性增益 K 与时间常数 T 对正负输入均成立'),
        choiceOpt('reverse_fails_completely', '正向模型对负舵角输入必然出现符号相反或彻底发散的预测结果', '线性时不变模型按输入符号成比例缩放输出响应'),
        choiceOpt('exact_zero_validation_error', '验证集 RMSE 必然严格等于 0.0000，没有任何残差', '真实非线性流体力学与耦合自由度使线性模型总存在有限逼近残差'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合船体左右对称性与小扰动线性有效邻域说明判断依据...',
    },
    observationSpec: {
      kind: 'artifact_binding',
      artifactKind: 'comparison',
      prompt: '在「评估」页签用第 4 步冻结模型保存本步独立船体模型对照后，点击引用验证 RMSE 与 FIT 摘要：',
    },
    interpretationSpec: {
      checklist: ['对比第 4 步训练残差与第 5 步留出验证 RMSE/FIT', '说明训练集与验证集分离及正负小信号对称性', '明确给出是否通过 8 m/s 小信号有效域验证的判断'],
      placeholder: '结合独立对照 RMSE、FIT 与残差走势，论证第 4 步模型在反向小舵阶跃下的外推可靠性与有效边界...',
    },
  },
  {
    seq: 6,
    goal: '在 +20° 大舵角阶跃下检验小信号线性模型的非线性偏离方向，至少定位一项失效的线性建模假设。',
    actionSteps: [
      '运行前在预测区判断小信号模型外推预测 +20° 大舵角响应时的系统性偏离方向。',
      '点击「开始」完成 300 秒 +20° 大舵阶跃运行，留意航速跌落与横摇耦合变化。',
      '前往「评估」页签以第 4 步冻结模型保存本步船体模型对照，核对失配阴影区后回本栏引用误差摘要。',
    ],
    watch: '+20° 大舵角下实测转艏速率偏离线性模型预测的幅值差、对水航速明显掉速及舵力引发的稳态横倾角。',
    conditionText: '平静无风浪无海流环境，无传感附加噪声，初始对水航速 8 m/s，t=20 s 自动施加 +20° 大舵阶跃，总时长 300 秒。',
    suggestion: '切勿认为线性比例可无限放大；大舵角转弯伴随强烈诱导阻尼掉速、横向非线性阻尼增强与横摇耦合，使小信号线性假设失效。',
    predictionSpec: {
      kind: 'choice',
      prompt: '运行前预估：将基于 +5° 小舵角辨识的线性模型直接外推至 +20° 大舵角阶跃时，预测曲线相对实船真值最可能出现何种偏差？',
      options: [
        choiceOpt('linear_overpredicts_yaw_misses_speed_drop', '线性模型按 4 倍比例放大预测转艏速率，会明显高估实船稳态转艏速率并忽视大舵转弯掉速与横摇耦合', '大角度机动下非线性横流阻力、转弯诱导阻力掉速与舵速限幅共同削弱实际稳态转艏率'),
        choiceOpt('actual_exceeds_4x_linear', '实船转艏速率会远超线性模型 4 倍预测值且航速反而大幅升高', '非线性阻尼随运动幅值平方增长并抑制舵效无限放大'),
        choiceOpt('constant_speed_exact_4x', '转艏速率精确扩大为 +5° 时的 4 倍且航速始终保持 8.0 m/s 不变', '忽视了大舵角转向阻力导致的纵向掉速及高阶水动力非线性项'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合转向掉速、非线性阻尼平方项及横摇耦合阐明外推偏差方向...',
    },
    observationSpec: {
      kind: 'artifact_binding',
      artifactKind: 'comparison',
      prompt: '在「评估」页签用第 4 步模型保存 +20° 大舵对照后，点击引用对照误差摘要，并可在备注中记录实际掉速后航速：',
    },
    interpretationSpec: {
      checklist: ['对比 +5°/−3° 与 +20° 下验证 RMSE 恶化幅度', '至少指出一条失效的模型假设（小角度/定常航速/无耦合）', '明确局部线性模型的舵角适用域上限'],
      placeholder: '结合失配曲线、掉速现象与横摇读数，阐明 +20° 大舵角下哪些线性模型假设不再成立...',
    },
  },
  {
    seq: 7,
    goal: '分别在 4 m/s 与 12 m/s 航速下执行 +5° 舵阶跃并冻结各自局部模型，汇总 4、8、12 m/s 三工况的舵效增益与时间常数表。',
    actionSteps: [
      '运行前在预测区按舵效增益 K 从大到小（对应时间常数 T 从短到长）排序三档航速。',
      '在控制区「本次运行条件」依次选定 4 m/s 与 12 m/s，各自点击「开始」完成 300 秒 +5° 舵阶跃运行。',
      '前往「评估」页签先用 8 m/s 模型对比失配，再分别为 4 m/s 与 12 m/s 冻结新模型，最后回到本栏提取两端稳态转艏速率并补录 K、T 值。',
    ],
    watch: '同一 +5° 舵阶跃下，4 m/s 低速响应迟缓且稳态转艏率偏小，而 12 m/s 高速转艏建起更快、稳态转艏率成倍增大。',
    conditionText: '平静无风浪无海流环境，无传感附加噪声，t=20 s 施加 +5° 舵阶跃，分别测试初始航速 4 m/s 与 12 m/s 工况各 300 秒。',
    suggestion: '切勿把 8 m/s 模型的 K/T 套用到全航速包络；务必在「评估」页签分别为 4 m/s 与 12 m/s 各自冻结本地船体模型。',
    predictionSpec: {
      kind: 'ranking',
      prompt: '按单位舵角稳态舵效增益 K 由大到小（即响应时间常数 T 由短到长）排列三档航速工况：',
      rankItems: [
        '12 m/s 高速航行（舵效增益 K 最大、响应最快，时间常数 T 最短）',
        '8 m/s 巡航航速（舵效增益 K 与时间常数 T 居于中间）',
        '4 m/s 低速航行（舵效增益 K 最小、响应最慢，时间常数 T 最长）',
      ],
      allowRationale: true,
      rationalePlaceholder: '结合舵升力随航速平方变化与水动力转动阻尼随航速线性变化推演 K 与 T 的标度规律...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成 4 m/s 与 12 m/s 运行并冻结两套船体模型后，提取初始航速与稳态转艏速率，并补填「评估」页签冻结的 K 与 T 值：',
      slots: [step7SpeedSlot('speed_4', '低速 4 m/s 工况', 4), step7SpeedSlot('speed_12', '高速 12 m/s 工况', 12)],
    },
    interpretationSpec: {
      checklist: ['整理 4 / 8 / 12 m/s 三工况完整 K、T 参数表', '用流体标度关系解释 K 增 T 减机理', '说明固定增益控制律在跨航速下的潜在失配风险'],
      placeholder: '列出 4、8、12 m/s 三组 K 与 T 参数并对比 8 m/s 模型外推误差，解释航速变化对船体舵效与惯性时间尺度的影响...',
    },
  },
  {
    seq: 8,
    goal: '基于第 4 步已冻结的 8 m/s 船体模型绘制并分析根轨迹与频域特征，厘清转艏速率通道与含积分环节的航向通道差异。',
    actionSteps: [
      '核对已在「评估」页签保留第 4 步冻结的 8 m/s 船体模型。',
      '在下方特征画板绘制模型根轨迹（可按需切换伯德图或奈奎斯特图），点击「识图核验」并开启参考叠加核对极点与转折频率。',
      '点击「一键引用已冻结工件摘要」记录模型参数，在下方写出极点位置与两通道结构差异。',
    ],
    watch: '开环负实极点位置 s = −1/T、航向通道新增的原点积分极点 s = 0、伯德图 −20 dB/dec 与 −40 dB/dec 斜率及相位裕度。',
    conditionText: '回到 8 m/s 基准航速，基于第 4 步已冻结船体模型完成解析特征分析与绘图核对（无需新建物理运行）。',
    suggestion: '图种识别不替代定量计算；请亲自根据冻结模型 K、T 计算极点实部与转折频率，明确转艏速率模型与航向模型在积分极点上的不同。',
    sketchSpec: {
      mode: 'analysis',
      plotId: 'root-locus',
      lockPlotId: false,
      label: '本人冻结模型特征图（默认根轨迹，可切换伯德/奈奎斯特）',
      hint: '可在右上图种菜单切换根轨迹图、伯德图或奈奎斯特图；绘制完成后点击「识图核验」，即可叠合本人冻结模型的解析特征线进行比对。',
      promptFocus: '开环积分极点 s=0、船体极点 s=-1/T 与频域特性',
    },
    observationSpec: {
      kind: 'artifact_binding',
      artifactKind: 'model',
      prompt: '点击下方按钮引用已冻结的 8 m/s 船体模型公式与参数，结合解析叠加核对特征极点与转折频率：',
    },
    interpretationSpec: {
      checklist: ['明确区分舵角→转艏速率与舵角→航向两通道模型差异', '写出由本人模型计算出的船体极点 s = −1/T 与转折频率', '分析开环积分极点 s=0 对稳态无静差与闭环相角滞后的双重作用'],
      placeholder: '写出基于本人 K、T 算出的特征极点与频域关键频率，阐明开环积分环节在两个通道及闭环稳定性中的物理意义...',
    },
  },
  {
    seq: 9,
    goal: '基于本人冻结的 8 m/s 一阶船体模型选定比例增益，对比建议值 0.5 倍、1 倍与 2 倍倍率下的闭环快慢、超调与舵角幅值。',
    actionSteps: [
      '运行前在预测区判断将比例增益由 0.5 倍提高至 2 倍时航向超调与上升时间的变化趋势。',
      '在控制区选中第 4 步冻结的 8 m/s 一阶模型，依次选用「0.5倍」「1倍」「2倍」中的至少两档运行完整 300 秒（每档间先重置）。',
      '在下方对应倍率工况槽点击「一键提取本工况读数」，采集实际 Kp、峰值航向与稳态航向。',
    ],
    watch: 't=20 s 航向阶跃 +10° 后，高倍比例增益下更陡峭的上升沿、更大的超调峰值及多次往返振荡与大舵角打满趋势。',
    conditionText: '平静无风浪无海流环境，无传感附加噪声，初始航速 8 m/s，纯比例控制，t=20 s 指令转向 +10°，各 300 秒（须基于同一个本人 8 m/s 一阶模型保留至少两档运行）。',
    suggestion: '切勿在运行途中手动滑动更改 Kp；请使用控制区「0.5倍」「1倍」「2倍」快捷按钮分别完成独立运行。',
    predictionSpec: {
      kind: 'choice',
      prompt: '运行前预估：在纯比例航向控制中，当比例增益由建议值的 0.5 倍增大到 2 倍时，阶跃响应将如何改变？',
      options: [
        choiceOpt('faster_rise_more_overshoot', '响应速度加快且初始打舵幅度增大，但系统等效阻尼比降低，航向超调百分比显著增大、振荡变剧烈', '含积分器的航向闭环对纯比例增益具有二阶欠阻尼特性，增大 Kp 提高 ωₙ 的同时按 1/√Kp 减小阻尼比'),
        choiceOpt('faster_no_overshoot', '响应变快的同时超调量反而归零且阻尼比越来越大', '纯比例控制未引入速率阻尼，无法在加快响应的同时提高阻尼比'),
        choiceOpt('slower_smaller_rudder', '上升变得更慢，所需起始舵角也同步减小', '比例增益直接成倍放大初始航向误差对应的舵角指令'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合二阶闭环特征方程说明自然频率与阻尼比随比例增益的变化规律...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成 0.5 倍、1 倍、2 倍中至少两档 300 秒独立运行后，点击对应工况槽「一键提取本工况读数」采集定量证据：',
      slots: ([0.5, 1, 2] as const).map((mult) => ({
        id: `kp_${String(mult).replace('.', '')}`,
        label: `比例增益 ${mult} 倍建议值`,
        conditionHint: '至少完成两档对照 · 300 s',
        matcher: (run) => {
          const v = extractDestroyerKpMultiplier(run);
          return v !== null && Math.abs(v - mult) < 1e-4;
        },
        metrics: [
          { key: 'kp', label: '实际 Kp', extract: (r) => r.initialInput.pid.kp.toFixed(3) },
          { key: 'peak_heading', label: '峰值航向角', unit: '°', seriesId: 'actualHeading', pickMode: 'max' },
          { key: 'steady_heading', label: '末态航向角', unit: '°', seriesId: 'actualHeading', pickMode: 'steady' },
          { key: 'peak_rudder', label: '峰值舵角', unit: '°', seriesId: 'rudder', pickMode: 'peak' },
        ],
      })),
    },
    interpretationSpec: {
      checklist: ['对比至少两档倍率下的超调峰值、调节快慢与峰值舵角', '用二阶系统阻尼比公式解释“增益—速度—超调”矛盾', '阐明引入微分阻尼的必要性'],
      placeholder: '对比所选倍率的实测超调、上升快慢与舵角峰值，说明纯比例控制为何难以兼顾快速性与低超调...',
    },
  },
  {
    seq: 10,
    goal: '按目标阻尼比与固有频率为本人模型设计比例微分控制器，先在模型侧冻结独立闭环预测，再在实船侧执行对照并分析差异。',
    actionSteps: [
      '在控制区选定第 4 步船体模型、微调或应用建议比例微分参数；在预测区输入预期超调并手绘 0–300 s 航向阶跃响应后点击「识图核验」。',
      '在「运行前的独立闭环预测」栏依次选中本人船体模型与第 2 步舵机模型，点击「冻结独立闭环预测」，再点击「开始」完成 300 秒实船运行。',
      '前往「评估」页签选用同一对船体与舵机模型保存独立闭环对照，回本栏引用误差摘要并对照手绘叠合曲线。',
    ],
    watch: 't=20 s 转向 +10° 后理想闭环预测曲线与实船实际航向在上升沿、超调量、调节时间上的偏差及舵机速率限制影响。',
    conditionText: '平静无风浪无海流环境，无传感附加噪声，初始航速 8 m/s，比例微分控制，t=20 s 指令转向 +10°，总时长 300 秒。',
    suggestion: '切勿使理想模型与实船共享误差信号；务必用当前控制参数先冻结闭环预测再跑实船，且评估页签对照必须选用完全相同的船体与舵机模型。',
    predictionSpec: {
      kind: 'numeric_target',
      unit: '%',
      targetPlaceholder: '如 8.0',
      prompt: '基于你设定的阻尼比与比例微分参数，预估 +10° 航向阶跃的闭环超调百分比 (%)，并在坐标系手绘 0–300 s 航向角轨迹：',
      allowRationale: true,
      rationalePlaceholder: '说明如何由目标阻尼比与固有频率选取比例与微分增益，并预判舵机滞后影响...',
      sketch: {
        mode: 'prediction',
        plotId: 'time-response',
        lockPlotId: true,
        label: '运行前手绘预测：比例微分闭环 +10° 航向阶跃曲线',
        hint: '从 0° 起笔，在 t=20 s 蓝虚线处平滑上升并逼近 10° 绿色目标线，标出预期峰值超调与收敛节奏。',
        promptFocus: '关注 t=20s 后航向爬升、超调幅度及贴近 10° 目标线的调节时间。',
        coordinateOverride: {
          title: '比例微分闭环航向阶跃预测坐标系',
          subtitle: '0–300 s 时域响应（t=20 s 指令 +10°，目标 10°）',
          xMin: 0, xMax: 300, yMin: -2, yMax: 18,
          xLabel: '时间 t', yLabel: '航向角', xUnit: 's', yUnit: '°',
          xTicks: ticksOf([0, 60, 120, 180, 240, 300]),
          yTicks: ticksOf([-2, 2, 6, 10, 14, 18]),
          verticalMarkers: [{ value: 20, label: 't=20s +10°', color: '#0ea5e9' }],
          horizontalMarkers: [{ value: 10, label: '目标 10°', color: '#10b981' }],
        },
        overlayExtractor: (samples) => extractDestroyerHeadingOverlay(samples, 300),
      },
    },
    observationSpec: {
      kind: 'artifact_binding',
      artifactKind: 'comparison',
      prompt: '在「评估」页签以同一船体与舵机模型保存独立闭环对照后，点击一键引用验证误差 RMSE 与 FIT 摘要：',
    },
    interpretationSpec: {
      checklist: ['写明比例微分参数的极点/阻尼比/自然频率设计依据', '定量比较理想闭环预测与实船航向偏差', '指出舵机滞后、速率限幅或局部非线性带来的差距来源'],
      placeholder: '写出比例微分参数选取依据，对比理想闭环预测与实船曲线偏差并阐明其物理根源...',
    },
  },
];
