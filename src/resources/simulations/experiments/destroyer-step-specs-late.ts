import type {
  StepObservationMetricDef,
  StepObservationSlotDef,
} from '../simulations/vessel-experiment';
import type { DestroyerStepWorkbenchSpec } from './destroyer-step-specs-early';
import { choiceOpt, extractDestroyerHeadingOverlay, ticksOf } from './destroyer-step-specs-early';

function headingMetrics(endLabel: string, evalLabel: string): StepObservationMetricDef[] {
  return [
    { key: 'peak_heading', label: '最大实际航向角', unit: '°', seriesId: 'actualHeading', pickMode: 'max' },
    { key: 'steady_heading', label: endLabel, unit: '°', seriesId: 'actualHeading', pickMode: 'steady' },
    { key: 'peak_rudder', label: '最大舵角幅值', unit: '°', seriesId: 'rudder', pickMode: 'peak' },
    { key: 'eval_metrics', label: evalLabel, placeholder: '见评估页签运行评价' },
  ];
}

function step11ModeSlot(id: string, label: string, controlMode: 'pd' | 'pid', modeLabel: string): StepObservationSlotDef {
  return {
    id,
    label,
    conditionHint: '恒定风扰动 · 400 s',
    matcher: (r) => r.initialInput.controlMode === controlMode,
    metrics: [
      { key: 'mode', label: '控制模式', extract: () => modeLabel },
      { key: 'ki', label: '积分增益 Ki', extract: (r) => r.initialInput.pid.ki.toFixed(4) },
      { key: 'steady_heading', label: '末态航向角', unit: '°', seriesId: 'actualHeading', pickMode: 'steady' },
      { key: 'steady_rudder', label: '平衡舵角', unit: '°', seriesId: 'rudder', pickMode: 'steady' },
    ],
  };
}

function step12AntiWindupSlot(id: string, label: string, enabledState: boolean): StepObservationSlotDef {
  return {
    id,
    label,
    conditionHint: '60°→0° 大转向 · 500 s',
    matcher: (r) => (r.initialInput.headingIntegralTracking?.enabled ?? true) === enabledState,
    metrics: [
      {
        key: 'state',
        label: '抗饱和状态',
        extract: enabledState
          ? (r) => `开启 (${(r.initialInput.headingIntegralTracking?.timeS ?? 1).toFixed(2)}s)`
          : () => '关闭',
      },
      { key: 'peak_heading', label: '最大航向峰值', unit: '°', seriesId: 'actualHeading', pickMode: 'max' },
      { key: 'end_heading', label: '500 s 末态航向', unit: '°', seriesId: 'actualHeading', pickMode: 'steady' },
      { key: 'sat_share', label: '舵受限占比 / 恢复时间', placeholder: '见评估页签运行评价' },
    ],
  };
}

function step14WaveSlot(id: string, label: string, conditionHint: string, envCode: 'P0' | 'V1', envLabel: string): StepObservationSlotDef {
  return {
    id,
    label,
    conditionHint,
    matcher: (r) => r.configuration.environment === envCode,
    metrics: [
      { key: 'env', label: '海况条件', extract: () => envLabel },
      { key: 'peak_yaw', label: '峰值转艏速率', unit: '°/s', seriesId: 'yawRate', pickMode: 'peak' },
      { key: 'peak_rudder', label: '峰值舵角', unit: '°', seriesId: 'rudder', pickMode: 'peak' },
      { key: 'eval_roll_tv', label: '最大横摇 / 舵总变差', placeholder: '见评估页签运行评价' },
    ],
  };
}

function step15FilterSlot(
  id: string,
  label: string,
  matcher: StepObservationSlotDef['matcher'],
  settingMetric: StepObservationMetricDef,
): StepObservationSlotDef {
  return {
    id,
    label,
    conditionHint: '至少完成两档对照 · 400 s',
    matcher,
    metrics: [
      settingMetric,
      { key: 'peak_rudder', label: '峰值舵角', unit: '°', seriesId: 'rudder', pickMode: 'peak' },
      { key: 'tv_rmse', label: '舵角总变差 / 航向RMSE', placeholder: '见评估页签运行评价' },
    ],
  };
}

function step19SpeedSlot(id: string, label: string, speedMps: number): StepObservationSlotDef {
  return {
    id,
    label,
    conditionHint: `初始航速 ${speedMps} m/s · 600 s`,
    matcher: (r) => Number(r.configuration.initialWaterSpeedMps) === speedMps,
    metrics: [
      { key: 'speed', label: '初始航速', unit: 'm/s', extract: (r) => r.configuration.initialWaterSpeedMps?.toFixed(1) ?? null },
      { key: 'peak_heading', label: '最大实际航向', unit: '°', seriesId: 'actualHeading', pickMode: 'max' },
      { key: 'peak_rudder', label: '峰值舵角', unit: '°', seriesId: 'rudder', pickMode: 'peak' },
      { key: 'safety', label: '最大横摇 / 告警与受限占比', placeholder: '见评估页签运行评价' },
    ],
  };
}

