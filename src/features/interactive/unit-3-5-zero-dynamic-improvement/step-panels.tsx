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
  UNIT_3_5_COURSE_TITLE,
  UNIT_3_5_LESSON_STEPS,
  UNIT_3_5_STAGE_LABEL,
  type UNIT_3_5StepDefinition,
  type UNIT_3_5StepResponse,
} from '@/lib/unit-3-5-course';
import {
  BAND_LABEL_OPTIONS,
  BRANCH_REGION_OPTIONS,
  COMPARE_NOTE_KEYWORDS,
  DERIVATION_FIELDS,
  IMPROVED_METRIC_OPTIONS,
  OBSERVATION_FOCUS_OPTIONS,
  PHASE_PEAK_OPTIONS,
  POST_QUIZ_QUESTIONS,
  PRETEST_QUESTIONS,
  RISK_TAG_OPTIONS,
  SCENARIO_CARDS,
  SCENARIO_SORT_COLUMNS,
  SENTENCE_REBUILD_TOKENS,
  STRUCTURED_COMPARE_FIELDS,
  TERM_EXPLAINER_KEYWORDS,
  REAL_AXIS_SEGMENT_OPTIONS,
  type WorkspaceParameterChange,
} from './workspace';

type Tone = 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';

interface StepSection {
  title: string;
  body?: string;
  bullets?: string[];
  formula?: string;
  tone?: Tone;
}

interface StepBlueprint {
  kicker: string;
  intro: string;
  sections: StepSection[];
  note?: string;
}

interface ChoiceOption {
  value: string;
  label: string;
}

export interface UNIT_3_5TeacherResponseItem {
  studentName: string;
  response: UNIT_3_5StepResponse;
}

function getToneClass(tone: Tone = 'slate') {
  return `premium-tone-${tone}`;
}

