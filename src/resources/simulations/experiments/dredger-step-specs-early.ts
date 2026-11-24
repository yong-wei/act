import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import type {
  StepObservationMetricDef,
  StepObservationSlotDef,
  VesselSample,
  VesselStep,
} from '../simulations/vessel-experiment';
import type { SketchActualCurveSeries } from './sketch-coordinate-templates';

export type DredgerStepWorkbenchSpec = Pick<
  VesselStep,
  | 'goal'
  | 'actionSteps'
  | 'watch'
  | 'conditionText'
  | 'suggestion'
  | 'predictionSpec'
  | 'observationSpec'
  | 'interpretationSpec'
  | 'sketchSpec'
> & { reportFieldGuides?: Record<string, string> };

export function extractDredgerSeriesOverlay(
  samples: VesselSample[],
  seriesId: 'sway' | 'depth',
  label: string,
  color = '#0ea5e9',
): SketchActualCurveSeries[] {
  const raw = samples
    .map((sample) => ({ x: sample.time, y: sample.values[seriesId] }))
    .filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));
  if (raw.length < 2) return [];
  const stride = raw.length > 240 ? Math.ceil(raw.length / 240) : 1;
  const points = raw.filter((_, idx) => idx % stride === 0 || idx === raw.length - 1);
  return [{ id: `dredger-actual-${seriesId}`, label, color, points }];
}

export const choiceOpt = (value: string, label: string, detail: string) => ({ value, label, detail });

export const dredgerMetric = (
  key: string,
  label: string,
  unit?: string,
  seriesId?: string,
  pickMode?: StepObservationMetricDef['pickMode'],
  placeholder?: string,
): StepObservationMetricDef => ({ key, label, unit, seriesId, pickMode, placeholder });

export const dredgerSlot = (
  id: string,
  label: string,
  conditionHint: string,
  matcher: ((run: VesselRunSummary) => boolean) | undefined,
  metrics: StepObservationMetricDef[],
): StepObservationSlotDef => ({ id, label, conditionHint, ...(matcher ? { matcher } : {}), metrics });

const TIME_300_TICKS = [0, 60, 120, 180, 240, 300].map((value) => ({ value, label: String(value) }));

