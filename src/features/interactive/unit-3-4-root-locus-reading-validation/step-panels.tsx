'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Copy, Sparkles } from 'lucide-react';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InteractiveAIPanel } from '@/features/interactive/InteractiveAIPanel';
import { useInteractiveAI } from '@/features/interactive/hooks/useInteractiveAI';
import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import type { InteractiveConfig } from '@/features/interactive/types';
import {
  UNIT_3_4_COURSE_TITLE,
  UNIT_3_4_LESSON_STEPS,
  UNIT_3_4_STAGE_LABEL,
  type UNIT_3_4StepDefinition,
  type UNIT_3_4StepResponse,
} from '@/lib/unit-3-4-course';
import {
  EVIDENCE_DOMAIN_OPTIONS,
  FINAL_RANKING_OPTIONS,
  GAIN_CONVERSION_FIELDS,
  KEYNODE_OPTIONS,
  POST_QUIZ_QUESTIONS,
  READING_SEQUENCE_OPTIONS,
  TIME_DOMAIN_CHOICES,
  VERSION_OPTIONS,
  VERSION_PREDICTION_FIELDS,
  WINDOW_TAG_OPTIONS,
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

export interface UNIT_3_4TeacherResponseItem {
  studentName: string;
  response: UNIT_3_4StepResponse;
}

function getToneClass(tone: Tone = 'slate') {
  return `premium-tone-${tone}`;
}

function getStepBlueprint(step: UNIT_3_4StepDefinition): StepBlueprint {
  switch (step.id) {
    case 'step-01':
      return {
        kicker: 'Map',
        intro: '3-4 接在 3-3 之后，不再重讲法则证明，而是把法则压成可以直接执行的判断动作链。',
        sections: [
          {
            title: '路径定位',
            tone: 'cyan',
            bullets: ['3-3：建立根轨迹法则。', '3-4：把法则真正用到主图、参数窗口与工程后果。', '3-5：才进入结构改变。'],
          },
          {
            title: '本课主线',
            tone: 'emerald',
            bullets: ['关键节点读图', '参数窗口判断', '根轨迹增益换算', '对象化三域验证'],
          },
        ],
      };
    case 'step-02':
      return {
        kicker: 'Question',
        intro: '如果 A、B、C 都还稳定，是否就已经能直接说它们一样可用？本课先拆掉这个误判。',
        sections: [
          {
            title: '核心追问',
            tone: 'amber',
            body: '稳定只是底线，工程判断还必须继续比较窗口、换算与跨域后果。',
          },
        ],
      };
    case 'step-03':
      return {
        kicker: 'Outputs',
        intro: '本课有三项固定产出，且本轮只做判断与验证，不进入零点、PD 和设计整定。',
        sections: [
          {
            title: '三项固定产出',
            tone: 'cyan',
            bullets: ['关键节点读图记录', '参数窗口判断表', '对象化验证记录'],
          },
          {
            title: '课堂边界',
            tone: 'rose',
            bullets: ['不重讲法则证明', '不进入零点与结构改变', '不进入模块 4 的设计流程'],
          },
        ],
      };
    case 'step-04':
      return {
        kicker: 'Pre-check',
        intro: '前测只为暴露误区，不为拉开成绩。',
        sections: [
          {
            title: '三类高频误判',
            tone: 'amber',
            bullets: ['只看单一证据域', '稳定等于可接受', '把图上 k 直接当成控制器增益 K'],
          },
        ],
      };
    case 'step-05':
      return {
        kicker: 'Workflow',
        intro: '读图顺序一旦乱掉，后面所有排序、窗口与三域结论都会串层。',
        sections: [
          {
            title: '固定四步法',
            tone: 'cyan',
            bullets: READING_SEQUENCE_OPTIONS.map((item) => item.label),
          },
        ],
      };
    case 'step-06':
      return {
        kicker: 'Workspace A',
        intro: '先写第一眼预测，后续再用关键节点、窗口和三域证据修正。',
        sections: [
          {
            title: '三问',
            tone: 'emerald',
            bullets: ['谁最慢', '谁最平衡', '谁最冒险'],
          },
        ],
      };
    case 'step-07':
      return {
        kicker: 'Workspace B',
        intro: '关键节点不是装饰，它们直接决定后续窗口、换算和版本判断。',
        sections: [
          {
            title: '四类关键节点',
            tone: 'cyan',
            bullets: ['分离点', '虚轴交点', '主导极点候选', '稳定窗口边界'],
          },
        ],
      };
    case 'step-08':
      return {
        kicker: 'Workspace C',
        intro: '稳定窗口回答“还能不能工作”，可接受窗口回答“值不值得继续用”。',
        sections: [
          {
            title: '双窗口逻辑',
            tone: 'amber',
            body: '稳定窗口不等于可接受窗口。真正的工程判断必须把两层窗口分开。',
          },
        ],
      };
    case 'step-09':
      return {
        kicker: 'Workspace D',
        intro: '图上先读到的是根轨迹增益，工程上最终要使用的是控制器增益。',
        sections: [
          {
            title: '核心换算',
            tone: 'violet',
            formula: 'k = 0.01715K',
          },
          {
            title: '换算提醒',
            tone: 'amber',
            body: '先换算，再下工程判断，不能把图上 k 直接当成 K。',
          },
        ],
      };
    case 'step-10':
      return {
        kicker: 'AI Compare',
        intro: 'AI 这一步的职责是检查换算链是否完整，不负责替你给出版本排序。',
        sections: [
          {
            title: 'AI 边界',
            tone: 'rose',
            bullets: ['可检查公式和变量含义', '可提醒漏步', '不可直接给 A/B/C 最终结论'],
          },
        ],
      };
    case 'step-11':
      return {
        kicker: 'Workspace E',
        intro: '时域回查要把“主图上的直觉”翻译成真正可见的动态差异。',
        sections: [
          {
            title: '版本含义卡',
            tone: 'cyan',
            bullets: ['A 保守但慢', 'B 最像参考工作点', 'C 仍稳定但风险感更强'],
          },
        ],
      };
    case 'step-12':
      return {
        kicker: 'Workspace F',
        intro: '频域回查不是额外附赠项，而是把风险为什么会先暴露真正说清楚。',
        sections: [
          {
            title: '频域追问',
            tone: 'amber',
            body: '哪个版本的风险在频域里最先暴露？为什么“还没失稳”不等于“频域仍然舒服”？',
          },
        ],
      };
    case 'step-13':
      return {
        kicker: 'Post-check',
        intro: '后测不是再做一遍题，而是检查你是否真的形成了完整工程判断链。',
        sections: [
          {
            title: '解释题提醒',
            tone: 'emerald',
            bullets: ['至少说出两个关键词：关键节点 / 窗口 / 换算 / 三域', '不要只给排序，不给证据'],
          },
        ],
      };
    case 'step-14':
      return {
        kicker: 'Wrap-up',
        intro: '只调增益会很快碰到边界，这正是下一课要转向结构改变的原因。',
        sections: [
          {
            title: '本课收束',
            tone: 'violet',
            bullets: ['会按图抓关键节点', '会把窗口语言和参数换算接起来', '会用主图、时域、频域给出证据化结论'],
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

function getAiPrompts(step: UNIT_3_4StepDefinition) {
  switch (step.id) {
    case 'step-09':
      return ['请只检查我的 k -> K 换算链是否完整，不要直接给最终工作点结论。'];
    case 'step-10':
      return ['请指出我的换算链里缺了哪一步，并解释为什么这一步不能跳过。'];
    case 'step-12':
      return ['请只帮我检查三域证据是否闭合，不要直接替我给出最终排序。'];
    default:
      return ['请围绕本页目标解释概念或检查我的作答思路，不要直接替我完成结论。'];
  }
}

function buildInteractiveAiConfig(step: UNIT_3_4StepDefinition): InteractiveConfig {
  return {
    resourceId: `unit-3-4:${step.id}`,
    registryId: `unit-3-4:${step.id}`,
    title: `${UNIT_3_4_COURSE_TITLE} · ${step.title}`,
    aiHints: `当前只围绕 ${step.title} 提供解释和检查，不替代学生完成最终判断。`,
    config: {
      ai: {
        enabled: true,
        persona: 'tutor',
      },
    },
  };
}

function getRevealContent(step: UNIT_3_4StepDefinition) {
  switch (step.id) {
    case 'step-02':
      return '参考答案：B。稳定只是底线，还要继续比较窗口、换算与跨域后果。';
    case 'step-05':
      return '参考顺序：先骨架，再关键节点，再窗口，最后才谈参数与后果。';
    case 'step-08':
      return '参考口径：稳定窗口回答“还能不能工作”，可接受窗口回答“值不值得继续用”。';
    case 'step-09':
      return '参考提醒：图上先读到的是根轨迹增益 k，必须先通过 k = 0.01715K 换算到控制器增益 K。';
    case 'step-11':
      return '参考口径：A 保守但慢，B 更平衡，C 虽仍稳定但风险感更强。';
    case 'step-12':
      return '参考口径：最终结论至少应同时调用主图之外的一到两域证据，不能只凭单域排序。';
    case 'step-13':
      return '解释题最少要出现“关键节点 / 窗口 / 换算 / 三域”中的两个关键词。';
    default:
      return null;
  }
}

function supportsAnswerReveal(step: UNIT_3_4StepDefinition) {
  return step.pageType !== 'display' && step.pageType !== 'summary' && step.pageType !== 'ai_compare_workspace';
}

function parseList(value?: string) {
  return String(value ?? '')
    .split('||')
    .map((item) => item.trim())
    .filter(Boolean);
}

function countAnswers(responses: UNIT_3_4TeacherResponseItem[]) {
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

function getWordCloudEntries(responses: UNIT_3_4TeacherResponseItem[]) {
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

export function UNIT_3_4KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft mb-4 px-4 py-4">
      <div className="premium-lesson-kicker">Module 3 Map</div>
      <h2 className="premium-lesson-title mt-2 text-xl font-semibold">从 3-3 法则走向 3-4 判断，再走向 3-5 结构改变</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          { label: '3-3', title: '根轨迹法则', body: '负责解释参数变化时极点怎样迁移。', active: false },
          { label: '3-4', title: '读图与验证', body: '负责把法则压成关键节点、窗口、换算和三域判断。', active: true },
          { label: '3-5', title: '结构改变', body: '才进入零点、PD、超前校正等结构改变。', active: false },
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

export function UNIT_3_4StepContentPanel({
  step,
  mediaSrc,
  mediaAlt,
}: {
  step: UNIT_3_4StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const blueprint = getStepBlueprint(step);

  return (
    <section className="premium-lesson-panel px-4 py-5">
      <div className="premium-lesson-kicker">
        {blueprint.kicker} · {UNIT_3_4_STAGE_LABEL[step.stage]}
      </div>
      <h2 className="premium-lesson-title mt-2 text-2xl font-semibold">{step.title}</h2>
      <p className="premium-lesson-muted mt-3 text-sm sm:text-base">{blueprint.intro}</p>

      {mediaSrc ? (
        <figure className="premium-lesson-surface-elevated mt-4 overflow-hidden px-4 py-4">
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-border/60 bg-background/60">
            <Image src={mediaSrc} alt={mediaAlt ?? step.title} fill className="object-contain" />
          </div>
          <figcaption className="premium-lesson-muted mt-2 text-xs">图示用于支撑当前环节的比较与验证。</figcaption>
        </figure>
      ) : null}

      <div className="mt-4 grid gap-4">
        {blueprint.sections.map((section) => (
          <div key={section.title} className={`premium-lesson-tone-block ${getToneClass(section.tone)}`}>
            <div className="font-medium">{section.title}</div>
            {section.body ? <div className="mt-2 text-sm leading-7">{section.body}</div> : null}
            {section.formula ? (
              <div className="mt-3 rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
                <BlockMath math={section.formula} />
              </div>
            ) : null}
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

export function UNIT_3_4StudentActivityForm({
  step,
  savedResponse,
  released,
  answerVisible,
  onSubmit,
  onWorkspaceParameterChange,
}: {
  step: UNIT_3_4StepDefinition;
  savedResponse?: UNIT_3_4StepResponse;
  released: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_3_4StepResponse) => void;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(savedResponse?.answers ?? {});

  useEffect(() => {
    setDraft(savedResponse?.answers ?? {});
  }, [savedResponse]);

  const submitted = Boolean(savedResponse);
  const locked = !released && step.pageType !== 'display' && step.pageType !== 'summary';

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

  const renderBody = () => {
    switch (step.pageType) {
      case 'binary_choice':
        return (
          <div className="grid gap-4">
            {renderChoiceButtons({
              options: [
                { value: 'A', label: '只要还稳定，就已经足够好' },
                { value: 'B', label: '不一定，还要继续判断' },
              ],
              value: draft.choice ?? '',
              onChange: (value) => updateDraft('choice', value, 'button'),
            })}
            <button type="button" onClick={() => submit({ choice: draft.choice ?? '' })} className="premium-lesson-action-primary">
              {submitted ? '重新提交判断' : '提交判断'}
            </button>
          </div>
        );
      case 'quiz_group':
        return (
          <div className="grid gap-4">
            {POST_QUIZ_QUESTIONS.map((question) => (
              <div key={question.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
                <div className="mt-3">
                  {question.type === 'text' ? (
                    <TextInput
                      value={draft[question.key] ?? ''}
                      onChange={(value) => updateDraft(question.key, value)}
                      placeholder="写下你的关键词和证据"
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
      case 'sequence_sort': {
        const currentOrder = parseList(draft.sortOrder) || [];
        const order = currentOrder.length ? currentOrder : READING_SEQUENCE_OPTIONS.map((item) => item.value);
        return (
          <div className="grid gap-4">
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">拖动替代版排序区</div>
              <div className="mt-3 grid gap-3">
                {order.map((value, index) => {
                  const item = READING_SEQUENCE_OPTIONS.find((entry) => entry.value === value);
                  if (!item) return null;
                  return (
                    <div key={value} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 px-3 py-3">
                      <span>{index + 1}. {item.label}</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={index === 0}
                          className="premium-lesson-control disabled:opacity-40"
                          onClick={() => {
                            const next = [...order];
                            [next[index - 1], next[index]] = [next[index], next[index - 1]];
                            updateDraft('sortOrder', next.join('||'), 'button');
                          }}
                        >
                          上移
                        </button>
                        <button
                          type="button"
                          disabled={index === order.length - 1}
                          className="premium-lesson-control disabled:opacity-40"
                          onClick={() => {
                            const next = [...order];
                            [next[index], next[index + 1]] = [next[index + 1], next[index]];
                            updateDraft('sortOrder', next.join('||'), 'button');
                          }}
                        >
                          下移
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <button type="button" onClick={() => submit({ sortOrder: draft.sortOrder ?? order.join('||') })} className="premium-lesson-action-primary">
              {submitted ? '重新提交排序' : '提交排序'}
            </button>
          </div>
        );
      }
      case 'preset_prediction_submit':
        return (
          <div className="grid gap-4">
            {VERSION_PREDICTION_FIELDS.map((field) => (
              <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                <div className="mt-3">
                  <SelectField
                    value={draft[field.key] ?? ''}
                    onChange={(value) => updateDraft(field.key, value, 'select')}
                    options={VERSION_OPTIONS}
                  />
                </div>
              </div>
            ))}
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">一句第一眼理由</div>
              <div className="mt-3">
                <TextInput
                  value={draft.first_reason ?? ''}
                  onChange={(value) => updateDraft('first_reason', value)}
                  placeholder="例如：B 更像参考工作点，A 太保守，C 风险感偏强"
                  multiline
                />
              </div>
            </div>
            <button type="button" onClick={() => submit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交首轮预测' : '提交首轮预测'}
            </button>
          </div>
        );
      case 'annotation_submit':
        return (
          <div className="grid gap-4">
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">请勾选你标出的关键节点</div>
              <div className="mt-3 grid gap-2">
                {KEYNODE_OPTIONS.map((option) => {
                  const values = new Set(parseList(draft.annotationPoints));
                  const active = values.has(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`premium-lesson-control justify-start ${active ? 'ring-2 ring-cyan-400' : ''}`}
                      onClick={() => {
                        if (active) {
                          values.delete(option.value);
                        } else {
                          values.add(option.value);
                        }
                        updateDraft('annotationPoints', Array.from(values).join('||'), 'button');
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">哪个节点最决定后续判断</div>
              <div className="mt-3">
                <TextInput
                  value={draft.keynode_reason ?? ''}
                  onChange={(value) => updateDraft('keynode_reason', value)}
                  placeholder="写出节点名称和一句理由"
                  multiline
                />
              </div>
            </div>
            <button type="button" onClick={() => submit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交标注记录' : '提交标注记录'}
            </button>
          </div>
        );
      case 'window_tagging':
        return (
          <div className="grid gap-4">
            {VERSION_OPTIONS.map((version) => (
              <div key={version.value} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{version.label}</div>
                <div className="mt-3">
                  <SelectField
                    value={draft[`window_${version.value}`] ?? ''}
                    onChange={(value) => updateDraft(`window_${version.value}`, value, 'select')}
                    options={WINDOW_TAG_OPTIONS}
                  />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => submit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交窗口判断' : '提交窗口判断'}
            </button>
          </div>
        );
      case 'formula_workspace':
        return (
          <div className="grid gap-4">
            {GAIN_CONVERSION_FIELDS.map((field) => (
              <div key={field.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                <div className="mt-3">
                  <TextInput
                    value={draft[field.key] ?? ''}
                    onChange={(value) => updateDraft(field.key, value)}
                    placeholder={field.label}
                    multiline={field.key === 'formula_chain' || field.key === 'warning'}
                  />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => submit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交换算链' : '提交换算链'}
            </button>
          </div>
        );
      case 'ai_compare_workspace':
        return (
          <div className="grid gap-4">
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">我的换算链</div>
              <div className="mt-3">
                <TextInput
                  value={draft.self_chain ?? ''}
                  onChange={(value) => updateDraft('self_chain', value)}
                  placeholder="先写自己的换算链，再去问 AI。"
                  multiline
                />
              </div>
            </div>
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">修订说明</div>
              <div className="mt-3">
                <TextInput
                  value={draft.revision ?? ''}
                  onChange={(value) => updateDraft('revision', value)}
                  placeholder="AI 帮我纠正的不是答案，而是 ________。"
                  multiline
                />
              </div>
            </div>
            <button type="button" onClick={() => submit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交修订说明' : '提交修订说明'}
            </button>
          </div>
        );
      case 'panel_toggle_compare': {
        const isTimeDomain = step.id === 'step-11';
        const choices = isTimeDomain ? TIME_DOMAIN_CHOICES : FINAL_RANKING_OPTIONS;
        return (
          <div className="grid gap-4">
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">版本切换记录</div>
              <div className="mt-3">
                {renderChoiceButtons({
                  options: VERSION_OPTIONS,
                  value: draft.focus_version ?? '',
                  onChange: (value) => updateDraft('focus_version', value, 'button'),
                })}
              </div>
            </div>
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">{isTimeDomain ? '时域判断' : '最终排序'}</div>
              <div className="mt-3">
                {renderChoiceButtons({
                  options: choices,
                  value: draft.judgement ?? '',
                  onChange: (value) => updateDraft('judgement', value, 'button'),
                })}
              </div>
            </div>
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">{isTimeDomain ? '时域证据' : '至少两域证据'}</div>
              <div className="mt-3">
                {isTimeDomain ? (
                  <TextInput
                    value={draft.evidence ?? ''}
                    onChange={(value) => updateDraft('evidence', value)}
                    placeholder="写出快慢、振荡或拖尾证据"
                    multiline
                  />
                ) : (
                  <div className="grid gap-2">
                    {EVIDENCE_DOMAIN_OPTIONS.map((option) => {
                      const values = new Set(parseList(draft.evidence_domains));
                      const active = values.has(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`premium-lesson-control justify-start ${active ? 'ring-2 ring-cyan-400' : ''}`}
                          onClick={() => {
                            if (active) values.delete(option.value);
                            else values.add(option.value);
                            updateDraft('evidence_domains', Array.from(values).join('||'), 'button');
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                    <TextInput
                      value={draft.evidence ?? ''}
                      onChange={(value) => updateDraft('evidence', value)}
                      placeholder="补一句总判断"
                      multiline
                    />
                  </div>
                )}
              </div>
            </div>
            <button type="button" onClick={() => submit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交判断' : '提交判断'}
            </button>
          </div>
        );
      }
      case 'exit_reflection':
        return (
          <div className="grid gap-4">
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">一句出口反思</div>
              <div className="mt-3">
                <TextInput
                  value={draft.reflection ?? ''}
                  onChange={(value) => updateDraft('reflection', value)}
                  placeholder="只调增益为什么很快会到边界？"
                  multiline
                />
              </div>
            </div>
            <button type="button" onClick={() => submit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交反思' : '提交反思'}
            </button>
          </div>
        );
      default:
        return (
          <div className="premium-lesson-muted text-sm">本页以静态内容为主，无需提交。</div>
        );
    }
  };

  if (step.pageType === 'display' || step.pageType === 'summary') {
    return (
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">本页无需提交</div>
        <SubmissionStatus submitted={false} idleText="本页以静态阅读和教师推进为主，不需要学生提交作答。" />
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

export function UNIT_3_4TeacherActivitySummary({
  step,
  responses,
  released,
  answerVisible,
  onToggleRelease,
  onToggleAnswerVisible,
}: {
  step: UNIT_3_4StepDefinition;
  responses: UNIT_3_4TeacherResponseItem[];
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

export function UNIT_3_4StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_3_4StepResponse>;
}) {
  const finishedSteps = UNIT_3_4_LESSON_STEPS.filter((step) => responses[step.id]);

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">本课学习小结</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        你已完成 {finishedSteps.length} / {UNIT_3_4_LESSON_STEPS.length} 个互动环节。
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {['关键节点', '参数窗口', '增益换算', '三域验证'].map((keyword) => (
          <div key={keyword} className="premium-lesson-surface-elevated px-4 py-3 text-sm">
            <div className="font-medium">{keyword}</div>
            <div className="premium-lesson-muted mt-1">这是 3-4 最终要带走的判断锚点。</div>
          </div>
        ))}
      </div>
      <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm">
        你已经把{'“关键节点 -> 窗口 -> 换算 -> 三域证据”'}串成一条完整判断链，下一课才进入结构改变。
      </div>
    </section>
  );
}

export function UNIT_3_4StepAiAssistant({
  step,
  onAiEvent,
}: {
  step: UNIT_3_4StepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}) {
  const prompts = getAiPrompts(step);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const ai = useInteractiveAI({
    config: buildInteractiveAiConfig(step),
    contextData: {
      lessonId: '3-4',
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
        当前只围绕 {step.title} 回答问题，帮助你检查概念、换算链和证据闭合，不替你直接下最终结论。
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

      <button type="button" onClick={ai.togglePanel} className="premium-lesson-action-primary mt-4">
        打开页内 AI
      </button>

      <Dialog open={ai.isPanelOpen} onOpenChange={ai.togglePanel}>
        <DialogContent className="max-w-5xl border-none bg-transparent p-0 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>{step.title} AI 助手</DialogTitle>
            <DialogDescription>用于概念解释、换算链核对和证据闭合检查。</DialogDescription>
          </DialogHeader>
          <InteractiveAIPanel ai={ai} title={`${step.title} · AI 助手`} position="floating" onClose={ai.togglePanel} />
        </DialogContent>
      </Dialog>
    </section>
  );
}
