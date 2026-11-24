import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import type { SketchActualCurveSeries } from './sketch-coordinate-templates';
import type { StepObservationMetricDef, StepObservationSlotDef, VesselSample } from '../simulations/vessel-experiment';
import type { DrillingStepSpec } from './drilling-step-specs-early';

const LOSS_STRATEGY_LABEL: Record<string, string> = {
  predict: '继续模型预测', freeze_integral: '继续预测并冻结积分', safe_exit: '退出定位并降低出力',
};
const opt = (value: string, label: string) => ({ value, label });
const met = (
  key: string, label: string, unit?: string, seriesId?: string, pickMode?: StepObservationMetricDef['pickMode'], placeholder?: string,
): StepObservationMetricDef => ({ key, label, unit, seriesId, pickMode, placeholder });
const slot = (
  id: string, label: string, conditionHint: string, matcher: ((run: VesselRunSummary) => boolean) | undefined, metrics: StepObservationMetricDef[],
): StepObservationSlotDef => ({ id, label, conditionHint, ...(matcher ? { matcher } : {}), metrics });

function extractStep15PlanarSeries(samples: VesselSample[]): SketchActualCurveSeries[] {
  if (samples.length < 2) return [];
  const stride = Math.max(1, Math.ceil(samples.length / 180));
  const picked = samples.filter(
    (sample, index) => index % stride === 0 || index === samples.length - 1 || Math.abs(sample.time - 180) <= 1.2,
  );
  const preFault: Array<{ x: number; y: number }> = [];
  const postFault: Array<{ x: number; y: number }> = [];
  for (const sample of picked) {
    const north = Number.isFinite(sample.values.north) ? sample.values.north : sample.values.lfNorth;
    const east = Number.isFinite(sample.values.east) ? sample.values.east : sample.values.lfEast;
    if (!Number.isFinite(north) || !Number.isFinite(east)) continue;
    const pt = { x: east, y: north };
    if (sample.time <= 180) preFault.push(pt);
    if (sample.time >= 180) postFault.push(pt);
  }
  const result: SketchActualCurveSeries[] = [];
  if (preFault.length > 1) result.push({ id: 'planar-pre-fault', label: '故障前平面轨迹 (0–180 s)', color: '#0ea5e9', points: preFault });
  if (postFault.length > 1) result.push({ id: 'planar-post-fault', label: '2号断桨后轨迹 (180–600 s)', color: '#ef4444', points: postFault });
  return result;
}

