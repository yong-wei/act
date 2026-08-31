'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ECharts } from 'echarts/core';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import {
  getUNIT_3_4PageContract,
  UNIT_3_4_LESSON_STEPS,
  UNIT_3_4_STAGE_LABEL,
  type UNIT_3_4PageContract,
  type UNIT_3_4StepDefinition,
  type UNIT_3_4StepResponse,
} from '@/lib/unit-3-4-course';
import { useControlEngine } from '@/resources/control-system/analysis/use-control-engine';
import type { RootLocusSamplePoint } from '@/resources/control-system/analysis/types';
import { RootLocusPanel } from '@/resources/control-system/charts/control-analysis-panels';
import {
  ACTIVITY_CARD_FIELDS,
  buildUnit34Step05AnalysisRequest,
  findNearestSample,
  isStep05TargetSatisfied,
  measureStep05TargetDistance,
  POST_QUIZ_QUESTIONS,
  PRE_QUIZ_QUESTIONS,
  READING_SEQUENCE_OPTIONS,
  STEP05_AXIS_PRESET,
  STEP05_DEFAULT_POINT,
  STEP05_TARGET_QUESTIONS,
  TRIPLE_MATCH_FIELDS,
  WORKED_EXAMPLE_FIELDS,
  type ActivityCardField,
  type ChoiceOption,
  type Step05TargetQuestion,
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
}

interface StaticTableData {
  title: string;
  columns: string[];
  rows: string[][];
  tone?: Tone;
  note?: string;
}

interface StructuredRevealStep {
  body?: string;
  formula?: string;
}

type ProgressiveRevealStep = string | StructuredRevealStep;

interface ProgressiveRevealData {
  promptTitle: string;
  promptBody: string[];
  steps: ProgressiveRevealStep[];
}

export interface UNIT_3_4TeacherResponseItem {
  studentName: string;
  response: UNIT_3_4StepResponse;
}

function toneClass(tone: Tone = 'slate') {
  return `premium-tone-${tone}`;
}

function shuffleSequenceOrder() {
  const values = READING_SEQUENCE_OPTIONS.map((item) => item.value);
  const correct = values.join('|');
  if (typeof window === 'undefined') {
    return values.slice().reverse();
  }
  let next = values.slice();
  while (next.join('|') === correct) {
    next = values.slice();
    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
  }
  return next;
}

function parseDelimitedList(value?: string) {
  return String(value ?? '')
    .split('||')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatSigned(value: number) {
  const fixed = Math.abs(value).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return `${value >= 0 ? '+' : '-'}${fixed || '0'}`;
}

function formatStep05Point(point: Pick<RootLocusSamplePoint, 're' | 'im'> | null) {
  if (!point) {
    return '尚未定位';
  }
  return `(${formatSigned(point.re)}, ${formatSigned(point.im)}j)`;
}

function getStep05StatusLabel(value?: string) {
  if (value === 'pass') return '已通过';
  if (value === 'retry') return '未通过';
  return '未提交';
}

function buildStep05AnswerKeys(questionKey: string) {
  return {
    point: `${questionKey}_point`,
    distance: `${questionKey}_distance`,
    status: `${questionKey}_status`,
  } as const;
}

function buildStep05SummaryRows(responses: UNIT_3_4TeacherResponseItem[]) {
  return STEP05_TARGET_QUESTIONS.map((question) => {
    const keys = buildStep05AnswerKeys(question.key);
    const submitted = responses.filter((item) => Boolean(item.response.answers[keys.point]));
    const passed = responses.filter((item) => item.response.answers[keys.status] === 'pass');
    return {
      label: question.label,
      submitted: submitted.length,
      passed: passed.length,
    };
  });
}

function buildStep06CompletionRows(responses: UNIT_3_4TeacherResponseItem[]) {
  const fields = ACTIVITY_CARD_FIELDS['step-06'] ?? [];
  return fields.map((field) => ({
    label: field.label,
    count: responses.filter((item) => item.response.answers[field.key]?.trim()).length,
  }));
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
            bullets: ['3-3：建立根轨迹法则。', '3-4：读图、窗口、换算、三域与广义参数。', '3-5：才进入结构改变。'],
          },
          {
            title: '本课边界',
            tone: 'rose',
            bullets: ['不重讲 3-3 的法则证明。', '不进入零点、PD 与模块 4 设计任务。'],
          },
        ],
      };
    case 'step-02':
      return {
        kicker: 'Goal',
        intro: '本课不是再听一遍法则，而是把“会背法则”推进成“会按图做判断”。',
        sections: [
          {
            title: '记录表 / 要回答的问题 / 至少应包含的信息',
            tone: 'emerald',
            bullets: [
              '关键节点读图记录：主图上先看哪些位置；至少包含分离点、虚轴交点、主导极点候选、稳定窗口。',
              '参数窗口判断表：哪些参数只是稳定，哪些参数更值得选用；至少包含根轨迹增益、实际控制器增益、非增益参数窗口、稳定性判断、性能趋势。',
              '对象化验证记录：图上的判断落回真实对象后是否仍成立；至少包含时域后果、频域后果、主导极点近似是否可信、低中频近似与高频差异。',
            ],
          },
          {
            title: '三张记录表首尾相接',
            tone: 'amber',
            body: '关键节点读图 -> 参数窗口判断 -> 对象化三域验证 -> 广义参数验证。',
          },
        ],
      };
    case 'step-03':
      return {
        kicker: 'Versions',
        intro: '对象、记号和 A/B/C 三版本必须同页出现，才能暴露“稳定=可用”的第一误判。',
        sections: [
          {
            title: '对象与记号',
            tone: 'violet',
            formula: 'G(s)=\\frac{0.01715K}{s(s+0.1)(s+2.14375)},\\qquad k=0.01715K',
          },
          {
            title: '三个版本',
            tone: 'cyan',
            bullets: ['A：保守、慢。', 'B：更像参考工作点。', 'C：仍稳定，但风险感更强。'],
          },
        ],
      };
    case 'step-04':
      return {
        kicker: 'Workflow',
        intro: '固定读图顺序：先骨架，再关键节点，再窗口，再后果。',
        sections: [
          {
            title: '四步法说明卡',
            tone: 'cyan',
            bullets: [
              '看骨架：先看起点、终点和分支数量，判断对象的整体骨架。',
              '找关键节点：锁定分离点、虚轴交点和主导极点候选，判断主导形态与边界位置。',
              '区分窗口：从关键节点走到稳定窗口与可接受窗口，判断参数落在哪一侧。',
              '翻译后果：把图上的位置改写成参数语言和工程后果，说明快慢、振荡、裕量与风险。',
            ],
          },
        ],
      };
    case 'step-05':
      return {
        kicker: 'Evidence',
        intro: '关键节点证据板：分离点、虚轴交点与参考工作点 B 必须回到同一张主图。',
        sections: [],
      };
    case 'step-06':
      return {
        kicker: 'Record',
        intro: '关键节点读图记录：把主图证据写成一句工程判断，当前页先把 B/C 的证据回顾带回页面。',
        sections: [],
      };
    case 'step-07':
      return {
        kicker: 'Windows',
        intro: '稳定窗口不等于可接受窗口；它们回答的是两层不同问题，不能混写。',
        sections: [
          {
            title: '两层窗口语言',
            tone: 'amber',
            bullets: ['稳定窗口：还能不能工作。', '可接受窗口：值不值得继续推进。'],
          },
        ],
      };
    case 'step-08':
      return {
        kicker: 'Worked Example',
        intro: '增益换算链：从图上的 k 落回工程参数 K。',
        sections: [
          {
            title: '换算关系',
            tone: 'violet',
            formula: 'k = 0.01715K,\\qquad K=\\frac{k}{0.01715}',
          },
        ],
      };
    case 'step-09':
      return {
        kicker: 'Three Domains',
        intro: '为什么必须三域互证：主图、时域、频域先并排对齐。',
        sections: [
          {
            title: '三域角色',
            tone: 'cyan',
            bullets: [
              '主图回答关键节点、极点迁移和窗口边界。',
              '时域回答快慢、振荡、拖尾与参考工作点后果。',
              '频域回答带宽、相位变化、高频差异与风险暴露。',
            ],
          },
        ],
      };
    case 'step-10':
      return {
        kicker: 'Time Domain',
        intro: '时域验证：版本 B 为什么能够作为参考工作点，以及为什么当前阶跃证据还不是验证链终点。',
        sections: [],
      };
    case 'step-11':
      return {
        kicker: 'Frequency Domain',
        intro: '频域代价：版本 C 为什么不能只看跟踪收益。',
        sections: [],
      };
    case 'step-12':
      return {
        kicker: 'Dual Evidence',
        intro: '连续跟踪中的收益与代价必须同时挂在 B/C 两张图上，而不是只保留更快的一边。',
        sections: [],
      };
    case 'step-13':
      return {
        kicker: 'Generalized Root Locus',
        intro: '广义根轨迹与等效改写：局部反馈系数 a 为什么不是“再调一次 K”。',
        sections: [],
      };
    case 'step-14':
      return {
        kicker: 'Parameter Window',
        intro: '非增益参数窗口记录：a 从 0 到 1 怎样改写主导极点。',
        sections: [],
      };
    case 'step-15':
      return {
        kicker: 'Posttest',
        intro: '后测只检查关键节点、窗口、换算、三域和广义参数五段判断链是否已经成句。',
        sections: [
          {
            title: '本页任务',
            tone: 'amber',
            body: '只检查完整判断链，不重新引入新的结构设计任务。',
          },
        ],
      };
    case 'step-16':
      return {
        kicker: 'Wrap-up',
        intro: '收束与去向：沿既有结构分析的能力与边界。',
        sections: [],
      };
    default:
      return { kicker: 'Lesson', intro: step.hint, sections: [] };
  }
}

