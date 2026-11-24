import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import type { StepObservationMetricDef } from '../simulations/vessel-experiment';
import { choiceOpt, extractLngSloshActualSeries, formatLngParam, type LngStepWorkbenchSpec } from './lng-step-specs-early';

const isLoad = (run: VesselRunSummary, target: number) => Math.abs((run.configuration.loadingRatio ?? -1) - target) < 1e-6;

const fillLoadMetrics = (): StepObservationMetricDef[] => [
  { key: 'loading', label: '液舱填充率', extract: (r) => (typeof r.configuration.loadingRatio === 'number' ? `${Math.round(r.configuration.loadingRatio * 100)}%` : null) },
  { key: 'mass_kt', label: '排水质量', unit: '千吨', extract: (r) => formatLngParam(r.parameters?.massKg, 3, 1e-6) },
  { key: 'draft_m', label: '吃水', unit: 'm', extract: (r) => formatLngParam(r.parameters?.draftM, 2) },
  { key: 'gm_m', label: '有效横稳心高', unit: 'm', extract: (r) => formatLngParam(r.parameters?.effectiveGmTransverseM, 3) },
  { key: 'steady_speed', label: '稳态航速', unit: 'm/s', seriesId: 'speed', pickMode: 'steady' },
  { key: 'model_kt', label: '冻结模型 K / T', placeholder: '评估页签冻结后填入 K 与 T' },
];

const berthCompareMetrics = (firstKey: string, firstLabel: string, extractFirst: (r: VesselRunSummary) => string | null, firstUnit?: string): StepObservationMetricDef[] => [
  { key: firstKey, label: firstLabel, unit: firstUnit, extract: extractFirst },
  { key: 'bow_clear', label: '末态船艏剩余距离', unit: 'm', seriesId: 'distance', pickMode: 'steady' },
  { key: 'end_speed', label: '末态对水航速', unit: 'm/s', seriesId: 'speed', pickMode: 'steady' },
  { key: 'max_east', label: '横向偏移峰值', unit: 'm', seriesId: 'east', pickMode: 'peak' },
];

const sloshRampMetrics = (): StepObservationMetricDef[] => [
  { key: 'ramp_s', label: '转向斜坡', unit: 's', extract: (r) => (typeof r.courseSettings?.headingRampS === 'number' ? String(r.courseSettings.headingRampS) : null) },
  { key: 'slosh_peak', label: '液面幅值峰值', unit: 'm', seriesId: 'slosh', pickMode: 'peak' },
  { key: 'slosh_rms', label: '全程液面均方根', unit: 'm', placeholder: '见左侧状态栏「全程液面均方根」' },
  { key: 'end_heading', label: '末态航向角', unit: '°', seriesId: 'heading', pickMode: 'steady' },
];

