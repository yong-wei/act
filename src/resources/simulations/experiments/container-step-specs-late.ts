import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import type { StepObservationMetricDef } from '../simulations/vessel-experiment';
import {
  choiceOpt,
  extractContainerArrivalEta,
  extractContainerLoadingRatio,
  extractContainerSpeedActualSeries,
  type ContainerStepWorkbenchSpec,
} from './container-step-specs-early';

function extractContainerVoyagePlan(run: VesselRunSummary): string | null {
  const speeds = run.configuration.containerVoyage?.segmentSpeedsMps;
  return speeds ? speeds.map((value) => value.toFixed(1)).join(' / ') : null;
}

function extractFilterAndLos(run: VesselRunSummary): string | null {
  const ctrl = run.initialInput.containerSpeed;
  return ctrl ? `滤波 ${ctrl.filterTauS} s / 前视 ${ctrl.losLookaheadM ?? 400} m` : null;
}

function voyageComparisonMetrics(
  firstKey: string,
  firstLabel: string,
  extractFirst: (run: VesselRunSummary) => string | null,
): StepObservationMetricDef[] {
  return [
    { key: firstKey, label: firstLabel, extract: extractFirst },
    { key: 'eta', label: '实际 ETA', unit: 's', extract: extractContainerArrivalEta },
    { key: 'fuel', label: '累计教学燃油', unit: 'kg', seriesId: 'fuel', pickMode: 'steady' },
    { key: 'cross_track', label: '最大横偏', unit: 'm', seriesId: 'east', pickMode: 'peak' },
  ];
}

const planMetrics = (): StepObservationMetricDef[] => [
  { key: 'plan', label: '四段航速', unit: 'm/s', extract: extractContainerVoyagePlan },
  { key: 'eta', label: '实际 ETA', unit: 's', extract: extractContainerArrivalEta },
  { key: 'fuel', label: '累计教学燃油', unit: 'kg', seriesId: 'fuel', pickMode: 'steady' },
  { key: 'end_speed', label: '终点航速', unit: 'm/s', seriesId: 'speed', pickMode: 'steady' },
];

const waveMetrics = (): StepObservationMetricDef[] => [
  { key: 'mode', label: '附加阻力', extract: (r) => (r.configuration.meanWaveResistanceModel ? '已开启' : '已关闭') },
  { key: 'eta', label: '实际 ETA', unit: 's', extract: extractContainerArrivalEta },
  { key: 'fuel', label: '累计教学燃油', unit: 'kg', seriesId: 'fuel', pickMode: 'steady' },
  { key: 'second_order', label: '二阶波浪力', unit: 'kN', seriesId: 'secondOrder', pickMode: 'steady' },
];

const TIME_900_TICKS = [0, 180, 360, 540, 720, 900].map((value) => ({ value, label: String(value) }));
const SPEED_9_TICKS = [7.0, 7.5, 8.0, 8.5, 9.0].map((value) => ({ value, label: value.toFixed(1) }));
const isLoad = (run: VesselRunSummary, target: number) => Math.abs((run.configuration.loadingRatio ?? -1) - target) < 1e-6;

