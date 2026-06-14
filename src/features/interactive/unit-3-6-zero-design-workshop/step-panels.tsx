'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import { BlockMath } from 'react-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';

import {
  InteractiveSvgMarkerDefs,
  InteractiveSvgMarkerRegistry,
  INTERACTIVE_SVG_PRODUCTION_ARROW_KIND,
  type InteractiveSvgMarkerKind,
} from '@/features/interactive/shared/interactive-svg-markers';
import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import {
  UNIT_3_6_LESSON_STEPS,
  UNIT_3_6_STAGE_LABEL,
  type UNIT_3_6StepDefinition,
  type UNIT_3_6StepResponse,
} from '@/lib/unit-3-6-course';
import { getUnit36PureGainFallbackResult } from '@/resources/control-system/analysis/unit-3-6-fixtures';
import { buildUnit36PureGainFailureRequest } from '@/resources/control-system/analysis/unit-3-6-request-builder';
import { useControlEngine } from '@/resources/control-system/analysis/use-control-engine';
import { RootLocusPanel } from '@/resources/control-system/charts/control-analysis-panels';
import {
  BOUNDARY_STRUCTURE_OPTIONS,
  CONSTRAINT_TRANSLATION_FIELDS,
  DESIGN_TASK_CARDS,
  DIFFERENCE_TAG_OPTIONS,
  ENTRY_BUCKETS,
  FINAL_QUIZ_QUESTIONS,
  PARAMETER_WORKSPACE_FIELDS,
  PRETEST_QUESTIONS,
  REASON_TAG_OPTIONS,
  SEQUENCE_REVEAL_OPTIONS,
  STRUCTURED_RESPONSE_KEYWORD_OPTIONS,
  type WorkspaceParameterChange,
} from './workspace';

type Tone = 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';
const UNIT_3_6_RATE_FEEDBACK_ARROW_PREFIX = 'unit-3-6-rate-feedback';
const UNIT_3_6_ARROW_KINDS: InteractiveSvgMarkerKind[] = [INTERACTIVE_SVG_PRODUCTION_ARROW_KIND];
const UNIT_3_6_RATE_FEEDBACK_ARROW_URL = InteractiveSvgMarkerRegistry.markerUrl(
  INTERACTIVE_SVG_PRODUCTION_ARROW_KIND,
  UNIT_3_6_RATE_FEEDBACK_ARROW_PREFIX,
);

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

interface ProgressiveFormulaItem {
  title: string;
  math: string;
}

export interface UNIT_3_6TeacherResponseItem {
  studentName: string;
  response: UNIT_3_6StepResponse;
}

function getToneClass(tone: Tone = 'slate') {
  return `premium-tone-${tone}`;
}

function renderInlineMathText(text: string) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => <span>{children}</span>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

