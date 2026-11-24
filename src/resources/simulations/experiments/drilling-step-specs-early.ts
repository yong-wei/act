import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import type { SketchActualCurveSeries } from './sketch-coordinate-templates';
import type {
  StepObservationMetricDef, StepObservationSlotDef, VesselSample, VesselStep,
} from '../simulations/vessel-experiment';

export type DrillingStepSpec = Pick<
  VesselStep,
  | 'goal'
  | 'actionSteps'
  | 'watch'
  | 'conditionText'
  | 'suggestion'
  | 'predictionSpec'
  | 'observationSpec'
  | 'interpretationSpec'
> & { reportFieldGuides?: Record<string, string> };

const AXIS_LABEL: Record<string, string> = { x: '纯纵向', y: '纯横向', yaw: '纯艏摇' };
const ticks = (vals: number[]) => vals.map((value) => ({ value, label: String(value) }));
const opt = (value: string, label: string) => ({ value, label });
const met = (
  key: string, label: string, unit?: string, seriesId?: string, pickMode?: StepObservationMetricDef['pickMode'], placeholder?: string,
): StepObservationMetricDef => ({ key, label, unit, seriesId, pickMode, placeholder });
const slot = (
  id: string, label: string, conditionHint: string, matcher: ((run: VesselRunSummary) => boolean) | undefined, metrics: StepObservationMetricDef[],
): StepObservationSlotDef => ({ id, label, conditionHint, ...(matcher ? { matcher } : {}), metrics });

function extractStep5ErrorSeries(samples: VesselSample[]): SketchActualCurveSeries[] {
  if (samples.length < 2) return [];
  const stride = Math.max(1, Math.ceil(samples.length / 150));
  const picked = samples.filter((_, index) => index % stride === 0 || index === samples.length - 1);
  const northPoints: Array<{ x: number; y: number }> = [];
  const eastPoints: Array<{ x: number; y: number }> = [];
  for (const sample of picked) {
    const ramp = sample.time >= 30 ? Math.min(1, sample.time - 30) : 0;
    const north = Number.isFinite(sample.values.north) ? sample.values.north : sample.values.lfNorth;
    const east = Number.isFinite(sample.values.east) ? sample.values.east : sample.values.lfEast;
    if (Number.isFinite(north)) northPoints.push({ x: sample.time, y: north - 2 * ramp });
    if (Number.isFinite(east)) eastPoints.push({ x: sample.time, y: east + 2 * ramp });
  }
  const result: SketchActualCurveSeries[] = [];
  if (northPoints.length > 1) result.push({ id: 'actual-north-err', label: '实测北向跟踪误差 (m)', color: '#0ea5e9', points: northPoints });
  if (eastPoints.length > 1) result.push({ id: 'actual-east-err', label: '实测东向跟踪误差 (m)', color: '#f97316', points: eastPoints });
  return result;
}