export const CONTAINER_STEP_SPECS_LATE: Record<number, ContainerStepWorkbenchSpec> = {
  11: {
    goal: '完成 6000 m 静水匀速航次预测与实船航行，对比速度立方近似法与实际功率积分燃油的数值差异。',
    actionSteps: [
      '运行前输入预期到达时间（s），并在预测坐标画板手绘 6000 m 匀速航次的对水速度过程。',
      '核对四段航速已锁定为 8.0 m/s，点击「冻结理想速度与航次预测」生成理论 ETA 与理想燃油估计。',
      '点击「开始」跑完 6000 m 航次（到达即停），在下方引用冻结预测摘要并记录实测 ETA 与油耗差值。',
    ],
    watch: '实际到达时间贴近 750 s（远小于 900 s 时限），重点观察加速瞬态与辅机/推进效率曲线导致的实际累计燃油 (kg) 与理想代理预测差额。',
    conditionText: '平静无风浪流环境，60% 中载，四段航速全部固定为 8.0 m/s，执行北向 6000 m 航次（到达时限 900 s，运行上限 1200 s）。',
    suggestion: '必须先点击「冻结理想速度与航次预测」后再开始实船运行；切勿把教学代理油耗写成实船实测油耗。',
    predictionSpec: {
      kind: 'numeric_target',
      unit: 's',
      targetPlaceholder: '如 750',
      prompt: '在 6000 m 静水航程与恒定 8.0 m/s 参考航速下，预估实船实际到达时间 ETA (s) 并绘制航次速度过程：',
      allowRationale: true,
      rationalePlaceholder: '结合 6000/8=750 s 运动学基准与起航速度维持特性说明预估依据...',
      sketch: {
        mode: 'prediction',
        plotId: 'time-response',
        lockPlotId: true,
        label: '运行前手绘预测：6000m 匀速航次对水速度与稳态过程',
        hint: '在 0–900 s 坐标系中绘制约 8.0 m/s 的稳态航速保持过程，并标记 ~750 s 预计到达节点。',
        promptFocus: '预期 6000m 匀速航次对水速度与达标稳态过程',
        coordinateOverride: {
          title: '6000m 静水航次对水航速预测坐标系',
          subtitle: '0–900 s 时域过程（目标 8.0 m/s，900 s 为准点红线）',
          xMin: 0,
          xMax: 900,
          yMin: 7.0,
          yMax: 9.0,
          xTicks: TIME_900_TICKS,
          yTicks: SPEED_9_TICKS,
          verticalMarkers: [
            { value: 750, label: '预计到达 ~750s', color: '#10b981' },
            { value: 900, label: '900s 时限', color: '#f59e0b' },
          ],
          horizontalMarkers: [{ value: 8.0, label: '目标 8.0 m/s', color: '#64748b' }],
        },
        overlayExtractor: (samples) => extractContainerSpeedActualSeries(samples),
      },
    },
    observationSpec: {
      kind: 'artifact_binding',
      artifactKind: 'comparison',
      prompt: '航次结束后，点击一键引用冻结预测摘要（理想 ETA 与理想燃油），并在备注中补记实测 ETA 与实测累计燃油 (kg)：',
    },
    interpretationSpec: {
      checklist: ['对比理想预测与实测 ETA 数值', '解释速度立方固定工作点近似与实际轴功率积分燃油的差异', '界定教学估计燃油曲线的适用前提'],
      placeholder: '分析理想速度立方预测与实测功率积分燃油产生偏差的原因，说明推进效率曲线与加速动态的影响...',
    },
  },
  12: {
    goal: '在相同 6000 m 航程与相近到达约束下比较至少两组四段航速计划，检验均速分配与分段变速的经济性差异。',
    actionSteps: [
      '运行前在预测区按预计累计教学燃油从低到高排序三类四段速度分配策略。',
      '保持第一组为基准均速或前高后低（如 8.0/8.0/8.0/8.0 m/s），点击「开始」跑完 6000 m。',
      '点击「重置」并修改为第二组对比四段速度计划（第 4 段贴近 8.0 m/s 保持末动能一致），跑完后提取两组结果。',
    ],
    watch: '对比两组计划在权衡天平上的 ETA 裕量与累计教学燃油 (kg)，核对第 4 段末速是否落在 8.0±0.3 m/s 口径区间内。',
    conditionText: '平静无风浪流环境，60% 中载，6000 m 四段航程（每段 1500 m，时限 900 s），至少保存 2 组不同四段速度计划。',
    suggestion: '为保证油耗比较公平，两方案均应实际到达 6000 m 且末段速度保持接近 8.0 m/s。',
    predictionSpec: {
      kind: 'ranking',
      prompt: '在相同 6000 m 总航程、均满足 900 s 到达与相同末动能前提下，按累计教学油耗由省到费排序：',
      rankItems: [
        '恒定均速方案（各段维持相近经济航速，避免高速立方惩罚）',
        '温和微调方案（小幅前快后慢并在末段平稳回落至 8.0 m/s）',
        '大起大落变速方案（某段大幅提速引起功率随速度三次方陡增与加减速额外耗功）',
      ],
      allowRationale: true,
      rationalePlaceholder: '利用推进功率近似与航速三次方成正比的凸函数性质解释为何大幅变速更费油...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成至少两组不同四段速度计划的完整航次后，分别一键提取速度计划、ETA、累计燃油与末态航速：',
      slots: [
        {
          id: 'plan_a',
          label: '计划一（均速或前段提速）',
          conditionHint: '第一组四段航速方案',
          matcher: (r) => { const s = r.configuration.containerVoyage?.segmentSpeedsMps; return Boolean(s && (s.every((v) => Math.abs(v - 8) < 1e-6) || s[0] > s[3])); },
          metrics: planMetrics(),
        },
        {
          id: 'plan_b',
          label: '计划二（分段变速对比）',
          conditionHint: '第二组不同四段航速方案',
          matcher: (r) => { const s = r.configuration.containerVoyage?.segmentSpeedsMps; return Boolean(s && !s.every((v) => Math.abs(v - 8) < 1e-6) && s[0] <= s[3]); },
          metrics: planMetrics(),
        },
      ],
    },
    interpretationSpec: {
      checklist: ['确认两方案的到达时间、末速与横偏达标情况', '用 P∝V³ 功率三次方特征解释流速或计划波动带来的附加油耗', '总结相同任务条件下的经济航速分配准则'],
      placeholder: '定量对比两组四段航速方案的 ETA 与教学燃油差额，阐明初末动能一致前提下的经济性机制...',
    },
  },
  13: {
    goal: '在恒定海流扰动下对比对水计程仪反馈与低频对地航速反馈，辨析经济航速定义与大地准点率之间的差异。',
    actionSteps: [
      '在预测区判断存在向东横流时，选用「低频对地航速估计」与「对水计程仪」反馈对 ETA 和功耗的影响。',
      '选定四段航速与 LOS 前视距离后，先以「对水计程仪」反馈完成 1 次 6000 m 航次。',
      '点击「重置」，保持航速计划与前视距不变，切换为「低频对地航速估计」完成第 2 次并提取对照数据。',
    ],
    watch: '曲线上关注「对水航速 (m/s)」与「低频对地航速估计 (m/s)」的差值，以及航迹纠偏时的东向横偏 (m) 与到达时间变化。',
    conditionText: '存在 0.3 m/s 东向定常均匀海流（无风无浪），60% 中载，在相同速度计划下对比对水计程仪与对地速度估计反馈。',
    suggestion: '切勿在两次运行之间更改四段航速计划或 LOS 前视距离，确保单因素对比严谨有效。',
    predictionSpec: {
      kind: 'choice',
      prompt: '存在海流干扰且需守住 900 s 准点到达门限时，将速度反馈切换为「低频对地航速估计」相比「对水计程仪」会怎样？',
      options: [
        choiceOpt('ground_locks_eta', '对地反馈直接锁定大地到达时间，但在顶流或纠偏分流下水动力推力与油耗会相应抬升', '推进能耗取决于船体相对水速，而北向航程推进取决于相对地速'),
        choiceOpt('water_ignores_current', '对水反馈能无视任意顺逆流影响并始终保持完全不变的到达时间', '混淆了对水相对速度与对地绝对速度的物理参照系'),
        choiceOpt('same_speed_reading', '海流中对水计程仪读数与低频对地估计数值永远相等', '两者矢量差恰好体现海流流速与漂角投影'),
      ],
      allowRationale: true,
      rationalePlaceholder: '区分船体水动力阻力参照系（对水）与航次准点积分参照系（对地）...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '分别完成对水反馈与对地反馈两组航次后，点击一键提取各自的 ETA、累计燃油与最大航迹横偏：',
      slots: [
        { id: 'fb_water', label: '对水计程仪反馈', conditionHint: '水速闭环模式', matcher: (r) => r.initialInput.containerSpeed?.feedback === 'water', metrics: voyageComparisonMetrics('feedback', '反馈通道', (r) => (r.initialInput.containerSpeed?.feedback === 'ground' ? '低频对地' : '对水计程仪')) },
        { id: 'fb_ground', label: '低频对地航速反馈', conditionHint: '地速闭环模式', matcher: (r) => r.initialInput.containerSpeed?.feedback === 'ground', metrics: voyageComparisonMetrics('feedback', '反馈通道', (r) => (r.initialInput.containerSpeed?.feedback === 'ground' ? '低频对地' : '对水计程仪')) },
      ],
    },
    interpretationSpec: {
      checklist: ['对比对水与对地反馈下的对地/对水速度差、ETA 与燃油', '说明为何经济航速以对水为基准而准点率以对地为准', '分析 LOS 前视距离在横流偏漂抑制中的作用'],
      placeholder: '结合实测 ETA 与横偏数据，阐述海流存在时对水速度控制与对地准点目标之间的协同与取舍...',
    },
  },
  14: {
    goal: '保持航速计划与控制参数不变检验风载荷下轻载与重载航次，梳理「装载—风面积—偏航舵角—功耗」耦合因果链。',
    actionSteps: [
      '运行前判断相同斜风场下 0.2 轻载与 0.9 重载在横偏、压舵角与油耗上的差异。',
      '保持控制与航速计划不变，依次选择装载率 0.2 与 0.9 各完成 1 次 6000 m 风力航次。',
      '在下方两槽分别一键提取 ETA、累计教学燃油与最大横偏，对照第 2 步的风面积参数解释原因。',
    ],
    watch: '观察东向横偏 (m) 峰值、航向量测 (°) 漂角、纠偏舵角引起的横摇警告以及由此产生的额外推进油耗 (kg) 增量。',
    conditionText: '约 8 m/s 东北斜来风（含阵风波动，无浪无流），固定航速计划与控制参数，对比 20% 轻载与 90% 重载航次。',
    suggestion: '本步两轮对比必须保持完全相同的控制增益与四段航速计划，仅切换装载率 0.2 与 0.9。',
    predictionSpec: {
      kind: 'choice',
      prompt: '在斜风扰动航次中保持航速计划与控制器不变，仅把装载从 0.9 重载切换为 0.2 轻载，最关键的物理链条是什么？',
      options: [
        choiceOpt('loading_wind_rudder_fuel', '装载改变受风面积与水下吃水侧阻，引起不同偏航角与舵纠偏阻力，继而改变推进功率与油耗', '轻载水下吃水浅且受风特征不同，舵角持续偏转将显著增加诱导阻力'),
        choiceOpt('wind_zero_coupling', '风力仅直接影响纵摇而不产生横向漂移和舵角代价', '忽略侧风力矩引发航向纠偏舵耗的六自由度耦合'),
        choiceOpt('same_drift', '无论轻载或重载，受风产生的最大横偏与舵角严格相等', '吃水阻力与水线以上风面积随装载率发生显著改变'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合第 2 步测得的吃水与受风面积变化说明轻/重载抗风能力差异...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成 0.2 轻载与 0.9 重载风力航次后，分别提取 ETA、累计燃油与最大横偏并对比左侧舵角与风面积：',
      slots: [
        { id: 'wind_02', label: '轻载 0.2 风力航次', conditionHint: '装载率 0.20 · 斜风扰动', matcher: (r) => isLoad(r, 0.2), metrics: voyageComparisonMetrics('loading', '装载率', extractContainerLoadingRatio) },
        { id: 'wind_09', label: '重载 0.9 风力航次', conditionHint: '装载率 0.90 · 斜风扰动', matcher: (r) => isLoad(r, 0.9), metrics: voyageComparisonMetrics('loading', '装载率', extractContainerLoadingRatio) },
      ],
    },
    interpretationSpec: {
      checklist: ['对比 0.2 与 0.9 的最大横偏、ETA 与油耗', '串联受风面积、吃水阻尼、纠偏舵角与诱导阻力的完整因果链', '评估侧风下航迹保持与经济油耗的相互制约'],
      placeholder: '结合两档装载的受风面积、横偏峰值与累计燃油，论证装载状态通过风力矩和打舵诱导阻力影响能耗的机理...',
    },
  },
  15: {
    goal: '固定同一波浪场与速度计划先后关闭与开启教学平均附加阻力，实证二阶平均波浪阻力对航速维持、功率与累计燃油的净贡献。',
    actionSteps: [
      '运行前判断开启教学平均附加阻力后二阶纵向波浪力、到达时间与累计油耗的变化方向。',
      '先关闭「启用教学平均附加阻力」跑完 1 次 6000 m 波浪航次（仅含一阶波浪激励）。',
      '点击「重置」，开启「启用教学平均附加阻力」再跑完同条件航次，在下方提取对照指标与二阶波浪力。',
    ],
    watch: '对照「一阶纵向波浪力 (kN)」（零均值周期振荡）与「二阶纵向波浪力 (kN)」（开启后呈现非零持续附加阻力），核对轴功率与燃油增量。',
    conditionText: '迎浪不规则短波场，60% 中载，固定相同波场与航速计划，先后关闭与开启教学平均附加阻力完成 6000 m 航次。',
    suggestion: '须在解释中写明短波反射教学近似的参考范围（航速 6–12 m/s、波高 ≤1.5 m、波长不超半船长）及 0.5–1.5 倍敏感性边界。',
    predictionSpec: {
      kind: 'choice',
      prompt: '保持波场、模型与航速计划完全不变，开启「教学平均附加阻力」相比仅保留一阶波浪激励将带来什么后果？',
      options: [
        choiceOpt('real_mean_drag_penalty', '产生持续非零的纵向平均阻滞力，迫使主机提高推力与轴功率，导致累计教学燃油真实抬升', '一阶波浪力长期积分为零，而二阶波浪附加阻力直接进入推进功耗与航程积分'),
        choiceOpt('animation_only', '只改变三维海面波浪起伏画面，推进功率与累计燃油毫无变化', '物理仿真不可退化为无力耦合的纯画面波浪'),
        choiceOpt('wave_propulsion_gain', '迎浪短波反射平均阻力会推动船前进并显著省油', '迎浪辐射反射波浪阻力始终表现为阻碍前进的附加拖曳阻力'),
      ],
      allowRationale: true,
      rationalePlaceholder: '说明为何一阶高频振荡激励不能替代二阶平均附加阻力对长航次能耗的影响...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成关闭与开启教学平均附加阻力两次航次后，提取各自 ETA、累计燃油与二阶纵向波浪力：',
      slots: [
        { id: 'wave_off', label: '附加阻力关闭（仅一阶激励）', conditionHint: '平均附加阻力关闭', matcher: (r) => !r.configuration.meanWaveResistanceModel, metrics: waveMetrics() },
        { id: 'wave_on', label: '附加阻力开启（一阶+二阶平均阻力）', conditionHint: '平均附加阻力开启', matcher: (r) => Boolean(r.configuration.meanWaveResistanceModel), metrics: waveMetrics() },
      ],
    },
    interpretationSpec: {
      checklist: ['给出开启前后的实测燃油差值与二阶纵向波浪力数值', '阐明一阶振荡与二阶平均阻力的做功本质区别', '陈述短波反射教学近似的参考边界与敏感性范围'],
      placeholder: '对比两次运行的运动起伏、二阶阻力读数与累计燃油差额，并严谨界定教学平均附加阻力的适用边界...',
    },
  },
  16: {
    goal: '在海流与量测噪声并存环境下对比不同量测滤波时间常数与前视距离，权衡高频控制抖动抑制、闭环相位滞后与航迹保持精度。',
    actionSteps: [
      '在预测区判断将量测滤波时间常数从 0.2 s 增大到 1.0/3.0 s 对轴速动作代价与滞后响应的双面影响。',
      '固定控制增益与速度计划，先选用基准滤波 0.2 s（配前视 400 m）完成 1 次 6000 m 航次。',
      '点击「重置」，切换更大滤波时间常数（1.0 或 3.0 s）并调节合适前视距离完成第 2 次，提取对照指标。',
    ],
    watch: '观察轴速指令 (r/min) 的高频抖动幅值、最大航迹横偏 (m) 与舵角动作代价；强滤波降低抖动的同时会拉大航速响应延迟。',
    conditionText: '存在 0.3 m/s 东向定常海流并叠加真实传感器量测噪声，60% 中载，固定航速计划与 PI 参数，对比至少 2 档滤波时间常数与前视距离。',
    suggestion: '除「量测滤波 / s」与「LOS 前视距离 / m」外，本步请保持其余所有控制与速度参数前后完全一致。',
    predictionSpec: {
      kind: 'choice',
      prompt: '面对带噪声的航速量测，将滤波时间常数由 0.2 s 增大至 3.0 s 时，对控制系统最典型的权衡影响是？',
      options: [
        choiceOpt('tradeoff_noise_vs_lag', '有效平滑高频量测噪声引起的轴速指令与功率抖动，但引入更大相位滞后使瞬态跟踪变慢', '一阶低通滤波抑制高频噪声增益的同时必然产生相角滞后'),
        choiceOpt('eliminate_both', '既彻底消除全部噪声又做到零相位延迟快速跟踪', '违背线性低通滤波的幅频—相频物理约束'),
        choiceOpt('no_influence_noise', '滤波时间常数不会影响轴速指令噪声幅值或动态响应速度', '量测通道噪声直接乘以控制器比例增益放大到执行器指令'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合传感器高频噪声传递、低通相角滞后及 LOS 前视距离对航向平顺度的影响说明...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成至少两档滤波/前视距离运行后，分别一键提取配置、ETA、累计燃油与最大航迹横偏：',
      slots: [
        { id: 'filter_fast', label: '快滤波 0.2 s 基准档', conditionHint: '滤波时间常数 0.2 s', matcher: (r) => r.initialInput.containerSpeed?.filterTauS === 0.2, metrics: voyageComparisonMetrics('filter_cfg', '滤波与前视', extractFilterAndLos) },
        { id: 'filter_smooth', label: '强滤波 1.0 / 3.0 s 对照档', conditionHint: '滤波时间常数 1.0 或 3.0 s', matcher: (r) => (r.initialInput.containerSpeed?.filterTauS ?? 0.2) > 0.2, metrics: voyageComparisonMetrics('filter_cfg', '滤波与前视', extractFilterAndLos) },
      ],
    },
    interpretationSpec: {
      checklist: ['对比两档滤波下轴速指令毛刺与横偏/ETA 变化', '分析前视距离过大或过小对横偏与舵耗的作用', '给出平衡噪声代价与相位裕度的工程选型建议'],
      placeholder: '对比不同滤波时间常数与前视距离下的轴速平稳度、横偏和油耗表现，解释噪声抑制与响应时延权衡...',
    },
  },
  17: {
    goal: '在风浪流全要素扰动与量测噪声下统筹设计四段速度、调度控制、量测滤波与前视距离，冻结满足准点、末速与横偏约束的第一综合方案。',
    actionSteps: [
      '运行前在预测区输入本次综合方案预估的 6000 m 航次累计教学燃油目标值（kg）。',
      '在控制区整定本人三点模型、Kp/Ti 倍率、调度/无扰/抗饱和、量测滤波 (0.2/1/3 s)、四段航速与 LOS 前视距。',
      '点击「开始」完成 6000 m 综合航次，使用下方指标卡提取实际四段速度、ETA、累计油耗与最大横偏。',
    ],
    watch: '逐一检验四项硬约束：ETA ≤ 900 s、终点航速位于 8.0±0.3 m/s、最大横偏受控及横摇角不越过 8° 警示线。',
    conditionText: '全要素风浪流组合环境（斜风阵风、短波浪场与定常海流）叠加真实传感噪声与教学平均附加阻力，60% 中载，完成 6000 m 综合航次。',
    suggestion: '建议冻结稳妥均衡的参数组合作为第 18 步单维优化与第 19 步未知盲测的基线。',
    predictionSpec: {
      kind: 'numeric_target',
      unit: 'kg',
      targetPlaceholder: '如 1150',
      prompt: '结合你所选四段速度计划、滤波配置与全要素风浪流附加阻力，预估本综合方案完成 6000 m 航次的累计教学燃油 (kg)：',
      allowRationale: true,
      rationalePlaceholder: '简述方案如何同时平衡 ETA ≤ 900 s 准点裕量、抗噪平滑性与燃油经济性...',
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '综合航次结束后，记录四段速度与 ETA，并一键从曲线读取累计燃油、最大横偏、终点航速与实际航程：',
      metrics: [
        { key: 'seg_speeds', label: '四段航速计划', unit: 'm/s', placeholder: '如 8.2 / 8.0 / 8.0 / 7.8' },
        { key: 'eta', label: '实际到达时间 ETA', unit: 's', placeholder: '到达 6000 m 时的仿真时间' },
        { key: 'fuel', label: '累计教学油耗', unit: 'kg', seriesId: 'fuel', pickMode: 'steady' },
        { key: 'cross_track', label: '最大航迹横偏', unit: 'm', seriesId: 'east', pickMode: 'peak' },
        { key: 'end_speed', label: '终点对水航速', unit: 'm/s', seriesId: 'speed', pickMode: 'steady' },
        { key: 'north', label: '北向实际航程', unit: 'm', seriesId: 'north', pickMode: 'steady' },
      ],
    },
    interpretationSpec: {
      checklist: ['逐项核查 ETA、末速 8±0.3 m/s、横偏与横摇约束达标情况', '论证滤波、前视距、调度与四段速度的协同机理', '指出当前方案在油耗或准点裕量上可进一步优化的单个维度'],
      placeholder: '复盘第 17 步第一综合方案各项硬约束结果与裕量，提出下一步单维比较的调整方向...',
    },
  },
  18: {
    goal: '在相同风浪流与随机序列下基于第 17 步方案只修改唯一一个设计维度形成第二方案，完成准点、油耗与横偏的多目标 Pareto 权衡。',
    actionSteps: [
      '先在控制区「已冻结的综合方案」选定第 17 步基线航次导入参数（差异计数显示 0/1）。',
      '在预测区判断单维改动带来的多目标取舍方向，再仅改动 9 个维度中的恰好 1 个使计数显示「已修改维度：1/1」。',
      '点击「开始」跑完 6000 m，在下方分别记录第 17 步方案一与本步方案二的实测指标进行对比。',
    ],
    watch: '观察仅改动 1 个维度后，「到达时间 ETA—累计燃油—最大横偏」三项指标中哪项改善、哪项代价抬升，验证多目标取舍规律。',
    conditionText: '与第 17 步完全相同的全要素风浪流组合环境、真实传感噪声与相同初值及随机序列，仅改动 1 个设计维度形成第二方案。',
    suggestion: '必须保证控制区差异计数器高亮显示「已修改维度：1/1」再运行；修改 0 维或 ≥2 维均会被提交校验拦截。',
    predictionSpec: {
      kind: 'choice',
      prompt: '基于第 17 步综合方案仅调整单个设计维度形成第二方案时，多目标航次评价最符合哪类工程现象？',
      options: [
        choiceOpt('pareto_tradeoff', '一项指标获得改善（如降油耗或降横偏）往往伴随另一指标余量收紧（如 ETA 逼近或波动微增），需依权衡取舍', '在可行域前沿上不同权重对应不同合理工程选择，不存在单一绝对最优解'),
        choiceOpt('all_better_strictly', '任何单维微调都会使 ETA、燃油、横偏与执行器动作全部无代价同步大幅变优', '忽略速度—能耗—抗扰平滑之间的内在耦合冲突'),
        choiceOpt('all_unchanged', '只改 1 个参数不会对航次 ETA、燃油和横偏造成任何可观测变化', '每个合法设计维度均直接对应闭环带宽、参考速度或滤波/导航导引律'),
      ],
      allowRationale: true,
      rationalePlaceholder: '写明所选唯一调整维度，预判其改善目标及可能引入的次级代价...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '在第一槽补填第 17 步方案一实测基线，并在第二槽一键提取本步方案二实测数据开展 Pareto 对比：',
      slots: [
        {
          id: 'scheme_one',
          label: '方案一（第 17 步基线实测）',
          conditionHint: '对照第 17 步记录的 ETA、油耗与横偏',
          metrics: [
            { key: 'eta', label: '方案一 ETA', unit: 's', placeholder: '填第 17 步 ETA' },
            { key: 'fuel', label: '方案一燃油', unit: 'kg', placeholder: '填第 17 步燃油' },
            { key: 'cross_track', label: '方案一横偏', unit: 'm', placeholder: '填第 17 步横偏' },
          ],
        },
        {
          id: 'scheme_two',
          label: '方案二（本步单维微调运行）',
          conditionHint: '与方案一恰好相差 1 个维度',
          matcher: (r) => r.stoppedAtMs !== null,
          metrics: voyageComparisonMetrics('eta_tag', '运行状态', (r) => (r.stopReason === 'arrival' ? '已实际到达' : '运行完成')),
        },
      ],
    },
    interpretationSpec: {
      checklist: ['明确指明方案二相对方案一唯一修改的参数及数值变化', '定量比较两方案的 ETA、油耗与横偏 Pareto 权衡', '基于课程权重论证最终推荐选用的方案'],
      placeholder: '写出唯一改动的维度与数值前后对比，分析两方案在准点、油耗和横偏之间的多目标取舍依据...',
    },
  },
  19: {
    goal: '保持第 17 或第 18 步已冻结综合方案参数不变，在两套未见装载与陌生环境扰动下检验调度插值与全方案泛化鲁棒性。',
    actionSteps: [
      '在控制区选中已冻结的第 17 或第 18 步综合方案（全部控制、调度与四段航速将自动只读锁定）。',
      '在预测区预判原方案直接迁移至 0.35 轻载与 0.80 重载未见海况时的适应性与风险点。',
      '依次选择「0.35 轻载盲测」与「0.80 重载盲测」完成两次 6000 m 盲测，提取实测结果（若超限务必如实保留失败记录）。',
    ],
    watch: '重点关注未知 0.35/0.80 中间装载下的调度权重平滑性、是否仍守住 900 s ETA、末速 8±0.3 m/s 及横偏/横摇安全边界。',
    conditionText: '两套未见盲测工况（0.35 轻载配载与独立随机风浪序列；0.80 重载配载与另一独立随机风浪序列），全要素组合海况与真实传感噪声。',
    suggestion: '严禁为迎合达标而擅自修改冻结方案或删改失败记录；如实记录盲测表现并在第 20 步说明修订策略。',
    predictionSpec: {
      kind: 'choice',
      prompt: '将冻结的第 17/18 步综合方案无修改迁移至未见 0.35 轻载与 0.80 重载海况时，最符合控制机理的预期是？',
      options: [
        choiceOpt('interpolation_valid_with_variance', '三点调度线性插值可适应 0.35 与 0.80 中间装载，但不同海况实现与风阻差异会使 ETA 和横偏出现波动', '0.35 与 0.80 落在 0.2–0.9 辨识工作包络内，仍需实测核查约束余量'),
        choiceOpt('zero_variance', '两套未见盲测的曲线与油耗会和第 17 步中载运行分毫不差', '忽略了未知装载率质量惯性及不同随机波风实现带来的扰动差异'),
        choiceOpt('immediate_instability', '一旦偏离 0.6 中载必定立刻发散无法完成航次', '低估已辨识三点线性增益调度在工作域内的插值鲁棒性'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合调度工作域插值覆盖范围与未知海况扰动不确定性阐述预判依据...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '保持选中的冻结方案不变，分别完成 0.35 轻载与 0.80 重载两次盲测航次并提取实测指标：',
      slots: [
        { id: 'blind_035', label: '未见装载 0.35 盲测', conditionHint: '0.35 轻载 · 独立随机风浪场', matcher: (r) => r.configuration.seed === 17, metrics: voyageComparisonMetrics('loading', '盲测装载', extractContainerLoadingRatio) },
        { id: 'blind_080', label: '未见装载 0.80 盲测', conditionHint: '0.80 重载 · 另一独立随机风浪场', matcher: (r) => r.configuration.seed === 29, metrics: voyageComparisonMetrics('loading', '盲测装载', extractContainerLoadingRatio) },
      ],
    },
    interpretationSpec: {
      checklist: ['对照两组未见盲测下的 ETA、燃油与横偏结果', '评估三点线性调度在 0.35/0.80 插值点上的泛化精度', '如有裕量收窄或失败记录，诚实记录并提出方案修订版本建议'],
      placeholder: '对比两套未见盲测数据与第 17/18 步基准差异，论证方案的装载与环境泛化边界及潜在改进策略...',
    },
  },
  20: {
    goal: '整合至少 5 次本人完整运行、冻结局部模型与独立验证证据，撰写可复现且严守教学代理边界的六部分实验总结报告。',
    actionSteps: [
      '在控制区「报告引用的本人运行」勾选至少 5 次涵盖建模、控制与航次验证的本人完整运行。',
      '利用下方「步 1–19 实测证据胶囊」向对应报告章节一键插入带模型参数、RMSE/FIT 与航次读数的实证摘要。',
      '逐一完成报告六部分并确认四维量规预检达标后，点击「提交本步」并可预览导出实验报告。',
    ],
    watch: '核对四维报告量规预检是否全部亮绿达标，检查每一章节均包含真实定量数据、单位及适用假设边界说明。',
    conditionText: '综合实验总结与报告撰写阶段（无需新开仿真运行），须引用本人至少 5 次完整运行、冻结航速模型及独立验证对照。',
    suggestion: '严禁把本课程教学估计燃油写作实船节油证明，结论须明确局部线性化、立方代理与短波近似边界。',
  },
};
