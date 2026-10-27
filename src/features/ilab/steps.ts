import { ILAB_VESSEL_LIST, type IlabVesselId } from './vessels';

export interface IlabStepField {
  key: string;
  label: string;
  kind: 'number' | 'text' | 'select' | 'checks';
  unit?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
}

export interface IlabStepDefinition {
  seq: number;
  stage: 1 | 2 | 3 | 4;
  stageName: string;
  title: string;
  goal: string;
  minutes: number;
  maxPoints: number;
  scoringModel: string;
  guidance: string;
  fields: IlabStepField[];
  simulation: 'none' | 'open-loop' | 'closed-loop';
  konlingHint: string | null;
}

const STAGE = {
  1: '场景建模',
  2: '系统分析',
  3: '校正设计',
  4: '拓展探究',
} as const;

const vesselOptions = ILAB_VESSEL_LIST.map((vessel) => ({
  value: vessel.id,
  label: `${vessel.name}（${vessel.scene}）`,
}));

function step(
  seq: number,
  stage: 1 | 2 | 3 | 4,
  title: string,
  goal: string,
  minutes: number,
  maxPoints: number,
  scoringModel: string,
  guidance: string,
  fields: IlabStepField[],
  simulation: IlabStepDefinition['simulation'] = 'none',
  konlingHint: string | null = null,
): IlabStepDefinition {
  return {
    seq,
    stage,
    stageName: STAGE[stage],
    title,
    goal,
    minutes,
    maxPoints,
    scoringModel,
    guidance,
    fields,
    simulation,
    konlingHint,
  };
}

