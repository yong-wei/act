import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import {
  choiceOpt,
  dredgerMetric,
  dredgerSlot,
  extractDredgerSeriesOverlay,
  type DredgerStepWorkbenchSpec,
} from './dredger-step-specs-early';

const TIME_600_TICKS = [0, 120, 240, 360, 480, 600].map((value) => ({ value, label: String(value) }));

function summarizeDredgerStrategy(run: VesselRunSummary): string | null {
  const d = run.initialInput.dredger;
  if (!d) return null;
  const policyLabel = d.integralPolicy === 'track' ? '跟踪' : d.integralPolicy === 'freeze' ? '冻结' : '重置';
  return `参考 ${d.referenceMps.toFixed(2)}m/s · Kp ${d.kpMultiplier.toFixed(1)}× · 斜坡 ${d.reversalRampS}s · 积分${policyLabel} · 深 ${d.commands.depthReferenceM.toFixed(1)}m`;
}

export const DREDGER_STEP_SPECS_LATE: Record<number, DredgerStepWorkbenchSpec> = {
  11: {
    goal: '将第 5 步砂层冻结模型外推对照黏土层实测切削运行，量化土层阻力变化导致的模型失配，并在固定模式窗口重新辨识黏土联合模型。',
    actionSteps: [
      '运行前判断把无切削砂层模型直接外推到黏土层切削工况时的预测误差来源，确认本步选用第 5 步砂层联合模型后点击「冻结独立横移预测」。',
      '点击「开始」完成 600 秒黏土层横移切削运行（本步土层已切换为黏土）。',
      '前往「评估」页签：① 先选用第 5 步砂层模型做独立对照记录外推残差；② 再框选固定单一「横移切削」或「钢桩保持」连续窗重辨识并冻结黏土模型，随后一键引用摘要。',
    ],
    watch: '黏土切削力矩与横移阻力增大引起的实际横移响应变化、砂层冻结模型对照时的系统性误差，以及新辨识黏土模型的参数迁移。',
    conditionText: '平静无风浪无海流环境，土层切换为黏土（沿用原定横移计划），先以第 5 步砂层模型运行 600 秒并对照，再重辨识黏土局部模型。',
    suggestion: '土质变化会造成模型参数失配，但并不意味着闭环控制必然彻底失稳；重辨识时分析窗口切勿跨越不同作业模式。',
    predictionSpec: {
      kind: 'choice',
      prompt: '将第 5 步砂层无切削条件下辨识的局部模型用于预测黏土层横移切削响应时，最符合机理的现象是什么？',
      options: [
        choiceOpt('soil_mismatch_not_fatal', '黏土切削阻力与阻尼特性改变导致砂层模型出现明显外推失配残差，但适度整定的闭环仍可能保持有界跟踪', '土层切削阻力项改变了等效对象增益与极点，重辨识可显著降低残差'),
        choiceOpt('identical_sand_clay', '砂层模型对黏土层切削的预测曲线与实测完全吻合，误差为零', '忽视了砂与黏土截然不同的剪切、阻力和切削功耗规律'),
        choiceOpt('controller_always_diverges', '一旦土层由砂变为黏土，任何 PI 控制器都必定立即发散失控', '模型失配是对象特性偏移，不等同于闭环控制系统必然失稳'),
      ],
      allowRationale: true,
      rationalePlaceholder: '区分「土质改变引发被控对象局部模型失配」与「闭环反馈控制是否必然发散」两概念...',
    },
    observationSpec: {
      kind: 'artifact_binding',
      artifactKind: 'dual_model',
      prompt: '在「评估」页签先保存第 5 步砂层模型在本步黏土运行上的独立对照，再冻结黏土联合模型后，点击下方按钮引用：',
    },
    interpretationSpec: {
      checklist: ['对比砂层模型外推黏土运行的 RMSE/FIT 与新黏土模型拟合残差', '比较砂层与黏土冻结模型的增益/时间常数差异', '阐明土层变化下重辨识的必要性及单模式窗约束'],
      placeholder: '结合砂层模型外推偏差与黏土重辨识结果，说明土层阻力变化如何导致局部模型失配及应对边界...',
    },
  },
  12: {
    goal: '在黏土层与固定功率硬上限下对比 0.3 m 与 0.5 m 目标切厚，通过调节绞刀转速与横移参考速度厘清受限切削能力与单位实际产量能耗。',
    actionSteps: [
      '运行前判断切厚增至 0.5 m 且维持高速横移时，受限切削功率上限对刀速、横移和产量的影响。',
      '依次使用控制区快捷按钮设定目标深度 20.3 m（切厚 0.3 m）与 20.5 m（切厚 0.5 m），适当协调绞刀转速与横移速度，每次先冻结预测再跑满 600 秒。',
      '在下方两档切厚槽分别提取切削功率峰值与实际移除体积，前往「评估」页签核对单位实际产量能耗 (MJ/m³)。',
    ],
    watch: '实际切削功率 (kW) 是否逼近硬功率上限、实际移除体积 (m³) 增幅与「评估」页签中的单位实际产量能耗 (MJ/m³) 及越域时长。',
    conditionText: '平静无风浪无海流环境，黏土层，功率硬上限固定不可更改，分别完成 0.3 m（目标深 20.3 m）与 0.5 m（目标深 20.5 m）切厚两组 600 秒运行。',
    suggestion: '切勿企图通过放大理想功率上限来解决过载；当切厚增至 0.5 m 接近能力极限时，应主动调低横移参考速度或协同调节绞刀转速。',
    predictionSpec: {
      kind: 'choice',
      prompt: '在黏土层维持功率硬上限不变，把目标切厚由 0.3 m 增至 0.5 m 时，若盲目追求高速横移会发生什么？',
      options: [
        choiceOpt('capacity_limit_overload', '切削功率触及硬约束上限并触发过载/越域保护，需降低横移速度或协调绞刀转速以平衡单位产量能耗', '受限切削能力要求切厚、横移与刀速匹配，强行超限只会降低有效作业时间比'),
        choiceOpt('unlimited_linear_production', '切厚和横移速度可无限成倍放大，实际产量永远线性暴涨且功率永不触顶', '忽略了绞刀与绞车电机功率硬上限及土体切削规律适用域'),
        choiceOpt('zero_power_increase', '切厚增大后由于刀齿更深，切削功率与单位产量能耗都会同步下降为零', '更大截面积土体切除需要克服更大的切削阻矩与能量消耗'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合截面积切厚、横移速度与功率上限说明如何通过降速提效...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成 0.3 m（深 20.3 m）与 0.5 m（深 20.5 m）两组 600 秒黏土切削后，分别一键提取切厚参数、切削功率与移除体积：',
      slots: [
        dredgerSlot('cut_03', '0.3 m 目标切厚（深 20.3 m）', '目标深度 20.3 m · 黏土切削', (r) => Math.abs((r.initialInput.dredger?.commands.depthReferenceM ?? 0) - 20.3) < 1e-4, [
          { key: 'depth_ref', label: '目标深度', extract: (r) => `${r.initialInput.dredger?.commands.depthReferenceM.toFixed(1) ?? '20.3'} m` },
          { key: 'cutter_rpm', label: '绞刀转速', extract: (r) => `${r.initialInput.dredger?.commands.cutterRpm ?? 30} rpm` },
          dredgerMetric('cut_power', '实际切削功率峰值', 'kW', 'cutPower', 'max'),
          dredgerMetric('production', '实际移除体积', 'm³', 'production', 'max'),
        ]),
        dredgerSlot('cut_05', '0.5 m 目标切厚（深 20.5 m）', '目标深度 20.5 m · 黏土切削', (r) => Math.abs((r.initialInput.dredger?.commands.depthReferenceM ?? 0) - 20.5) < 1e-4, [
          { key: 'depth_ref', label: '目标深度', extract: (r) => `${r.initialInput.dredger?.commands.depthReferenceM.toFixed(1) ?? '20.5'} m` },
          { key: 'cutter_rpm', label: '绞刀转速', extract: (r) => `${r.initialInput.dredger?.commands.cutterRpm ?? 30} rpm` },
          dredgerMetric('cut_power', '实际切削功率峰值', 'kW', 'cutPower', 'max'),
          dredgerMetric('production', '实际移除体积', 'm³', 'production', 'max'),
        ]),
      ],
    },
    interpretationSpec: {
      checklist: ['对比 0.3 m 与 0.5 m 的总移除体积与切削功率峰值', '引用评估页签的单位实际产量能耗 (MJ/m³) 与硬约束时长', '说明如何联合横移速度和绞刀转速避开功率受限区'],
      placeholder: '结合两组切厚下的产量、单位产量能耗与功率受限表现，论证受限切削能力下协同调节参考的依据...',
    },
  },
  13: {
    goal: '在连续双向横移换向切削中对比 5 s、15 s 与 30 s 三档换向斜坡时间，量化过渡斜率对锚缆张力峰值、钢桩反力冲击与换向衔接平顺性的影响。',
    actionSteps: [
      '运行前判断三档换向斜坡对张力峰值的影响，并在 0–600 秒坐标系手绘横移换向过零（含平滑过渡与峰值收敛）预期波形。',
      '保持其余控制与参考条件一致，依次选用「换向斜坡」5 s、15 s 与 30 s，每次冻结预测后运行 600 秒。',
      '在下方三档斜坡对比槽依次一键提取左/右缆张力峰值、钢桩反力峰值与横移速度峰值。',
    ],
    watch: '每次到达横移半幅边界换向过零瞬间，左缆张力 (kN)、右缆张力 (kN) 与钢桩反力 (kN) 尖峰随斜坡延长的削平效果。',
    conditionText: '平静无风浪无海流环境，饱和砂层，自动横移换向切削，仅变更「换向斜坡」（5 s、15 s、30 s）完成 3 次 600 秒对比运行。',
    suggestion: '切勿在三档换向斜坡测试期间同时改变横移参考速度或横移半幅，以保持单一变量的换向冲击对比公平有效。',
    predictionSpec: {
      kind: 'choice',
      prompt: '将自动横移换向斜坡时间从 5 s 延长至 30 s 时，对换向时刻锚缆张力冲击与稳态切削时间产生什么权衡？',
      options: [
        choiceOpt('smoother_lower_tension', '延长斜坡显著平缓加速度突跃，降低左右缆张力与钢桩反力峰值冲击，但每次换向低速过渡占比略增', '斜坡限制参考变化率 dV/dt，直接减小单向锚缆松弛—绷紧切换瞬间冲击'),
        choiceOpt('higher_spike_at_30s', '30 s 缓慢换向比 5 s 急换向产生更大的锚缆拉力尖峰', '反向判断了加减速加速度需求与拉力冲击之间的物理因果'),
        choiceOpt('no_effect_on_tension', '换向斜坡时间只修改参考曲线外观，不会改变锚缆张力和钢桩反力', '参考斜坡直接决定了差动绞车速度指令和船体惯性加减速负载'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合锚缆先松弛后绷紧冲击和惯性加减速力说明 5/15/30 s 的差异...',
      sketch: {
        mode: 'prediction',
        plotId: 'time-response',
        lockPlotId: true,
        label: '运行前手绘预测：横移速度周期换向过渡与斜坡响应',
        hint: '在 0–600 s 画板内绘出正向恒速、到达边界经换向斜坡平稳过零至反向恒速的周期换向波形。',
        promptFocus: '正反横移切换时的斜坡过零坡度、对称稳态幅值与换向平滑衔接特征',
        coordinateOverride: {
          title: '横移换向斜坡预测坐标系',
          subtitle: '0–600 s 时域换向过程（正负双向横移速度与斜坡过零）',
          xMin: 0,
          xMax: 600,
          yMin: -0.15,
          yMax: 0.15,
          xLabel: '时间',
          yLabel: '横移速度与换向',
          xUnit: 's',
          yUnit: 'm/s',
          xTicks: TIME_600_TICKS,
          yTicks: [-0.15, -0.08, 0, 0.08, 0.15].map((value) => ({ value, label: value.toFixed(2) })),
          horizontalMarkers: [{ value: 0, label: '0 换向过零基线', color: '#64748b' }],
        },
        overlayExtractor: (samples) => extractDredgerSeriesOverlay(samples, 'sway', '实测横移速度 (m/s)'),
      },
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成 5 s、15 s 与 30 s 三档换向斜坡 600 秒运行后，在对应槽位提取横移峰值、左右缆张力峰值与钢桩反力峰值：',
      slots: ([5, 15, 30] as const).map((ramp) =>
        dredgerSlot(`ramp_${ramp}`, `换向斜坡 ${ramp} s`, `设定斜坡时间 ${ramp} s · 600 s`, (r) => r.initialInput.dredger?.reversalRampS === ramp, [
          { key: 'ramp', label: '换向斜坡', extract: (r) => `${r.initialInput.dredger?.reversalRampS ?? ramp} s` },
          dredgerMetric('sway_peak', '横移速度峰值', 'm/s', 'sway', 'peak'),
          dredgerMetric('port_max', '左缆张力峰值', 'kN', 'portTension', 'max'),
          dredgerMetric('starboard_max', '右缆张力峰值', 'kN', 'starboardTension', 'max'),
          dredgerMetric('spud_max', '钢桩反力峰值', 'kN', 'spud', 'max'),
        ]),
      ),
    },
    interpretationSpec: {
      checklist: ['定量比较 5/15/30 s 三档下左右缆张力与钢桩反力峰值', '结合手绘与实测换向波形说明斜坡平滑机理', '总结在减少冲击与保持有效切削时间之间的选型依据'],
      placeholder: '对比三档斜坡实测张力尖峰和换向时间占比，论证既避免缆绳猛烈冲击又保证有效产量的斜坡参数...',
    },
  },
  14: {
    goal: '在同一模式往返切换计划下对比积分直接重置与跟踪实际输出策略，厘清状态连续性、防抖保持时间与反复切换抑制机制。',
    actionSteps: [
      '运行前判断从「钢桩保持」重新切回「横移切削」瞬间，积分「直接重置」与「跟踪实际输出」的瞬态差异。',
      '保持模型、进入保持时间及所有其余参数固定，先以「直接重置」冻结预测并跑完 600 秒；重置后切换「跟踪实际输出」再跑完 600 秒（可选加测「冻结积分」）。',
      '在下方两槽提取各自缆力峰值与横移峰值，在解释中阐明防抖保持时间的选择原则。',
    ],
    watch: 't=180–240 s 与 t=360–420 s 两次退出再重入「横移切削」时刻，横移速度 (m/s) 与左右缆张力 (kN) 是否出现突变尖峰或抖振事件。',
    conditionText: '平静无风浪无海流环境，饱和砂层，预定往返切换序列（t=180–240 s 及 t=360–420 s 切回钢桩保持），在同一进入保持时间下对比积分「直接重置」与「跟踪实际输出」，各 600 秒。',
    suggestion: '两次核心对照运行之间务必保持「进入条件保持时间」和联合模型完全一致，仅变更「模式切换时的积分处理」。',
    predictionSpec: {
      kind: 'choice',
      prompt: '在「钢桩保持 ↔ 横移切削」模式往返切换瞬间，相比「直接重置」积分，「跟踪实际输出」的核心优势是什么？',
      options: [
        choiceOpt('bumpless_continuity', '保持模式期间使控制器内部积分状态连续跟踪实际绞车输出，切回切削瞬间实现无扰衔接、减小指令跃变', '避免积分骤然归零引起输出阶跃跳变、二次拉扯锚缆及诱发切换抖振'),
        choiceOpt('reset_is_smoother', '直接重置把积分清零总能使重入切削时的执行器输出变化最小', '当存在稳态偏置负载时，强行清零积分会导致重入瞬间出力跌落再剧烈拉回'),
        choiceOpt('no_difference_on_switch', '模式切换瞬间选择重置或跟踪不会对横移速度和锚缆张力产生任何可测差异', '积分项直接叠加在速度控制指令上，状态不连续必然产生出力跳变'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合存在切削阻力的稳态积分需求及防抖保持时间避免高频误切换说明机理...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '在同一保持时间下完成「直接重置」与「跟踪实际输出」两次 600 秒运行后，一键提取峰值指标对照：',
      slots: [
        dredgerSlot('policy_reset', '积分直接重置', '模式切换清零积分 · 600 s', (r) => r.initialInput.dredger?.integralPolicy === 'reset', [
          { key: 'policy', label: '积分策略', extract: () => '直接重置' },
          { key: 'hold', label: '保持时间', extract: (r) => `${r.initialInput.dredger?.entryHoldS ?? 10} s` },
          dredgerMetric('sway_peak', '横移速度峰值', 'm/s', 'sway', 'peak'),
          dredgerMetric('port_max', '左缆张力峰值', 'kN', 'portTension', 'max'),
          dredgerMetric('spud_max', '钢桩反力峰值', 'kN', 'spud', 'max'),
        ]),
        dredgerSlot('policy_track', '积分跟踪实际输出', '无扰跟踪实际输出 · 600 s', (r) => r.initialInput.dredger?.integralPolicy === 'track', [
          { key: 'policy', label: '积分策略', extract: () => '跟踪实际输出' },
          { key: 'hold', label: '保持时间', extract: (r) => `${r.initialInput.dredger?.entryHoldS ?? 10} s` },
          dredgerMetric('sway_peak', '横移速度峰值', 'm/s', 'sway', 'peak'),
          dredgerMetric('port_max', '左缆张力峰值', 'kN', 'portTension', 'max'),
          dredgerMetric('spud_max', '钢桩反力峰值', 'kN', 'spud', 'max'),
        ]),
      ],
    },
    interpretationSpec: {
      checklist: ['对比直接重置与跟踪在重入切削时的横移与缆力突变', '在评估页签核对反复切换事件次数', '阐明防抖保持时间过短/过长对切换稳定性与作业效率的权衡'],
      placeholder: '对比两次模式往返运行在 t=240 s 与 t=420 s 重入切削时的冲击差异，并说明防抖保持时间的选取依据...',
    },
  },
  15: {
    goal: '将第 9–14 步静水方案投入风流组合环境测出负载余量基准，再保持工况与模型不变仅修改唯一一项控制策略完成抗扰对比。',
    actionSteps: [
      '在控制区「引用已冻结的静水作业方案」导入第 9–14 步已保存方案，先不改动任何参数，冻结预测后完成 600 秒风流基准运行。',
      '点击「重置」，保持联合模型与工况不变，确认差异计数在修改恰好 1 项策略后显示「1/1 项」，再次冻结预测并完成第 2 次 600 秒对比运行。',
      '分别在「风流原静水方案基准」与「风流单策略修订对照」两槽提取横移与缆桩峰值，分析风流环境对负载裕度的压缩。',
    ],
    watch: '风流持续载荷引起的钢桩反力峰值 (kN)、左右锚缆张力不对称抬升 (kN) 以及修订单个策略前后横移速度跟踪裕量的改善。',
    conditionText: '存在风载荷与定常海流的饱和砂层环境（无波浪），先以原静水方案运行 600 秒基准，再同条件下只改 1 项控制策略运行 600 秒对照。',
    suggestion: '必须先跑完未改动的静水原方案基准，再只改动唯一一项策略参数重跑；改动两项及以上或更换模型均无法通过单因素校验。',
    predictionSpec: {
      kind: 'choice',
      prompt: '把静水整定方案直接投入持续风流干扰环境时，钢桩与双侧锚缆负载及横移裕量最可能产生何种变化？',
      options: [
        choiceOpt('wind_current_margin_shrink', '风流稳态偏置与阻力抬升一侧锚缆张力和钢桩反力均值，挤压结构与驱动余量；针对性调整单项策略可重塑裕量分配', '环境载荷叠加到船体六自由度后经锚缆和钢桩平衡，不同控制参数决定跟踪与张力折中'),
        choiceOpt('wind_cancels_soil_load', '风和海流会正好抵消全部泥土切削载荷，使锚缆张力和钢桩反力降为零', '风流干扰与土体切削负载叠加在定位约束链上，通常压缩而非扩大安全裕量'),
        choiceOpt('calm_and_wind_identical', '静水方案在风流中的横移曲线、缆力峰值和钢桩反力与无风无流完全相同', '忽略了水上风面积与水下流阻力在定位作业中的耦合作用'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合风流作用方向、单向受拉缆偏置负荷与选改策略的作用链路说明预测理由...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成风流基准与单策略修订两次 600 秒运行后，在两槽分别提取方案概要及横移、缆力与钢桩峰值：',
      slots: [
        dredgerSlot('wind_baseline', '风流原静水方案基准', '第 1 次运行 · 未改静水参数', (r) => r.stoppedAtMs !== null, [
          { key: 'scheme', label: '方案概要', extract: summarizeDredgerStrategy },
          dredgerMetric('sway_peak', '横移速度峰值', 'm/s', 'sway', 'peak'),
          dredgerMetric('port_max', '左缆张力峰值', 'kN', 'portTension', 'max'),
          dredgerMetric('spud_max', '钢桩反力峰值', 'kN', 'spud', 'max'),
        ]),
        dredgerSlot('wind_revised', '风流单策略修订对照', '第 2 次运行 · 仅修改 1 项控制策略（跑完后点击一键提取）', undefined, [
          dredgerMetric('changed_item', '修改策略与取值', undefined, undefined, undefined, '如 换向斜坡=30 s 或 Kp倍率=0.6'),
          dredgerMetric('sway_peak', '横移速度峰值', 'm/s', 'sway', 'peak'),
          dredgerMetric('port_max', '左缆张力峰值', 'kN', 'portTension', 'max'),
          dredgerMetric('spud_max', '钢桩反力峰值', 'kN', 'spud', 'max'),
        ]),
      ],
    },
    interpretationSpec: {
      checklist: ['对比静水与风流基准下的缆力与钢桩反力裕量变化', '指明唯一修改的控制项及其定量效果', '评估在风流偏置负载下保留结构安全余量的策略取舍'],
      placeholder: '对比原静水方案在风流下的实测负载变化，写出唯一修改的控制策略及修改前后的缆桩峰值、横移精度权衡...',
    },
  },
  16: {
    goal: '保持全部控制与滤波参数不变对比无浪与 0.5 m 横浪工况，实证波浪升沉与横摇直接改变实际刀位深度、瞬时切厚与作业负载，并考察深度滤波作用。',
    actionSteps: [
      '运行前判断 0.5 m 横浪是否会穿透船体运动直接影响桥架刀位深度与切削功率波动。',
      '保持联合模型、深度滤波时间常数与目标深度完全不变：先关闭「0.5m横浪」冻结预测并跑完 600 秒；重置后仅开启「0.5m横浪」再次冻结预测并跑完 600 秒。',
      '在下方「无浪基准」「0.5 m 横浪对照」两槽提取刀位深度、横摇峰值与切削功率峰值，分析波浪与滤波的权衡。',
    ],
    watch: '刀位深度量测 (m) 相对目标值的高频波频起伏、横摇真值 (°) 增大以及实际切削功率 (kW) 随波浪切厚波动而出现的峰值抬升。',
    conditionText: '饱和砂层叠加风流环境（水深 20 m），其余控制与滤波参数严格一致，仅对比关闭与开启有效波高 0.5 m、周期 6 s 横浪，各 600 秒。',
    suggestion: '两轮对比期间切勿更改「深度滤波时间常数」「刀位包络目标深度」或联合模型！若想测试另一滤波值，请同步重跑无浪与有浪两组。',
    predictionSpec: {
      kind: 'choice',
      prompt: '施加有效波高 0.5 m、周期 6 s 的横浪后，天鲸号作业物理量除船身摇晃外还会发生什么关键变化？',
      options: [
        choiceOpt('wave_couples_depth_and_cut', '船体升沉与横摇经桥架几何直接传递到绞刀刀位深度，造成瞬时切厚、切削功率与锚缆张力同步高频波动', '强深度滤波虽能平滑测量曲线，但不能消除波浪对真实刀位与切削载荷的物理扰动，且滤波过强会引入相位滞后'),
        choiceOpt('visual_roll_only', '波浪只会让船体产生视觉上的横摇晃动，桥架刀位深度与土体切削负载绝不受任何影响', '忽视了刚体船体与下放桥架之间的几何运动学和动力耦合'),
        choiceOpt('filter_cancels_physical_wave', '只要把深度量测滤波时间常数调大，海床处绞刀受到的真实波浪切厚波动就会完全消失', '低通滤波仅作用于传感反馈通道，无法凭空消去真实的波浪水动力运动'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合升沉/横摇向桥架末端的运动传递链以及传感低通滤波的滞后特性说明理由...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '保持同一控制与滤波方案完成「无浪关闭」与「0.5 m 横浪开启」两次 600 秒运行后，一键提取各自深度、横摇与切削功率峰值：',
      slots: [
        dredgerSlot('wave_off', '无浪基准（风流工况）', '0.5 m 横浪关闭 · 600 s', (r) => r.configuration.environmentSwitches?.wave_enabled === false, [
          { key: 'wave', label: '波浪开关', extract: () => '关闭' },
          { key: 'depth_tau', label: '深度滤波', extract: (r) => `${r.initialInput.dredger?.depthFilterTauS ?? 0.2} s` },
          dredgerMetric('depth_max', '最大刀位深度', 'm', 'depth', 'max'),
          dredgerMetric('roll_peak', '横摇真值峰值', '°', 'roll', 'peak'),
          dredgerMetric('cut_power', '切削功率峰值', 'kW', 'cutPower', 'max'),
        ]),
        dredgerSlot('wave_on', '0.5 m 横浪叠加对比', '0.5 m 横浪开启 · 600 s', (r) => r.configuration.environmentSwitches?.wave_enabled === true, [
          { key: 'wave', label: '波浪开关', extract: () => '开启' },
          { key: 'depth_tau', label: '深度滤波', extract: (r) => `${r.initialInput.dredger?.depthFilterTauS ?? 0.2} s` },
          dredgerMetric('depth_max', '最大刀位深度', 'm', 'depth', 'max'),
          dredgerMetric('roll_peak', '横摇真值峰值', '°', 'roll', 'peak'),
          dredgerMetric('cut_power', '切削功率峰值', 'kW', 'cutPower', 'max'),
        ]),
      ],
    },
    interpretationSpec: {
      checklist: ['给出无浪与 0.5 m 横浪下刀位、横摇与切削功率的实测差额', '阐明波浪运动传递至实际切厚与负载的几何链', '分析深度量测滤波抑制噪声与引入滞后的双面影响'],
      placeholder: '对照无浪与有浪两组实测深度和功率峰值，说明波浪对真实切削作业的影响以及深度滤波时间常数的适用权衡...',
    },
  },
  17: {
    goal: '在波浪扰动与真实传感噪声及延迟下比较 5 s、10 s、20 s 三档进入保持时间，协同选定滤波、进入速度与安全阈值参数。',
    actionSteps: [
      '运行前判断带传感噪声时过短保持时间与过弱滤波易触发的切换异常。',
      '合理设定深度/横移滤波时间常数、进入速度门限与安全阈值系数，依次选用「进入条件保持」5 s、10 s 与 20 s，每次冻结预测后运行 600 秒。',
      '在下方三档保持时间槽分别提取峰值读数，前往「评估」页签核查反复切换事件次数并定型综合基准方案。',
    ],
    watch: '评估页签中的「反复切换事件」与「实际切削模式时长」，以及曲线中因噪声毛刺或波浪波动触发模式/保护状态的变化。',
    conditionText: '饱和砂层、全要素风浪流（含 0.5 m 横浪）并叠加真实传感量测噪声与延迟，比较 5 s、10 s、20 s 三档进入保持时间，各 600 秒。',
    suggestion: '建议第 17 步保存至少 1 组兼顾稳定防抖、合理滤波与安全阈值的综合运行方案，供第 18 步断缆应急与第 19 步盲测直接引用。',
    predictionSpec: {
      kind: 'choice',
      prompt: '在存在波浪起伏与传感量测噪声/时延的环境中，若进入保持时间设得过短（如 5 s）且滤波较弱，最可能出现什么风险？',
      options: [
        choiceOpt('chatter_and_false_trip', '噪声毛刺易越过判据门限导致反复进出切削模式的抖振或误触发保护，而过长保持与过强滤波又会拖慢有效入切反应', '保持时间与滤波时间常数共同决定抗噪防抖能力与状态切换响应速度的权衡'),
        choiceOpt('shortest_always_best', '进入保持时间越短越稳定，传感噪声绝不会引发误判或反复切换', '忽视了带噪量测瞬时越限引发模式抖振的工程现实'),
        choiceOpt('longest_filter_zero_delay', '把滤波时间常数与保持时间同时调到最大可做到零延迟且永不误触发', '强滤波引入相位滞后且长保持延迟模式进入，均直接降低动态反应速度'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合传感噪声幅值、低通滤波相位滞后与保持计时器防抖原理阐述反应速度与稳定性平衡...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成 5 s、10 s 与 20 s 三档进入保持时间 600 秒运行后，在对应槽位提取参数与实测峰值：',
      slots: ([5, 10, 20] as const).map((hold) =>
        dredgerSlot(`hold_${hold}`, `保持时间 ${hold} s`, `进入保持 ${hold} s · 带波浪与噪声`, (r) => r.initialInput.dredger?.entryHoldS === hold, [
          { key: 'hold', label: '保持时间', extract: (r) => `${r.initialInput.dredger?.entryHoldS ?? hold} s` },
          { key: 'filters', label: '滤波设置', extract: (r) => r.initialInput.dredger ? `深 ${r.initialInput.dredger.depthFilterTauS}s / 移 ${r.initialInput.dredger.swayFilterTauS}s` : null },
          dredgerMetric('depth_max', '最大刀位深度', 'm', 'depth', 'max'),
          dredgerMetric('port_max', '左缆张力峰值', 'kN', 'portTension', 'max'),
          dredgerMetric('sway_peak', '横移速度峰值', 'm/s', 'sway', 'peak'),
        ]),
      ),
    },
    interpretationSpec: {
      checklist: ['对比 5/10/20 s 下的反复切换事件与切削时长', '分析传感滤波、进入门限与安全系数的协同机理', '总结所选定综合方案在稳定性与反应速度间的折中'],
      placeholder: '依据三档保持时间的切换事件与响应延迟差异，阐明防抖保持与传感滤波的工程折中依据...',
    },
  },
  18: {
    goal: '在全要素风浪流与噪声作业中验证 t=180 s 单侧断缆保护退出流程，确认断缆触发停止切削、抬刀离床与安全保持的真实物理响应。',
    actionSteps: [
      '运行前选择故障应对判断，并在 0–600 秒坐标画板（标有 t=180 s 断缆抬刀垂线）手绘断缆前下刀切削与断缆后抬刀离床轨迹。',
      '引用第 17 步方案并微调（确保能在 t=180 s 前稳定进入「横移切削」模式），先「冻结独立横移预测」再点击「开始」完成 600 秒运行。',
      '在下方结构化指标卡核对断缆前入切状态、右缆张力跌零、左缆受载峰值、安全抬刀后刀位深度与绞刀停转读数。',
    ],
    watch: 't=180 s 右缆断裂瞬间「右缆张力量测」跌落为零、状态灯触发「作业保护已触发」、绞刀转速归零且刀位深度从 20.3 m 抬升回安全离床高度。',
    conditionText: '饱和砂层、全要素风浪流与传感量测噪声，t=180 s 注入右舷单侧锚缆断裂故障，须选用在 t=180 s 前已进入横移切削的方案完成 600 秒运行。',
    suggestion: '如果方案进入切削过慢导致 t=180 s 时仍未处于横移切削，可适当放宽进入速度门限或提前目标深度并在运行前重新冻结预测。',
    predictionSpec: {
      kind: 'choice',
      prompt: '当作业处于横移切削状态且于 t=180 s 发生单侧锚缆断裂时，为什么安全保护不能仅仅把界面模式标签改写为退出，而必须立即执行物理动作？',
      options: [
        choiceOpt('physical_lift_and_stop', '断缆使横向单向约束力骤失并破坏力矩平衡，必须立即停止切削、抬刀离床并撤除牵引以防止船体失控打横或撞击刀头', '失效直接改变了物理受力链，只有停止绞刀、抬刀并安全保持才能解除土体切削耦合风险'),
        choiceOpt('label_change_sufficient', '只要把状态显示标签切换为退出即可自动产生虚拟拉力守住原位', '状态标签不会改变物理力学方程，断缆后单侧缆力缺失客观存在'),
        choiceOpt('continue_cutting_faster', '单侧断缆后应提高绞刀转速与另一侧拉速继续全速切削', '单侧受拉失衡下继续强行切削会造成剧烈偏航、断桩或设备损坏'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合单侧锚缆拉力突然归零对绕钢桩力矩与绞刀碰撞风险的影响说明动作顺序...',
      sketch: {
        mode: 'prediction',
        plotId: 'time-response',
        lockPlotId: true,
        label: '运行前手绘预测：t=180 s 单侧断缆前后的刀位深度变化轨迹',
        hint: '在 0–600 s 画板内绘出从 19.5 m 下刀至 20.3 m 左右进行切削，并于红色垂线 t=180 s 断缆后迅速抬刀离床（深度减小）的预期曲线。',
        promptFocus: 't<180 s 稳定下刀切削深度与 t=180 s 单侧断缆触发保护后的迅速抬刀回升过程',
        coordinateOverride: {
          title: '断缆安全退出刀位深度预测坐标系',
          subtitle: '0–600 s 刀位深度响应（t=180 s 发生单侧断缆并触发安全抬刀）',
          xMin: 0,
          xMax: 600,
          yMin: 17.5,
          yMax: 21.0,
          xLabel: '时间',
          yLabel: '刀位深度',
          xUnit: 's',
          yUnit: 'm',
          xTicks: [0, 120, 180, 300, 450, 600].map((value) => ({ value, label: String(value) })),
          yTicks: [17.5, 18.5, 19.5, 20.0, 20.5, 21.0].map((value) => ({ value, label: value.toFixed(1) })),
          verticalMarkers: [{ value: 180, label: 't=180s 单侧断缆抬刀', color: '#ef4444' }],
          horizontalMarkers: [
            { value: 19.5, label: '19.5m 准备离床', color: '#64748b' },
            { value: 20.0, label: '20.0m 海床基准', color: '#f59e0b' },
          ],
        },
        overlayExtractor: (samples) => extractDredgerSeriesOverlay(samples, 'depth', '实测刀位深度 (m)'),
      },
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '完成 600 秒单侧断缆保护运行后，记录断缆前入切情况并从曲线提取断缆后张力、安全抬刀深度与停刀转速：',
      metrics: [
        dredgerMetric('cut_entry', '断缆前是否已进入横移切削', undefined, undefined, undefined, '见事件或填写如 t=28 s 已进入横移切削'),
        dredgerMetric('starboard_after', '断缆后右缆张力量测末态', 'kN', 'starboardTension', 'steady'),
        dredgerMetric('port_max', '过程左缆张力峰值', 'kN', 'portTension', 'max'),
        dredgerMetric('depth_recover', '抬刀后安全保持刀位深度', 'm', 'depth', 'steady'),
        dredgerMetric('cutter_after', '停刀后绞刀转速末态', 'rpm', 'cutter', 'steady'),
      ],
    },
    interpretationSpec: {
      checklist: ['对照手绘与实测刀位深度在 t=180 s 后的抬刀拐点', '结合评估页签的断缆后停止指令与安全抬刀时长评价响应', '阐明单侧断缆如何物理破坏力矩平衡及不能只改状态标签的原因'],
      placeholder: '结合右缆张力归零、停止切削与安全抬刀实测时间及深度曲线，分析故障后物理受力重构与保护退出动作的完备性...',
    },
  },
  19: {
    goal: '严格锁定第 17 或第 18 步已保存的综合作业方案，在两套未见土层与陌生风浪流海况下开展盲测验证，实证泛化能力与超限边界。',
    actionSteps: [
      '在控制区「引用第 17 或第 18 步综合方案」选定已冻结方案（所有调参输入将自动只读锁定以保证一致验证）。',
      '在预测区判断同一固定方案迁移至陌生砂层与黏土组合风浪海况的潜在表现与风险。',
      '依次选择「未见砂层工况甲」与「未见黏土工况乙」，每次先点击「冻结独立横移预测」再运行完整 600 秒，分别提取两组结果（如实保留超限或失败记录）。',
    ],
    watch: '两套未见工况下的横移速度跟踪、刀位波动、左缆与钢桩负载峰值及实际移除体积，确认是否出现保护中止或性能退化。',
    conditionText: '两套未见土层与独立随机风浪流+传感噪声盲测工况（未见砂层工况甲、未见黏土工况乙），全程锁定第 17 或第 18 步已冻结完整方案，各 600 秒。',
    suggestion: '严禁为迎合达标而擅自修改锁定方案参数或删改超限运行记录；诚实保留盲测暴露的问题是第 20 步高分分析的重要依据。',
    predictionSpec: {
      kind: 'choice',
      prompt: '将针对已知工况整定的第 17/18 步综合方案原封不动投入两套未见砂层与黏土组合风浪流盲测工况时，最科学的预期是？',
      options: [
        choiceOpt('soil_and_wave_domain_test', '未见砂层下表现相对接近设计基准，而未见黏土切削阻矩增大叠加陌生随机风浪可能压缩安全裕量甚至触发保护中止', '同一固定控制器在跨越土层边界和不同随机海浪实现时会出现可观的性能分化，须如实检验与归因'),
        choiceOpt('identical_blind_results', '砂层工况甲与黏土工况乙的曲线、产量与缆力峰值会完全一致', '忽略了不同土层阻力规律与不同随机波风实现带来的扰动差异'),
        choiceOpt('modify_scheme_between_seeds', '应在盲测中途针对工况乙单独大幅修改增益与门限以确保两条曲线都好看', '盲测验证要求保持冻结方案完全一致，中途改参会破坏验证的科学独立性'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合原方案所依据的模型土层背景、滤波器/保持时间及黏土附加切削负荷说明预判...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '保持同一冻结方案不变，完成「未见砂层工况甲」与「未见黏土工况乙」各 600 秒盲测后，分别一键提取实测表现：',
      slots: [
        dredgerSlot('blind_sand', '未见砂层工况甲', '陌生随机风浪流 · 砂层盲测', (r) => r.configuration.seed === 17, [
          { key: 'soil', label: '盲测工况', extract: () => '未见砂层工况甲' },
          dredgerMetric('sway_peak', '横移速度峰值', 'm/s', 'sway', 'peak'),
          dredgerMetric('depth_steady', '末态刀位深度', 'm', 'depth', 'steady'),
          dredgerMetric('port_max', '左缆张力峰值', 'kN', 'portTension', 'max'),
          dredgerMetric('production', '实际移除体积', 'm³', 'production', 'max'),
        ]),
        dredgerSlot('blind_clay', '未见黏土工况乙', '陌生随机风浪流 · 黏土盲测', (r) => r.configuration.seed === 29, [
          { key: 'soil', label: '盲测工况', extract: () => '未见黏土工况乙' },
          dredgerMetric('sway_peak', '横移速度峰值', 'm/s', 'sway', 'peak'),
          dredgerMetric('depth_steady', '末态刀位深度', 'm', 'depth', 'steady'),
          dredgerMetric('port_max', '左缆张力峰值', 'kN', 'portTension', 'max'),
          dredgerMetric('production', '实际移除体积', 'm³', 'production', 'max'),
        ]),
      ],
    },
    interpretationSpec: {
      checklist: ['确认两套未见盲测严格使用同一第 17/18 步冻结方案', '对比砂层工况甲与黏土工况乙的性能与安全裕度差异', '诚实总结未达目标或触发保护的原因及后续工程修正方向'],
      placeholder: '对比两套未见土层工况实测指标与前序基准差异，如实分析超限、负载收紧或模式退出原因并界定方案适用土层范围...',
    },
  },
  20: {
    goal: '整合至少 6 次本人完整运行、双通道辨识模型、三类独立对照以及负载、模式切换与断缆保护证据，撰写恪守教学口径的六部分实验报告。',
    actionSteps: [
      '在控制区「报告引用的本人运行」勾选至少 6 次覆盖静水辨识、对照验证、土层失配、模式切换、风浪作业、断缆退出与盲测的本人完整运行。',
      '利用下方「步 1–19 实测证据胶囊」将冻结双通道模型、三类独立对照误差及模式/断缆数据一键插入对应报告章节，核对四维量规预检全达标。',
      '逐一完成报告六部分，务必在问题与结论部分明确声明本实验教学结果不得宣称为实际工程产能保证或结构许可，随后提交并导出审阅。',
    ],
    watch: '评估区双通道模型、三类独立对照计数与四维报告量规预检全绿状态，以及是否严守教学能耗/产能边界而不做实际工程产能或结构许可宣称。',
    conditionText: '综合实验总结与报告撰写阶段（无需新开仿真运行），须引用至少 6 次本人完整运行、双通道辨识模型及三类独立对照证据。',
    suggestion: '报告必须明确绞刀、绞车与推进机械能耗口径、均质低速教学土层假设，严禁将教学仿真数值宣称为实际挖泥工程产能保证或结构许可。',
    interpretationSpec: {
      placeholder: '按六章节要求梳理完整实验证据链，并明确声明教学土层/设备参数及能耗口径不构成实际工程产能保证或结构强度许可。',
      checklist: ['已勾选并引用至少 6 次本人完整运行记录', '已引用绞车双通道模型与三类独立验证对照指标', '已明确声明不宣称实际工程产能保证或结构许可'],
    },
    reportFieldGuides: {
      problem: '界定天鲸号钢桩—双弹性锚缆—桥架—绞刀耦合受力链及均质低速教学土层假设，声明不代表实际工程结构校核或产能保证。',
      identification: '汇总第 5 步同一运行冻结的双通道横移模型参数，以及第 11 步砂层转黏土重辨识后的结构参数对比。',
      validation: '引用第 6 步反向小横移实测输入与指令双方式对照、第 10 步独立闭环对照及第 11 步砂层外推黏土失配 RMSE/FIT。',
      comparison: '总结第 10、12–17 步在 PI 增益、受限切厚、换向斜坡、积分重置/跟踪、风流负载、波浪切厚及保持时间上的工程权衡。',
      revision: '梳理第 15–19 步风流单策略修订、t=180 s 单侧断缆停刀抬刀安全退出流程及两套未见土层盲测暴露出的改进方向。',
      conclusion: '凝练模型适用模式/土层范围、机械能耗统计口径，并重申教学仿真结论不得宣称为实际工程产能保证或结构许可。',
    },
  },
};
