'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Copy, Sparkles } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InteractiveAIPanel } from '@/features/interactive/InteractiveAIPanel';
import { useInteractiveAI } from '@/features/interactive/hooks/useInteractiveAI';
import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import type { InteractiveConfig } from '@/features/interactive/types';
import {
  UNIT_1_1_COURSE_TITLE,
  UNIT_1_1_LESSON_STEPS,
  UNIT_1_1_STAGE_LABEL,
  type UNIT_1_1StepDefinition,
  type UNIT_1_1StepResponse,
} from '@/lib/unit-1-1-course';
import { Unit11Workspace, type WorkspaceParameterChange } from './workspace';

type Tone = 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';

interface StepSection {
  title: string;
  body?: string;
  bullets?: string[];
  tone?: Tone;
}

interface ChoiceOption {
  value: string;
  label: string;
}

interface QuizQuestion {
  key: string;
  prompt: string;
  options: ChoiceOption[];
  answer: string;
  explanation: string;
}

interface FormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'radio';
  placeholder?: string;
  answer?: string;
  options?: ChoiceOption[];
}

interface ActivitySpec {
  kind: 'none' | 'quiz' | 'form';
  helper: string;
  submitLabel?: string;
  releaseLabel?: string;
  questions?: QuizQuestion[];
  fields?: FormField[];
}

interface StepBlueprint {
  kicker: string;
  intro: string;
  sections: StepSection[];
  prompts?: string[];
  note?: string;
}

export interface UNIT_1_1TeacherResponseItem {
  studentName: string;
  response: UNIT_1_1StepResponse;
}

function getToneClass(tone: Tone = 'slate') {
  return `premium-tone-${tone}`;
}