export const ILAB_STEPS: IlabStepDefinition[] = [
  step(1, 1, '场景选择与参数读取', '选定任务场景，读取真实船型参数', 10, 2, '达成度自动赋分',
    '三艘船的主尺度和模型参数来自平台船型配置。选定后，右侧会显示刚读取的参数，后续步骤按这组读数评分。',
    [{ key: 'vesselId', label: '任务场景', kind: 'select', options: vesselOptions }]),
  step(2, 1, '模型参数初值设定', '设定 Nomoto 模型 K、T 初值，并接受合理性校核', 10, 2, 'AI辅助+达成度赋分',
    '有 Nomoto 读数的船型：K、T 与读取值相差不超过 15% 得满分，不超过 30% 得一半。海洋石油981没有传统舵 Nomoto 模型，请确认采用三自由度动力定位模型。配置了模型服务时，本步会追加一次方案校核，并计入 ai_data。',
    [
      { key: 'K', label: '转向增益 K', kind: 'number', step: 0.001 },
      { key: 'T', label: '时间常数 T', kind: 'number', unit: 's', min: 0 },
      { key: 'modelKind', label: '模型类型', kind: 'select', options: [
        { value: 'nomoto-1st', label: '一阶 Nomoto' },
        { value: 'semi-submersible-3dof', label: '半潜平台三自由度动力定位' },
      ] },
    ]),
  step(3, 1, '仿真模型搭建', '搭建船舶平面运动仿真模型结构', 15, 4, '达成度自动赋分',
    '航向船型勾选船体、执行器、运动学和扰动四块。海洋石油981用推力分配代替舵执行器。',
    [{ key: 'blocks', label: '模型结构', kind: 'checks', options: [
      { value: 'hull', label: '船体' },
      { value: 'actuator', label: '舵或吊舱执行器' },
      { value: 'thruster-allocation', label: '推力分配' },
      { value: 'kinematics', label: '平面运动学' },
      { value: 'disturbance', label: '环境扰动' },
    ] }]),
  step(4, 1, '舵机环节配置', '配置舵机伺服环节与舵角、舵速饱和', 10, 4, '达成度自动赋分',
    '055 的舵角上限是 35°、舵速上限是 5°/s。雪龙2号没有传统舵，回转速率按吊舱 12°/s 读取。海洋石油981没有舵，方位角速度按 15°/s 读取。',
    [
      { key: 'actuator', label: '执行器', kind: 'select', options: [
        { value: 'rudder', label: '传统舵' },
        { value: 'azipod', label: '吊舱' },
        { value: 'thruster', label: '全回转推进器' },
      ] },
      { key: 'maxRudderDeg', label: '舵角或等效转角上限', kind: 'number', unit: '°', min: 0, max: 90 },
      { key: 'maxRateDeg', label: '舵速或回转速率上限', kind: 'number', unit: '°/s', min: 0, max: 40 },
    ]),
  step(5, 1, '开环仿真实验', '施加指令并运行开环仿真', 10, 4, '达成度自动赋分',
    '有 Nomoto 参考模型的船型：稳态转艏角速度（°/s）应接近 K 乘以指令角（°）。请先运行仿真，再提交读数。海洋石油981改为记录环境力和位移漂移。',
    [
      { key: 'commandDeg', label: '开环指令角', kind: 'number', unit: '°', min: 0, max: 35 },
      { key: 'yawRateDeg', label: '稳态转艏角速度', kind: 'number', unit: '°/s' },
      { key: 'headingChangeDeg', label: '航向变化', kind: 'number', unit: '°' },
      { key: 'environmentForceKn', label: '环境力', kind: 'number', unit: 'kN', min: 0 },
      { key: 'driftM', label: '位移漂移', kind: 'number', unit: 'm' },
    ], 'open-loop'),
  step(6, 1, '模型校验修正', '对照船型读数修正模型参数', 15, 5, '达成度自动赋分',
    '把 K、T 修正到与读取值相差不超过 10%。海洋石油981改为核对排水量 55000 吨，并确认不用 Nomoto 舵模型。',
    [
      { key: 'correctedK', label: '修正后的 K', kind: 'number', step: 0.001 },
      { key: 'correctedT', label: '修正后的 T', kind: 'number', unit: 's', min: 0 },
      { key: 'displacementT', label: '排水量', kind: 'number', unit: 't', min: 0 },
    ]),
  step(7, 2, '时域响应实验', '阶跃操舵，测取超调量与调节时间', 10, 4, '达成度自动赋分',
    '航向船型的目标航向是 10°。海洋石油981改为目标位移 5 米。超调量不超过该船型指标，调节时间不超过指标的 1.5 倍。提交至少 10 个采样，评分按采样重新计算。',
    [
      { key: 'overshootPct', label: '超调量', kind: 'number', unit: '%', min: 0 },
      { key: 'settlingTimeS', label: '调节时间', kind: 'number', unit: 's', min: 0 },
    ], 'closed-loop'),
  step(8, 2, '参数稳定性考察', '改变 T 并记录稳定性观察', 10, 4, '达成度自动赋分',
    '一阶 Nomoto 的开环转艏极点在 -1/T。T 取正值时开环转艏模态稳定。请改用一个不同于读取值的正 T，并写下这个结论。',
    [
      { key: 'testedT', label: '考察用的 T', kind: 'number', unit: 's', min: 0 },
      { key: 'conclusion', label: '稳定性结论', kind: 'select', options: [
        { value: 'open-loop-stable-for-positive-T', label: 'T 为正时，开环转艏模态稳定' },
        { value: 'open-loop-unstable', label: '开环转艏模态不稳定' },
      ] },
    ], 'none', '学生正在比较时间常数 T 对开环稳定性的影响。只根据服务端船型读数说明 -1/T，不要替学生填结论。'),
  step(9, 2, '根轨迹分析', '确定比例增益的稳定区间', 15, 4, '达成度自动赋分',
    '给出你采用的比例增益稳定区间。区间需要包含该船型默认比例增益的 0.4 倍到 1.8 倍，并且上界不超过默认增益的 4 倍。',
    [
      { key: 'gainLow', label: '增益下界', kind: 'number', min: 0 },
      { key: 'gainHigh', label: '增益上界', kind: 'number', min: 0 },
    ]),
  step(10, 2, 'Nyquist图绘制与评估', '判断奈奎斯特曲线是否包围负一实点', 15, 5, 'AI评估+达成度赋分',
    '按当前船型的默认校正，闭环应稳定，曲线不包围 -1。用至少 8 个字说明判断，并在手绘区画出奈奎斯特图。空白、画成其他图，或图像识别失败时，这一步不能通过。',
    [
      { key: 'nyquist', label: '曲线与 -1 的关系', kind: 'select', options: [
        { value: 'does-not-encircle', label: '不包围负一实点' },
        { value: 'encircles', label: '包围负一实点' },
      ] },
      { key: 'note', label: '判断说明', kind: 'text' },
    ]),
  step(11, 2, 'Bode图与裕度计算', '计算相位裕度与幅值裕度', 10, 5, 'AI评估+达成度赋分',
    '相位裕度填写 30° 到 80°，幅值裕度填写 6 dB 到 40 dB，视为达到本实验指标。同时在手绘区画出伯德图。空白、画成其他图，或图像识别失败时，这一步不能通过。',
    [
      { key: 'phaseMarginDeg', label: '相位裕度', kind: 'number', unit: '°' },
      { key: 'gainMarginDb', label: '幅值裕度', kind: 'number', unit: 'dB' },
    ]),
  step(12, 2, '稳定性结论归纳', '归纳稳定性结论', 10, 4, '达成度自动赋分',
    '用自己的话归纳。文本至少 12 个字，并同时提到“稳定”以及“裕度”或“极点”。',
    [{ key: 'conclusion', label: '稳定性结论', kind: 'text' }],
    'none', '学生正在归纳稳定性结论。追问依据，不要直接给出满分结论。'),
  step(13, 3, '校正方案设计', '提出 PID 或校正方案', 15, 5, 'AI评审+达成度赋分',
    '选择 PID、超前或滞后-超前校正，并用至少 8 个字说明理由。',
    [
      { key: 'scheme', label: '校正方案', kind: 'select', options: [
        { value: 'pid', label: 'PID' },
        { value: 'lead', label: '超前校正' },
        { value: 'lag-lead', label: '滞后-超前校正' },
      ] },
      { key: 'reason', label: '方案理由', kind: 'text' },
    ]),
  step(14, 3, 'PID参数整定', '整定 PID 并运行闭环仿真', 15, 5, '达成度自动赋分',
    '三项增益与该船型默认值相差不超过 50%，同时闭环超调满足船型指标。航向船型请运行闭环仿真后再提交。海洋石油981整定的是纵荡通道默认增益。',
    [
      { key: 'kp', label: 'Kp', kind: 'number' },
      { key: 'ki', label: 'Ki', kind: 'number' },
      { key: 'kd', label: 'Kd', kind: 'number' },
      { key: 'overshootPct', label: '闭环超调量', kind: 'number', unit: '%', min: 0 },
      { key: 'settlingTimeS', label: '调节时间', kind: 'number', unit: 's', min: 0 },
    ], 'closed-loop'),
  step(15, 3, '频域校正设计', '完成串联校正并核对裕度', 15, 5, '达成度自动赋分',
    '选择超前或滞后-超前校正，校正后相位裕度不低于 40°。',
    [
      { key: 'compensatorType', label: '串联校正', kind: 'select', options: [
        { value: 'lead', label: '超前校正' },
        { value: 'lag-lead', label: '滞后-超前校正' },
      ] },
      { key: 'phaseMarginDeg', label: '校正后相位裕度', kind: 'number', unit: '°' },
    ]),
  step(16, 3, '多目标权衡优化', '在航向精度与执行器负担之间权衡', 15, 4, '达成度自动赋分',
    '航向误差不超过船型允差，执行器出力占上限的 10% 到 80%。不要把舵打满，也不要把控制关掉。',
    [
      { key: 'headingErrorDeg', label: '航向误差', kind: 'number', unit: '°', min: 0 },
      { key: 'effortPct', label: '执行器出力', kind: 'number', unit: '%', min: 0, max: 100 },
    ], 'none', '学生正在权衡航向精度和执行器负担。帮助比较两个指标，不要直接给一组参数。'),
  step(17, 3, '高海况鲁棒性测试', '把海况提高到 5 级及以上并记录航向误差', 15, 4, '达成度自动赋分',
    '海况至少 5 级。航向误差不超过船型允差的 2 倍。本页曲线仍由现有航向模型推进，不另建海浪积分器。',
    [
      { key: 'seaState', label: '海况等级', kind: 'number', min: 0, max: 9 },
      { key: 'headingErrorDeg', label: '高海况航向误差', kind: 'number', unit: '°', min: 0 },
    ]),
  step(18, 3, '竞技场挑战', '用公开参考指标衡量航向误差', 20, 4, '对照公开参考指标赋分',
    '本步对照该船型已经发布的航向允差，不读取其他学生的成绩，也不生成名次。误差不超过允差得满分。',
    [{ key: 'challengeErrorDeg', label: '挑战航向误差', kind: 'number', unit: '°', min: 0 }]),
  step(19, 4, '动力定位任务设定', '设定目标船位与环境力条件', 10, 4, '达成度自动赋分',
    '本阶段改用海洋石油981的作业限制：目标船位偏离不超过 50 米，海流不超过 1.5 m/s，风速不超过 25 m/s。',
    [
      { key: 'targetNorthM', label: '目标北向位置', kind: 'number', unit: 'm' },
      { key: 'targetEastM', label: '目标东向位置', kind: 'number', unit: 'm' },
      { key: 'currentSpeedMps', label: '海流', kind: 'number', unit: 'm/s', min: 0 },
      { key: 'windSpeedMps', label: '风速', kind: 'number', unit: 'm/s', min: 0 },
    ]),
  step(20, 4, '前馈与估计配置', '配置环境力前馈与状态估计', 10, 4, '达成度自动赋分',
    '打开前馈，选择观测器或卡尔曼估计，预计定位误差不超过 1 米。',
    [
      { key: 'feedforward', label: '环境力前馈', kind: 'select', options: [
        { value: 'on', label: '启用' },
        { value: 'off', label: '关闭' },
      ] },
      { key: 'estimator', label: '状态估计', kind: 'select', options: [
        { value: 'observer', label: '状态观测器' },
        { value: 'kalman', label: '卡尔曼估计' },
      ] },
      { key: 'predictedErrorM', label: '预计定位误差', kind: 'number', unit: 'm', min: 0 },
    ]),
  step(21, 4, '传感器故障注入', '注入一种传感器故障并判断现象', 10, 4, '达成度自动赋分',
    '定位传感器故障对应位置漂移，航向传感器故障对应航向漂移，风速传感器故障仍表现为位置漂移。',
    [
      { key: 'fault', label: '故障', kind: 'select', options: [
        { value: 'gps', label: '定位传感器' },
        { value: 'gyro', label: '航向传感器' },
        { value: 'wind-sensor', label: '风速传感器' },
      ] },
      { key: 'observation', label: '观察到的现象', kind: 'select', options: [
        { value: 'position-drift', label: '位置漂移' },
        { value: 'heading-drift', label: '航向漂移' },
      ] },
    ]),
  step(22, 4, 'Fail-Safe策略设计', '选择并核对失效安全策略', 15, 4, '达成度自动赋分',
    '安全保持时残余偏差不超过 5 米；紧急解脱时不超过 10 米；推力再分配时不超过 5 米。这些阈值来自海洋石油981的告警读数。',
    [
      { key: 'strategy', label: '失效安全策略', kind: 'select', options: [
        { value: 'safe-hold', label: '安全保持' },
        { value: 'emergency-disconnect', label: '紧急解脱' },
        { value: 'thrust-reallocation', label: '推力再分配' },
      ] },
      { key: 'residualErrorM', label: '残余偏差', kind: 'number', unit: 'm', min: 0 },
    ]),
  step(23, 4, '小组答辩互评', '提交答辩反思，分数等待教师与互评', 20, 6, '教师评价+互评',
    '写下至少 20 个字的答辩要点。平台只记录这份反思，不代填教师分数，也不生成互评分数。',
    [{ key: 'reflection', label: '答辩反思', kind: 'text' }]),
  step(24, 4, '实验报告提交', '生成实验报告并完成反思', 30, 10, 'AI评阅+教师复核',
    '完成前 23 步后提交。系统生成报告。反思至少 20 个字。模型评阅只在真实调用成功时写入 ai_data；教师复核未完成时，报告里会明确写出这一点。',
    [{ key: 'reflection', label: '报告反思', kind: 'text' }]),
];

export const ILAB_STEP_BY_SEQ = new Map(ILAB_STEPS.map((item) => [item.seq, item]));

export const ILAB_MAX_POINTS = ILAB_STEPS.reduce((sum, item) => sum + item.maxPoints, 0);

export const ILAB_EXPERIMENT_TITLE = '船舶智能航行与动力定位控制';

export function expectTimeSeconds(seq: number): number {
  return (ILAB_STEP_BY_SEQ.get(seq)?.minutes ?? 1) * 60;
}

export function vesselChoices(): IlabVesselId[] {
  return ILAB_VESSEL_LIST.map((vessel) => vessel.id);
}