export const DRILLING_STEP_SPECS_LATE: Record<number, DrillingStepSpec> = {
  11: {
    goal: '在锁定第 10 步控制器的同一波场中识别二阶差频慢漂载荷引起的低频偏移与平均出力变化',
    actionSteps: [
      '运行前先预测在相同波场下额外开启二阶慢漂载荷后，平台低频位置均值与推进平均功率将如何变化',
      '确认控制面板已自动同步并锁定第 10 步控制器方案，点击「开始」完成 600 秒运行',
      '填入第 10 步参考均值并点击提取第 11 步实测数据，比较一阶振动与二阶慢漂机理差异后提交',
    ],
    watch: '低频北向/低频东向偏移均值、低频漂移包络以及稳态正机械功率底值相比第 10 步的抬升量',
    conditionText: '与第 10 步相同的中等波浪（有效波高 1.5 米、周期 8.0 秒），同时开启一阶波频与二阶差频慢漂载荷，控制器保持不变，运行 600 秒',
    suggestion: '本步禁止修改控制器参数，以确保观测到的位置偏移与功率抬升纯粹源于二阶差频慢漂波浪载荷。',
    predictionSpec: {
      kind: 'choice',
      prompt: '保持第 10 步控制器完全不变、仅在同波场叠加二阶差频慢漂载荷后，平台低频位置均值与推进平均出力会如何变化？',
      options: [
        opt('nonzero_drift_mean', '产生非零低频慢漂均力，推动平台形成缓慢偏移均值并抬升稳态平均抵漂推力与功耗'),
        opt('zero_mean_only', '二阶慢漂与一阶波浪同样呈零均值往复，不会改变位置均值与平均功率'),
        opt('cancel_first_order', '二阶载荷会抵消一阶波频横摇，使机械功率波动大幅降低'),
      ],
      allowRationale: true, rationalePlaceholder: '区分一阶线性零均值波力与二阶非线性差频慢漂力的频带特征...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '对照第 10 步（仅一阶波）与第 11 步（一阶 + 二阶慢漂）的低频位置与平均出力差异：',
      slots: [
        slot('step10_first_order', '第 10 步仅一阶波浪参考（手动或拾取填入）', '仅一阶波频载荷', undefined, [
          met('north', '北向均值/末值', 'm', undefined, undefined, '对照第10步填入'),
          met('east', '东向均值/末值', 'm', undefined, undefined, '对照第10步填入'),
          met('power', '末段机械功率', 'MW', undefined, undefined, '对照第10步填入'),
        ]),
        slot('step11_second_order', '第 11 步一阶 + 二阶慢漂实测', '已开启二阶差频慢漂', (r) => r.configuration.secondOrderEnabled === true, [
          met('lfNorth', '低频北向稳态值', 'm', 'lfNorth', 'steady'),
          met('lfEast', '低频东向稳态值', 'm', 'lfEast', 'steady'),
          met('power', '末段机械功率', 'MW', 'power', 'steady'),
        ]),
      ],
    },
    interpretationSpec: {
      placeholder: '对比第 10/11 步数据阐明一阶波频运动（高频往复、不必全抵消）与二阶慢漂（低频定常/缓变偏置、必须由动力定位抵消）的物理区别。',
      checklist: ['确认控制器完全锁定并与第 10 步同波场', '量化记录二阶慢漂引起的低频位置与功率变化', '阐明低频定位控制聚焦二阶慢漂与风流的机理'],
    },
  },
  12: {
    goal: '比较原始量测反馈与低频波浪滤波反馈在抑制推力高频脉动与引入相位滞后间的权衡',
    actionSteps: [
      '运行前先预测原始反馈与低频观测器反馈在机械功率峰值、力指令抖动及响应滞后上的取舍',
      '固定其余基线参数，分别选择「原始量测」与「低频观测器」各运行 600 秒，并可测试不同观测带宽',
      '每组完成后立即提取槽位读数，结合多项证据分析滤波降耗与相位滞后权衡后提交',
    ],
    watch: '期望纵向力高频抖动幅值、正机械功率峰值与末段消耗，以及低频观测值相对原始量测的跟随滞后',
    conditionText: '中等波浪（有效波高 1.5 米、周期 8.0 秒，含一阶波频与二阶慢漂）及传感噪声与时延，仅切换反馈模式，每组运行 600 秒',
    suggestion: '切到原始量测时仅比较原始反馈效果；切回低频观测器时可先沿用 0.04 Hz 带宽完成开关对照，再试其他带宽。',
    predictionSpec: {
      kind: 'choice',
      prompt: '在含传感噪声和一阶波频运动的海况下，改用低频波浪滤波观测器反馈替代原始量测反馈会出现什么权衡？',
      options: [
        opt('less_wear_more_lag', '显著滤除波频和噪声引起的无效推力脉动与功率损耗，但滤波器自身会引入一定低频相位滞后'),
        opt('zero_lag_zero_power', '既能彻底消除高频出力脉动，又不会引入任何相位滞后或超调变化'),
        opt('higher_power', '低频滤波器会把波浪能量叠加到推力指令中，使总功率高于原始反馈'),
      ],
      allowRationale: true, rationalePlaceholder: '说明观测器截止频率取低与取高在滤波纯度与跟踪滞后之间的矛盾...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '对比原始量测反馈与低频波浪滤波反馈在推力指令、位置稳定度与功率上的多项实测证据：',
      slots: [
        slot('fb_raw', '原始量测反馈', '位置反馈：原始量测', (r) => r.courseSettings?.feedback === 'raw', [
          met('north', '北向量测末值', 'm', 'north', 'steady'), met('reqX', '期望纵向力峰值', 'kN', 'requestedX', 'peak'), met('power', '正机械功率峰值', 'MW', 'power', 'max'),
        ]),
        slot('fb_lf', '低频波浪滤波观测反馈', '位置反馈：低频观测器', (r) => r.courseSettings?.feedback === 'low_frequency', [
          met('lfNorth', '低频北向末值', 'm', 'lfNorth', 'steady'), met('reqX', '期望纵向力峰值', 'kN', 'requestedX', 'peak'), met('power', '正机械功率峰值', 'MW', 'power', 'max'),
        ]),
      ],
    },
    interpretationSpec: {
      placeholder: '结合期望合力曲线波动、机械功峰值与低频相位滞后，总结波浪滤波带宽选取的工程准则。',
      checklist: ['完成原始量测与低频观测器单因素对照', '用机械功率与期望推力波动证明滤波降耗效果', '指出低截止频率带来相位滞后与稳态响应变慢'],
    },
  },
  13: {
    goal: '比较无约束加权伪逆与顺序凸约束推力分配在执行器物理限制与分配残差上的差异',
    actionSteps: [
      '运行前先预测无约束加权伪逆与顺序凸约束分配在遇到尾流禁区、转向限速或功率上限时的区别',
      '固定其余基线参数，分别选择「无约束加权伪逆」与「顺序凸约束分配」运行 600 秒并提取槽位读数',
      '对比期望与实际控制合力偏差及左侧归一化分配残差，完成物理阐释后提交',
    ],
    watch: '期望纵向/横向力与实际执行器输出合力曲线重合度、左侧推进器矢量避让禁区行为及归一化分配残差',
    conditionText: '风浪流组合海况（风速 8 米/秒、有效波高 0.75 米、流速 0.3 米/秒，含二阶慢漂及传感噪声时延），仅切换分配方法，每组运行 600 秒',
    suggestion: '重点观察期望合力与实际执行器输出力之间的差值，以及各推进器射流是否有效避开相邻立柱尾流禁区。',
    predictionSpec: {
      kind: 'choice',
      prompt: '对比「无约束加权伪逆」与「顺序凸约束优化分配」，在实际推进器存在推力、方位转向速率与功率约束时有何本质差异？',
      options: [
        opt('constrained_respects_limits', '顺序凸约束分配显式计入单机饱和、转向速率、尾流禁区与功率限制并最小化分配残差；伪逆容易产生越限截断误差'),
        opt('pinv_always_better', '无约束伪逆解析求解速度快，因此在任何功率和禁区限制下实际分配误差都更小'),
        opt('identical_outputs', '两种算法在每台推进器上给出的转速与方位角指令完全相同'),
      ],
      allowRationale: true, rationalePlaceholder: '说明推进器方位转向滞后和立柱尾流禁区对伪逆解的影响...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '对比两种控制分配方法下的期望合力、实际合力与正机械功率指标：',
      slots: [
        slot('alloc_pinv', '无约束加权伪逆分配', '分配方法：伪逆', (r) => r.courseSettings?.allocation === 'pseudoinverse', [
          met('reqX', '期望纵向力峰值', 'kN', 'requestedX', 'peak'), met('actX', '实际纵向力峰值', 'kN', 'actualX', 'peak'), met('power', '正机械功率峰值', 'MW', 'power', 'max'),
        ]),
        slot('alloc_sc', '顺序凸约束优化分配', '分配方法：顺序凸约束', (r) => r.courseSettings?.allocation === 'sequential_convex', [
          met('reqX', '期望纵向力峰值', 'kN', 'requestedX', 'peak'), met('actX', '实际纵向力峰值', 'kN', 'actualX', 'peak'), met('power', '正机械功率峰值', 'MW', 'power', 'max'),
        ]),
      ],
    },
    interpretationSpec: {
      placeholder: '结合期望合力与实际执行合力的差异以及左栏归一化分配残差，分析推力、方位与功率约束对分配可行性的影响。',
      checklist: ['完成伪逆与顺序凸约束单因素对照', '对比期望与实际输出力残差', '说明邻柱尾流禁区与转向限速约束的作用'],
    },
  },
  14: {
    goal: '选择大步进重定位参考斜坡时间，抑制执行器饱和、功率尖峰并保障平稳收敛',
    actionSteps: [
      '运行前先预测 30 秒陡变斜坡与 90 秒或 180 秒平缓斜坡在推进功率峰值和过渡超调上的差异',
      '选择至少一档参考位置斜坡（建议对比 30 秒与 90/180 秒两组各 600 秒）运行并提取对应槽位读数',
      '分析大步进机动下参考整形缓解执行器饱和与积分累积的机理后提交',
    ],
    watch: '第 30 秒触发 (20, 10) 米 / 15° 目标机动后的正机械功率尖峰、期望力饱和持续时间与实际位置/航向平稳收敛过程',
    conditionText: '风浪流组合海况（含传感噪声与时延），第 30 秒向大位移目标 (20, 10) 米、航向 15° 机动，运行 600 秒',
    suggestion: '对比短斜坡与长斜坡可直观看到参考整形如何避免初期大误差冲击推进功率上限；本步至少需完成 1 次 600 秒完整运行。',
    predictionSpec: {
      kind: 'choice',
      prompt: '面对 (20, 10) 米、航向 15° 的大步进目标转移，将参考斜坡时间从 30 秒延长至 90 秒或 180 秒预期会产生什么效果？',
      options: [
        opt('smooth_less_saturation', '大幅压低初期瞬时推力需求与功率尖峰，减少分配饱和截断并使航迹更平顺，但总到达时间相应后移'),
        opt('more_saturation', '斜坡越长，推进器越容易在初期发生功率越限与严重超调'),
        opt('same_peak', '只要最终目标位置相同，斜坡快慢对瞬时功率峰值没有任何影响'),
      ],
      allowRationale: true, rationalePlaceholder: '说明参考指令变化率与平台大惯量加速能力匹配的关系...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '记录所选参考斜坡下的大步进定位响应与功率峰值（建议对比 30 秒与 90/180 秒）：',
      slots: [
        slot('ramp_30', '短斜坡（30 秒陡变激励）', '斜坡时间 = 30 s', (r) => r.courseSettings?.referenceRampS === 30, [
          met('north', '北向最大值', 'm', 'north', 'max'), met('heading', '航向最大值', '°', 'heading', 'max'), met('power', '正机械功率峰值', 'MW', 'power', 'max'),
        ]),
        slot('ramp_slow', '平缓斜坡（90 秒或 180 秒）', '斜坡时间 = 90 s 或 180 s',
          (r) => r.courseSettings?.referenceRampS === 90 || r.courseSettings?.referenceRampS === 180, [
            { key: 'ramp', label: '所选斜坡', unit: 's', extract: (r) => String(r.courseSettings?.referenceRampS ?? '') },
            met('north', '北向最大值', 'm', 'north', 'max'), met('heading', '航向最大值', '°', 'heading', 'max'), met('power', '正机械功率峰值', 'MW', 'power', 'max'),
          ]),
      ],
    },
    interpretationSpec: {
      placeholder: '结合饱和限幅、功率尖峰和调节时间权衡，阐明大步进参考整形的工程价值与选型依据。',
      checklist: ['比较参考斜坡对推进功率尖峰的削峰作用', '分析执行器饱和引发的超调与积分累积风险', '说明到达节拍与平顺安全之间的权衡'],
    },
  },
  15: {
    goal: '对比第 180 秒 2 号推进器断桨后关闭与开启在线重分配的漂移轨迹、可控余量及井口警戒圈边界',
    actionSteps: [
      '运行前先完成单选预测，并在井口同心圆画板绘制「开启重分配（深蓝）」与「不重分配（橙红）」平面轨迹预期',
      '固定其余基线参数，分别在「失效后重新分配」关与开两种设置下运行 600 秒并提取各槽位偏差峰值',
      '运行完成后打开画板实测轨迹叠合检查是否跨越 1.0/1.5/2.5 米警戒圈，基于客观数据解释机理并提交',
    ],
    watch: '第 180 秒 2 号推进器断桨时刻后的北/东向轨迹漂移半径、航向偏转、3D 井口安全包络圈与其余 7 推矢量重分配状态',
    conditionText: '风浪流组合海况（含传感噪声与时延），第 180 秒 2 号推进器发生断桨完全失效，仅切换失效后重分配开关，每组运行 600 秒',
    suggestion: '切勿主观预设故障必定失控，请依据 7 台余留推进器的实测可控余量及平面警戒圈越界情况如实分析。',
    predictionSpec: {
      kind: 'choice',
      prompt: '第 180 秒 2 号推进器断桨失效后，开启其余 7 台推进器在线重分配与不重分配相比，平台位置与航向将如何演变？',
      options: [
        opt('reallocate_contains', '开启重分配能迅速由其余 7 台推进器补足失配力矩与推力并把偏移压回安全圈内；不重分配则产生明显漂移甚至逼近警戒圈'),
        opt('always_lost', '只要任一台推进器失效，平台剩余推力必然不足，无论是否重分配都会冲出 2.5 米红圈'),
        opt('no_difference', '单台推进器占比很小，不启用重分配也与正常运行毫无差别'),
      ],
      allowRationale: true, rationalePlaceholder: '估计 2 号艉右推进器失效瞬间缺失的力与转艏力矩如何被其余 7 推代偿...',
      sketch: {
        mode: 'prediction', plotId: 'planar-envelope', lockPlotId: true,
        label: '运行前手绘预测：2 号推进器断桨后井口安全圈平面轨迹',
        hint: '利用 1.0m 绿圈 / 1.5m 黄圈 / 2.5m 红圈（紧急解脱）底板，深蓝画「开启重分配」收敛轨迹，橙红画「不重分配」漂移轨迹。',
        coordinateOverride: {
          title: '井口安全包络平面轨迹预测坐标系',
          subtitle: '深蓝：开启重分配 · 橙红：不重分配 · 同心圆 1.0m / 1.5m / 2.5m',
          xMin: -4, xMax: 4, yMin: -4, yMax: 4, xLabel: '东向位移 E', yLabel: '北向位移 N', xUnit: 'm', yUnit: 'm',
          rings: [
            { radius: 1.0, label: '绿圈 1.0m', color: '#10b981' },
            { radius: 1.5, label: '黄圈 1.5m', color: '#f59e0b' },
            { radius: 2.5, label: '红圈 2.5m', color: '#ef4444' },
          ],
        },
        promptFocus: '核查学生手绘曲线在故障前后的原点保持、漂移方向以及相对 1.0m/1.5m/2.5m 三道安全包络圈的位置关系。',
        overlayExtractor: extractStep15PlanarSeries,
      },
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '分别采集第 180 秒 2 号断桨后「不重分配」与「在线重分配」两组 600 秒运行最大位置和航向偏差：',
      slots: [
        slot('realloc_off', '故障后不重分配', '失效重分配：关', (r) => r.courseSettings?.reallocate === false, [
          met('north', '北向偏差峰值', 'm', 'north', 'peak'), met('east', '东向偏差峰值', 'm', 'east', 'peak'), met('heading', '航向偏差峰值', '°', 'heading', 'peak'),
        ]),
        slot('realloc_on', '故障后在线重分配', '失效重分配：开', (r) => r.courseSettings?.reallocate === true, [
          met('north', '北向偏差峰值', 'm', 'north', 'peak'), met('east', '东向偏差峰值', 'm', 'east', 'peak'), met('heading', '航向偏差峰值', '°', 'heading', 'peak'),
        ]),
      ],
    },
    interpretationSpec: {
      placeholder: '结合画板实际轨迹与三道安全圈余量，客观陈述「故障—可控余量—位置与航向变化」因果链，说明不预设必失控的实证原则。',
      checklist: ['已完成预测草图与实测平面轨迹叠合核对', '完成不重分配与在线重分配两组完整对照', '基于其余 7 推可控余量评估安全警戒圈裕度'],
    },
  },
  16: {
    goal: '设计单台断桨与受限供电预算下的纵/横/航向权重与节能权重配置，权衡保航向与保位置方案',
    actionSteps: [
      '运行前先预测在有限电力预算下调高航向权重或降低供电上限时，「保航向 vs 保位置」的可行性取舍',
      '可在「本人已冻结方案」引入第 15 步基线，调整纵/横/航向任务权重、节能权重与可用推进功率后运行 600 秒',
      '在下方指标卡采集故障后的北向、东向、航向偏差与功率峰值，总结本步恢复方案参数并提交',
    ],
    watch: '供电受限及断桨后各轴偏差分布变化、航向与位置误差的此消彼长关系及总功率封顶线裕度',
    conditionText: '风浪流组合海况（含传感噪声与时延），第 180 秒 2 号推进器断桨失效，调整任务权重、节能权重与供电预算，运行 600 秒',
    suggestion: '本步设计的权重与电力预算配置将在第 19 步作为候选冻结方案直接引用，请认真评估各轴偏差与功耗余量。',
    predictionSpec: {
      kind: 'choice',
      prompt: '在 2 号推进器断桨且电网可用功率受限（如降至 16 MW 或 8 MW）时，调整三轴权重与节能权重会引发什么取舍？',
      options: [
        opt('tradeoff_heading_pos', '提高航向权重或节能权重会在功率饱和时优先保航向或压低能耗，代价是水平位置瞬态偏移可能增大'),
        opt('all_zero_error', '只要把三轴权重全部同时设为最大值 2，就能在不增加功率的前提下同时提高所有轴精度'),
        opt('budget_no_effect', '可用推进功率预算不会影响分配器出力分配，只影响仪表盘颜色提示'),
      ],
      allowRationale: true, rationalePlaceholder: '结合目标函数权重归一化与功率约束边界说明您的恢复设计意图...',
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '记录所设计恢复方案在第 180 秒断桨故障后的关键偏差与功耗峰值：',
      metrics: [
        met('north', '北向偏差峰值', 'm', 'north', 'peak'),
        met('east', '东向偏差峰值', 'm', 'east', 'peak'),
        met('heading', '航向偏差峰值', '°', 'heading', 'peak'),
        met('power', '正机械功率峰值', 'MW', 'power', 'max'),
      ],
    },
    interpretationSpec: {
      placeholder: '写明您选定的轴向权重、节能权重与电力预算组合，解释其如何在受限资源下实现保航向或保位置的工程折中。',
      checklist: ['明确所选可用电力预算与三轴/节能权重', '对比故障后位置与航向误差分布变化', '阐明可行域内的优先级取舍理由'],
    },
  },
  17: {
    goal: '设计并评估卫星定位信号中断 20 秒期间的应急观测与控制策略，辨析估计不确定性增长与重连冲击',
    actionSteps: [
      '运行前先预测「继续模型预测」「继续预测并冻结积分」与「退出定位并降低出力」三种应急策略的优劣',
      '选择目标应急策略（推荐对比冻结积分或安全退出机制）并完成 600 秒运行（第 180–200 秒发生 20 秒定位中断）',
      '提取中断前后低频位置漂移、航向误差与恢复期机械功率指标，分析缺测边界后提交',
    ],
    watch: '第 180–200 秒左栏「定位量测缺失」提示、低频估计轨迹开环漂移量、积分冻结状态以及第 200 秒信号恢复瞬间冲击',
    conditionText: '风浪流组合海况（含传感噪声与时延），第 180–200 秒卫星位置量测中断 20 秒，仅调整定位缺测策略，运行 600 秒',
    suggestion: '缺测不等于平台回到零位置！短时断链期间模型开环外推不确定性持续累积，必须审慎管理积分器防止恢复瞬态过冲。',
    predictionSpec: {
      kind: 'choice',
      prompt: '当第 180–200 秒发生 20 秒卫星定位量测中断时，若继续模型预测而不冻结积分，相比「预测并冻结积分」或「安全退出」有何风险？',
      options: [
        opt('windup_and_jump', '开环预测误差随时间发散使积分持续错误累积，恢复瞬间易产生剧烈推力跳变；冻结积分可抑制错积，安全退出则主动降载停位'),
        opt('zero_position_hold', '信号中断时量测值自动视为零位置误差，平台能够静止在原位不动'),
        opt('certainty_shrinks', '缺测期间状态估计的不确定性会不断缩小直至精确收敛'),
      ],
      allowRationale: true, rationalePlaceholder: '结合开环外推漂移和重连瞬间误差阶跃分析所选应急策略...',
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '记录所选定位缺测策略在中断期（180–200 秒）及重连恢复后的核心表现指标：',
      metrics: [
        met('strategy', '所选应急策略', undefined, undefined, undefined, `如 ${LOSS_STRATEGY_LABEL.freeze_integral}`),
        met('lfNorth', '低频北向漂移峰值', 'm', 'lfNorth', 'peak'),
        met('lfEast', '低频东向漂移峰值', 'm', 'lfEast', 'peak'),
        met('heading', '航向偏差峰值', '°', 'heading', 'peak'),
        met('power', '恢复末段机械功率', 'MW', 'power', 'steady'),
      ],
    },
    interpretationSpec: {
      placeholder: '阐明「缺测不等于零位置」的估计不确定性增长规律，评估所选策略在短时桥接与强制安全退出的触发边界。',
      checklist: ['辨明信号中断不等于零位置误差', '记录 180–200 秒开环外推漂移与重连瞬态', '界定允许桥接续航与必须安全退出的时间边界'],
    },
  },
  18: {
    goal: '计算不同风速与电力预算下的静态推力能力包络，并用两组动态实测区分静态可行与动态边界差异',
    actionSteps: [
      '运行前先输入预判 8 兆瓦供电预算下的静态风速能力上限与物理依据',
      '点击控制区「计算并保存十五组能力预测」，生成 3 档供电预算与 5 档风速能力表并自动同步静态摘要框',
      '选取两组不同风速或功率预算（建议涵盖温和工况与高风速/低预算临界工况）各运行 600 秒并提取对比读数后提交',
    ],
    watch: '十五组静态预测功率与归一化分配残差分布，以及动态实测中阵风波浪载荷引起的实际位置误差和功率裕度',
    conditionText: '稳态风场（来向 45°、风速可选 8/12/18/24/30 米/秒、含传感噪声与时延），供电预算可选 32/16/8 兆瓦；先做 15 组静态计算，再选 2 组各跑 600 秒',
    suggestion: '切记静态能力不足与控制器参数没调好本质不同；若十五组在静态对齐假定下均可行，亦应如实报告并对比动态裕度差异。',
    predictionSpec: {
      kind: 'numeric_target',
      prompt: '在 8 兆瓦可用推进功率与 45° 来风的静态对齐假定下，你预估平台能够保持静态推力平衡的最大风速上限是多少？',
      unit: 'm/s', targetPlaceholder: '输入 8~30 之间的预估风速上限（如 30）',
      allowRationale: true, rationalePlaceholder: '估算风载随风速平方增长与推进器耗功立方关系，并说明动态波浪/转向限制差异...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '选测两组不同风速或电力预算的 600 秒动态运行并提取实测峰值（另请确认上方「静态能力计算与实际验证」文本框已由一键计算同步）：',
      slots: [
        slot('cap_feasible', '温和/可行工况实测', '建议 16/32 MW 且风速 ≤18 m/s',
          (r) => Number(r.courseSettings?.windSpeedMps ?? 8) <= 18 && Number(r.courseSettings?.powerBudgetMw ?? 32) >= 16, [
            { key: 'cond', label: '风速与预算', extract: (r) => `${r.courseSettings?.windSpeedMps ?? 8}m/s · ${r.courseSettings?.powerBudgetMw ?? 32}MW` },
            met('north', '北向误差峰值', 'm', 'north', 'peak'), met('power', '正机械功率峰值', 'MW', 'power', 'max'),
          ]),
        slot('cap_critical', '高风速/低预算临界实测', '建议风速 24–30 m/s 或 8 MW 预算',
          (r) => Number(r.courseSettings?.windSpeedMps ?? 8) >= 24 || Number(r.courseSettings?.powerBudgetMw ?? 32) === 8, [
            { key: 'cond', label: '风速与预算', extract: (r) => `${r.courseSettings?.windSpeedMps ?? 8}m/s · ${r.courseSettings?.powerBudgetMw ?? 32}MW` },
            met('north', '北向误差峰值', 'm', 'north', 'peak'), met('power', '正机械功率峰值', 'MW', 'power', 'max'),
          ]),
      ],
    },
    interpretationSpec: {
      placeholder: '对照静态能力表与两组动态实测，区分「物理执行器能力上限」与「控制器未整定好」，如实汇报范围内全部可行或临界压力情况。',
      checklist: ['已完成并同步十五组静态能力预测结果', '保留两组不同风速或预算的 600 秒实测运行', '阐明静态对齐假设与动态风浪阵风裕度差异'],
    },
  },
  19: {
    goal: '冻结本人第 16 或第 17 步综合定位方案，在两套未见强风浪流兼单台断桨海况下完成盲测验证',
    actionSteps: [
      '运行前先结合已冻结方案与强组合海况特征，预测位置误差、航向误差与功率裕度的最薄弱环节',
      '在控制区确认已引用并锁定第 16 或第 17 步完整方案（含电力预算），依次选择「验证样本一」与「验证样本二」各跑满 600 秒',
      '每组结束后立即一键提取误差与功率峰值，综合评估抗扰重构稳健性后提交',
    ],
    watch: '第 180 秒 2 号断桨后在两套未见波浪样本下的最大定位偏差、航向抖动、电力预算利用率与分配残差',
    conditionText: '未见强组合海况（平均风 12 米/秒、阵风 2 米/秒、流速 0.5 米/秒、有效波高 1.5 米含一阶与二阶慢漂及传感噪声时延），第 180 秒 2 号推进器断桨，分别跑验证样本一与验证样本二各 600 秒',
    suggestion: '本步禁止临时修改控制参数或电力预算；请保持完全相同的第 16/17 步冻结方案在两个未见样本上独立验证。',
    predictionSpec: {
      kind: 'choice',
      prompt: '将第 16 或第 17 步冻结的完整控制/分配/供电方案直接投入未见强风浪流且伴随 2 号断桨海况时，最可能面临哪类考验？',
      options: [
        opt('combined_load_margin', '二阶慢漂、阵风与单桨故障叠加后推进器剩余可控余量及电力裕度收紧，局部瞬态峰值可能逼近警戒线'),
        opt('identical_to_calm', '因为采用了同一套冻结控制器，在强组合海况下的位置误差和功耗与静水工况完全一致'),
        opt('better_than_intact', '2 号推进器断桨后少了一台阻力源，平台定位精度和功率裕度反而比完好工况更高'),
      ],
      allowRationale: true, rationalePlaceholder: '结合所选冻结方案的电力预算、轴权重与滤波带宽预判薄弱环节...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '以同一冻结方案分别运行验证样本一与验证样本二各 600 秒并提取峰值指标：',
      slots: [
        slot('unseen_sample_1', '未见海况 · 验证样本一', '第一组独立随机海浪样本', (r) => r.configuration.seed === 17, [
          met('north', '北向误差峰值', 'm', 'north', 'peak'), met('east', '东向误差峰值', 'm', 'east', 'peak'),
          met('heading', '航向误差峰值', '°', 'heading', 'peak'), met('power', '正机械功率峰值', 'MW', 'power', 'max'),
        ]),
        slot('unseen_sample_2', '未见海况 · 验证样本二', '第二组独立随机海浪样本', (r) => r.configuration.seed === 29, [
          met('north', '北向误差峰值', 'm', 'north', 'peak'), met('east', '东向误差峰值', 'm', 'east', 'peak'),
          met('heading', '航向误差峰值', '°', 'heading', 'peak'), met('power', '正机械功率峰值', 'MW', 'power', 'max'),
        ]),
      ],
    },
    interpretationSpec: {
      placeholder: '对比两个未见样本的误差、能耗、分配残差及断桨余量，评价冻结方案在未见海况下的鲁棒性与退避/解脱触发界限。',
      checklist: ['两套未见样本均使用同一第 16/17 步冻结方案', '对比双样本下的位置/航向/功率统计离散度', '给出明确的工程作业安全裕度与退避判据'],
    },
  },
  20: {
    goal: '整合三通道模型辨识、波频与慢漂过滤、约束分配、故障恢复与能力边界证据，完成六部分实验报告',
    actionSteps: [
      '在右侧「控制」页签勾选至少 6 次覆盖激励辨识、波浪滤波、故障重分配与未见验证的本人完整运行',
      '利用上方四维报告量规预检与实测证据胶囊库，一键将冻结模型、独立对照与故障运行胶囊插入对应报告章节',
      '依次撰写六部分工程报告，务必声明本教学定位模型不得宣称为真实船级社动力定位等级安全认证',
      '点击「提交本步」归档最终实验报告，并可打开「查看实验报告」核对排版与评分依据',
    ],
    watch: '评估工作台已冻结模型与独立对照计数、四维量规自检得分，以及是否明确区分教学简化假设与真实船级社安全认证边界',
    conditionText: '综合报告整理步（无需运行新仿真），需引用至少 6 次本人完整运行、已冻结三通道模型及独立验证对照',
    suggestion: '报告须覆盖局部耦合模型、波频与低频分离、约束分配、断桨故障与缺测退出判断，并严禁将教学结果宣称为真实船级社动力定位安全认证。',
    interpretationSpec: {
      placeholder: '按六章节要求填写完整报告，并务必声明本实验教学模型不可替代真实船级社动力定位安全认证或隔水管结构强度校核。',
      checklist: ['已勾选并引用至少 6 次本人完整运行记录', '已引用第 4 步冻结三通道模型与第 5 步独立对照数据', '已明确声明教学定位结果不得宣称为真实船级社安全认证'],
    },
    reportFieldGuides: {
      problem: '界定半潜式钻井平台六自由度耦合、三通道定位边界与井口安全包络约束，明确教学简化假设边界。',
      identification: '汇总第 3 步三向激励（纯纵向/纯横向/纯艏摇）与第 4 步冻结的三通道低频矩阵参数。',
      validation: '引用第 5 步独立小位移 RMSE/FIT、第 10–11 步一阶/二阶波频分离及第 18–19 步风浪能力验证数据。',
      comparison: '对比带宽、解耦补偿、积分、风前馈、低频波浪滤波、受限凸分配及斜坡参考在多步单因素实验中的权衡。',
      revision: '总结第 15–17 步单桨断桨重分配、任务/节能权重调整及定位信号中断应急退避策略的修正依据。',
      conclusion: '凝练工况适用边界，并明确声明本教学定位模型不得宣称为真实船级社最高等级动力定位安全认证。',
    },
  },
};