function getStepBlueprint(step: UNIT_1_1StepDefinition): StepBlueprint {
  switch (step.id) {
    case 'step-01':
      return {
        kicker: 'Map Reset',
        intro: '上一阶段我们用直觉看到了极点、响应和设计约束之间的关系。现在回到 1-1，把这些直觉翻译成可推导、可计算、可复用的数学语言。',
        sections: [
          {
            title: '课程主线',
            tone: 'cyan',
            bullets: ['L-1：传递函数是系统 DNA', 'L-sum：约束如何指引设计', '1-1：DNA 如何从微分方程中被提取出来'],
          },
        ],
      };
    case 'step-02':
      return {
        kicker: 'Ship Yaw Equation',
        intro: '船舶转向动力学由二阶微分方程描述。问题不是“能不能求”，而是“求得够不够快、够不够结构化”。',
        sections: [
          {
            title: '情境方程',
            tone: 'amber',
            body: 'Jθ¨ + Bθ˙ = Ku。要求解它，需要同时处理齐次解、特解和初始条件。',
          },
          {
            title: '投票焦点',
            bullets: ['求齐次解要先找特征根', '求特解依赖输入形式', '代入初始条件又是另一层运算'],
          },
        ],
      };
    case 'step-03':
      return {
        kicker: 'Lower Dimension',
        intro: '拉氏变换不是“又一个定义”，而是把微分问题重构成代数问题的工程工具。',
        sections: [
          {
            title: '降维流程',
            tone: 'emerald',
            bullets: ['时域微分方程', '拉氏变换', 's 域代数方程', '代数求解后再做反变换'],
          },
        ],
      };
    case 'step-04':
      return {
        kicker: 'Definition & Properties',
        intro: '定义式告诉我们“在做什么”，三条性质告诉我们“怎么用”，其中微分定理是整节课最重要的杠杆。',
        sections: [
          {
            title: '定义式',
            tone: 'cyan',
            body: 'F(s) = ∫_0^∞ f(t)e^{-st}dt',
          },
          {
            title: '三条性质',
            bullets: ['线性性：叠加可以直接带进变换', '微分定理：导数变乘 s，并带初始条件项', '积分定理：积分变除以 s'],
          },
        ],
      };
    case 'step-05':
      return {
        kicker: 'Zero Initial Condition',
        intro: '传递函数定义中的“零初始条件”不是装饰语，而是它能代表系统固有属性的前提。',
        sections: [
          {
            title: '核心定义',
            tone: 'violet',
            body: 'G(s)=Y(s)/U(s) | 零初始条件',
          },
          {
            title: '为什么要强调',
            bullets: ['初始条件会给微分定理额外项', '有额外项时，输出/输入之比不再只由系统决定'],
          },
        ],
      };
    case 'step-06':
      return {
        kicker: 'Three-Step Method',
        intro: '三步法不是只会解一道题，而是以后看到线性微分方程就能立即展开的套路。',
        sections: [
          {
            title: '三步法',
            tone: 'emerald',
            bullets: ['Step 1：两端取拉氏变换', 'Step 2：整理并提取输出项', 'Step 3：求输出/输入之比'],
          },
        ],
      };
    case 'step-07':
      return {
        kicker: 'RC Circuit',
        intro: 'RC 电路是最经典的一阶惯性环节。它把“公式套路”和“物理原型”连接在一起。',
        sections: [
          {
            title: '微分方程',
            tone: 'amber',
            body: 'RCu˙_o + u_o = u_i',
          },
          {
            title: '结论',
            bullets: ['G(s)=1/(RCs+1)', '它是惯性环节', '时间常数 T=RC'],
          },
        ],
      };
    case 'step-08':
      return {
        kicker: 'AI Verification',
        intro: '这里必须先手算、后 AI。AI 的职责是帮助你核对推理链，不是替你跳过第一步。',
        sections: [
          {
            title: '例题 2',
            tone: 'cyan',
            body: 'G(s)=5(s+2)/(s^2+3s+2)，求零点、极点，并注意是否出现零极点对消。',
          },
        ],
        prompts: [
          '请验证传递函数 G(s)=5(s+2)/(s^2+3s+2) 的零点、极点，以及是否存在零极点对消。',
          '请不要只给答案，请先说明分子分母如何因式分解，再说明对阶跃响应的影响。',
        ],
        note: '先写下自己的判断，再点击“向AI验证”，最后把你是否注意到零极点对消记录下来。',
      };
    case 'step-09':
      return {
        kicker: 'Standard Forms',
        intro: '同一个传递函数可以改写成两种阅读友好的形式：一种更方便读零极点，一种更方便读静态增益。',
        sections: [
          {
            title: '首一 vs 尾一',
            bullets: ['首一形式：读零极点', '尾一形式：读静态增益', '表示不同，但系统本质相同'],
          },
        ],
      };
    case 'step-10':
      return {
        kicker: 'Pole Families',
        intro: '把极点拖起来，看 L-2a 的四个响应家族如何在这里变成精确数学对应。',
        sections: [
          {
            title: '两个观察任务',
            tone: 'emerald',
            bullets: ['把实极点从 -2 拖到 -0.5，观察响应变慢', '把极点拖进复平面，观察响应开始振荡'],
          },
        ],
      };
    case 'step-11':
      return {
        kicker: 'Zero Effect',
        intro: '零点不会凭空创造新的模态，但会重新分配已有模态的权重。',
        sections: [
          {
            title: '观察重点',
            bullets: ['固定极点 -1 ± 2j', '拖动零点位置', '判断零点靠近极点时是否出现“压制”'],
          },
        ],
      };
    case 'step-12':
      return {
        kicker: 'Blocks: P & I',
        intro: '看到传递函数形式，就应该能快速说出它像什么物理积木块。',
        sections: [
          {
            title: '比例环节',
            tone: 'amber',
            body: 'G(s)=K，无动态过程，输出与输入成比例。',
          },
          {
            title: '积分环节',
            tone: 'cyan',
            body: 'G(s)=1/s，输出是输入的时间累积，极点落在原点。',
          },
        ],
      };
    case 'step-13':
      return {
        kicker: 'Blocks: Inertia & Oscillation',
        intro: '现在把典型环节从“会认公式”推进到“会看参数变化后的响应变化”。',
        sections: [
          {
            title: '两个参数',
            bullets: ['T：时间常数，决定一阶惯性快慢', 'ζ：阻尼比，决定二阶振荡是否明显'],
          },
        ],
      };
    case 'step-14':
      return {
        kicker: 'Mass-Spring-Damper',
        intro: '最后用弹簧-质量-阻尼器把物理图、微分方程、传递函数和标准形式贯成一条线。',
        sections: [
          {
            title: '已知参数',
            tone: 'violet',
            body: 'm=1, b=2, k=5',
          },
          {
            title: '目标',
            bullets: ['求传递函数标准形式', '读出 ω_n 和 ζ', '判断它为什么属于振荡环节'],
          },
        ],
      };
    default:
      return {
        kicker: 'Interactive Lesson',
        intro: step.hint,
        sections: [],
      };
  }
}