export const LNG_STEP_SPECS_LATE: Record<number, LngStepWorkbenchSpec> = {
  11: {
    goal: '在 0/5 秒额外命令时延与给定 Smith 补偿结构开关的 2×2 组合下完成四组闭环测试，验证补偿器对时延与模型误差的敏感边界。',
    actionSteps: [
      '运行前预判额外 5 秒纯时延与开启 Smith 补偿对 4→3 m/s 闭环振荡与超调的作用。',
      '保持本人模型与 PI 增益不变，依次完成（0 s 关、0 s 开、5 s 关、5 s 开）全部 4 次 600 秒运行（每次重置后切换）。',
      '在下方 4 个工况槽依次一键提取各自时延配置、航速谷值、纵向合力峰值与末态航速。',
    ],
    watch: '额外 5 秒时延下关闭 Smith 结构时的相位滞后振荡恶化，以及开启补偿后相位超前改善程度与受限于局部模型偏差残留的跟踪余差。',
    conditionText: '平静无风浪流环境与无噪基准，85% 装载率，t=20 s 航速参考从 4.0 降至 3.0 m/s，固定 PI 参数组合 0/5 秒额外命令时延与 Smith 结构关/开（4 次各 600 秒）。',
    suggestion: 'Smith 预估补偿依赖本人辨识模型准确度；切勿宣称某补偿结构可消除一切未建模非线性或外界干扰误差。',
    predictionSpec: {
      kind: 'choice',
      prompt: '存在 5 秒额外命令纯时延且保留真实水动力差异时，开启 Smith 补偿结构相比关闭时最符合控制机理的预期是？',
      options: [
        choiceOpt('compensate_with_residual', '显著削弱纯时延造成的相位滞后振荡并改善收敛，但因本人模型与六自由度对象存在差异仍保留一定残余误差', 'Smith 内部模型预测分支消除了特征方程中的纯时延项，而模型失配通道直接决定残差大小'),
        choiceOpt('eliminate_all_errors', '彻底消除全部非线性和外部扰动误差，实际与理想响应严格重合', '预估补偿只能依模型抵消标称通道时延，不能消除模型结构失配'),
        choiceOpt('no_delay_sensitivity', '额外 5 秒纯时延不会影响闭环稳定性与振荡幅度', '纯时延每增加 1 秒均直接压缩闭环相位裕度'),
      ],
      allowRationale: true, rationalePlaceholder: '结合相位裕度随纯时延减小及内部预估模型与实船偏差的关系说明原因...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成 0/5 秒额外时延 × Smith 开关全部 4 次 600 秒运行后，分别一键提取对比读数：',
      slots: ([
        { id: 'd0_off', label: '0 s 时延 · Smith 关', delay: 0, smith: false },
        { id: 'd0_on', label: '0 s 时延 · Smith 开', delay: 0, smith: true },
        { id: 'd5_off', label: '5 s 时延 · Smith 关', delay: 5, smith: false },
        { id: 'd5_on', label: '5 s 时延 · Smith 开', delay: 5, smith: true },
      ] as const).map((item) => ({
        id: item.id, label: item.label, conditionHint: `额外时延 ${item.delay} s · ${item.smith ? '开启' : '关闭'} Smith`,
        matcher: (r) => r.initialInput.longitudinal?.additionalCommandDelayS === item.delay && Boolean(r.initialInput.longitudinal?.smithEnabled) === item.smith,
        metrics: [
          { key: 'cfg', label: '时延/补偿', extract: (r) => `${r.initialInput.longitudinal?.additionalCommandDelayS ?? 0}s / ${r.initialInput.longitudinal?.smithEnabled ? 'Smith开' : 'Smith关'}` },
          { key: 'min_speed', label: '航速下冲谷值', unit: 'm/s', seriesId: 'speed', pickMode: 'min' },
          { key: 'peak_force', label: '纵向合力峰值', unit: 'kN', seriesId: 'actuatorForce', pickMode: 'peak' },
          { key: 'steady_speed', label: '末态对水航速', unit: 'm/s', seriesId: 'speed', pickMode: 'steady' },
        ],
      })),
    },
    interpretationSpec: {
      checklist: ['对比 4 组运行的振荡幅值与末态误差', '说明 Smith 补偿对纯时延的抑制机理', '强调模型失配与未建模物理对补偿上限的制约'],
      placeholder: '结合 2×2 对比表定量分析时延对闭环的失稳威胁、Smith 补偿收益及残差成因...',
    },
  },
  12: {
    goal: '在 30%、70% 与 95% 三档液舱填充率下施以相同小信号激励并分别冻结局部模型，揭示质量、吃水、稳性与模型参数联动变化。',
    actionSteps: [
      '运行前在预测区按排水质量与吃水从小到大排列 30%、70% 与 95% 三档液舱填充率工况。',
      '依次选择液舱填充率 0.30、0.70、0.95 各跑完 600 秒激励运行；在「评估」页签先用原 85% 模型外推对比，再分别为三档填充率冻结各自局部模型。',
      '在下方三档工况槽点击「一键提取本工况读数」，自动回填质量、吃水、有效横稳心高与稳态航速，并补录各档模型 K/T。',
    ],
    watch: '随液舱填充率由 0.30 增至 0.95，排水质量、吃水与含自由液面修正的有效横稳心高同步变化，导致原模型外推失配及各载荷 K、T 参数显著分化。',
    conditionText: '平静无风浪流环境与无噪基准，初速 4.0 m/s，分别在 30%、70% 与 95% 填充率下执行相同 +5% 小信号激励（各 600 秒，需冻结 3 套局部模型）。',
    suggestion: '切勿在忽略物理参数改变的情况下人为只改时间常数 T；必须在「评估」页签基于三档运行各自辨识冻结对应模型。',
    predictionSpec: {
      kind: 'ranking',
      prompt: '按排水质量与吃水从小到大的顺序排列三种液舱填充率（#1 为质量与吃水最小工况）：',
      rankItems: [
        '30% 填充率（液货质量与吃水最小，纵向加速惯性时间常数较短）',
        '70% 填充率（中等液货质量与吃水，惯性与稳性居于中间）',
        '95% 填充率（接近满载，总排水质量与吃水达到最大）',
      ],
      allowRationale: true, rationalePlaceholder: '结合液货装载质量变化如何联动吃水、湿表面阻力与有效稳性说明原因...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成 30%、70%、95% 三次运行并冻结三档局部模型后，点击「一键提取本工况读数」提取质量、吃水、稳性与航速：',
      slots: [
        { id: 'fill_030', label: '30% 低填充率工况', conditionHint: '填充率 0.30 · 600 s', matcher: (r) => isLoad(r, 0.30), metrics: fillLoadMetrics() },
        { id: 'fill_070', label: '70% 中填充率工况', conditionHint: '填充率 0.70 · 600 s', matcher: (r) => isLoad(r, 0.70), metrics: fillLoadMetrics() },
        { id: 'fill_095', label: '95% 高填充率工况', conditionHint: '填充率 0.95 · 600 s', matcher: (r) => isLoad(r, 0.95), metrics: fillLoadMetrics() },
      ],
    },
    interpretationSpec: {
      checklist: ['列举三档实测质量、吃水与有效横稳心高', '对比原模型外推误差与三档重辨识参数差异', '论证为何不能仅调单一时间常数替代多自由度物理耦合'],
      placeholder: '结合三组物理状态参数与冻结模型 K/T 迁移规律，说明液货装载变化对纵向推进和横向稳性的综合影响...',
    },
  },
  13: {
    goal: '在 70% 填充率下施加 +10° 斜坡转向激励，观察横摇与液面幅值协同响应并厘清横向加速度激励液舱晃荡的双向耦合。',
    actionSteps: [
      '运行前判断转向引发液舱晃荡的主导物理机理，并在坐标画板手绘 t=20 s 转向后液面幅值变化曲线。',
      '选择转向斜坡（5 s、20 s 或 60 s），点击「开始」完成 600 秒 +10° 转向运行。',
      '对照手绘叠加的实测液面曲线，从曲线与左侧液货舱状态栏提取液面峰值、全程液面均方根、末态航向与超出小幅适用域时长。',
    ],
    watch: 't=20 s 转向建立过程中随转艏角速度和横摇增加而爬升的液面幅值真值 (m)，以及晃荡反作用力矩对横摇振荡阻尼和恢复的影响。',
    conditionText: '平静无风浪流环境与无噪基准，70% 填充率，初速 4.0 m/s，t=20 s 起执行 +10° 航向斜坡转向，时长 600 秒。',
    suggestion: '注意对照左侧状态栏「小幅适用上限」（当前液深的 10%）；超过该上限时液舱冲击非线性未在当前线性晃荡模型中建模。',
    predictionSpec: {
      kind: 'choice',
      prompt: '当 70% 填充率的 LNG 船在 t=20 s 启动 +10° 转向时，液舱内液面幅值与船体横摇如何相互作用？',
      options: [
        choiceOpt('turn_lateral_slosh_reaction', '转向产生横向离心惯性力激发液面晃荡振荡，同时晃荡流体反作用力矩耦合回船体影响横摇与转向衰减', '液货质量占船体总质量比例高，晃荡动力学与六自由度横摇/艏摇形成双向耦合'),
        choiceOpt('turn_no_slosh', '只要在平静无浪水面转向，液舱液面始终保持绝对水平静止', '忽略了转弯向心加速度与横摇角加速度对液货自由面的侧向激励'),
        choiceOpt('monotone_lock', '液面在转向开始瞬间单调跳变到一个固定常量不再回落或振荡', '液舱自由面具有低阻尼固有模态，受阶跃/斜坡激励后必然呈现周期振荡衰减'),
      ],
      allowRationale: true, rationalePlaceholder: '结合转弯向心惯性力与低阻尼液舱固有模态振荡机理说明理由...',
      sketch: {
        mode: 'prediction', plotId: 'time-response', lockPlotId: true,
        label: '运行前手绘预测：t=20s 转向 +10° 引发的液面幅值响应',
        hint: '在 0–600 s 坐标系中从 0 m 起笔，描绘 t=20 s 转向后液面幅值抬升振荡并随航向到位逐步衰减的轨迹。',
        promptFocus: '关注 t=20s 转向后液面振荡起峰时刻、衰减包络及与转向斜坡的因果关联',
        coordinateOverride: {
          title: '转向耦合液舱晃荡预测坐标系', subtitle: '0–600 s 时域响应（t=20 s 启动 +10° 转向激励）',
          xMin: 0, xMax: 600, yMin: 0, yMax: 1.5, xLabel: '时间 t', yLabel: '液面幅值', xUnit: 's', yUnit: 'm',
          xTicks: [0, 120, 240, 360, 480, 600].map((value) => ({ value, label: String(value) })),
          yTicks: [0, 0.3, 0.6, 0.9, 1.2, 1.5].map((value) => ({ value, label: value.toFixed(1) })),
          verticalMarkers: [{ value: 20, label: 't=20s 转向', color: '#0ea5e9' }],
          horizontalMarkers: [],
        },
        overlayExtractor: (samples) => extractLngSloshActualSeries(samples),
      },
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '转向运行结束后，结合曲线和左侧「本次运行与液面统计」记录以下液面与航向读数：',
      metrics: [
        { key: 'slosh_peak', label: '液面幅值峰值', unit: 'm', seriesId: 'slosh', pickMode: 'peak' },
        { key: 'slosh_rms', label: '全程液面均方根', unit: 'm', placeholder: '见左侧状态栏统计读数' },
        { key: 'end_heading', label: '末态航向量测', unit: '°', seriesId: 'heading', pickMode: 'steady' },
        { key: 'outside_domain', label: '超出小幅适用域时长', unit: 's', placeholder: '见左侧状态栏统计读数' },
      ],
    },
    interpretationSpec: {
      checklist: ['说明转向横向加速度与液面起峰的时间因果', '解释液面反作用力矩对横摇/转向的影响', '核对是否处于液深 10% 小幅适用域内'],
      placeholder: '结合实测液面峰值、RMS 与横摇波动，阐述转向激发液货晃荡及其双向耦合机理...',
    },
  },
  14: {
    goal: '对 30%、70% 与 95% 三档填充率转向轨迹实施液面模态频谱分析，对比公式固有频率与实测谱峰并阐明填充率频移规律。',
    actionSteps: [
      '运行前判断三档填充率下横向第一模态频率高低顺序，并在下方共振幅频坐标系手绘液舱共振主峰与三档填充率频移后「识图核验」。',
      '依次选择填充率 0.30、0.70、0.95 并各运行完整 600 秒（每次结束后重置再切下一档）。',
      '前往「评估」页签为三次运行计算「第 1 舱 · 横向液面模态」频谱，并在下方三槽提取液深、公式频率、实测谱峰频率与液面峰值。',
    ],
    watch: '评估页签频谱图中随填充率由 30% 增至 95% 液深上升、理论公式频率 (Hz) 与实测谱峰频率同步右移（周期缩短）的规律，注意核对频率与幅值单位量纲。',
    conditionText: '平静无风浪流环境与无噪基准，初速 4.0 m/s、20 s 斜坡转向 +10°，分别测量 30%、70% 与 95% 三档填充率（各 600 秒）。',
    suggestion: '务必在「评估」页签选对第 1 舱横向液面模态通道；记录数据时须标明 Hz 与 m 单位，辨明共振移频原因。',
    predictionSpec: {
      kind: 'choice',
      prompt: '随着液舱填充率从 30% 提高到 70% 再到 95%（液深持续增加），第一阶横向晃荡模态频率将如何变化？',
      options: [
        choiceOpt('freq_increases_with_fill', '液深增加使恢复色散项 tanh(πh/B) 增大，第一阶模态固有频率随填充率升高而单调升高（共振周期缩短）', '浅液深下重力波相速度低、模态频率低；深液深接近深水色散极限而频率更高'),
        choiceOpt('freq_decreases', '填充率越高液舱质量越大，模态固有频率必然大幅下降', '重力表面波固有频率取决于液深色散与舱宽几何尺度而非单纯质量倒数'),
        choiceOpt('freq_constant', '三档填充率下液舱宽度不变，故晃荡固有频率完全相同', '忽视了有限水深重力波色散因子 tanh(πh/B) 对液深 h 的依赖'),
      ],
      allowRationale: true, rationalePlaceholder: '利用有限液深重力波模态频率公式与波浪周期比变化阐明频移方向...',
    },
    sketchSpec: {
      mode: 'analysis', plotId: 'frequency-amplitude', lockPlotId: true,
      label: '液舱共振主峰与三档填充率频移分析草图',
      hint: '横轴为激振/模态周期比，纵轴为晃荡放大倍率；请画出 1.0x 处的液舱共振主峰轮廓，并标出 30%/70%/95% 填充率引起的共振频率偏移方向。',
      promptFocus: '重点标注 1.0x 液舱共振主峰放大特征及 30%、70%、95% 三档填充率频移规律',
      coordinateOverride: {
        title: '液舱晃荡共振幅频与填充率频移坐标系',
        subtitle: '横轴为激振/模态周期比，纵轴为晃荡放大倍率（标注液舱共振主峰与三档填充率频移）',
        xMin: 0.5, xMax: 1.6, yMin: 0, yMax: 3.0, xLabel: '激振/模态周期比', yLabel: '晃荡放大倍率', yUnit: 'x',
        xTicks: [0.5, 0.8, 1.0, 1.2, 1.4, 1.6].map((value) => ({ value, label: value.toFixed(1) })),
        yTicks: [0, 1.0, 2.0, 3.0].map((value) => ({ value, label: value.toFixed(1) })),
        verticalMarkers: [
          { value: 0.8, label: '高填充频移', color: '#0ea5e9' },
          { value: 1.0, label: '1.0x 共振主峰', color: '#f59e0b' },
          { value: 1.2, label: '低填充频移', color: '#10b981' },
        ],
        horizontalMarkers: [{ value: 1.0, label: '1.0 静态基准', color: '#64748b' }],
      },
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成三档填充率运行并在「评估」页签读取液面频谱后，一键提取液深、公式频率与峰值并补填实测谱峰频率：',
      slots: [0.30, 0.70, 0.95].map((fill) => ({
        id: `spec_${String(Math.round(fill * 100)).padStart(3, '0')}`,
        label: `${Math.round(fill * 100)}% 填充率频谱读数`, conditionHint: `填充率 ${fill.toFixed(2)} · 600 s`, matcher: (r) => isLoad(r, fill),
        metrics: [
          { key: 'depth_m', label: '液舱液深', unit: 'm', extract: (r) => formatLngParam(r.parameters?.liquidDepthM, 2) },
          { key: 'formula_hz', label: '公式模态频率', unit: 'Hz', extract: (r) => formatLngParam(r.parameters?.liquidModalFrequenciesHz?.[1], 4) },
          { key: 'peak_hz', label: '实测谱峰频率', unit: 'Hz', placeholder: '评估页签频谱读数' },
          { key: 'slosh_peak', label: '液面幅值峰值', unit: 'm', seriesId: 'slosh', pickMode: 'peak' },
        ],
      })),
    },
    interpretationSpec: {
      checklist: ['对照三档填充率公式频率与实测谱峰频率', '严格标注 Hz 与 m 物理量纲', '解释填充率与液深通过色散关系移动共振峰的机理'],
      placeholder: '定量对比 30%、70% 与 95% 的公式频率、实测谱峰频率与晃荡幅值差异，说明浅液深大晃荡与频移特征...',
    },
  },
  15: {
    goal: '保持 70% 填充率与 +10° 航向终值完全相同，对比急促与平缓两种转向斜坡，揭示平滑转向在降晃荡与增耗时之间的取舍。',
    actionSteps: [
      '运行前判断延长转向斜坡对液面晃荡峰值、均方根能量与转向完成时间的影响方向。',
      '先选用 5 s（或 20 s）较快斜坡运行 600 秒；结束后点击「重置」，再切换为 60 s 平缓斜坡跑完第 2 次 600 秒运行。',
      '在下方两档转向斜坡槽提取斜坡时间、液面幅值峰值、末态航向及左侧「全程液面均方根」。',
    ],
    watch: '虽然两档斜坡在 600 s 末态均到达 +10° 同一终值，但 5 s 急转引发剧烈横向加速度冲击和较高液面波峰，而 60 s 平滑斜坡显著压低液面峰值与 RMS 并推迟转向到位时刻。',
    conditionText: '平静无风浪流环境与无噪基准，70% 填充率，初速 4.0 m/s、目标航向终值 +10°，固定其余条件对比两种转向斜坡（推荐 5/20 s 与 60 s，各 600 秒）。',
    suggestion: '切勿只看末态航向是否等于 +10°；过程平滑度、液面峰值、RMS 与转向滞后代价必须同时纳入评价。',
    predictionSpec: {
      kind: 'choice',
      prompt: '保持最终目标航向同为 +10° 不变，将转向斜坡由 5 s 放缓到 60 s 后最合理的工程取舍是？',
      options: [
        choiceOpt('smooth_reduces_slosh_costs_time', '显著降低横向加速度冲击从而大幅压低液面晃荡峰值与 RMS，但转向到位耗时明显拉长', '斜坡拉长削弱了舵角瞬时角加速度阶跃与液舱共振频带能量输入'),
        choiceOpt('identical_process', '只要终值同为 +10°，两种斜坡的晃荡峰值与转向耗时完全相同', '混同了稳态终值相同与过渡轨迹动力学过程安全性的区别'),
        choiceOpt('slower_increases_slosh', '转向越缓慢液面晃荡峰值反而越高', '低通斜坡降低了激励带宽在液舱固有频率附近的能量密度'),
      ],
      allowRationale: true, rationalePlaceholder: '从参考斜率对横向加速度冲击频谱及转向完成时间的反向制约关系说明理由...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成快/慢两档转向斜坡 600 秒运行后，分别提取液面峰值、斜坡时间与末态航向并补记液面均方根：',
      slots: [
        { id: 'ramp_fast', label: '较急转向斜坡（5 s 或 20 s）', conditionHint: '斜坡时间 ≤ 20 s · 600 s', matcher: (r) => Number(r.courseSettings?.headingRampS ?? 20) <= 20, metrics: sloshRampMetrics() },
        { id: 'ramp_slow', label: '平缓转向斜坡（60 s）', conditionHint: '斜坡时间 60 s · 600 s', matcher: (r) => Number(r.courseSettings?.headingRampS ?? 0) === 60, metrics: sloshRampMetrics() },
      ],
    },
    interpretationSpec: {
      checklist: ['对比两斜坡下的液面峰值、均方根与转向耗时', '阐述「末值相同不等于过程相同」的轨迹约束', '评估狭水道靠泊中转向速率限制的折中区间'],
      placeholder: '结合两次实测峰值与 RMS 差异，总结平滑参考轨迹设计抑制液货晃荡的收益与响应变慢代价...',
    },
  },
  16: {
    goal: '在风与横流组合干扰下复现第 8/9 步冻结的静水靠泊方案暴露漂移与停距变化，再修订一项策略完成抑偏与停船对照。',
    actionSteps: [
      '运行前预判静水原方案遭遇持续斜风与东向横流后横向偏移、低速舵效及停止距离的变化。',
      '在控制区「已冻结的静水靠泊方案」引用第 8 或第 9 步方案（勿改参数），点击「开始」完成第 1 次风流复现运行（观察完可手动结束靠泊）。',
      '点击「重置」，仅修订一项策略（如在「时序转向计划」添加迎风流偏转节点或调整减速计划）完成第 2 次运行，并在下方两槽提取对比指标。',
    ],
    watch: '横向位置量测 (m) 的横偏漂移峰值、低速阶段舵效衰减造成的航向偏离，以及风流推动或顶阻带来的实际船艏剩余距离变化。',
    conditionText: '持续风载与东向定常横流叠加（无测量噪声），85% 装载率，水深 40 m、初态船艏距离 1500 m、初速 4.0 m/s，先复现静水方案再保留一次策略修订运行。',
    suggestion: '必须先完成第 8 或第 9 步静水靠泊，并在本步控制栏引用该静水方案完成原参数风流复现后，再做策略修订运行。',
    predictionSpec: {
      kind: 'choice',
      prompt: '将静水靠泊原方案直接投入持续风载与东向横流环境运行时，最先暴露的关键问题是什么？',
      options: [
        choiceOpt('lateral_drift_and_low_speed_rudder_loss', '持续风流推力引起显著横向偏移，且低速靠泊末段舵效减弱使航向纠偏滞后、停船轨迹偏离泊位中线', '无迎流补偿的静水计划缺乏横向漂移对消，低速水动力舵力随航速平方衰减'),
        choiceOpt('zero_wind_current_effect', '风和横流只会改变画面浪花，不会影响横偏位置或停止距离', '风力和流致水动力均直接进入六自由度外力合力'),
        choiceOpt('rudder_stronger_at_zero_speed', '航速越接近零时常规尾舵抗风流能力越强', '常规水翼舵的升力与有效来流速度平方成正比'),
      ],
      allowRationale: true, rationalePlaceholder: '结合横向风面积、横流速度与低速段舵效衰减说明漂移与停距变化...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '分别完成「静水原方案风流复现」与「修订一项策略」两次风流靠泊运行后，在下方提取横向偏移与船艏距离对比：',
      slots: [
        {
          id: 'still_rerun', label: '静水原方案风流复现', conditionHint: '直接引用第 8/9 步原方案',
          matcher: (r) => !r.initialInput.berthPlan?.headingNodes?.length,
          metrics: berthCompareMetrics('braking_m', '减速起点', (r) => (r.initialInput.berthPlan ? String(r.initialInput.berthPlan.brakingDistanceM) : null), 'm'),
        },
        {
          id: 'wind_revised', label: '风流修订策略方案', conditionHint: '调整转向或减速/增益策略',
          matcher: (r) => Boolean(r.initialInput.berthPlan?.headingNodes?.length),
          metrics: berthCompareMetrics('heading_nodes', '转向节点数', (r) => String(r.initialInput.berthPlan?.headingNodes?.length ?? 0), '个'),
        },
      ],
    },
    interpretationSpec: {
      checklist: ['对比静水复现与修订策略后的横偏峰值与船艏余量', '解释风载、横流与低速舵效衰减耦合机理', '说明所修改单项策略如何改善轨迹或安全余量'],
      placeholder: '定量对比复现运行与修订运行的横偏峰值、停船距离和耗时，阐明风流干扰下迎风修正或制动余量调整依据...',
    },
  },
  17: {
    goal: '在组合海况与标准量测噪声下对比 0.2、1、3 秒航速滤波时间常数，权衡传感器高频噪声抖动抑制与闭环相位滞后风险。',
    actionSteps: [
      '运行前判断增大航速量测滤波时间常数对轴速指令波动及靠泊刹车滞后的双向作用。',
      '保持控制器增益、减速起点与速度节点完全一致，至少选用两档航速量测滤波（建议 0.2 s 与 1 s 或 3 s）各完成 1 次靠泊运行。',
      '在下方对应滤波档位槽提取轴速指令峰值、末态滤波航速、末态船艏剩余距离与横向偏移峰值。',
    ],
    watch: '对照「计程仪 (m/s)」原始带噪信号与「滤波计程仪 (m/s)」、轴速指令 (r/min) 的高频毛刺幅度，以及强滤波（3 s）导致的实际减速滞后。',
    conditionText: '波浪海况叠加标准传感器量测噪声，85% 装载率，水深 40 m、初态距停泊线 1500 m、初速 4.0 m/s，保持其余方案不变对比至少 2 档滤波时间常数（0.2 / 1 / 3 s）。',
    suggestion: '切勿企图更改传感器真值来降噪；本步除「航速量测滤波 / s」外须锁定全部其余控制和靠泊参数前后一致。',
    predictionSpec: {
      kind: 'choice',
      prompt: '面对波频扰动与传感噪声时，将航速量测滤波时间常数从 0.2 s 增大至 3.0 s 对靠泊控制有何双重影响？',
      options: [
        choiceOpt('filter_smooth_vs_lag', '大幅滤除高频噪声引起的轴速指令抖动，但引入显著反馈相位滞后使减速响应迟钝并挤压停船余量', '一阶低通滤波器抑制高频增益的同时按相角滞后削弱闭环响应速度'),
        choiceOpt('filter_no_lag', '彻底消除一切波频噪声且不增加任何时间滞后', '违背因果低通滤波器的幅频—相频基本物理关系'),
        choiceOpt('filter_amplifies_noise', '滤波时间常数越大，轴速指令高频抖动反而越剧烈', '时间常数增大降低高频截止频率，从而衰减高频噪声传输'),
      ],
      allowRationale: true, rationalePlaceholder: '结合低通截止频带压缩噪声透传及相位滞后拖慢减速跟进的原理说明...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成至少两档航速滤波运行后，在对应档位槽提取轴速指令峰值、滤波航速与船艏余量：',
      slots: ([0.2, 1, 3] as const).map((filterVal) => ({
        id: `flt_${String(filterVal).replace('.', '')}`, label: `滤波 ${filterVal} s 档`, conditionHint: `滤波时间常数 ${filterVal} s`,
        matcher: (r) => r.initialInput.longitudinal?.filterTauS === filterVal,
        metrics: [
          { key: 'peak_rpm', label: '轴速指令峰值', unit: 'r/min', seriesId: 'referenceRpm', pickMode: 'peak' },
          { key: 'flt_speed', label: '末态滤波航速', unit: 'm/s', seriesId: 'filteredSpeed', pickMode: 'steady' },
          { key: 'bow_clear', label: '末态船艏剩余距离', unit: 'm', seriesId: 'distance', pickMode: 'steady' },
          { key: 'end_speed', label: '末态对水航速', unit: 'm/s', seriesId: 'speed', pickMode: 'steady' },
        ],
      })),
    },
    interpretationSpec: {
      checklist: ['对比不同滤波档位的轴速毛刺与船艏余量', '区分波频观测扰动与真实船速状态', '论证兼顾平稳执行与足够相位裕度的选型依据'],
      placeholder: '结合 0.2/1/3 s 实测对比结果，分析量测滤波如何平衡高频执行器磨损抖动与靠泊制动滞后...',
    },
  },
  18: {
    goal: '在组合风浪流与标准测量噪声下联合冻结最终航速控制、量测滤波、分段减速与时序转向方案，验证全部安全与液面约束。',
    actionSteps: [
      '运行前输入本综合靠泊方案预期的末态船艏剩余距离目标值（m）并写出多约束取舍理由。',
      '在控制区综合设定本人冻结航速模型、PI 倍率、抗饱和、量测滤波、减速计划与时序转向计划，点击「开始」完成综合靠泊运行。',
      '逐项核验船艏余量、末速、末 60 秒横偏与液面幅值是否满足约束，再从下方采集 6 项实测指标作为第 19 步冻结基线。',
    ],
    watch: '全面核查：船艏剩余距离保持正安全裕量、北向对地航速稳步降至低速、末 60 秒横向偏移峰值受控、液面幅值未超小幅上限且横摇平稳。',
    conditionText: '风浪流组合环境叠加标准测量噪声，85% 装载率，水深 40 m、初态距停泊线 1500 m、初速 4.0 m/s，设计并冻结最终综合靠泊方案。',
    suggestion: '在复杂条件下切忌一味追求最短时间而压穿余量；确保参考控制律与任务本身物理有解后再固化该综合方案。',
    predictionSpec: {
      kind: 'numeric_target', unit: 'm', targetPlaceholder: '如 180',
      prompt: '结合你所设计的最终综合靠泊方案，预估在组合风浪流与噪声环境下的末态船艏剩余距离 (m)：',
      allowRationale: true, rationalePlaceholder: '说明减速起点、速度节点、转向修正与量测滤波如何协同保障靠泊余量与液面平稳...',
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '综合靠泊运行结束后，读取以下 6 项实测结果以确认全部工程约束：',
      metrics: [
        { key: 'bow_clear', label: '末态船艏剩余距离', unit: 'm', seriesId: 'distance', pickMode: 'steady' },
        { key: 'end_speed', label: '末态对水航速', unit: 'm/s', seriesId: 'speed', pickMode: 'steady' },
        { key: 'max_east', label: '横向位置偏移峰值', unit: 'm', seriesId: 'east', pickMode: 'peak' },
        { key: 'slosh_peak', label: '液面幅值峰值', unit: 'm', seriesId: 'slosh', pickMode: 'peak' },
        { key: 'end_heading', label: '末态航向量测', unit: '°', seriesId: 'heading', pickMode: 'steady' },
        { key: 'ground_speed', label: '末态北向对地航速', unit: 'm/s', placeholder: '见左侧「本次运行与液面统计」' },
      ],
    },
    interpretationSpec: {
      checklist: ['逐项核查船艏余量、末速、横偏与液面小幅约束', '论证控制器、滤波与速度/转向计划的多目标协同', '界定该方案基于 85% 装载工况的设计前提'],
      placeholder: '复盘第 18 步综合方案在风浪流与噪声下的各项实测指标及余量裕度，说明其在第 19 步未见装载下的潜在风险...',
    },
  },
  19: {
    goal: '将第 18 步冻结方案不作修改迁移至 70% 与 95% 两套未见装载工况检验泛化域，再据实完成一次有依据的修正验证（三份记录互不覆盖）。',
    actionSteps: [
      '运行前预判第 18 步（85% 装载）冻结方案直接用于 70% 与 95% 未见工况时的惯性滑行与晃荡变化趋势。',
      '在控制区「已冻结的综合方案」导入第 18 步方案后勿改任何参数，依次选择「未见工况甲（70% 填充率）」与「未见工况乙（95% 填充率）」各跑完 1 次盲测并提取前两槽数据。',
      '点击「重置」，依据前两次盲测暴露的余量不足或超限问题仅作有依据的修正完成第 3 次运行，并在第 3 槽提取修正结果。',
    ],
    watch: '95% 满载重工况因质量增大极易导致船艏安全余量收缩甚至越线，70% 装载下转向横偏与液面晃荡谱亦发生迁移；注意观察修正前后改善幅值。',
    conditionText: '复杂风浪流组合环境叠加标准测量噪声，两套未见装载工况（70% 填充率与 95% 填充率），须完整保留 2 次原方案盲测与 1 次修正运行（共 3 次不覆盖）。',
    suggestion: '严禁未保存两次原方案盲测就直接调参；即使原方案在某未见装载下触发越线失败，也必须如实保留并在修正运行后解释原因。',
    predictionSpec: {
      kind: 'choice',
      prompt: '将针对 85% 装载设计的第 18 步冻结方案原样迁移到 70% 与 95% 两种未见装载工况时，最合理的预期是？',
      options: [
        choiceOpt('mass_shift_margin_erosion', '95% 重载惯性增大使停船滑行距离拉长、余量收窄或越线，70% 工况液面频率与横偏特性改变，需实测边界后作有据修正', '质量、吃水与液舱模态参数均随填充率系统偏移，固定增益和静水减速节点裕量会发生变化'),
        choiceOpt('zero_generalization_error', '70% 与 95% 未见工况的停船距离与晃荡曲线将与第 18 步完全相同', '忽视了排水量变化对纵荡惯性和水动力阻尼的影响'),
        choiceOpt('only_light_fails', '仅 70% 较轻工况惯性最大且必定大幅冲过停泊线', '混淆了轻载与重载排水质量对制动惯性距离的影响方向'),
      ],
      allowRationale: true, rationalePlaceholder: '结合第 12 步测得的质量/吃水变化与第 14 步晃荡频移规律阐述盲测风险预判...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '先依次完成工况甲（70%）、工况乙（95%）原方案盲测并分别点击提取，再完成第 3 次修正运行后提取第 3 槽数据：',
      slots: [
        {
          id: 'unseen_70', label: '未见工况甲（70% 填充率 · 原方案）', conditionHint: '第 1 次盲测 · 原参数',
          matcher: (r) => r.configuration.seed === 17,
          metrics: berthCompareMetrics('fill', '盲测填充率', (r) => (typeof r.configuration.loadingRatio === 'number' ? `${Math.round(r.configuration.loadingRatio * 100)}%` : null)),
        },
        {
          id: 'unseen_95', label: '未见工况乙（95% 填充率 · 原方案）', conditionHint: '第 2 次盲测 · 原参数',
          matcher: (r) => r.configuration.seed === 29,
          metrics: berthCompareMetrics('fill', '盲测填充率', (r) => (typeof r.configuration.loadingRatio === 'number' ? `${Math.round(r.configuration.loadingRatio * 100)}%` : null)),
        },
        {
          id: 'revised_run', label: '修正方案验证运行', conditionHint: '第 3 次运行 · 有依据修正',
          metrics: [
            { key: 'revision_note', label: '修正参数项', placeholder: '如 减速起点 1400 m' },
            { key: 'bow_clear', label: '末态船艏剩余距离', unit: 'm', seriesId: 'distance', pickMode: 'steady' },
            { key: 'end_speed', label: '末态对水航速', unit: 'm/s', seriesId: 'speed', pickMode: 'steady' },
            { key: 'max_east', label: '横向偏移峰值', unit: 'm', seriesId: 'east', pickMode: 'peak' },
          ],
        },
      ],
    },
    interpretationSpec: {
      checklist: ['分别记录 70% 与 95% 原方案实测（含失败记录）', '明确指出第 3 次修正的参数与物理依据', '界定综合方案跨越装载变化的泛化有效域'],
      placeholder: '对比两次原方案未见装载实测与第 3 次修正效果，论证有效域边界与参数重整定前提...',
    },
  },
  20: {
    goal: '整合至少 5 次本人完整运行、冻结局部模型与独立验证对照，撰写严格界定教学模型适用边界的六部分实验报告。',
    actionSteps: [
      '在控制区「报告引用的本人运行」勾选至少 5 次涵盖建模、制动、晃荡与靠泊验证的本人完整运行。',
      '利用下方「步 1–19 实测证据胶囊」向各报告章节一键插入带模型参数、残差误差与航次数据的定量摘要。',
      '逐一完成六部分撰写并核对四维报告量规预检全绿后，点击「提交本步」并可预览导出实验报告。',
    ],
    watch: '检查四维报告量规预检是否达标、各章是否绑定本人定量证据及误差解释，并确保结论严格禁止宣称实船靠泊许可。',
    conditionText: '综合实验总结与报告撰写阶段（无需新开仿真运行），须引用本人至少 5 次完整运行、冻结局部航速模型及独立验证对照。',
    suggestion: '严禁根据本课程教学标称模型宣称实船靠泊工程许可；必须写明局部线性化、低速外推、功率限幅与小幅晃荡适用边界。',
  },
};