export const DRILLING_STEP_SPECS_EARLY: Record<number, DrillingStepSpec> = {
  1: {
    goal: '区分半潜式平台实际六自由度运动与动力定位主动控制三通道，并识别八台全回转推进器布局',
    actionSteps: [
      '运行前先预测主动定位控制通道与自由运动通道的对应关系',
      '点击「开始」运行 120 秒静水零推力基线，观察左侧推进器矢量雷达与六自由度读数',
      '在下方通道配对卡依次标定纵荡、横荡、艏摇与升沉、横摇、纵摇所属类别，完成解释后提交',
    ],
    watch: '左侧北向/东向/航向三通道定位读数、升沉/横摇/纵摇静水恢复读数，以及八台推进器分布坐标与尾流禁区',
    conditionText: '平静海况（无风无浪无流）、理想量测、零推力命令基线，仿真时长 120 秒',
    suggestion: '第 1 步无需调节控制参数，重点核对哪三个自由度由推进器主动闭环控制、哪三个自由度依靠静水浮力复原。',
    predictionSpec: {
      kind: 'choice',
      prompt: '半潜式钻井平台在水面运动包含 6 个自由度，本实验动力定位系统主动闭环控制的是哪组通道？',
      options: [
        opt('six_all', '六个自由度全部由八台推进器主动闭环控制'),
        opt('planar_three', '仅水平三自由度（纵荡、横荡、艏摇）主动控制，垂向与横纵倾靠静水回复'),
        opt('heading_only', '仅闭环控制航向角，位置完全由系泊锚链固定'),
      ],
      allowRationale: true, rationalePlaceholder: '说明推进器布置平面与半潜平台静水回复刚度的物理原因...',
    },
    observationSpec: {
      kind: 'channel_match',
      prompt: '结合左侧六自由度状态读数与推进器布置图，逐项配对各自由度的控制归属：',
      pairs: [
        { id: 'surge', item: '纵荡（前后平移）', hint: '船体纵向', choices: ['主动定位控制通道', '静水自回复通道'] },
        { id: 'sway', item: '横荡（左右横移）', hint: '船体横向', choices: ['主动定位控制通道', '静水自回复通道'] },
        { id: 'yaw', item: '艏摇（绕垂轴转艏）', hint: '平面航向', choices: ['主动定位控制通道', '静水自回复通道'] },
        { id: 'heave', item: '升沉（垂向起伏）', hint: '吃水方向', choices: ['主动定位控制通道', '静水自回复通道'] },
        { id: 'roll', item: '横摇（左右倾斜）', hint: '横稳心复原', choices: ['主动定位控制通道', '静水自回复通道'] },
        { id: 'pitch', item: '纵摇（前后俯仰）', hint: '纵稳心复原', choices: ['主动定位控制通道', '静水自回复通道'] },
      ],
    },
    interpretationSpec: {
      placeholder: '解释为何全回转推进器仅产生水平力与转艏力矩，以及半潜平台垂向与倾角为何依赖水线面静水回复。',
      checklist: ['区分主动控制三通道与静水自回复三通道', '描述八台全回转推进器四立柱对称布置特征', '记录静水零激励下的收敛状态'],
    },
  },
  2: {
    goal: '检验单台全回转推进器施加正向脉冲后的平移方向与转艏力矩臂符号关系',
    actionSteps: [
      '在控制区任选一台推进器（建议对比左舷与右舷推进器），运行前预测北向位移与航向角符号',
      '点击「开始」完成 300 秒脉冲激励（第 30–60 秒施加 50 千牛等效正向脉冲）',
      '在下方指标卡读取并填入推进器编号与 30–60 秒前后北向、东向及航向峰值，总结力矩臂机理后提交',
    ],
    watch: '第 30–60 秒脉冲期间北向位移、东向位移与航向角的正负符号及后续惯性滑移过程',
    conditionText: '平静海况、理想量测，单台推进器于第 30–60 秒输出 50 千牛等效正向命令脉冲，总长 300 秒',
    suggestion: '俯视顺时针转艏为正航向：左舷推进器向前推产生顺时针正转艏，右舷推进器向前推产生逆时针负转艏。',
    predictionSpec: {
      kind: 'choice',
      prompt: '若选择左舷或右舷单台推进器向前施加 50 千牛推力脉冲，平台除了向前平移外，转艏航向角将如何偏转？',
      options: [
        opt('port_cw_stbd_ccw', '左舷推进器引起正航向（右偏顺时针），右舷推进器引起负航向（左偏逆时针）'),
        opt('port_ccw_stbd_cw', '左舷推进器引起负航向（左偏），右舷推进器引起正航向（右偏）'),
        opt('no_yaw', '推力仅沿纵向作用，不会产生任何转艏力矩与航向变化'),
      ],
      allowRationale: true, rationalePlaceholder: '结合推进器横向安装坐标与力矩叉积 r×F 写明判断依据...',
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '记录所选单台推进器在 30–60 秒脉冲及后续过程中的位置与航向实测峰值（保留正负号）：',
      metrics: [
        met('thruster', '所选推进器编号', undefined, undefined, undefined, '如 T1（左艉）或 T2（右艉）'),
        met('north', '北向位移峰值', 'm', 'north', 'peak'),
        met('east', '东向位移峰值', 'm', 'east', 'peak'),
        met('heading', '航向（艏摇）峰值', '°', 'heading', 'peak'),
      ],
    },
    interpretationSpec: {
      placeholder: '结合推进器坐标写出纵向力 F 与力矩臂叉积 r×F 的符号对应，并解释停止施力后位置与航向的响应延迟。',
      checklist: ['写明所选推进器位置坐标与力矩符号', '说明平移与横摇/航向耦合原因', '指出轴速爬坡与水动力阻尼对峰值的制约'],
    },
  },
  3: {
    goal: '设计并完成纯纵向、纯横向与纯艏摇三轴组合激励运行，采集多变量交叉耦合响应数据',
    actionSteps: [
      '运行前先预测施加单向组合合力时其余非激励通道是否会出现交叉耦合响应',
      '在控制区依次选择「纯纵向」「纯横向」「纯艏摇」，每完成一次 300 秒运行后立即点击对应槽位「一键提取本工况读数」',
      '确认顶部三轴进度徽章达到 3/3 后，总结耦合特征并提交进入第 4 步模型辨识',
    ],
    watch: '主激励轴的响应幅度与其余非激励通道（尤其是横荡与艏摇之间）的交叉耦合幅值，以及实际控制合力变化',
    conditionText: '平静海况、理想量测，分别对纯纵向、纯横向、纯艏摇施加交变脉冲组合激励，每组运行 300 秒',
    suggestion: '切勿绕过执行器直接注入理想合力；三轴各跑满 300 秒并及时提取各槽位指标后再进入第 4 步。',
    predictionSpec: {
      kind: 'choice',
      prompt: '当八台推进器配合产生纯纵向、纯横向或纯艏摇组合推力命令时，未直接激励的其余水平自由度将如何响应？',
      options: [
        opt('coupled', '因半潜平台立柱水动力与附加质量不对称，横荡与艏摇间会激发明显交叉耦合响应'),
        opt('decoupled', '三自由度运动完全相互正交独立，非激励通道响应恒为零'),
        opt('surge_only', '仅纵向激励会引起交叉耦合，横向与艏摇激励彼此毫无关联'),
      ],
      allowRationale: true, rationalePlaceholder: '预测哪个非激励通道更容易受横荡或艏摇交叉影响...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '分别完成纯纵向、纯横向与纯艏摇三组 300 秒物理激励，每组结束后点击提取该组主通道与交叉通道峰值：',
      slots: [
        slot('axis_x', '纯纵向组合激励', '激励方向：纯纵向', (r) => r.courseSettings?.excitationAxis === 'x', [
          { key: 'axis', label: '激励轴', extract: (r) => AXIS_LABEL[String(r.courseSettings?.excitationAxis ?? '')] ?? null },
          met('north', '主通道北向峰值', 'm', 'north', 'peak'), met('east', '交叉东向峰值', 'm', 'east', 'peak'), met('heading', '交叉航向峰值', '°', 'heading', 'peak'),
        ]),
        slot('axis_y', '纯横向组合激励', '激励方向：纯横向', (r) => r.courseSettings?.excitationAxis === 'y', [
          met('east', '主通道东向峰值', 'm', 'east', 'peak'), met('north', '交叉北向峰值', 'm', 'north', 'peak'), met('heading', '交叉航向峰值', '°', 'heading', 'peak'),
        ]),
        slot('axis_yaw', '纯艏摇组合激励', '激励方向：纯艏摇', (r) => r.courseSettings?.excitationAxis === 'yaw', [
          met('heading', '主通道航向峰值', '°', 'heading', 'peak'), met('north', '交叉北向峰值', 'm', 'north', 'peak'), met('east', '交叉东向峰值', 'm', 'east', 'peak'),
        ]),
      ],
    },
    interpretationSpec: {
      placeholder: '对比三组激励中的主通道与交叉通道幅度，分析产生交叉耦合的流体与执行器动态原因。',
      checklist: ['集齐纯纵向、纯横向、纯艏摇三次完整激励', '量化记录交叉耦合通道峰值', '说明通过八推分配产生组合合力的物理意义'],
    },
  },
  4: {
    goal: '基于第 3 步三轴激励数据离线辨识并冻结 3×3 低频耦合模型，辨明主对角与交叉耦合矩阵项',
    actionSteps: [
      '先在下方完成纯分析预测题，判断 3×3 输入输出矩阵中主对角与非对角项的物理含义',
      '打开右侧「评估」页签，确认导入第 3 步三轴运行与合适分析窗后点击「冻结本人三通道模型」',
      '在矩阵视图核对主通道对角元素与交叉耦合项后，返回此处点击「一键引用已冻结工件摘要」并提交',
    ],
    watch: '评估页签辨识所得 3×3 状态矩阵 A 与输入矩阵 B 的主对角项量级、非对角交叉项及训练残差均方根',
    conditionText: '离线分析步骤（无需运行新仿真），使用第 3 步三轴物理激励运行记录',
    suggestion: '若模型参数缺失，请检查第 3 步三轴激励是否均已跑满 300 秒并正确选入评估页签对应下拉框。',
    predictionSpec: {
      kind: 'choice',
      prompt: '在即将辨识的 3×3 低频离散状态模型中，输入响应矩阵 B 的主对角元素与非对角元素分别代表什么物理含义？',
      options: [
        opt('diag_main_off_cross', '主对角项反映同轴控制力对本自由度的直接增益，非对角项刻画轴间交叉耦合影响'),
        opt('diag_noise_off_wave', '主对角项表示传感测量噪声，非对角项表示外部一阶波浪载荷'),
        opt('all_zero_off', '理想对称船体下矩阵 B 严格为对角阵，非对角项仅为数值舍入误差'),
      ],
      allowRationale: true, rationalePlaceholder: '对比降阶三通道低频模型与后台全六自由度水动力仿真的差异...',
    },
    observationSpec: {
      kind: 'artifact_binding', artifactKind: 'dp_model',
      prompt: '请在「评估」页签冻结本人三通道低频模型后，点击下方按钮一键绑定矩阵与训练残差摘要：',
    },
    interpretationSpec: {
      placeholder: '写出已冻结 3×3 矩阵的主通道元素特征与显著交叉耦合项，说明教学降阶模型与真实六自由度物理对象的简化边界。',
      checklist: ['绑定已冻结 3×3 模型 A 与 B 矩阵摘要', '指出主通道与最显著交叉耦合通道', '界定低频降阶模型的适用假设与简化忽略项'],
    },
  },
  5: {
    goal: '利用未参与训练的新小位移运行独立检验第 4 步冻结的三通道模型，定量评估留出预测残差',
    actionSteps: [
      '运行前先选择预测结论并在坐标系画板手绘 t=30s 目标阶跃 (2, −2) m 后北向/东向跟踪误差的过渡轨迹',
      '点击「开始」完成 300 秒小位移独立运行（本步为盲测检验，不可回退重拟合训练模型）',
      '打开画板「叠加实测运行轨迹对照」比较误差形态，并到「评估」页签点击「保存独立三通道对照」后一键引用 RMSE 与拟合度提交',
    ],
    watch: '评估页签中北向、东向、航向三条独立对照曲线的均方根误差（RMSE）与拟合优度（FIT），以及画板预测偏差',
    conditionText: '平静海况、理想量测，第 30 秒给定 (2, −2) 米、0° 小位移目标阶跃，运行 300 秒（独立留出验证）',
    suggestion: '切勿在独立验证阶段重新拟合覆盖模型；控制误差分析应聚焦执行器滞后与未建模高阶水动力耦合。',
    predictionSpec: {
      kind: 'choice',
      prompt: '使用第 4 步冻结的局部低频模型对第 5 步全新 (2, −2) 米小位移工况作开环对照预测，结果预期如何？',
      options: [
        opt('close_with_residual', '低频主趋势与实船高度吻合，但在阶跃初期因执行器转向和轴速滞后存在局部残差'),
        opt('zero_error', '冻结模型与真实六自由度仿真完全等价，三通道预测误差处处为零'),
        opt('divergent', '小位移阶跃即超出线性化范围，模型预测将在 60 秒内发散'),
      ],
      allowRationale: true, rationalePlaceholder: '预估北向/东向在阶跃瞬态与稳态段的吻合程度及误差来源...',
      sketch: {
        mode: 'prediction', plotId: 'time-response', lockPlotId: true,
        label: '运行前手绘预测：小位移定位误差过渡曲线',
        hint: '在 t=30s 目标阶跃处用深蓝画北向跟踪误差 (m)、橙红画东向跟踪误差 (m) 的暂态跳变与收敛回零趋势。',
        coordinateOverride: {
          title: '小位移定位误差过渡预测坐标系', subtitle: 't=30s 阶跃 (2, −2) m · 深蓝北向误差 / 橙红东向误差',
          xMin: 0, xMax: 300, yMin: -3, yMax: 3, yLabel: '位置跟踪误差', yUnit: 'm',
          xTicks: ticks([0, 60, 120, 180, 240, 300]), yTicks: ticks([-3, -2, -1, 0, 1, 2, 3]),
          verticalMarkers: [{ value: 30, label: 't=30s 目标阶跃', color: '#0ea5e9' }],
          horizontalMarkers: [{ value: 0, label: '0 稳态误差线', color: '#10b981' }],
        },
        promptFocus: '核查 t=30s 前保持 0 误差、t=30s 出现 ±2m 阶跃偏差并在稳态平滑衰减回 0 的过渡曲线形态。',
        overlayExtractor: extractStep5ErrorSeries,
      },
    },
    observationSpec: {
      kind: 'artifact_binding', artifactKind: 'comparison',
      prompt: '运行完成后请在「评估」页签点击「保存独立三通道对照」，再点击下方按钮引用北向/东向/航向 RMSE 与 FIT：',
    },
    interpretationSpec: {
      placeholder: '对照手绘预期与实船误差曲线，结合三通道 RMSE/FIT 分析局部线性模型在小位移瞬态的残差成因。',
      checklist: ['已完成独立运行前手绘预测与实测轨迹比对', '绑定北向/东向/航向三通道独立对照结果', '分析轴系延迟与交叉耦合残差成因'],
    },
  },
  6: {
    goal: '整定三通道独立比例—微分定位闭环带宽，权衡响应速度、超调量与推进功耗',
    actionSteps: [
      '运行前先在下方排序卡按预期调节速度由快到慢排列三档闭环带宽，建立预测假设',
      '先以基准带宽 0.025 rad/s 运行 600 秒并提取第一行读数，再重置切换 0.015 或 0.04 rad/s 运行 600 秒并提取第二行读数',
      '对比两侧末 180 秒定位均方根、航向波动与正机械功峰值，完成因果解释后提交',
    ],
    watch: '不同带宽下北向/东向到达目标时间、航向交叉偏转峰值及正机械功与峰值功率的变化幅度',
    conditionText: '平静海况、理想量测，目标位置 (5, 3) 米、目标航向 5°，固定其余参数仅调闭环带宽一档，每组运行 600 秒',
    suggestion: '本步需保留两组不同闭环带宽的 600 秒完整运行；其余控制参数已折叠锁定以保证严格单因素对照。',
    predictionSpec: {
      kind: 'ranking',
      prompt: '将三档定位闭环带宽按「预期响应最快且初期峰值功率最高」到「响应最平缓且功率波动最低」从高到低排序：',
      rankItems: ['0.04 rad/s（高带宽）', '0.025 rad/s（基准带宽）', '0.015 rad/s（低带宽）'],
      allowRationale: true, rationalePlaceholder: '说明带宽提升对比例/微分增益及推进器指令幅度的影响...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '保持其余参数不变，依次运行基准带宽与调档带宽两组 600 秒定位实验并提取指标：',
      slots: [
        slot('bw_base', '基准带宽（0.025 rad/s）', '带宽 = 0.025 rad/s', (r) => r.courseSettings?.bandwidthRadS === 0.025, [
          { key: 'bw', label: '带宽', unit: 'rad/s', extract: (r) => String(r.courseSettings?.bandwidthRadS ?? '') },
          met('north', '北向稳态值', 'm', 'north', 'steady'), met('heading', '航向峰值', '°', 'heading', 'peak'), met('power', '正机械功率峰值', 'MW', 'power', 'max'),
        ]),
        slot('bw_alt', '调档带宽（0.015 或 0.04 rad/s）', '带宽 ≠ 0.025 rad/s',
          (r) => r.courseSettings?.bandwidthRadS !== undefined && r.courseSettings?.bandwidthRadS !== 0.025, [
            { key: 'bw', label: '带宽', unit: 'rad/s', extract: (r) => String(r.courseSettings?.bandwidthRadS ?? '') },
            met('north', '北向稳态值', 'm', 'north', 'steady'), met('heading', '航向峰值', '°', 'heading', 'peak'), met('power', '正机械功率峰值', 'MW', 'power', 'max'),
          ]),
      ],
    },
    interpretationSpec: {
      placeholder: '量化对比两档带宽下的定位速度、耦合超调与推进能耗，说明高带宽易受执行器限速制约的物理权衡。',
      checklist: ['完成两组不同闭环带宽的 600 秒单因素对照', '对比位置调节快慢与峰值功率代价', '指出高带宽激发耦合振荡或饱和的风险'],
    },
  },
  7: {
    goal: '比较开启与关闭本人模型交叉通道解耦补偿对期望控制合力及耦合跟踪误差的影响',
    actionSteps: [
      '运行前先预测模型解耦补偿如何改变控制输出，并判断其是否改变后台船体真实耦合物理',
      '保持闭环带宽等其余基线不变，分别运行「关闭解耦补偿」与「开启本人模型交叉通道补偿」（需选中第 4 步冻结模型）各 600 秒',
      '每组结束后一键提取对比指标，解释解耦补偿机制及模型残余误差影响后提交',
    ],
    watch: '开启解耦前后期望横向力与期望艏摇力矩曲线形态、航向暂态偏转及末 180 秒位置/航向均方根差异',
    conditionText: '平静海况、理想量测，目标位置 (5, 3) 米、目标航向 5°，固定其余参数仅切换解耦补偿开关，每组运行 600 秒',
    suggestion: '开启解耦补偿时需选中第 4 步已冻结的三通道模型；关闭与开启两次运行请保持相同闭环带宽。',
    predictionSpec: {
      kind: 'choice',
      prompt: '开启基于本人三通道矩阵 B 逆的交叉通道解耦补偿后，定位控制律究竟改变了什么？',
      options: [
        opt('control_precomp', '在控制器输出端预先叠加反向交叉力/力矩指令，从而抵消部分通道间动态耦合'),
        opt('physics_off', '直接关闭后台真实船体的流体交叉耦合动力学，使平台变成解耦理想刚体'),
        opt('no_effect', '只改变界面曲线显示标签，对推进器实际分配推力没有影响'),
      ],
      allowRationale: true, rationalePlaceholder: '预估解耦后横向定位与转艏相互牵连的幅度变化...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '分别采集关闭解耦与开启本人模型解耦补偿的 600 秒运行读数进行对照：',
      slots: [
        slot('dec_off', '关闭模型解耦补偿', '交叉补偿：关', (r) => r.courseSettings?.decoupling === false, [
          met('east', '东向末段位置', 'm', 'east', 'steady'), met('heading', '航向偏差峰值', '°', 'heading', 'peak'), met('reqY', '期望横向力峰值', 'kN', 'requestedY', 'peak'),
        ]),
        slot('dec_on', '开启本人模型解耦补偿', '交叉补偿：开', (r) => r.courseSettings?.decoupling === true, [
          met('east', '东向末段位置', 'm', 'east', 'steady'), met('heading', '航向偏差峰值', '°', 'heading', 'peak'), met('reqY', '期望横向力峰值', 'kN', 'requestedY', 'peak'),
        ]),
      ],
    },
    interpretationSpec: {
      placeholder: '阐明解耦补偿改变的是控制器期望输出而非后台船体物理，并解释由于辨识误差和执行器延迟导致的残余耦合。',
      checklist: ['明确解耦补偿作用于控制输出而非关闭船体耦合', '对比解耦前后的期望力曲线与跟踪误差', '结合第 4 步模型矩阵解释残余误差来源'],
    },
  },
  8: {
    goal: '检验定常海流下积分与抗饱和控制对消除稳态定位偏差的作用，并区分对水速度与对地速度',
    actionSteps: [
      '运行前先预测无积分与有积分控制器在定常东向海流中的稳态位置偏差及速度读数差异',
      '固定其余基线参数，依次运行「关闭积分」与「开启积分与抗饱和（积分时间 200 秒）」各 600 秒并提取对应槽位读数',
      '分析抵流守位时推进器建立的稳态平均推力与对水/对地速度物理区别后提交',
    ],
    watch: '东向稳态偏移量、正机械功率稳态底值，以及「对水纵向速度」与「对地纵向速度」的差值',
    conditionText: '定常东向海流（流速 0.5 米/秒、流向正东 90°）、无风无浪、理想量测，目标保持原点，仅切换积分开关，每组运行 600 秒',
    suggestion: '关闭与开启积分对照时，请保持同一带宽与前序参数；开积分后建议先固定积分时间 200 秒完成开关对比。',
    predictionSpec: {
      kind: 'choice',
      prompt: '在定常海流扰动下目标保持原点，开启积分与抗饱和后稳态定位误差及「对水/对地速度」将呈现何种状态？',
      options: [
        opt('zero_offset_relative_flow', '积分累积出恒定抵流推力使对地位置误差趋近于零，稳态时对地速度近零而对水速度与海流相抵'),
        opt('both_zero_speed', '积分消除位置误差后，对水速度与对地速度将同时归零'),
        opt('pd_enough', '纯比例微分控制即可完全消除定常海流稳态漂移，无需积分环节'),
      ],
      allowRationale: true, rationalePlaceholder: '解释定常扰动下比例控制为何必然留有静态余差...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '对比无积分与开启积分抵流的两组 600 秒运行数据（注意区分对水与对地速度）：',
      slots: [
        slot('int_off', '关闭积分（纯比例微分）', '积分控制：关', (r) => r.courseSettings?.integralEnabled === false, [
          met('east', '东向稳态偏移', 'm', 'east', 'steady'), met('waterSpeed', '稳态对水速度', 'm/s', 'waterSpeed', 'steady'), met('groundSpeed', '稳态对地速度', 'm/s', 'groundSpeed', 'steady'),
        ]),
        slot('int_on', '开启积分与抗饱和', '积分控制：开', (r) => r.courseSettings?.integralEnabled === true, [
          met('east', '东向稳态偏移', 'm', 'east', 'steady'), met('waterSpeed', '稳态对水速度', 'm/s', 'waterSpeed', 'steady'), met('groundSpeed', '稳态对地速度', 'm/s', 'groundSpeed', 'steady'),
        ]),
      ],
    },
    interpretationSpec: {
      placeholder: '对比关闭与开启积分后的东向稳态偏移，解释积分项累积抵消慢变海流载荷的机理以及抗饱和的重要性。',
      checklist: ['对比无积分静态余差与有积分抵流守位效果', '清晰区分对水速度与对地速度参考系差异', '说明积分时间与抗饱和对防止超调的必要性'],
    },
  },
  9: {
    goal: '比较测量风前馈对抑制阵风瞬间偏移的效果，并辨析风速测量与风载模型不确定性的残余影响',
    actionSteps: [
      '运行前先预测开启测量风前馈后，风扰动下的暂态偏移峰值与稳态积分负担将如何变化',
      '保持其余基线控制参数固定，依次运行「关闭测量风前馈」与「开启测量风前馈」各 600 秒并提取槽位读数',
      '对比阵风下北向/东向最大偏移与机械功率响应速度，分析前馈与反馈协同机理后提交',
    ],
    watch: '阵风来袭初期北向与东向最大位置误差、期望控制力响应快慢，以及开启前馈后是否仍需积分消除模型误差',
    conditionText: '阵风环境（平均风速 12 米/秒、阵风标准差 2 米/秒、来向 60°）、无浪无流、理想量测，目标保持原点，每组运行 600 秒',
    suggestion: '确保两次运行仅切换「启用测量风前馈」开关，其余基线参数保持一致。',
    predictionSpec: {
      kind: 'choice',
      prompt: '在阵风环境中开启测量风前馈补偿后，系统定位响应与残留误差有何规律？',
      options: [
        opt('faster_less_peak', '在位置产生大偏移前提前输出抵消推力，显著压低暂态漂移峰值，但因风力模型误差仍需反馈积分收敛'),
        opt('replace_feedback', '前馈可以完全取代闭环反馈与积分，实现绝对零误差定位'),
        opt('increase_drift', '风前馈会放大传感器时滞，导致初始位置偏移比纯反馈更大'),
      ],
      allowRationale: true, rationalePlaceholder: '说明风速仪前馈与位置反馈积分在频段和抗不确定性上的分工...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '采集关闭与开启测量风前馈的两组 600 秒运行最大偏移与功率指标：',
      slots: [
        slot('wind_off', '关闭测量风前馈', '风前馈：关', (r) => r.courseSettings?.windFeedforward === false, [
          met('north', '北向误差峰值', 'm', 'north', 'peak'), met('east', '东向误差峰值', 'm', 'east', 'peak'), met('power', '正机械功率峰值', 'MW', 'power', 'max'),
        ]),
        slot('wind_on', '开启测量风前馈', '风前馈：开', (r) => r.courseSettings?.windFeedforward === true, [
          met('north', '北向误差峰值', 'm', 'north', 'peak'), met('east', '东向误差峰值', 'm', 'east', 'peak'), met('power', '正机械功率峰值', 'MW', 'power', 'max'),
        ]),
      ],
    },
    interpretationSpec: {
      placeholder: '结合阵风实测数据阐明前馈提前抵消可测扰动、反馈消除未建模风压偏差与阵风估计误差的互补机制。',
      checklist: ['对比前后馈开关对初始偏移峰值的抑制效果', '指出测量风速采样与风力系数模型误差', '解释为何前馈仍需与积分反馈配合'],
    },
  },
  10: {
    goal: '观察一阶波浪载荷下的升沉/横摇/纵摇波频运动及推力脉动，确立波频不强行抵消的工程原则',
    actionSteps: [
      '运行前先预测一阶波频振动下推进器试图逐周期全额抵消高频波浪力会带来什么后果',
      '在控制区确认第 10 步基准控制器方案后启动 600 秒运行（该控制器将自动作为第 11 步基线锁定）',
      '从曲线读取升沉/横摇/纵摇幅值及推进正机械功率脉动峰值，阐明推进器出力边界后提交',
    ],
    watch: '升沉、横摇、纵摇高频振荡曲线，以及水平三通道控制合力与正机械功率随波频脉动的幅度',
    conditionText: '中等波浪（有效波高 1.5 米、谱峰周期 8.0 秒，仅开启一阶波频载荷、关闭二阶慢漂）、理想量测，运行 600 秒',
    suggestion: '本步选定的控制器方案将自动同步至第 11 步并锁定，请运行满 600 秒以便后续直接开展二阶慢漂对照。',
    predictionSpec: {
      kind: 'choice',
      prompt: '面对周期约 8 秒的一阶波频运动与波浪力，动力定位推进系统是否应当追求将全部波频振荡抵消至零？',
      options: [
        opt('avoid_cancel', '不应以无限推力抵消全部波频运动，高频抵消会耗尽功率、加剧转向磨损且无法抑制垂荡/横纵倾'),
        opt('cancel_all', '应当大幅提高带宽用最大推进推力逐周期消除全部一阶位置与横摇振荡'),
        opt('no_thruster_motion', '一阶波浪零均值，因此不会对推进功率和位置量测造成任何波动'),
      ],
      allowRationale: true, rationalePlaceholder: '从推进器转向速率、功率极限与平台浮力恢复频段解释原因...',
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '记录一阶波浪下垂向/倾角波频响应幅值与推进器机械功率脉动：',
      metrics: [
        met('heave', '升沉峰值幅度', 'm', 'heave', 'peak'),
        met('roll', '横摇峰值幅度', '°', 'roll', 'peak'),
        met('pitch', '纵摇峰值幅度', '°', 'pitch', 'peak'),
        met('power', '正机械功率峰值', 'MW', 'power', 'max'),
        met('north', '北向末段稳态均值参考', 'm', 'north', 'steady'),
      ],
    },
    interpretationSpec: {
      placeholder: '对比主动控制三通道出力脉动与自回复三通道波频响应，论证为何后续必须引入波浪滤波隔离高频振动。',
      checklist: ['记录升沉/横摇/纵摇波频运动幅值', '统计波频激励引起的推进功率无效脉动', '论证不以无限推力对抗一阶波频运动的物理边界'],
    },
  },
};