function getStepBlueprint(step: UNIT_3_5StepDefinition): StepBlueprint {
  switch (step.id) {
    case 'step-01':
      return {
        kicker: 'Map',
        intro: '3-5 承接 3-4 的“沿既有轨迹判断”，第一次正式回答“如果原轨迹本身已经不够理想，结构改变会怎样改写它的走法”。',
        sections: [
          {
            title: '路径定位',
            tone: 'cyan',
            bullets: ['3-4：沿既有根轨迹判断窗口、换算与三域证据。', '3-5：进入结构改变与零点边界。', '3-6：继续做统一对象实验与三域联动。'],
          },
          {
            title: '三个主问题',
            tone: 'amber',
            bullets: ['零点为什么不是更大增益的别名。', 'PD 与测速反馈为什么不能混成一个名字。', '右半平面零点为什么构成边界。'],
          },
        ],
      };
    case 'step-02':
      return {
        kicker: 'Outputs',
        intro: '本课始终围绕同一个对象做结构比较，不靠“换对象”偷换结论，最终要留下零点作用判断表、结构对比解释和风险边界卡三项固定产出。',
        sections: [
          {
            title: '四个比较版本',
            tone: 'cyan',
            bullets: ['纯极点基准', '左半平面零点改善', 'PD / 测速反馈动态改善', '右半平面零点边界'],
          },
          {
            title: '课堂边界',
            tone: 'rose',
            bullets: ['本课不进入模块 4 的完整超前整定。', '本课先建立判断语言，不把设计流程讲穿。'],
          },
        ],
      };
    case 'step-03':
      return {
        kicker: 'Pre-check',
        intro: '前测的目的不是判分，而是把“稳定就够了”“PD 等于测速反馈”“零点越靠右越好”这类起点误判显性化。',
        sections: [
          {
            title: 'AI 顺序约束',
            tone: 'amber',
            body: '必须先完成三题和一句直觉，再允许打开页内 AI。AI 在这里只做错因对照，不代替独立判断。',
          },
        ],
      };
    case 'step-04':
      return {
        kicker: 'Figure A',
        intro: '二阶纯极点对象最适合建立第一印象。你要先指出“哪条分支被拉走”，再说“实轴区段如何重排”，不能空泛地说更快。',
        sections: [
          {
            title: '判断顺序',
            tone: 'cyan',
            bullets: ['先看零点落在极点的左侧还是中间。', '再看一条分支会不会直接被零点牵走。', '最后看实轴上的可行区段是否被重新分配。'],
          },
        ],
      };
    case 'step-05':
      return {
        kicker: 'Figure B',
        intro: '三阶对象的重点不是“也更快了”，而是零点位置不同，主导分支被重新分配的方式也不同。',
        sections: [
          {
            title: '一句比较必须包含',
            tone: 'emerald',
            bullets: ['零点放在哪里', '哪一段主导分支被拉走', '终点分配或重排后果'],
          },
        ],
      };
    case 'step-06':
      return {
        kicker: 'Boundary',
        intro: '第一组结论先只压到这里：左半平面零点通常能改善动态，但右半平面零点先不要急着下“更快更好”的判断。',
        sections: [
          {
            title: '为什么要先留下问号',
            tone: 'amber',
            body: '因为右半平面零点会把“零点改善动态”变成带条件的结论，真正的危险要放到非最小相边界中再揭示。',
          },
        ],
      };
    case 'step-07':
      return {
        kicker: 'Structure',
        intro: 'PD 与测速反馈都能增大阻尼，但结构图不能混着认。测速反馈保留外环单位负反馈，同时在对象输入前叠加速度项反馈；它不显式增加前向零点。',
        sections: [
          {
            title: '辨认重点',
            tone: 'cyan',
            bullets: ['PD：前向通道显式增加零点。', '测速反馈：局部速度反馈改善阻尼，但不显式增加前向零点。'],
          },
        ],
      };
    case 'step-08':
      return {
        kicker: 'Formula',
        intro: '这一页必须把“公式看懂”推进到“会反求参数”。本例目标阻尼给定为 0.5，最终应推出 Kd = Kt = 0.3。',
        sections: [
          {
            title: '两条核心关系',
            tone: 'violet',
            formula: '\\zeta_{PD}=\\zeta+\\frac{1}{2}K_d\\omega_n,\\qquad \\zeta_v=\\zeta+\\frac{1}{2}K_t\\omega_n',
          },
          {
            title: '过程优先',
            tone: 'amber',
            body: '这一步反馈先检查代入链是否完整，再看最终数值是否正确，防止只背答案。',
          },
        ],
      };
    case 'step-09':
      return {
        kicker: 'Tri-domain',
        intro: '真正该留下的是“共同点”和“不同点”同时写出来。PD 与测速反馈都能提高阻尼，但根轨迹、时域和频域代价并不相同。',
        sections: [
          {
            title: '三域对照提醒',
            tone: 'emerald',
            bullets: ['共同点：都让系统先变得更不爱振荡。', '不同点：PD 显式增加前向零点；测速反馈不显式增加前向零点。', '三域图不能退化成单域标签页。'],
          },
        ],
      };
    case 'step-10':
      return {
        kicker: 'Integration',
        intro: '提高阻尼不等于结构相同。你需要把打散的关键词重组为一句完整结论，而不是只背一个“都能变稳”的口号。',
        sections: [
          {
            title: '本页要压成一句话',
            tone: 'cyan',
            body: '提高阻尼不等于结构相同，还要继续看零点位置与三域表现。',
          },
        ],
      };
    case 'step-11':
      return {
        kicker: 'PD Principle',
        intro: 'PD 单独装置先抬的是中高频幅值，随后把交叉频率往右推；对应的代价是高频代价与噪声放大风险。',
        sections: [
          {
            title: '频域主线',
            tone: 'amber',
            bullets: ['低频基本不动。', '拐点后中高频被抬起。', '高频代价不能被省略。'],
          },
          {
            title: '单独装置公式',
            tone: 'violet',
            formula: '|G_{PD}(j\\omega)|=\\sqrt{1+(\\omega T_d)^2},\\qquad \\phi_{PD}(\\omega)=\\arctan(\\omega T_d)',
          },
        ],
      };
    case 'step-12':
      return {
        kicker: 'Lead Principle',
        intro: '超前单独装置不是“更强的 PD”，它更像在关键频带制造相位峰，主动改善相角裕度。',
        sections: [
          {
            title: '关键结论',
            tone: 'cyan',
            bullets: ['相位峰应落在截止频率附近。', '页面必须明确指出改善的是相角裕度。'],
          },
          {
            title: '标准式',
            tone: 'violet',
            formula: '|G_{lead}(j\\omega)|=\\sqrt{\\frac{1+(\\omega T)^2}{1+(\\alpha\\omega T)^2}},\\qquad \\phi_{lead}(\\omega)=\\arctan(\\omega T)-\\arctan(\\alpha\\omega T)',
          },
        ],
      };
    case 'step-13':
      return {
        kicker: 'Design Rules',
        intro: '频域设计原则必须落成可迁移的动作：什么时候优先想 PD，什么时候优先想超前，什么时候两者都不够。',
        sections: [
          {
            title: '约束优先级',
            tone: 'emerald',
            bullets: ['只想抬交叉且能接受中高频抬升时，优先想 PD。', '想在关键频带补相角、改善相角裕度时，优先想超前。', '遇到非最小相或强噪声约束时，要先承认两者都不够。'],
          },
        ],
      };
    case 'step-14':
      return {
        kicker: 'NMP',
        intro: '非最小相必须同时从名字来源、时域逆响应和频域额外相位滞后三层来理解，不能只停在一句定义。',
        sections: [
          {
            title: '为什么叫非最小相',
            tone: 'rose',
            body: '右半平面零点会让系统相位不再是“最小可能值”，于是既可能出现逆响应，也会在频域上带来额外相位滞后。',
          },
        ],
      };
    case 'step-15':
      return {
        kicker: 'Post-check',
        intro: '后测的目标是把最危险的误判压下去，尤其是“零点就等于更大增益”“超前只是更强的 PD”“继续把带宽往上推就能压住逆响应”。',
        sections: [
          {
            title: 'AI 对照区锁定规则',
            tone: 'amber',
            body: '只有后测提交后，才允许打开 AI 对照区。AI 只做危险误判纠偏，不代写后测答案。',
          },
          {
            title: '边界提醒',
            tone: 'rose',
            body: '为什么非最小相对象往往要先保守带宽：因为右半平面零点会带来逆响应与额外相位滞后，盲目继续推高带宽通常会更早撞上边界。',
          },
        ],
      };
    case 'step-16':
      return {
        kicker: 'Wrap-up',
        intro: '最后带走四个观察量：先看根轨迹骨架是否被改写，再看结构里有没有显式前向零点，再看频域是抬交叉还是补相角，最后看对象有没有非最小相边界。',
        sections: [
          {
            title: '下一课去向',
            tone: 'violet',
            body: '3-6 会把今天的结构比较放到统一对象实验中，继续验证三域怎样联动变化。',
          },
        ],
      };
    default:
      return {
        kicker: 'Lesson',
        intro: step.hint,
        sections: [],
      };
  }
}