function ProgressiveFormulaStack({
  items,
}: {
  items: ProgressiveFormulaItem[];
}) {
  const [revealedCount, setRevealedCount] = useState(1);
  const visibleItems = items.slice(0, revealedCount);

  return (
    <div className="mt-4 grid gap-3" data-progressive-reveal="step_click_reveal">
      {visibleItems.map((item, index) => {
        const isLastVisible = index === visibleItems.length - 1;
        const canRevealNext = isLastVisible && revealedCount < items.length;

        if (canRevealNext) {
          return (
            <button
              key={item.title}
              type="button"
              onClick={() => setRevealedCount((current) => Math.min(items.length, current + 1))}
              className="rounded-2xl border border-cyan-300/40 bg-background/70 px-4 py-4 text-left transition hover:border-cyan-300/70"
              data-progressive-reveal="step_click_reveal"
            >
              <div className="premium-lesson-title text-sm font-medium">{item.title}</div>
              <div className="mt-3 rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
                <BlockMath math={item.math} />
              </div>
              <div className="mt-3 text-xs text-cyan-200">点击本卡揭示下一层</div>
            </button>
          );
        }

        return (
          <div key={item.title} className="rounded-2xl border border-border/60 bg-background/55 px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">{item.title}</div>
            <div className="mt-3 rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
              <BlockMath math={item.math} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getStepBlueprint(step: UNIT_3_6StepDefinition): StepBlueprint {
  switch (step.id) {
    case 'step-01':
      return {
        kicker: 'Entry',
        intro: '本页只做一件事：阻断“看到某张图就开始做题”的惯性，把全课的第一原则钉成“先按目标分类，再进入工具”。',
        sections: [
          {
            title: '核心问题',
            tone: 'cyan',
            body: '为什么同样都在引入零点相关装置，有时入口是目标极点区域，有时入口却是相角裕度和截止频率。',
          },
          {
            title: '本课第一条板书',
            tone: 'amber',
            body: '指标 -> 结构 -> 参数 -> 验收',
          },
        ],
      };
    case 'step-02':
      return {
        kicker: 'Map',
        intro: '3-5 回答“为什么改变结构后，轨迹和响应会一起变”，3-6 则把机理推进到“如何按目标进入设计链”，再把稳态改善交给 3-7。',
        sections: [
          {
            title: '路径定位',
            tone: 'cyan',
            bullets: ['3-5：零点机理与三域表现。', '3-6：性能目标驱动结构与参数选择。', '3-7：稳态改善与型别判断。'],
          },
          {
            title: '本课边界',
            tone: 'rose',
            body: '本课只做目标驱动设计与边界判断，不进入模块 4 的完整整定。',
          },
        ],
      };
    case 'step-03':
      return {
        kicker: 'Goals',
        intro: '五任务链与固定交付物需要并排看清，因为这节课不是“装置鉴赏课”，而是一条从指标进入设计的完整执行链。',
        sections: [
          {
            title: '固定交付物',
            tone: 'emerald',
            bullets: ['指标翻译表', '时域设计记录', '频域设计记录', '边界判断卡', '一页设计报告'],
          },
          {
            title: '五任务链',
            tone: 'violet',
            bullets: DESIGN_TASK_CARDS.map((item) => `${item.label}：${item.summary}`),
          },
        ],
      };
    case 'step-04':
      return {
        kicker: 'Pre-check',
        intro: '这组前测只检测入口混淆，不追求立即给出完整答案；先独立完成三题与理由，再进入后续错因对照。',
        sections: [
          {
            title: '顺序要求',
            tone: 'amber',
            body: '先完成三题前测与一句理由，再进入下一步对照与讨论。',
          },
        ],
      };
    case 'step-05':
      return {
        kicker: 'Brief',
        intro: '对象、三类校正表达式和五任务表必须同屏，因为本页的关键动作不是“背术语”，而是把任务放回正确入口。',
        sections: [
          {
            title: '固定对象',
            tone: 'cyan',
            formula: 'G_p(s)=\\frac{4}{s(s+0.8)}',
          },
          {
            title: '三类装置',
            tone: 'amber',
            bullets: ['PD：$G_{PD}(s)=K(1+T_d s)$', '测速反馈：$U(s)=KE(s)-K_t sY(s)$', '超前：$G_{lead}(s)=K_c(aTs+1)/(Ts+1)$'],
          },
        ],
      };
    case 'step-06':
      return {
        kicker: 'Reveal A',
        intro: '时域设计不能从参数开始，必须先把 Mp 和 ts 翻译成目标极点区域，再说明为什么单纯调增益并不会自动满足约束。',
        sections: [
          {
            title: '核心翻译公式',
            tone: 'violet',
            formula: 'M_p=e^{-\\frac{\\zeta\\pi}{\\sqrt{1-\\zeta^2}}}\\times100\\%,\\qquad t_s\\approx\\frac{4}{\\zeta\\omega_n}',
          },
          {
            title: '要落到的结论',
            tone: 'emerald',
            bullets: ['阻尼比约束：$\\zeta \\ge 0.456$', '实部边界：$\\operatorname{Re}(s) \\le -1$', '纯增益不能直接同时通过两个约束'],
          },
        ],
      };
    case 'step-07':
      return {
        kicker: 'Task A',
        intro: 'PD 时域设计的核心不是背参数，而是按“设计点 -> 相角条件 -> 模值条件 -> 验收”完整走一遍。',
        sections: [
          {
            title: '设计链',
            tone: 'cyan',
            bullets: ['先选设计点 $s_d=-1.1\\pm j1.67$', '再由相角条件反求零点位置', '最后用模值条件求增益并验收阶跃'],
          },
          {
            title: '控制器形式',
            tone: 'violet',
            formula: 'G_{PD}(s)=K(1+T_d s)',
          },
        ],
      };
    case 'step-08':
      return {
        kicker: 'Task B Prep',
        intro: '测速反馈不能按“另一个 PD”去理解，它的设计抓手是等效极点位置，所以顺序必须是：先定等效极点，再求 Kt。',
        sections: [
          {
            title: '先看结构差异',
            tone: 'violet',
            body: '测速反馈把微分环节放在反馈通道，不等于在前向通道显式加一个零点。',
          },
          {
            title: '结构表达',
            tone: 'cyan',
            formula: 'U(s)=K E(s)-K_t sY(s)',
          },
        ],
      };
    case 'step-09':
      return {
        kicker: 'Task B',
        intro: '测速反馈时域设计仍要沿用时域目标，但其入口是等效极点和模值条件，而不是前向零点位置。',
        sections: [
          {
            title: '等效极点目标',
            tone: 'cyan',
            body: '将原极点 -0.8 左移到 -2.2，使复根实部稳定落在 -1.1。',
          },
          {
            title: '顺序提醒',
            tone: 'emerald',
            body: '先定等效极点，再由模值条件反求参数并回查时域。',
          },
        ],
      };
    case 'step-10':
      return {
        kicker: 'Reveal B',
        intro: '频域设计不能一上来就调滑块。必须先看共同目标，再看只调增益会怎样失败，最后才进入超前四步链。',
        sections: [
          {
            title: '共同频域目标',
            tone: 'cyan',
            formula: 'PM\\ge 50^\\circ,\\qquad \\omega_c\\approx 3\\ \\text{rad/s}',
          },
          {
            title: '超前四步链',
            tone: 'amber',
            bullets: ['先看只调增益为何失败', '再计算需要补多少相角', '然后布置相位峰所在频带', '最后用幅值条件求 K_c 并回查时域'],
          },
        ],
      };
    case 'step-11':
      return {
        kicker: 'Task C',
        intro: '超前频域设计要求先把目标翻译成补角与截止频率，再决定 a、T 和 Kc，而不是看到 Bode 图就盲调增益。',
        sections: [
          {
            title: '超前控制器形式',
            tone: 'violet',
            formula: 'G_{lead}(s)=K_c\\frac{aTs+1}{Ts+1},\\qquad a>1',
          },
          {
            title: '顺序提醒',
            tone: 'amber',
            body: '先补角，再布置频带，最后回查时域副作用。',
          },
        ],
      };
    case 'step-12':
      return {
        kicker: 'Reveal C',
        intro: '同一频域目标下再做一次 PD，不是为了证明谁更强，而是为了把“达标”和“代价”分开看清。',
        sections: [
          {
            title: '比较维度',
            tone: 'cyan',
            bullets: ['是否达标', '超调', '调节时间', '高频放大风险', '推荐结构'],
          },
          {
            title: '本页意图',
            tone: 'amber',
            body: '任务 D 的存在，是为了比较同指标下的结构副作用，而不是重复做一题。',
          },
        ],
      };
    case 'step-13':
      return {
        kicker: 'Task D',
        intro: '对照页最重要的句子只有一句：同一频域目标达标，不代表时域代价相同。',
        sections: [
          {
            title: '比较原则',
            tone: 'amber',
            body: '同一频域目标达标，不代表时域代价相同。',
          },
          {
            title: '记录要求',
            tone: 'cyan',
            bullets: ['先写共同目标', '再写不同代价', '最后标出哪一项差异最关键'],
          },
        ],
      };
    case 'step-14':
      return {
        kicker: 'Task E',
        intro: '右半平面零点不是“再多补一点角”就能糊过去的问题。这里必须把设计链收束成一句话：先改目标，再选结构。',
        sections: [
          {
            title: '边界对象',
            tone: 'rose',
            formula: 'G_{nmp}(s)=\\frac{4(1-0.3s)}{s(s+0.8)}',
          },
          {
            title: '边界原则',
            tone: 'amber',
            body: '先改目标，再选结构。',
          },
          {
            title: '保守示例抽屉',
            tone: 'violet',
            bullets: ['保守带宽档位', '较稳妥的频域目标', '结构选择依据要写明风险来源'],
          },
        ],
      };
    case 'step-15':
      return {
        kicker: 'Wrap-up',
        intro: '最后只带走三句收束：时域先翻译成区域，频域先翻译成补角与交叉频率，非最小相先重审目标。',
        sections: [
          {
            title: '三句结论',
            tone: 'cyan',
            bullets: ['时域指标先翻译成目标区域。', '频域指标先翻译成相角裕度与截止频率。', '右半平面零点下，目标本身也是设计变量。'],
          },
          {
            title: '去向卡',
            tone: 'violet',
            body: '下一课 3-7 将把今天的设计链继续推进到稳态改善与型别判断。',
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

function getRevealContent(step: UNIT_3_6StepDefinition) {
  switch (step.id) {
    case 'step-01':
      return '参考口径：本课第一入口先按目标分类，而不是先迷信根轨迹或 Bode 图。';
    case 'step-04':
      return '参考口径：时域目标先译成目标极点区域，频域目标先译成 PM 与 wc，非最小相对象先重审目标。';
    case 'step-05':
      return '参考口径：本课不是比较哪种结构永远更强，而是比较该从哪条设计链进入。';
    case 'step-06':
      return '参考结论：先把 Mp、ts 翻译成 zeta 与实部边界，再说明纯增益为什么不能直接达标。';
    case 'step-07':
      return '参考口径：PD 时域设计必须先定设计点，再由相角条件和模值条件反求参数。';
    case 'step-08':
      return '参考口径：测速反馈的入口是等效极点位置，而不是显式前向零点。';
    case 'step-09':
      return '参考口径：测速反馈先定等效极点，再由模值条件反求参数。';
    case 'step-10':
      return '参考口径：超前设计先看只调增益为何失败，再进入补角与布置频带。';
    case 'step-11':
      return '参考口径：频域通过后仍要回查时域代价，不能只盯住相角裕度。';
    case 'step-12':
      return '参考口径：任务 C 和任务 D 必须沿用同一组频域指标，才能比较真实代价差异。';
    case 'step-13':
      return '参考句式：同一频域目标达标，不代表时域代价相同。';
    case 'step-14':
      return '参考口径：右半平面零点下通常先保守带宽，先改目标，再选结构。';
    case 'step-15':
      return '参考口径：时域先翻译成区域，频域先翻译成补角与交叉频率，非最小相先重审目标。';
    default:
      return null;
  }
}

function supportsAnswerReveal(step: UNIT_3_6StepDefinition) {
  return step.pageType !== 'display';
}

function parseList(value?: string) {
  return String(value ?? '')
    .split('||')
    .map((item) => item.trim())
    .filter(Boolean);
}

function countAnswers(responses: UNIT_3_6TeacherResponseItem[]) {
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

function getWordCloudEntries(responses: UNIT_3_6TeacherResponseItem[]) {
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

function renderMultiChoiceButtons({
  options,
  values,
  onToggle,
}: {
  options: readonly ChoiceOption[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = values.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            className={`premium-lesson-control ${active ? 'ring-2 ring-cyan-400' : ''}`}
          >
            {option.label}
          </button>
        );
      })}
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
      <textarea aria-label={placeholder ?? '零点设计工作坊学习记录'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="premium-lesson-input min-h-[120px] w-full"
      />
    );
  }

  return (
    <input aria-label={placeholder ?? '零点设计工作坊输入'}
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

function UNIT_3_6Step03Overview() {
  return (
    <div className="mt-4 grid gap-4" data-layout="step03-two-column">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="premium-lesson-tone-block premium-tone-violet">
          <div className="premium-lesson-title text-sm font-medium">五任务设计链</div>
          <div className="mt-3 grid gap-3">
            {DESIGN_TASK_CARDS.map((task, index) => (
              <div key={task.id} className="rounded-2xl bg-background/70 px-4 py-3">
                <div className="premium-lesson-kicker">任务 {index + 1}</div>
                <div className="premium-lesson-title mt-1 text-sm font-medium">{task.label}</div>
                <div className="premium-lesson-muted mt-1 text-sm">{task.summary}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="premium-lesson-tone-block premium-tone-emerald">
          <div className="premium-lesson-title text-sm font-medium">固定交付物</div>
          <div className="mt-3 grid gap-3">
            {['指标翻译表', '时域设计记录', '频域设计记录', '边界判断卡', '一页设计报告'].map((item) => (
              <div key={item} className="rounded-2xl bg-background/70 px-4 py-3 text-sm">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="premium-lesson-tone-block premium-tone-amber">
        <div className="premium-lesson-title text-sm font-medium">实践规则</div>
        <div className="mt-2 text-sm leading-7">
          记录重点是设计链、判断句与比较结果，而不是死记单一参数数值。本页只建立整体预期，不设置独立学生作答区。
        </div>
      </div>
    </div>
  );
}

function formatPoleText(re: number, im: number) {
  const imagAbs = Math.abs(im).toFixed(2);
  return `${re.toFixed(2)} ${im >= 0 ? '+' : '-'} j${imagAbs}`;
}

function UNIT_3_6Step06GainWorkspace({
  onWorkspaceParameterChange,
}: {
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [gain, setGain] = useState(0.19);
  const request = useMemo(() => buildUnit36PureGainFailureRequest(gain), [gain]);
  const fallbackResult = useMemo(() => getUnit36PureGainFallbackResult(), []);
  const { result, error, isLoading } = useControlEngine(request, fallbackResult);
  const poles = result?.rootLocus.currentPoles ?? [];

  return (
    <div className="mt-4 rounded-3xl border border-border/60 bg-background/55 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="premium-lesson-title text-base font-semibold">统一仿真引擎根轨迹面板</div>
          <div className="premium-lesson-muted mt-2 text-sm leading-7">
            仅调比例增益，观察闭环极点始终沿纯增益根轨迹移动。可行域覆盖层用于对照阻尼比下界 0.456
            与实部边界 -1 两条约束。
          </div>
        </div>
        <div className="rounded-2xl bg-background/70 px-3 py-2 text-sm">
          当前增益 <span className="font-medium text-cyan-200">{gain.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-4">
        {result ? (
          <RootLocusPanel
            result={result}
            axisPresetOverride={{ x: [-3.2, 0.4], y: [-2.4, 2.4] }}
            className="flex h-full flex-col"
            chartClassName="h-full min-h-[440px]"
          />
        ) : (
          <div className="flex min-h-[440px] items-center justify-center rounded-2xl border border-border/60 bg-background/70 px-6 text-sm text-foreground/70">
            {isLoading ? '统一仿真引擎正在计算根轨迹。' : '根轨迹结果暂不可用。'}
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <label className="rounded-2xl border border-border/60 bg-background/70 px-4 py-4">
          <div className="premium-lesson-title text-sm font-medium">拖动增益观察闭环根轨迹</div>
          <input
            type="range"
            min="0"
            max="0.35"
            step="0.01"
            value={gain}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              setGain(nextValue);
              onWorkspaceParameterChange?.({ key: 'step-06:K', value: nextValue, source: 'drag' });
            }}
            className="mt-4 w-full accent-cyan-400"
          />
          <div className="premium-lesson-muted mt-2 text-xs">当增益增大后，复根实部仍停在约 -0.4，因此无法跨过调节时间边界。</div>
        </label>

        <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-4">
          <div className="premium-lesson-title text-sm font-medium">当前闭环极点</div>
          <div className="mt-3 grid gap-2 text-sm">
            {poles.length ? (
              poles.map((pole, index) => (
                <div key={`${pole.re}-${pole.im}-${index}`} className="rounded-2xl bg-background/70 px-3 py-2">
                  {formatPoleText(pole.re, pole.im)}
                </div>
              ))
            ) : (
              <div className="premium-lesson-muted text-sm">当前未取得闭环极点结果。</div>
            )}
          </div>
          {error ? <div className="premium-lesson-muted mt-3 text-xs">{error}</div> : null}
        </div>
      </div>
    </div>
  );
}

function UNIT_3_6RateFeedbackStructureDiagram() {
  return (
    <div className="rounded-3xl border border-border/60 bg-background/55 px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">测速反馈原生结构图</div>
      <svg viewBox="0 0 760 250" className="mt-4 w-full overflow-visible rounded-2xl bg-background/70 p-3">
        <InteractiveSvgMarkerDefs
          prefix={UNIT_3_6_RATE_FEEDBACK_ARROW_PREFIX}
          color="currentColor"
          lineStrokeWidth={2.2}
          kinds={UNIT_3_6_ARROW_KINDS}
        />

        <circle cx="72" cy="110" r="22" fill="none" stroke="currentColor" strokeWidth="2" />
        <text x="72" y="101" textAnchor="middle" fontSize="18">+</text>
        <text x="72" y="126" textAnchor="middle" fontSize="18">−</text>
        <text x="30" y="86" fontSize="15">R(s)</text>
        <line x1="30" y1="110" x2="50" y2="110" stroke="currentColor" strokeWidth="2.2" markerEnd={UNIT_3_6_RATE_FEEDBACK_ARROW_URL} />

        <line x1="94" y1="110" x2="176" y2="110" stroke="currentColor" strokeWidth="2.2" markerEnd={UNIT_3_6_RATE_FEEDBACK_ARROW_URL} />
        <rect x="176" y="82" width="78" height="56" rx="12" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <text x="215" y="115" textAnchor="middle" fontSize="18">K</text>

        <line x1="254" y1="110" x2="338" y2="110" stroke="currentColor" strokeWidth="2.2" markerEnd={UNIT_3_6_RATE_FEEDBACK_ARROW_URL} />
        <circle cx="362" cy="110" r="22" fill="none" stroke="currentColor" strokeWidth="2" />
        <text x="362" y="101" textAnchor="middle" fontSize="18">+</text>
        <text x="362" y="126" textAnchor="middle" fontSize="18">−</text>

        <line x1="384" y1="110" x2="470" y2="110" stroke="currentColor" strokeWidth="2.2" markerEnd={UNIT_3_6_RATE_FEEDBACK_ARROW_URL} />
        <rect x="470" y="82" width="110" height="56" rx="12" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <text x="525" y="106" textAnchor="middle" fontSize="16">Gₚ(s)</text>
        <text x="525" y="126" textAnchor="middle" fontSize="15">4 / [s(s+0.8)]</text>

        <line x1="580" y1="110" x2="678" y2="110" stroke="currentColor" strokeWidth="2.2" markerEnd={UNIT_3_6_RATE_FEEDBACK_ARROW_URL} />
        <text x="692" y="102" fontSize="15">Y(s)</text>

        <line x1="640" y1="110" x2="640" y2="190" stroke="currentColor" strokeWidth="2.2" />
        <rect x="500" y="172" width="88" height="42" rx="12" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <text x="544" y="198" textAnchor="middle" fontSize="16">sKₜ</text>
        <line x1="500" y1="193" x2="384" y2="193" stroke="currentColor" strokeWidth="2.2" markerEnd={UNIT_3_6_RATE_FEEDBACK_ARROW_URL} />
        <line x1="640" y1="190" x2="588" y2="190" stroke="currentColor" strokeWidth="2.2" markerEnd={UNIT_3_6_RATE_FEEDBACK_ARROW_URL} />
        <line x1="384" y1="193" x2="384" y2="132" stroke="currentColor" strokeWidth="2.2" markerEnd={UNIT_3_6_RATE_FEEDBACK_ARROW_URL} />
      </svg>
      <div className="premium-lesson-muted mt-3 text-sm leading-7">
        关键差异不在“前向显式增零点”，而在反馈通道引入速度项，由此先改写等效特征方程中的实极点位置。
      </div>
    </div>
  );
}

function UNIT_3_6Step08EvidenceBoard() {
  return (
    <div className="mt-4 grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
        <UNIT_3_6RateFeedbackStructureDiagram />

        <div className="grid gap-4">
          <div className="premium-lesson-tone-block premium-tone-cyan">
            <div className="premium-lesson-title text-sm font-medium">等效特征方程</div>
            <div className="mt-3 rounded-2xl bg-background/70 px-3 py-3 [&_.katex-display]:m-0">
              <BlockMath math={'U(s)=K E(s)-K_t sY(s)'} />
            </div>
            <div className="mt-3 rounded-2xl bg-background/70 px-3 py-3 [&_.katex-display]:m-0">
              <BlockMath math={'1+\\frac{4K}{s(s+0.8+4K_t)}=0'} />
            </div>
          </div>

          <div className="premium-lesson-tone-block premium-tone-amber">
            <div className="premium-lesson-title text-sm font-medium">设计顺序</div>
            <div className="mt-3 grid gap-2 text-sm">
              {[
                '先决定等效极点位置',
                '再由极点左移量反求 K_t',
                '最后由模值条件求 K',
              ].map((item) => (
                <div key={item} className="rounded-2xl bg-background/70 px-3 py-2">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-border/60 bg-background/55">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-background/70">
            <tr>
              <th className="border-b border-border/60 px-4 py-3 font-medium">比较项</th>
              <th className="border-b border-border/60 px-4 py-3 font-medium">前向 `PD`</th>
              <th className="border-b border-border/60 px-4 py-3 font-medium">测速反馈</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-b border-border/40 px-4 py-3">微分环节位置</td>
              <td className="border-b border-border/40 px-4 py-3">前向通道显式形成零点</td>
              <td className="border-b border-border/40 px-4 py-3">反馈通道引入速度项</td>
            </tr>
            <tr>
              <td className="border-b border-border/40 px-4 py-3">第一抓手</td>
              <td className="border-b border-border/40 px-4 py-3">设计点与相角条件</td>
              <td className="border-b border-border/40 px-4 py-3">等效极点位置</td>
            </tr>
            <tr>
              <td className="px-4 py-3">本页要记住的话</td>
              <td className="px-4 py-3">先定设计点，再求零点与增益</td>
              <td className="px-4 py-3">先定等效极点，再求 Kₜ 与 K</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function UNIT_3_6KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft mb-4 px-4 py-4">
      <div className="premium-lesson-kicker">Module 3 Map</div>
      <h2 className="premium-lesson-title mt-2 text-xl font-semibold">从 3-5 的零点机理，走向 3-6 的目标驱动设计，再进入 3-7 的稳态改善</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          { label: '3-5', title: '机理课', body: '解释零点相关结构怎样改写根轨迹与三域表现。', active: false },
          { label: '3-6', title: '设计课', body: '负责把目标翻译成结构与参数选择。', active: true },
          { label: '3-7', title: '稳态改善', body: '负责把今天的设计链继续推进到误差与型别。', active: false },
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

export function UNIT_3_6StepContentPanel({
  step,
  mediaSrc,
  mediaAlt,
  onWorkspaceParameterChange,
}: {
  step: UNIT_3_6StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const blueprint = getStepBlueprint(step);

  if (step.id === 'step-03') {
    return (
      <section className="premium-lesson-panel px-4 py-5">
        <div className="premium-lesson-kicker">
          {blueprint.kicker} · {UNIT_3_6_STAGE_LABEL[step.stage]}
        </div>
        <h2 className="premium-lesson-title mt-2 text-2xl font-semibold">{step.title}</h2>
        <p className="premium-lesson-muted mt-3 text-sm sm:text-base">{blueprint.intro}</p>
        <UNIT_3_6Step03Overview />
      </section>
    );
  }

  if (step.id === 'step-06') {
    return (
      <section className="premium-lesson-panel px-4 py-5">
        <div className="premium-lesson-kicker">
          {blueprint.kicker} · {UNIT_3_6_STAGE_LABEL[step.stage]}
        </div>
        <h2 className="premium-lesson-title mt-2 text-2xl font-semibold">{step.title}</h2>
        <p className="premium-lesson-muted mt-3 text-sm sm:text-base">{blueprint.intro}</p>

        <ProgressiveFormulaStack
          items={[
            {
              title: '核心翻译公式 1：由超调量进入阻尼比',
              math: 'M_p=e^{-\\frac{\\zeta\\pi}{\\sqrt{1-\\zeta^2}}}\\times100\\%',
            },
            {
              title: '核心翻译公式 2：由调节时间进入实部边界',
              math: 't_s\\approx\\frac{4}{\\zeta\\omega_n}',
            },
            {
              title: '点击后得到的结论',
              math: '\\zeta \\ge 0.456,\\qquad \\operatorname{Re}(s)\\le -1',
            },
            {
              title: '再点击得到纯增益失败结论',
              math: '\\text{纯增益复根实部固定在 } -0.4\\text{ 左右，无法跨过 }\\operatorname{Re}(s)\\le -1',
            },
          ]}
        />

        <UNIT_3_6Step06GainWorkspace onWorkspaceParameterChange={onWorkspaceParameterChange} />
      </section>
    );
  }

  if (step.id === 'step-08') {
    return (
      <section className="premium-lesson-panel px-4 py-5">
        <div className="premium-lesson-kicker">
          {blueprint.kicker} · {UNIT_3_6_STAGE_LABEL[step.stage]}
        </div>
        <h2 className="premium-lesson-title mt-2 text-2xl font-semibold">{step.title}</h2>
        <p className="premium-lesson-muted mt-3 text-sm sm:text-base">{blueprint.intro}</p>
        <UNIT_3_6Step08EvidenceBoard />
      </section>
    );
  }

  return (
    <section className="premium-lesson-panel px-4 py-5">
      <div className="premium-lesson-kicker">
        {blueprint.kicker} · {UNIT_3_6_STAGE_LABEL[step.stage]}
      </div>
      <h2 className="premium-lesson-title mt-2 text-2xl font-semibold">{step.title}</h2>
      <p className="premium-lesson-muted mt-3 text-sm sm:text-base">{blueprint.intro}</p>

      {mediaSrc ? (
        <figure className="premium-lesson-surface-elevated mt-4 overflow-hidden px-4 py-4">
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-border/60 bg-background/60">
            <Image src={mediaSrc} alt={mediaAlt ?? step.title} fill className="object-contain" />
          </div>
          <figcaption className="premium-lesson-muted mt-2 text-xs">图示用于支撑当前环节的设计判断。</figcaption>
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
                    {renderInlineMathText(item)}
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

export function UNIT_3_6StudentActivityForm({
  step,
  savedResponse,
  released,
  answerVisible,
  onSubmit,
  onWorkspaceParameterChange,
}: {
  step: UNIT_3_6StepDefinition;
  savedResponse?: UNIT_3_6StepResponse;
  released: boolean;
  answerVisible: boolean;
  onSubmit: (response: UNIT_3_6StepResponse) => void;
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

  const renderQuizGroup = (questions: typeof PRETEST_QUESTIONS | typeof FINAL_QUIZ_QUESTIONS) => (
    <div className="grid gap-4">
      {questions.map((question) => (
        <div key={question.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
          <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
          <div className="mt-3">
            {question.type === 'text' ? (
              <TextInput
                value={draft[question.key] ?? ''}
                onChange={(value) => updateDraft(question.key, value)}
                placeholder="写一句你的判断或解释"
                multiline
              />
            ) : (
              renderChoiceButtons({
                options: question.options,
                value: draft[question.key] ?? '',
                onChange: (value) => updateDraft(question.key, value, 'button'),
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const toggleDelimitedValue = (key: string, value: string) => {
    const currentValues = parseList(draft[key]);
    const nextValues = currentValues.includes(value)
      ? currentValues.filter((item) => item !== value)
      : [...currentValues, value];
    updateDraft(key, nextValues.join('||'), 'button');
  };

  let formBody: React.ReactNode = null;
  let submitLabel = '提交本页记录';

  switch (step.pageType) {
    case 'display':
      formBody = <div className="premium-lesson-muted text-sm">本页以静态承载为主，不需要单独提交。</div>;
      break;
    case 'single_choice':
      formBody = renderChoiceButtons({
        options: [
          { value: 'A', label: 'A：先看根轨迹' },
          { value: 'B', label: 'B：先看 Bode 图' },
          { value: 'C', label: 'C：先看目标是什么' },
        ],
        value: draft.selectedOption ?? '',
        onChange: (value) => updateDraft('selectedOption', value, 'button'),
      });
      submitLabel = '提交首次判断';
      break;
    case 'quiz_group':
      formBody = renderQuizGroup(PRETEST_QUESTIONS);
      submitLabel = '提交前测';
      break;
    case 'categorize_and_confirm':
      formBody = (
        <div className="grid gap-4">
          <div className="grid gap-3">
            {DESIGN_TASK_CARDS.map((task) => (
              <div key={task.id} className="premium-lesson-surface-elevated px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{task.label}</div>
                <div className="premium-lesson-muted mt-1 text-xs">{task.summary}</div>
                <div className="mt-3">
                  <SelectField
                    value={draft[task.id] ?? ''}
                    onChange={(value) => updateDraft(task.id, value, 'select')}
                    options={ENTRY_BUCKETS.map((bucket) => ({ value: bucket.key, label: bucket.title }))}
                  />
                </div>
              </div>
            ))}
          </div>
          <TextInput
            value={draft.bucketReason ?? ''}
            onChange={(value) => updateDraft('bucketReason', value)}
            placeholder="补一句：哪一个任务最容易被分错，为什么？"
            multiline
          />
        </div>
      );
      break;
    case 'workspace_builder':
      formBody = (
        <div className="grid gap-4">
          {CONSTRAINT_TRANSLATION_FIELDS.map((field) => (
            <div key={field.key}>
              <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
              <TextInput
                value={draft[field.key] ?? ''}
                onChange={(value) => updateDraft(field.key, value)}
                placeholder="填写你的翻译或解释"
                multiline={field.key === 'pureGainFailure'}
              />
            </div>
          ))}
        </div>
      );
      break;
    case 'sequenced_reveal':
      formBody = (
        <div className="grid gap-4">
          {[1, 2, 3, 4].map((order) => (
            <div key={order}>
              <div className="premium-lesson-title text-sm font-medium">第 {order} 步</div>
              <div className="mt-2">
                <SelectField
                  value={draft[`sequence-${order}`] ?? ''}
                  onChange={(value) => updateDraft(`sequence-${order}`, value, 'select')}
                  options={SEQUENCE_REVEAL_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
                />
              </div>
            </div>
          ))}
        </div>
      );
      submitLabel = '提交显影顺序';
      break;
    case 'parameter_workspace':
      formBody = (
        <div className="grid gap-4">
          {PARAMETER_WORKSPACE_FIELDS.map((field) => (
            <div key={field.key}>
              <div className="premium-lesson-title text-sm font-medium">{field.label}</div>
              <TextInput
                value={draft[field.key] ?? ''}
                onChange={(value) => updateDraft(field.key, value)}
                placeholder="填写关键记录"
                multiline={field.key === 'validation' || field.key === 'reason'}
              />
            </div>
          ))}
          {step.id === 'step-09' ? (
            <div>
              <div className="premium-lesson-title text-sm font-medium">调整顺序</div>
              <TextInput
                value={draft.adjustmentOrder ?? ''}
                onChange={(value) => updateDraft('adjustmentOrder', value)}
                placeholder="例如：等效极点 -> Kt -> K -> 验收"
              />
            </div>
          ) : null}
        </div>
      );
      break;
    case 'structured_response':
      formBody =
        step.id === 'step-12' ? (
          <div className="grid gap-4">
            <div>
              <div className="premium-lesson-title text-sm font-medium">理由标签</div>
              {renderMultiChoiceButtons({
                options: REASON_TAG_OPTIONS,
                values: parseList(draft.reasonTags),
                onToggle: (value) => toggleDelimitedValue('reasonTags', value),
              })}
            </div>
            <TextInput
              value={draft.compareIntent ?? ''}
              onChange={(value) => updateDraft('compareIntent', value)}
              placeholder="补一句：为什么这里必须沿用相同频域目标？"
              multiline
            />
          </div>
        ) : (
          <div className="grid gap-4">
            <div>
              <div className="premium-lesson-title text-sm font-medium">理由说明</div>
              <TextInput
                value={draft.responseText ?? ''}
                onChange={(value) => updateDraft('responseText', value)}
                placeholder="写一句：为什么频域设计必须先看只调增益会怎样？"
                multiline
              />
            </div>
            <div>
              <div className="premium-lesson-title text-sm font-medium">关键词命中</div>
              {renderMultiChoiceButtons({
                options: STRUCTURED_RESPONSE_KEYWORD_OPTIONS,
                values: parseList(draft.keywordCoverage),
                onToggle: (value) => toggleDelimitedValue('keywordCoverage', value),
              })}
            </div>
          </div>
        );
      submitLabel = '提交理由';
      break;
    case 'structured_compare':
      formBody = (
        <div className="grid gap-4">
          <div>
            <div className="premium-lesson-title text-sm font-medium">共同目标与差异结论</div>
            <TextInput
              value={draft.compareSummary ?? ''}
              onChange={(value) => updateDraft('compareSummary', value)}
              placeholder="写出共同目标与主要差异"
              multiline
            />
          </div>
          <div>
            <div className="premium-lesson-title text-sm font-medium">差异标签</div>
            {renderMultiChoiceButtons({
              options: DIFFERENCE_TAG_OPTIONS,
              values: parseList(draft.differenceTags),
              onToggle: (value) => toggleDelimitedValue('differenceTags', value),
            })}
          </div>
        </div>
      );
      break;
    case 'decision_submit':
      formBody = (
        <div className="grid gap-4">
          <div>
            <div className="premium-lesson-title text-sm font-medium">当前目标是否仍可原样保持</div>
            <SelectField
              value={draft.feasibilityChoice ?? ''}
              onChange={(value) => updateDraft('feasibilityChoice', value, 'select')}
              options={[
                { value: 'recheck-goal', label: '需要先重审目标' },
                { value: 'keep-goal', label: '可基本保持原目标' },
              ]}
            />
          </div>
          <div>
            <div className="premium-lesson-title text-sm font-medium">结构选择</div>
            {renderMultiChoiceButtons({
              options: BOUNDARY_STRUCTURE_OPTIONS,
              values: parseList(draft.structureChoice),
              onToggle: (value) => toggleDelimitedValue('structureChoice', value),
            })}
          </div>
          <div>
            <div className="premium-lesson-title text-sm font-medium">理由</div>
            <TextInput
              value={draft.reasonSubmitted ?? ''}
              onChange={(value) => updateDraft('reasonSubmitted', value)}
              placeholder="说明你为什么做这个判断"
              multiline
            />
          </div>
        </div>
      );
      break;
    case 'quiz_group+exit_reflection':
      formBody = (
        <div className="grid gap-4">
          {renderQuizGroup(FINAL_QUIZ_QUESTIONS)}
          <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">一句反思</div>
            <div className="mt-3">
              <TextInput
                value={draft.reflectionSubmitted ?? ''}
                onChange={(value) => updateDraft('reflectionSubmitted', value)}
                placeholder="写一句你要带走的设计判断"
                multiline
              />
            </div>
          </div>
        </div>
      );
      submitLabel = '提交后测与反思';
      break;
    default:
      formBody = null;
  }

  const handleSubmit = () => {
    if (step.pageType === 'display') return;
    const answers = { ...draft };
    if (step.pageType === 'sequenced_reveal') {
      answers.revealOrder = [answers['sequence-1'], answers['sequence-2'], answers['sequence-3'], answers['sequence-4']]
        .filter(Boolean)
        .join('||');
      answers.completedState =
        [answers['sequence-1'], answers['sequence-2'], answers['sequence-3'], answers['sequence-4']].every(Boolean)
          ? 'complete'
          : 'incomplete';
    }
    if (step.pageType === 'structured_response' && step.id === 'step-10') {
      answers.responseSubmitted = answers.responseText ? 'submitted' : 'empty';
    }
    if (step.pageType === 'structured_response' && step.id === 'step-12') {
      answers.completedState = answers.compareIntent || answers.reasonTags ? 'complete' : 'incomplete';
    }
    if (step.pageType === 'quiz_group+exit_reflection') {
      const score =
        Number(answers.q1 === 'same-goal') +
        Number(answers.q2 === 'equivalent-pole') +
        Number(answers.q3 === 'nmp-boundary');
      answers.posttestAccuracy = `${score}/3`;
    }
    submit(answers);
  };

  return (
    <section className="premium-lesson-panel px-4 py-5">
      <div className="premium-lesson-kicker">Student Activity</div>
      <h3 className="premium-lesson-title mt-2 text-lg font-semibold">学生作答区</h3>

      {locked ? (
        <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">等待教师释放本页活动后再提交。</div>
      ) : null}

      <div className={`mt-4 ${locked ? 'pointer-events-none opacity-60' : ''}`}>{formBody}</div>

      {step.pageType !== 'display' ? (
        <>
          <SubmissionStatus
            submitted={submitted}
            submittedText="提交成功，已同步到教师端汇总。"
            idleText="提交后会同步到教师端汇总；如教师允许，也可再次修改。"
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={locked}
              className="premium-lesson-action-primary"
            >
              {submitLabel}
            </button>
            {savedResponse ? (
              <button
                type="button"
                onClick={() => setDraft(savedResponse.answers)}
                className="premium-lesson-action-secondary"
              >
                恢复已提交版本
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {answerVisible && getRevealContent(step) ? (
        <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm">{getRevealContent(step)}</div>
      ) : null}
    </section>
  );
}

export function UNIT_3_6StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_3_6StepResponse>;
}) {
  const completed = UNIT_3_6_LESSON_STEPS.filter((step) => responses[step.id]);

  return (
    <section className="premium-lesson-panel px-4 py-5">
      <div className="premium-lesson-kicker">Summary</div>
      <h3 className="premium-lesson-title mt-2 text-lg font-semibold">本课完成情况</h3>
      <div className="premium-lesson-muted mt-2 text-sm">已完成 {completed.length} / {UNIT_3_6_LESSON_STEPS.length} 个环节。</div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {completed.map((step) => (
          <div key={step.id} className="premium-lesson-surface-elevated px-4 py-3">
            <div className="premium-lesson-title text-sm font-medium">{step.title}</div>
            <div className="premium-lesson-muted mt-1 text-xs">{step.hint}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function UNIT_3_6TeacherActivitySummary({
  step,
  responses,
  answerVisible,
  released,
  onToggleRelease,
  onToggleAnswerVisible,
}: {
  step: UNIT_3_6StepDefinition;
  responses: UNIT_3_6TeacherResponseItem[];
  answerVisible: boolean;
  released: boolean;
  onToggleRelease: () => void;
  onToggleAnswerVisible: () => void;
}) {
  const answerCounts = useMemo(() => countAnswers(responses), [responses]);
  const words = useMemo(() => getWordCloudEntries(responses), [responses]);

  return (
    <section className="premium-lesson-panel px-4 py-5">
      <div className="premium-lesson-kicker">Teacher Summary</div>
      <h3 className="premium-lesson-title mt-2 text-lg font-semibold">教师汇总区</h3>

      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={onToggleRelease} className="premium-lesson-action-primary">
          {released ? '收回活动' : '释放活动'}
        </button>
        {supportsAnswerReveal(step) ? (
          <button type="button" onClick={onToggleAnswerVisible} className="premium-lesson-action-secondary">
            {answerVisible ? '隐藏参考答案' : '显示参考答案'}
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="premium-lesson-surface-elevated px-4 py-4">
          <div className="premium-lesson-title text-sm font-medium">提交概况</div>
          <div className="premium-lesson-muted mt-1 text-xs">当前共有 {responses.length} 份提交。</div>
          <div className="mt-3 grid gap-2 text-sm">
            {answerCounts.length ? (
              answerCounts.slice(0, 8).map(([label, count]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-2xl bg-background/70 px-3 py-2">
                  <span className="truncate">{label}</span>
                  <span className="premium-lesson-tone-pill premium-tone-cyan">{count}</span>
                </div>
              ))
            ) : (
              <div className="premium-lesson-muted text-sm">本页尚无可汇总的选择或标签。</div>
            )}
          </div>
        </div>

        <div className="premium-lesson-surface-elevated px-4 py-4">
          <div className="premium-lesson-title text-sm font-medium">词云摘要</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {words.length ? (
              words.map(([word, count]) => (
                <span key={word} className="premium-lesson-tone-pill premium-tone-amber">
                  {word} × {count}
                </span>
              ))
            ) : (
              <div className="premium-lesson-muted text-sm">本页暂未形成文本词云。</div>
            )}
          </div>
        </div>
      </div>

      {answerVisible && getRevealContent(step) ? (
        <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm">{getRevealContent(step)}</div>
      ) : null}
    </section>
  );
}

export function UNIT_3_6TeacherStudentList({
  responses,
}: {
  responses: UNIT_3_6TeacherResponseItem[];
}) {
  return (
    <div className="grid gap-3">
      {responses.map((item) => (
        <div key={`${item.studentName}-${item.response.submittedAt}`} className="premium-lesson-surface-elevated px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="premium-lesson-title text-sm font-medium">{item.studentName}</div>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(JSON.stringify(item.response.answers, null, 2))}
              className="premium-lesson-control inline-flex items-center gap-1 text-xs"
            >
              <Copy className="h-3.5 w-3.5" />
              复制作答
            </button>
          </div>
          <pre className="premium-lesson-muted mt-3 overflow-x-auto rounded-2xl bg-background/70 px-3 py-3 text-xs leading-6">
            {JSON.stringify(item.response.answers, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}