function getStep06RecordTable(): StaticTableData {
  return {
    title: 'B/C 证据回顾表',
    tone: 'cyan',
    columns: ['对象版本', '是否越过分离点', '与虚轴边界关系', '主导极点候选', '读图结论'],
    rows: [
      ['B', '已越过分离点', '仍明显远离虚轴边界', '-0.0488±j0.0496', '速度与阻尼较均衡，可作参考工作点'],
      ['C', '早已越过分离点', '已明显向虚轴边界逼近', '-0.0135±j0.3931', '仍稳定，但振荡趋势与风险感显著增强'],
    ],
    note: '写判断句时，位置、边界关系与工程后果必须一起出现。',
  };
}

function getStep11Table(): StaticTableData {
  return {
    title: '频域比较表',
    tone: 'amber',
    columns: ['版本', '闭环带宽', '开环相角裕度', '闭环峰值', '频域解释'],
    rows: [
      ['A', '约 0.019 rad/s', '约 80.6°', '约 -0.01 dB', '跟踪带宽最低，但稳定裕量最大'],
      ['B', '约 0.070 rad/s', '约 64.9°', '约 0.00 dB', '带宽提高，同时仍保留较好裕量'],
      ['C', '约 0.607 rad/s', '约 4.0°', '约 23.15 dB', '跟踪能力显著增强，但稳定裕量几乎耗尽，共振峰显著放大'],
    ],
    note: 'C 的真实含义应表述为：它以显著缩小稳定裕量和放大共振峰为代价换取了更高带宽。',
  };
}

function getStep14PrimaryTable(): StaticTableData {
  return {
    title: '代表性极点表',
    tone: 'emerald',
    columns: ['a', '代表性极点', '主导变化', '第一判断'],
    rows: [
      ['0', '-2.1461, -0.0488±j0.0496', '与前文版本 B 相同，共轭极点主导', '速度与阻尼较均衡'],
      ['0.2', '-2.8311, -0.0493±j0.0352', '快极点左移，主导极点虚部减小', '振荡减弱，但响应开始保守'],
      ['0.5', '-3.8595, -0.0496±j0.0152', '主导极点逼近实轴', '超调更小，但速度损失明显'],
      ['1.0', '-5.5741, -0.0747, -0.0250', '主导极点转为三个实极点', '过于保守，不再处于优先考虑区间'],
    ],
  };
}

function getStep14WindowTable(): StaticTableData {
  return {
    title: '参数区间窗口表',
    tone: 'cyan',
    columns: ['参数区间', '轨迹解释', '时域后果', '频域后果', '记录建议'],
    rows: [
      ['a=0 附近', '与版本 B 连续，共轭主导极点较均衡', '响应较快，允许适度振荡', '低中频保持主动态判断，高频仍需单列', '作为比较基线'],
      ['0<a≲0.5', '主导极点虚部减小，仍可视为同一主线上的可调窗口', '振荡减弱，但速度同步下降', '低频增益逐步下降，跟踪趋于保守', '可作非增益参数的实践窗口'],
      ['a≳1', '主导极点压到实轴附近，轨迹性质明显改变', '响应过缓，不再适合作为这里的均衡工作点', '保守性增强，但会牺牲主要动态表现', '只作边界提醒，不作优先选择'],
    ],
    note: '当前页记录的是比较基线、实践窗口和边界提醒，而不是直接给出唯一设计答案。',
  };
}