function getStepActivity(step: UNIT_1_1StepDefinition): ActivitySpec {
  switch (step.id) {
    case 'step-02':
      return {
        kind: 'quiz',
        helper: '教师释放投票后作答，提交后教师端会看到柱状统计。',
        submitLabel: '提交投票',
        releaseLabel: '释放投票',
        questions: [
          {
            key: 'difficulty',
            prompt: '你觉得直接求解这个方程最麻烦的是哪一步？',
            options: [
              { value: 'A', label: '求齐次解（特征根）' },
              { value: 'B', label: '求特解（待定系数）' },
              { value: 'C', label: '代入初始条件' },
              { value: 'D', label: '以上都麻烦' },
            ],
            answer: 'D',
            explanation: '这一步的目标不是找唯一“正确感受”，而是让学生意识到微分方程求解的负担是叠加的，拉氏变换的价值也正来自于此。',
          },
        ],
      };
    case 'step-04':
      return {
        kind: 'form',
        helper: '请先自己计算，再输入结果；教师端会看到文本汇总与词云。',
        submitLabel: '提交验证',
        releaseLabel: '释放练习',
        fields: [
          {
            key: 'laplaceDerivative',
            label: '对 f(t)=e^{-2t}，写出 L[f˙(t)] 的结果',
            type: 'text',
            placeholder: '例如：-2/(s+2)',
            answer: '-2/(s+2)',
          },
          {
            key: 'reasoning',
            label: '你是用微分定理还是查表验证的？简短说明',
            type: 'textarea',
            placeholder: '写下你的思路',
          },
        ],
      };
    case 'step-05':
      return {
        kind: 'quiz',
        helper: '判断题提交后会同步到教师端，教师可统一揭示答案。',
        submitLabel: '提交判断',
        releaseLabel: '释放练习',
        questions: [
          {
            key: 'zeroInitial',
            prompt: '“传递函数适用于任意初始条件。” 这句话对还是错？',
            options: [
              { value: 'T', label: '对' },
              { value: 'F', label: '错' },
            ],
            answer: 'F',
            explanation: '错。零初始条件是保证传递函数只反映系统固有属性的前提，否则微分定理会带来额外的初始条件项。',
          },
        ],
      };
    case 'step-08':
      return {
        kind: 'form',
        helper: '先写下自己的判断，再打开 AI 对照，最后提交修正或反思。',
        submitLabel: '提交反思',
        releaseLabel: '释放练习',
        fields: [
          {
            key: 'manualAnswer',
            label: '先写下自己的判断',
            type: 'textarea',
            placeholder: '零点、极点、是否对消？先独立写出来',
          },
          {
            key: 'noticedCancellation',
            label: '你在手算时是否注意到了零极点对消？',
            type: 'radio',
            options: [
              { value: 'yes', label: '是，我注意到了' },
              { value: 'no', label: '否，是 AI 提醒我的' },
            ],
          },
          {
            key: 'reflection',
            label: '一句话写下你这一步最大的修正',
            type: 'textarea',
            placeholder: '例如：我一开始只看到了分母的两个极点，忽略了分子也能因式分解',
          },
        ],
      };
    case 'step-09':
      return {
        kind: 'quiz',
        helper: '提交后教师端可直接统计大家更容易混淆的标准形式。',
        submitLabel: '提交选择',
        releaseLabel: '释放练习',
        questions: [
          {
            key: 'standardForm',
            prompt: '要分析系统稳态特性，通常更适合看哪种标准形式？',
            options: [
              { value: 'A', label: '首一形式' },
              { value: 'B', label: '尾一形式' },
            ],
            answer: 'B',
            explanation: '尾一形式更方便直接读取静态增益，也更适合在稳态分析里快速定位低频增益。',
          },
        ],
      };
    case 'step-10':
      return {
        kind: 'form',
        helper: '自由探索后提交你的观察，教师端会看到词云与回复列表。',
        submitLabel: '提交观察',
        releaseLabel: '释放练习',
        fields: [
          {
            key: 'observation',
            label: '用一句话描述：极点从 -2 拖到 -0.5 时，响应发生了什么变化？',
            type: 'textarea',
            placeholder: '例如：极点离虚轴更近，响应更慢',
          },
          {
            key: 'oscillation',
            label: '再描述：极点拖进复平面后，响应为什么开始振荡？',
            type: 'textarea',
            placeholder: '例如：出现虚部后，响应包含振荡模态',
          },
        ],
      };
    case 'step-11':
      return {
        kind: 'form',
        helper: '提交你对零点作用的理解，教师端默认折叠展示全班回复列表。',
        submitLabel: '提交零点结论',
        releaseLabel: '释放练习',
        fields: [
          {
            key: 'zeroEffect',
            label: '当零点靠近主导极点时，你观察到什么？',
            type: 'textarea',
            placeholder: '写出“压制模态”或你自己的解释',
          },
        ],
      };
    case 'step-12':
      return {
        kind: 'form',
        helper: '把传递函数与物理原型配对，目的是建立“看到式子就想到积木块”的直觉。',
        submitLabel: '提交匹配',
        releaseLabel: '释放练习',
        fields: [
          {
            key: 'proportional',
            label: '比例环节更像哪个物理原型？',
            type: 'radio',
            options: [
              { value: 'gear', label: '齿轮/杠杆变比' },
              { value: 'tank', label: '水箱液位' },
            ],
            answer: 'gear',
          },
          {
            key: 'integral',
            label: '积分环节更像哪个物理原型？',
            type: 'radio',
            options: [
              { value: 'gear', label: '齿轮/杠杆变比' },
              { value: 'tank', label: '水箱液位' },
            ],
            answer: 'tank',
          },
        ],
      };
    case 'step-13':
      return {
        kind: 'form',
        helper: '完成滑块操作后，提交你对参数变化与响应关系的总结。',
        submitLabel: '提交观察',
        releaseLabel: '释放练习',
        fields: [
          {
            key: 'dampingObservation',
            label: '将 ζ 从 0.1 调到 0.9 后，振荡如何变化？',
            type: 'textarea',
            placeholder: '例如：超调减小，振荡更快消失',
          },
        ],
      };
    case 'step-14':
      return {
        kind: 'form',
        helper: '综合例题提交后，教师端可查看全班参数计算是否扎实。',
        submitLabel: '提交综合例题',
        releaseLabel: '释放练习',
        fields: [
          {
            key: 'omegaN',
            label: '填写 ω_n',
            type: 'text',
            placeholder: '例如：sqrt(5) 或 2.24',
            answer: 'sqrt(5)',
          },
          {
            key: 'zeta',
            label: '填写 ζ',
            type: 'text',
            placeholder: '例如：1/sqrt(5) 或 0.45',
            answer: '1/sqrt(5)',
          },
          {
            key: 'whyOscillation',
            label: '为什么它属于振荡环节？',
            type: 'textarea',
            placeholder: '写出你对二阶标准形式和共轭复极点的理解',
          },
        ],
      };
    default:
      return {
        kind: 'none',
        helper: '本页以观察与讲授为主。',
      };
  }
}

