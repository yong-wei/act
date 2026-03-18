/**
 * L2B课程各步骤AI上下文配置
 *
 * 每个步骤的AI上下文配置，包含主题、学习目标、核心概念等
 * 用于全局AI助手框架动态读取当前步骤的上下文
 */

import type { AIContextConfig } from '@/types/ai-context';

/**
 * L2B课程元信息
 */
export const L2B_COURSE_META = {
  courseId: 'l2b-root-locus-fasttrack',
  courseTitle: 'L-2b：根轨迹直觉速通 · 极点迁移的几何感知',
  courseDescription:
    '围绕根轨迹直觉、增益-极点-响应联动、45°射线几何定位与双端同步课堂，构建从预测到验证到AI对比的完整学习链路。',
  keyConcepts: ['根轨迹', '极点迁移', '增益K', '45°射线', '阻尼比0.707', '稳定边界', '设计可行域'],
} as const;

/**
 * L2B各步骤AI上下文配置映射
 * key: stepId, value: AIContextConfig
 */
export const L2B_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  // Step 01: Bridge-in - 知识地图
  'knowledge-map': {
    enabled: true,
    courseId: L2B_COURSE_META.courseId,
    courseTitle: L2B_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'knowledge-map',
    topic: '知识地图：我们现在在这里',
    learningObjectives: [
      '确认L-2b在L-2a与L-2c之间的根轨迹节点位置',
      '理解"极点决定响应"到"调K看极点怎么走"的递进',
      '建立三域知识地图的整体认知',
    ],
    knowledgeType: 'C',
    tools: ['get_lesson_overview', 'explain_concept'],
    quickQuestions: [
      { label: '课程位置', question: 'L-2b在层0中处于什么位置？' },
      { label: '与L-2a关系', question: 'L-2b如何承接L-2a的时域直觉？' },
      { label: '与L-2c关系', question: 'L-2c会补足什么视角？' },
    ],
    systemPromptExtension:
      '当前是课程导入环节，用知识地图承接L-2a的"极点决定响应"并引出"调K看极点怎么走"。强调本节位于L-2a（时域）与L-2c（频域）之间的根轨迹节点，是理解"增益-极点-响应"联动的关键一课。',
  },

  // Step 02: Bridge-in - 场景问题
  'scenario-question': {
    enabled: true,
    courseId: L2B_COURSE_META.courseId,
    courseTitle: L2B_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'scenario-question',
    topic: '场景问题：极点不对，工程师怎么办？',
    learningObjectives: [
      '理解船舶控制中的"旋钮"问题',
      '建立"调开环增益→看闭环极点"的工程直觉',
      '为根轨迹学习建立需求背景',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'provide_guidance'],
    quickQuestions: [
      { label: '工程问题', question: '工程师面对极点不对能调什么？' },
      { label: '旋钮比喻', question: '"旋钮"指的是什么？' },
      { label: 'K直觉', question: '增大K会让系统更稳定还是更剧烈？' },
    ],
    systemPromptExtension:
      '当前环节通过船舶控制情景引出"旋钮"问题：某船右转10°后响应振荡剧烈，工程师有什么可调？引导学生思考开环增益K的作用，建立"调开环、看闭环"的初步直觉。记录学生的第一直觉，用于后续验证。',
  },

  // Step 03: Objective - 本节目标
  'lesson-goals': {
    enabled: true,
    courseId: L2B_COURSE_META.courseId,
    courseTitle: L2B_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'lesson-goals',
    topic: '本节目标：只建直觉，不做绘图法则推导',
    learningObjectives: [
      '解释极点随增益迁移的现象',
      '在根轨迹图上读出极点与响应关系',
      '用45°射线定位ζ=0.707对应的K值',
    ],
    knowledgeType: 'C',
    tools: ['explain_objectives', 'provide_guidance'],
    quickQuestions: [
      { label: '三项目标', question: '今天的三项目标是什么？' },
      { label: '学习边界', question: '今天不做什么？' },
      { label: '45°射线', question: '45°射线对应什么阻尼比？' },
    ],
    systemPromptExtension:
      '当前环节明确三条目标：1)解释极点迁移现象（根轨迹是什么）；2)在根轨迹图上读出极点与响应关系（怎么用）；3)用45°射线定位最佳阻尼比（几何技巧）。强调今天只建直觉，不要求精确绘制根轨迹，那是层1的内容。',
  },

  // Step 04: Pre-assessment - 前测
  'precheck': {
    enabled: true,
    courseId: L2B_COURSE_META.courseId,
    courseTitle: L2B_COURSE_META.courseTitle,
    pageType: 'quiz',
    stepId: 'precheck',
    topic: '前测：回顾极点与响应',
    learningObjectives: [
      '检验时域直觉前置知识',
      '检验对增益K的初始直觉',
      '诊断学习起点',
    ],
    knowledgeType: 'C',
    tools: ['check_answer', 'explain_concept'],
    quickQuestions: [
      { label: '前测目的', question: '前测的目的是什么？' },
      { label: '极点位置', question: '极点s=-0.1±5j对应的响应是什么？' },
      { label: 'K的影响', question: '增大K，闭环极点会如何？' },
    ],
    systemPromptExtension:
      '当前是前测环节，两道题摸底：极点位置与响应关系（L-2a复习）、对K增大时极点移动的预判。若题1错误率高需补回L-2a，题2结果用于判断演示时间长短。',
  },

  // Step 05: Participatory - 两种轨迹
  'two-trajectories': {
    enabled: true,
    courseId: L2B_COURSE_META.courseId,
    courseTitle: L2B_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'two-trajectories',
    topic: '两种轨迹：时间vs复平面',
    learningObjectives: [
      '澄清根轨迹不是时间轨迹',
      '建立y(t)与s(K)的语义区分',
      '避免后续所有误解',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'analyze_design'],
    quickQuestions: [
      { label: '轨迹区别', question: '两种轨迹有什么不同？' },
      { label: '横轴含义', question: '根轨迹的横轴是什么？' },
      { label: '曲线意义', question: '根轨迹上的一个点代表什么？' },
    ],
    systemPromptExtension:
      '当前环节是概念澄清的关键：y(t)看输出随时间怎么变，s(K)看极点随K怎么走。根轨迹横轴是实部σ，不是时间t。这是避免后续所有误解的基础，务必让学生明确区分。',
  },

  // Step 06: Participatory - 开环旋钮与闭环极点
  'open-close-loop': {
    enabled: true,
    courseId: L2B_COURSE_META.courseId,
    courseTitle: L2B_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'open-close-loop',
    topic: '开环旋钮与闭环极点：反馈框图',
    learningObjectives: [
      '理解"调的是开环K，看的是闭环极点"',
      '建立收音机旋钮的类比记忆',
      '理解根轨迹的物理意义',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'provide_guidance'],
    quickQuestions: [
      { label: '开环闭环', question: '开环增益和闭环极点是什么关系？' },
      { label: '旋钮类比', question: '如何用旋钮类比理解根轨迹？' },
      { label: '物理意义', question: '根轨迹在物理上代表什么？' },
    ],
    systemPromptExtension:
      '当前环节建立核心记忆句：开环增益=旋钮（你调的），闭环极点=结果（系统最终状态），根轨迹=旋钮从0拧到∞，极点走过的路径。用收音机调频的类比帮助学生理解：你调的是旋钮位置，听到的是结果频率。',
  },

  // Step 07: Participatory - 极点在走：拖动演示
  'pole-drag-demo': {
    enabled: true,
    courseId: L2B_COURSE_META.courseId,
    courseTitle: L2B_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'pole-drag-demo',
    topic: '极点在走：拖动演示与工作区探索',
    learningObjectives: [
      '通过拖动观察极点随K的变化',
      '识别关键K值对应的极点位置',
      '建立K与极点位置的动态联系',
    ],
    knowledgeType: 'X',
    tools: ['get_workspace_guide', 'explain_interaction', 'provide_hints'],
    quickQuestions: [
      { label: '关键K值', question: 'K=1、2、5分别对应什么特征？' },
      { label: '拖动观察', question: '拖动时极点如何移动？' },
      { label: '响应变化', question: '极点移动时响应如何变化？' },
    ],
    systemPromptExtension:
      '当前环节是工作区实践，通过拖动根轨迹上的极点或使用K滑块，观察极点随增益的变化。关键K值：K=1（分叉点，最快无超调）、K=2（ζ=0.707，最佳阻尼）、K=5（超调明显，调节时间近似不变）。建议先广播演示，再放权给学生探索。',
  },

  // Step 08: Participatory - 极点迁移数值表
  'migration-table': {
    enabled: true,
    courseId: L2B_COURSE_META.courseId,
    courseTitle: L2B_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'migration-table',
    topic: '极点迁移数值表：观察规律',
    learningObjectives: [
      '通过数值表压实极点迁移规律',
      '观察实部和虚部的变化趋势',
      '建立定量认知',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'analyze_design'],
    quickQuestions: [
      { label: '实部变化', question: 'K增大时，极点实部如何变化？' },
      { label: '虚部变化', question: 'K增大时，极点虚部如何变化？' },
      { label: '性能联动', question: '调节时间和超调分别跟谁联动？' },
    ],
    systemPromptExtension:
      '当前环节通过数值表压实两条观察：实部基本不变（衰减速度固定），虚部增大（振荡更快）。引导学生发现：仅靠调K无法缩短调节时间，这是本设计的重要局限。',
  },

  // Step 09: Participatory - 两个关键观察
  'two-observations': {
    enabled: true,
    courseId: L2B_COURSE_META.courseId,
    courseTitle: L2B_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'two-observations',
    topic: '两个关键观察：从表格到结论',
    learningObjectives: [
      '总结极点迁移的两个关键结论',
      '理解调节时间的基本固定性',
      '为设计可行域建立认知基础',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'summarize_lesson'],
    quickQuestions: [
      { label: '结论1', question: '实部固定意味着什么？' },
      { label: '结论2', question: '虚部增大意味着什么？' },
      { label: '设计局限', question: '仅靠调K能否缩短调节时间？' },
    ],
    systemPromptExtension:
      '当前环节收束两个关键观察：1)实部固定=衰减速度固定=调节时间基本固定；2)虚部增大=振荡更快、超调更大。引导学生思考：如果想让调节时间也变短，还要改什么？为L-sum的设计可行域课程做预热。',
  },

  // Step 10: Participatory - 根轨迹是设计可行域地图
  'design-map': {
    enabled: true,
    courseId: L2B_COURSE_META.courseId,
    courseTitle: L2B_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'design-map',
    topic: '根轨迹是设计可行域地图',
    learningObjectives: [
      '把根轨迹从"图"切换为"地图"的心智模型',
      '识别慢且保守、理想、高超调危险三个区域',
      '建立设计选择的直观感受',
    ],
    knowledgeType: 'X',
    tools: ['explain_concept', 'analyze_design', 'provide_hints'],
    quickQuestions: [
      { label: '地图模型', question: '如何把根轨迹看作设计地图？' },
      { label: '三个区域', question: '根轨迹上的三个区域是什么？' },
      { label: '选点依据', question: '选择极点位置的依据是什么？' },
    ],
    systemPromptExtension:
      '当前环节建立"地图"心智模型：根轨迹不是被动观察的图，而是主动设计的地图。三个区域：慢且保守（K小）、理想工作区（K适中）、高超调危险区（K大）。学生可点选轨迹位置，比较不同点对应的系统行为，记录自己的选择理由。',
  },

  // Step 11: Participatory - 稳定边界
  'stability-boundary': {
    enabled: true,
    courseId: L2B_COURSE_META.courseId,
    courseTitle: L2B_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'stability-boundary',
    topic: '稳定边界：根轨迹不能越过虚轴',
    learningObjectives: [
      '理解虚轴作为稳定边界',
      '认识临界增益与稳定裕度',
      '建立安全边界意识',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'analyze_design'],
    quickQuestions: [
      { label: '稳定边界', question: '根轨迹的稳定边界在哪里？' },
      { label: '穿越后果', question: '穿过虚轴意味着什么？' },
      { label: '工程裕度', question: '为什么需要预留裕度？' },
    ],
    systemPromptExtension:
      '当前环节引入稳定边界：虚轴是根轨迹的"红线"，穿越虚轴意味着系统从稳定变为临界稳定（等幅振荡）或不稳定（发散）。通过三阶系统例子解释临界增益概念，建立"快不是越大越好"的安全边界意识。',
  },

  // Step 12: Participatory - 挑战任务发布
  'challenge-intro': {
    enabled: true,
    courseId: L2B_COURSE_META.courseId,
    courseTitle: L2B_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'challenge-intro',
    topic: '挑战任务发布：找最佳阻尼比',
    learningObjectives: [
      '理解挑战任务的目标',
      '明确预测-验证-AI对比的三步流程',
      '为AI融入环节做好准备',
    ],
    knowledgeType: 'C',
    tools: ['explain_task', 'provide_guidance'],
    quickQuestions: [
      { label: '挑战目标', question: '挑战任务的目标是什么？' },
      { label: '三步流程', question: 'AI融入的三步流程是什么？' },
      { label: '最佳阻尼', question: '为什么ζ=0.707是最佳阻尼？' },
    ],
    systemPromptExtension:
      '当前环节发布挑战任务：找到让阻尼比ζ=0.707的增益K。介绍三步流程：先预测（独立思考）、再验证（平台操作）、最后AI对比。ζ=0.707对应45°射线交点，是工程中常用的"快且稳"折中点。',
  },

  // Step 13: Participatory - 学生独立预测
  'prediction': {
    enabled: true,
    courseId: L2B_COURSE_META.courseId,
    courseTitle: L2B_COURSE_META.courseTitle,
    pageType: 'reflection',
    stepId: 'prediction',
    topic: '[AI融入点] 学生独立预测',
    learningObjectives: [
      '独立预测K的调整方向',
      '记录预测理由',
      '为后续验证建立认知冲突',
    ],
    knowledgeType: 'D',
    tools: ['provide_guidance'],
    quickQuestions: [
      { label: '预测任务', question: '从K≈1到ζ=0.707，K应该调大还是调小？' },
      { label: '预测理由', question: '你的直觉依据是什么？' },
      { label: '不确定性', question: '如果不确定，原因是什么？' },
    ],
    systemPromptExtension:
      '当前环节是AI融入的第一步：学生先独立预测，不允许直接看别人或AI。预测是为了让后续验证和AI对照真正产生认知冲击。引导学生思考：从K≈1的无超调状态到ζ=0.707（有适度超调），K应该调大还是调小？',
  },

  // Step 14: Participatory - 平台验证+几何定位
  'verify-and-ray': {
    enabled: true,
    courseId: L2B_COURSE_META.courseId,
    courseTitle: L2B_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'verify-and-ray',
    topic: '[AI融入点] 平台验证 + 几何定位',
    learningObjectives: [
      '通过工作区验证预测',
      '使用45°射线定位最佳阻尼比',
      '记录验证结果',
    ],
    knowledgeType: 'X',
    tools: ['get_workspace_status', 'analyze_design', 'provide_hints'],
    quickQuestions: [
      { label: '验证方法', question: '如何验证你的预测？' },
      { label: '45°射线', question: '如何用45°射线找ζ=0.707？' },
      { label: '交点记录', question: '交点对应的K和极点是什么？' },
    ],
    systemPromptExtension:
      '当前环节是AI融入的第二步：通过工作区验证预测。使用45°射线开关，找到射线与根轨迹的交点，该点对应ζ=0.707。记录交点对应的K值（理论值K=2）和极点坐标（理论值-1±j1）。引导学生比较自己的预测与验证结果。',
  },

  // Step 15: Participatory - 向AI提问并对比
  'ai-compare': {
    enabled: true,
    courseId: L2B_COURSE_META.courseId,
    courseTitle: L2B_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'ai-compare',
    topic: '[AI融入点] 向AI提问并对比',
    learningObjectives: [
      '向AI询问理论计算',
      '对比预测、验证、AI三栏结果',
      '反思差异原因',
    ],
    knowledgeType: 'D',
    tools: ['get_ai_assistance', 'analyze_design', 'explain_concept'],
    quickQuestions: [
      { label: 'AI提问', question: '应该向AI问什么问题？' },
      { label: '三栏对比', question: '预测、验证、AI结果有何差异？' },
      { label: '反思收获', question: '从差异中学到了什么？' },
    ],
    systemPromptExtension:
      '当前环节是AI融入的第三步：向AI询问理论计算。推荐提示词："对于闭环系统特征方程s²+2s+K=0，当K等于多少时，阻尼比ζ=0.707？请给出极点坐标和计算过程。"引导学生对比三栏结果（预测、平台验证、AI计算），反思差异原因。',
  },

  // Step 16: Post-assessment - 后测
  'postcheck': {
    enabled: true,
    courseId: L2B_COURSE_META.courseId,
    courseTitle: L2B_COURSE_META.courseTitle,
    pageType: 'quiz',
    stepId: 'postcheck',
    topic: '后测：概念确认与应用',
    learningObjectives: [
      '检验根轨迹横轴语义',
      '检验45°几何读图能力',
      '巩固核心概念',
    ],
    knowledgeType: 'X',
    tools: ['check_answer', 'explain_concept'],
    quickQuestions: [
      { label: '后测重点', question: '后测要检验什么？' },
      { label: '横轴语义', question: '根轨迹横轴代表什么？' },
      { label: '45°读图', question: 's=-2+2j对应的阻尼比是多少？' },
    ],
    systemPromptExtension:
      '当前是后测环节，两道题把"根轨迹不是时间图"和"45°对应0.707"钉牢。题1检验横轴语义（复平面实部σ），题2检验45°几何读图（s=-2+2j对应ζ≈0.707）。若错误率高，需重申横轴语义并重演45°几何关系。',
  },

  // Step 17: Summary - 总结
  'summary': {
    enabled: true,
    courseId: L2B_COURSE_META.courseId,
    courseTitle: L2B_COURSE_META.courseTitle,
    pageType: 'summary',
    stepId: 'summary',
    topic: '总结：知识地图回顾与下节预告',
    learningObjectives: [
      '回顾五条核心结论',
      '把根轨迹=设计地图的心智模型收回',
      '预告L-2c频域内容',
    ],
    knowledgeType: 'C',
    tools: ['summarize_lesson', 'preview_next'],
    quickQuestions: [
      { label: '五条结论', question: '今天的五条核心结论是什么？' },
      { label: '地图模型', question: '如何把根轨迹看作设计地图？' },
      { label: '下节预告', question: 'L-2c会学什么？' },
    ],
    systemPromptExtension:
      '当前环节收束五条核心结论：1)根轨迹是复平面轨迹，不是时间轨迹；2)开环增益是旋钮，闭环极点是结果；3)根轨迹图是设计可行域地图；4)ζ=0.707对应45°射线交点，且本例K=2；5)虚轴穿越意味着增益上限与稳定裕度。预告L-2c将补足频域视角，理解稳定裕度的量化。',
  },
};

/**
 * 获取指定步骤的AI上下文配置
 */
export function getL2BStepAIContext(stepId: string): AIContextConfig | null {
  return L2B_STEP_AI_CONTEXTS[stepId] || null;
}

/**
 * 获取当前步骤的快捷问题列表
 */
export function getL2BStepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  const context = L2B_STEP_AI_CONTEXTS[stepId];
  return context?.quickQuestions || [];
}