function getRevealContent(stepId: string) {
  switch (stepId) {
    case 'step-03':
      return PRE_QUIZ_QUESTIONS.map((item, index) => `${index + 1}. ${item.explanation}`).join('\n\n');
    case 'step-04':
      return '参考顺序：先骨架，再关键节点，再窗口，最后才谈工程后果。';
    case 'step-05':
      return '参考口径：分离点分开主导机制，虚轴交点给稳定上界，B 兼顾两侧边界。';
    case 'step-07':
      return '参考提醒：稳定窗口只回答“还能不能工作”，可接受窗口才回答“值不值得继续推进”。';
    case 'step-08':
      return '参考换算：K = 0.0104 / 0.01715 ≈ 0.6064。';
    case 'step-09':
      return '参考角色：主图看节点与窗口，时域看波形后果，频域看带宽与高频风险。';
    case 'step-10':
      return '版本 B 的时域价值在于“较均衡”，而不是“绝对最快”；主导极点近似可信，但仍要继续接受频域和连续跟踪验证。';
    case 'step-11':
      return '版本 C 的频域收益是带宽提高；对应代价则是稳定裕量极小、共振峰显著放大。';
    case 'step-12':
      return '连续跟踪中的收益与代价必须写在同一句：更积极的贴近给定，并不等于代价消失。';
    case 'step-13':
      return '参考答案：a 改写了对象与特征方程，所以这里不是“再调一次 K”。';
    case 'step-14':
      return '参考窗口语言：a=0 附近作比较基线，0<a≲0.5 可作实践窗口，a≳1 只作边界提醒。';
    case 'step-15':
      return POST_QUIZ_QUESTIONS.map((item, index) => `${index + 1}. ${item.explanation}`).join('\n\n');
    default:
      return '';
  }
}

const STEP13_ORIGINAL_OBJECT_FORMULA = 'G_1(s)=\\dfrac{3.43}{s+2.14375}';
const STEP13_EQUIVALENT_INNER_LOOP_FORMULA = 'G_{1,\\mathrm{eq}}(s)=\\dfrac{3.43}{s+2.14375+3.43a}';

function renderProgressiveRevealStepContent(item: ProgressiveRevealStep) {
  if (typeof item === 'string') {
    return <div className="mt-2 leading-7">{item}</div>;
  }

  return (
    <div className="mt-2 grid gap-3">
      {item.body ? <div className="leading-7">{item.body}</div> : null}
      {item.formula ? (
        <div className="rounded-2xl bg-background/70 px-3 py-3 [&_.katex-display]:m-0">
          <BlockMath math={item.formula} />
        </div>
      ) : null}
    </div>
  );
}

function getProgressiveRevealData(stepId: string): ProgressiveRevealData | null {
  switch (stepId) {
    case 'step-08':
      return {
        promptTitle: '增益换算题面',
        promptBody: [
          '若图上读得参考工作点 B 对应 k=0.0104，实际控制器增益 K 应写成多少？',
          '题面固定显示；先写关系式，再代入数值，最后补一句为什么不能把 k 直接当成 K。',
        ],
        steps: [
          '先固定关系式：k=0.01715K，所以 K=k/0.01715。',
          '把图上读到的 k=0.0104 代入逆关系式。',
          '完成数值换算：K=0.0104/0.01715≈0.6064。',
          '回看变量含义：图上先读到的是根轨迹增益，不是工程控制器增益。',
          '因此工程判断必须先写 K，再回接参考工作点 B 的窗口位置。',
        ],
      };
    case 'step-13':
      return {
        promptTitle: '广义根轨迹改写题面',
        promptBody: [
          '在参考工作点 K=0.6064 下，把局部反馈系数 a 引入舵机环节后，如何把问题改写回根轨迹形式。',
          '题面固定显示；本页只隐藏推导步骤，不隐藏对象和问题。',
        ],
        steps: [
          {
            body: '先写新的闭环特征方程。',
            formula: 's^3+(2.24375+3.43a)s^2+(0.214375+0.343a)s+0.0104=0',
          },
          {
            body: '把它整理成“参数 a 进入对象改写”的标准入口。',
            formula: 'B(s)+aA(s)=0',
          },
          {
            body: '分开写出 B(s) 与 A(s)。',
            formula: 'B(s)=s^3+2.24375s^2+0.214375s+0.0104,\\qquad A(s)=3.43s(s+0.1)',
          },
          {
            body: '继续改写成标准根轨迹条件形式。',
            formula: '1+a\\dfrac{A(s)}{B(s)}=0',
          },
          {
            body: '得到等效开环对象。',
            formula: 'G_e(s)=\\dfrac{A(s)}{B(s)}=\\dfrac{3.43s(s+0.1)}{s^3+2.24375s^2+0.214375s+0.0104}',
          },
          {
            body: '因此这里继续按标准 180° 根轨迹理解；真正变化的是对象，不是法则。',
            formula: '180^\\circ',
          },
        ],
      };
    default:
      return null;
  }
}

function getDefaultDraft(step: UNIT_3_4StepDefinition, savedResponse?: UNIT_3_4StepResponse) {
  if (savedResponse?.answers) {
    return savedResponse.answers;
  }

  if (step.pageType === 'quiz_group') {
    return Object.fromEntries((step.id === 'step-03' ? PRE_QUIZ_QUESTIONS : POST_QUIZ_QUESTIONS).map((item) => [item.key, '']));
  }
  if (step.pageType === 'sequence_sort') {
    return { sortOrder: '' };
  }
  if (step.pageType === 'hotspot_labeling') {
    return Object.fromEntries(
      STEP05_TARGET_QUESTIONS.flatMap((question) => {
        const keys = buildStep05AnswerKeys(question.key);
        return [
          [keys.point, ''],
          [keys.distance, ''],
          [keys.status, ''],
        ];
      }),
    );
  }
  if (step.pageType === 'activity_cards') {
    return Object.fromEntries((ACTIVITY_CARD_FIELDS[step.id] ?? []).map((field) => [field.key, '']));
  }
  if (step.pageType === 'worked_example_workspace') {
    return Object.fromEntries((WORKED_EXAMPLE_FIELDS[step.id] ?? []).map((field) => [field.key, '']));
  }
  if (step.pageType === 'triple_match') {
    return Object.fromEntries(TRIPLE_MATCH_FIELDS.map((field) => [field.key, '']));
  }
  return {};
}

function InfoCard({
  title,
  children,
  tone = 'slate',
}: {
  title: string;
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className={`premium-lesson-tone-block ${toneClass(tone)}`}>
      <div className="premium-lesson-title text-sm font-semibold">{title}</div>
      <div className="mt-3 text-sm leading-7">{children}</div>
    </div>
  );
}

function FormulaCard({
  title,
  formula,
  tone = 'violet',
  note,
}: {
  title: string;
  formula: string;
  tone?: Tone;
  note?: string;
}) {
  return (
    <div className={`premium-lesson-tone-block ${toneClass(tone)}`}>
      <div className="premium-lesson-title text-sm font-semibold">{title}</div>
      <div className="mt-3 rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
        <BlockMath math={formula} />
      </div>
      {note ? <div className="mt-3 text-sm leading-7">{note}</div> : null}
    </div>
  );
}

