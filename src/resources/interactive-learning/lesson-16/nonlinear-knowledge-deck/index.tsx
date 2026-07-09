'use client';

import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { KnowledgeDeck } from '@/resources/interactive-learning/shared/knowledge-deck';
import type { LessonKnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-cards-data';

const KNOWLEDGE_CARDS: LessonKnowledgeCard[] = [
  {
    id: '非线性系统_8_4ccc0148',
    name: '非线性系统的普遍性',
    nodeType: 'THEORY',
    description: '实际系统普遍存在饱和、死区、摩擦、间隙等非线性。',
    lessonId: 'lesson-16',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '工程系统中的执行机构、传感器与结构件往往具有工作区间与物理极限，导致“线性模型”只是局部近似。',
    applications: ['执行机构约束', '工程建模', '系统辨识'],
  },
  {
    id: '非线性系统_8_4ccc0148',
    name: '非线性系统的特殊性质',
    nodeType: 'THEORY',
    description: '不满足叠加原理，稳定性与初始条件、外作用密切相关。',
    lessonId: 'lesson-16',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '非线性系统可能存在多个平衡点与自持振荡，输入幅值改变会引发跃变与高次谐波。',
    applications: ['稳定性分析', '非线性控制', '故障诊断'],
  },
  {
    id: '描述函数法_8_849fa8a1',
    name: '谐波线性化',
    nodeType: 'METHOD',
    description: '用输出基波近似非线性响应，将问题转化为等效频域分析。',
    lessonId: 'lesson-16',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '将非线性环节在正弦输入下的输出展开为傅里叶级数，只保留基波分量作为近似。',
    formulaContinuous: 'y(t) \approx Y_1 \sin(\omega t + \varphi_1)',
    applications: ['描述函数法', '近似稳定性评估'],
  },
  {
    id: '描述函数法_8_849fa8a1',
    name: '描述函数定义',
    nodeType: 'METHOD',
    description: '描述函数是输出基波与输入正弦之间的复数比。',
    lessonId: 'lesson-16',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '对输入 x(t)=A\sin(\omega t)，输出基波为 Y_1 \sin(\omega t+\varphi_1)，描述函数记作 N(A)=Y_1/A ∠ \varphi_1。',
    formulaContinuous: 'N(A)=\frac{Y_1}{A}\angle\varphi_1',
    applications: ['频域等效', '自振判别'],
  },
  {
    id: '继电特性_8_0676d186',
    name: '理想继电器描述函数',
    nodeType: 'METHOD',
    description: '理想继电器的描述函数为幅值相关的实函数。',
    lessonId: 'lesson-16',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '理想继电器输出为 ±M，基波幅值与输入 A 成反比，因此 N(A) 随 A 增大而减小。',
    formulaContinuous: 'N(A)=\frac{4M}{\pi A}',
    applications: ['继电控制', '自振分析'],
  },
  {
    id: '饱和特性_8_e55b1fb5',
    name: '饱和特性描述函数',
    nodeType: 'METHOD',
    description: '饱和环节的描述函数与饱和幅值 a、斜率 k 相关。',
    lessonId: 'lesson-16',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '当输入幅值超过饱和值时，输出被限幅，N(A) 呈现幅值递减趋势。',
    formulaContinuous: 'N(A)=\frac{2k}{\pi}\left(\arcsin\frac{a}{A}+\frac{a}{A}\sqrt{1-\frac{a^2}{A^2}}\right)',
    applications: ['执行器限幅', '稳态自振估计'],
  },
  {
    id: '死区特性_8_9ed850fc',
    name: '死区特性描述函数',
    nodeType: 'METHOD',
    description: '死区使得小幅输入无法产生输出，描述函数随 A 增大而上升。',
    lessonId: 'lesson-16',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '死区导致输出基波削弱，N(A) 与 A 的关系体现了“有效输入区间”。',
    formulaContinuous: 'N(A)=\frac{2k}{\pi}\left(\frac{\pi}{2}-\arcsin\frac{a}{A}-\frac{a}{A}\sqrt{1-\frac{a^2}{A^2}}\right)',
    applications: ['测量死区补偿', '低幅响应评估'],
  },
  {
    id: '间隙特性_8_51523138',
    name: '滞环与间隙特性',
    nodeType: 'METHOD',
    description: '滞环/间隙导致描述函数出现复数相位滞后。',
    lessonId: 'lesson-16',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '非单值特性导致 A1 不为零，N(A) 包含虚部，体现输出对输入的相位滞后。',
    applications: ['齿隙补偿', '继电滞环分析'],
  },
];

interface NonlinearKnowledgeDeckProps extends BaseWidgetProps {}

export default function NonlinearKnowledgeDeck({ onComplete, onStateChange }: NonlinearKnowledgeDeckProps) {
  return (
    <KnowledgeDeck
      cards={KNOWLEDGE_CARDS}
      title="非线性系统知识卡片"
      description="从系统特性到描述函数的 8 张核心卡片"
      footer="先理解现象，再进入方法。"
      targetIconClassName="text-amber-500 dark:text-amber-300"
      onComplete={onComplete}
      onStateChange={onStateChange}
    />
  );
}
