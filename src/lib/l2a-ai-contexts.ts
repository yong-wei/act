/**
 * L2A课程各步骤AI上下文配置
 *
 * 每个步骤的AI上下文配置，包含主题、学习目标、核心概念等
 * 用于全局AI助手框架动态读取当前步骤的上下文
 */

import type { AIContextConfig } from '@/types/ai-context';

/**
 * L2A课程元信息
 */
export const L2A_COURSE_META = {
  courseId: 'l2a-time-domain-fasttrack',
  courseTitle: 'L-2a：三张面孔，同一系统 · 时域直觉速通',
  courseDescription:
    '围绕船舶航向阶跃响应，在18个环节中建立"极点位置 → 曲线家族 → 三指标 → 两参数 → 时域局限"的直觉链路。',
  keyConcepts: ['阶跃响应', '超调量Mp', '调节时间ts', '上升时间tr', '阻尼比ζ', '自然频率ωn', '四种响应家族'],
} as const;

/**
 * L2A各步骤AI上下文配置映射
 * key: stepId, value: AIContextConfig
 */
export const L2A_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  // Step 01: Bridge-in - 知识图谱定位
  'knowledge-map': {
    enabled: true,
    courseId: L2A_COURSE_META.courseId,
    courseTitle: L2A_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'knowledge-map',
    topic: '知识图谱定位：时域在层0中的位置',
    learningObjectives: [
      '理解L-2a在层0课程体系中的位置',
      '建立时域作为"第一张面孔"的整体认知',
      '预览后续L-2b根轨迹、L-2c频域的补全关系',
    ],
    knowledgeType: 'C',
    tools: ['get_lesson_overview', 'explain_concept'],
    quickQuestions: [
      { label: '课程定位', question: 'L-2a在整个课程体系中处于什么位置？' },
      { label: '三张面孔', question: '什么是自动控制的三张面孔？' },
      { label: '学习路径', question: '从L-2a到L-2d的学习路径是怎样的？' },
    ],
    systemPromptExtension:
      '当前是课程导入环节，重点是帮助学生理解L-2a在层0知识结构中的位置。强调本课是"第一张面孔"——时域直觉，后续L-2b将补足根轨迹视角，L-2c补足频域视角，L-2d进行三域联动实操。建立"曲线家族→三指标→两参数→时域局限"的完整学习链路预期。',
  },

  // Step 02: Bridge-in - 情境展示：船舶转向曲线
  'bridge-in-1': {
    enabled: true,
    courseId: L2A_COURSE_META.courseId,
    courseTitle: L2A_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'bridge-in-1',
    topic: '情境展示：船舶转向阶跃响应曲线',
    learningObjectives: [
      '观察真实工程系统的阶跃响应曲线',
      '用自然语言描述系统动态行为',
      '建立工程师视角的现象观察能力',
    ],
    knowledgeType: 'X',
    tools: ['explain_concept', 'provide_guidance'],
    quickQuestions: [
      { label: '曲线观察', question: '从这条曲线中能读出哪些信息？' },
      { label: '工程描述', question: '如何用工程语言描述系统行为？' },
      { label: '关键特征', question: '曲线的关键特征有哪些？' },
    ],
    systemPromptExtension:
      '当前环节展示船舶转向的阶跃响应曲线，引导学生像工程师一样观察和描述现象。重点关注：是否有超调、振荡情况、稳定时间。鼓励学生用自己的语言描述，建立从现象到工程的直觉连接。',
  },

  // Step 03: Bridge-in - 情境收拢：三条主线
  'bridge-in-2': {
    enabled: true,
    courseId: L2A_COURSE_META.courseId,
    courseTitle: L2A_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'bridge-in-2',
    topic: '情境收拢：家族、指标、参数三条主线',
    learningObjectives: [
      '理解本课的三条学习主线',
      '建立"曲线形状→性能指标→系统参数"的认知框架',
      '为后续学习建立结构化预期',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'provide_guidance'],
    quickQuestions: [
      { label: '三条主线', question: '今天的三条学习主线是什么？' },
      { label: '学习框架', question: '如何理解家族、指标、参数的关系？' },
      { label: '课程结构', question: '这节课的内容是如何组织的？' },
    ],
    systemPromptExtension:
      '当前环节将自由观察收束到三条主线：曲线家族（形状分类）、性能指标（量化描述）、系统参数（根本原因）。强调这是从现象到本质的认知路径：先看曲线属于哪类家族，再用指标量化描述，最后理解参数如何决定这些特性。',
  },

  // Step 04: Objective - 今日目标
  'objective': {
    enabled: true,
    courseId: L2A_COURSE_META.courseId,
    courseTitle: L2A_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'objective',
    topic: '今日目标：建立时域直觉',
    learningObjectives: [
      '识别四种阶跃响应家族',
      '掌握Mp、ts、tr三个性能指标',
      '理解ζ和ωn对曲线的影响',
      '认识时域视角的局限性',
    ],
    knowledgeType: 'C',
    tools: ['explain_objectives', 'provide_guidance'],
    quickQuestions: [
      { label: '四项目标', question: '今天的四项目标是什么？' },
      { label: '学习边界', question: '今天解决什么、不解决什么？' },
      { label: '自评起点', question: '如何评估自己的起点水平？' },
    ],
    systemPromptExtension:
      '当前环节明确四项目标：1)识别过阻尼、欠阻尼、临界阻尼、不稳定四种家族；2)掌握超调量Mp、调节时间ts、上升时间tr的定义和测量；3)理解阻尼比ζ和自然频率ωn如何影响曲线；4)认识时域只能看结果、不能直接指导设计的局限。强调今天只建直觉，不做公式推导。',
  },

  // Step 05: Pre-assessment - 前测
  'pre-assessment': {
    enabled: true,
    courseId: L2A_COURSE_META.courseId,
    courseTitle: L2A_COURSE_META.courseTitle,
    pageType: 'quiz',
    stepId: 'pre-assessment',
    topic: '前测：摸底已有认知',
    learningObjectives: [
      '检验极点稳定性前置知识',
      '检验超调量直觉',
      '诊断学习起点',
    ],
    knowledgeType: 'C',
    tools: ['check_answer', 'explain_concept'],
    quickQuestions: [
      { label: '前测目的', question: '前测的目的是什么？' },
      { label: '极点位置', question: '极点在右半平面意味着什么？' },
      { label: '超调量', question: '超调量描述的是什么？' },
    ],
    systemPromptExtension:
      '当前是前测环节，3道选择题不计分，只作为认知起点诊断。题目涉及：极点位置与稳定性关系、超调量概念、影响响应快慢的因素。根据结果，教师可调整节奏：若极点稳定性错误率高，需快速补回L-1内容。',
  },

  // Step 06: Participatory - 过渡：引入四种家族
  'participatory-intro-1': {
    enabled: true,
    courseId: L2A_COURSE_META.courseId,
    courseTitle: L2A_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'participatory-intro-1',
    topic: '过渡：引入四种响应家族',
    learningObjectives: [
      '理解左侧工作区的核心作用',
      '建立"极点位置→曲线形态"的初步联系',
      '为家族学习做好准备',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'provide_guidance'],
    quickQuestions: [
      { label: '工作区作用', question: '左侧工作区的作用是什么？' },
      { label: '极点与曲线', question: '极点位置如何决定曲线形态？' },
      { label: '探索建议', question: '应该如何使用工作区？' },
    ],
    systemPromptExtension:
      '当前环节引入左侧工作区，这是理解"极点位置→曲线形态"关系的核心工具。强调先观察、再命名、不急着背术语。鼓励学生拖动极点或调整参数，直观感受曲线的"性格"变化。',
  },

  // Step 07: Participatory - 四种家族：图示
  'participatory-families-1': {
    enabled: true,
    courseId: L2A_COURSE_META.courseId,
    courseTitle: L2A_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'participatory-families-1',
    topic: '四种响应家族：图示与命名',
    learningObjectives: [
      '认识过阻尼、欠阻尼、临界阻尼、不稳定四种家族',
      '建立曲线形状与工程含义的对应',
      '理解欠阻尼是工程最常见的情况',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'analyze_design'],
    quickQuestions: [
      { label: '四种家族', question: '四种响应家族各有什么特点？' },
      { label: '工程常见', question: '哪种家族在工程中最常见？' },
      { label: '形状记忆', question: '如何快速识别不同的响应家族？' },
    ],
    systemPromptExtension:
      '当前环节展示四种响应家族：过阻尼（单调上升、无超调、较慢）、欠阻尼（振荡衰减、有超调、最常见）、临界阻尼（单调上升、无超调、最快）、不稳定（发散）。建议先遮住标签展示曲线，让学生用自己的语言描述，再揭示正式名称。',
  },

  // Step 08: Participatory - 四种家族：工作区探索
  'participatory-families-2': {
    enabled: true,
    courseId: L2A_COURSE_META.courseId,
    courseTitle: L2A_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'participatory-families-2',
    topic: '四种家族：工作区自由探索',
    learningObjectives: [
      '在工作区中找到四种家族的极点区域',
      '建立极点位置与家族类型的空间映射',
      '记录关键发现',
    ],
    knowledgeType: 'X',
    tools: ['get_workspace_guide', 'explain_concept', 'provide_hints'],
    quickQuestions: [
      { label: '极点区域', question: '什么极点位置会产生最大超调？' },
      { label: '虚轴穿越', question: '穿过虚轴时曲线会怎样？' },
      { label: '关键发现', question: '你的最关键发现是什么？' },
    ],
    systemPromptExtension:
      '当前环节是工作区实践，学生需要亲自找到四种家族对应的极点区域。核心观察：极点靠近虚轴且有较大虚部时超调最大；极点穿过虚轴时系统从稳定变为不稳定。教师应巡视而非代劳，让学生自己建立空间映射记忆。',
  },

  // Step 09: Participatory - 过渡：引入三个指标
  'participatory-intro-2': {
    enabled: true,
    courseId: L2A_COURSE_META.courseId,
    courseTitle: L2A_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'participatory-intro-2',
    topic: '过渡：引入三个性能指标',
    learningObjectives: [
      '理解从"形状描述"到"量化描述"的升级',
      '建立Mp、ts、tr的工程意义',
      '理解不同场景的指标取舍',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'provide_guidance'],
    quickQuestions: [
      { label: '三个指标', question: '三个性能指标各描述什么？' },
      { label: '工程取舍', question: '客船和巡逻船更在意什么指标？' },
      { label: '量化意义', question: '为什么要用数字描述性能？' },
    ],
    systemPromptExtension:
      '当前环节从"曲线像什么"升级到"曲线好不好用"。三个核心问题：冲了多高（Mp）、多久稳定（ts）、起步多快（tr）。引导学生思考不同应用场景的取舍：客轮更在意舒适性（Mp），巡逻船更在意机动性（tr）。',
  },

  // Step 10: Participatory - 三个指标：定义
  'participatory-metrics-1': {
    enabled: true,
    courseId: L2A_COURSE_META.courseId,
    courseTitle: L2A_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'participatory-metrics-1',
    topic: '三个性能指标：定义与工程含义',
    learningObjectives: [
      '掌握Mp、ts、tr的精确定义',
      '理解指标在船舶场景中的工程意义',
      '能够在曲线上标注指标位置',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'provide_guidance'],
    quickQuestions: [
      { label: 'Mp定义', question: '超调量Mp是如何定义的？' },
      { label: 'ts定义', question: '调节时间ts是如何定义的？' },
      { label: 'tr定义', question: '上升时间tr是如何定义的？' },
    ],
    systemPromptExtension:
      '当前环节精确定义三个指标：Mp（峰值超过稳态值的百分比）、ts（进入±2%误差带并保持的时刻）、tr（10%→90%的上升段时间）。强调工程含义：Mp是船头冲过目标航向的程度，ts是多久才算真正稳定，tr是从起步到"有明显动作"需要多久。',
  },

  // Step 11: Participatory - 三指标：工作区测量
  'participatory-metrics-2': {
    enabled: true,
    courseId: L2A_COURSE_META.courseId,
    courseTitle: L2A_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'participatory-metrics-2',
    topic: '三指标：工作区测量实践',
    learningObjectives: [
      '在工作区中直接测量Mp、ts、tr',
      '掌握从曲线读取指标的方法',
      '理解指标之间的权衡关系',
    ],
    knowledgeType: 'X',
    tools: ['get_workspace_status', 'provide_hints', 'analyze_design'],
    quickQuestions: [
      { label: '测量技巧', question: '如何准确测量三个指标？' },
      { label: '指标权衡', question: '能让Mp和ts同时减小吗？' },
      { label: '误差允许', question: '测量允许有多少误差？' },
    ],
    systemPromptExtension:
      '当前环节是测量实践，学生需要在工作区中直接读取默认系统的Mp、ts、tr。关键技巧：最高点与稳态值之差给Mp，进入±2%误差带后的第一个稳定时刻给ts，10%到90%的时间段给tr。引导学生思考进阶问题：能否让Mp和ts同时减小？',
  },

  // Step 12: Participatory - 过渡：引入两个参数
  'participatory-intro-3': {
    enabled: true,
    courseId: L2A_COURSE_META.courseId,
    courseTitle: L2A_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'participatory-intro-3',
    topic: '过渡：引入两个关键参数',
    learningObjectives: [
      '理解从现象到参数的认知深入',
      '建立ζ和ωn作为曲线"源头"的概念',
      '为参数学习建立预测预期',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'provide_guidance'],
    quickQuestions: [
      { label: '参数作用', question: '什么决定系统属于哪个家族？' },
      { label: 'ζ预测', question: '增大ζ，Mp会如何变化？' },
      { label: 'ωn预测', question: '增大ωn，系统会如何变化？' },
    ],
    systemPromptExtension:
      '当前环节从现象回到参数，明确ζ（阻尼比）和ωn（自然频率）是决定曲线特性的两个关键参数。引导学生先做预测：增大ζ，超调会如何？增大ωn，响应会如何？预测正确与否不重要，重要的是后面能看到认知修正。',
  },

  // Step 13: Participatory - 参数 ζ：图示与规律
  'participatory-zeta': {
    enabled: true,
    courseId: L2A_COURSE_META.courseId,
    courseTitle: L2A_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'participatory-zeta',
    topic: '参数ζ：图示与规律',
    learningObjectives: [
      '理解ζ控制曲线形状的规律',
      '掌握ζ与Mp、tr、ts的关系',
      '理解ζ≈0.7的经验最优值',
    ],
    knowledgeType: 'X',
    tools: ['explain_concept', 'analyze_design', 'provide_hints'],
    quickQuestions: [
      { label: 'ζ规律', question: 'ζ变化时，曲线如何变化？' },
      { label: '最优值', question: '为什么ζ≈0.7常被偏爱？' },
      { label: '预测对照', question: '你的预测与实际一致吗？' },
    ],
    systemPromptExtension:
      '当前环节聚焦阻尼比ζ的规律：ζ↑→Mp↓、ζ↑→tr↑、ζ↑→ts先↓后↑。强调ζ控制形状而非速度，ζ≈0.7是快与稳的经验平衡点。学生应使用工作区验证规律，并对照自己的预测。',
  },

  // Step 14: Participatory - 参数 ωn：图示与规律
  'participatory-wn': {
    enabled: true,
    courseId: L2A_COURSE_META.courseId,
    courseTitle: L2A_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'participatory-wn',
    topic: '参数ωn：图示与规律',
    learningObjectives: [
      '理解ωn控制曲线速度的规律',
      '掌握ωn与ts、tr的关系',
      '理解"自然频率"的真正含义',
    ],
    knowledgeType: 'X',
    tools: ['explain_concept', 'analyze_design', 'provide_hints'],
    quickQuestions: [
      { label: 'ωn规律', question: 'ωn变化时，曲线如何变化？' },
      { label: '速度控制', question: '为什么说ωn控制速度不改形状？' },
      { label: '自然频率', question: '如何理解"自然频率"？' },
    ],
    systemPromptExtension:
      '当前环节聚焦自然频率ωn的规律：ωn↑→ts↓、ωn↑→tr↓、ωn↑→Mp近似不变。强调同样的形状，时间尺度不同，这就是"自然频率"的真正含义。引导学生观察：ωn改变时，振荡周期数会变化，但超调量基本不变。',
  },

  // Step 15: Participatory - 完整速记表
  'participatory-table': {
    enabled: true,
    courseId: L2A_COURSE_META.courseId,
    courseTitle: L2A_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'participatory-table',
    topic: '完整速记表：ζ、ωn对三指标的影响',
    learningObjectives: [
      '掌握ζ和ωn对Mp、ts、tr影响的速记表',
      '理解ts随ζ的非单调性',
      '形成快速查询的记忆工具',
    ],
    knowledgeType: 'D',
    tools: ['summarize_lesson', 'explain_concept'],
    quickQuestions: [
      { label: '速记表', question: '完整速记表的内容是什么？' },
      { label: '非单调性', question: '为什么ts会先减后增？' },
      { label: '参数分工', question: 'ζ和ωn各控制什么？' },
    ],
    systemPromptExtension:
      '当前环节把规律压缩成速记表：ζ↑→Mp↓、ts先↓后↑、tr↑；ωn↑→Mp≈不变、ts↓、tr↓。强调ts的非单调性：ζ太小（振荡剧烈）和ζ太大（响应缓慢）都会导致ts增大，ζ≈0.7是经验最优值。',
  },

  // Step 16: Participatory - 局限性与预告
  'participatory-limit': {
    enabled: true,
    courseId: L2A_COURSE_META.courseId,
    courseTitle: L2A_COURSE_META.courseTitle,
    pageType: 'reflection',
    stepId: 'participatory-limit',
    topic: '局限性与预告：时域的边界',
    learningObjectives: [
      '理解时域视角的局限性',
      '认识"知道结果≠知道如何设计"',
      '建立后续课程的学习动机',
    ],
    knowledgeType: 'D',
    tools: ['explain_concept', 'provide_guidance', 'preview_next'],
    quickQuestions: [
      { label: '时域局限', question: '时域视角有什么局限？' },
      { label: '设计盲区', question: '只看时域能知道改哪个参数吗？' },
      { label: '后续预告', question: 'L-2b和L-2c会补什么？' },
    ],
    systemPromptExtension:
      '当前环节点明时域的边界：时域能告诉你结果好不好（Mp、ts多大），但不能直接告诉你该改哪个控制器参数（Kp、Ki、Kd）。关键留白：知道ζ太小，但具体该改哪个参数？时域曲线本身不告诉你。预告L-2b根轨迹告诉你极点如何移动，L-2c频域告诉你裕度如何量化。',
  },

  // Step 17: Post-assessment - 后测
  'post-assessment': {
    enabled: true,
    courseId: L2A_COURSE_META.courseId,
    courseTitle: L2A_COURSE_META.courseTitle,
    pageType: 'quiz',
    stepId: 'post-assessment',
    topic: '后测：检验时域直觉',
    learningObjectives: [
      '检验家族识别能力',
      '检验指标定义理解',
      '检验参数影响规律',
      '检验局限性认知',
    ],
    knowledgeType: 'X',
    tools: ['check_answer', 'explain_concept'],
    quickQuestions: [
      { label: '后测目的', question: '后测与前测有什么不同？' },
      { label: '家族识别', question: '如何判断系统的响应家族？' },
      { label: '参数规律', question: 'ζ从0.3增大到0.7，Mp如何变化？' },
    ],
    systemPromptExtension:
      '当前是后测环节，4道题验证今天的直觉链路是否闭环：前3道选择题看共识（家族识别、ts定义、ζ对Mp的影响），第4道开放题看表达（时域为什么不能直接指导设计）。若1/2/3任一正确率<70%，下节课需先快速复盘。',
  },

  // Step 18: Summary - 总结与预告
  'summary': {
    enabled: true,
    courseId: L2A_COURSE_META.courseId,
    courseTitle: L2A_COURSE_META.courseTitle,
    pageType: 'summary',
    stepId: 'summary',
    topic: '总结与预告：五句关键结论',
    learningObjectives: [
      '回顾五句关键结论',
      '回收今天点亮的知识节点',
      '建立个人学习证据',
    ],
    knowledgeType: 'C',
    tools: ['summarize_lesson', 'preview_next'],
    quickQuestions: [
      { label: '五句结论', question: '今天的五句关键结论是什么？' },
      { label: '知识节点', question: '今天点亮了哪些知识节点？' },
      { label: '下节预告', question: 'L-2b会学什么？' },
    ],
    systemPromptExtension:
      '当前环节收束五句关键结论：1)时域响应=阶跃输入下从初态到稳态的全过程曲线；2)四种家族=极点位置决定曲线形态；3)三个指标：Mp（冲多高）、ts（多久稳定）、tr（多快上升）；4)两个参数：ζ控形状，ωn控速度；5)局限：时域看结果，不直接指导控制器设计。预告L-2b将建立根轨迹直觉，理解"极点如何随增益移动"。',
  },
};

/**
 * 获取指定步骤的AI上下文配置
 */
export function getL2AStepAIContext(stepId: string): AIContextConfig | null {
  return L2A_STEP_AI_CONTEXTS[stepId] || null;
}

/**
 * 获取当前步骤的快捷问题列表
 */
export function getL2AStepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  const context = L2A_STEP_AI_CONTEXTS[stepId];
  return context?.quickQuestions || [];
}