function getAiPrompts(step: UNIT_1_1StepDefinition) {
  if (step.id !== 'step-08') {
    return [];
  }
  return getStepBlueprint(step).prompts ?? [];
}

function buildInteractiveAiConfig(step: UNIT_1_1StepDefinition): InteractiveConfig {
  return {
    resourceId: `unit11:${step.id}`,
    registryId: 'unit11-inline-ai',
    title: `${step.title} · 页内 AI 助手`,
    description: '当前课程页的就地 AI 对照助手',
    aiHints: `围绕 ${step.title} 进行讲解，只回答当前页面问题。`,
    config: {
      ai: {
        enabled: true,
        persona: 'tutor',
      },
      layout: {
        showAIPanel: true,
      },
    },
  };
}

function getDefaultDraft(activity: ActivitySpec, savedResponse?: UNIT_1_1StepResponse) {
  if (savedResponse) {
    return savedResponse.answers;
  }
  const defaults: Record<string, string> = {};
  for (const field of activity.fields ?? []) {
    defaults[field.key] = '';
  }
  for (const question of activity.questions ?? []) {
    defaults[question.key] = '';
  }
  return defaults;
}

function getWordCloudEntries(responses: UNIT_1_1TeacherResponseItem[]) {
  const counts = new Map<string, number>();
  for (const item of responses) {
    Object.values(item.response.answers)
      .join(' ')
      .split(/[\s,，。；;、/]+/)
      .map((value) => value.trim())
      .filter((value) => value.length >= 2)
      .forEach((value) => {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      });
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12);
}

