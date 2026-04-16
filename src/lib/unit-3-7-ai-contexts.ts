import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_3_7_COURSE_META = {
  courseId: 'unit-3-7-steady-error-low-frequency-compensation-v1',
  courseTitle: '3-7：型别、积分环节与稳态改善——PI 与滞后校正的低频补偿机理',
  courseDescription:
    '围绕给定/扰动双通道、终值定理与型别快判、PI/滞后低频补偿比较，把“为什么更准”推进成一条可执行的误差分析与补偿路径。',
  keyConcepts: ['双通道误差', '终值定理', '系统型别', '静态误差系数', 'PI', '滞后校正', 'PD 方案核验'],
} as const;

function context(
  stepId: string,
  topic: string,
  pageType: AIContextConfig['pageType'],
  learningObjectives: string[],
  quickQuestions: Array<{ label: string; question: string }>,
  systemPromptExtension: string,
): AIContextConfig {
  return {
    enabled: true,
    courseId: UNIT_3_7_COURSE_META.courseId,
    courseTitle: UNIT_3_7_COURSE_META.courseTitle,
    pageType,
    stepId,
    topic,
    learningObjectives,
    knowledgeType: 'X+C',
    tools: ['explain_concept', 'provide_guidance', 'check_answer'],
    quickQuestions,
    systemPromptExtension,
  };
}

