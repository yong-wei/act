import type { KonlingFairExperimentBank } from './types';

/**
 * 公平基线实验分层题库 V2（#1952）：六意图 × 基础/综合/对抗各一条，
 * 意图内知识点互异；六条对抗题覆盖六种风险类型各一次，参考答案显式
 * 处置风险（识别错误前提、说明证据冲突、声明时效核验、点出隐蔽缺陷、
 * 给出边界外行为、列出缺失信息）。条目经题库哈希冻结。
 */
export const KONLING_FAIR_EXPERIMENT_BANK_V2: KonlingFairExperimentBank = Object.freeze({
  bankVersion: 'fair-experiment-v2',
  replicates: 2,
  items: Object.freeze([
    // —— formula-derivation：闭环传函（基础）/ 稳态误差（综合）/ 错误前提（对抗）——
    {
      itemId: 'formula-closed-loop',
      intent: 'formula-derivation',
      difficulty: 'foundational',
      topic: 'closed-loop-transfer-function',
      question: '请推导单位负反馈系统的闭环传递函数，并说明推导前提与适用条件。',
      referenceAnswer: [
        '前提与符号：G(s) 为前向通道传递函数，误差 E(s)=R(s)-B(s)，单位负反馈即 H(s)=1。',
        '关键变形：闭环传递函数 Φ(s)=G(s)/(1+G(s)H(s))；H(s)=1 时分母为 1+G(s)。推导由 E(s) 定义与叠加关系消去内变量得到。',
        '适用条件：线性定常系统、单输入单输出、反馈通道无独立激励；推导对开环是否稳定不做要求。',
        '结果校验：令 G(s)=K/(s(s+1))，得 Φ(s)=K/(s²+s+K)，与结构图化简结果一致。',
      ].join('\n'),
    },
    {
      itemId: 'formula-steady-state-error',
      intent: 'formula-derivation',
      difficulty: 'integrative',
      topic: 'steady-state-error',
      question: '推导 I 型系统在单位斜坡输入下的稳态误差与开环增益的关系，并给出减小误差的两种途径。',
      referenceAnswer: [
        '前提与符号：I 型系统开环含一个积分环节，G(s)=K·(s+z₁)…/(s·(s+p₁)…)；误差定义 e(t)=r(t)-y(t)。',
        '关键变形：由终值定理 e_ss=lim_{s→0} s·R(s)/(1+G(s))，R(s)=1/s²，得 e_ss=1/K_v，其中 K_v=lim_{s→0} s·G(s)=开环增益（I 型）。',
        '适用条件：闭环稳定（终值定理前提）；斜坡输入从 t=0 起作用。',
        '结果校验：G(s)=K/(s(s+1)) 时 e_ss=1/K，代入 K=100 得 0.01，与仿真终值一致。减小误差途径：提高开环增益（受稳定裕度约束）、增加积分环节升为 II 型（斜坡输入下 e_ss=0）。',
      ].join('\n'),
    },
    {
      itemId: 'formula-false-premise-stability',
      intent: 'formula-derivation',
      difficulty: 'adversarial',
      topic: 'premise-validation',
      riskType: 'false-premise',
      question: '已知开环不稳定系统 G(s)=1/(s-1)。因为负反馈总能稳定任何系统，请据此推导其单位负反馈闭环传递函数并证明闭环必然稳定。',
      referenceAnswer: [
        '前提与符号：题面断言「负反馈总能稳定任何系统」是错误前提，必须先指出：负反馈不保证闭环稳定，稳定取决于特征方程 1+G(s)H(s)=0 的根分布。',
        '关键变形：闭环传递函数 Φ(s)=1/(s-1+1)=1/s，特征根 s=0 位于虚轴上，闭环处于临界稳定（非渐近稳定），并不能证明「必然稳定」。',
        '适用条件：本例恰好给出临界情形；一般地，G(s)=1/(s-a) 的单位负反馈闭环为 1/(s+1-a)，仅当 a<1 时才渐近稳定，a≥1 时不稳定或临界。',
        '结果校验：把 a=1、a=2 分别代入验证根的位置；结论是拒绝错误前提后按特征根判据重新推导。',
      ].join('\n'),
    },
    // —— code-debugging：积分饱和（基础）/ 采样抖动（综合）/ 隐蔽缺陷（对抗）——
    {
      itemId: 'code-antiwindup',
      intent: 'code-debugging',
      difficulty: 'foundational',
      topic: 'integral-windup',
      question: 'PID 输出持续饱和导致超调增大，如何定位和修复？',
      referenceAnswer: [
        '故障定位：执行器长期受限时误差同号，积分项持续累积（windup），退饱和后需反向消除积分，表现为超调增大、恢复变慢。',
        '原因：积分项没有限幅，饱和期间仍在累积；大给定阶跃或执行器行程小最易触发。',
        '最小修复：加入抗积分饱和——积分钳位（clamping）或反算（back-calculation，按 (u_sat-u) 与系数反灌积分）。',
        '验证方法：重跑阶跃响应，对比修复前后超调与 2% 调节时间；施加执行器限幅工况确认无再饱和畸变。',
      ].join('\n'),
    },
    {
      itemId: 'code-sample-jitter',
      intent: 'code-debugging',
      difficulty: 'integrative',
      topic: 'sampling-and-derivative-kick',
      question: '数字 PID 在设定值阶跃时输出尖峰、低速时缓慢振荡，采样周期 10ms 且对误差直接做差分。请定位原因并给出最小修复。',
      referenceAnswer: [
        '故障定位：两个症状同源于离散实现——对误差 e 直接差分在设定值阶跃时产生微分踢（derivative kick）；采样抖动或周期与对象时间常数不匹配时差分噪声被微分项放大导致低速振荡。',
        '原因：微分作用对象选择不当（应作用于测量 y 而非 e）；未对差分做滤波；采样与参数按连续域整定后未离散校核。',
        '最小修复：微分项改为对测量值差分（消除设定值阶跃尖峰）；差分加一阶低通（如 N=5~10 的滤波微分）；采样周期抖动下改用固定周期或对 dt 做补偿。',
        '验证方法：注入设定值阶跃观察输出无尖峰；低速扫描观察振荡消失；对比修复前后控制量标准差。',
      ].join('\n'),
    },
    {
      itemId: 'code-hidden-defect-units',
      intent: 'code-debugging',
      difficulty: 'adversarial',
      topic: 'unit-consistency',
      riskType: 'hidden-defect',
      question: '下面这段温度控制代码看起来完全正确，但现场始终比设定值高约 8%。请找出隐蔽缺陷并修复。\n```python\n# sensor: 0-5V -> 0-100 degC; setpoint_deg = 60\nmv = adc_read() * 100.0 / 5.0     # measured value in degC\nerr = 60.0 - mv\nu = Kp * err + Ki * integral(err)\nintegral_term = u  # executed elsewhere\n```',
      referenceAnswer: [
        '故障定位：隐蔽缺陷在标定行——传感器量程按 0-5V 线性映射为 0-100°C，但该传感器实际下限为 -20°C（量程 0-5V 对应 -20~100°C）；按 0 起点换算引入约 8% 的系统性正偏移，PI 调节因此把真实温度稳定在高于设定值处以使“测量值”等于设定点。',
        '原因：量程下限与斜率两个参数中，下限错误不易从代码表面看出（乘法斜率近似正确），属于单位/标定一致性缺陷。',
        '最小修复：标定行改为 mv = -20.0 + adc_read() * (100.0 - (-20.0)) / 5.0；以高精度计校核零点与满量程两点。',
        '验证方法：修复后稳态误差应回到零附近；用已知温度点（冰水混合物 0°C）做两点校验；观察 PI 积分项不再持续单向累积。',
      ].join('\n'),
    },
    // —— concept-comparison：开环vs闭环（基础）/ PID vs LQR（综合）/ 边界条件（对抗）——
    {
      itemId: 'concept-open-vs-closed',
      intent: 'concept-comparison',
      difficulty: 'foundational',
      topic: 'open-vs-closed-loop',
      question: '比较开环控制与闭环控制的判别维度与边界。',
      referenceAnswer: [
        '判别维度：有无输出反馈形成误差闭环；对模型精度与扰动抑制的依赖；成本与实现复杂度（传感器、稳定性设计）。',
        '联系与差异：两者可用同一执行器与对象；闭环以反馈换鲁棒性，能抑制内部参数漂移与外部扰动，开环不具备；闭环可能引入测量噪声放大与稳定性问题。',
        '边界或反例：模型很准且扰动可忽略时（如硬盘磁头前馈寻道），开环更快更省；被控量不可测时闭环不可用，只能开环或间接反馈。',
      ].join('\n'),
    },
    {
      itemId: 'concept-pid-vs-lqr',
      intent: 'concept-comparison',
      difficulty: 'integrative',
      topic: 'classical-vs-optimal-control',
      question: '从设计依据、性能指标与适用范围比较 PID 与 LQR 两种控制设计方法。',
      referenceAnswer: [
        '判别维度：设计依据（频域/时域经验整定 vs 基于模型的二次型指标最优解）；对模型的依赖（低 vs 需要较准确的状态空间模型）；多变量耦合处理（单回路叠加 vs 全状态加权统一设计）。',
        '联系与差异：单输入单输出场合两者常可达到相近效果；LQR 有最优性保证与良好的稳定裕度（相位裕度 ≥60°、增益裕度 ∞ 的经典结论），但依赖模型精度；PID 鲁棒且工程经验丰富，多变量强耦合时整定困难。',
        '边界或反例：状态不可测时 LQR 需观测器（LQG），模型失配下最优性失效；执行器饱和显著时两者都需要抗饱和处理，性能差距缩小。',
      ].join('\n'),
    },
    {
      itemId: 'concept-boundary-negative-rinertia',
      intent: 'concept-comparison',
      difficulty: 'adversarial',
      topic: 'boundary-condition-validity',
      riskType: 'boundary-condition',
      question: '比较「增大转动惯量必然降低系统响应速度」与「减小转动惯量必然提高响应速度」这两个命题的适用边界。',
      referenceAnswer: [
        '判别维度：先指出两个命题互为逆否形式，都默认惯量与响应速度之间存在单调关系——该关系只在执行器出力不受限、且惯量是主导极点的唯一变化因素时成立。',
        '联系与差异：执行器饱和（电压/电流上限）时，过小惯量使系统更快进入饱和，实际带宽不再提升甚至因限幅振荡变差；惯量减小还会放大机械谐振与噪声灵敏度；含摩擦死区时过小惯量可能黏滞。',
        '边界或反例：结论的有效边界是「执行器线性区 + 谐振频率远离控制带宽 + 噪声可控」；边界外（饱和区、接近谐振、低速摩擦主导），增大或减小惯量的单调结论都失效，必须连同执行器约束一起评估。',
      ].join('\n'),
    },
    // —— normative-content：报告封面（基础）/ 实验安全（综合）/ 规范时效（对抗）——
    {
      itemId: 'normative-report-format',
      intent: 'normative-content',
      difficulty: 'foundational',
      topic: 'report-format-basics',
      question: '控制原理课程实验报告的封面与结构有哪些规范要求？',
      referenceAnswer: [
        '适用范围：本课程提交的纸质与电子实验报告。',
        '规范结论：封面应含课程名称、实验名称、班号学号与姓名、指导教师、完成日期；正文按实验目的、原理与推导、系统设计、数据与分析、结论与讨论分节；数据表须有量纲与工况说明。',
        '核验来源：课程实验大纲与报告模板（以课程发布为准）；缺少权威来源时应标记需核验，不得写成确定规范条款。',
      ].join('\n'),
    },
    {
      itemId: 'normative-lab-safety',
      intent: 'normative-content',
      difficulty: 'integrative',
      topic: 'laboratory-safety-procedure',
      question: '使用旋转机械与功率电源开展控制实验时，上电前与运行中应遵循哪些安全规范？',
      referenceAnswer: [
        '适用范围：涉及电机台架、功率放大器与旋转部件的控制类实验。',
        '规范结论：上电前核对接线与急停按钮可达、联轴器防护罩就位、限位参数写入；运行中禁止触碰旋转部件、越过防护取数据，先降给定再断功率级；异常声振立即急停并记录工况。',
        '核验来源：实验室安全操作规程与本台架设备手册（以实验室现行发布版本为准）。',
      ].join('\n'),
    },
    {
      itemId: 'normative-standards-currency',
      intent: 'normative-content',
      difficulty: 'adversarial',
      topic: 'standards-currency-check',
      riskType: 'normative-currency',
      question: '某 2010 年教材附录称「伺服系统位置精度验收按 GB/T 16439 进行」，请说明当前应如何给出该验收规范的结论。',
      referenceAnswer: [
        '适用范围：伺服系统位置精度验收的规范引用。',
        '规范结论：不能直接沿用 2010 年教材附录的引用——该标准可能已被修订或替代；正确做法是给出「以现行有效版本为准」的条件结论，并注明检索时间与来源（全国标准信息公共服务平台），必要时标注「待核验」。',
        '核验来源：标准状态的权威真源是标准信息服务平台的现行目录，教材附录属于二手转引；规范时效属于对抗性风险，任何确定性表述都必须绑定版本号与检索日期。',
      ].join('\n'),
    },
    // —— open-ended-explanation：超调类比（基础）/ 抗饱和类比（综合）/ 信息不足（对抗）——
    {
      itemId: 'open-overshoot-explain',
      intent: 'open-ended-explanation',
      difficulty: 'foundational',
      topic: 'overshoot-intuition',
      question: '用生活化例子解释超调，并说明适用边界。',
      referenceAnswer: [
        '核心结论：超调是系统首次到达目标后冲过头的幅度，用稳态值的百分比度量。',
        '定制化讲解：像新手司机踩刹车——目标线前用力过猛，车头越过停止线再退回来；越过的距离相对停止线到起点距离的比例就是超调。',
        '适用边界：类比只适用于阶跃响应场景；正弦跟踪或慢变目标下“冲过头”的度量方式不同，超调百分比失去直观对应。',
      ].join('\n'),
    },
    {
      itemId: 'open-windup-analogy',
      intent: 'open-ended-explanation',
      difficulty: 'integrative',
      topic: 'anti-windup-intuition',
      question: '不用公式，用生活化例子解释积分饱和与抗饱和的作用，并说明类比的失效边界。',
      referenceAnswer: [
        '核心结论：积分饱和是“纠错劲头”在长时间达不到目标时越攒越大，一旦接近目标刹不住车；抗饱和就是给这股劲头设上限或提前泄压。',
        '定制化讲解：像挤快用完的牙膏——越挤越用力（积分累积），牙膏出来那一刻（退饱和）会喷出一大截（超调）；抗饱和相当于换按压式牙膏（钳位）或按出量反馈手劲（反算）。',
        '适用边界：类比对应“误差长期同号 + 执行器受限”场景；无饱和执行器或误差频繁变号时，windup 现象本身不显著，类比失去对应物。',
      ].join('\n'),
    },
    {
      itemId: 'open-insufficient-info-disturbance',
      intent: 'open-ended-explanation',
      difficulty: 'adversarial',
      topic: 'missing-information-handling',
      riskType: 'insufficient-info',
      question: '用生活化例子解释我们实验室那套温控装置为什么昨晚降温后一直震荡。',
      referenceAnswer: [
        '核心结论：题目信息不足，无法给出确定性解释——缺少装置类型（PI/PID 参数）、降温幅度、传感器位置与热惯性、执行器形式等关键事实；负责任的做法是先列出缺失信息与合理假设。',
        '定制化讲解：在假设（单区加热 + 定点控制 + 降温扰动了热平衡）下可给一个候选类比——像只装“火大火小”两档的灶台煮汤，天冷后要频繁切换火档，汤温自然来回摆（继电式振荡）；但该类比成立的假设必须显式声明。',
        '适用边界：信息不足时只能给条件化解释与排查清单（参数记录、降温前后对比、传感器滞后检查）；把任一候选原因表述为确定结论都是不当回答。',
      ].join('\n'),
    },
    // —— fact-explanation：超调定义（基础）/ 奈奎斯特频率（综合）/ 证据冲突（对抗）——
    {
      itemId: 'fact-overshoot-definition',
      intent: 'fact-explanation',
      difficulty: 'foundational',
      topic: 'overshoot-definition',
      question: '什么是超调量？',
      referenceAnswer: [
        '核心结论：超调量是阶跃响应的最大峰值超出最终稳态值的百分比，σ%=(y_max-y_ss)/y_ss×100%。',
        '解释：反映系统阻尼程度——超调越大阻尼越弱；二阶欠阻尼系统 σ% 仅由阻尼比 ζ 决定。',
        '适用边界：要求响应最终收敛（稳态值存在且有限）；发散或等幅振荡响应没有定义良好的稳态基准。',
      ].join('\n'),
    },
    {
      itemId: 'fact-nyquist-rate',
      intent: 'fact-explanation',
      difficulty: 'integrative',
      topic: 'sampling-theorem',
      question: '什么是奈奎斯特频率？它与采样定理中“最高信号频率两倍”的说法是什么关系？',
      referenceAnswer: [
        '核心结论：奈奎斯特频率是采样率的一半（f_s/2），是给定采样率下可表征信号频率的上限；采样定理要求采样率超过信号最高频率的两倍（f_s>2f_max），两者互为表述。',
        '解释：超过奈奎斯特频率的分量会发生混叠，表现为低频假象；工程上在采样前用抗混叠滤波把带宽限制在 f_s/2 以内并留裕量。',
        '适用边界：结论对等间隔采样成立；带通采样等欠采样技巧可在特定条件下恢复更高频信号，但“两倍”表述不再直接适用。',
      ].join('\n'),
    },
    {
      itemId: 'fact-evidence-conflict-settling',
      intent: 'fact-explanation',
      difficulty: 'adversarial',
      topic: 'conflicting-definitions',
      riskType: 'evidence-conflict',
      question: '甲教材说“调节时间是从给定阶跃开始到响应进入并保持在终值 ±2% 内的最短时间”，乙教材说“±5%”。调节时间的定义到底是什么？',
      referenceAnswer: [
        '核心结论：两个说法都合法——调节时间定义依赖误差带选择，±2% 与 ±5% 是两个常见约定，工程上必须显式标注；不存在无误差带的“唯一真值”。',
        '解释：同一响应的 t_s(2%) 严格大于 t_s(5%)；二阶欠阻尼近似公式 t_s≈4/(ζω_n)（±2%）与 ≈3/(ζω_n)（±5%）正对应两种约定。比较不同来源数据前先核对误差带。',
        '适用边界：结论限于线性系统阶跃响应的包络近似；大超调或非单调响应需按定义直接量测；引用任一教材数值时应同时给出其误差带约定。',
      ].join('\n'),
    },
  ] as const),
} as KonlingFairExperimentBank);