function renderFieldValue(field: FormField | undefined, value: string) {
  if (!field) {
    return value || '未作答';
  }
  if (field.type !== 'radio') {
    return value || '未作答';
  }
  return field.options?.find((option) => option.value === value)?.label ?? value ?? '未作答';
}

export function UNIT_1_1KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft px-4 py-5">
      <div className="premium-lesson-kicker">Concept Bridge</div>
      <h2 className="premium-lesson-title mt-2 text-xl font-semibold">从 L-sum 回到 1-1：把直觉翻译成公式</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {[
          ['L-1', '系统 DNA 的直觉'],
          ['L-sum', '约束如何指引设计'],
          ['1-1', '微分方程如何提取成传递函数'],
          ['1-2', '多个积木块怎样组装'],
        ].map(([title, body], index) => (
          <div
            key={title}
            className={`premium-lesson-surface-elevated px-4 py-4 ${index === 2 ? 'ring-2 ring-[var(--interactive-accent-strong)]' : ''}`}
          >
            <div className="premium-lesson-title text-base font-semibold">{title}</div>
            <div className="premium-lesson-muted mt-2 text-sm">{body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function UNIT_1_1StepContentPanel({
  step,
  mediaSrc,
  mediaAlt,
  onWorkspaceParameterChange,
}: {
  step: UNIT_1_1StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const blueprint = useMemo(() => getStepBlueprint(step), [step]);

  return (
    <section className="premium-lesson-panel px-4 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="premium-lesson-tone-pill premium-tone-slate">{UNIT_1_1_STAGE_LABEL[step.stage]}</span>
        <span className="premium-lesson-tone-pill premium-tone-cyan">{blueprint.kicker}</span>
        <span className="premium-lesson-tone-pill premium-tone-amber">⏱ {step.duration}</span>
      </div>
      <h2 className="premium-lesson-title mt-4 text-2xl font-semibold">{step.title}</h2>
      <p className="premium-lesson-muted mt-3 text-sm leading-7">{blueprint.intro}</p>

      <div className="mt-5 grid gap-4">
        {blueprint.sections.map((section) => (
          <div key={section.title} className={`premium-lesson-tone-block ${getToneClass(section.tone)}`}>
            <div className="premium-lesson-title text-sm font-medium">{section.title}</div>
            {section.body ? <p className="mt-2 text-sm leading-7">{section.body}</p> : null}
            {section.bullets?.length ? (
              <div className="mt-3 grid gap-2">
                {section.bullets.map((bullet) => (
                  <div key={bullet} className="text-sm leading-7">
                    {bullet}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {blueprint.note ? <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">{blueprint.note}</div> : null}

      {mediaSrc ? (
        <figure className="premium-lesson-panel-soft mt-5 overflow-hidden px-4 py-4">
          <Image
            src={mediaSrc}
            alt={mediaAlt ?? step.title}
            width={1200}
            height={720}
            unoptimized
            className="mx-auto max-h-[420px] w-full rounded-2xl object-contain"
          />
        </figure>
      ) : null}

      {step.workspaceKind && step.workspaceKind !== 'none' ? (
        <div className="mt-5">
          <Unit11Workspace mode={step.workspaceKind} onParameterChange={onWorkspaceParameterChange} />
        </div>
      ) : null}
    </section>
  );
}

export function UNIT_1_1StudentActivityForm({
  step,
  savedResponse,
  released,
  answerVisible,
  onSubmit,
}: {
  step: UNIT_1_1StepDefinition;
  savedResponse?: UNIT_1_1StepResponse;
  released: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_1_1StepResponse) => void;
}) {
  const activity = useMemo(() => getStepActivity(step), [step]);
  const [draft, setDraft] = useState<Record<string, string>>(() => getDefaultDraft(activity, savedResponse));

  useEffect(() => {
    setDraft(getDefaultDraft(activity, savedResponse));
  }, [activity, savedResponse]);

  if (activity.kind === 'none') {
    return (
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">本页互动状态</div>
        <div className="premium-lesson-muted mt-2 text-sm">{activity.helper}</div>
      </section>
    );
  }

  if (!released) {
    return (
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">等待教师释放</div>
        <div className="premium-lesson-muted mt-2 text-sm">本题尚未开放，请先跟随教师讲解，等待教师释放后再作答。</div>
      </section>
    );
  }

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">学生作答区</div>
      <div className="premium-lesson-muted mt-2 text-sm">{activity.helper}</div>

      <div className="mt-4 grid gap-4">
        {activity.questions?.map((question) => (
          <div key={question.key} className="premium-lesson-surface-elevated px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
            <div className="mt-3 grid gap-2">
              {question.options.map((option) => (
                <label key={option.value} className="premium-lesson-control flex items-start gap-2">
                  <input
                    type="radio"
                    name={question.key}
                    checked={draft[question.key] === option.value}
                    onChange={() => setDraft((prev) => ({ ...prev, [question.key]: option.value }))}
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        {activity.fields?.map((field) => (
          <label key={field.key} className="premium-lesson-caption block text-xs">
            {field.label}
            {field.type === 'textarea' ? (
              <textarea
                value={draft[field.key] ?? ''}
                onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                placeholder={field.placeholder}
                className="premium-lesson-input mt-2 min-h-28"
              />
            ) : field.type === 'radio' ? (
              <div className="mt-2 grid gap-2">
                {field.options?.map((option) => (
                  <label key={option.value} className="premium-lesson-control flex items-center gap-2">
                    <input
                      type="radio"
                      name={field.key}
                      checked={draft[field.key] === option.value}
                      onChange={() => setDraft((prev) => ({ ...prev, [field.key]: option.value }))}
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            ) : (
              <input
                type={field.type}
                value={draft[field.key] ?? ''}
                onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                placeholder={field.placeholder}
                className="premium-lesson-input mt-2"
              />
            )}
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          onSubmit({
            stepId: step.id,
            submittedAt: Date.now(),
            answers: draft,
          })
        }
        className="premium-lesson-action-primary mt-5"
      >
        {activity.submitLabel ?? '提交'}
      </button>

      <SubmissionStatus
        submitted={Boolean(savedResponse)}
        submittedText="提交成功，教师端已收到你的作答。"
        idleText="提交后会同步到教师端汇总。"
      />

      {answerVisible && activity.questions?.length ? (
        <div className="premium-lesson-tone-block premium-tone-emerald mt-4">
          <div className="premium-lesson-title text-sm font-medium">正确答案</div>
          <div className="mt-3 grid gap-3">
            {activity.questions.map((question) => (
              <div key={question.key} className="text-sm leading-7">
                <div className="font-medium">{question.prompt}</div>
                <div>答案：{question.options.find((option) => option.value === question.answer)?.label ?? question.answer}</div>
                <div className="premium-lesson-muted">{question.explanation}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function UNIT_1_1TeacherActivitySummary({
  step,
  responses,
  released,
  answerVisible,
  onToggleRelease,
  onToggleAnswerVisible,
}: {
  step: UNIT_1_1StepDefinition;
  responses: UNIT_1_1TeacherResponseItem[];
  released: boolean;
  answerVisible: boolean;
  onToggleRelease: () => void;
  onToggleAnswerVisible: () => void;
}) {
  const activity = getStepActivity(step);
  const wordCloud = getWordCloudEntries(responses);

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="premium-lesson-title text-sm font-medium">教师端汇总</div>
          <div className="premium-lesson-muted mt-1 text-sm">当前步骤已收到 {responses.length} 份提交。</div>
        </div>
        {activity.kind !== 'none' ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onToggleRelease} className="premium-lesson-action-secondary">
              {released ? '已释放活动' : activity.releaseLabel ?? '释放活动'}
            </button>
            {(activity.questions?.length ?? 0) > 0 ? (
              <button type="button" onClick={onToggleAnswerVisible} className="premium-lesson-action-secondary">
                {answerVisible ? '已显示答案' : '显示答案'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {activity.questions?.length ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {activity.questions.map((question) => {
            const counts = question.options.map((option) => ({
              option,
              count: responses.filter((item) => item.response.answers[question.key] === option.value).length,
            }));
            return (
              <div key={question.key} className="premium-lesson-surface-elevated px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
                <div className="mt-3 grid gap-2">
                  {counts.map(({ option, count }) => (
                    <div key={option.value} className="flex items-center justify-between text-sm">
                      <span>{option.label}</span>
                      <span>{count} 人</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {activity.fields?.length ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="premium-lesson-surface-elevated px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">词云</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {wordCloud.length ? (
                wordCloud.map(([word, count]) => (
                  <span key={word} className="premium-lesson-tone-pill premium-tone-cyan">
                    {word} × {count}
                  </span>
                ))
              ) : (
                <span className="premium-lesson-muted text-sm">暂无文本提交，词云将在学生提交后出现。</span>
              )}
            </div>
          </div>

          <details className="premium-lesson-surface-elevated px-4 py-4">
            <summary className="premium-lesson-title cursor-pointer text-sm font-medium">学生回复列表</summary>
            <div className="mt-3 grid gap-3">
              {responses.length ? (
                responses.map((item) => (
                  <div key={`${item.studentName}-${item.response.submittedAt}`} className="rounded-2xl border border-border px-3 py-3 text-sm">
                    <div className="font-medium">{item.studentName}</div>
                    <div className="premium-lesson-muted mt-1 text-xs">
                      {new Date(item.response.submittedAt).toLocaleString('zh-CN', { hour12: false })}
                    </div>
                    <div className="mt-2 grid gap-2">
                      {Object.entries(item.response.answers).map(([key, value]) => {
                        const field = activity.fields?.find((candidate) => candidate.key === key);
                        return (
                          <div key={key}>
                            <span className="font-medium">{field?.label ?? key}：</span>
                            <span>{renderFieldValue(field, value)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="premium-lesson-muted text-sm">暂无学生提交。</div>
              )}
            </div>
          </details>
        </div>
      ) : null}
    </section>
  );
}

export function UNIT_1_1StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_1_1StepResponse>;
}) {
  const finishedSteps = UNIT_1_1_LESSON_STEPS.filter((step) => responses[step.id]);

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">本课学习小结</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        你已完成 {finishedSteps.length} / {UNIT_1_1_LESSON_STEPS.length} 个互动环节。
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {finishedSteps.map((step) => (
          <div key={step.id} className="premium-lesson-surface-elevated px-4 py-3 text-sm">
            <div className="font-medium">{step.title}</div>
            <div className="premium-lesson-muted mt-1">{step.hint}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function UNIT_1_1StepAiAssistant({
  step,
  onAiEvent,
}: {
  step: UNIT_1_1StepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}) {
  const prompts = getAiPrompts(step);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const ai = useInteractiveAI({
    config: buildInteractiveAiConfig(step),
    contextData: {
      lessonId: '1-1',
      stepId: step.id,
      prompts,
    },
    onEvent: onAiEvent,
  });

  useEffect(() => {
    if (!copiedPrompt) {
      return undefined;
    }
    const timer = window.setTimeout(() => setCopiedPrompt(null), 1200);
    return () => window.clearTimeout(timer);
  }, [copiedPrompt]);

  if (!prompts.length) {
    return null;
  }

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4" />
        页内 AI 助手
      </div>
      <p className="premium-lesson-muted mt-2 text-sm">
        先写下自己的判断，再用下面的提示词打开对照。AI 只围绕当前页面问题解释，不跳转离开课堂页。
      </p>
      <div className="mt-4 grid gap-3">
        {prompts.map((prompt) => (
          <div key={prompt} className="premium-lesson-surface-elevated flex flex-wrap items-start justify-between gap-3 px-4 py-4">
            <pre className="whitespace-pre-wrap text-sm leading-7 text-foreground">{prompt}</pre>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(prompt);
                setCopiedPrompt(prompt);
              }}
              className="premium-lesson-action-secondary"
            >
              <Copy className="h-4 w-4" />
              {copiedPrompt === prompt ? '已复制' : '复制提示词'}
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={ai.togglePanel} className="premium-lesson-action-primary mt-4">
        向AI验证
      </button>

      <Dialog open={ai.isPanelOpen} onOpenChange={ai.togglePanel}>
        <DialogContent className="max-w-5xl border-border bg-background p-0 text-foreground">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="premium-lesson-title">{UNIT_1_1_COURSE_TITLE} · 页内 AI 助手</DialogTitle>
            <DialogDescription className="premium-lesson-muted">
              围绕当前步骤进行解释、核对和反思，不离开课程页。
            </DialogDescription>
          </DialogHeader>
          <div className="h-[560px] overflow-hidden">
            <InteractiveAIPanel ai={ai} title={`${step.title} · 页内 AI 助手`} onClose={ai.togglePanel} position="right" />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
