/**
 * LSUM课程各步骤AI上下文配置
 *
 * 每个步骤的AI上下文配置，包含主题、学习目标、核心概念等
 * 用于全局AI助手框架动态读取当前步骤的上下文
 */

import type { AIContextConfig } from '@/types/ai-context';

/**
 * LSUM课程元信息
 */
export const LSUM_COURSE_META = {
  courseId: 'lsum-design-feasible-domain-v1',
  courseTitle: 'L-sum：设计可行域——让约束成为指南针',
  courseDescription:
    '围绕复平面可行域、根轨迹可行弧段以及时域/频域投影，把"给性能找参数"的设计视角第一次完整搭起来。',
  keyConcepts: ['可行域', '约束条件', '根轨迹弧段', '阻尼比射线', '实部垂线'],
} as const;

/**
 * LSUM各步骤AI上下文配置映射
 * key: stepId, value: AIContextConfig
 */
export const LSUM_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  // Step 01: Bridge-in - 回到地图
  'step-01': {
    enabled: true,
    courseId: LSUM_COURSE_META.courseId,
    courseTitle: LSUM_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-01',
    topic: '回到地图：层0的最后一块拼图',
    learningObjectives: [
      '理解L-sum课程与L-2a到L-2d的收束关系',
      '建立从分析到设计的视角转换',
      '预览层0完成后的知识框架',
    ],
    knowledgeType: 'C',
    tools: ['get_lesson_overview', 'explain_concept'],
    quickQuestions: [
      { label: '课程定位', question: 'L-sum在层0中处于什么位置？' },
      { label: '与L2D关系', question: 'L-sum与L-2d有什么联系和区别？' },
      { label: '层0收束', question: '层0包含哪些课程？如何收束？' },
    ],
    systemPromptExtension:
      '当前是课程导入环节，重点是帮助学生理解L-sum课程在层0知识结构中的收束定位。强调从L-2a到L-2d的三域直觉积累，到L-sum的设计可行域综合应用。本课是层0的最后一块拼图，将建立"给性能找参数"的设计视角。',
  },

  // Step 02: Bridge-in - 验收单困境
  'step-02': {
    enabled: true,
    courseId: LSUM_COURSE_META.courseId,
    courseTitle: LSUM_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-02',
    topic: '验收单困境：从分析到设计的切换',
    learningObjectives: [
      '理解"给K看性能"与"给性能找K"的区别',
      '认识工程验收单的设计约束含义',
      '建立可行域概念的需求背景',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'provide_guidance'],
    quickQuestions: [
      { label: '分析vs设计', question: '分析和设计有什么不同？' },
      { label: '验收单', question: '工程验收单代表什么？' },
      { label: '困境', question: '为什么说这是"困境"？' },
    ],
    systemPromptExtension:
      '当前环节通过"验收单困境"引入设计视角。分析是"给定K，看性能如何"；设计是"给定性能要求，找K应该在哪里"。工程验收单上的指标（如Mp<20%、ts<8s）是设计约束，可行域就是同时满足所有约束的极点位置集合。强调这是从被动分析到主动设计的视角切换。',
  },

  // Step 03: Objective - 学习目标
  'step-03': {
    enabled: true,
    courseId: LSUM_COURSE_META.courseId,
    courseTitle: LSUM_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-03',
    topic: '今天能学到什么',
    learningObjectives: [
      '理解复平面可行域的几何构造',
      '掌握根轨迹可行弧段的读取方法',
      '建立时域/频域/复平面的三域投影能力',
      '形成"让约束成为指南针"的设计直觉',
    ],
    knowledgeType: 'C',
    tools: ['explain_objectives', 'provide_guidance'],
    quickQuestions: [
      { label: '四条目标', question: '这节课的学习目标是什么？' },
      { label: '可行域', question: '什么是复平面可行域？' },
      { label: '设计直觉', question: '什么是"让约束成为指南针"？' },
    ],
    systemPromptExtension:
      '当前环节明确四条学习目标：1)理解复平面可行域的几何构造（阻尼比射线+实部垂线）；2)掌握根轨迹可行弧段的读取；3)建立三域投影能力；4)形成"让约束成为指南针"的设计直觉。强调本课是层0的收束，将三域知识综合应用到设计问题中。',
  },

  // Step 04: Pre-assessment - 前测
  'step-04': {
    enabled: true,
    courseId: LSUM_COURSE_META.courseId,
    courseTitle: LSUM_COURSE_META.courseTitle,
    pageType: 'quiz',
    stepId: 'step-04',
    topic: '前测：你还记得多少？',
    learningObjectives: [
      '检验阻尼比的前置知识',
      '检验根轨迹的前置认知',
      '诊断学习起点',
    ],
    knowledgeType: 'C',
    tools: ['check_answer', 'explain_concept'],
    quickQuestions: [
      { label: '前测目的', question: '前测的目的是什么？' },
      { label: '阻尼比', question: '阻尼比和哪些性能指标相关？' },
      { label: '根轨迹', question: '根轨迹上的点代表什么？' },
    ],
    systemPromptExtension:
      '当前是前测环节，检查阻尼比与根轨迹的前置认知。题目涉及：阻尼比的几何意义、根轨迹上极点的运动方向、性能指标与极点位置的关系。不计分，只作为认知起点诊断，帮助教师了解学生的准备程度。',
  },

  // Step 05: Participatory - 工程任务发布
  'step-05': {
    enabled: true,
    courseId: LSUM_COURSE_META.courseId,
    courseTitle: LSUM_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-05',
    topic: '工程任务发布：给你一张验收单',
    learningObjectives: [
      '理解船舶航向控制的工程背景',
      '明确设计任务的性能约束',
      '建立任务单的工程意义',
    ],
    knowledgeType: 'C',
    tools: ['explain_task', 'provide_guidance'],
    quickQuestions: [
      { label: '工程背景', question: '船舶航向控制的设计要求是什么？' },
      { label: '性能约束', question: '验收单上的指标意味着什么？' },
      { label: '设计目标', question: '我们的设计目标是什么？' },
    ],
    systemPromptExtension:
      '当前环节发布工程任务：船舶航向控制器的参数设计。验收单性能要求：超调量Mp<20%、调节时间ts<8s、相位裕度γ>30°。强调这是真实的工程约束，设计师的任务就是找到同时满足这些约束的控制器参数K。这正是"可行域设计"的核心问题。',
  },

  // Step 06: Participatory - 草图预测
  'step-06': {
    enabled: true,
    courseId: LSUM_COURSE_META.courseId,
    courseTitle: LSUM_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'step-06',
    topic: '草图预测：极点应该落在哪里？',
    learningObjectives: [
      '运用直觉预测可行域的形状',
      '建立极点位置与性能的初步联系',
      '为正式学习建立认知冲突',
    ],
    knowledgeType: 'D',
    tools: ['provide_guidance', 'explain_concept'],
    quickQuestions: [
      { label: '草图目的', question: '为什么要先画草图？' },
      { label: '可行域预测', question: '你觉得可行域大概是什么形状？' },
      { label: '极点位置', question: '满足Mp<20%的极点应该在哪里？' },
    ],
    systemPromptExtension:
      '当前环节让学生先凭直觉画出可行域的草图。这是"预测-验证"学习模式：先暴露学生的初始想法，再用正式知识验证或修正。引导学生思考：满足Mp<20%的极点应该离虚轴远还是近？满足ts<8s的极点实部应该满足什么条件？鼓励大胆预测，不需要精确。',
  },

  // Step 07: Participatory - 复平面可行域
  'step-07': {
    enabled: true,
    courseId: LSUM_COURSE_META.courseId,
    courseTitle: LSUM_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-07',
    topic: '复平面可行域：两条约束线',
    learningObjectives: [
      '理解阻尼比射线的构造和意义',
      '理解实部垂线的构造和意义',
      '掌握可行域的扇形几何形状',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'analyze_design'],
    quickQuestions: [
      { label: '阻尼比射线', question: '阻尼比射线是怎么画的？代表什么？' },
      { label: '实部垂线', question: '实部垂线是怎么画的？代表什么？' },
      { label: '可行域形状', question: '可行域为什么是扇形？' },
    ],
    systemPromptExtension:
      '当前环节讲解复平面可行域的几何构造。两条约束线：1)阻尼比射线——从原点出发，角度由阻尼比决定（如ζ=0.456对应约63°），满足Mp<20%；2)实部垂线——垂直于实轴，位置由ts决定（如ts<8s对应σ<-0.5）。可行域是两条线"夹住"的扇形区域，同时满足超调和调节时间约束。',
  },

  // Step 08: Participatory - 根轨迹可行弧段
  'step-08': {
    enabled: true,
    courseId: LSUM_COURSE_META.courseId,
    courseTitle: LSUM_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-08',
    topic: '根轨迹可行弧段：K的允许范围',
    learningObjectives: [
      '理解根轨迹与可行域的叠加方法',
      '掌握可行弧段的读取',
      '确定K的允许范围',
    ],
    knowledgeType: 'X',
    tools: ['explain_concept', 'analyze_design'],
    quickQuestions: [
      { label: '叠加方法', question: '如何把根轨迹叠加到可行域上？' },
      { label: '可行弧段', question: '什么是根轨迹可行弧段？' },
      { label: 'K的范围', question: '如何确定K的允许范围？' },
    ],
    systemPromptExtension:
      '当前环节讲解根轨迹可行弧段。把根轨迹图叠加到复平面可行域上，根轨迹穿过可行域的部分就是"可行弧段"。弧段两端的K值就是K的下界和上界，系统在该范围内同时满足所有性能约束。强调这是从"极点设计"到"参数选择"的关键桥梁。',
  },

  // Step 09: Participatory - 三域投影
  'step-09': {
    enabled: true,
    courseId: LSUM_COURSE_META.courseId,
    courseTitle: LSUM_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-09',
    topic: '三域投影：同一组K的三张面孔',
    learningObjectives: [
      '理解同一组K在三个域的等价表示',
      '建立复平面、时域、频域的对照能力',
      '形成统一的设计视角',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'analyze_design'],
    quickQuestions: [
      { label: '三域对应', question: '同一组K在三张图上如何对应？' },
      { label: '等价性', question: '为什么说三张图是等价的？' },
      { label: '设计视角', question: '如何从三域视角判断设计是否合格？' },
    ],
    systemPromptExtension:
      '当前环节建立三域投影的完整视角。同一组K值：在复平面看是极点位置，在时域看是阶跃响应曲线（Mp、ts），在频域看是Bode图（γ）。三张图是同一系统的三种等价表示，设计时需要同时满足三域的约束。这是L-sum最核心的综合视角。',
  },

  // Step 10: Participatory - AI融入点
  'step-10': {
    enabled: true,
    courseId: LSUM_COURSE_META.courseId,
    courseTitle: LSUM_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-10',
    topic: 'AI融入点：约束收紧，可行域如何变？',
    learningObjectives: [
      '分析约束条件变化对可行域的影响',
      '理解可行域"收紧"和"放宽"的动态',
      '训练逆向推理能力',
    ],
    knowledgeType: 'D',
    tools: ['get_ai_assistance', 'analyze_design', 'explain_concept'],
    quickQuestions: [
      { label: '约束收紧', question: '如果要求Mp<10%，可行域怎么变？' },
      { label: '约束放宽', question: '如果放宽ts要求，可行域怎么变？' },
      { label: '极限情况', question: '如果约束太严格会怎样？' },
    ],
    systemPromptExtension:
      '当前环节是AI融入点，学生先独立思考约束变化对可行域的影响，再用页内AI做对照。核心问题：如果Mp要求从20%收紧到10%，阻尼比射线会如何旋转？可行域变大还是变小？如果ts要求放宽，实部垂线会如何移动？引导学生理解可行域的动态性，以及工程约束之间的权衡关系。',
  },

  // Step 11: Participatory - 例题1
  'step-11': {
    enabled: true,
    courseId: LSUM_COURSE_META.courseId,
    courseTitle: LSUM_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'step-11',
    topic: '例题1：读懂可行域边界',
    learningObjectives: [
      '应用可行域方法分析具体系统',
      '判断哪个约束真正"咬住"系统',
      '掌握可行域边界的读取技巧',
    ],
    knowledgeType: 'X',
    tools: ['analyze_design', 'provide_hints', 'explain_concept'],
    quickQuestions: [
      { label: '例题分析', question: '这个例题的可行域是怎样的？' },
      { label: '咬住约束', question: '哪个约束真正限制了设计？' },
      { label: '边界读取', question: '如何读取可行域的边界值？' },
    ],
    systemPromptExtension:
      '当前环节是例题练习，使用固定二阶系统判断哪个约束真正"咬住"系统。核心问题：在给定的性能约束（如Mp<20%、ts<8s）下，根轨迹可行弧段的端点由哪个约束决定？引导学生理解：可行域边界可能由超调约束决定，也可能由调节时间约束决定，取决于根轨迹与可行域的相对位置。',
  },

  // Step 12: Participatory - 工程结论
  'step-12': {
    enabled: true,
    courseId: LSUM_COURSE_META.courseId,
    courseTitle: LSUM_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-12',
    topic: '工程结论：哪个约束"咬住"了系统？',
    learningObjectives: [
      '总结可行域分析的工程判断语句',
      '理解"咬住"概念的几何意义',
      '建立工程化表达习惯',
    ],
    knowledgeType: 'C',
    tools: ['summarize_lesson', 'explain_concept'],
    quickQuestions: [
      { label: '咬住概念', question: '什么是"咬住"？如何判断？' },
      { label: '工程判断', question: '如何用工程语言描述结论？' },
      { label: '设计启示', question: '如果某个约束没咬住，说明什么？' },
    ],
    systemPromptExtension:
      '当前环节收束例题，形成工程结论。"咬住"指限制设计空间的约束边界：如果根轨迹可行弧段的上界由阻尼比射线决定，则超调约束"咬住"了系统；如果由实部垂线决定，则调节时间约束"咬住"了系统。工程判断语句示例："在本设计中，超调要求是主要约束，系统调节时间有裕度。"',
  },

  // Step 13: Post-assessment - 后测
  'step-13': {
    enabled: true,
    courseId: LSUM_COURSE_META.courseId,
    courseTitle: LSUM_COURSE_META.courseTitle,
    pageType: 'quiz',
    stepId: 'step-13',
    topic: '后测：巩固三个核心判断',
    learningObjectives: [
      '检验实部垂线的判读能力',
      '检验可行极点的判读能力',
      '检验约束收紧的推理能力',
    ],
    knowledgeType: 'X',
    tools: ['check_answer', 'explain_concept'],
    quickQuestions: [
      { label: '实部垂线', question: '实部垂线代表什么约束？' },
      { label: '可行极点', question: '如何判断一个极点是否在可行域内？' },
      { label: '约束收紧', question: '约束收紧时可行域如何变化？' },
    ],
    systemPromptExtension:
      '当前是后测环节，巩固三个核心判断能力：1)实部垂线与调节时间约束的关系；2)可行极点的判读（在可行域内且在根轨迹上）；3)约束收紧时可行域变窄、约束放宽时可行域变宽的推理。这是对本课核心知识点的综合检验。',
  },

  // Step 14: Summary - 层0收束
  'step-14': {
    enabled: true,
    courseId: LSUM_COURSE_META.courseId,
    courseTitle: LSUM_COURSE_META.courseTitle,
    pageType: 'summary',
    stepId: 'step-14',
    topic: '层0收束：五条设计直觉',
    learningObjectives: [
      '回顾层0的五条核心设计直觉',
      '建立从分析到设计的完整认知',
      '为层1学习做知识准备',
    ],
    knowledgeType: 'C',
    tools: ['summarize_lesson', 'preview_next'],
    quickQuestions: [
      { label: '五条直觉', question: '层0的五条设计直觉是什么？' },
      { label: '层0收束', question: '层0学完后应该掌握什么？' },
      { label: '层1预告', question: '层1会学什么？' },
    ],
    systemPromptExtension:
      '当前环节是层0收束，回顾五条设计直觉：1)极点左移→稳定；2)阻尼比增大→超调减小；3)相位裕度与超调反向变化；4)增益过大→失稳；5)约束定义可行域。强调层0建立了"直觉先行"的基础，层1将把这些直觉翻译成精确的数学工具（劳斯判据、奈奎斯特判据等）。',
  },

  // Step 15: Bridge-out - 下节预告
  'step-15': {
    enabled: true,
    courseId: LSUM_COURSE_META.courseId,
    courseTitle: LSUM_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-15',
    topic: '下节预告：直觉翻译成公式',
    learningObjectives: [
      '理解层1的学习内容',
      '建立直觉与数学的桥梁',
      '激发后续学习动机',
    ],
    knowledgeType: 'C',
    tools: ['preview_next', 'explain_concept'],
    quickQuestions: [
      { label: '层1内容', question: '层1会讲什么？' },
      { label: '直觉与公式', question: '如何把直觉翻译成公式？' },
      { label: '学习路径', question: '接下来的学习路径是什么？' },
    ],
    systemPromptExtension:
      '当前环节预告层1内容：把层0的直觉翻译成精确的数学工具。核心主题：劳斯判据（如何不画图判断稳定性）、奈奎斯特判据（频域稳定性判据）、根轨迹法则（精确绘制根轨迹）。强调层0是"知其然"，层1是"知其所以然"，两层的结合才是真正的设计能力。',
  },
};

/**
 * 获取指定步骤的AI上下文配置
 */
export function getLSUMStepAIContext(stepId: string): AIContextConfig | null {
  return LSUM_STEP_AI_CONTEXTS[stepId] || null;
}

/**
 * 获取当前步骤的快捷问题列表
 */
export function getLSUMStepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  const context = LSUM_STEP_AI_CONTEXTS[stepId];
  return context?.quickQuestions || [];
}
