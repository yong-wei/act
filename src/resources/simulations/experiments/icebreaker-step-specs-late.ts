import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import {
  choiceOpt, extractFilterTauS, extractGainSummary, extractIcebreakerHeadingActualSeries,
  extractIceStrengthMpa, extractIceThicknessM, extractRunEndTimeS, extractWaterSpeedMps,
  met, slot, ticksOf, type IcebreakerStepWorkbenchSpec,
} from './icebreaker-step-specs-early';

export function extractScheduleMode(run: VesselRunSummary): string | null {
  return run.initialInput.iceHeadingSchedule ? '两工况调度' : '固定控制器';
}

export function extractRampS(run: VesselRunSummary): string | null {
  return typeof run.courseSettings?.rampS === 'number' ? String(run.courseSettings.rampS) : null;
}

export function extractUnseenIceSummary(run: VesselRunSummary): string | null {
  const h = extractIceThicknessM(run);
  const s = extractIceStrengthMpa(run);
  return h && s ? `${h} m / ${s} MPa` : null;
}

export function extractPodJamStatus(run: VesselRunSummary): string | null {
  if (!run.configuration.azimuthJamFault) return '正常双吊舱';
  return run.courseSettings?.stopOnJam ? '180s单吊舱卡滞 · 卡滞后停桨' : '180s单吊舱卡滞 · 维持推进';
}

export function extractRunStopSummary(run: VesselRunSummary): string | null {
  if (run.stoppedAtMs === null) return null;
  if (run.stopReason === 'arrival') return `${run.lastTimeS.toFixed(1)} s（抵达800m）`;
  if (run.configuration.azimuthJamFault && run.stopReason === 'student') return `${run.lastTimeS.toFixed(1)} s（故障观察结束）`;
  return `${run.lastTimeS.toFixed(1)} s（达到运行时限）`;
}

export function extractStrategySummary(run: VesselRunSummary): string | null {
  const gains = extractGainSummary(run);
  const sched = extractScheduleMode(run);
  const filterTau = extractFilterTauS(run);
  const refSpd = run.courseSettings?.speedReferenceMps;
  const bias = run.courseSettings?.headingBiasDeg ?? 0;
  return [
    gains,
    sched,
    filterTau ? `滤波 ${filterTau}s` : null,
    typeof refSpd === 'number' ? `参考航速 ${refSpd.toFixed(1)}m/s` : null,
    typeof bias === 'number' ? `航向补偿 ${bias.toFixed(1)}°` : null,
  ].filter(Boolean).join(' · ');
}