function NativeTablePanel({ table }: { table: StaticTableData }) {
  return (
    <div className={`premium-lesson-tone-block ${toneClass(table.tone)}`}>
      <div className="premium-lesson-title text-sm font-semibold">{table.title}</div>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-border/60 bg-background/55">
        <table className="w-full min-w-[680px] border-collapse text-left text-sm">
          <thead className="bg-background/70">
            <tr>
              {table.columns.map((column) => (
                <th key={column} className="border-b border-border/60 px-3 py-2 font-medium text-foreground/80">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={`${table.title}-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${table.title}-${rowIndex}-${cellIndex}`} className="border-b border-border/40 px-3 py-3 align-top text-foreground/85 last:border-b-0">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.note ? <p className="premium-lesson-muted mt-3 text-sm leading-7">{table.note}</p> : null}
    </div>
  );
}

function MediaPanel({ src, alt, caption }: { src: string; alt: string; caption?: string | string[] }) {
  const lines = caption ? (Array.isArray(caption) ? caption : [caption]) : [];
  return (
    <figure className="premium-lesson-surface-elevated overflow-hidden rounded-3xl px-4 py-4">
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-border/60 bg-background/70">
        <Image src={src} alt={alt} fill className="object-contain" unoptimized />
      </div>
      {lines.length ? (
        <figcaption className="premium-lesson-muted mt-3 grid gap-2 text-sm leading-7">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </figcaption>
      ) : null}
    </figure>
  );
}

function ChoiceGroup({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: readonly ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            onChange(option.value);
          }}
          className={`premium-lesson-surface-elevated rounded-2xl px-4 py-3 text-left text-sm ${value === option.value ? 'ring-2 ring-cyan-400' : ''}`}
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
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <textarea aria-label={placeholder}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="premium-lesson-input min-h-[120px] w-full resize-y"
    />
  );
}

