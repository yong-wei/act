import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_3_7_COURSE_META = {
  courseId: 'unit-3-7-steady-error-low-frequency-compensation-v1',
  courseTitle: '3-7：型别、积分环节与稳态改善——PI 与滞后校正的低频补偿机理',
  courseDescription:
    '围绕给定/扰动双通道、终值定理与型别快判、PI/滞后低频补偿比较，把“为什么更准”推进成一条可执行的误差分析与补偿路径。',
  keyConcepts: ['双通道误差', '终值定理', '系统型别', '静态误差系数', 'PI', '滞后校正'],
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
    knowledgeType: 'X',
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
    '当前页面只做课程定位，不展开例题数值或补偿器整定。',
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
    '先分给定与扰动，再写总输出与总误差',
    'practice',
    ['把双通道位置立住', '理解分母相同和分子不同的含义'],
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
    'PI 与滞后都属于低频补偿，但抓手不同',
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
    '时域设计对比：PI 改型别，滞后抬低频',
    'practice',
    ['把两张设计图读成结构抓手与代价语言', '比较 PI 与滞后在时域指标上的不同结果'],
    [
      { label: 'PI 图上该看什么', question: 'PI 时域设计图上最能体现“提高型别”的证据是什么？' },
      { label: '滞后图上该看什么', question: '滞后时域设计图里，哪些量说明它没有改型别，但把 Kv 抬到了目标值？' },
    ],
    '只帮助学生归纳结构抓手、精度收益和动态代价，不代写完整比较答案。',
  ),
  'step-11': context(
    'step-11',
    '频域过渡：为什么 PI 更准、PD 更快',
    'practice',
    ['把低频收益与中频代价翻成频域语言', '为 3-8 的判别语言铺路'],
    [
      { label: '为什么纯增益不够', question: '为什么单纯把 K 调到满足 Kv>=10，常常会先在相位裕度上出问题？' },
      { label: 'PI 与 PD 差别', question: '为什么 PI 更偏低频精度优先，而 PD 更偏动态速度优先？' },
    ],
    '只解释低频、中频、带宽和裕量之间的关系，不展开完整 Nyquist 判据。',
  ),
  'step-12': context(
    'step-12',
    '后测与收束：先选路径，再认代价',
    'quiz',
    ['检查学生会不会选直接求/快速判路径', '把 3-7 平滑接到 3-8'],
    [
      { label: '什么时候直接求', question: '遇到哪些题型时，应该优先直接求而不是先套型别和误差系数表？' },
      { label: '为什么自然接到 3-8', question: '为什么 3-7 的低频收益和中频代价，会自然过渡到 3-8 的统一频域判别语言？' },
    ],
    '当前页面只做错因归类和总结，不替学生写最终小结。',
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