export const DESTROYER_STEP_SPECS_LATE: readonly DestroyerStepWorkbenchSpec[] = [
  {
    seq: 11,
    goal: '在恒定风场扰动下保持比例和微分增益不变，对比无积分与加入积分控制后的末态稳态误差与平衡压舵效果。',
    actionSteps: [
      '运行前在预测区判断恒定侧风下不带积分与启用积分控制时末 120 秒稳态航向偏差和平衡舵角的差异。',
      '保持本人模型、Kp 与 Kd 完全固定：先选控制模式「pd」运行 400 秒；重置后切为「pid」并设定合适积分增益 Ki 运行第 2 次 400 秒。',
      '在下方两槽分别提取控制模式、积分增益、末态航向与稳态舵角，对比抗风静差消除机制。',
    ],
    watch: '恒定风持续推偏船体时，纯比例微分残留的稳态航向偏角，以及启用积分后舵角逐步积蓄形成抗风平衡偏角的过程。',
    conditionText: '存在恒定定常风扰动（无波浪与海流、无传感附加噪声），初始航速 8 m/s，全程指令航向 +10°，分别以无积分与含积分模式运行各 400 秒。',
    suggestion: '两次对比除「控制模式」与「Ki」外严禁修改 Kp 或 Kd；同时记录稳态平衡舵角以体现平衡外部风力矩的物理意义。',
    predictionSpec: {
      kind: 'choice',
      prompt: '在恒定侧风扰动下保持目标航向 +10°，无积分控制与含积分控制在末 120 秒稳态误差上会有何差异？',
      options: [
        choiceOpt('integral_removes_steady_wind_error', '无积分控制将残留恒定航向静差来维持压舵角，加入积分作用后可逐步累积抗风压舵力矩使稳态航向误差收敛至零附近', '外部常值风力矩必须由控制器积分项在零航向误差下持续提供稳态平衡舵角加以抵消'),
        choiceOpt('pd_zero_error_under_wind', '纯比例微分控制无需积分就能在恒定侧风下维持绝对零稳态误差', '若航向误差与转艏速率均为零，纯比例微分舵角输出必为零而无法对抗常值风力矩'),
        choiceOpt('integral_amplifies_steady_error', '开启积分控制会永久增大稳态航向偏差且无法产生稳定平衡舵角', '合理积分增益会随时间消除常值外扰造成的稳态静差'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合常值风力矩平衡方程说明稳态误差与平衡舵角的对应关系...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '固定 Kp 与 Kd 完成无积分与含积分两次 400 秒运行后，一键提取各自控制参数、末态航向与稳态平衡舵角：',
      slots: [
        step11ModeSlot('mode_pd', '比例微分控制 (无积分)', 'pd', '无积分对照'),
        step11ModeSlot('mode_pid', '比例积分微分控制 (含积分)', 'pid', '含积分对照'),
      ],
    },
    interpretationSpec: {
      checklist: ['对比两次运行的末 120 秒平均绝对误差与稳态舵角', '阐明积分抗恒定风扰的物理本质', '指出过大积分增益可能引起的超调或饱和风险'],
      placeholder: '对比无积分与含积分的末态航向静差及稳态压舵角，解释积分器如何提供持续平衡风力矩的舵偏量...',
    },
  },
  {
    seq: 12,
    goal: '在大角度往返转向诱发舵角饱和的工况下对比关闭与开启积分抗饱和回算，量化超调峰值、饱和持续占比与退饱和恢复时间。',
    actionSteps: [
      '运行前在预测区判断关闭与开启抗饱和的影响，并在 0–500 s 坐标系手绘 60°→0° 往返航向轨迹后点击「识图核验」。',
      '固定本人模型、PID 增益与积分回算时间：先将「积分抗饱和」设为「关闭」运行完整 500 秒；重置后切换为「开启」运行第 2 次 500 秒。',
      '在下方两槽提取峰值航向与末态航向，对照手绘叠合轨迹与评估页签的舵受限占比完成比较。',
    ],
    watch: 't=20 s 转向 +60° 舵角顶满 ±35° 饱和区后，关闭抗饱和导致的显著过冲与 t=250 s 指令回 0° 时的长延迟退饱和过程。',
    conditionText: '平静无风浪无海流环境，无传感附加噪声，初始航速 8 m/s，比例积分微分控制，t=20 s 转向 +60°、t=250 s 回 0°，各 500 秒。',
    suggestion: '两次运行之间必须保持 Kp/Ki/Kd 与积分回算时间等其余参数完全一致，不可仅凭 500 秒末值下结论，须比较饱和占比与恢复时间。',
    predictionSpec: {
      kind: 'choice',
      prompt: '在 60°→0° 大角度往返转向并伴随满舵饱和时，关闭与开启积分抗饱和在动态响应上有何关键差异？',
      options: [
        choiceOpt('windup_overshoot_and_slow_recovery', '关闭抗饱和会在饱和期间持续累积虚假积分，造成更大航向超调并显著拉长回零退饱和时间；开启抗饱和可泄放饱和累积、减小过冲并加快恢复', '积分回算通过实际舵角与理想指令差值实时修正积分状态，阻止满舵期间积分深陷饱和'),
        choiceOpt('antiwindup_causes_windup', '开启抗饱和回算会加大积分深度并导致更严重的过冲和满舵滞留', '误解了抗饱和跟踪抑制积分累积的正向作用'),
        choiceOpt('only_end_value_matters', '只要 500 秒末都能回到 0°，关闭与开启抗饱和在整个过渡过程没有任何区别', '忽视了大转向饱和过冲幅值、满舵时长占比与安全恢复时间差异'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合舵角硬限幅与积分状态累积说明积分回算时间的作用机制...',
      sketch: {
        mode: 'prediction',
        plotId: 'time-response',
        lockPlotId: true,
        label: '运行前手绘预测：60°→0° 大转向饱和与抗饱和航向过程',
        hint: '在 0–500 s 坐标系描绘 t=20 s 转向 60° 与 t=250 s 回转 0° 的航向曲线，体现饱和过冲与回零恢复节奏。',
        promptFocus: '重点标出 t=20 s 向 60° 转向和 t=250 s 回 0° 两段的过冲峰值及收敛速度。',
        coordinateOverride: {
          title: '大转向饱和与积分抗饱和预测坐标系',
          subtitle: '0–500 s 往返转向（t=20 s 转向 60°，t=250 s 回 0°）',
          xMin: 0, xMax: 500, yMin: -15, yMax: 85,
          xLabel: '时间 t', yLabel: '航向角', xUnit: 's', yUnit: '°',
          xTicks: ticksOf([0, 100, 200, 300, 400, 500]),
          yTicks: ticksOf([-15, 0, 20, 40, 60, 80]),
          verticalMarkers: [{ value: 20, label: 't=20s 60°', color: '#0ea5e9' }, { value: 250, label: 't=250s 0°', color: '#f59e0b' }],
          horizontalMarkers: [{ value: 60, label: '目标 60°', color: '#64748b' }, { value: 0, label: '回零 0°', color: '#64748b' }],
        },
        overlayExtractor: (samples) => extractDestroyerHeadingOverlay(samples, 500),
      },
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '固定增益完成关闭与开启抗饱和两次 500 秒运行后，分别一键提取峰值航向与末态航向，并补填评估页签的舵受限占比：',
      slots: [step12AntiWindupSlot('aw_off', '积分抗饱和关闭', false), step12AntiWindupSlot('aw_on', '积分抗饱和开启', true)],
    },
    interpretationSpec: {
      checklist: ['对比抗饱和开关前后航向超调峰值与回零恢复时间', '对照评估页签的舵角/舵速受限时长与占比', '说明抗饱和对执行器物理约束的保护意义'],
      placeholder: '结合饱和持续占比、退饱和恢复时间与超调峰值差异，阐明大机动工况下积分抗饱和的作用边界...',
    },
  },
  {
    seq: 13,
    goal: '在定常横流下维持 0° 航向并观测对地轨迹偏移，明确区分“航向保持”与“航迹保持”的控制层级边界。',
    actionSteps: [
      '运行前在预测区判断存在横向海流时，保持船艏指向 0° 能否阻止船舶对地轨迹持续横漂。',
      '选定本人模型与控制参数后点击「开始」运行完整 400 秒，同步观察三维尾迹偏离与左侧航迹误差曲线。',
      '运行结束后点击下方「从当前曲线读取」采集稳态航向、对水航速与航迹横偏误差。',
    ],
    watch: '实际航向稳稳保持在 0° 附近，但估计航迹误差与三维尾迹持续侧向偏离基准航线，展现对水速度与对地合成速度的矢量差异。',
    conditionText: '存在定常横向海流扰动（无波浪与风扰动、无传感附加噪声），初始对水航速 8 m/s，指令航向全程保持 0°，总时长 400 秒。',
    suggestion: '航向角只反映船艏朝向，当水体自身存在横向流速时，必须通过外环航迹制导或给出逆流漂角才能实现航迹保持。',
    predictionSpec: {
      kind: 'choice',
      prompt: '存在定常横向海流时，使航向角稳定在 0° 的航向控制器能实现下列哪种效果？',
      options: [
        choiceOpt('heading_not_track', '仅实现了“航向保持”而非“航迹保持”：船艏始终指向 0°，但船舶随横流持续横漂，对地横偏随时间单调增长', '对地合速度等于对水船速与海流流速矢量之和，不修正期望航向漂角就无法消除横向位移累积'),
        choiceOpt('zero_heading_means_zero_track', '只要航向稳在 0° 且误差为零，船舶就一定沿着预设直线不发生任何横偏', '忽视了参考系从随水体运动到相对大地轨迹的矢量叠加变化'),
        choiceOpt('water_and_ground_identical', '海流中计程仪测得的对水速度与船舶对地航速大小方向始终完全一致', '两者之差恰反映未知海流在船体纵横向的投影分量'),
      ],
      allowRationale: true,
      rationalePlaceholder: '利用对水速度与海流速度矢量合成说明为何“航向正确仍会横漂”...',
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '400 秒横流运行结束后，从曲线读取稳态航向、对水航速、最大航迹横偏误差与稳态舵角：',
      metrics: [
        { key: 'steady_heading', label: '稳态实际航向角', unit: '°', seriesId: 'actualHeading', pickMode: 'steady' },
        { key: 'steady_speed', label: '稳态对水航速', unit: 'm/s', seriesId: 'speed', pickMode: 'steady' },
        { key: 'max_crosstrack', label: '最大航迹横偏误差', unit: 'm', seriesId: 'crossTrackError', pickMode: 'max' },
        { key: 'steady_rudder', label: '稳态舵角', unit: '°', seriesId: 'rudder', pickMode: 'steady' },
      ],
    },
    interpretationSpec: {
      checklist: ['明确判定本步为“航向保持”而非“航迹保持”', '给出对水航速与实测横偏定量证据', '说明实现航迹保持所需的制导外环思路'],
      placeholder: '结合航向接近 0° 却产生显著横偏的实测数据，论证航向保持与航迹保持的概念界线及对水/对地速度差异...',
    },
  },
  {
    seq: 14,
    goal: '保持同一套控制器与初态不变，对比平静水面与不规则波浪海况，从横摇、转艏与舵角时程中分离并识别波频振荡分量。',
    actionSteps: [
      '运行前在预测区判断波浪激励引入后对船体横摇与自动舵角的高频影响。',
      '保持控制器不变：在「本次运行条件」先选「平静水面对照」运行 600 秒；重置后不改任何增益，切为「有波对照」再运行 600 秒。',
      '在下方两槽提取转艏速率与舵角峰值，并从「评估」页签补填最大横摇与舵总变差，严禁仅靠三维画面晃动替代定量证据。',
    ],
    watch: '有波海况下叠加在曲线上的周期性高频往复振荡，以及评估页签中最大横摇角、航向 RMSE 与舵角总变差的明显抬升。',
    conditionText: '对比无风无流无传感噪声的平静水面与不规则波浪海况，初始航速 8 m/s，保持同一控制器与随机序列运行各 600 秒。',
    suggestion: '两次运行必须固定完全相同的控制器；请到「评估」页签读取确定性横摇峰值、航向 RMSE 与实际舵角总变差作为对比依据。',
    predictionSpec: {
      kind: 'choice',
      prompt: '保持航向控制器与初态完全不变，将水面由平静切换为不规则波浪时，各通道最显著的变化是什么？',
      options: [
        choiceOpt('wave_freq_roll_yaw_rudder', '一阶波浪载荷同时诱发波频横摇与艏摇振荡，并经闭环反馈驱动舵角高频往复动作，显著抬高舵角总变差与横摇峰值', '未滤除的波频艏摇分量进入反馈回路使舵机追随海浪频率无效摆动'),
        choiceOpt('no_rudder_activity_increase', '航向闭环会自动忽略波频干扰，舵角总变差与平静水面保持一致', '传统反馈控制器无法天然区分高频波浪干扰与低频航向指令偏差'),
        choiceOpt('pure_visual_animation_only', '波浪只改变三维水面起伏效果，不会引起任何传感器量测与舵角变化', '波浪流体力矩直接作用于多自由度船体动力学并反映在量测通道中'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合波浪载荷的多自由度耦合与航向闭环传导链阐述波频运动识别思路...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '固定同一套控制器完成平静水面与有波海况各 600 秒运行后，提取曲线峰值并补填评估页签的横摇与舵总变差：',
      slots: [
        step14WaveSlot('calm_water', '平静水面对照工况', '无波浪基线 · 600 s', 'P0', '平静水面'),
        step14WaveSlot('wave_sea', '有波海况对照工况', '不规则波浪激励 · 600 s', 'V1', '有波海况'),
      ],
    },
    interpretationSpec: {
      checklist: ['给出平静与有波下横摇峰值、航向 RMSE 与舵总变差定量对比', '分辨波频振荡分量与低频航向趋势', '指出后续波浪滤波或死区/降带宽的必要方向'],
      placeholder: '用实测横摇、转艏与舵角总变差定量比较两工况差异，阐明波浪激励引起的多自由度波频分量特征...',
    },
  },
  {
    seq: 15,
    goal: '在传感测量噪声环境下对比原始微分与多档低通滤波时间常数，权衡高频噪声舵抖动抑制与闭环相位滞后代价。',
    actionSteps: [
      '运行前在预测区判断增大微分滤波时间常数对舵角总变差与跟踪动态的双重作用。',
      '保持本人模型与 Kp/Kd 固定不变，至少选取「原始微分」与有滤波档位（如 0.2 s、1 s 或 3 s）中的两档各运行完整 400 秒。',
      '在下方对应滤波工况槽提取各自滤波档位与峰值舵角，并补填评估页签的实际舵角总变差与航向 RMSE。',
    ],
    watch: '「原始微分」下舵角曲线剧烈高频毛刺与极高的实际舵角总变差，以及滤波时间常数增大至 3 s 时航向超调加大的相位代价。',
    conditionText: '平静水面叠加标准传感器测量噪声（无风浪流），初始航速 8 m/s，比例微分控制，t=20 s 转向 +10°，固定 Kp/Kd 仅切换至少两档微分滤波，各 400 秒。',
    suggestion: '严禁改动 Kp 或 Kd；至少保存两档不同滤波设置（强烈建议含“原始微分”与一档滤波），并在评估页签读取舵角总变差与航向 RMSE。',
    predictionSpec: {
      kind: 'choice',
      prompt: '在含传感器测量噪声的比例微分航向控制中，将微分通道由“原始微分”调大至 0.2 s、1 s 乃至 3 s 滤波时，会出现什么工程权衡？',
      options: [
        choiceOpt('noise_reduction_vs_phase_lag', '加入适当滤波（0.2–1 s）可成倍削减噪声引发的舵角总变差与高频抖动，但滤波时间常数过大（如 3 s）会带来明显相位滞后、削弱微分阻尼并抬高超调或跟踪 RMSE', '一阶低通滤波虽能抑制高频测量噪声，却在穿越频率附近引入相位延迟而损失相位裕度'),
        choiceOpt('raw_derivative_smoothest', '不加滤波的原始微分能完全免疫高频传感器噪声，舵角曲线最平滑', '纯微分环节对高频噪声具有随频率正比放大的特性'),
        choiceOpt('largest_filter_no_lag', '滤波时间常数越大响应越迅速、超调越小，不存在相位滞后代价', '一阶惯性环节的时间常数越大，相角滞后与阻尼削弱越明显'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合微分器高频噪声放大效应与低通滤波相角滞后分析折中机理...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '固定 Kp/Kd 完成至少两档微分滤波设置运行后，提取对应滤波档位与峰值舵角，并从评估页签补填舵角总变差与航向 RMSE：',
      slots: [
        step15FilterSlot('filter_raw', '无滤波（原始微分）', (r) => (r.initialInput.derivativeFilterTauS ?? 0.2) === 0, { key: 'filter_setting', label: '滤波档位', extract: () => '原始微分 (无滤波)' }),
        step15FilterSlot('filter_02', '轻度滤波（0.2 s 档）', (r) => Math.abs((r.initialInput.derivativeFilterTauS ?? 0.2) - 0.2) < 1e-4, { key: 'filter_setting', label: '滤波档位', unit: 's', extract: () => '0.2' }),
        step15FilterSlot('filter_strong', '强滤波（1 s 或 3 s 档）', (r) => (r.initialInput.derivativeFilterTauS ?? 0.2) >= 0.99, { key: 'filter_setting', label: '滤波档位', unit: 's', extract: (r) => (r.initialInput.derivativeFilterTauS ?? 0.2).toFixed(1) }),
      ],
    },
    interpretationSpec: {
      checklist: ['定量对比所测各档的舵角总变差与航向跟踪 RMSE', '解释高频噪声放大与低通相位滞后之间的取舍', '说明工程选定滤波时间常数的理由'],
      placeholder: '用实测舵角总变差和航向 RMSE 数据说明无滤波与不同滤波档位下的噪声—相位权衡结果...',
    },
  },
  {
    seq: 16,
    goal: '将前期单因子认识迁移至风浪流与噪声综合海况，整定并冻结第一版综合控制方案，完整记录各参数工程依据。',
    actionSteps: [
      '运行前在预测区输入本套第一方案在综合海况下预期的最大航向角峰值，并写明各项参数迁移思路。',
      '在控制区选中本人 8 m/s 一阶模型，统筹整定比例、积分、微分增益与微分滤波时间常数后点击「开始」运行完整 600 秒。',
      '运行结束后从曲线读取最大航向、末态航向与峰值舵角，并记录评估页签各项误差与舵动作指标。',
    ],
    watch: '风、浪、海流与传感器噪声共同作用下，+10° 转向的超调控制、末 120 秒稳态航向精度、横摇峰值与舵机动作平滑度。',
    conditionText: '综合风、浪、海流联合扰动叠加标准测量噪声，初始航速 8 m/s，比例积分微分控制，t=20 s 转向 +10°，总时长 600 秒。',
    suggestion: '运行启动后严禁途中改参；保留完整 600 秒第一方案运行作为第 17 步公平对照的基准。',
    predictionSpec: {
      kind: 'numeric_target',
      unit: '°',
      targetPlaceholder: '如 12.0',
      prompt: '在综合风浪流与噪声下响应 +10° 航向阶跃，预估第一综合方案全过程的最大实际航向角峰值 (°)：',
      allowRationale: true,
      rationalePlaceholder: '阐明比例/积分/微分增益与滤波时间常数是如何从前序单因子实验迁移而来的...',
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '600 秒综合方案运行结束后，从曲线读取关键指标，并从评估页签补录航向 RMSE、末段平均误差与舵总变差：',
      metrics: headingMetrics('600 s 末态航向角', '航向RMSE / 末段误差 / 舵总变差'),
    },
    interpretationSpec: {
      checklist: ['总结前序单因子规律向综合海况的迁移依据', '复盘超调、稳态精度、横摇与舵动作表现', '指出可在第 17 步第二方案进一步权衡调整的参数方向'],
      placeholder: '完整说明第一方案参数选择依据及多目标运行表现，提出第二方案准备权衡改进的方向...',
    },
  },
  {
    seq: 17,
    goal: '在与第 16 步完全相同的环境与随机激励下构建第二控制方案，通过误差、超调、舵动作与能耗的多维权衡完成公平比较。',
    actionSteps: [
      '运行前在预测区判断调整控制器后多目标性能之间的 Pareto 取舍关系。',
      '保持本人模型一致并在约束范围内修改至少一项控制器参数或滤波设置（勿完全照搬第 16 步），点击「开始」完成 600 秒运行。',
      '在下方「方案一」「方案二」对照槽补填并提取两组多维指标，避免仅以单一分数代替物理因果解释。',
    ],
    watch: '同一随机海况下，方案二相对方案一在航向 RMSE、超调量、舵角总变差与正机械功之间的此消彼长关系。',
    conditionText: '与第 16 步完全相同的风浪流综合扰动、测量噪声、初始航速 8 m/s 与随机种子，t=20 s 转向 +10°，总时长 600 秒。',
    suggestion: '必须确保调整后的控制参数签名与第 16 步不同；比较两方案时请综合误差、超调、舵总变差与功耗说明各自得失。',
    predictionSpec: {
      kind: 'choice',
      prompt: '在与第 16 步同条件、同随机激励下调整参数形成第二方案时，两方案比较最符合哪种工程权衡规律？',
      options: [
        choiceOpt('pareto_tradeoff_between_accuracy_and_actuation', '进一步压低航向误差与超调通常会带来更高舵角总变差或正机械功；反之放缓舵动作虽省功降磨损，却可能使瞬态跟踪误差略增', '在执行器带宽与水动力约束下，精度、超调、舵磨损与功耗构成互有制约的多目标折中前沿'),
        choiceOpt('all_metrics_improve_for_free', '存在某组增益能在不增加任何舵动作与功耗的前提下，将跟踪误差与调节时间同步降为零', '提高闭环带宽必然要求执行器输出更大更频繁的恢复舵力矩'),
        choiceOpt('change_sea_state_for_comparison', '可以通过把第 17 步调回平静水面来证明第二方案明显优于第一方案', '改变外部扰动或初态会破坏同条件公平比较前提'),
      ],
      allowRationale: true,
      rationalePlaceholder: '写明第二方案相对第一方案拟调整的参数及预判的得失指标...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '在第一槽对照填写第 16 步方案一评估指标，在第二槽一键提取本步方案二参数与曲线指标完成公平比较：',
      slots: [
        {
          id: 'scheme_1',
          label: '方案一（第 16 步基准方案）',
          conditionHint: '同条件同种子基准',
          metrics: [
            { key: 'rmse', label: '航向 RMSE', unit: '°', placeholder: '填第 16 步评估值' },
            { key: 'overshoot', label: '超调 / 调节时间', placeholder: '填第 16 步评估值' },
            { key: 'tv_work', label: '舵总变差 / 正机械功', placeholder: '填第 16 步评估值' },
          ],
        },
        {
          id: 'scheme_2',
          label: '方案二（本步修订方案）',
          conditionHint: '同条件同种子 · 600 s',
          matcher: (r) => r.stepSequence === 17,
          metrics: [
            {
              key: 'controller',
              label: '方案二参数快照',
              extract: (r) => `${r.initialInput.controlMode.toUpperCase()} Kp=${r.initialInput.pid.kp.toFixed(2)} Ki=${r.initialInput.pid.ki.toFixed(3)} Kd=${r.initialInput.pid.kd.toFixed(1)}`,
            },
            { key: 'peak_heading', label: '最大实际航向', unit: '°', seriesId: 'actualHeading', pickMode: 'max' },
            { key: 'steady_heading', label: '末态实际航向', unit: '°', seriesId: 'actualHeading', pickMode: 'steady' },
            { key: 'eval_metrics', label: 'RMSE / 舵总变差 / 机械功', placeholder: '见评估页签运行评价' },
          ],
        },
      ],
    },
    interpretationSpec: {
      checklist: ['对比方案一与方案二的 RMSE、超调、舵总变差与正机械功', '说明参数调整的物理因果而非只给综合结论', '选定用于第 18 与第 19 步冻结验证的代表方案'],
      placeholder: '定量列举方案一与方案二在精度、超调、舵总变差与机械功上的差异，阐明最终推选方案的取舍逻辑...',
    },
  },
  {
    seq: 18,
    goal: '锁定并沿用第 16 或第 17 步选定控制方案完全不变，在未见 6 m/s 较低航速与独立随机海况中检验方案鲁棒性与有效范围。',
    actionSteps: [
      '运行前在预测区判断 8 m/s 整定方案直接迁移到 6 m/s 未见航速时的响应快慢与抗扰余量变化。',
      '在控制区「已冻结的本人控制方案」选定第 16 或第 17 步保存的方案（全部增益与滤波锁定），点击「开始」完成 600 秒盲测。',
      '运行结束后从曲线提取最大航向、末态航向与峰值舵角，并从评估页签记录真实泛化指标（禁止覆盖修改原方案）。',
    ],
    watch: '6 m/s 航速下舵效减弱引起的转向上升变慢、相同风浪干扰下航向偏移增幅及调节时间延长情况。',
    conditionText: '独立随机风浪流组合扰动与传感噪声，未知测试航速 6 m/s，全套控制器与滤波参数冻结锁定，t=20 s 转向 +10°，总时长 600 秒。',
    suggestion: '禁止为了盲测表现更好而重新拟合或更改已选方案；真实保留未见工况测试结果才是验证泛化边界的科学依据。',
    predictionSpec: {
      kind: 'choice',
      prompt: '将针对 8 m/s 整定的冻结方案无修改迁移至未见 6 m/s 航速与新风浪流扰动时，闭环表现最可能呈现何种规律？',
      options: [
        choiceOpt('slower_narrower_margin', '低速 6 m/s 使舵效增益减小、船体响应变慢，转向上升沿变缓且扰动下航向误差可能略增，但若原方案裕度充足仍能保持稳定收敛', '舵力矩随航速平方减小而使等效环路带宽下降，考验方案在低速工作点的稳定裕度'),
        choiceOpt('zero_speed_sensitivity', '航速变化至 6 m/s 对闭环响应速度与稳态抗扰误差毫无影响', '忽视了第 7 步已验证的船体舵效增益 K 与时间常数 T 随航速的显著变化'),
        choiceOpt('faster_turn_at_6mps', '航速降为 6 m/s 后舵效比 8 m/s 更强，转向速度成倍加快', '航速越低则舵叶水动力升力越弱，单位舵角产生的转艏力矩明显下降'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合第 7 步 4/8/12 m/s 标度规律与扰动相对比重变化说明 6 m/s 泛化预判...',
    },
    observationSpec: {
      kind: 'structured_metrics',
      prompt: '600 秒未见 6 m/s 航速验证完成后，从曲线读取关键读数，并补录评估页签的航向 RMSE、调节时间与最大横摇：',
      metrics: headingMetrics('600 s 末态航向角', '航向RMSE / 调节时间 / 横摇'),
    },
    interpretationSpec: {
      checklist: ['核验全程严格沿用第 16/17 步冻结方案', '对比 6 m/s 盲测与 8 m/s 基准在误差和调节时间上的变化', '明确界定该固定控制方案的可靠适用航速域'],
      placeholder: '结合 6 m/s 盲测定量结果，评估冻结方案在低速与陌生随机扰动下的泛化鲁棒性及适用边界...',
    },
  },
  {
    seq: 19,
    goal: '保持同一冻结方案在 10 m/s 强阵风风浪流边界下检验约束越限风险，并通过降速至 8 m/s 重新验证工程降额修正效果。',
    actionSteps: [
      '运行前在预测区判断 10 m/s 强风浪流工况触发边界失配的原因及降速至 8 m/s 后的缓解机理。',
      '在控制区选中第 16 或第 17 步同一个冻结方案，保持「本次运行条件」为 10 m/s 完成 600 秒边界运行（如实记录超调、饱和或横摇告警）。',
      '点击「重置」，保持同一个冻结方案不变，仅将「本次运行条件」切为「降速验证 8 m/s」跑完第 2 次 600 秒，在下方两槽提取对比。',
    ],
    watch: '10 m/s 高速与强阵风下评估页签里的最大横摇、横摇告警累计时间及舵受限占比，以及主动降速至 8 m/s 后约束指标的恢复幅度。',
    conditionText: '强风（平均风速 12 m/s 含阵风脉动）、波浪、海流与标准测量噪声组合恶劣海况，同一冻结方案下对比 10 m/s 边界与降速 8 m/s 修正运行（各 600 秒）。',
    suggestion: '切勿删除或掩盖 10 m/s 下暴露超限的失败或边界记录；必须同时保留 10 m/s 边界与 8 m/s 降速两次完整运行以论证修正策略。',
    predictionSpec: {
      kind: 'choice',
      prompt: '沿用为 8 m/s 整定的冻结控制器，在 10 m/s 高速叠加 12 m/s 强阵风波浪下运行时为何需要通过降速至 8 m/s 修正？',
      options: [
        choiceOpt('high_speed_gain_and_roll_boundary', '10 m/s 下船体舵效增益升高导致固定控制器等效环路增益过大，叠加强阵风横浪易引发大横摇告警或舵速率/舵角受限；主动降速至 8 m/s 可拉回设计工作点并缓解横倾与饱和压力', '高航速既放大舵效增益与转向离心横倾力矩，又提高高频波浪遭遇强度，超出原方案适用包络'),
        choiceOpt('higher_speed_eliminates_roll', '10 m/s 航速比 8 m/s 抗风能力无限增强且横摇角严格更小，绝不会触发告警', '高速转向诱导横倾力矩随速度平方增长，且偏离设计航速使等效控制带宽过激'),
        choiceOpt('speed_derating_useless', '不改控制器而仅仅将航速降回 8 m/s 对改善横摇与舵饱和没有任何物理作用', '改变航速直接降低舵效增益与离心横倾负荷，使船体回到原控制器设计工作点'),
      ],
      allowRationale: true,
      rationalePlaceholder: '结合高速舵效放大对固定控制器稳定裕度与横摇安全约束的影响说明降额逻辑...',
    },
    observationSpec: {
      kind: 'multi_run_slots',
      prompt: '保持同一冻结方案不变，完成 10 m/s 边界与 8 m/s 降速修正两次 600 秒运行后，提取指标并补填评估页签的安全与受限数据：',
      slots: [
        step19SpeedSlot('boundary_10', '强扰动 10 m/s 边界运行', 10),
        step19SpeedSlot('derate_8', '降速修正 8 m/s 验证运行', 8),
      ],
    },
    interpretationSpec: {
      checklist: ['保留 10 m/s 边界暴露的真实受限/告警证据', '定量对比 10 m/s 与降速 8 m/s 的安全包络改善', '凝练固定控制方案在恶劣海况下的工程降额准则'],
      placeholder: '对比 10 m/s 与 8 m/s 两次运行的最大横摇、告警累计时间与舵受限占比，阐明超出有效域时的工程修正依据...',
    },
  },
  {
    seq: 20,
    goal: '整合本人至少 4 次完整运行、冻结模型、独立验证及同条件方案对照证据，完成六部分结构化工程实验报告。',
    actionSteps: [
      '在上方「报告引用的本人运行」勾选至少 4 次本人完整运行（需含模型辨识运行、独立验证对照运行与一对同工况同激励的方案对照运行）。',
      '利用下方「步 1–19 实测证据胶囊」将冻结模型公式、验证 RMSE/FIT 与实测运行摘要一键插入对应章节，确认四维报告量规预检全部达标。',
      '逐章完成六部分报告撰写并点击「提交本步」，随后点击「查看实验报告」核验最终排版结果。',
    ],
    watch: '四维报告量规预检覆盖度，以及所选运行记录是否完整支撑模型假设、辨识验证、方案权衡与失效边界四方面论证。',
    conditionText: '综合实验总结与实证报告编制阶段（无需新开仿真运行），须绑定至少 4 次个人运行、冻结船体模型、独立验证对照与同条件方案比较。',
    suggestion: '切勿遗漏独立验证对照运行或同条件对比运行；每部分结论均需引用真实数据、单位和明确适用边界。',
    observationSpec: {
      kind: 'text',
      prompt: '请核对已勾选至少 4 次覆盖辨识、独立验证与同条件方案对照的本人运行，并利用下方证据胶囊与四维量规预检完成六部分工程报告。',
    },
  },
];