function SelectField({
  value,
  onChange,
  options,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly ChoiceOption[];
  disabled?: boolean;
}) {
  return (
    <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="premium-lesson-select w-full">
      <option value="">请选择</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function renderActivityInput(field: ActivityCardField, value: string, onChange: (value: string) => void, disabled = false) {
  if (field.inputKind === 'single_choice' && field.options) {
    return <ChoiceGroup options={field.options} value={value} onChange={onChange} disabled={disabled} />;
  }
  return <TextInput value={value} onChange={onChange} placeholder={field.placeholder ?? field.prompt} disabled={disabled} />;
}

function ProgressiveRevealPanel({
  stepId,
  browseEnabled,
  revealProgress,
  allowInlineReveal,
}: {
  stepId: string;
  browseEnabled: boolean;
  revealProgress: number;
  allowInlineReveal: boolean;
}) {
  const revealData = getProgressiveRevealData(stepId);
  const totalSteps = revealData?.steps.length ?? 0;
  const teacherVisibleCount = Math.max(1, Math.min(totalSteps, revealProgress || 1));
  const [localRevealCount, setLocalRevealCount] = useState(teacherVisibleCount);

  useEffect(() => {
    setLocalRevealCount(teacherVisibleCount);
  }, [stepId, teacherVisibleCount]);

  if (!revealData) {
    return null;
  }

  const visibleCount = browseEnabled && allowInlineReveal ? Math.max(teacherVisibleCount, localRevealCount) : teacherVisibleCount;
  const canAdvance = browseEnabled && allowInlineReveal && visibleCount < totalSteps;

  return (
    <section data-progressive-reveal="step_click_reveal" className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-base font-semibold">{revealData.promptTitle}</div>
      <div className="premium-lesson-muted mt-2 grid gap-2 text-sm leading-7">
        {revealData.promptBody.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <div className="premium-lesson-caption mt-3 text-xs">题面固定显示。点击当前最下方已显影步骤可继续展开下一层。</div>
      {!browseEnabled ? (
        <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">教师尚未开放浏览，当前只显示教师基线层。</div>
      ) : null}

      <div className="mt-4 grid gap-3">
        {revealData.steps.slice(0, visibleCount).map((item, index) => {
          const isLastVisible = index === visibleCount - 1;
          return (
            <button
              key={`${stepId}-${index}`}
              type="button"
              onClick={() => {
                if (isLastVisible && canAdvance) {
                  setLocalRevealCount((count) => Math.min(totalSteps, count + 1));
                }
              }}
              className={`premium-lesson-surface-elevated rounded-2xl px-4 py-4 text-left text-sm ${isLastVisible && canAdvance ? 'cursor-pointer ring-1 ring-cyan-400/40' : 'cursor-default'}`}
            >
              <div className="font-medium">步骤 {index + 1}</div>
              {renderProgressiveRevealStepContent(item)}
              {isLastVisible && canAdvance ? (
                <div className="premium-lesson-caption mt-3 text-xs">点击当前步骤继续显影下一层。</div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="premium-lesson-caption text-xs">当前显影进度：{visibleCount} / {totalSteps}</div>
        <button
          type="button"
          onClick={() => setLocalRevealCount(teacherVisibleCount)}
          disabled={!allowInlineReveal || localRevealCount === teacherVisibleCount}
          className="premium-lesson-action-secondary disabled:opacity-40"
        >
          重置步骤
        </button>
      </div>
    </section>
  );
}

function Step05TargetingWorkspace({
  draft,
  onDraftChange,
  onSubmit,
  onWorkspaceParameterChange,
  answerVisible,
}: {
  draft: Record<string, string>;
  onDraftChange: (next: Record<string, string>) => void;
  onSubmit: (answers: Record<string, string>) => void;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
  answerVisible: boolean;
}) {
  const request = useMemo(() => buildUnit34Step05AnalysisRequest(), []);
  const { result, error, isLoading } = useControlEngine(request);
  const [activeQuestionKey, setActiveQuestionKey] = useState<Step05TargetQuestion['key']>(STEP05_TARGET_QUESTIONS[0].key);
  const [dragging, setDragging] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<RootLocusSamplePoint | null>({
    re: STEP05_DEFAULT_POINT.re,
    im: STEP05_DEFAULT_POINT.im,
  });
  const chartRef = useRef<ECharts | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!result || selectedPoint) {
      return;
    }
    const nearest = findNearestSample(result.rootLocus.branches, STEP05_DEFAULT_POINT);
    if (nearest) {
      setSelectedPoint(nearest);
    }
  }, [result, selectedPoint]);

  useEffect(() => {
    if (!dragging) {
      return undefined;
    }

    const handleMove = (event: PointerEvent) => {
      const chart = chartRef.current;
      const track = trackRef.current;
      if (!chart || !track || !result) {
        return;
      }
      const rect = track.getBoundingClientRect();
      const axisPoint = chart.convertFromPixel(
        { xAxisIndex: 0, yAxisIndex: 0 },
        [event.clientX - rect.left, event.clientY - rect.top],
      );
      if (!Array.isArray(axisPoint) || axisPoint.length < 2) {
        return;
      }
      const target = { re: Number(axisPoint[0]), im: Number(axisPoint[1]) };
      const nearest = findNearestSample(result.rootLocus.branches, target);
      if (!nearest) {
        return;
      }
      setSelectedPoint(nearest);
      onWorkspaceParameterChange?.({
        key: `step05:${activeQuestionKey}`,
        value: `${nearest.re.toFixed(4)},${nearest.im.toFixed(4)}`,
        source: 'drag',
      });
    };

    const handleUp = () => setDragging(false);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [activeQuestionKey, dragging, onWorkspaceParameterChange, result]);

  const activeQuestion = STEP05_TARGET_QUESTIONS.find((question) => question.key === activeQuestionKey) ?? STEP05_TARGET_QUESTIONS[0];
  const activeKeys = buildStep05AnswerKeys(activeQuestion.key);
  const currentDistance = selectedPoint ? measureStep05TargetDistance(selectedPoint, activeQuestion) : null;

  const submitCurrentQuestion = () => {
    if (!selectedPoint) {
      return;
    }
    const passed = isStep05TargetSatisfied(selectedPoint, activeQuestion);
    const next = {
      ...draft,
      [activeKeys.point]: `${selectedPoint.re.toFixed(4)},${selectedPoint.im.toFixed(4)}`,
      [activeKeys.distance]: currentDistance?.toFixed(4) ?? '',
      [activeKeys.status]: passed ? 'pass' : 'retry',
    };
    onDraftChange(next);
    onSubmit(next);
  };

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">学生提交区</div>
      <div className="premium-lesson-muted mt-2 text-sm">
        右侧三个按钮表示当前正在回答的问题。学生通过拖动左侧绘图区根轨迹上的闭环极点，确定极点坐标后提交。
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
        <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
          <div className="premium-lesson-title text-sm font-medium">统一根轨迹面板</div>
          <div className="premium-lesson-muted mt-2 text-sm">
            面板只采集当前拖动点的数据，不联动其他极点。当前拖点沿根轨迹吸附，并采用容差判定。
          </div>
          <div className="relative mt-4">
            {isLoading && !result ? (
              <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-border/60 bg-background/70 text-sm text-foreground/65">
                统一仿真引擎正在计算根轨迹。
              </div>
            ) : result ? (
              <RootLocusPanel
                result={result}
                caseId={request.caseId}
                axisPresetOverride={STEP05_AXIS_PRESET}
                interactiveLayerRef={trackRef}
                onChartReady={(chart) => {
                  chartRef.current = chart;
                }}
                interactiveHandles={
                  selectedPoint
                    ? [
                        {
                          id: 'student-target-pole',
                          kind: 'pole',
                          point: { re: selectedPoint.re, im: selectedPoint.im },
                          draggable: true,
                          renderAs: 'closed-pole',
                          ariaLabel: '当前闭环极点，可沿根轨迹拖动',
                        },
                      ]
                    : []
                }
                onHandlePointerDown={(_id: string, event: ReactPointerEvent<HTMLButtonElement>) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                className="flex h-full flex-col"
                chartClassName="h-full min-h-[520px]"
              />
            ) : (
              <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-border/60 bg-background/70 text-sm text-foreground/65">
                根轨迹结果暂不可用。
              </div>
            )}
          </div>
          {error ? <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">{error}</div> : null}
        </div>

        <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
          <div className="premium-lesson-title text-sm font-medium">问题切换与提交</div>
          <div className="mt-3 grid gap-2">
            {STEP05_TARGET_QUESTIONS.map((question) => {
              const keys = buildStep05AnswerKeys(question.key);
              const status = getStep05StatusLabel(draft[keys.status]);
              return (
                <button
                  key={question.key}
                  type="button"
                  onClick={() => {
                    setActiveQuestionKey(question.key);
                    onWorkspaceParameterChange?.({
                      key: 'step05:active_question',
                      value: question.key,
                      source: 'button',
                    });
                  }}
                  className={`premium-lesson-surface-elevated rounded-2xl px-4 py-3 text-left text-sm ${activeQuestionKey === question.key ? 'ring-2 ring-cyan-400' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{question.shortLabel}</span>
                    <span className="premium-lesson-caption text-xs">{status}</span>
                  </div>
                  <div className="premium-lesson-muted mt-2">{question.prompt}</div>
                </button>
              );
            })}
          </div>

          <div className="premium-lesson-tone-block premium-tone-cyan mt-4">
            <div className="premium-lesson-title text-sm font-semibold">{activeQuestion.label}</div>
            <div className="mt-2 text-sm leading-7">{activeQuestion.prompt}</div>
            <div className="premium-lesson-caption mt-3 text-xs">
              当前拖点：{formatStep05Point(selectedPoint)} · 判定半径：{activeQuestion.maxDistance.toFixed(2)}
            </div>
            {currentDistance !== null ? (
              <div className="premium-lesson-caption mt-2 text-xs">当前误差：{currentDistance.toFixed(4)}</div>
            ) : null}
          </div>

          <button type="button" onClick={submitCurrentQuestion} className="premium-lesson-action-primary mt-4 w-full">
            提交当前问题
          </button>

          <div className="premium-lesson-caption mt-3 text-xs">
            通过标准采用容差判定。切换下一个问题标签后，也可以继续拖动并提交。
          </div>

          {answerVisible ? (
            <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm">
              参考提示：分离点分开主导机制，虚轴边界给稳定上界，参考工作点 B 同时满足“越过分离点”与“远离虚轴边界”两项条件。
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <SubmissionStatus submitted={STEP05_TARGET_QUESTIONS.some((question) => Boolean(draft[buildStep05AnswerKeys(question.key).status]))} />
      </div>
    </section>
  );
}

function renderCustomStaticContent(step: UNIT_3_4StepDefinition, mediaSrc?: string | null, mediaAlt?: string) {
  switch (step.id) {
    case 'step-05':
      return (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <InfoCard title="分离点" tone="cyan">
            分离点 <code>s≈-0.0494</code> 把实极点主导与共轭极点主导分开。
          </InfoCard>
          <InfoCard title="虚轴边界" tone="amber">
            虚轴交点对应 <code>K≈28.05</code>，对应虚轴交点 <code>s=±j0.4626</code>，给出稳定窗口上界。
          </InfoCard>
          <InfoCard title="参考工作点 B" tone="emerald">
            B 对应主导极点 <code>-0.0488±j0.0496</code>，既越过分离点，又远离虚轴边界，因此可作为均衡参考。
          </InfoCard>
        </div>
      );
    case 'step-06':
      return (
        <div className="mt-4 grid gap-4">
          <NativeTablePanel table={getStep06RecordTable()} />
          <InfoCard title="读图结论提示" tone="emerald">
            读图记录的目标是把 B/C 的节点位置、边界关系和工程后果连成完整判断句，而不是收集碎片化形容词。
          </InfoCard>
        </div>
      );
    case 'step-10':
      return mediaSrc ? (
        <div className="mt-4 grid gap-4">
          <MediaPanel
            src={mediaSrc}
            alt={mediaAlt ?? step.title}
            caption={[
              '在 B 附近，原系统与主导极点近似系统在上升段、峰值附近与收敛段保持较好一致，因此“较均衡”不是感觉判断。',
              '这张阶跃对照还不能代替后续频域与持续跟踪验证。',
            ]}
          />
          <InfoCard title="时域局限" tone="amber">
            主导极点近似可信，但仍不能把其他极点完全当作不存在；这张阶跃图只回答“时域是否支撑主图判断”，不回答全部后果。
          </InfoCard>
        </div>
      ) : null;
    case 'step-11':
      return (
        <div className="mt-4 grid gap-4">
          <NativeTablePanel table={getStep11Table()} />
          <MediaPanel
            src="/course-runtime/lessons/3-4/media/3-4-bode-compare.png"
            alt={mediaAlt ?? step.title}
            caption={[
              'Bode 对照图只服务一个问题：为什么版本 C 不能只说“带宽更高”，而必须同步记录稳定裕量和共振峰代价。',
              '低中频与近似解释不再是本页主问题；本页重心是版本 C 的频域收益与频域代价并存。',
            ]}
          />
        </div>
      );
    case 'step-12':
      return (
        <div className="mt-4 grid gap-4">
          <MediaPanel
            src="/course-runtime/lessons/3-4/media/3-4-turning-track-k06064.png"
            alt="版本 B 的连续跟踪与航迹对照"
            caption="版本 B：较均衡的参考工作点，但连续跟踪初始阶段仍有明显滞后。"
          />
          <MediaPanel
            src="/course-runtime/lessons/3-4/media/3-4-turning-track-k20.png"
            alt="版本 C 的连续跟踪与航迹对照"
            caption="版本 C：连续跟踪更贴近给定，但必须和前页看到的低裕量、高共振峰一起解读。"
          />
        </div>
      );
    case 'step-13':
      return (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="grid gap-4">
              <FormulaCard title="原对象" formula={STEP13_ORIGINAL_OBJECT_FORMULA} />
              <FormulaCard title="等效内环对象" formula={STEP13_EQUIVALENT_INNER_LOOP_FORMULA} />
            </div>
            <MediaPanel
              src="/course-runtime/lessons/3-4/media/3-4-local-feedback-block.png"
              alt="局部反馈结构图"
              caption="结构图与题面必须同页出现；这里讨论的是对象如何改写，而不是先猜 a 是不是另一个 K。"
            />
          </div>
          <InfoCard title="题面卡" tone="cyan">
            在参考工作点 <code>K=0.6064</code> 下，把局部反馈系数 <code>a</code> 引入舵机环节后，如何把问题改写回根轨迹形式。
          </InfoCard>
        </div>
      );
    case 'step-14':
      return (
        <div className="mt-4 grid gap-4">
          <MediaPanel
            src="/course-runtime/lessons/3-4/media/3-4-generalized-root-locus.png"
            alt="广义根轨迹图"
            caption="当前页记录的是比较基线、实践窗口和边界提醒，而不是直接给出唯一设计答案。"
          />
          <NativeTablePanel table={getStep14PrimaryTable()} />
          <NativeTablePanel table={getStep14WindowTable()} />
        </div>
      );
    case 'step-16':
      return (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              '先看关键节点，再谈参数窗口。',
              '稳定窗口与可接受窗口要分开说。',
              '图上的 k 要换回工程参数 K。',
              '三域验证用于给主图判断补证。',
              '广义根轨迹先改写，再继续用法则。',
            ].map((item) => (
              <div key={item} className="premium-lesson-surface-elevated rounded-2xl px-4 py-4 text-sm">
                {item}
              </div>
            ))}
          </div>
          <InfoCard title="最终判断" tone="emerald">
            A 偏保守，B 是参考工作点，C 是稳定窗口内带明确代价的取舍型参数。
          </InfoCard>
          <InfoCard title="边界卡" tone="amber">
            沿既有结构分析可以帮助我们选点与辨识窗口，但不能替代后续通过结构变化主动改写轨迹。
          </InfoCard>
          <MediaPanel src="/course-runtime/lessons/3-4/media/3-4-info.png" alt="3-4 信息图" />
          <InfoCard title="3-5 去向卡" tone="violet">
            下一课 3-5 将从零点进入，讨论怎样改变轨迹本身，而不只是沿既有轨迹选点。
          </InfoCard>
        </div>
      );
    default:
      return null;
  }
}

export function UNIT_3_4KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft mb-4 px-4 py-4">
      <div className="premium-lesson-kicker">Module 3 Map</div>
      <h2 className="premium-lesson-title mt-2 text-xl font-semibold">从 3-3 法则走向 3-4 判断，再走向 3-5 结构改变</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          { label: '3-3', title: '根轨迹法则', body: '负责解释参数变化时极点怎样迁移。', active: false },
          { label: '3-4', title: '读图与验证', body: '负责把法则压成关键节点、窗口、换算、三域与广义参数判断。', active: true },
          { label: '3-5', title: '结构改变', body: '才进入零点、PD 与结构调整。', active: false },
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
  browseEnabled = true,
  revealProgress = 0,
  allowInlineReveal = false,
  onWorkspaceParameterChange: _onWorkspaceParameterChange,
}: {
  step: UNIT_3_4StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  browseEnabled?: boolean;
  revealProgress?: number;
  allowInlineReveal?: boolean;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const blueprint = getStepBlueprint(step);
  const customStaticContent = renderCustomStaticContent(step, mediaSrc, mediaAlt);

  return (
    <section className="premium-lesson-panel px-4 py-5">
      <div className="premium-lesson-kicker">
        {blueprint.kicker} · {UNIT_3_4_STAGE_LABEL[step.stage]}
      </div>
      <h2 className="premium-lesson-title mt-2 text-2xl font-semibold">{step.title}</h2>
      <p className="premium-lesson-muted mt-3 text-sm sm:text-base">{blueprint.intro}</p>

      {customStaticContent ? (
        customStaticContent
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {blueprint.sections.map((section) => (
            <InfoCard key={`${step.id}-${section.title}`} title={section.title} tone={section.tone}>
              {section.formula ? (
                <div className="rounded-2xl bg-background/70 px-3 py-3 [&_.katex-display]:m-0">
                  <BlockMath math={section.formula} />
                </div>
              ) : null}
              {section.body ? <p>{section.body}</p> : null}
              {section.bullets?.length ? (
                <ul className="grid gap-2">
                  {section.bullets.map((item) => (
                    <li key={item} className="ml-4 list-disc">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </InfoCard>
          ))}
        </div>
      )}

      {step.pageType === 'worked_example_workspace' ? (
        <div className="mt-4">
          <ProgressiveRevealPanel
            stepId={step.id}
            browseEnabled={browseEnabled}
            revealProgress={revealProgress}
            allowInlineReveal={allowInlineReveal}
          />
        </div>
      ) : null}

      {step.id === 'step-09' ? (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            ['主图 / 根轨迹', '看关键节点、极点迁移和窗口边界。'],
            ['时域', '看快慢、振荡、拖尾和参考工作点后果。'],
            ['频域', '看带宽、相位变化、高频差异与风险暴露。'],
          ].map(([title, body]) => (
            <div key={title} className="premium-lesson-surface-elevated rounded-2xl px-4 py-4 text-sm">
              <div className="font-medium">{title}</div>
              <div className="premium-lesson-muted mt-2">{body}</div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function UNIT_3_4StudentActivityForm({
  step,
  savedResponse,
  released,
  answerVisible,
  browseEnabled = true,
  onSubmit,
  readOnly = false,
  onWorkspaceParameterChange,
}: {
  step: UNIT_3_4StepDefinition;
  savedResponse?: UNIT_3_4StepResponse;
  released: boolean;
  answerVisible: boolean;
  browseEnabled?: boolean;
  onSubmit: (response: UNIT_3_4StepResponse) => void;
  readOnly?: boolean;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const commitStudentResponse: typeof onSubmit = (response) => {
    if (readOnly) return;
    onSubmit(response);
  };
  const [draft, setDraft] = useState<Record<string, string>>(() => getDefaultDraft(step, savedResponse));
  const pageContract = getUNIT_3_4PageContract(step.id);

  useEffect(() => {
    setDraft(getDefaultDraft(step, savedResponse));
  }, [savedResponse, step]);

  useEffect(() => {
    if (step.pageType !== 'sequence_sort' || savedResponse) {
      return;
    }
    setDraft({ sortOrder: shuffleSequenceOrder().join('||') });
  }, [savedResponse, step.id, step.pageType]);

  if (step.pageType === 'display' || step.pageType === 'summary') {
    return null;
  }

  const submitted = Boolean(savedResponse);
  const requiresRelease =
    pageContract.teacherControls.releaseActivity === 'separate_toggle' ||
    pageContract.teacherControls.releaseActivity === 'teacher_toggle';
  const requiresBrowse =
    pageContract.teacherControls.openBrowse === 'separate_toggle' ||
    pageContract.teacherControls.openBrowse === 'teacher_toggle';
  const locked = (requiresRelease && !released && !submitted) || (requiresBrowse && !browseEnabled);

  const updateDraft = (key: string, value: string, source: WorkspaceParameterChange['source'] = 'input') => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    onWorkspaceParameterChange?.({ key, value, source });
  };

  const submitDraft = (answers: Record<string, string>) => {
    commitStudentResponse({
      stepId: step.id,
      submittedAt: Date.now(),
      answers,
    });
  };

  if (locked) {
    return (
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">学生作答区</div>
        <p className="premium-lesson-muted mt-2 text-sm">
          {requiresBrowse && !browseEnabled ? '教师尚未开放浏览，请先阅读已显示的静态内容。' : '教师尚未释放本页互动，请先阅读上方静态内容。'}
        </p>
        <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">
          {requiresBrowse && !browseEnabled ? '当前浏览尚未开放。' : '当前互动尚未释放。'}
        </div>
      </section>
    );
  }

  if (step.pageType === 'hotspot_labeling') {
    return (
      <Step05TargetingWorkspace
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={(answers) => submitDraft(answers)}
        onWorkspaceParameterChange={onWorkspaceParameterChange}
        answerVisible={answerVisible}
      />
    );
  }

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">学生作答区</div>
      <p className="premium-lesson-muted mt-2 text-sm">按本页任务完成判断与提交。</p>

      <div className="mt-4 grid gap-4">
        {step.pageType === 'quiz_group'
          ? (step.id === 'step-03' ? PRE_QUIZ_QUESTIONS : POST_QUIZ_QUESTIONS).map((question) => (
              <div key={question.key} className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
                <div className="mt-3">
                  {'options' in question ? (
                    <ChoiceGroup disabled={Boolean(readOnly)} options={question.options} value={draft[question.key] ?? ''} onChange={(value) => updateDraft(question.key, value, 'button')} />
                  ) : (
                    <TextInput disabled={Boolean(readOnly)} value={draft[question.key] ?? ''} onChange={(value) => updateDraft(question.key, value)} placeholder="写出你的解释。" />
                  )}
                </div>
              </div>
            ))
          : null}

        {step.pageType === 'sequence_sort' ? (
          parseDelimitedList(draft.sortOrder).length ? (
            <>
              {parseDelimitedList(draft.sortOrder).map((value, index, order) => {
                const item = READING_SEQUENCE_OPTIONS.find((entry) => entry.value === value);
                if (!item) return null;
                return (
                  <div key={value} className="premium-lesson-surface-elevated flex items-center justify-between gap-3 rounded-2xl px-4 py-4 text-sm">
                    <span>{item.label}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={Boolean(readOnly) || index === 0}
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
                        disabled={Boolean(readOnly) || index === order.length - 1}
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
              <div className="premium-lesson-tone-block premium-tone-amber text-sm">
                <div className="font-medium">读图顺序先于好坏判断。</div>
                <div className="mt-2 leading-7">排序区以随机顺序进入，不再提供数字序号作为提示。</div>
              </div>
            </>
          ) : (
            <div className="premium-lesson-muted text-sm">正在生成随机排序卡片。</div>
          )
        ) : null}

        {step.pageType === 'activity_cards' ? (
          step.id === 'step-06' ? (
            <div className="grid gap-4 md:grid-cols-2">
              {(ACTIVITY_CARD_FIELDS[step.id] ?? []).map((field) => (
                <div key={field.key} className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                  <div className="premium-lesson-muted mt-2 text-sm">{field.prompt}</div>
                  <div className="mt-3">{renderActivityInput(field, draft[field.key] ?? '', (value) => updateDraft(field.key, value), Boolean(readOnly))}</div>
                  <button
                    type="button" disabled={Boolean(readOnly)}
                    onClick={() => submitDraft(draft)}
                    className="premium-lesson-action-primary mt-4"
                  >
                    提交当前卡片
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {(ACTIVITY_CARD_FIELDS[step.id] ?? []).map((field) => (
                <div key={field.key} className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
                  <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                  <div className="premium-lesson-muted mt-2 text-sm">{field.prompt}</div>
                  <div className="mt-3">{renderActivityInput(field, draft[field.key] ?? '', (value) => updateDraft(field.key, value), Boolean(readOnly))}</div>
                </div>
              ))}
            </div>
          )
        ) : null}

        {step.pageType === 'worked_example_workspace' ? (
          <div className="grid gap-4 md:grid-cols-2">
            {(WORKED_EXAMPLE_FIELDS[step.id] ?? []).map((field) => (
              <div key={field.key} className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
                <div className="premium-lesson-muted mt-2 text-sm">{field.prompt}</div>
                <div className="mt-3">{renderActivityInput(field, draft[field.key] ?? '', (value) => updateDraft(field.key, value), Boolean(readOnly))}</div>
              </div>
            ))}
          </div>
        ) : null}

        {step.pageType === 'triple_match' ? (
          TRIPLE_MATCH_FIELDS.map((field) => (
            <div key={field.key} className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
              <div className="premium-lesson-muted mt-2 text-sm">{field.prompt}</div>
              <div className="mt-3">
                <SelectField disabled={Boolean(readOnly)} value={draft[field.key] ?? ''} onChange={(value) => updateDraft(field.key, value, 'select')} options={field.options} />
              </div>
            </div>
          ))
        ) : null}

        {step.id !== 'step-06' ? (
          <button type="button" disabled={Boolean(readOnly)} onClick={() => submitDraft(draft)} className="premium-lesson-action-primary">
            提交本页作答
          </button>
        ) : null}
      </div>

      <div className="mt-4">
        <SubmissionStatus submitted={submitted}
          idleText={readOnly ? '演示模式仅本机预览，不会同步到教师端汇总。' : undefined} />
      </div>

      {answerVisible && getRevealContent(step.id) ? (
        <div className="premium-lesson-tone-block premium-tone-emerald mt-4 whitespace-pre-line text-sm leading-7">{getRevealContent(step.id)}</div>
      ) : null}
    </section>
  );
}

export function UNIT_3_4TeacherActivitySummary({
  step,
  pageContract,
  responses,
  released,
  browseEnabled,
  revealProgress,
  answerVisible,
  onToggleRelease,
  onToggleBrowse,
  onAdvanceReveal,
  onResetReveal,
  onToggleAnswerVisible,
}: {
  step: UNIT_3_4StepDefinition;
  pageContract: UNIT_3_4PageContract;
  responses: UNIT_3_4TeacherResponseItem[];
  released: boolean;
  browseEnabled: boolean;
  revealProgress: number;
  answerVisible: boolean;
  onToggleRelease: () => void;
  onToggleBrowse: () => void;
  onAdvanceReveal: () => void;
  onResetReveal: () => void;
  onToggleAnswerVisible: () => void;
}) {
  const revealSteps = getProgressiveRevealData(step.id)?.steps.length ?? 0;
  const currentReveal = Math.max(1, revealProgress || 1);
  const step05Rows = useMemo(() => buildStep05SummaryRows(responses), [responses]);
  const step06Rows = useMemo(() => buildStep06CompletionRows(responses), [responses]);

  if (step.pageType === 'display' || step.pageType === 'summary') {
    return null;
  }

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="premium-lesson-title text-sm font-medium">教师汇总</div>
          <div className="premium-lesson-muted mt-1 text-sm">本页收到 {responses.length} 份学生提交。</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {pageContract.teacherControls.releaseActivity === 'teacher_toggle' ? (
            <button type="button" onClick={onToggleRelease} className="premium-lesson-action-secondary">
              {released ? '撤回互动' : '发放作答'}
            </button>
          ) : null}
          {pageContract.teacherControls.openBrowse === 'teacher_toggle' ? (
            <button type="button" onClick={onToggleBrowse} className="premium-lesson-action-secondary">
              {browseEnabled ? '关闭浏览' : '开放浏览'}
            </button>
          ) : null}
          {pageContract.teacherControls.teacherStepReveal === 'teacher_toggle' ? (
            <>
              <button
                type="button"
                onClick={onAdvanceReveal}
                disabled={!browseEnabled || currentReveal >= revealSteps}
                className="premium-lesson-action-secondary disabled:opacity-40"
              >
                推进显影
              </button>
              <button type="button" onClick={onResetReveal} className="premium-lesson-action-secondary">
                重置显影
              </button>
            </>
          ) : null}
          {pageContract.teacherControls.revealReferenceAnswer === 'teacher_toggle' ? (
            <button type="button" onClick={onToggleAnswerVisible} className="premium-lesson-action-primary">
              {answerVisible ? '隐藏参考答案' : '显示参考答案'}
            </button>
          ) : null}
        </div>
      </div>

      {pageContract.teacherControls.teacherStepReveal === 'teacher_toggle' ? (
        <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">当前显影进度：{currentReveal} / {revealSteps}。</div>
      ) : null}

      {step.id === 'step-05' ? (
        <div className="mt-4 grid gap-2">
          {step05Rows.map((row) => (
            <div key={row.label} className="premium-lesson-surface-elevated flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm">
              <span>{row.label}</span>
              <span className="premium-lesson-caption">已提 {row.submitted} 人 · 通过 {row.passed} 人</span>
            </div>
          ))}
        </div>
      ) : null}

      {step.id === 'step-06' ? (
        <div className="mt-4 grid gap-2">
          {step06Rows.map((row) => (
            <div key={row.label} className="premium-lesson-surface-elevated flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm">
              <span>{row.label}</span>
              <span className="premium-lesson-caption">{row.count} 人已提交</span>
            </div>
          ))}
        </div>
      ) : null}

      {step.id !== 'step-05' && step.id !== 'step-06' ? (
        <div className="mt-4 text-sm text-foreground/70">教师端保留当前页作答统计与答案揭示；若需要分布细查，请结合课堂事件与学生原始提交查看。</div>
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
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {['关键节点', '参数窗口', '增益换算', '三域互证', '广义参数'].map((keyword) => (
          <div key={keyword} className="premium-lesson-surface-elevated px-4 py-3 text-sm">
            <div className="font-medium">{keyword}</div>
            <div className="premium-lesson-muted mt-1">这是 3-4 最终要带走的判断锚点。</div>
          </div>
        ))}
      </div>
      <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm">
        你已经把“关键节点、参数窗口、增益换算、三域验证与广义参数”串成一条完整判断链，下一课才进入结构改变。
      </div>
    </section>
  );
}

export function getUNIT_3_4DemoPageContract(stepId: string) {
  return getUNIT_3_4PageContract(stepId);
}