export const ICEBREAKER_STEP_SPECS_LATE: Record<number, IcebreakerStepWorkbenchSpec> = {
  11: {
    goal: '在 0.60 m 冰区 ±5° 航向转向激励下划定互不重叠的训练窗与验证窗，辨识冻结冰区局部航向模型并量化不确定性。',
    actionSteps: [
      '运行前判断在 0.60 m 冰区辨识得到的局部模型与第 3 步开水模型在增益、时间常数及拟合残差上的差异。',
      '选中第 3 步开水模型并点击「冻结独立航向预测」，运行 600 秒冰区小转向（t=20 s 转 +5°、t=300 s 转 −5°）。',
      '前往「评估」页签先选定入冰前半段窗口（如 180–360 s）辨识并冻结冰区局部模型；再切换至不重叠的后半段窗口（如 360–580 s）以该冰区模型运行独立对照，最后回到本栏一键引用摘要。',
    ],
    watch: '入冰转向过程中转艏速率响应变缓或波动加剧、训练窗口残差明显高于开阔水域，以及非重叠验证窗口的 FIT 水平。',
    conditionText: '无风浪流、无测量噪声平整冰区（冰厚 0.60 m、抗弯强度 0.50 MPa），初始航速 1.0 m/s，t=20 s 转 +5°、t=300 s 转 −5°，航速 PI 开启，总时长 600 秒。',
    suggestion: '训练窗口与独立验证窗口严禁重叠！若辨识出负时间常数反映局部开环方向不稳定趋势，请结合残差与独立窗口谨慎评估可用范围。',
    predictionSpec: {
      kind: 'choice',
      prompt: '相比第 3 步开阔水域局部模型，在 0.60 m 冰区辨识得到的局部转艏模型通常具有什么特征？',
      options: [
        choiceOpt('ice_nonlinear_residual', '冰接触随机断冰与降速耦合使局部等效增益与时间常数显著改变，拟合残差增大且仅在入冰激励窗口邻域有效', '碎冰接触力矩随航向角与接触点实时变化，使低阶线性模型不可避免地带有更高不确定性'),
        choiceOpt('identical_to_open_water', '冰区模型参数 K、T 及残差与开阔水域模型完全相同', '忽略了船冰侧向挤压力矩与高阻尼作用'),
        choiceOpt('exact_zero_residual', '因为冰层平整，辨识出的冰区线性模型拟合度将严格达到 100%', '即使平整冰板也会因周期性压碎—弯折断裂呈现强烈脉动与非稳态特征'),
      ],
      allowRationale: true, rationalePlaceholder: '结合入冰时变接触刚度、破碎间隙与航速波动说明参数及不确定性变化...',
    },
    observationSpec: {
      kind: 'artifact_binding', artifactKind: 'model',
      prompt: '在「评估」页签完成冰区局部模型冻结与非重叠独立窗口对照保存后，点击下方按钮一键引用冰区模型参数与独立验证摘要：',
    },
    interpretationSpec: {
      checklist: ['记录冻结冰区模型 K、T 与训练残差', '汇报非重叠验证窗口的独立验证 RMSE 与 FIT', '讨论局部线性模型在时变冰接触下的适用域与不确定性'],
      placeholder: '对比第 3 步开水模型与本步冰区模型参数差异，结合非重叠窗口验证结果阐明冰区局部模型的有效条件与边界...',
    },
  },
  12: {
    goal: '保持相同推进计划对比 0.30 m、0.60 m 与 0.90 m 三档平整冰厚，量化冰厚对冰阻、通过速度、功率负荷与停滞时间的非线性作用。',
    actionSteps: [
      '运行前在预测区按纵向冰接触阻力从小到大排定三档冰厚顺序，并评估厚冰下出现低速停滞的风险。',
      '固定控制模型与增益不变，依次选择平整冰厚 0.30 m、0.60 m 与 0.90 m，每次先点击「冻结独立航向预测」再完成运行。',
      '每组结束后在下方对应冰厚槽一键提取通行耗时、阻力峰值、末态航速与机械功率，对照分析非线性增阻机理。',
    ],
    watch: '冰厚增至 0.90 m 时冰接触纵向阻力峰值陡升、对水航速大幅跌落甚至归零停滞，以及正机械功率持续贴近满负荷。',
    conditionText: '无风浪流、无测量噪声平整冰区（抗弯强度固定 0.50 MPa），初始航速 1.0 m/s 零航向直行（无速度 PI），分别测试 0.30 m、0.60 m 与 0.90 m 冰厚，最长 1200 秒。',
    suggestion: '遇到 0.90 m 厚冰停滞或超时未达 800 m 终点时请务必保留真实记录；冰厚效应不可简化为固定控制器的任意增益倍数。',
    predictionSpec: {
      kind: 'ranking',
      prompt: '在相同推进计划下，按预期平均冰接触阻力从小到大（通行能力由易到难）排列三种平整冰厚：',
      rankItems: [
        '0.30 m 薄冰（抗弯破坏门槛较低，可较顺畅破冰保持前进航速）',
        '0.60 m 中等平整冰（阻力与功率显著抬升，航速明显受压）',
        '0.90 m 厚冰（弯曲破坏载荷按厚度的超线性尺度剧增，极易逼近推力上限并发生停滞）',
      ],
      allowRationale: true, rationalePlaceholder: '结合板弯曲破坏载荷随冰厚平方/高次方增长特性说明厚冰非线性阻滞机理...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成 0.30 m、0.60 m 与 0.90 m 三档冰厚运行后，分别点击各冰厚槽「一键提取本工况读数」采集定量指标：',
      slots: ([0.3, 0.6, 0.9] as const).map((h) =>
        slot(`ice_h_${String(h).replace('.', '')}`, `平整冰厚 ${h.toFixed(2)} m`, '抗弯强度 0.50 MPa · 直航通行测试',
          (r) => r.configuration.ice?.thicknessM === h, [
            met('thickness', '平整冰厚', 'm', undefined, undefined, undefined, extractIceThicknessM),
            met('duration', '通行/结束时刻', 's', undefined, undefined, undefined, extractRunEndTimeS),
            met('ice_force', '冰接触纵向阻力峰值', 'kN', 'iceForce', 'peak'),
            met('speed', '末态对水航速', 'm/s', 'speed', 'steady'),
            met('power', '末态正机械功率', 'MW', 'power', 'steady'),
          ]),
      ),
    },
    interpretationSpec: {
      checklist: ['对比 0.30/0.60/0.90 m 的通行时刻、阻力峰值、航速与功率', '解释厚冰致阻的超线性力学依据与停滞阈值', '论证冰厚作用为何不能简化为控制器里的任意增益倍数'],
      placeholder: '定量汇总三档冰厚的实测阻力、速度与停滞表现，从冰板弯曲断裂刚度随冰厚急剧增大阐明厚冰航行限制...',
    },
  },
  13: {
    goal: '固定冰厚 0.60 m 并对比 0.35 MPa 与 0.65 MPa 两种抗弯强度，厘清材料强度敏感性与几何冰厚敏感性不可互换的物理机理。',
    actionSteps: [
      '运行前先预测抗弯强度从 0.35 MPa 增至 0.65 MPa 对单次破冰断裂载荷、航速衰减与通行时间的影响方向。',
      '固定 0.60 m 冰厚与控制器参数，依次选择抗弯强度 0.35 MPa 与 0.65 MPa，每次先冻结独立航向预测再完成运行。',
      '在下方两档强度槽一键提取实测阻力峰值与末速，对比第 12 步冰厚敏感性总结物理差异。',
    ],
    watch: '较高抗弯强度延迟冰缘弯曲断裂触发时刻，增大峰值破碎力并加剧瞬时降速，但几何接触厚度与排冰浮力仍由冰厚主导。',
    conditionText: '无风浪流、无测量噪声平整冰区（冰厚固定 0.60 m），初始航速 1.0 m/s 零航向直行（无速度 PI），分别对比 0.35 MPa 与 0.65 MPa 抗弯强度，最长 1200 秒。',
    suggestion: '切勿把抗弯强度翻倍等价于冰厚翻倍；两者分别对应材料破坏应力极限与冰板截面抗弯模量/碎冰排开体积，敏感性明显不同。',
    predictionSpec: {
      kind: 'choice',
      prompt: '保持冰厚 0.60 m 不变，将冰抗弯强度由 0.35 MPa 提高到 0.65 MPa 时，破冰力学响应最符合哪项规律？',
      options: [
        choiceOpt('strength_raises_fracture_threshold', '冰板断裂所需垂直弯矩升高，导致单次破碎阻力峰增大、航速衰减加剧，但其作用幂次与清排惯性不同于冰厚变化', '抗弯强度线性进入断裂临界力矩，而冰厚还通过截面二次方和浮冰质量几何项共同作用'),
        choiceOpt('interchangeable_with_thickness', '抗弯强度翻倍产生的结果在所有通道上与冰厚翻倍严格完全等效', '混淆了材料强度系数与冰板三维几何厚度的不同力学幂次'),
        choiceOpt('higher_strength_lower_force', '抗弯强度越高，冰板越脆越容易瞬间碎裂，从而使冰阻力大幅减小', '提高抗弯强度意味着冰体抵抗弯曲断裂的极限应力更高'),
      ],
      allowRationale: true, rationalePlaceholder: '结合冰板弯折断裂判据中抗弯强度与冰厚的不同幂次关系说明依据...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成 0.35 MPa 与 0.65 MPa 两次同冰厚运行后，点击各槽一键提取强度、时长、阻力峰值与末态航速：',
      slots: ([0.35, 0.65] as const).map((mpa) =>
        slot(`strength_${String(mpa).replace('.', '')}`, `抗弯强度 ${mpa.toFixed(2)} MPa`, '冰厚 0.60 m · 直航通行对比',
          (r) => r.configuration.ice?.flexuralStrengthPa === Math.round(mpa * 1e6), [
            met('strength', '抗弯强度', 'MPa', undefined, undefined, undefined, extractIceStrengthMpa),
            met('duration', '通行/结束时刻', 's', undefined, undefined, undefined, extractRunEndTimeS),
            met('ice_force', '冰接触纵向阻力峰值', 'kN', 'iceForce', 'peak'),
            met('speed', '末态对水航速', 'm/s', 'speed', 'steady'),
          ]),
      ),
    },
    interpretationSpec: {
      checklist: ['记录 0.35 与 0.65 MPa 下的阻力峰值与通行表现差异', '对比第 12 步冰厚变化，阐明厚度与强度作用机理不可互换', '说明冰体力学特性不确定性对固定控制方案的挑战'],
      placeholder: '对照第 12 步（变厚度）与第 13 步（变强度）实测结果，从弯曲破坏极限和排冰质量差异解释参数敏感性边界...',
    },
  },
  14: {
    goal: '在 0.60 m 冰区转向中对比固定控制器与基于本人双模型的两工况调度律，评估调度跟踪收益、切换平滑度与物理不变性。',
    actionSteps: [
      '运行前判断启用开水/冰区双模型增益调度相比固定单一模型控制器对航向跟踪与偏转动作的影响。',
      '固定主模型、Kp/Kd 倍率与积分开关，先在「按已声明冰厚调度」关闭下冻结预测并运行 1 次（固定控制器）。',
      '点击「重置」，开启「按已声明冰厚调度」并在下拉框选中第 11 步冰区局部模型，重新冻结预测并运行第 2 次，在下方提取对照指标。',
    ],
    watch: '入冰前后（0–200 m 开水与 200–700 m 冰区）转向响应速度、超调量及切换时刻等效偏转是否产生无根据毛刺。',
    conditionText: '无风浪流、无测量噪声平整冰区（冰厚 0.60 m、抗弯强度 0.50 MPa），初始航速 1.0 m/s，t=20 s 起 10 秒斜坡转向 +5°，航速 PI 开启，对比固定与两工况调度。',
    suggestion: '确保调度所用第二模型为第 11 步冻结的冰区局部模型；控制模式切换只调整控制器增益插值，后台船冰物理参数保持严格不变。',
    predictionSpec: {
      kind: 'choice',
      prompt: '对比第 3 步开水模型固定控制器与结合第 11 步冰区模型的两工况增益调度，在 0.60 m 冰区转向任务中最合理的预期是？',
      options: [
        choiceOpt('scheduled_adapts_gains', '调度律在入冰后依声明冰厚过渡到匹配冰区阻尼的增益组，改善转向跟踪裕度；后台船冰物理模型不会被调度开关改写', '两工况调度通过插值切换控制器参数应对被控对象动态变化，而非改变真实物理环境'),
        choiceOpt('rewrites_ice_physics', '开启调度开关会直接把仿真器里的冰厚阻力减半以降低控制难度', '控制调度只能调整控制律参数，物理被控对象完全独立且不变'),
        choiceOpt('no_control_change', '开启两工况调度后输出的双吊舱控制增益与固定控制器毫无区别', '当已声明冰厚大于零且冰区模型参数不同时，控制器增益按冰厚插值调整'),
      ],
      allowRationale: true, rationalePlaceholder: '结合开水与冰区两个工作点局部模型的差异说明增益调度插值作用与切换边界...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成固定控制器与两工况调度两次同工况对比运行后，分别一键提取状态与实测曲线指标：',
      slots: [
        slot('sched_off', '固定控制器（关闭调度）', '全程固定开水增益 · +5° 转向', (r) => !r.initialInput.iceHeadingSchedule, [
          met('sched', '调度模式', undefined, undefined, undefined, undefined, extractScheduleMode),
          met('heading_peak', '航向峰值', '°', 'heading', 'peak'),
          met('equiv_peak', '等效偏转峰值', '°', 'equivalent', 'peak'),
          met('heading_steady', '末态航向', '°', 'heading', 'steady'),
        ]),
        slot('sched_on', '两工况增益调度（开启调度）', '开水 + 冰区双模型按冰厚插值', (r) => Boolean(r.initialInput.iceHeadingSchedule), [
          met('sched', '调度模式', undefined, undefined, undefined, undefined, extractScheduleMode),
          met('heading_peak', '航向峰值', '°', 'heading', 'peak'),
          met('equiv_peak', '等效偏转峰值', '°', 'equivalent', 'peak'),
          met('heading_steady', '末态航向', '°', 'heading', 'steady'),
        ]),
      ],
    },
    interpretationSpec: {
      checklist: ['对比固定与两工况调度下的航向峰值与末态精度', '评估入冰切换点是否出现等效偏转切换冲击', '说明控制器调度仅改变增益且不篡改物理参数'],
      placeholder: '结合两次对比数据评判两工况调度的真实收益与边界条件（如依赖声明冰厚准确性及冰区模型精度）...',
    },
  },
  15: {
    goal: '保持冰区 0°→15° 终值转向目标一致，对比 10 s 陡斜坡与 60 s 平缓参考斜坡对吊舱速率饱和与积分抗饱和的抑制作用。',
    actionSteps: [
      '运行前判断将转向参考斜坡从 10 s 延长至 60 s 对吊舱偏转峰值、饱和持续时间与航向超调的影响。',
      '保持控制器、模型与调度设置完全一致，依次选用 10 s 与 60 s 参考斜坡，每次先冻结预测再运行 600 秒。',
      '在下方两档斜坡槽提取等效偏转峰值、转艏速率峰值与末态航向，论证参考整形在受限执行器下的价值。',
    ],
    watch: 't=20 s 转向初期，「实际等效偏转量测 (°)」在 10 s 斜坡下是否迅速顶向限幅，以及 60 s 斜坡对偏转动作与转艏平稳性的改善。',
    conditionText: '无风浪流、无测量噪声平整冰区（冰厚 0.60 m、抗弯强度 0.50 MPa），初始航速 1.0 m/s，t=20 s 起由 0° 转向 +15°，航速 PI 开启，对比 10 s 与 60 s 参考斜坡各 600 秒。',
    suggestion: '本步仅改动「参考斜坡时间 / s」，其余全部参数须严格保持一致；参考斜坡是缓解受限执行器初期饱和冲击的常用工程手段。',
    predictionSpec: {
      kind: 'choice',
      prompt: '冰区大角度 15° 转向时，把参考航向斜坡从 10 s 放缓至 60 s 对双吊舱执行器与闭环响应有何主要改善？',
      options: [
        choiceOpt('ramp_reduces_saturation', '显著降低转向初期瞬间航向误差，抑制吊舱偏转触及速率/角度饱和与积分过冲，代价是到位时间略有后移', '平缓参考将控制需求分散到更长时间窗口，避免执行器长期顶死极限'),
        choiceOpt('ramp_causes_more_saturation', '60 s 慢斜坡会造成比 10 s 陡斜坡更大的初始偏转角峰值与更严重饱和', '误差变化率降低会直接缓和比例与微分控制动作幅值'),
        choiceOpt('ramp_ignored', '参考斜坡时间长短只影响前 5 秒，不会改变吊舱饱和持续时间', '20–80 s 斜坡跨度正好覆盖船体与冰区转向主力响应阶段'),
      ],
      allowRationale: true, rationalePlaceholder: '结合执行器速率/角度上限及积分追踪抗饱和机制说明斜坡整形的作用...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成 10 s 与 60 s 两档转向斜坡 600 秒运行后，一键提取各自斜坡时间、偏转峰值、转艏峰值与末态航向：',
      slots: ([10, 60] as const).map((ramp) =>
        slot(`ramp_${ramp}`, `转向斜坡 ${ramp} s`, '0° → +15° 同终值转向 · 600 s', (r) => r.courseSettings?.rampS === ramp, [
          met('ramp', '参考斜坡', 's', undefined, undefined, undefined, extractRampS),
          met('equiv_peak', '等效偏转峰值', '°', 'equivalent', 'peak'),
          met('yaw_peak', '转艏速率峰值', '°/s', 'yawRate', 'peak'),
          met('heading_steady', '末态航向', '°', 'heading', 'steady'),
        ]),
      ),
    },
    interpretationSpec: {
      checklist: ['对比 10 s 与 60 s 下等效偏转峰值及饱和程度', '阐明参考整形与积分跟踪协同抗饱和的机理', '权衡冰区通道敏捷转向与执行器余量保护'],
      placeholder: '用实测偏转峰值与转艏速率对比，解释为什么在执行器受限条件下平缓参考斜坡能改善可控性与平稳度...',
    },
  },
  16: {
    goal: '在冰区叠加风流扰动与测量噪声下比较 0.5、1.0 与 1.5 m/s 三档推进初速，评估通行进度、峰值功率与航向控制余量权衡。',
    actionSteps: [
      '运行前在预测区按各档速度在能耗、抗偏漂与峰值负荷上的特点排序（切勿预设越快越好）。',
      '固定控制模型、增益与调度等其余参数，依次选择初始航速 0.5、1.0 与 1.5 m/s，每次先冻结独立预测再完成运行。',
      '在下方三档航速槽分别提取通行耗时、冰阻力峰值、正机械功率峰值与末态航速，客观比较三者得失。',
    ],
    watch: '0.5 m/s 低速在风流偏航下横偏风险与长暴露积分能耗，以及 1.5 m/s 高速撞冰产生的高阻力峰值、功率负荷与控制余量收窄。',
    conditionText: '冰厚 0.60 m、抗弯强度 0.50 MPa，叠加风与海流外扰及传感器测量噪声，航向与航速 PI 开启，对比 0.5、1.0 与 1.5 m/s 三档初始推进速度，最长 1200 秒。',
    suggestion: '切忌先入为主认为“速度越快一定越好”或“越慢越省”；高推进速度推升冲击载荷与瞬时功率上限风险，而过慢可能被风流吹偏出通道或暴露耗时过长。',
    predictionSpec: {
      kind: 'ranking',
      prompt: '在风流扰动与 0.60 m 平整冰区下，按预期所需峰值正机械功率从高到低排列三种推进速度（由功耗冲击最大到最小）：',
      rankItems: [
        '1.5 m/s 较高推进速度（冲击冰缘动能大、阻力峰值高，推进功率余量明显收紧）',
        '1.0 m/s 适中推进速度（兼顾通道推进节奏与功率及转向余量均衡）',
        '0.5 m/s 低速推进（瞬时功率峰较低，但暴露时间长且在风流外扰下更易产生横偏漂移）',
      ],
      allowRationale: true, rationalePlaceholder: '综合推进功率随速度非线性增长、冰阻峰值及风流漂移时间三方面因素说明排序依据...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '完成 0.5、1.0 与 1.5 m/s 三档运行后，分别一键提取通行耗时、阻力峰值、正机械功率峰值与末态航速：',
      slots: ([0.5, 1, 1.5] as const).map((spd) =>
        slot(`ice_spd_${String(spd).replace('.', '')}`, `推进初速 ${spd.toFixed(1)} m/s`, '风流冰复合干扰 · 最长 1200 s',
          (r) => r.configuration.initialWaterSpeedMps === spd, [
            met('init_speed', '初始航速', 'm/s', undefined, undefined, undefined, extractWaterSpeedMps),
            met('duration', '通行/结束时刻', 's', undefined, undefined, undefined, extractRunEndTimeS),
            met('ice_force', '冰接触纵向阻力峰值', 'kN', 'iceForce', 'peak'),
            met('power_max', '正机械功率峰值', 'MW', 'power', 'max'),
            met('speed', '末态对水航速', 'm/s', 'speed', 'steady'),
          ]),
      ),
    },
    interpretationSpec: {
      checklist: ['列举 0.5/1.0/1.5 m/s 三组的通行时间、阻力峰值与功率峰值', '分析推进节奏与功率/转向控制余量的冲突', '指出受风流漂移与冰阻约束下的合理推进速度区间'],
      placeholder: '对比三档推进初速在走廊偏航、到达耗时与峰值功率上的实测数据，解释为何在冰区不预设越快越好...',
    },
  },
  17: {
    goal: '在风流冰全要素干扰与测量噪声下联合配置航向增益、两工况调度、测量滤波、航速参考与迎流航向补偿，形成第一套综合控制策略。',
    actionSteps: [
      '运行前输入本综合策略预期维持的冰区稳态对水航速目标值，并简述各模块参数协同整定依据。',
      '在控制区配置本人模型、增益、启用两工况调度并选入冰区模型、选定滤波时间常数、航速参考与航向参考补偿（抵消风流漂移），点击「冻结独立航向预测」后运行。',
      '运行完成后使用下方指标卡提取通行耗时、末态航速、末态航向、功率峰值与阻力峰值，核查 ±25 m 横偏走廊达标情况。',
    ],
    watch: '左侧「北向 / 东向」中东向横偏是否稳控在 ±25 m 走廊内、是否顺利到达北向 800 m 终点，以及功率峰值与等效偏转平稳度。',
    conditionText: '冰厚 0.60 m、抗弯强度 0.50 MPa，叠加海面风与海流外扰及传感器测量噪声，初始航速 1.0 m/s，执行北向 800 m 通道任务（允许横偏 ±25 m，最长 1200 秒）。',
    suggestion: '若发现船体持续向一侧漂移，可设定适当的「航向参考补偿 / °」形成迎风/迎流航向角；本步冻结策略将作为第 18 步比较与第 19 步盲测的基线。',
    predictionSpec: {
      kind: 'numeric_target', unit: 'm/s', targetPlaceholder: '如 1.0',
      prompt: '基于你设定的对水航速参考、调度增益与迎流航向补偿，预估穿越 0.60 m 风流冰通道时的稳态对水航速 (m/s)：',
      allowRationale: true, rationalePlaceholder: '说明航向补偿角、冰区增益调度、滤波及速度参考如何协同平衡推进功耗与走廊保持...',
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '运行完成后记录通道实际耗时（或是否停滞），并一键从曲线读取末态航速、航向、功率峰值与阻力峰值：',
      metrics: [
        met('duration', '通道通行耗时 / 结束时刻', 's', undefined, undefined, '看状态栏时间或评估记录（到达800m即停）'),
        met('end_speed', '末态对水航速', 'm/s', 'speed', 'steady'),
        met('end_heading', '末态航向量测', '°', 'heading', 'steady'),
        met('power_max', '正机械功率峰值', 'MW', 'power', 'max'),
        met('ice_force', '冰接触纵向阻力峰值', 'kN', 'iceForce', 'peak'),
      ],
    },
    interpretationSpec: {
      checklist: ['逐项核查 800 m 到达完成度、±25 m 横偏走廊与功率余量', '解释航向补偿与两工况调度在风流冰耦合下的协同作用', '指出可作为第 18 步第二方案对比的待优化维度'],
      placeholder: '复盘第一套综合策略在走廊跟踪、实际出力与能耗上的综合表现，提出下一轮可验证的改进维度...',
    },
  },
  18: {
    goal: '基于第 17 步冻结综合策略有依据地调整策略参数形成第二方案，在同一风流冰工况下开展跟踪精度、能耗与停滞风险的公平对照。',
    actionSteps: [
      '运行前选择准备在第二策略中调整的关键维度及其对跟踪误差、机械功与功率余量的预期取舍。',
      '在控制区「引用本人综合方案」导入第 17 步已完成方案，有依据地修正策略参数（如优化航向补偿角、航速参考或滤波/调度增益），冻结预测并完成运行。',
      '在下方两槽中对照记录方案一（第 17 步）与自动提取方案二（本步）配置与实测指标，客观评判两方案优劣。',
    ],
    watch: '同一风流冰随机序列下，方案一与方案二在通道耗时、航向跟踪误差、等效偏转平稳性及峰值功率上的真实对比。',
    conditionText: '与第 17 步完全相同的风流冰复合环境与测量噪声（冰厚 0.60 m、抗弯强度 0.50 MPa），基于第 17 步已完成方案构造第二套控制策略。',
    suggestion: '切勿空手重新盲调；务必先从「引用本人综合方案」导入第 17 步完整方案，再作明确假设下的参数修订，修订后重新冻结预测再运行。',
    predictionSpec: {
      kind: 'choice',
      prompt: '基于第 17 步完整方案修订一个策略维度形成第二方案时，三类指标（跟踪误差、功耗成本、推进速度）通常体现何种工程关系？',
      options: [
        choiceOpt('pareto_balance', '存在明显的多目标权衡：压低航偏误差或加快推进往往提升功率峰值与执行器动作代价，需结合走廊约束与功耗余量综合取舍', '不同控制策略对应可控域前沿上的不同折中点，没有零代价的全局单调改进'),
        choiceOpt('free_improvement', '任意修改控制参数都会使航偏、能耗、峰值功率与时间同时变小至零', '忽略了推进物理能力极限与抗扰能量代价'),
        choiceOpt('no_effect_at_all', '在冰区环境下调整航向补偿、调度或滤波都不会改变实际航迹和功耗', '控制律参数直接决定了双吊舱矢量角度、转速需求与航迹偏置'),
      ],
      allowRationale: true, rationalePlaceholder: '写明计划修订的参数维度，并预判拟改善的目标与伴随的次级代价...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '在第一槽对照补记第 17 步方案一实测读数，并在第二槽一键提取本步方案二参数摘要与实测性能：',
      slots: [
        slot('strategy_1', '方案一（第 17 步基线实测记录）', '对照填入第 17 步耗时、航速与功率', undefined, [
          met('duration', '方案一耗时', 's', undefined, undefined, '填第 17 步结束时刻'),
          met('speed', '方案一末态航速', 'm/s', undefined, undefined, '填第 17 步末速'),
          met('power_max', '方案一功率峰值', 'MW', undefined, undefined, '填第 17 步功率峰值'),
        ]),
        slot('strategy_2', '方案二（本步修正策略实测）', '相对第 17 步有依据地调整控制参数', (r) => r.stoppedAtMs !== null, [
          met('cfg', '方案二参数摘要', undefined, undefined, undefined, undefined, extractStrategySummary),
          met('status', '运行结果', undefined, undefined, undefined, undefined, extractRunStopSummary),
          met('speed', '末态对水航速', 'm/s', 'speed', 'steady'),
          met('heading', '末态航向量测', '°', 'heading', 'steady'),
          met('power_max', '正机械功率峰值', 'MW', 'power', 'max'),
        ]),
      ],
    },
    interpretationSpec: {
      checklist: ['明确写明方案二相比方案一改动了哪项参数及改变量', '公平对比两方案在跟踪误差、能耗、耗时与停滞风险的差异', '确定并冻结用于第 19 步未见冰况盲测的最终胜出方案'],
      placeholder: '对比方案一与方案二实测数据，量化说明多目标权衡取舍结果并选定投入第 19 步验证的最终策略...',
    },
  },
  19: {
    goal: '锁定第 17 或第 18 步已保存综合策略不变，在两套未见冰况与 t=180 s 单吊舱方位卡滞故障下检验泛化边界，手绘预测并据实决定继续或停止。',
    actionSteps: [
      '运行前选择未见冰况与单吊舱卡滞故障的行为预估，并在坐标画板（带 t=180 s 红色标尺）手绘航向量测预期曲线。',
      '在「引用本人综合方案」导入第 17 或第 18 步已选策略（保持参数锁死不变且关闭卡滞），分别选择「未见薄冰工况甲」与「未见厚冰工况乙」各冻结预测并运行。',
      '点击「重置」并开启「180秒单吊舱卡滞」（建议开启「卡滞后停桨」），冻结预测并运行；t≥180 s 可观察或点击「按实际时刻结束故障观察」，最后提取三槽读数并叠合画板核对。',
    ],
    watch: '未见厚冰下的减速停滞或出界风险；以及 t=180 s 单吊舱方位卡滞触发后双侧非对称推力引起的航向偏转、停桨后航速衰减过程。',
    conditionText: '风流外扰与测量噪声冰区：①未见薄冰工况甲（0.45 m / 0.35 MPa）；②未见厚冰工况乙（0.75 m / 0.65 MPa）；③t=180 s 注入单吊舱方位卡滞故障（可设卡滞后停桨）。',
    suggestion: '严禁修改原控制策略去迎合未见冰况！允许出现减速、停滞或主动停桨退出，禁止强求“必能通过”——诚实保留失败记录正是工程判断依据。',
    predictionSpec: {
      kind: 'choice',
      prompt: '将冻结的第 17/18 步控制方案投入未见厚冰与 t=180 s 单吊舱方位卡滞工况时，哪种工程判断态度最科学稳健？',
      options: [
        choiceOpt('honest_boundary_and_stop', '未见冰厚/强度改变会压缩控制与推力余量，t=180 s 单吊舱卡滞将大幅损失对称转向能力；若推进或走廊余量不足应及时降速停桨而非硬闯', '真实控制系统必须依据物理剩余可控能力边界作出继续通行或安全停止决策'),
        choiceOpt('guaranteed_pass_always', '只要第 17 步调好了参数，无论未见多厚的冰或单吊舱卡滞都能 100% 原速直线通过 800 m 走廊', '忽视了执行器故障损毁控制自由度及未见强冰的物理极限约束'),
        choiceOpt('tweak_on_blind_test', '发现未见厚冰跑不过去时应立刻重改控制增益和模型以保证曲线好看', '盲测严禁针对验证集事后调参掩盖方案边界缺陷'),
      ],
      allowRationale: true, rationalePlaceholder: '预估未见薄/厚冰下走廊偏航风险，以及 t=180 s 单吊舱卡滞后停桨 vs 不停桨对航向偏差的影响...',
      sketch: {
        mode: 'prediction', plotId: 'time-response', lockPlotId: true,
        label: '运行前手绘预测：未见冰况及 t=180 s 单吊舱卡滞下的航向量测 (0–1200 s)',
        hint: '在 0–1200 s、-25° 至 +25° 坐标系中画出未见工况的航向保持区间，并重点标注 t=180 s 红虚线单吊舱卡滞触发后的偏航走势或停桨稳态。',
        promptFocus: '关注 t=180 s 故障节点前后的航向稳定段与故障引发的偏离/停滞趋势变化。',
        coordinateOverride: {
          title: '未见冰况与单吊舱卡滞航向预测坐标系', subtitle: '0–1200 s 航向量测（红色虚线 t=180 s 单吊舱卡滞）',
          xMin: 0, xMax: 1200, yMin: -25, yMax: 25, xLabel: '时间 t', yLabel: '航向量测', xUnit: 's', yUnit: '°',
          xTicks: ticksOf([0, 180, 400, 600, 800, 1000, 1200]), yTicks: ticksOf([-25, -15, 0, 15, 25]),
          verticalMarkers: [{ value: 180, label: 't=180s 单吊舱卡滞', color: '#ef4444' }],
          horizontalMarkers: [{ value: 0, label: '0° 航向基线', color: '#64748b' }],
        },
        overlayExtractor: extractIcebreakerHeadingActualSeries,
      },
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '分别完成未见薄冰工况甲、未见厚冰工况乙与 t=180 s 单吊舱卡滞三次运行后，点击各槽「一键提取本工况读数」汇总实证数据：',
      slots: [
        slot('unseen_thin_a', '未见薄冰工况甲（0.45 m / 0.35 MPa）', '原冻结方案 · 无卡滞盲测',
          (r) => r.configuration.seed === 17 && !r.configuration.azimuthJamFault, [
            met('ice_cond', '实测冰况', undefined, undefined, undefined, undefined, extractUnseenIceSummary),
            met('outcome', '运行结果', undefined, undefined, undefined, undefined, extractRunStopSummary),
            met('heading', '末态航向量测', '°', 'heading', 'steady'),
            met('speed', '末态对水航速', 'm/s', 'speed', 'steady'),
          ]),
        slot('unseen_thick_b', '未见厚冰工况乙（0.75 m / 0.65 MPa）', '原冻结方案 · 无卡滞盲测',
          (r) => r.configuration.seed === 29 && !r.configuration.azimuthJamFault, [
            met('ice_cond', '实测冰况', undefined, undefined, undefined, undefined, extractUnseenIceSummary),
            met('outcome', '运行结果', undefined, undefined, undefined, undefined, extractRunStopSummary),
            met('heading', '末态航向量测', '°', 'heading', 'steady'),
            met('speed', '末态对水航速', 'm/s', 'speed', 'steady'),
          ]),
        slot('pod_jam_180', 't=180 s 单吊舱方位卡滞故障', '单吊舱卡滞注入 · 允许停桨提前结束',
          (r) => Boolean(r.configuration.azimuthJamFault), [
            met('jam_mode', '故障处置模式', undefined, undefined, undefined, undefined, extractPodJamStatus),
            met('outcome', '故障运行结果', undefined, undefined, undefined, undefined, extractRunStopSummary),
            met('heading_peak', '航向偏差峰值', '°', 'heading', 'peak'),
            met('speed', '末态对水航速', 'm/s', 'speed', 'steady'),
          ]),
      ],
    },
    interpretationSpec: {
      checklist: ['如实汇报未见薄冰甲与厚冰乙的通行或停滞/出界表现', '分析 t=180 s 单吊舱卡滞与停桨选择对航向和能量的影响', '给出面向极地作业“继续航行或安全停止”的明确工程边界判据'],
      placeholder: '结合三组实测结果与画板叠合轨迹，评估已冻结策略的未知工况鲁棒性及执行器故障下的降级停船判断依据...',
    },
  },
  20: {
    goal: '整合开水/冰区局部模型辨识、船冰接触断裂能耗、两工况调度与未见冰况故障实证，完成严谨的六部分极地控制实验报告。',
    actionSteps: [
      '在右侧「控制」页签的「报告引用的本人运行」勾选至少 6 次涵盖建模、冰接触、比较与故障盲测的本人完整运行。',
      '使用下方「步 1–19 实测证据胶囊」将本人冻结模型、独立对照误差与关键工况实测数据一键插入相应报告章节，确认四维量规预检全部达标。',
      '逐章撰写入冰模型失配、接触力学因果、两方案权衡及未见故障处理结论，并明确声明教学结果不能当作实船冰级认证或结构强度安全鉴定。',
      '点击「提交本步」生成归档报告，可通过「查看实验报告」检查完整排版与各项记录。',
    ],
    watch: '四维报告量规预检是否全部绿标达标、勾选引用运行是否不少于 6 次且覆盖本人辨识与独立验证，以及教学近似边界声明是否严谨完整。',
    conditionText: '综合实验总结与报告归档阶段（无需启动新仿真），须引用至少 6 次本人完整运行、已冻结模型与独立验证对照记录。',
    suggestion: '报告结论必须建立在本人实测曲线、模型残差与故障记录之上，严禁将教学简化条带冰板与标称模型结果当作实船冰级或结构强度安全鉴定。',
    interpretationSpec: {
      checklist: ['勾选并引用至少 6 次涵盖开水、冰区与故障验证的本人完整运行', '覆盖开水与冰区模型对照、冰接触断裂能耗与多工况策略比较', '明确声明教学近似边界，不把教学结果当作实船冰级或结构安全鉴定'],
      placeholder: '按六章节要求提交完整实证报告，确保每一项结论均有本人实测数据支撑并清晰声明教学适用范围...',
    },
    reportFieldGuides: {
      problem: '界定雪龙2号双全回转吊舱耦合特性、六自由度船冰接触力学与北向 800 m（±25 m 走廊）航行约束，明确条带冰板简化假设边界。',
      identification: '汇总第 2 步吊舱伺服模型、第 3 步开阔水域转向局部模型及第 11 步冰区局部模型的参数 K、T、L、输入输出口径与训练残差。',
      validation: '引用第 4 步开水独立验证、第 10 步入冰模型失配时刻与 RMSE/FIT，以及第 19 步未见薄冰/厚冰与 180 s 卡滞故障实测结果。',
      comparison: '对比第 5–7 步增益/低速/滤波权衡，第 8–9 步压碎弯折耗散功，及第 12–16 步冰厚、强度、两工况调度、参考斜坡与推进速度影响。',
      revision: '总结第 17–18 步综合控制与航向补偿策略的迭代对比依据，以及第 19 步应对厚冰停滞或吊舱卡滞故障的降速/停桨处置判断。',
      conclusion: '凝练开水与冰区局部控制适用边界及受限执行器调度准则，并明确声明教学模型结果不可用作实船冰级或结构安全鉴定。',
    },
  },
};