export const UNIT_3_7_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  'step-01': context(
    'step-01',
    '课程定位：3-7 负责回答为什么还能更准',
    'theory',
    ['明确 3-7 位于 3-6 与 3-8 之间', '区分动态改善线与稳态改善线'],
    [
      { label: '为什么还不够', question: '为什么 3-6 已经回答了“更快更稳”，3-7 还必须单独回答“为什么更准”？' },
      { label: '下一课关系', question: '3-7 和 3-8 的关系是什么，为什么今天先从低频精度切入？' },
    ],
    '当前页面只做课程定位，不展开例题参数或补偿器整定。',
  ),
  'step-02': context(
    'step-02',
    '目标与边界：本课只负责稳态误差与低频补偿入口',
    'theory',
    ['明确四项目标', '守住不提前进入 Nyquist 判据与完整整定的边界'],
    [
      { label: '四项目标', question: '本课四项目标分别围绕哪四个动作展开？' },
      { label: '边界为什么重要', question: '为什么 3-7 必须停在误差分析和低频补偿入口，而不提前滑进完整频域设计？' },
    ],
    '只解释目标卡与边界表，不替代后续作答。',
  ),
  'step-03': context(
    'step-03',
    '前测：暴露“扰动也能套表”等起点误区',
    'quiz',
    ['识别扰动与给定的区别', '区分增益提高和型别提高'],
    [
      { label: '扰动为什么不能套表', question: '为什么显式扰动问题不能直接当成另一种输入型别来套 Kp/Kv/Ka 表？' },
      { label: '滞后是不是弱积分', question: '为什么把滞后看成“更弱一点的积分”会带来错误判断？' },
    ],
    '只做错因归类和术语纠偏，不代替学生选择答案。',
  ),
  'step-04': context(
    'step-04',
    '双通道骨架：四类传函与总输出总误差',
    'practice',
    ['把给定与扰动的位置立住', '理解分母相同和分子不同的含义'],
    [
      { label: '分母为什么相同', question: '为什么 C/R、C/D、E/R、E/D 四类传函的分母相同？' },
      { label: '分子为什么不同', question: '为什么同一个闭环结构里，通道差异会体现在分子上？' },
    ],
    '允许解释通道位置、分子分母含义，不直接替学生完成热点标注。',
  ),
  'step-05': context(
    'step-05',
    '终值定理直接求：稳态误差的通用路径',
    'practice',
    ['把三步法固定为稳定-列式-极限', '理解直接求是通用路径'],
    [
      { label: '为什么先判稳定', question: '为什么用终值定理前必须先判断系统稳定？' },
      { label: '快判与直求关系', question: '为什么即使后面学了型别快判，终值定理直接求仍然是通用路径？' },
    ],
    '只帮助学生补齐推导链，不直接报出最终结果。',
  ),
  'step-06': context(
    'step-06',
    '型别与静态误差系数：什么时候能快速判断',
    'practice',
    ['区分 Kp/Kv/Ka 的适用边界', '把标准给定输入与显式扰动问题分开'],
    [
      { label: '何时能快判', question: '什么时候可以优先用型别和静态误差系数快速判断稳态误差？' },
      { label: '快判会漏什么', question: '如果把显式扰动问题也强行折成快判题，最容易漏掉什么？' },
    ],
    '当前页面只说明快判边界，不把所有问题都改写成套表题。',
  ),
  'step-07': context(
    'step-07',
    '复合例题：给定与扰动共同作用',
    'practice',
    ['保留总误差列式顺序', '纠正双输入问题只套表的误判'],
    [
      { label: '为什么先列总误差', question: '为什么给定与扰动共同存在时，第一步必须先写总误差式，而不是直接套表？' },
      { label: '0.4 从哪里来', question: '例题 2 的稳态误差 0.4 反映的是哪两条通道叠加后的结果？' },
    ],
    '允许解释总输出、总误差和双通道叠加，不允许把两个信号偷并成单一路径输入。',
  ),
  'step-08': context(
    'step-08',
    '增益变大 vs 型别提高',
    'quiz',
    ['把“压小有限误差”和“结构性归零”分开', '理解何时必须引入积分'],
    [
      { label: '为什么不是一回事', question: '为什么增益变大和型别提高都可能让误差变小，但它们不是同一种动作？' },
      { label: '什么时候必须积分', question: '遇到想把有限误差结构性变成 0 的目标时，为什么第一步常常是判断是否必须引入积分？' },
    ],
    '只帮助学生理解“压小”和“归零”的差别，不给具体整定步骤。',
  ),
  'step-09': context(
    'step-09',
    '低频补偿总览：PI、滞后与超前的结构差别',
    'practice',
    ['区分改型别与抬低频增益', '识别 PI 与滞后的收益/代价差异'],
    [
      { label: 'PI 的抓手', question: 'PI 为什么会直接改变型别，而滞后通常不会？' },
      { label: '滞后的抓手', question: '滞后怎样通过低频增益重分配来改善有限误差？' },
    ],
    '允许解释低频补偿直觉，不把滞后简化成“弱一点的积分”。',
  ),
  'step-10': context(
    'step-10',
    '时域 PI 设计：纯增益不够时为何必须改结构',
    'practice',
    ['把时域指标换成可行域', '理解 PI 如何把 I 型提高到 II 型'],
    [
      { label: '纯增益为什么不够', question: '为什么纯增益无论多大，都不能把斜坡误差从结构上变成 0？' },
      { label: 'PI 的首要作用', question: '在这个时域 PI 例题里，PI 的首要作用是改哪一层结构事实？' },
    ],
    '允许解释“纯增益局限 -> 可行域 -> PI 选点 -> 验证”的顺序，不直接替学生填写每一步答案。',
  ),
  'step-11': context(
    'step-11',
    '时域滞后设计：型别不变时怎样抬高低频增益',
    'practice',
    ['理解滞后零极点相对位置的作用', '区分 Kv 提升与型别提高'],
    [
      { label: '纯增益为什么失败', question: '为什么只靠纯增益把 Kv 提高到 10，会先跌出阻尼边界？' },
      { label: '滞后靠什么改善', question: '滞后怎样在不提高型别的前提下，把低频增益单独抬高？' },
    ],
    '只帮助学生理解零点在左、极点在右的物理意义，不把滞后说成弱积分。',
  ),
  'step-12': context(
    'step-12',
    '时域两法比较：收益、代价与适用场景',
    'practice',
    ['把 PI 与滞后的时域角色分开', '把比较页读成归纳页而不是再次求解页'],
    [
      { label: '谁负责归零', question: '为什么“斜坡误差为 0”天然更偏向 PI，而不是滞后？' },
      { label: '比较页该看什么', question: '时域两法比较时，为什么必须同时写收益、代价和适用场景？' },
    ],
    '当前页面只做归纳比较，不重新展开完整设计推导。',
  ),
  'step-13': context(
    'step-13',
    '频域 PI 设计：纯增益为何不能两头兼顾',
    'practice',
    ['理解 Kv、相位裕度与截止频率的冲突', '掌握频域 PI 的四步设计顺序'],
    [
      { label: '为什么纯增益不兼容', question: '为什么把 K 调到满足 Kv>=10 后，相位裕度会先变成主要矛盾？' },
      { label: '四步链怎么排', question: '频域 PI 设计为什么必须先定截止频率，再放零点，最后由幅值条件求 K？' },
    ],
    '允许解释频域设计顺序，不直接替学生给出最终控制器表达式。',
  ),
  'step-14': context(
    'step-14',
    '频域 PD 方案读取：速度优先方案的核验',
    'practice',
    ['理解本页是方案读取与核验', '把速度优先与精度优先分开'],
    [
      { label: '为什么不改型别', question: '给定的 PD 方案为什么仍是 I 型，因此斜坡误差不会结构性归零？' },
      { label: '速度优先体现在哪', question: '哪些核验指标说明这个 PD 方案更偏向动态速度优先？' },
    ],
    '本页只做方案读取与核验，不凭空补造一条讲义没有提供的完整整定链。',
  ),
  'step-15': context(
    'step-15',
    '频域两法比较：低频精度优先 vs 动态速度优先',
    'practice',
    ['把 PI 与 PD 的设计取向分开', '建立低频精度、截止频率、相位裕度与时域形态的统一比较语言'],
    [
      { label: '低频精度看谁', question: '为什么在频域比较里，“低频精度优先”更接近 PI，而“动态速度优先”更接近 PD？' },
      { label: '代价落点看哪里', question: '比较 PI 与 PD 时，低频精度、截止频率和相位裕度三项应如何一起看？' },
    ],
    '只帮助学生组织比较维度，不直接替学生完成对照表。',
  ),
  'step-16': context(
    'step-16',
    '后测：路径选择与方法判断',
    'quiz',
    ['检查学生会不会选直接求/快速判路径', '检查学生能否把方法与代价落点对应起来'],
    [
      { label: '什么时候直接求', question: '遇到哪些题型时，应该优先直接求，而不是先套型别和误差系数表？' },
      { label: '方法判断看哪里', question: '后测里若要区分 PI、滞后和 PD，应优先看哪类收益与代价线索？' },
    ],
    '当前页面只做后测点评和错因归类，不替学生逐题作答。',
  ),
  'step-17': context(
    'step-17',
    '收束与去向：规则表、信息图与 3-8 入口',
    'summary',
    ['把直接求与快速判的规则表带走', '理解 3-8 为什么自然承接本课'],
    [
      { label: '规则表怎么用', question: '面对标准给定输入、显式扰动和多项式输入三类题，规则表分别建议走哪条路径？' },
      { label: '为什么接到 3-8', question: '为什么 3-7 的“低频收益 / 中频代价 / 裕量变化”会自然过渡到 3-8？' },
    ],
    '本页只做工程视角、小结、规则表和去向说明，不再包含后测题。',
  ),
};

export function getUnit37StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_3_7_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit37StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_3_7_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_3_7StepAIContext = getUnit37StepAIContext;
export const getUNIT_3_7StepQuickQuestions = getUnit37StepQuickQuestions;