function getAiPrompts(step: UNIT_3_5StepDefinition) {
  switch (step.id) {
    case 'step-03':
      return ['请只帮我检查前测里的误判类型，不要直接替我回答三道题。'];
    case 'step-08':
      return ['请只检查我的 Kd / Kt 推导链是否完整，不要直接把最终数值写给我。'];
    case 'step-11':
      return ['请围绕 PD 的频域作用解释“抬交叉”和“高频代价”，不要直接代做标签。'];
    case 'step-15':
      return ['请只帮我纠正“继续把带宽往上推就能解决非最小相问题”这类危险误判，不要替我完成后测。'];
    default:
      return ['请围绕当前页面目标解释概念或检查我的作答思路，不要直接替我完成结论。'];
  }
}

function buildInteractiveAiConfig(step: UNIT_3_5StepDefinition): InteractiveConfig {
  return {
    resourceId: `unit-3-5:${step.id}`,
    registryId: `unit-3-5:${step.id}`,
    title: `${UNIT_3_5_COURSE_TITLE} · ${step.title}`,
    aiHints: `当前只围绕 ${step.title} 提供解释和检查，不替代学生完成最终判断。`,
    config: {
      ai: {
        enabled: true,
        persona: 'tutor',
      },
    },
  };
}

function getRevealContent(step: UNIT_3_5StepDefinition) {
  switch (step.id) {
    case 'step-03':
      return '参考口径：稳定不等于已经值得继续推进；PD 与测速反馈不能只按“都增阻尼”来混同；右半平面零点必须单独判断。';
    case 'step-04':
      return '参考提醒：先说哪条分支被零点拉走，再说实轴区段如何重排，不能只说“更快”。';
    case 'step-05':
      return '参考口径：零点位置不同，主导分支被重新分配的方式也不同。';
    case 'step-07':
      return '参考答案：测速反馈不显式增加前向零点，而 PD 会在前向通道显式增加零点。';
    case 'step-08':
      return '参考结果：本例目标阻尼为 0.5 时，可推出 Kd = Kt = 0.3；关键是推导链不能跳步。';
    case 'step-09':
      return '参考口径：共同点是都能提高阻尼；不同点是 PD 显式增加前向零点，而测速反馈不显式增加前向零点。';
    case 'step-10':
      return '参考句式：提高阻尼不等于结构相同，还要继续看零点位置与三域表现。';
    case 'step-11':
      return '参考口径：PD 的频域本质是抬升中高频幅值、推动截止频率右移，代价是高频代价与噪声放大。';
    case 'step-12':
      return '参考口径：超前更像在关键频带补相角，核心改善的是相角裕度。';
    case 'step-13':
      return '参考口径：PD 主打抬交叉，超前主打补相角；非最小相或强噪声约束下要先承认两者都不够。';
    case 'step-14':
      return '参考解释：非最小相意味着对象相位不再最小，典型后果是逆响应与额外相位滞后。';
    case 'step-15':
      return '参考口径：右半平面零点会带来逆响应与额外相位滞后，设计上通常先保守带宽，而不是继续盲目往上推。';
    default:
      return null;
  }
}

