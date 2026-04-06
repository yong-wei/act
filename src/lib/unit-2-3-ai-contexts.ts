import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_2_3_COURSE_META = {
  courseId: 'unit-2-3-frequency-response-bode-intro-v1',
  courseTitle: '2-3：频率响应基础与 Bode 图初步——从时域现象到频域图形入口',
  courseDescription:
    '围绕频率分量思想、正弦稳态响应、G(jω)、幅频/相频语言与 Bode 首轮骨架，完成从时域现象到频域图形对象的第一轮切换。',
  keyConcepts: ['频率分量', '正弦稳态响应', 'G(jω)', '幅频特性', '相频特性', 'Bode 图', '转折频率'],
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
    courseId: UNIT_2_3_COURSE_META.courseId,
    courseTitle: UNIT_2_3_COURSE_META.courseTitle,
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

export const UNIT_2_3_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  'step-01': context(
    'step-01',
    '课程定位：从时间响应切到频率响应对象',
    'theory',
    ['理解 2-3 在模块 2 中承上启下的位置', '明确本课先建立频域语言，不进入判据与裕度'],
    [
      { label: '为什么换域', question: '为什么学完 2-2 的时间响应后，自然会进入 2-3 的频率响应？' },
      { label: '本课边界', question: '2-3 真正要建立的频域对象语言是什么？' },
    ],
    '当前步骤只做地图定位。请帮助学生把“时间里的表现”与“不同频率如何被处理”这两个观察层次区分开，不要提前展开判稳或裕度。',
  ),
  'step-02': context(
    'step-02',
    '系统为什么会挑节奏',
    'quiz',
    ['建立低频命令与高频扰动会被系统区别对待的直觉', '理解频率选择性是本课真正入口'],
    [
      { label: '低频命令', question: '为什么低频命令往往更容易被系统跟随？' },
      { label: '高频扰动', question: '为什么系统不应该去追每一次高频抖动？' },
    ],
    '当前步骤只帮助学生建立“系统对不同节奏有选择”这一直觉，不要提前给出 G(jω) 公式。',
  ),
  'step-03': context(
    'step-03',
    '本课主线：频率分量 -> 正弦响应 -> G(jω) -> Bode 骨架',
    'theory',
    ['明确三项目标：会拆频率成分、会读单频响应、会画首轮骨架'],
    [
      { label: '三项目标', question: '为什么这节课要先会拆、再会读、最后会画？' },
      { label: '主线链', question: '“频率分量 -> 正弦响应 -> G(jω) -> Bode” 这条链各自回答什么问题？' },
    ],
    '请帮助学生建立全课预期，不展开细节推导。重点是让学生知道本课不是傅里叶长推导课，也不是判据课。',
  ),
  'step-04': context(
    'step-04',
    '前测：低频、高频与正弦输入判断',
    'quiz',
    ['暴露“同频不等于同幅”“滤掉高频更平滑”等起点误区'],
    [
      { label: '同频不等于同幅', question: '为什么输出和输入同频，不等于输出幅值也不变？' },
      { label: '平滑原因', question: '为什么抑制高频后，时域波形通常会更平滑？' },
    ],
    '当前步骤用于暴露起点误区，不直接替学生作答。请把错因聚焦到“频率、幅值、相位是不同维度”上。',
  ),
  'step-05': context(
    'step-05',
    '从时域问题走向频域问题',
    'practice',
    ['完成从“整体曲线”到“按频率逐项观察”的视角切换'],
    [
      { label: '为什么不替代', question: '为什么说频域分析不是替代时域分析，而是换一种观察对象的方式？' },
      { label: '天然测试信号', question: '为什么正弦输入特别适合作为频域分析的测试信号？' },
    ],
    '请帮助学生把“时域看整体、频域看规则”说清楚，不直接给短答模板。',
  ),
  'step-06': context(
    'step-06',
    '方波、频率分量与重构直觉',
    'workspace',
    ['理解复杂信号可以拆成频率分量', '理解系统先分别响应再叠加重构'],
    [
      { label: '为什么能重构', question: '为什么系统分别响应各频率分量后，还能叠加回一个时域输出？' },
      { label: '高频被压制', question: '为什么高频被压制后，波形会从尖锐转向平滑？' },
    ],
    '当前步骤依赖可视化观察。请围绕“拆分、分别处理、再重构”三段主链解释，不要下滑到傅里叶长推导。',
  ),
  'step-07': context(
    'step-07',
    '正弦输入为何导向同频输出',
    'practice',
    ['掌握“频率不变、幅值改变、相位改变”三条结论', '能用同频输出解释正弦为何是天然测试信号'],
    [
      { label: '哪项不变', question: '为什么在正弦稳态下，输出频率保持不变？' },
      { label: '哪项会变', question: '输出相对于输入到底改变了哪两项？' },
    ],
    '请把三条结论分别对应到频率、幅值、相位，不要混成一句模糊表述。',
  ),
  'step-08': context(
    'step-08',
    '幅值变化与相位变化的物理意义',
    'workspace',
    ['把波形差异翻译成“放大/衰减、提前/滞后”的工程语言'],
    [
      { label: '幅值语言', question: '幅值变化为什么可以理解为“通过得更多或更少”？' },
      { label: '相位语言', question: '相位变化在时间轴上应怎样直观理解？' },
    ],
    '当前步骤重点是物理语言翻译，不新增数学推导。请帮助学生把图像现象说成工程判断。',
  ),
  'step-09': context(
    'step-09',
    '频率特性、幅频特性与相频特性',
    'practice',
    ['建立 G(jω)、M(ω)、φ(ω) 三项定义之间的对应关系'],
    [
      { label: 'G(jω)', question: 'G(jω) 作为频率特性，和 M(ω)、φ(ω) 分别是什么关系？' },
      { label: '回答什么问题', question: '幅频和相频各自主要回答系统的什么问题？' },
    ],
    '请帮助学生把对象、定义和问题域三者一一配对，不要只背公式名字。',
  ),
  'step-10': context(
    'step-10',
    '为什么可以令 s=jω',
    'practice',
    ['理解这不是抛弃拉氏方法，而是沿虚轴观察正弦稳态'],
    [
      { label: '虚轴限制', question: '为什么讨论正弦稳态响应时，只需要观察虚轴信息？' },
      { label: '不是抛弃', question: '为什么说令 s=jω 不是抛弃拉氏方法？' },
    ],
    '当前步骤要纠正常见误区：不是把 s 域丢掉，而是沿虚轴取一个特别适合观察正弦稳态的切片。',
  ),
  'step-11': context(
    'step-11',
    '为什么要画 Bode 图',
    'practice',
    ['理解对数坐标、dB 表达和乘法变加法的三条理由'],
    [
      { label: '为什么用 dB', question: '为什么幅值常改写成 dB 表达？' },
      { label: '为什么用对数轴', question: '频率坐标为什么更适合用对数轴？' },
    ],
    '请把“三条理由”解释成可读性、范围压缩和组合便利，不要把 Bode 图讲成死记作图规则。',
  ),
  'step-12': context(
    'step-12',
    '典型环节 Bode 第一判断',
    'practice',
    ['先认典型对象，再做第一轮通过/抑制/相位滞后判断'],
    [
      { label: '先认对象', question: '为什么典型环节的第一步是识别对象，而不是直接硬画？' },
      { label: '第一判断', question: '一阶惯性环节的低频、转折附近和高频分别该怎样描述？' },
    ],
    '当前步骤强调“先认对象再判断”。请帮助学生把卡片分类建立在对象直觉上，而不是猜测答案。',
  ),
  'step-13': context(
    'step-13',
    'Bode 骨架四步法',
    'workspace',
    ['掌握“写标准型 -> 列转折频率 -> 判低频 -> 画趋势变化”四步法'],
    [
      { label: '为什么先标准型', question: '为什么手绘骨架前要先把对象写成标准型？' },
      { label: '转折频率', question: '遗漏转折频率时，骨架最容易错在哪里？' },
    ],
    '请帮助学生坚持四步顺序。当前只做首轮骨架，不展开复杂组合对象或精确修正。',
  ),
  'step-14': context(
    'step-14',
    '例题一：单一正弦输入下的稳态输出',
    'practice',
    ['把题面、模值、相位和最终表达式按顺序串起来'],
    [
      { label: '先算什么', question: '单一正弦输入例题里，为什么先求 |G(jω)| 和相位，再写最终输出？' },
      { label: '结果解释', question: '最终表达式里的幅值变化和相位滞后各自意味着什么？' },
    ],
    '当前步骤重点是解题链顺序，不要让学生一上来就混着代多个量。',
  ),
  'step-15': context(
    'step-15',
    '例题二：多频输入重塑过程与 AI 对照',
    'reflection',
    ['先独立写出分量处理顺序，再用 AI 对照推理链'],
    [
      { label: '先自己判断', question: '在向 AI 对照前，我应该先自己写出哪几步频率分量处理顺序？' },
      { label: 'AI 对照重点', question: '和 AI 对照时，最应该核对的是最终结果还是每个分量的处理理由？' },
    ],
    '这一页必须坚持“先独立分析，后 AI 对照”。AI 只负责检查分量处理顺序、重构逻辑和解释链，不替学生直接给结论。',
  ),
  'step-16': context(
    'step-16',
    '后测：对象会读，更要会画',
    'quiz',
    ['检查是否能把频域对象语言迁移到读图和解释任务'],
    [
      { label: '会读与会画', question: '为什么后测不仅看会不会选答案，还要看会不会解释骨架趋势？' },
      { label: '迁移能力', question: '如果知道对象类型，却画不出趋势，通常卡在哪个步骤？' },
    ],
    '请帮助学生定位“认对象、找转折、判趋势、解释物理意义”四个环节中的卡点，不直接替后测作答。',
  ),
  'step-17': context(
    'step-17',
    '总结与前瞻：走向 Nyquist 与频域指标',
    'summary',
    ['收束本课五条核心结论', '明确 2-4 将继续进入判稳和频域指标'],
    [
      { label: '五条结论', question: '这一课最该带走的五条频域结论是什么？' },
      { label: '后续连接', question: '为什么学完 Bode 首轮骨架后，下一步自然会进入 Nyquist 与频域指标？' },
    ],
    '当前步骤用于收束与迁移。请把学生从“会读对象”推进到“知道这套语言将如何支撑判稳与设计”。',
  ),
};

export function getUnit23StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_2_3_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit23StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_2_3_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_2_3StepAIContext = getUnit23StepAIContext;
export const getUNIT_2_3StepQuickQuestions = getUnit23StepQuickQuestions;
