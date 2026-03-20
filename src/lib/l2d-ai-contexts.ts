/**
 * L2D课程各步骤AI上下文配置
 *
 * 每个步骤的AI上下文配置，包含主题、学习目标、核心概念等
 * 用于全局AI助手框架动态读取当前步骤的上下文
 */

import type { AIContextConfig } from '@/types/ai-context';

/**
 * L2D课程元信息
 */
export const L2D_COURSE_META = {
  courseId: 'l2d-three-domain-linkage-practice',
  courseTitle: 'L-2d：三域联动探索 · 平台操作初体验',
  courseDescription:
    '围绕固定三阶系统 G(s)=K/[s(s+1)(s+6)]，在根轨迹、时域和频域三张图中同步拨动增益 K，完成临界增益定位、三域对照表与反思写作。',
  systemSpec: {
    transferFunction: 'G(s)=K/[s(s+1)(s+6)]',
    openLoopPoles: [0, -1, -6],
    criticalGain: 42,
  },
} as const;

/**
 * L2D各步骤AI上下文配置映射
 * key: stepId, value: AIContextConfig
 */
export const L2D_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  // Step 01: Bridge-in - 课程定位
  'step-01': {
    enabled: true,
    courseId: L2D_COURSE_META.courseId,
    courseTitle: L2D_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-01',
    topic: '图谱定位：我们在哪里',
    learningObjectives: [
      '理解L-2d课程在层0知识结构中的位置',
      '回顾L-2a/L-2b/L-2c三节课的核心内容',
      '建立三域联动的整体认知框架',
    ],
    knowledgeType: 'C',
    tools: ['get_lesson_overview', 'explain_concept'],
    quickQuestions: [
      { label: '层0地图', question: '层0包含哪些课程？它们之间的关系是什么？' },
      { label: '三域联动', question: '什么是三域联动？' },
      { label: '本节定位', question: 'L-2d这节课在整个课程体系中处于什么位置？' },
    ],
    systemPromptExtension:
      '当前是课程导入环节，重点是帮助学生理解本课在层0知识结构中的位置。强调L-2a（时域直觉）、L-2b（根轨迹直觉）、L-2c（频域直觉）与本课L-2d（三域联动操作体验）的递进关系。',
  },

  // Step 02: Bridge-in - 研究对象介绍
  'step-02': {
    enabled: true,
    courseId: L2D_COURSE_META.courseId,
    courseTitle: L2D_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-02',
    topic: '今天的研究对象：G(s)=K/[s(s+1)(s+6)]',
    learningObjectives: [
      '理解所选三阶系统的结构特点',
      '认识三个开环极点的分布',
      '理解增益K作为唯一操作变量的意义',
    ],
    knowledgeType: 'C',
    tools: ['explain_transfer_function', 'analyze_poles'],
    quickQuestions: [
      { label: '系统结构', question: '为什么选用G(s)=K/[s(s+1)(s+6)]这个系统？' },
      { label: '开环极点', question: '这个系统的开环极点在哪里？' },
      { label: '工程背景', question: '这个系统在实际工程中有什么应用背景？' },
    ],
    systemPromptExtension:
      '当前环节介绍研究对象：传递函数G(s)=K/[s(s+1)(s+6)]。强调三个开环极点（0, -1, -6）的分布特点，以及为何选择无零点的纯净结构来观察"极点↔三域"的因果链。可以联系舵机动力学、航向积分、传感器滤波等工程背景。',
  },

  // Step 03: Objective - 学习目标
  'step-03': {
    enabled: true,
    courseId: L2D_COURSE_META.courseId,
    courseTitle: L2D_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-03',
    topic: '今日目标与评分规则',
    learningObjectives: [
      '识别根轨迹上的稳定与不稳定区域',
      '判断K增大时Mp、ts和γ的联动方向',
      '记录典型K值下的三域指标，形成个人对照表',
      '发现至少一个让自己意外的三域联动现象',
    ],
    knowledgeType: 'D',
    tools: ['explain_objectives', 'provide_guidance'],
    quickQuestions: [
      { label: '学习目标', question: '这节课的学习目标是什么？' },
      { label: '评分规则', question: '这节课的评分结构是怎样的？' },
      { label: '提交策略', question: '为什么说这节课鼓励先提交再修正？' },
    ],
    systemPromptExtension:
      '当前环节明确学习目标和评分规则。四项核心目标：识别稳定边界、建立三域对照关系、记录个人数据表、发现意外现象。评分结构：任务一30分（临界K值）+ 任务二40分（对照表）+ 任务三30分（反思），任务一和任务二可重做取最高分。强调即时反馈与可重提的学习策略。',
  },

  // Step 04: Pre-assessment - 前测
  'step-04': {
    enabled: true,
    courseId: L2D_COURSE_META.courseId,
    courseTitle: L2D_COURSE_META.courseTitle,
    pageType: 'quiz',
    stepId: 'step-04',
    topic: '前测：你的直觉预测',
    learningObjectives: [
      '检验对根轨迹极点移动方向的直觉',
      '检验对K增大时超调量变化的直觉',
      '检验对Bode图变化的直觉',
    ],
    knowledgeType: 'C',
    tools: ['check_answer', 'explain_concept'],
    quickQuestions: [
      { label: '前测目的', question: '前测的目的是什么？' },
      { label: '答题提示', question: '前测需要计算吗？' },
    ],
    systemPromptExtension:
      '当前是前测环节，三道选择题不计分，只作为操作前后的认知对照。题目涉及：1)K增大时根轨迹极点移动方向；2)K增大时超调量Mp变化；3)K增大时Bode图变化。鼓励学生凭直觉作答，不要过度计算。',
  },

  // Step 05: Participatory - 工作区引入
  'step-05': {
    enabled: true,
    courseId: L2D_COURSE_META.courseId,
    courseTitle: L2D_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'step-05',
    topic: '操作引入：认识三域联动工作区',
    learningObjectives: [
      '熟悉三面板工作区的布局',
      '掌握根轨迹拖动和K滑块两种操作方式',
      '观察K变化时三图的同步响应',
    ],
    knowledgeType: 'X',
    tools: ['get_workspace_guide', 'explain_interaction'],
    quickQuestions: [
      { label: '工作区布局', question: '三域联动工作区的三个面板分别显示什么？' },
      { label: '操作方式', question: '如何调节K值？有几种方式？' },
      { label: '演示建议', question: '应该如何探索这个工作区？' },
    ],
    systemPromptExtension:
      '当前环节是三域联动工作区的操作引入。工作区布局：左侧面板显示根轨迹和当前闭环极点（蓝点），右上面板显示阶跃响应曲线（标注Mp和ts），右下面板显示Bode图（标注相位裕度γ）。学生可以通过拖动根轨迹上的蓝点或使用K滑块来调节增益，两种方式完全等价。建议先调K=5观察方向，再调K=20感受变化速度。',
  },

  // Step 06: Participatory - 任务一说明
  'step-06': {
    enabled: true,
    courseId: L2D_COURSE_META.courseId,
    courseTitle: L2D_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-06',
    topic: '任务一说明：找到稳定边界',
    learningObjectives: [
      '理解临界增益的工程意义',
      '掌握三种判断稳定边界的方法',
      '明确任务一的评分标准',
    ],
    knowledgeType: 'X',
    tools: ['explain_task', 'provide_hints'],
    quickQuestions: [
      { label: '任务目标', question: '任务一的目标是什么？' },
      { label: '判断方法', question: '如何判断系统刚好失稳？' },
      { label: '评分标准', question: '任务一的评分标准是什么？' },
    ],
    systemPromptExtension:
      '当前环节介绍任务一：找到使系统从稳定变为不稳定的临界增益K。三种判断方法：1)根轨迹观察共轭极点实部从负变正的瞬间；2)时域观察响应从收敛变为等幅/发散振荡；3)频域观察相位裕度γ趋近0°。理论临界值Kcr=42，按[36,48]得满分、[28,36)∪(48,56]得部分分。',
  },

  // Step 07: Participatory - 任务一执行
  'step-07': {
    enabled: true,
    courseId: L2D_COURSE_META.courseId,
    courseTitle: L2D_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'step-07',
    topic: '任务一：找到稳定边界（实践）',
    learningObjectives: [
      '通过实践操作找到临界增益K',
      '观察极点到达虚轴时的三域表现',
      '理解等幅振荡与γ≈0°的对应关系',
    ],
    knowledgeType: 'X',
    tools: ['get_simulation_status', 'analyze_design', 'provide_hints'],
    quickQuestions: [
      { label: '操作技巧', question: '如何精确找到临界K值？' },
      { label: '失稳迹象', question: '系统失稳时有哪些现象？' },
      { label: '重新提交', question: '如果对结果不满意可以重新提交吗？' },
    ],
    systemPromptExtension:
      '当前是任务一实践环节，学生需要在工作区中缓慢增大K，找到系统刚好失稳的临界点。关键观察点：极点实部趋近于0、时域出现等幅振荡、相位裕度γ趋近于0°。理论临界值是Kcr=42。鼓励学生多次尝试，系统保留最高分。可以引导学生注意：当极点到达虚轴时，根轨迹、时域响应、Bode图会同时给出一致的失稳信号。',
  },

  // Step 08: Participatory - 任务一汇总
  'step-08': {
    enabled: true,
    courseId: L2D_COURSE_META.courseId,
    courseTitle: L2D_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-08',
    topic: '任务一汇总：理论与实验的对照',
    learningObjectives: [
      '理解临界增益Kcr=42的理论推导',
      '对比全班实验值与理论值的偏差',
      '建立劳斯判据与根轨迹的初步联系',
    ],
    knowledgeType: 'C',
    tools: ['explain_theory', 'analyze_result'],
    quickQuestions: [
      { label: '理论推导', question: '为什么临界增益恰好是42？' },
      { label: '劳斯判据', question: '如何用劳斯判据验证临界值？' },
      { label: '误差分析', question: '实验值与理论值为什么会有偏差？' },
    ],
    systemPromptExtension:
      '当前环节汇总任务一结果，揭示理论临界值Kcr=42的推导过程。特征方程s³+7s²+6s+K=0，通过劳斯表条件7×6-K=0得到Kcr=42。强调实验值与理论值的对比，为后续单元2-1的劳斯判据学习做铺垫。引导学生理解：根轨迹上的临界点、时域的等幅振荡、频域的零相位裕度，三者在物理上是同一现象的不同表征。',
  },

  // Step 09: Participatory - 任务二说明
  'step-09': {
    enabled: true,
    courseId: L2D_COURSE_META.courseId,
    courseTitle: L2D_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-09',
    topic: '任务二说明：建立三域对照表',
    learningObjectives: [
      '理解三域对照表的结构和用途',
      '掌握数据读取和记录的方法',
      '明确任务二的评分标准',
    ],
    knowledgeType: 'X',
    tools: ['explain_task', 'provide_guidance'],
    quickQuestions: [
      { label: '对照表结构', question: '三域对照表需要填写哪些数据？' },
      { label: 'K值选择', question: '应该选择哪些K值进行记录？' },
      { label: '评分标准', question: '任务二的评分标准是什么？' },
    ],
    systemPromptExtension:
      '当前环节介绍任务二：在稳定范围内（K<42）选取4个K值，建立三域对照表。每行需记录：K值、闭环极点σ和ω、时域指标Mp和ts、频域指标γ。推荐选取差距明显的K值如1/5/15/35。评分标准：每行10分，其中极点与ts一致性4分、极点与Mp一致性4分、Mp与γ方向一致性2分。强调对照表检验的是内部一致性，而非"抄标准答案"。',
  },

  // Step 10: Participatory - 任务二执行
  'step-10': {
    enabled: true,
    courseId: L2D_COURSE_META.courseId,
    courseTitle: L2D_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'step-10',
    topic: '任务二：建立三域对照表（实践）',
    learningObjectives: [
      '准确读取根轨迹、时域、频域的指标',
      '理解极点位置与时域响应的对应关系',
      '理解极点位置与频域指标的对应关系',
    ],
    knowledgeType: 'X',
    tools: ['get_workspace_status', 'analyze_design', 'provide_hints'],
    quickQuestions: [
      { label: '数据读取', question: '如何准确读取面板上的数据？' },
      { label: '一致性检查', question: '如何判断数据是否一致？' },
      { label: 'K与Mp关系', question: 'K增大时Mp如何变化？为什么？' },
    ],
    systemPromptExtension:
      '当前是任务二实践环节，学生需要在工作区中选取4个K值，逐行填写三域对照表。核心观察：K增大→极点右移（实部绝对值减小）→阻尼比减小→Mp增大、ts可能增大→相位裕度γ减小。可以引导学生发现：σ（极点实部）与ts成反比、ζ（阻尼比）与Mp正相关、Mp与γ反相关。每行独立评分，允许重填取最高分。',
  },

  // Step 11: Participatory - 任务三探索
  'step-11': {
    enabled: true,
    courseId: L2D_COURSE_META.courseId,
    courseTitle: L2D_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'step-11',
    topic: '任务三：自由探索',
    learningObjectives: [
      '自主探索K变化时的三域现象',
      '发现常规任务之外的有趣现象',
      '为反思环节积累观察素材',
    ],
    knowledgeType: 'D',
    tools: ['get_workspace_status', 'provide_guidance'],
    quickQuestions: [
      { label: '探索方向', question: '有哪些值得探索的方向？' },
      { label: '对比分析', question: 'K很小和K接近临界时有什么区别？' },
      { label: 'Bode图问题', question: '为什么K变化时幅频整体上移而相频几乎不动？' },
    ],
    systemPromptExtension:
      '当前是自由探索环节，学生可以无约束地拨动K值，观察三域联动现象。推荐探索方向：1)对比K很小时与K接近临界时的三域差异；2)观察根轨迹上是否有意外的转折点；3)理解为什么K变化时幅频整体上移而相频曲线几乎不动（因为K只影响增益，不影响相位）。鼓励学生记录任何让自己意外的现象，为下一页的反思做准备。',
  },

  // Step 12: Participatory - 任务三反思
  'step-12': {
    enabled: true,
    courseId: L2D_COURSE_META.courseId,
    courseTitle: L2D_COURSE_META.courseTitle,
    pageType: 'reflection',
    stepId: 'step-12',
    topic: '任务三：发现与反思',
    learningObjectives: [
      '用自己的语言描述观察到的现象',
      '尝试解释现象背后的原理',
      '建立个人对三域联动的深度理解',
    ],
    knowledgeType: 'D',
    tools: ['provide_guidance', 'explain_concept'],
    quickQuestions: [
      { label: '反思要点', question: '反思部分需要写什么？' },
      { label: '现象描述', question: '如何描述一个观察到的现象？' },
      { label: 'Mp与γ关系', question: '如何用一句话总结Mp与γ的关系？' },
    ],
    systemPromptExtension:
      '当前是反思环节，学生需要描述一个观察到的现象并给出解释。必答：描述现象（至少一句话，20分）。选答A：总结Mp与γ的关系（10分）。选答B：用对照表数据验证γ≈100ζ°是否近似成立（10分）。鼓励学生用自己的语言，不需要追求"标准答案"。可以引导深入理解：阻尼比ζ、超调量Mp、相位裕度γ三者之间的近似关系，以及它们如何统一描述系统的相对稳定性。',
  },

  // Step 13: Post-assessment - 后测
  'step-13': {
    enabled: true,
    courseId: L2D_COURSE_META.courseId,
    courseTitle: L2D_COURSE_META.courseTitle,
    pageType: 'quiz',
    stepId: 'step-13',
    topic: '后测：对照表能告诉我们什么',
    learningObjectives: [
      '运用对照表数据推断性能约束',
      '将"记录"提升为"设计决策"',
      '为L-sum课程做预热',
    ],
    knowledgeType: 'X',
    tools: ['check_answer', 'provide_guidance'],
    quickQuestions: [
      { label: '后测目的', question: '后测与前测有什么不同？' },
      { label: '性能约束', question: '如何让Mp<20%？需要查找哪个K值区间？' },
      { label: '设计视角', question: '从分析到设计的切换是什么意思？' },
    ],
    systemPromptExtension:
      '当前是后测环节，题目要求根据今天建立的对照表，填写一个能让Mp<20%的K值区间。本题不计分，只作为下节课L-sum的预习起点。目的是把对照表从"记录"变成"推断工具"，实现从分析（给定K看性能）到设计（给定性能找K）的视角切换。这是L-sum"设计可行域"课程的预热。',
  },

  // Step 14: Summary - 总结
  'step-14': {
    enabled: true,
    courseId: L2D_COURSE_META.courseId,
    courseTitle: L2D_COURSE_META.courseTitle,
    pageType: 'summary',
    stepId: 'step-14',
    topic: '总结：三域地图初探',
    learningObjectives: [
      '收束三域联动的核心发现',
      '建立K增大时的变化链条',
      '连接下一课L-sum的设计可行域',
    ],
    knowledgeType: 'C',
    tools: ['summarize_lesson', 'preview_next'],
    quickQuestions: [
      { label: '核心发现', question: '今天最核心的发现是什么？' },
      { label: '变化链条', question: 'K增大时三域如何联动变化？' },
      { label: '下节预告', question: 'L-sum课程会讲什么？' },
    ],
    systemPromptExtension:
      '当前是总结环节，核心收束：K增大→极点右移（实部绝对值减小）→阻尼比减小→Mp增大、ts可能变化→相位裕度γ减小→直到K=42时极点到虚轴、等幅振荡、γ=0°。强调今天的收获不是孤立数值，而是一张可以继续扩展的"三域地图"。下节课L-sum将在地图上画出约束边界：同时满足Mp<20%且ts<8s的极点应该落在哪里？',
  },
};

/**
 * 获取指定步骤的AI上下文配置
 */
export function getL2DStepAIContext(stepId: string): AIContextConfig | null {
  return L2D_STEP_AI_CONTEXTS[stepId] || null;
}

/**
 * 获取当前步骤的快捷问题列表
 */
export function getL2DStepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  const context = L2D_STEP_AI_CONTEXTS[stepId];
  return context?.quickQuestions || [];
}