function supportsAnswerReveal(step: UNIT_3_5StepDefinition) {
  return !['display', 'risk_prediction_submit', 'exit_reflection'].includes(step.pageType);
}

function parseList(value?: string) {
  return String(value ?? '')
    .split('||')
    .map((item) => item.trim())
    .filter(Boolean);
}

function countAnswers(responses: UNIT_3_5TeacherResponseItem[]) {
  const counts = new Map<string, number>();
  for (const item of responses) {
    for (const value of Object.values(item.response.answers)) {
      for (const token of parseList(value)) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function getWordCloudEntries(responses: UNIT_3_5TeacherResponseItem[]) {
  const counts = new Map<string, number>();
  for (const item of responses) {
    const words = Object.values(item.response.answers)
      .join(' ')
      .split(/[\s,，。；;:：/|()（）]+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 2);
    for (const word of words) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
}

function renderChoiceButtons({
  options,
  value,
  onChange,
}: {
  options: readonly ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`premium-lesson-control ${value === option.value ? 'ring-2 ring-cyan-400' : ''}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="premium-lesson-input min-h-[120px] w-full"
      />
    );
  }

  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="premium-lesson-input w-full"
    />
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly ChoiceOption[];
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="premium-lesson-select w-full">
      <option value="">请选择</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function parseScenarioPlacements(value?: string) {
  const mapping = new Map<string, string>();
  for (const token of parseList(value)) {
    const [cardId, column] = token.split(':');
    if (cardId && column) {
      mapping.set(cardId, column);
    }
  }
  return mapping;
}

function serializeScenarioPlacements(mapping: Map<string, string>) {
  return Array.from(mapping.entries())
    .map(([cardId, column]) => `${cardId}:${column}`)
    .join('||');
}

export function UNIT_3_5KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft mb-4 px-4 py-4">
      <div className="premium-lesson-kicker">Module 3 Map</div>
      <h2 className="premium-lesson-title mt-2 text-xl font-semibold">从 3-4 的读图判断，走向 3-5 的结构改变，再进入 3-6 的统一对象实验</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          { label: '3-4', title: '读图与验证', body: '负责窗口判断、增益换算与三域证据。', active: false },
          { label: '3-5', title: '零点与结构改变', body: '负责解释零点如何改写根轨迹与三域表现。', active: true },
          { label: '3-6', title: '统一对象实验', body: '负责把今天的结构比较放进统一对象实验。', active: false },
        ].map((item) => (
          <div key={item.label} className={`premium-lesson-surface-elevated px-4 py-4 ${item.active ? 'ring-2 ring-cyan-400' : ''}`}>
            <div className="premium-lesson-kicker">{item.label}</div>
            <div className="premium-lesson-title mt-2 text-base font-semibold">{item.title}</div>
            <div className="premium-lesson-muted mt-2 text-sm">{item.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function UNIT_3_5StepContentPanel({
  step,
  mediaSrc,
  mediaAlt,
}: {
  step: UNIT_3_5StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const blueprint = getStepBlueprint(step);

  return (
    <section className="premium-lesson-panel px-4 py-5">
      <div className="premium-lesson-kicker">
        {blueprint.kicker} · {UNIT_3_5_STAGE_LABEL[step.stage]}
      </div>
      <h2 className="premium-lesson-title mt-2 text-2xl font-semibold">{step.title}</h2>
      <p className="premium-lesson-muted mt-3 text-sm sm:text-base">{blueprint.intro}</p>

      {mediaSrc ? (
        <figure className="premium-lesson-surface-elevated mt-4 overflow-hidden px-4 py-4">
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-border/60 bg-background/60">
            <Image src={mediaSrc} alt={mediaAlt ?? step.title} fill className="object-contain" />
          </div>
          <figcaption className="premium-lesson-muted mt-2 text-xs">本页图示统一来自 runtime 正式课包，不回读 authoring 作为页面真值。</figcaption>
        </figure>
      ) : null}

      <div className="mt-4 grid gap-4">
        {blueprint.sections.map((section) => (
          <div key={section.title} className={`premium-lesson-tone-block ${getToneClass(section.tone)}`}>
            <div className="font-medium">{section.title}</div>
            {section.body ? <div className="mt-2 text-sm leading-7">{section.body}</div> : null}
            {section.formula ? <div className="mt-3 rounded-2xl bg-background/70 px-3 py-3 font-mono text-sm">{section.formula}</div> : null}
            {section.bullets?.length ? (
              <ul className="mt-3 grid gap-2 text-sm leading-7">
                {section.bullets.map((item) => (
                  <li key={item} className="ml-4 list-disc">
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>

      {blueprint.note ? <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">{blueprint.note}</div> : null}
    </section>
  );
}

export function UNIT_3_5StudentActivityForm({
  step,
  savedResponse,
  released,
  answerVisible,
  onSubmit,
  onWorkspaceParameterChange,
}: {
  step: UNIT_3_5StepDefinition;
  savedResponse?: UNIT_3_5StepResponse;
  released: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_3_5StepResponse) => void;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(savedResponse?.answers ?? {});

  useEffect(() => {
    setDraft(savedResponse?.answers ?? {});
  }, [savedResponse]);

  const submitted = Boolean(savedResponse);
  const locked = !released && step.pageType !== 'display';

  const updateDraft = (key: string, value: string, source: WorkspaceParameterChange['source'] = 'input') => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    onWorkspaceParameterChange?.({ key, value, source });
  };

  const submit = (answers: Record<string, string>) => {
    onSubmit({
      stepId: step.id,
      submittedAt: Date.now(),
      answers,
    });
  };

  const renderQuizGroup = (questions: typeof PRETEST_QUESTIONS | typeof POST_QUIZ_QUESTIONS) => (
    <div className="grid gap-4">
      {questions.map((question) => (
        <div key={question.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
          <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
          <div className="mt-3">
            {question.type === 'text' ? (
              <TextInput
                value={draft[question.key] ?? ''}
                onChange={(value) => updateDraft(question.key, value)}
                placeholder="写下你的判断与改正"
                multiline
              />
            ) : (
              renderChoiceButtons({
                options: question.options ?? [],
                value: draft[question.key] ?? '',
                onChange: (value) => updateDraft(question.key, value, 'button'),
              })
            )}
          </div>
        </div>
      ))}
      <button type="button" onClick={() => submit(draft)} className="premium-lesson-action-primary">
        {submitted ? '重新提交' : '提交'}
      </button>
    </div>
  );

  const renderBody = () => {
    switch (step.pageType) {
      case 'binary_choice':
        return (
          <div className="grid gap-4">
            {renderChoiceButtons({
              options: [
                { value: 'yes', label: '是，测速反馈在前向通道显式增加零点' },
                { value: 'no', label: '不是，测速反馈不显式增加前向零点' },
              ],
              value: draft.choice ?? '',
              onChange: (value) => updateDraft('choice', value, 'button'),
            })}
            <TextInput
              value={draft.reason ?? ''}
              onChange={(value) => updateDraft('reason', value)}
              placeholder="补一句结构辨认理由"
              multiline
            />
            <button type="button" onClick={() => submit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交判断' : '提交判断'}
            </button>
          </div>
        );
      case 'quiz_group':
        return renderQuizGroup(step.id === 'step-03' ? PRETEST_QUESTIONS : POST_QUIZ_QUESTIONS);
      case 'annotation_choice': {
        const selectedSegments = new Set(parseList(draft.segments));
        return (
          <div className="grid gap-4">
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">先标记哪条分支被零点拉走</div>
              <div className="mt-3">
                {renderChoiceButtons({
                  options: BRANCH_REGION_OPTIONS,
                  value: draft.branch ?? '',
                  onChange: (value) => updateDraft('branch', value, 'button'),
                })}
              </div>
            </div>
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">再勾选被重排的实轴区段</div>
              <div className="mt-3 grid gap-2">
                {REAL_AXIS_SEGMENT_OPTIONS.map((option) => {
                  const active = selectedSegments.has(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`premium-lesson-control justify-start ${active ? 'ring-2 ring-cyan-400' : ''}`}
                      onClick={() => {
                        if (active) selectedSegments.delete(option.value);
                        else selectedSegments.add(option.value);
                        updateDraft('segments', Array.from(selectedSegments).join('||'), 'button');
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <TextInput
              value={draft.note ?? ''}
              onChange={(value) => updateDraft('note', value)}
              placeholder="一句补充说明：你为什么这么判断？"
              multiline
            />
            <button type="button" onClick={() => submit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交判断' : '提交判断'}
            </button>
          </div>
        );
      }
      case 'compare_note':
        return (
          <div className="grid gap-4">
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">本句至少要覆盖这些关键词中的三项</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {COMPARE_NOTE_KEYWORDS.map((item) => (
                  <span key={item} className="premium-lesson-tone-pill premium-tone-slate">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <TextInput
              value={draft.compare_note ?? ''}
              onChange={(value) => updateDraft('compare_note', value)}
              placeholder="例如：零点放在更靠左的位置时，中间主导分支被更明显地拉走，终点分配随之改变。"
              multiline
            />
            <button type="button" onClick={() => submit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交比较句' : '提交比较句'}
            </button>
          </div>
        );
      case 'risk_prediction_submit':
        return (
          <div className="grid gap-4">
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">你现在对右半平面零点的第一判断是？</div>
              <div className="mt-3">
                {renderChoiceButtons({
                  options: RISK_TAG_OPTIONS,
                  value: draft.risk_tag ?? '',
                  onChange: (value) => updateDraft('risk_tag', value, 'button'),
                })}
              </div>
            </div>
            <TextInput
              value={draft.risk_reason ?? ''}
              onChange={(value) => updateDraft('risk_reason', value)}
              placeholder="写一句当前预测：为什么你先留下问号？"
              multiline
            />
            <button type="button" onClick={() => submit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交预测' : '提交预测'}
            </button>
          </div>
        );
      case 'worked_example_workspace':
        return (
          <div className="grid gap-4">
            {DERIVATION_FIELDS.map((field) => (
              <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                <div className="mt-3">
                  <TextInput
                    value={draft[field.key] ?? ''}
                    onChange={(value) => updateDraft(field.key, value)}
                    placeholder={field.label}
                    multiline={field.key === 'derivation' || field.key === 'check'}
                  />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => submit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交推导' : '提交推导'}
            </button>
          </div>
        );
      case 'structured_compare':
        return (
          <div className="grid gap-4">
            {STRUCTURED_COMPARE_FIELDS.map((field) => (
              <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                <div className="mt-3">
                  <TextInput
                    value={draft[field.key] ?? ''}
                    onChange={(value) => updateDraft(field.key, value)}
                    placeholder={field.label}
                    multiline
                  />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => submit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交三域对照' : '提交三域对照'}
            </button>
          </div>
        );
      case 'sentence_rebuild': {
        const builtTokens = parseList(draft.tokenOrder);
        return (
          <div className="grid gap-4">
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">点击下列关键词，重组一句完整结论</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {SENTENCE_REBUILD_TOKENS.map((token) => (
                  <button
                    key={token}
                    type="button"
                    className="premium-lesson-control"
                    onClick={() => updateDraft('tokenOrder', [...builtTokens, token].join('||'), 'button')}
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">当前句子</div>
              <div className="mt-3 min-h-[80px] rounded-2xl border border-border/60 px-3 py-3 text-sm leading-7">
                {builtTokens.length ? builtTokens.join(' ') : '尚未选择关键词'}
              </div>
            </div>
            <button type="button" onClick={() => submit({ tokenOrder: draft.tokenOrder ?? '' })} className="premium-lesson-action-primary">
              {submitted ? '重新提交句子' : '提交句子'}
            </button>
          </div>
        );
      }
      case 'frequency_band_labeling':
        return (
          <div className="grid gap-4">
            {[
              { key: 'band_low', title: '低频区' },
              { key: 'band_mid', title: '拐点后中高频区' },
              { key: 'band_high', title: '高频代价区' },
            ].map((field) => (
              <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{field.title}</div>
                <div className="mt-3">
                  <SelectField
                    value={draft[field.key] ?? ''}
                    onChange={(value) => updateDraft(field.key, value, 'select')}
                    options={BAND_LABEL_OPTIONS}
                  />
                </div>
              </div>
            ))}
            <TextInput
              value={draft.noise_risk ?? ''}
              onChange={(value) => updateDraft('noise_risk', value)}
              placeholder="一句话写出为什么高频代价不能被省略"
              multiline
            />
            <button type="button" onClick={() => submit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交频带标签' : '提交频带标签'}
            </button>
          </div>
        );
      case 'phase_peak_locator':
        return (
          <div className="grid gap-4">
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">相位峰应该落在哪里？</div>
              <div className="mt-3">
                {renderChoiceButtons({
                  options: PHASE_PEAK_OPTIONS,
                  value: draft.peak_band ?? '',
                  onChange: (value) => updateDraft('peak_band', value, 'button'),
                })}
              </div>
            </div>
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">这一步主要改善哪个指标？</div>
              <div className="mt-3">
                {renderChoiceButtons({
                  options: IMPROVED_METRIC_OPTIONS,
                  value: draft.metric ?? '',
                  onChange: (value) => updateDraft('metric', value, 'button'),
                })}
              </div>
            </div>
            <button type="button" onClick={() => submit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交定位' : '提交定位'}
            </button>
          </div>
        );
      case 'scenario_sort_matrix': {
        const defaultMapping = new Map(SCENARIO_CARDS.map((card) => [card.id, 'pd']));
        const mapping = parseScenarioPlacements(draft.scenarioPlacements);
        if (mapping.size === 0) {
          defaultMapping.forEach((value, key) => mapping.set(key, value));
        }
        return (
          <div className="grid gap-4">
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">把情境卡拖到对应列；如果放错，反馈会指出被忽略的约束。</div>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {SCENARIO_SORT_COLUMNS.map((column) => (
                <div
                  key={column.key}
                  className="premium-lesson-surface-elevated rounded-3xl px-4 py-4"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const cardId = event.dataTransfer.getData('text/plain');
                    if (!cardId) return;
                    const next = new Map(mapping);
                    next.set(cardId, column.key);
                    updateDraft('scenarioPlacements', serializeScenarioPlacements(next), 'drag');
                  }}
                >
                  <div className="premium-lesson-title text-sm font-medium">{column.title}</div>
                  <div className="mt-3 grid gap-3">
                    {SCENARIO_CARDS.filter((card) => (mapping.get(card.id) ?? 'pd') === column.key).map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        draggable
                        onDragStart={(event) => event.dataTransfer.setData('text/plain', card.id)}
                        className="premium-lesson-control justify-start text-left"
                      >
                        {card.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => submit({ scenarioPlacements: draft.scenarioPlacements ?? serializeScenarioPlacements(mapping) })}
              className="premium-lesson-action-primary"
            >
              {submitted ? '重新提交矩阵' : '提交矩阵'}
            </button>
          </div>
        );
      }
      case 'term_explainer':
        return (
          <div className="grid gap-4">
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">建议至少带上这些关键词中的两项</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {TERM_EXPLAINER_KEYWORDS.map((item) => (
                  <span key={item} className="premium-lesson-tone-pill premium-tone-slate">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <TextInput
              value={draft.explainer ?? ''}
              onChange={(value) => updateDraft('explainer', value)}
              placeholder="非最小相这个名字的来源是 ________"
              multiline
            />
            <button type="button" onClick={() => submit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交解释' : '提交解释'}
            </button>
          </div>
        );
      case 'exit_reflection':
        return (
          <div className="grid gap-4">
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">以后你打算先盯住哪一个观察量？</div>
              <div className="mt-3">
                {renderChoiceButtons({
                  options: OBSERVATION_FOCUS_OPTIONS,
                  value: draft.focus ?? '',
                  onChange: (value) => updateDraft('focus', value, 'button'),
                })}
              </div>
            </div>
            <TextInput
              value={draft.reflection ?? ''}
              onChange={(value) => updateDraft('reflection', value)}
              placeholder="写一句：我以后会先看哪一个观察量，为什么"
              multiline
            />
            <button type="button" onClick={() => submit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交反思' : '提交反思'}
            </button>
          </div>
        );
      default:
        return <div className="premium-lesson-muted text-sm">本页以静态内容为主，无需提交。</div>;
    }
  };

  if (step.pageType === 'display') {
    return (
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">本页无需提交</div>
        <SubmissionStatus submitted={false} idleText="本页以静态阅读、教师推进和路径建立为主，不需要学生提交作答。" />
      </section>
    );
  }

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">学生作答区</div>
      <p className="premium-lesson-muted mt-2 text-sm">{locked ? '教师尚未释放本页互动，请先阅读上方静态内容。' : '按本页契约完成记录、判断与提交。'}</p>
      {locked ? <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">当前互动尚未释放。</div> : <div className="mt-4">{renderBody()}</div>}
      <SubmissionStatus submitted={submitted} />
      {answerVisible && getRevealContent(step) ? (
        <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm leading-7">{getRevealContent(step)}</div>
      ) : null}
    </section>
  );
}

export function UNIT_3_5TeacherActivitySummary({
  step,
  responses,
  released,
  answerVisible,
  onToggleRelease,
  onToggleAnswerVisible,
}: {
  step: UNIT_3_5StepDefinition;
  responses: UNIT_3_5TeacherResponseItem[];
  released: boolean;
  answerVisible: boolean;
  onToggleRelease: () => void;
  onToggleAnswerVisible: () => void;
}) {
  const counts = useMemo(() => countAnswers(responses), [responses]);
  const wordCloud = useMemo(() => getWordCloudEntries(responses), [responses]);

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="premium-lesson-title text-sm font-medium">教师汇总</div>
          <div className="premium-lesson-muted mt-1 text-sm">当前收到 {responses.length} 份本页作答。</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onToggleRelease} className="premium-lesson-action-secondary">
            {released ? '撤回互动' : '释放互动'}
          </button>
          <button
            type="button"
            onClick={onToggleAnswerVisible}
            disabled={!supportsAnswerReveal(step)}
            className="premium-lesson-action-primary disabled:opacity-40"
          >
            {answerVisible ? '隐藏参考答案' : '显示参考答案'}
          </button>
        </div>
      </div>

      {counts.length ? (
        <div className="mt-4 grid gap-2">
          {counts.slice(0, 8).map(([label, count]) => (
            <div key={label} className="premium-lesson-surface-elevated flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm">
              <span>{label}</span>
              <span className="premium-lesson-caption">{count} 人</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="premium-lesson-muted mt-4 text-sm">本页暂无学生提交。</div>
      )}

      {responses.length ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="premium-lesson-surface-elevated px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">最近提交</div>
            <div className="mt-3 grid gap-3">
              {responses.slice(0, 6).map((item) => (
                <div key={`${item.studentName}-${item.response.submittedAt}`} className="rounded-2xl border border-border/60 px-3 py-3 text-sm">
                  <div className="font-medium">{item.studentName}</div>
                  <div className="mt-2 grid gap-2">
                    {Object.entries(item.response.answers).map(([key, value]) => (
                      <div key={key}>
                        <span className="premium-lesson-muted">{key}：</span>
                        <span>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {wordCloud.length ? (
            <div className="premium-lesson-surface-elevated px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">关键词速览</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {wordCloud.map(([word, count]) => (
                  <span key={word} className="premium-lesson-tone-pill premium-tone-slate">
                    {word} · {count}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function UNIT_3_5StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_3_5StepResponse>;
}) {
  const finishedSteps = UNIT_3_5_LESSON_STEPS.filter((step) => responses[step.id]);

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">本课学习小结</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        你已完成 {finishedSteps.length} / {UNIT_3_5_LESSON_STEPS.length} 个互动环节。
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {['零点重排', '结构辨认', '频域原则', '边界意识'].map((keyword) => (
          <div key={keyword} className="premium-lesson-surface-elevated px-4 py-3 text-sm">
            <div className="font-medium">{keyword}</div>
            <div className="premium-lesson-muted mt-1">这是 3-5 结束时必须能带走的判断锚点。</div>
          </div>
        ))}
      </div>
      <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm">
        你已经把“零点改写骨架、结构辨认、频域整形、非最小相边界”串成一条判断链，下一课会把它们放进统一对象实验。
      </div>
    </section>
  );
}

export function UNIT_3_5StepAiAssistant({
  step,
  onAiEvent,
  disabled = false,
  disabledReason,
}: {
  step: UNIT_3_5StepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const prompts = getAiPrompts(step);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const ai = useInteractiveAI({
    config: buildInteractiveAiConfig(step),
    contextData: {
      lessonId: '3-5',
      stepId: step.id,
      prompts,
    },
    onEvent: onAiEvent,
  });

  useEffect(() => {
    if (!copiedPrompt) return undefined;
    const timer = window.setTimeout(() => setCopiedPrompt(null), 1200);
    return () => window.clearTimeout(timer);
  }, [copiedPrompt]);

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4" />
        页内 AI 助手
      </div>
      <p className="premium-lesson-muted mt-2 text-sm">
        当前只围绕 {step.title} 回答问题，帮助你检查概念、推导链和误判纠偏，不替你直接下最终结论。
      </p>
      <div className="mt-4 grid gap-3">
        {prompts.map((prompt) => (
          <div key={prompt} className="premium-lesson-surface-elevated flex flex-wrap items-start justify-between gap-3 px-4 py-4">
            <div className="text-sm leading-7">{prompt}</div>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(prompt);
                setCopiedPrompt(prompt);
              }}
              className="premium-lesson-control shrink-0"
            >
              <Copy className="h-4 w-4" />
              {copiedPrompt === prompt ? '已复制' : '复制提示词'}
            </button>
          </div>
        ))}
      </div>

      {disabled ? <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">{disabledReason ?? '当前步骤尚未满足 AI 解锁条件。'}</div> : null}

      <button type="button" onClick={disabled ? undefined : ai.togglePanel} disabled={disabled} className="premium-lesson-action-primary mt-4 disabled:opacity-40">
        打开页内 AI
      </button>

      <Dialog open={ai.isPanelOpen} onOpenChange={ai.togglePanel}>
        <DialogContent className="max-w-5xl border-none bg-transparent p-0 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>{step.title} AI 助手</DialogTitle>
            <DialogDescription>用于概念解释、推导链核对和误判纠偏。</DialogDescription>
          </DialogHeader>
          <InteractiveAIPanel ai={ai} title={`${step.title} · AI 助手`} position="floating" onClose={ai.togglePanel} />
        </DialogContent>
      </Dialog>
    </section>
  );
}