export const DREDGER_STEP_SPECS_EARLY: Record<number, DredgerStepWorkbenchSpec> = {
  1: {
    goal: '辨析天鲸号自航双桨舵与钢桩、左右横移绞车、桥架、绞刀的受力来源与分工，厘清挖泥定位与推进器动力定位的本质差异。',
    actionSteps: [
      '运行前在预测区判断静水停船且未落桩时，各执行器对船体约束和受力的分工关系。',
      '点击「开始」完成 120 秒静水停船基准运行，对照左侧读数与曲线核实零推力、未落桩与绞刀停转初态。',
      '在下方机构功能配对卡完成 6 项通道归类并撰写机理说明后提交本步。',
    ],
    watch: '钢桩反力 (kN)、左右缆张力 (kN)、刀位深度 (m)、绞刀转速 (rpm) 与船体横移速度 (m/s) 在未挂缆、未落桩、零转速下的基准读数。',
    conditionText: '平静无风浪无海流静水环境，停船静浮 120 秒，双桨零转速、钢桩未落下、锚缆未挂接、绞刀停转。',
    suggestion: '切勿把绞吸挖泥船的「钢桩+双弹性锚缆」物理定位链混淆为依赖全向推进器的动力定位系统。',
    predictionSpec: {
      kind: 'choice',
      prompt: '天鲸号在施工定位作业与自航进场时，分别依靠哪套执行机构承担船体定位支承与横移牵引？',
      options: [
        choiceOpt('spud_cable_vs_propeller', '自航进场靠双桨舵，施工定位靠钢桩有限刚度插床支承与左右单向受拉锚缆牵引', '桥架与绞刀载荷同时反馈作用于船体六自由度运动，与推进器动力定位机理完全不同'),
        choiceOpt('thruster_dp_only', '施工切削全程仅靠双螺旋桨和常规舵提供横向和纵向固定推力', '忽略了钢桩插床支承力与双侧绞车锚缆作为主定位约束的工程结构'),
        choiceOpt('cutter_propels_ship', '由前端绞刀旋转升力独自拉动整艘船横向摆动并完成纵向定位', '绞刀主要产生切削阻力矩与反力，不能替代钢桩与绞车牵引'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合船体纵向支承、横向牵引、垂直调深与土体切削分别对应的物理部件说明理由...',
    },
    observationSpec: {
      kind: 'channel_match',
      prompt: '根据天鲸号作业受力链分工，为下列 6 个核心部件匹配准确的功能与受力角色：',
      pairs: [
        { id: 'twin_prop_rudder', item: '自航双桨与双舵', hint: '艉部推进与操舵系统', choices: ['自航进场推进与航向操舵', '海底有限刚度插桩支承', '单向受拉横向牵引缆', '桥架俯仰升降调节刀深', '旋转切削土体产生切削载荷'] },
        { id: 'spud', item: '定位钢桩', hint: '艉部插入海床的定位桩', choices: ['海底有限刚度插桩支承', '自航进场推进与航向操舵', '单向受拉横向牵引缆', '桥架俯仰升降调节刀深', '旋转切削土体产生切削载荷'] },
        { id: 'port_winch', item: '左舷横移绞车', hint: '连接左舷锚缆的绞车', choices: ['单向受拉横向牵引缆', '自航进场推进与航向操舵', '海底有限刚度插桩支承', '桥架俯仰升降调节刀深', '旋转切削土体产生切削载荷'] },
        { id: 'starboard_winch', item: '右舷横移绞车', hint: '连接右舷锚缆的绞车', choices: ['单向受拉横向牵引缆', '自航进场推进与航向操舵', '海底有限刚度插桩支承', '桥架俯仰升降调节刀深', '旋转切削土体产生切削载荷'] },
        { id: 'ladder', item: '挖泥桥架', hint: '承载吸泥管与绞刀的钢结构', choices: ['桥架俯仰升降调节刀深', '自航进场推进与航向操舵', '海底有限刚度插桩支承', '单向受拉横向牵引缆', '旋转切削土体产生切削载荷'] },
        { id: 'cutter', item: '前端绞刀', hint: '桥架末端旋转切削机构', choices: ['旋转切削土体产生切削载荷', '自航进场推进与航向操舵', '海底有限刚度插桩支承', '单向受拉横向牵引缆', '桥架俯仰升降调节刀深'] },
      ],
    },
    interpretationSpec: {
      checklist: ['区分自航与定位两套执行机构链', '说明桥架与绞刀载荷如何耦合回船体运动', '阐明弹性锚缆只能受拉不能受压的物理特点'],
      placeholder: '结合六自由度船体受力和各部件作用位置，总结天鲸号作业受力链与推进器动力定位的根本区别...',
    },
  },
  2: {
    goal: '检验横流环境下自航双轴转速与舵角对横向漂移的抑制局限，厘清欠驱动船舶低速舵效衰减及对地与对水运动差异。',
    actionSteps: [
      '运行前判断在恒定横流下仅凭常规艉舵能否实现船体零速原地守位。',
      '调节「自航双轴参考」与「手动舵角」（建议先试低速或默认 80 rpm 与小舵角），点击「开始」运行 300 秒。',
      '记录设定的轴速与舵角、末态横移速度、横摇峰值与钢桩反力，解释欠驱动横漂机理。',
    ],
    watch: '横移速度量测 (m/s) 在横流持续推挤下的漂移稳态值、横摇真值 (°) 及钢桩反力始终为零的状态。',
    conditionText: '存在恒定海流的开阔水环境，处于自航进场模式（钢桩未下放、锚缆未连接），运行 300 秒。',
    suggestion: '尝试低转速或零舵角观察横流漂移：常规双桨双舵欠驱动船在零航速下无法用舵产生横向定位力。',
    predictionSpec: {
      kind: 'choice',
      prompt: '在恒定横流下未落桩且未挂锚缆时，天鲸号仅依靠自航双桨与常规艉舵能否把船体原地零速守位？',
      options: [
        choiceOpt('cannot_hold_zero_speed', '不能：常规双桨舵属于欠驱动系统，零航速或极低速下舵效接近消失，船体仍将被横流推离', '舵需要前方来流产生横向水动力升力，低速时既缺横向直接执行力又缺舵效'),
        choiceOpt('hold_perfectly', '可以：只要把舵角打满至 35°，零航速下舵面也能直接产生抵消横流的侧推力', '混淆了水翼舵对船速的依赖关系与侧推器/锚缆直接横向力'),
        choiceOpt('spud_auto_holds', '即使未落桩，船体位置也会自动锁定在海图原点不动', '忽略了自由漂浮船体在海流中产生的对地与对水速度差'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合水翼舵升力与航速平方关系以及横流对地漂移原理说明判断依据...',
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '完成 300 秒自航进场运行后，记录双轴转速、舵角设置及从曲线提取实测横移速度与横摇峰值：',
      metrics: [
        dredgerMetric('transit_rpm', '设定的自航双轴转速', 'rpm', undefined, undefined, '如 80'),
        dredgerMetric('rudder_deg', '设定的手动舵角', '°', undefined, undefined, '如 0'),
        dredgerMetric('sway_steady', '末态横移速度量测', 'm/s', 'sway', 'steady'),
        dredgerMetric('roll_peak', '横摇真值峰值', '°', 'roll', 'peak'),
        dredgerMetric('spud_steady', '钢桩反力量测', 'kN', 'spud', 'steady'),
      ],
    },
    interpretationSpec: {
      checklist: ['报告实际设定的双轴转速与舵角下的横漂结果', '说明低速时舵效衰减的流体物理机制', '解释为何精确定位挖泥必须落桩并启用绞车锚缆'],
      placeholder: '结合实测横移速度与零钢桩反力读数，论证欠驱动船舶在横流中无法仅凭舵实现零速守位的原因...',
    },
  },
  3: {
    goal: '观测落桩、撤桩与台车步进过程中钢桩反力的建立与卸载时程，实证有限刚度接触支承而非瞬时刚体锁定。',
    actionSteps: [
      '运行前判断下达落桩与撤桩指令后，钢桩接触反力是瞬间跳变还是随时间逐步建立与衰减。',
      '保持预设倒桩序列（无需调参），点击「开始」完成 300 秒全流程运行。',
      '观察 t=0–60 s 落桩、t=60 s 退出、t=80–120 s 台车 0.025 m/s 移动与 t=140 s 重新落桩时的反力曲线并提取读数。',
    ],
    watch: '钢桩反力量测 (kN) 在落桩后约 10 秒逐步爬升的动态过程，以及撤桩、台车行程推进与重新落桩各时间节点的反力跳降。',
    conditionText: '平静无风浪无海流环境，预设倒桩连锁序列（0–60 s 准备落桩、60 s 请求退出、80–120 s 台车移动 0.025 m/s、140 s 重新落桩），总时长 300 秒。',
    suggestion: '重点留意：系统必须同时满足停刀、抬刀、撤桩和低船速等联锁条件后才允许台车步进前移。',
    predictionSpec: {
      kind: 'choice',
      prompt: '当控制系统下达「准备与落桩」指令并随后于 t=60 s 请求退出换桩时，钢桩反力曲线会呈现何种物理过程？',
      options: [
        choiceOpt('finite_stiffness_build', '落桩后经约 10 秒有限刚度接触逐步建立支承反力，撤桩与联锁满足后卸载再随台车移动重新落桩建立', '钢桩插床具有有限弹性刚度与阻尼且受机械动作速率与安全联锁约束'),
        choiceOpt('instant_teleport', '钢桩指令一经发出船位立刻刚性瞬移锁定，反力在零秒内无限阶跃且绝不回零', '把有限刚度接触动力学误解为理想几何固定约束'),
        choiceOpt('zero_force_always', '钢桩只在装饰画面中上下移动，全程反力严格等于零', '忽略了钢桩承受纵向与横向定位反力的真实动力学耦合'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合桩尖插床入土速率、有限刚度支承和台车步进安全联锁说明反力曲线特征...',
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '完成 300 秒倒桩与台车步进运行后，从实时曲线读取钢桩反力峰值、末态稳态反力与过程横移峰值：',
      metrics: [
        dredgerMetric('spud_peak', '钢桩反力峰值', 'kN', 'spud', 'peak'),
        dredgerMetric('spud_steady', '重落桩后稳态钢桩反力', 'kN', 'spud', 'steady'),
        dredgerMetric('sway_peak', '过程横移速度峰值', 'm/s', 'sway', 'peak'),
        dredgerMetric('port_tension', '末态左缆张力量测', 'kN', 'portTension', 'steady'),
      ],
    },
    interpretationSpec: {
      checklist: ['读出落桩建立时间与反力数值', '描述 60–140 s 撤桩、台车步进与重落桩时序因果', '说明有限刚度接触与联锁逻辑对施工安全的作用'],
      placeholder: '依据钢桩反力和台车行程的变化时序，解释钢桩有限刚度支承机理及换桩前必须满足停刀、抬刀、撤桩联锁的工程原因...',
    },
  },
  4: {
    goal: '分别在左舷与右舷单侧施加绞车收/放速度脉冲，对比双缆张力响应与船体横移方向，揭示锚缆单向受拉与几何牵引规律。',
    actionSteps: [
      '运行前判断仅向单侧绞车下达负速度（收缆）指令时，该侧与对侧锚缆张力及横移速度的变化方向。',
      '先选「左舷」绞车并设定收放速度（默认 −0.015 m/s），点击「开始」完成 300 秒运行；点击「重置」后切换「右舷」再完成第 2 次 300 秒运行。',
      '在下方「左舷绞车」「右舷绞车」两槽分别点击「一键提取本工况读数」，对照两侧缆力不对称变化。',
    ],
    watch: 't=30–90 s 单侧绞车动作窗口内左缆张力 (kN)、右缆张力 (kN) 与横移速度 (m/s) 的方向及松弛侧张力归零特征。',
    conditionText: '平静无风浪无海流环境，钢桩保持模式、刀位 19.5 m，t=30–90 s 单侧绞车按设定速度收/放缆，须分别保留左舷与右舷各 1 次 300 秒完整运行。',
    suggestion: '切记锚缆只能承受拉力而不能承受推力，当一侧收缆拉动船体向该侧横摆时，对侧锚缆可能因松弛而张力跌近零。',
    predictionSpec: {
      kind: 'choice',
      prompt: '当在钢桩保持模式下仅对单侧锚缆施加负速度收缆（如左舷 −0.015 m/s）时，两侧锚缆张力与船体运动将如何演变？',
      options: [
        choiceOpt('unilateral_tension_and_sway', '收缆侧张力迅速抬升并拉动船体向该侧横移，对侧锚缆随船摆近而松弛、张力下降甚至归零', '锚缆遵循单向受拉物理律，且拉力相对钢桩支点形成偏心摆动转矩'),
        choiceOpt('symmetric_push_pull', '收缆侧产生拉力同时，放缆侧或对侧锚缆会提供相等大小的刚性推力', '绳索无法受压推船，这是锚缆区别于液压油缸的关键约束'),
        choiceOpt('no_sway_motion', '单侧收缆只会增大钢桩轴向力，船体不会产生任何横向摆动速度', '锚缆在船艏桥架处对船艉钢桩构成显著力臂，拉动必产生绕桩横摆'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合锚缆单向受拉几何关系及绕钢桩枢轴转动方向说明判断理由...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '分别完成左舷与右舷两次 300 秒单侧绞车运行后，在对应槽位点击「一键提取本工况读数」采集缆力与横移峰值：',
      slots: [
        dredgerSlot('port_winch', '左舷绞车单侧作用', '选择左舷 · 30–90 s 动作', (r) => r.courseSettings?.manualCable === 'port', [
          { key: 'cable', label: '作用绞车', extract: (r) => r.courseSettings?.manualCable === 'port' ? '左舷' : null },
          { key: 'winch_cmd', label: '设定收放速度', unit: 'm/s', extract: (r) => typeof r.courseSettings?.manualWinchMps === 'number' ? r.courseSettings.manualWinchMps.toFixed(3) : null },
          dredgerMetric('port_max', '左缆张力峰值', 'kN', 'portTension', 'max'),
          dredgerMetric('starboard_max', '右缆张力峰值', 'kN', 'starboardTension', 'max'),
          dredgerMetric('sway_peak', '横移速度峰值', 'm/s', 'sway', 'peak'),
        ]),
        dredgerSlot('starboard_winch', '右舷绞车单侧作用', '选择右舷 · 30–90 s 动作', (r) => r.courseSettings?.manualCable === 'starboard', [
          { key: 'cable', label: '作用绞车', extract: (r) => r.courseSettings?.manualCable === 'starboard' ? '右舷' : null },
          { key: 'winch_cmd', label: '设定收放速度', unit: 'm/s', extract: (r) => typeof r.courseSettings?.manualWinchMps === 'number' ? r.courseSettings.manualWinchMps.toFixed(3) : null },
          dredgerMetric('port_max', '左缆张力峰值', 'kN', 'portTension', 'max'),
          dredgerMetric('starboard_max', '右缆张力峰值', 'kN', 'starboardTension', 'max'),
          dredgerMetric('sway_peak', '横移速度峰值', 'm/s', 'sway', 'peak'),
        ]),
      ],
    },
    interpretationSpec: {
      checklist: ['对比左/右单侧收缆时两侧张力的非对称变化', '解释锚缆只承拉不承压的松弛特性', '阐述钢桩支点与缆长几何如何决定横移方向'],
      placeholder: '结合左右两槽实测缆力峰值与横移正负方向，解释锚缆单向受拉与绕钢桩力臂几何的耦合效应...',
    },
  },
  5: {
    goal: '对钢桩保持下的无切削小幅双向差动绞车激励开展时域辨识，在「评估」页签基于同一次运行冻结双通道横移模型。',
    actionSteps: [
      '运行前填写预期横移速度稳态幅值，并在 0–300 秒预测画板手绘 t=40 s 正阶跃与 t=160 s 负阶跃下的横移速度曲线。',
      '保持预设差动激励（无需调参），点击「开始」完成 300 秒运行，并在运行结束后对照叠加的实测横移曲线。',
      '前往「评估」页签选中本次运行与单一模式稳态窗（如 10–295 s），分别冻结「绞车指令 → 横移速度」与「实际绞车速度 → 横移速度」两套模型后在此一键引用。',
    ],
    watch: 't=40–100 s 正向差动与 t=160–220 s 反向差动期间横移速度量测 (m/s) 的惯性爬升斜率、阻尼衰减与双向对称性。',
    conditionText: '平静无风浪无海流环境，钢桩保持模式、绞刀离床停转（无切削，小横移约 ±2°），t=40–100 s 正向差动、t=160–220 s 反向差动，总时长 300 秒。',
    suggestion: '务必在「评估」页签对同一次第 5 步运行切换「量测通道」先后冻结 2 个通道模型，否则后续步无法推进。',
    predictionSpec: {
      kind: 'numeric_target',
      unit: 'm/s',
      targetPlaceholder: '如 0.025',
      prompt: '在 t=40 s 施加 ±0.015 m/s 差动绞车速度阶跃时，预估稳态横移速度幅值 (m/s) 并在坐标系手绘双向阶跃响应：',
      allowRationale: true,
      rationalePlaceholder: '结合差动绞车拉放线速度、桥架横移半径杠杆比与船体水动力阻尼说明响应形状...',
      sketch: {
        mode: 'prediction',
        plotId: 'time-response',
        lockPlotId: true,
        label: '运行前手绘预测：差动绞车双向阶跃下的横移速度响应',
        hint: '在 0–300 s 画板内绘出 t=40 s 正向阶跃上升及回落、t=160 s 负向阶跃下降及回零的横移速度预期曲线。',
        promptFocus: 't=40 s 正向横移阶跃与 t=160 s 反向横移阶跃的一/二阶惯性过渡响应特征',
        coordinateOverride: {
          title: '小横移双向阶跃辨识预测坐标系',
          subtitle: '0–300 s 时域响应（t=40 s 正阶跃，t=160 s 负阶跃）',
          xMin: 0,
          xMax: 300,
          yMin: -0.06,
          yMax: 0.06,
          xLabel: '时间',
          yLabel: '横移速度',
          xUnit: 's',
          yUnit: 'm/s',
          xTicks: TIME_300_TICKS,
          yTicks: [-0.06, -0.03, 0, 0.03, 0.06].map((value) => ({ value, label: value.toFixed(2) })),
          verticalMarkers: [
            { value: 40, label: 't=40s 正阶跃', color: '#0ea5e9' },
            { value: 160, label: 't=160s 负阶跃', color: '#f59e0b' },
          ],
          horizontalMarkers: [{ value: 0, label: '0 静止基线', color: '#64748b' }],
        },
        overlayExtractor: (samples) => extractDredgerSeriesOverlay(samples, 'sway', '实测横移速度 (m/s)'),
      },
    },
    observationSpec: {
      kind: 'artifact_binding',
      artifactKind: 'dual_model',
      prompt: '在「评估」页签基于同一次第 5 步运行分别冻结「绞车指令 → 横移速度」与「实际绞车速度 → 横移速度」双通道模型后，点击下方按钮一键引用：',
    },
    interpretationSpec: {
      checklist: ['记录两个冻结通道的模型阶次、参数与训练残差', '比较指令通道与实际绞车速度通道差异来源', '明确该局部模型仅适用于无切削小幅横移固定模式'],
      placeholder: '对比手绘与实测横移阶跃响应，写出两通道模型结构与参数，阐明绞车伺服—锚缆—船体耦合的等效低阶物理意义...',
    },
  },
  6: {
    goal: '使用第 5 步运行前已冻结的双通道模型，在反向小横移留出运行上分别执行实际绞车速度与指令独立验证，量化锚缆松弛非线性残差。',
    actionSteps: [
      '运行前判断正向训练的模型直接应用于反向小横移激励时残差的主要物理成因。',
      '保持预设反向激励（无需调参），点击「开始」完成 300 秒反向小横移运行。',
      '前往「评估」页签（禁止重拟合）：先用「实际绞车速度」模型做 A 模式对照，再切换「绞车指令联合」模型做 B 模式对照，最后回本栏一键引用摘要。',
    ],
    watch: '对比实际绞车速度驱动的船体预测与指令驱动的联合预测，观察反向切换与锚缆张力变化段处的曲线偏差。',
    conditionText: '平静无风浪无海流环境，钢桩保持模式、无切削反向小横移（t=40–100 s 负向、t=160–220 s 正向），总时长 300 秒（独立留出验证，禁止重拟合）。',
    suggestion: '必须先有第 5 步在运行前冻结的本人模型，并在本步「评估」页签保存 A 量测与 B 指令两类独立对照。',
    predictionSpec: {
      kind: 'choice',
      prompt: '用第 5 步冻结的线性模型直接外推预测本步反向小横移响应，残差主要源自哪类真实物理特性？',
      options: [
        choiceOpt('cable_slack_nonlinearity', '双向切换中锚缆存在单向松弛与张力非线性及绞车执行滞后，使线性外推产生一定暂态残差', '实际锚缆预紧力变化、几何角度偏移与执行动态会打破严格线性叠加'),
        choiceOpt('exact_zero_residual', '由于均在平静水池运行，独立验证残差必然严格等于零', '忽略了缆绳单向受拉非线性与时延耦合带来的模型结构误差'),
        choiceOpt('opposite_sign_gain', '反向阶跃会导致船体稳态增益正负号完全反转', '对称船体在小幅范围内响应方向遵循同一物理极性'),
      ],
      allowRationale: true,
      rationalePlaceholder: '区分船体局部线性模型外推误差与绞车执行器延迟各自在 A/B 两种对照中的体现...',
    },
    observationSpec: {
      kind: 'artifact_binding',
      artifactKind: 'comparison',
      prompt: '在「评估」页签分别完成 A（实际绞车速度）与 B（绞车指令联合）两类独立对照后，点击一键引用并在备注补录两组 RMSE 与 FIT：',
    },
    interpretationSpec: {
      checklist: ['对比 A 与 B 两类独立验证的 RMSE 与 FIT 指标', '分析锚缆松弛与几何非线性引起的模型外推偏差', '说明不重拟合留出验证对检验模型泛化可信度的意义'],
      placeholder: '列举 A、B 两组独立对照验证误差，解释为何实际绞车速度驱动通常与指令驱动存在误差差额，并界定小横移线性区间...',
    },
  },
  7: {
    goal: '调节挖泥桥架目标深度与深度量测滤波时间常数，观测刀位跟踪过程及其重力、浮力反力对船体纵倾、横摇与钢桩受力的耦合作用。',
    actionSteps: [
      '运行前输入目标下放刀位深度预估值并说明桥架质量/浮力变化对船体的影响。',
      '设定「刀位包络目标深度」（默认 20.3 m）与「深度量测滤波时间常数」，点击「开始」运行 300 秒。',
      '从曲线提取稳态刀位深度、最大深度、钢桩反力峰值与横摇峰值并分析海面参考与床面基准区别。',
    ],
    watch: '刀位深度量测 (m) 由 19.5 m 下放至设定目标的跟踪轨迹、钢桩反力变化及船体横摇/姿态耦合响应。',
    conditionText: '平静无风浪无海流环境，钢桩保持模式，无横移绞车动作、绞刀停转，桥架下放至目标深度（默认 20.3 m），总时长 300 秒。',
    suggestion: '注意海床深度基准为 20.0 m：当目标刀位深度设为 20.3 m 时，对应理论切厚为 0.3 m（海面垂向参考与床面高程协同决定）。',
    predictionSpec: {
      kind: 'numeric_target',
      unit: 'm',
      targetPlaceholder: '如 20.3',
      prompt: '开启桥架深度调节至默认目标（20.3 m）后，稳态刀位深度量测应稳定在多少米？请简述桥架下放为何牵动船体纵倾与升沉。',
      allowRationale: true,
      rationalePlaceholder: '结合桥架自身重浮力矩分布随下放倾角改变以及钢桩弹性支承约束说明耦合机理...',
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '完成 300 秒桥架调深运行后，从实时曲线读取刀位深度、钢桩反力与横摇耦合峰值：',
      metrics: [
        dredgerMetric('depth_steady', '稳态刀位深度量测', 'm', 'depth', 'steady'),
        dredgerMetric('depth_max', '最大刀位深度量测', 'm', 'depth', 'max'),
        dredgerMetric('spud_peak', '钢桩反力峰值', 'kN', 'spud', 'peak'),
        dredgerMetric('roll_peak', '横摇真值峰值', '°', 'roll', 'peak'),
      ],
    },
    interpretationSpec: {
      checklist: ['报告设定目标深度与实际稳态深度误差', '说明桥架重力—浮力—水下运动反力与船体六自由度的双向耦合', '区分海面深度参考与床面理论切厚基准'],
      placeholder: '结合实测刀位跟踪过程与钢桩反力变化，阐明桥架升降对船体姿态的反作用及滤波时间常数带来的量测滞后...',
    },
  },
  8: {
    goal: '在绞刀离床 0.5 m 的空载条件下起动绞刀至目标转速，测量轴系惯性爬升、空载功耗与零产土量，区分空转负载与土体切削负载。',
    actionSteps: [
      '运行前判断绞刀离床 0.5 m 空转时「实际移除体积」与「实际切削功率」的数值特征。',
      '设定「绞刀参考」（默认 30 rpm），点击「开始」完成 300 秒空载运行（刀位自动保持 19.5 m）。',
      '读取稳态绞刀转速、实际移除体积、实际切削功率与钢桩反力，验证空载不等于有效产土。',
    ],
    watch: '绞刀转速量测 (rpm) 的惯性加速斜坡、实际移除体积 (m³) 持续保持 0.000 以及实际切削功率 (kW) 保持零或极低空载摩擦的对比。',
    conditionText: '平静无风浪无海流环境，钢桩保持模式，刀位固定 19.5 m（海床面 20.0 m 上方 0.5 m 离床空载），绞刀加速至设定转速，时长 300 秒。',
    suggestion: '切勿把空载启动时的轴系机械功耗误算作泥土切削功率，也不要假设只要绞刀转起来就必然有挖泥产量。',
    predictionSpec: {
      kind: 'choice',
      prompt: '当绞刀在海床上 0.5 m（深度 19.5 m）旋转至 30 rpm 但不接触泥面且无横移时，产量与切削功率将如何表现？',
      options: [
        choiceOpt('zero_production_idle_power', '实际移除体积严格保持 0 m³，土体切削功率为零，总功耗仅含绞刀轴系惯性加速与水下空转阻力', '产土量与切削力矩均由刀齿切入土层与有效横移运动共同生成'),
        choiceOpt('constant_output_by_rpm', '只要绞刀达到 30 rpm，即便未接触海床也会自动按固定产量率累计体积', '忽略了刀位深度与土层边界的几何接触条件'),
        choiceOpt('instant_speed_jump', '绞刀转速在 0.01 秒内无惯性阶跃至目标值且不耗费启动机械功', '忽略了绞刀旋转传动轴系的转动惯量与加速动态'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合刀位深度与海床高程关系以及轴系转动惯量说明理由...',
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '完成 300 秒空载运行后，从曲线读取绞刀转速、移除体积、切削功率与钢桩反力稳态值：',
      metrics: [
        dredgerMetric('cutter_steady', '稳态绞刀转速量测', 'rpm', 'cutter', 'steady'),
        dredgerMetric('production_steady', '实际移除体积', 'm³', 'production', 'steady'),
        dredgerMetric('cut_power_steady', '实际切削功率', 'kW', 'cutPower', 'steady'),
        dredgerMetric('spud_steady', '钢桩反力量测', 'kN', 'spud', 'steady'),
      ],
    },
    interpretationSpec: {
      checklist: ['证实 19.5 m 离床空转时产量严格为零', '区分轴系旋转机械能与实际土体切削功率', '描述绞刀启动惯性时间响应特征'],
      placeholder: '对比空载与接床切削条件，阐明为何实际产量与切削阻矩必须由绞刀—土体接触深度与运动共同触发...',
    },
  },
  9: {
    goal: '基于第 5 步冻结的绞车联合模型开启自动横移切削，建立饱和砂层稳态切削工况并观察切削功率、产量与锚缆负载同步上升机制。',
    actionSteps: [
      '先选择第 5 步冻结的「本人冻结的绞车联合模型」，设置目标深度 20.3 m（切厚 0.3 m）、绞刀 30 rpm、横移参考 0.08 m/s 与半幅 10°。',
      '点击「冻结独立横移预测」生成理想闭环基准曲线；在预测区填写稳态横移速度预估靶标后，点击「开始」完成 600 秒运行。',
      '采集横移速度、刀位深度、切削功率、实际移除体积及缆力/桩力峰值，并在「评估」页签查看作业评价指标。',
    ],
    watch: '进入横移切削模式后，实际切削功率 (kW) 跃升、实际移除体积 (m³) 持续增长，以及横移速度、刀位深度与缆桩反力的协同响应。',
    conditionText: '平静无风浪无海流环境，饱和砂层，启用自动横移切削（默认切厚 0.3 m 即深 20.3 m，参考横移速度 0.08 m/s，绞刀 30 rpm），总时长 600 秒。',
    suggestion: '进入横移切削模式前须先点击「冻结独立横移预测」；产量与切削负载均由土体切削规律与实际运动实时生成。',
    predictionSpec: {
      kind: 'numeric_target',
      unit: 'm/s',
      targetPlaceholder: '如 0.080',
      prompt: '选中本人联合模型、设定横移参考 0.08 m/s 与目标深度 20.3 m 启动砂层切削后，稳态横移速度量测约为多少 m/s？请同时预测切削功率与缆力变化。',
      allowRationale: true,
      rationalePlaceholder: '结合 PI 速度闭环跟踪目标与砂层切厚 0.3 m 产生的横向切削阻力说明平衡状态...',
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '完成 600 秒砂层切削运行后，从曲线读取横移速度、刀位深度、切削功率、实际产量与锚缆/钢桩峰值负载：',
      metrics: [
        dredgerMetric('sway_steady', '横移速度量测稳态', 'm/s', 'sway', 'steady'),
        dredgerMetric('depth_steady', '刀位深度量测稳态', 'm', 'depth', 'steady'),
        dredgerMetric('cut_power_max', '实际切削功率峰值', 'kW', 'cutPower', 'max'),
        dredgerMetric('production_max', '累计实际移除体积', 'm³', 'production', 'max'),
        dredgerMetric('port_max', '左缆张力峰值', 'kN', 'portTension', 'max'),
        dredgerMetric('spud_max', '钢桩反力峰值', 'kN', 'spud', 'max'),
      ],
    },
    interpretationSpec: {
      checklist: ['对照第 8 步空载与本步砂层切削功耗/产量差异', '核对末段横移与深度均方根是否达到作业精度目标', '说明切削载荷与产量随切厚及横移速度动态生成机理'],
      placeholder: '依据砂层实测切削功率、产量增长率与缆桩峰值负载，说明土体切削反力如何与横移及桥架控制耦合...',
    },
  },
  10: {
    goal: '在饱和砂层下固定其余参数完成两组不同横移 PI 比例增益对照，权衡速度跟踪精度、锚缆张力与钢桩反力代价，并保存独立闭环对照。',
    actionSteps: [
      '运行前判断提高横移比例增益倍率后，横移跟踪快慢与锚缆/钢桩峰值载荷的同步变化趋势。',
      '保持模型、积分倍率及深度/转速/参考不变，先后用两组不同「比例增益相对初值」（如 0.2 与 1.0）各自先「冻结独立横移预测」再运行 600 秒并一键提取数据。',
      '前往「评估」页签选中任一次第 10 步运行，选择本人绞车指令联合模型保存 C 模式「学生模型独立闭环」对照。',
    ],
    watch: '不同比例增益下横移速度响应超调/跟踪精度与左/右缆张力峰值 (kN)、钢桩反力峰值 (kN) 之间的控制代价对比。',
    conditionText: '平静无风浪无海流环境，饱和砂层，保持联合模型、积分时间倍率、目标深度与参考速度完全一致，仅变更比例增益倍率完成 2 组 600 秒运行并保存独立闭环对照。',
    suggestion: '切勿在两次对比运行之间同时改动积分时间倍率或联合模型；另切勿漏掉去「评估」页签保存 C 独立闭环对照。',
    predictionSpec: {
      kind: 'choice',
      prompt: '保持积分倍率与模型不变，把横移 PI 比例增益倍率明显增大（如从 0.2 增至 1.0）时，最典型的工程权衡是什么？',
      options: [
        choiceOpt('faster_track_higher_tension', '横移速度响应加快、跟踪误差收敛更快，但同时会显著抬升绞车驱动变化率与锚缆/钢桩瞬态张力峰值', '高比例增益增大闭环带宽的同时放大参考变化与噪声引起的瞬态执行负荷'),
        choiceOpt('zero_tension_cost', '增益调高后跟踪变快且锚缆张力和钢桩反力反而大幅降低', '忽视了加速横移和克服切削阻力必须由更大的锚缆拉力来提供'),
        choiceOpt('no_impact', '比例增益倍率只影响理想预测曲线，对实船横移速度与缆力毫无影响', '横移速度控制器直接输出差动绞车速度指令改变实际缆力'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合闭环带宽、绞车加减速惯性与锚缆张力峰值关系阐述控制代价...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成低/高两组比例增益 600 秒运行后，分别在对应槽位提取增益参数、横移峰值与缆桩峰值负载：',
      slots: [
        dredgerSlot('pi_low', '低比例增益方案', '保持 Ti 与其余参数固定（如 Kp ≤ 0.6）', (r) => (r.initialInput.dredger?.kpMultiplier ?? 0.2) <= 0.6, [
          { key: 'kp', label: 'Kp 倍率', extract: (r) => r.initialInput.dredger?.kpMultiplier.toFixed(2) ?? null },
          { key: 'ti', label: 'Ti 倍率', extract: (r) => r.initialInput.dredger?.tiMultiplier.toFixed(2) ?? null },
          dredgerMetric('sway_peak', '横移速度峰值', 'm/s', 'sway', 'peak'),
          dredgerMetric('port_max', '左缆张力峰值', 'kN', 'portTension', 'max'),
          dredgerMetric('spud_max', '钢桩反力峰值', 'kN', 'spud', 'max'),
        ]),
        dredgerSlot('pi_high', '高比例增益对比方案', '保持 Ti 与其余参数固定（如 Kp > 0.6）', (r) => (r.initialInput.dredger?.kpMultiplier ?? 0.2) > 0.6, [
          { key: 'kp', label: 'Kp 倍率', extract: (r) => r.initialInput.dredger?.kpMultiplier.toFixed(2) ?? null },
          { key: 'ti', label: 'Ti 倍率', extract: (r) => r.initialInput.dredger?.tiMultiplier.toFixed(2) ?? null },
          dredgerMetric('sway_peak', '横移速度峰值', 'm/s', 'sway', 'peak'),
          dredgerMetric('port_max', '左缆张力峰值', 'kN', 'portTension', 'max'),
          dredgerMetric('spud_max', '钢桩反力峰值', 'kN', 'spud', 'max'),
        ]),
      ],
    },
    interpretationSpec: {
      checklist: ['对比两组增益下的横移均方根误差与张力/桩反力峰值', '分析评估页签中独立闭环预测与实船切削偏差来源', '论证砂层下兼顾跟踪与结构负荷的 PI 倍率选取依据'],
      placeholder: '依据两组实测张力峰值与独立闭环 RMSE/FIT 对照结果，权衡速度跟踪性能与机械执行代价...',
    },
  },
};
