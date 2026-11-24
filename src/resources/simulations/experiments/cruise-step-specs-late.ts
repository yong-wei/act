import type { VesselSample } from '../simulations/vessel-experiment';
import { extractCruiseMetric } from './cruise-evidence';
import type { StepWorkbenchSpec } from './cruise-step-specs';
import type { SketchActualCurveSeries } from './sketch-coordinate-templates';

function extractStep19FaultOverlay(samples: VesselSample[]): SketchActualCurveSeries[] {
  const valid = samples
    .filter((s) => s.time >= 0 && s.time <= 600)
    .map((s) => ({ x: s.time, y: Number.isFinite(s.values.roll) ? s.values.roll : s.values.actualRoll }))
    .filter((pt) => Number.isFinite(pt.y));
  const pre = valid.filter((pt) => pt.x <= 180);
  const post = valid.filter((pt) => pt.x >= 180);
  const series: SketchActualCurveSeries[] = [];
  if (pre.length >= 2) series.push({ id: 'cruise-step19-pre', label: '故障前实船横摇 (0–180s)', color: '#0ea5e9', points: pre });
  if (post.length >= 2) series.push({ id: 'cruise-step19-post', label: '故障后实船横摇 (180–600s)', color: '#ef4444', points: post });
  return series;
}

export const CRUISE_STEP_SPECS_LATE: readonly StepWorkbenchSpec[] = [
  {
    seq: 11,
    goal: '在平静水面执行 20° 快速转向机动，观测双吊舱推力诱导的横摇耦合与两处乘客点水平加速度差异。',
    actionSteps: [
      '运行前判断吊舱快速转向过程中横摇方向与两处乘客点加速度响应强弱。',
      '保持基线减摇参数不变，运行完整 400 s 转向过程。',
      '记录航向稳定完成时间、最大横摇角及两乘客点水平加速度均方根。',
    ],
    watch: '20–30 s 吊舱快速偏转引起的横倾冲击、航向收敛过程及乘客点 1 与 2 的水平加速度差异。',
    conditionText: '平静水面、初速 8 m/s、20 s 起用 10 s 斜坡转向至 20°、无测量噪声，时长 400 s。',
    suggestion: '即使没有风浪，大舵角/吊舱快转向仍会产生显著离心与舵翼诱导横倾，不能仅靠独立横摇传递函数评估舒适性。',
    predictionSpec: {
      kind: 'choice',
      prompt: '运行前预估：在无风浪平静水面上执行 10 s 斜坡 20° 快速转向时，船体舒适性主要受什么主导？',
      options: [
        { value: 'turn_roll_coupling', label: '吊舱偏转横向推力与离心力耦合诱发明显横倾，高甲板乘客点横向加速度更大' },
        { value: 'no_roll', label: '无波浪激励时横摇角与乘客点加速度必然全程保持为零' },
        { value: 'identical_pax', label: '不同甲板高度的乘客点受到完全相同的加速度与加加速度' },
      ],
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '运行结束后，填入转向机动过程与双乘客点实测关键指标：',
      metrics: [
        { key: 'turnSettleS', label: '航向达稳完成时间', unit: 's', seriesId: 'heading', pickMode: 'steady', placeholder: '如 65' },
        { key: 'maxRollDeg', label: '转向过程最大横摇角', unit: '°', seriesId: 'roll', pickMode: 'peak' },
        { key: 'pax1Accel', label: '乘客点 1 水平加速度均方根', unit: 'm/s²', placeholder: '见状态/评估乘客点 1' },
        { key: 'pax2Accel', label: '乘客点 2 水平加速度均方根', unit: 'm/s²', placeholder: '见状态/评估乘客点 2' },
      ],
    },
    interpretationSpec: {
      checklist: ['阐述转向与横摇交叉耦合机理', '说明仅研究单通道横摇传递函数的不足'],
      placeholder: '结合双乘客点位置坐标解释横向加速度由质心惯性力及角运动臂长叠加的原理…',
    },
  },
  {
    seq: 12,
    goal: '保持终航向 20° 不变，对比 40 s 与 80 s 转向斜坡，权衡航向快速到位与转向平滑舒适性的冲突。',
    actionSteps: [
      '运行前判断将转向斜坡由 40 s 延长至 80 s 对达稳时间与横摇/加速度峰值的改变。',
      '保持其余减摇参数固定，分别选择 40 s 与 80 s 斜坡各运行完整 400 s。',
      '在下方两组斜坡记录槽提取并比较最大横摇角、乘客点峰值加速度与航向达稳时间。',
    ],
    watch: '航向曲线到达 20° 的时间差、转向期最大横摇峰值以及乘客点水平加速度峰值变化。',
    conditionText: '平静水面、初速 8 m/s、20 s 起转向至 20°，分别对比 40 s 与 80 s 转向斜坡，各 400 s。',
    suggestion: '放缓转向指令斜坡可直接削弱转弯初始横向冲击，但会拉长航向进入稳态的耗时。',
    predictionSpec: {
      kind: 'choice',
      prompt: '运行前预估：将转向斜坡由 40 s 延长至 80 s 时，航向与舒适性指标如何变化？',
      options: [
        { value: 'slower_more_comfort', label: '航向达稳时间延长，但转向诱导的最大横摇与乘客点加速度峰值显著降低' },
        { value: 'faster_more_comfort', label: '80 s 斜坡既能更快完成转向又能进一步放大横摇峰值' },
        { value: 'no_difference', label: '转向斜坡长短只改变推进功率，不影响横摇与乘客加速度' },
      ],
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成 40 s 与 80 s 两档转向斜坡运行后，点击提取对应定量结果：',
      slots: ([40, 80] as const).map((ramp) => ({
        id: `ramp_${ramp}`,
        label: `转向斜坡 ${ramp} s`,
        conditionHint: '平静水面 20° 转向 · 400 s',
        matcher: (run) => run.courseSettings?.headingRampS === ramp,
        metrics: [
          { key: 'rollPeak', label: '最大横摇角', unit: '°', seriesId: 'roll', pickMode: 'peak', extract: (r) => extractCruiseMetric(r, 'rollPeakDeg', 3) },
          { key: 'paxPeak', label: '乘客点水平加速度峰值', unit: 'm/s²', extract: (r) => extractCruiseMetric(r, 'pax2AccelPeak', 4) ?? extractCruiseMetric(r, 'pax1AccelPeak', 4) },
          { key: 'settleTime', label: '航向达稳时间', unit: 's', extract: (r) => extractCruiseMetric(r, 'headingSettlingS', 1) },
        ],
      })),
    },
    interpretationSpec: {
      checklist: ['量化快速性与平稳性冲突', '指出工程上如何按水域与乘客工况选定斜坡'],
      placeholder: '对比 40 s 与 80 s 的航向延迟秒数与峰值横摇降幅，阐明操纵敏捷性与舒适度权衡…',
    },
  },
  {
    seq: 13,
    goal: '在中高海况下对比 4、8、10 m/s 三档航速对遭遇频率、减摇鳍升力、横摇均方根与推进能耗的综合影响。',
    actionSteps: [
      '运行前排序三档航速在当前波浪下的横摇表现（警惕「越慢必定越稳」的线性直觉陷阱）。',
      '固定其余控制与滤波参数，分别在 4、8、10 m/s 航速下各运行完整 600 s。',
      '提取并比对三档航速的横摇均方根、可用力矩水平与主推进正机械功。',
    ],
    watch: '低速下可用鳍力矩按速度平方急剧衰减的告警提示、波浪遭遇节奏与推进功变化。',
    conditionText: '中高海况不规则横浪、减摇鳍开启，分别测试 4、8、10 m/s 三档初始航速，各 600 s。',
    suggestion: '减速虽可能调整遭遇频率或降低阻力，但过低航速会使减摇鳍失去恢复与阻尼力矩能力。',
    predictionSpec: {
      kind: 'ranking',
      prompt: '运行前按预期减摇效果由优到差（横摇均方根由小到大）排序三档航速，并简述理由：',
      rankItems: ['8 m/s 巡航航速（鳍效与遭遇频率均衡）', '10 m/s 较高航速（鳍升力更强但功耗偏高）', '4 m/s 低速航行（鳍力矩衰减至巡航约 1/4）'],
      allowRationale: true,
      rationalePlaceholder: '分析航速改变时鳍升力平方衰减与遭遇频谱移动的综合作用…',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成 4 / 8 / 10 m/s 三档航速运行后，提取对应舒适度与能耗读数：',
      slots: ([4, 8, 10] as const).map((speed) => ({
        id: `spd_${speed}`,
        label: `航速 ${speed} m/s`,
        conditionHint: '中高海况 · 600 s',
        matcher: (run) => run.configuration.initialWaterSpeedMps === speed,
        metrics: [
          { key: 'rollRms', label: '横摇均方根', unit: '°', extract: (r) => extractCruiseMetric(r, 'rollRmsDeg', 3) },
          { key: 'finMoment', label: '峰值分配力矩', unit: 'N·m', seriesId: 'finMoment', pickMode: 'peak', extract: (r) => extractCruiseMetric(r, 'finMomentPeakNm', 0) },
          { key: 'propWork', label: '主推进正机械功', unit: 'MJ', extract: (r) => extractCruiseMetric(r, 'propulsionWorkMj', 2) },
        ],
      })),
    },
    interpretationSpec: {
      checklist: ['避免「越慢一定越舒适」的单一推论', '分析航速—遭遇频率—鳍力—推进功耗四维耦合'],
      placeholder: '结合 4 m/s 低速时横摇或饱和恶化现象与 10 m/s 功耗飙升，阐明航速选择的折中区间…',
    },
  },
  {
    seq: 14,
    goal: '在含测量噪声海况下对比多档低通滤波截止频率，权衡抑制高频传感器噪声磨损与避免控制相位滞后。',
    actionSteps: [
      '运行前判断放宽或收紧测量低通截止频率对减摇鳍磨损积分与横摇阻尼的效果。',
      '固定其余基线参数，至少选用两档低通截止频率（建议 0.15 与 0.6 Hz）各自运行完整 600 s。',
      '对比不同截止频率下的横摇均方根、鳍高频磨损积分及伺服电能，选定兼顾耐用的截止频率。',
    ],
    watch: '左侧状态栏「鳍高频磨损积分」、左右鳍角毛刺振荡幅度及窗口横摇均方根变化。',
    conditionText: '中高海况不规则横浪并叠加标准传感器测量噪声、初速 8 m/s，对比不同量测低通截止频率，各 600 s。',
    suggestion: '截止频率过高会放大陀螺高频噪声致伺服剧烈抖动；过低则引入较大相位滞后削弱阻尼效果。',
    predictionSpec: {
      kind: 'choice',
      prompt: '运行前预估：在含传感器噪声环境下将低通截止频率由 0.15 Hz 提高到 0.6 Hz 会带来什么影响？',
      options: [
        { value: 'less_lag_more_wear', label: '控制相位滞后减小，但大量高频测量噪声透传至鳍伺服，磨损积分与电能激增' },
        { value: 'less_wear_more_damping', label: '既消除全部高频抖动磨损又完全消除相位延迟' },
        { value: 'no_noise_effect', label: '传感器噪声不会通过反馈回路驱动减摇鳍动作' },
      ],
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '至少完成两档截止频率对比运行后，提取对应性能与伺服磨损指标：',
      slots: ([0.15, 0.3, 0.6] as const).map((cutoff) => ({
        id: `lp_${String(cutoff).replace('.', '')}`,
        label: `低通截止 ${cutoff} Hz`,
        conditionHint: '至少完成两档对照 · 600 s',
        matcher: (run) => run.courseSettings?.lowPassCutoffHz === cutoff,
        metrics: [
          { key: 'rollRms', label: '横摇均方根', unit: '°', extract: (r) => extractCruiseMetric(r, 'rollRmsDeg', 3) },
          { key: 'wear', label: '鳍高频磨损积分', unit: '°', extract: (r) => extractCruiseMetric(r, 'wearIntegralDeg', 0) },
          { key: 'finWork', label: '鳍伺服电能', unit: 'MJ', extract: (r) => extractCruiseMetric(r, 'finWorkMj', 3) },
        ],
      })),
    },
    interpretationSpec: {
      checklist: ['对比噪声放大与相位延迟两类代价', '阐明折中截止频率选择依据'],
      placeholder: '用实测磨损积分、伺服电能与横摇均方根数据，阐述微分/速率通道低通滤波的工程折中…',
    },
  },
  {
    seq: 15,
    goal: '依据频谱主峰设定陷波中心频率与带宽并对比开关效果，客观评估滤除波频干扰与损失控制相位的取舍。',
    actionSteps: [
      '运行前判断在波频附近插入窄带陷波对伺服动作量及横摇控制效果的双面影响。',
      '先在「陷波关闭」下运行 600 s 并在「评估」页签查看波浪/横摇频谱主峰；再设定匹配中心频率与带宽并开启陷波运行 600 s（注意右侧理想图即刻显示停带区）。',
      '对照陷波关/开两组在横摇均方根、磨损积分与伺服电能的实测变化，据实判断陷波是否划算。',
    ],
    watch: '右侧理想设计图中红色虚线停带区位置与实际频谱峰对齐情况，以及开关前后磨损与横摇均方根变化。',
    conditionText: '中高海况不规则横浪并叠加标准测量噪声、初速 8 m/s，保持其余控制参数固定对比陷波关与开，各 600 s。',
    suggestion: '陷波可大幅削减高频波浪追随动作、保护鳍伺服寿命，但若中心频率紧邻固有频率则会一并削弱有效减摇反馈。',
    predictionSpec: {
      kind: 'choice',
      prompt: '运行前预估：开启窄带陷波滤波后，船体横摇与鳍伺服损耗通常呈现哪种取舍关系？',
      options: [
        { value: 'wear_down_tradeoff', label: '波频处鳍动作与磨损明显下降，但同时滤除了部分控制频带信息，横摇均方根可能略升或改善有限' },
        { value: 'free_lunch', label: '横摇均方根与伺服磨损必然同时成倍大幅降低，没有任何相位代价' },
        { value: 'infinite_gain', label: '陷波滤波器会向系统注入无限大直流控制增益' },
      ],
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成陷波关闭与开启两次对照运行后，提取对应横摇与磨损指标：',
      slots: ([false, true] as const).map((enabled) => ({
        id: enabled ? 'notch_on' : 'notch_off',
        label: enabled ? '陷波开启' : '陷波关闭',
        conditionHint: '中高海况加测量噪声 · 600 s',
        matcher: (run) => Boolean(run.courseSettings?.notchEnabled) === enabled,
        metrics: [
          { key: 'rollRms', label: '横摇均方根', unit: '°', extract: (r) => extractCruiseMetric(r, 'rollRmsDeg', 3) },
          { key: 'wear', label: '鳍高频磨损积分', unit: '°', extract: (r) => extractCruiseMetric(r, 'wearIntegralDeg', 0) },
          { key: 'finWork', label: '鳍伺服电能', unit: 'MJ', extract: (r) => extractCruiseMetric(r, 'finWorkMj', 3) },
        ],
      })),
    },
    interpretationSpec: {
      checklist: ['说明中心频率/带宽与频谱对齐方式', '客观评价是否牺牲有效控制频带信息'],
      placeholder: '按实测对比判断本海况下启用陷波滤波的净收益或代价，指出参数误配风险…',
    },
  },
  {
    seq: 16,
    goal: '在风浪流与噪声综合工况下联合整定转向斜坡、鳍阻尼/刚度与滤波组合，形成首套双任务达标控制方案。',
    actionSteps: [
      '运行前输入首套联合方案预期的 400 s 横摇峰值目标，并简述各模块协同设定理由。',
      '选用第 3 步有效横摇模型，联合配置转向斜坡、阻尼比、恢复刚度、低通滤波及陷波开关后运行完整 400 s。',
      '采集窗口横摇均方根、峰值及两处乘客点水平加速度均方根，冻结作为后续优化基准。',
    ],
    watch: '风浪流与 20° 转向复合激励下，横摇峰值是否守住 6° 警戒线、航向收敛及时性及双乘客点舒适度平衡。',
    conditionText: '中等横浪叠加风与海流、存在标准测量噪声、初速 8 m/s、20 s 起转向 20°，时长 400 s。',
    suggestion: '建议保持减摇鳍开启，在兼顾航向快慢的同时优先压低转向与横浪叠加期的瞬时峰值。',
    predictionSpec: {
      kind: 'numeric_target',
      prompt: '运行前预估：在本套联合方案下，400 s 综合海况转向过程中的最大横摇峰值（°）。',
      unit: '°',
      targetPlaceholder: '输入预估横摇峰值（建议守住 < 6°）',
      allowRationale: true,
      rationalePlaceholder: '说明所选转向斜坡、阻尼比与滤波参数如何协同应对风浪流与噪声…',
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '记录第 16 步基准联合方案在 400 s 内的实测性能指标：',
      metrics: [
        { key: 'rollRms', label: '窗口横摇均方根', unit: '°' },
        { key: 'rollPeak', label: '窗口横摇峰值', unit: '°', seriesId: 'roll', pickMode: 'peak' },
        { key: 'pax1Accel', label: '乘客点 1 水平加速度均方根', unit: 'm/s²' },
        { key: 'pax2Accel', label: '乘客点 2 水平加速度均方根', unit: 'm/s²' },
      ],
    },
    interpretationSpec: {
      checklist: ['权衡航向跟踪与乘客舒适性双目标', '阐明第一方案的薄弱指标以备第 17 步修订'],
      placeholder: '结合两乘客点舒适度指标与横摇余量，指出当前联合方案进一步单维微调的方向…',
    },
  },
  {
    seq: 17,
    goal: '引用第 16 步方案并严格仅修订单一控制维度，对比两处不同甲板坐标乘客点的加速度分布与多目标权衡。',
    actionSteps: [
      '运行前判断准备微调的那一项控制维度对两处乘客点水平加速度与加加速度的差异化影响。',
      '在「已冻结的联合方案」下拉引用第 16 步完整运行，只改动 1 项参数（确保变更维度徽章显示 1/1，不关闭减摇鳍）后运行 400 s。',
      '在下方两乘客点对比槽提取各自水平加速度均方根、峰值与加加速度均方根。',
    ],
    watch: '变更维度计数徽章是否恰为 1/1，以及同一方案下两处不同船体位置乘客点的加速度峰值梯度。',
    conditionText: '与第 16 步完全相同的风浪流与噪声工况、20 s 起转向 20°，仅允许变更 1 项联合控制参数，时长 400 s。',
    suggestion: '切勿同时修改两个及以上参数或关闭减摇鳍，以免无法清晰归因该单维修改对双乘客点响应的真实贡献。',
    predictionSpec: {
      kind: 'choice',
      prompt: '运行前预估：仅微调单个策略维度后，船体上两处不同坐标的乘客点响应有何规律？',
      options: [
        { value: 'spatial_gradient', label: '距横摇/转艏中心更远或更高甲板的乘客点受角加速度臂长放大，水平加速度始终显著高于另一点' },
        { value: 'same_everywhere', label: '刚体邮轮所有舱室的水平加速度与不适度评价完全一致' },
        { value: 'independent_of_turn', label: '转向斜坡或阻尼修订只影响乘客点 1，对乘客点 2 毫无影响' },
      ],
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成单维修订方案 400 s 运行后，分别提取两处乘客点的实测舒适性指标：',
      slots: [
        {
          id: 'passenger_1',
          label: '乘客点 1（参照位置）',
          conditionHint: '本步单维修订方案实测',
          matcher: (run) => run.stepSequence === 17,
          metrics: [
            { key: 'accelRms', label: '水平加速度均方根', unit: 'm/s²', extract: (r) => extractCruiseMetric(r, 'pax1AccelRms', 4) },
            { key: 'accelPeak', label: '水平加速度峰值', unit: 'm/s²', extract: (r) => extractCruiseMetric(r, 'pax1AccelPeak', 4) },
            { key: 'jerkRms', label: '加加速度均方根', unit: 'm/s³', extract: (r) => extractCruiseMetric(r, 'pax1JerkRms', 4) },
          ],
        },
        {
          id: 'passenger_2',
          label: '乘客点 2（高甲板/偏移位置）',
          conditionHint: '本步单维修订方案实测',
          matcher: (run) => run.stepSequence === 17,
          metrics: [
            { key: 'accelRms', label: '水平加速度均方根', unit: 'm/s²', extract: (r) => extractCruiseMetric(r, 'pax2AccelRms', 4) },
            { key: 'accelPeak', label: '水平加速度峰值', unit: 'm/s²', extract: (r) => extractCruiseMetric(r, 'pax2AccelPeak', 4) },
            { key: 'jerkRms', label: '加加速度均方根', unit: 'm/s³', extract: (r) => extractCruiseMetric(r, 'pax2JerkRms', 4) },
          ],
        },
      ],
    },
    interpretationSpec: {
      checklist: ['对比第 16 步基线说明单维变动效果', '阐明空间坐标差异带来的多目标权衡'],
      placeholder: '对比修订前后双乘客点指标，说明为何舒适性设计不能仅凭单一重心横摇角替代多点评估…',
    },
  },
  {
    seq: 18,
    goal: '保持第 16 或 17 步冻结联合方案完全不变（禁止重拟合调参），在未见长周期强波谱工况下盲测鲁棒性。',
    actionSteps: [
      '运行前判断冻结方案在有效波高 1.5 m、谱峰周期 10 s 的未见海况下是否会出现性能退化或饱和。',
      '在控制区选择第 16 或 17 步方案并确认原 8 项控制器/滤波器参数全锁定，运行完整 600 s。',
      '记录 120–600 s 横摇均方根、峰值、不适度评价指数与双乘客点加速度峰值差。',
    ],
    watch: '更强且周期更长的未见波浪下，横摇是否触及 6° 警戒、鳍伺服是否频繁限幅以及不适度变化幅度。',
    conditionText: '独立随机种子、有效波高 1.5 m、谱峰周期 10 s 综合风浪流与测量噪声、20 s 起转向 20°，冻结方案验证 600 s。',
    suggestion: '切勿为迎合未见工况而偷偷重新拟合模型或修改原方案；盲测旨在真实暴露已选方案的频域适应边界。',
    predictionSpec: {
      kind: 'choice',
      prompt: '运行前预估：当外部波高增至 1.5 m 且谱峰周期变为 10 s 时，冻结的联合方案最可能出现什么情况？',
      options: [
        { value: 'shift_and_load', label: '波频向 0.10 Hz 移动且波幅增强，横摇响应与鳍饱和度可能升高，检验原滤波与阻尼余量' },
        { value: 'zero_sensitivity', label: '线性闭环方案对波浪谱峰周期与波高变化完全不敏感' },
        { value: 'improve_automatically', label: '有效波高越大，减摇鳍控制余量反而越宽松' },
      ],
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '完成 600 s 未见波谱验证后，记录以下实测鲁棒性指标：',
      metrics: [
        { key: 'rollRms', label: '120–600 s 横摇均方根', unit: '°' },
        { key: 'rollPeak', label: '窗口横摇峰值', unit: '°', seriesId: 'roll', pickMode: 'peak' },
        { key: 'msi', label: '教学不适度评价指数', unit: '%' },
        { key: 'paxDiff', label: '两乘客点水平加速度峰值差', unit: 'm/s²' },
      ],
    },
    interpretationSpec: {
      checklist: ['严格保持冻结方案未篡改', '分析波谱峰频偏移与波高增大引起的余量缩水'],
      placeholder: '对照第 16/17 步结果评估方案跨海况鲁棒性，指出若启用固定陷波时谱峰漂移带来的影响…',
    },
  },
  {
    seq: 19,
    goal: '保持冻结方案并在 t=180 s 注入左减摇鳍永久卡阻故障，手绘预测曲线并检验剩余执行能力与处置策略。',
    actionSteps: [
      '运行前选择应对单鳍锁死的处置策略判断，并在 0–600 s 坐标系（带 t=180 s 红色标尺）手绘故障前后横摇轨迹后「识图核验」。',
      '引用第 16 或 17 步联合方案（原 8 项控制参数锁定），仅设定故障后策略（保持当前/降速/延长转向），运行完整 600 s。',
      '对比手绘板叠合的故障前后实船横摇轨迹，填入故障前/后稳态横倾、不适度评价指数与右鳍饱和表现。',
    ],
    watch: 't=180 s 左鳍冻结告警灯亮起后，横摇力矩减半叠加左鳍静偏置力矩引发的平均横倾与右鳍单侧限幅饱和。',
    conditionText: '独立随机种子、综合风浪流与标准测量噪声、第 180 s 左减摇鳍卡死且启动 20° 转向，时长 600 s。',
    suggestion: '左鳍卡死不仅损失一半减摇力矩，还可能留下持续横倾偏置；延长转向或适度降速可缓和转弯冲击，但降速同时会削弱右鳍剩余升力。',
    predictionSpec: {
      kind: 'choice',
      prompt: '运行前预估：当左减摇鳍于 180 s 卡死且船体叠加 20° 转向时，哪种策略逻辑最稳健？',
      options: [
        { value: 'long_turn', label: '延长转向斜坡至 80 s（保留航速以维持右鳍剩余升力，同时缓和转向横倾冲击）' },
        { value: 'slow', label: '180 s 后降速（减弱转向离心与波浪遭遇冲击，但会同步削弱右鳍剩余可用升力）' },
        { value: 'keep', label: '保持原方案（检验现有阻尼与 10/40 s 转向在半数鳍效下的极限承受力）' },
      ],
      sketch: {
        mode: 'prediction',
        plotId: 'time-response',
        lockPlotId: true,
        label: '单鳍卡阻故障前后横摇预测草图（0–600 s）',
        hint: '红色虚线标出 t=180 s 左鳍锁死时刻；请画出故障前对称减摇与故障后出现偏置横倾及幅值扩大的变化趋势。',
        promptFocus: '重点关注 t=180 s 节点前后的均值偏置（静横倾角）与峰值波动变化，以及是否逼近 ±6° 警戒线。',
        coordinateOverride: {
          title: '单鳍失效故障时域横摇预测坐标系',
          subtitle: '时间 0–600 s（红色虚线 t=180 s 左鳍锁死），横摇角 -8° 至 +8°',
          xMin: 0, xMax: 600, yMin: -8, yMax: 8, xLabel: '时间', yLabel: '横摇角', xUnit: 's', yUnit: '°',
          xTicks: [0, 120, 180, 300, 450, 600].map((v) => ({ value: v, label: String(v) })),
          yTicks: [-8, -4, 0, 4, 8].map((v) => ({ value: v, label: String(v) })),
          verticalMarkers: [{ value: 180, label: 't=180s 左鳍锁死', color: '#ef4444' }],
          horizontalMarkers: [
            { value: 0, label: '平衡零线', color: '#64748b' },
            { value: 6, label: '+6° 横摇警戒线', color: '#f59e0b' },
            { value: -6, label: '-6° 横摇警戒线', color: '#f59e0b' },
          ],
        },
        overlayExtractor: (samples) => extractStep19FaultOverlay(samples),
      },
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '完成 600 s 故障运行后，记录故障前后稳态横倾、不适度评价指数与右鳍饱和状态：',
      metrics: [
        { key: 'preFaultHeel', label: '故障前（0–180 s）稳态横摇', unit: '°', placeholder: '如 0.45' },
        { key: 'postFaultHeel', label: '故障后（180–600 s）稳态偏置横倾', unit: '°', seriesId: 'roll', pickMode: 'steady' },
        { key: 'postFaultMsi', label: '故障后教学不适度评价指数', unit: '%', placeholder: '见舒适度仪表读数' },
        { key: 'starboardFinSat', label: '右鳍最大角度与饱和率估计', unit: '%', placeholder: '如 峰值 25.0° / 饱和约 35%' },
      ],
    },
    interpretationSpec: {
      checklist: ['保留完整失效事件与恢复过程描述', '对比剩余 50% 执行能力与降速损失升力的权衡'],
      placeholder: '结合故障前后叠合曲线与右鳍饱和指示，阐明单鳍卡阻下剩余控制能力边界及策略成败依据…',
    },
  },
  {
    seq: 20,
    goal: '整合模型辨识、共振饱和限制、多目标舒适性控制与单鳍失效边界，完成六部分实证工程实验报告。',
    actionSteps: [
      '在左侧「控制」勾选至少 5 次本人完整运行（需含横摇辨识、独立验证、双乘客点舒适性及故障处置记录）。',
      '利用上方「步 1–19 实测证据胶囊」将真实模型公式、RMSE/FIT 及时间窗口指标插入对应报告章节，检查四维量规预检全达标。',
      '逐章填写六部分结论，并在「问题与限制」「工程结论与边界」明确指出教学不适度评价指数仅作课堂物理代理，不等同于医学晕船诊断。',
    ],
    watch: '四维报告量规预检是否全绿，是否覆盖至少 5 次运行、双乘客点加速度差异与单鳍故障恢复边界。',
    conditionText: '综合分析与报告撰写环节（无须启动仿真），需引用至少 5 次本人完整运行及两处乘客点实际指标。',
    suggestion: '请用定量实测数字支撑每一项工程判断，严禁把课堂教学不适度代理指数当作真实医学晕船率诊断。',
    reportFieldGuides: {
      problem: '界定邮轮双吊舱—减摇鳍多通道耦合特性及线性适用域，并声明教学不适度评价指数仅作课堂物理代理而非医学晕船诊断。',
      identification: '引用第 2 步自由衰减与第 3 步脉冲辨识冻结的二阶横摇振子模型参数及残差均方根。',
      validation: '对比第 4 步独立小信号验证 RMSE/FIT、第 6 步规则波共振削峰与第 8 步理想设计 vs 实船饱和差异。',
      comparison: '总结第 9–17 步在鳍开关、阻尼增益、转向斜坡、低通/陷波滤波及两乘客点空间差异上的多目标权衡。',
      revision: '汇总第 17–19 步单维策略优化、变化波谱盲测与 t=180 s 左鳍卡阻下的降级处置修正效果。',
      conclusion: '凝练航向与舒适性双任务适用边界、执行器限幅警觉及教学舒适性代理的非医学诊断声明。',
    },
  },
];
