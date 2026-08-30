'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactElement } from 'react';
import type { ECharts } from 'echarts/core';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import {
  UNIT_3_3_LESSON_STEPS,
  UNIT_3_3_STAGE_LABEL,
  type UNIT_3_3StepDefinition,
  type UNIT_3_3StepResponse,
} from '@/lib/unit-3-3-course';
import { useControlEngine } from '@/resources/control-system/analysis/use-control-engine';
import { getUnit33FallbackResult } from '@/resources/control-system/analysis/unit-3-3-fixtures';
import { buildUnit33AnalysisRequest } from '@/resources/control-system/analysis/unit-3-3-request-builder';
import type { ComplexPoint, RootLocusSamplePoint } from '@/resources/control-system/analysis/types';
import { RootLocusPanel } from '@/resources/control-system/charts/control-analysis-panels';
import type {
  ActivityCardDefinition,
  ChoiceOption,
  QuizQuestion,
  WorkspaceParameterChange,
} from './workspace';
import {
  CLASSIFICATION_CARDS,
  CLASSIFICATION_OPTIONS,
  POSTTEST_QUESTIONS,
  STEP07_CARDS,
  STEP09_CARDS,
  STEP11_CARDS,
  WORKFLOW_SEQUENCE,
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

type ActivitySpec =
  | { kind: 'none'; helper: string }
  | { kind: 'binary_choice'; helper: string; options: ChoiceOption[]; correct: string }
  | { kind: 'worked_example'; helper: string; cards: ActivityCardDefinition[] }
  | { kind: 'activity_cards'; helper: string; cards: ActivityCardDefinition[] }
  | { kind: 'sequence_sort'; helper: string }
  | { kind: 'classification_cards'; helper: string }
  | { kind: 'quiz_group'; helper: string; questions: QuizQuestion[] };

export interface UNIT_3_3TeacherResponseItem {
  studentName: string;
  response: UNIT_3_3StepResponse;
}

const SKELETON_RULES = [
  {
    title: '法则 1 起点与终点',
    body: '根轨迹从开环极点出发，终止于开环零点；若零点不足，则剩余分支沿渐近线走向无穷远。',
    formula: 'n\\text{ 条分支从 }n\\text{ 个开环极点出发，终止于 }m\\text{ 个零点或 }n-m\\text{ 个无穷远点}',
    tone: 'cyan' as Tone,
  },
  {
    title: '法则 2 对称性与连续性',
    body: '实系数系统的根轨迹关于实轴对称，且每条分支随参数连续变化，不能凭空跳段。',
    formula: 's^\\ast \\in \\text{轨迹}\\Rightarrow s \\in \\text{轨迹}',
    tone: 'emerald' as Tone,
  },
  {
    title: '法则 3 实轴区段',
    body: '若测试点右侧开环实极点与实零点总数为奇数，则该实轴段属于根轨迹。',
    formula: 'N_{\\mathrm{right}}\\text{ 为奇数}\\Rightarrow s_0\\text{ 所在实轴段属于轨迹}',
    tone: 'amber' as Tone,
  },
  {
    title: '法则 4 渐近线',
    body: '零点少于极点时，先用重心确定穿出位置，再用角度公式确定无穷远方向。',
    formula: '\\sigma_a=\\frac{\\sum p_i-\\sum z_i}{n-m},\\quad \\phi_q=\\frac{(2q+1)\\pi}{n-m}',
    tone: 'violet' as Tone,
  },
] as const;

function toneClass(tone: Tone = 'slate') {
  return `premium-tone-${tone}`;
}

function getStepBlueprint(step: UNIT_3_3StepDefinition): StepBlueprint {
  switch (step.id) {
    case 'step-01':
      return {
        kicker: 'Map',
        intro: '3-2 已经讲清稳定边界，3-3 要解释极点为什么沿特定路径迁移，3-4 则继续把这条路径读成判断窗口。',
        sections: [
          { title: '路径图', tone: 'cyan', bullets: ['3-2：稳定边界。', '3-3：迁移机制与完整法则。', '3-4：按图判断与参数窗口。'] },
          { title: '本页主问题', tone: 'emerald', body: '参数连续变化时，闭环极点究竟沿什么路径移动。' },
        ],
      };
    case 'step-02':
      return {
        kicker: 'Question',
        intro: '只知道边界点，仍然回答不了“极点先往哪走、何时更振荡、参数该朝哪里调”。',
        sections: [
          { title: '四个追问', tone: 'amber', bullets: ['极点先往哪走？', '什么时候更振荡？', '什么时候触碰稳定边界？', '参数应朝哪个方向调整？'] },
          { title: '本页结论', tone: 'violet', body: '边界判断告诉我们停在哪里，迁移机制解释极点怎样一路走过去。' },
        ],
      };
    case 'step-03':
      return {
        kicker: 'Goals',
        intro: '本页只展示本次课程目标，不再面向学生展示边界表。',
        sections: [
          { title: '四项目标', tone: 'cyan', bullets: ['说明根轨迹研究的是闭环极点迁移。', '用相角条件判断资格，用幅值条件回算参数。', '按层次使用九项法则。', '把图形翻译回系统动态趋势。'] },
          { title: '主线链', tone: 'emerald', formula: '\\text{参数变化}\\rightarrow\\text{闭环极点迁移}\\rightarrow\\text{轨迹条件}\\rightarrow\\text{完整法则}\\rightarrow\\text{动态判断}' },
        ],
      };
    case 'step-04':
      return {
        kicker: 'Definition',
        intro: '根轨迹研究的不是某个时刻的单个根，而是参数变化下的闭环根集合。',
        sections: [
          { title: '普通根轨迹定义', tone: 'cyan', body: '当 K 从 0 连续变化到 +∞ 时，闭环特征方程全部根在 s 平面形成的轨迹集合。' },
          { title: '入口方程', tone: 'emerald', formula: '1+L(s)=0\\rightarrow L(s)=-1' },
          { title: '相角条件', tone: 'violet', formula: '\\angle G_0(s_0)H(s_0)=(2\\ell+1)\\pi' },
          { title: '幅值条件', tone: 'amber', formula: 'K=1/|G_0(s_0)H(s_0)|' },
        ],
        note: '判断顺序必须固定为先资格、后参数：相角条件先判资格，幅值条件再定参数。',
      };
    case 'step-07':
      return {
        kicker: 'Example 1',
        intro: '第一道例题只用骨架法则，先把整张图的总体走向搭起来。',
        sections: [
          { title: '方法链', tone: 'cyan', bullets: ['起点终点', '实轴区段', '渐近线', '整体走向'] },
          { title: '题面', tone: 'emerald', formula: 'G(s)H(s)=K/[s(s+2)(s+4)]' },
        ],
      };
    case 'step-08':
      return {
        kicker: 'Keypoints',
        intro: '关键节点不是一团“细节”，而是分离点、虚轴交点等不同问题的回答入口。',
        sections: [
          { title: '分离点', tone: 'cyan', formula: 'K(s)=-D(s)/N(s),\\ \\mathrm{d}K/\\mathrm{d}s=0' },
          { title: '虚轴交点', tone: 'emerald', body: '写出闭环特征方程，以 K 为参数列劳斯表，再由辅助方程求虚轴交点频率。' },
        ],
      };
    case 'step-09':
      return {
        kicker: 'Example 2',
        intro: '第二道例题把 dK/ds 和劳斯判据放进同一道题里，目的在于分清实轴关键点与稳定边界。',
        sections: [
          { title: '方法分工', tone: 'cyan', bullets: ['dK/ds 链负责找实轴关键点。', '劳斯判据链负责找稳定边界与虚轴交点。'] },
        ],
      };
    case 'step-10':
      return {
        kicker: 'Direction Rules',
        intro: '出射角、入射角和根之和不是同一种法则，但它们都在约束图形怎样局部离开、整体怎样自洽。',
        sections: [
          { title: '出射角', tone: 'cyan', formula: '\\phi_d(p_i)=\\pi+\\sum\\angle(p_i-z_j)-\\sum_{r\\ne i}\\angle(p_i-p_r)' },
          { title: '入射角', tone: 'emerald', formula: '\\phi_a(z_j)=\\pi-\\sum_{k\\ne j}\\angle(z_j-z_k)+\\sum\\angle(z_j-p_r)' },
          { title: '根之和', tone: 'violet', formula: '\\sum s_i(K)=\\sum p_i' },
        ],
      };
    case 'step-11':
      return {
        kicker: 'Example 3',
        intro: '第三道例题把局部出射角和整图根之和校核放在一起，说明局部方向与整图守恒必须同时成立。',
        sections: [
          { title: '题面', tone: 'cyan', formula: 'G(s)H(s)=K/[(s+2)(s^2+2s+5)]' },
          { title: '抓手', tone: 'emerald', bullets: ['先求出射角。', '再用共轭对称补下半平面。', '最后用根之和复核另一实根位置。'] },
        ],
      };
    case 'step-12':
      return {
        kicker: 'Workflow',
        intro: '九项法则共同构成普通根轨迹，但课堂执行时必须把它重组为七步读图法。',
        sections: [
          { title: '七步读图法', tone: 'cyan', bullets: WORKFLOW_SEQUENCE.map((item) => item.label) },
          { title: '误判提示', tone: 'amber', body: '不要先抓分离点而忽略骨架。' },
        ],
      };
    case 'step-13':
      return {
        kicker: 'Pole Types',
        intro: '不同开环极点类型会留下不同的轨迹趋势线索。',
        sections: [
          { title: '原点极点', tone: 'cyan', body: '更接近积分型结构，需要优先关注低频拖尾。' },
          { title: '实轴极点', tone: 'emerald', body: '直接决定实轴区段与分离 / 汇合可能。' },
          { title: '共轭复极点', tone: 'violet', body: '必须补局部方向，振荡趋势更明显。' },
        ],
      };
    case 'step-14':
      return {
        kicker: 'Posttest',
        intro: '后测只检查条件顺序、法则职责、例题分工与读图顺序。',
        sections: [{ title: '诊断目标', tone: 'amber', bullets: ['条件顺序', '法则职责', '例题分工', '读图顺序'] }],
      };
    case 'step-15':
      return {
        kicker: 'Summary',
        intro: '本页只回收结论与下一课去向，不再兼任测验页。',
        sections: [
          { title: '五条带走', tone: 'emerald', bullets: ['根轨迹研究的是闭环极点迁移。', '相角条件先判资格，幅值条件再定参数。', '先骨架，再关键点，最后补局部方向。', '关键节点和根之和各司其职。', '图上的路径最终要翻回稳定性、快慢与振荡判断。'] },
        ],
      };
    default:
      return { kicker: '3-3', intro: step.hint, sections: [] };
  }
}

function ChoiceGroup({ options, value, onChange, disabled = false }: { options: ChoiceOption[]; value: string; onChange: (value: string) => void; disabled?: boolean }) {
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
          className={`premium-lesson-control justify-start text-left ${value === option.value ? 'ring-2 ring-cyan-400' : ''}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, disabled = false }: { value: string; onChange: (value: string) => void; placeholder: string; disabled?: boolean }) {
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

interface RevealItem {
  title: string;
  body?: string;
  formula?: string;
  tone?: Tone;
}

const STEP05_POLES: ComplexPoint[] = [{ re: -2.6, im: 0 }, { re: -0.3, im: 0 }];
const STEP05_ZEROS: ComplexPoint[] = [{ re: -3.5, im: 0 }];
const STEP05_DEFAULT_POINT: ComplexPoint = { re: -1.25, im: 1.35 };
const STEP05_POLE_THETA_LABELS = ['theta_{p1}', 'theta_{p2}'] as const;
const STEP05_ZERO_THETA_LABELS = ['theta_{z1}'] as const;
const SVG_PHASES = ['空白坐标轴', '列出极点', '绘制实轴根轨迹', '绘制渐近线', '绘制完整轨迹'] as const;
const STEP08_BREAKAWAY_REVEALS: RevealItem[] = [
  {
    title: '写出候选点增益函数',
    body: '对普通根轨迹，分离点与汇合点都来自“沿实轴把 K 写成 s 的函数”这一步。',
    formula: 'K(s)=-\\dfrac{D(s)}{N(s)}',
    tone: 'cyan',
  },
  {
    title: '由导数条件找候选点',
    body: '候选点来自 dK/ds=0，但并不自动成为真实分离点，还必须继续过筛。',
    formula:
      '\\dfrac{\\mathrm{d}K}{\\mathrm{d}s}=0\\ \\Longleftrightarrow\\ \\sum_{j=1}^{m}\\dfrac{1}{s-z_j}-\\sum_{i=1}^{n}\\dfrac{1}{s-p_i}=0',
    tone: 'emerald',
  },
  {
    title: '只保留位于实轴根轨迹区段的点',
    body: '先筛实轴区段：若候选点落在不属于根轨迹的实轴段，即使导数为零，也不能认作真实分离点或汇合点。',
    formula: 's_b\\in \\text{实轴根轨迹区段}',
    tone: 'amber',
  },
  {
    title: '再代回增益判断正增益',
    body: '再筛 K>0：普通根轨迹默认只取正增益，因此还要把候选点代回 K(s) 检查其符号。',
    formula: 'K(s_b)>0',
    tone: 'violet',
  },
  {
    title: '分离点与汇合点共用同一组公式',
    body: '单根从实轴离开叫分离点，两支复根回到实轴叫汇合点；判定框架完全相同，只是图形语义不同。',
    formula: '\\text{分离点或汇合点}\\Rightarrow K(s),\\ \\dfrac{\\mathrm{d}K}{\\mathrm{d}s},\\ s_b\\in\\text{轨迹},\\ K(s_b)>0',
    tone: 'slate',
  },
] as const;
const STEP08_IMAGINARY_AXIS_REVEALS: RevealItem[] = [
  {
    title: '先写闭环特征方程',
    body: '把 s=jω 代入闭环特征方程，先把“根轨迹何时碰到稳定边界”写成明确方程。',
    formula: 'D(s)+KN(s)=0',
    tone: 'emerald',
  },
  {
    title: '以 K 为参数列劳斯表',
    body: '劳斯判据在这里负责找临界稳定增益，不再和分离点链混写。',
    formula:
      '\\begin{array}{c|cc}s^n & a_n & a_{n-2} \\\\ s^{n-1} & a_{n-1} & a_{n-3} \\\\ \\vdots & \\vdots & \\vdots\\end{array}',
    tone: 'cyan',
  },
  {
    title: '由首列临界条件求临界增益',
    body: '由劳斯表首列临界条件求 K；当某行首元为零或某行全零时，说明根轨迹正碰到虚轴。',
    formula: '\\text{劳斯表首列临界条件}\\Rightarrow K=K_{\\mathrm{cr}}',
    tone: 'amber',
  },
  {
    title: '由辅助方程求虚轴交点频率',
    body: '再由辅助方程求虚轴交点频率；临界增益只告诉我们“何时碰到边界”，辅助方程再给出交点频率。',
    formula: 'A(s)=0,\\ s=\\pm j\\omega_c',
    tone: 'violet',
  },
] as const;
const STEP09_REVEALS: RevealItem[] = [
  {
    title: '第一步：先固定题面并写出闭环特征方程',
    body: '先把题面与特征方程放到同一层，后续两条求解链都围绕这条方程展开。',
    formula: 'G(s)H(s)=K/[s(s+1)(s+2)],\\quad s^3+3s^2+2s+K=0',
    tone: 'cyan',
  },
  {
    title: '第二步：写出 K(s) 并求导',
    body: '分离点链只负责回答实轴关键点，不负责稳定边界。',
    formula: 'K(s)=-s(s+1)(s+2),\\ \\dfrac{\\mathrm{d}K}{\\mathrm{d}s}=-(3s^2+6s+2)=0',
    tone: 'emerald',
  },
  {
    title: '第三步：先给候选点，再筛真实分离点',
    body: '两个候选点里，只有位于根轨迹实轴段且回代后 K>0 的点才是真实分离点。',
    formula: 's=-1\\pm\\sqrt{3}/3,\\quad s=-1+\\sqrt{3}/3\\approx -0.423',
    tone: 'amber',
  },
  {
    title: '第四步：把真实分离点代回增益',
    body: '到这里，分离点链才真正闭合。',
    formula: 'K\\approx 0.3849',
    tone: 'violet',
  },
  {
    title: '第五步：另起一条劳斯判据链',
    body: '虚轴交点不是由 dK/ds 给出的，而是由临界稳定条件给出的。',
    formula:
      '\\begin{array}{c|cc}s^3 & 1 & 2 \\\\ s^2 & 3 & K \\\\ s^1 & \\dfrac{6-K}{3} & 0 \\\\ s^0 & K & \\end{array}',
    tone: 'cyan',
  },
  {
    title: '第六步：求临界增益与虚轴交点',
    body: '先由劳斯表求 K=6，再由辅助方程给出交点频率，并回到稳定范围。',
    formula: 'K_{\\mathrm{cr}}=6,\\quad s=\\pm j\\sqrt{2},\\quad 0<K<6',
    tone: 'emerald',
  },
] as const;
const STEP11_REVEALS: RevealItem[] = [
  {
    title: '第一步：先写开环极点与对称性',
    body: '本题有一个实极点和一对共轭复极点，所以局部方向必须与共轭对称一起判断。',
    formula: 'p_1=-2,\\quad p_{2,3}=-1\\pm j2',
    tone: 'cyan',
  },
  {
    title: '第二步：以上半平面复极点求出射角',
    body: '对上半平面极点，只统计其它极点和全部零点对它的夹角贡献。',
    formula: 'p=-1+j2,\\quad \\phi_d=\\pi-\\angle(p+2)-\\angle\\bigl[p-(-1-j2)\\bigr]',
    tone: 'emerald',
  },
  {
    title: '第三步：代入几何角度得到数值结果',
    body: '这一角度说明轨迹怎样离开复极点，而不是整张图已经画完。',
    formula: '\\phi_d=180^\\circ-63.435^\\circ-90^\\circ=26.565^\\circ',
    tone: 'amber',
  },
  {
    title: '第四步：由共轭对称补出下半平面结果',
    body: '实系数系统关于实轴对称，因此另一条分支的局部方向直接镜像。',
    formula: '\\phi_d^{\\ast}=-26.565^\\circ',
    tone: 'violet',
  },
  {
    title: '第五步：再用根之和检查整图自洽',
    body: '出射角只说明局部离开方向，整张图还要满足闭环根之和始终等于开环极点之和。',
    formula: '\\sum s_i(K)=(-2)+(-1+j2)+(-1-j2)=-4',
    tone: 'slate',
  },
] as const;

function formatSigned(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(3)}`;
}

function normalizeAngleDegrees(value: number) {
  let normalized = value % 360;
  if (normalized < 0) {
    normalized += 360;
  }
  return normalized;
}

function normalizeSignedAngleDegrees(value: number) {
  const normalized = normalizeAngleDegrees(value);
  return normalized > 180 ? normalized - 360 : normalized;
}

function projectChartPoint(chart: ECharts | null, point: ComplexPoint) {
  if (!chart) {
    return null;
  }
  const pixel = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [point.re, point.im]);
  if (!Array.isArray(pixel) || pixel.length < 2) {
    return null;
  }
  const [left, top] = pixel;
  if (!Number.isFinite(left) || !Number.isFinite(top)) {
    return null;
  }
  return { left, top };
}

function renderRevealBody(item: RevealItem) {
  return (
    <>
      {item.body ? <div className="text-sm leading-7">{item.body}</div> : null}
      {item.formula ? (
        <div className="mt-3 rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
          <BlockMath math={item.formula} />
        </div>
      ) : null}
    </>
  );
}

function ProgressiveRevealChain({
  items,
  revealProgress,
  allowInlineReveal,
}: {
  items: readonly RevealItem[];
  revealProgress: number;
  allowInlineReveal: boolean;
}) {
  const teacherVisibleCount = Math.max(1, Math.min(items.length, revealProgress || 1));
  const [localVisibleCount, setLocalVisibleCount] = useState(teacherVisibleCount);

  useEffect(() => {
    setLocalVisibleCount(teacherVisibleCount);
  }, [items, teacherVisibleCount]);

  const visibleCount = Math.max(teacherVisibleCount, allowInlineReveal ? localVisibleCount : teacherVisibleCount);
  const canRevealMore = allowInlineReveal && visibleCount < items.length;

  return (
    <div className="space-y-3" data-progressive-reveal="step_click_reveal">
      {items.slice(0, visibleCount).map((item, index) => {
        const isLastVisible = index === visibleCount - 1;
        return (
          <button
            key={item.title}
            type="button"
            onClick={() => {
              if (isLastVisible && canRevealMore) {
                setLocalVisibleCount((current) => Math.min(items.length, current + 1));
              }
            }}
            className={`block w-full rounded-3xl border border-border/60 px-4 py-4 text-left ${toneClass(item.tone)} ${isLastVisible && canRevealMore ? 'ring-1 ring-cyan-400/50' : ''}`}
          >
            <div className="font-medium">{item.title}</div>
            <div className="mt-3">{renderRevealBody(item)}</div>
            {isLastVisible && canRevealMore ? (
              <div className="premium-lesson-muted mt-3 text-xs">点击当前最下方已显影步骤可继续展开下一层。</div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function findNearestSample(
  branches: RootLocusSamplePoint[][],
  target: { re: number; im: number } | null,
) {
  if (!target) {
    return null;
  }

  let best: RootLocusSamplePoint | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const branch of branches) {
    for (const sample of branch) {
      const distance = Math.hypot(sample.re - target.re, sample.im - target.im);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = sample;
      }
    }
  }
  return best;
}

function Step05GeometryOverlay({
  chart,
  selectedSample,
}: {
  chart: ECharts | null;
  selectedSample: RootLocusSamplePoint;
}) {
  const samplePoint = { re: selectedSample.re, im: selectedSample.im };
  const samplePixel = projectChartPoint(chart, samplePoint);
  if (!samplePixel) {
    return null;
  }

  const poleLabels = STEP05_POLES.map((pole, index) => ({
    key: `p${index + 1}`,
    color: '#dc2626',
    point: pole,
    pixel: projectChartPoint(chart, pole),
    thetaLabel: STEP05_POLE_THETA_LABELS[index],
  })).filter((item) => item.pixel);
  const zeroLabels = STEP05_ZEROS.map((zero, index) => ({
    key: `z${index + 1}`,
    color: '#d97706',
    point: zero,
    pixel: projectChartPoint(chart, zero),
    thetaLabel: STEP05_ZERO_THETA_LABELS[index],
  })).filter((item) => item.pixel);

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      {[...poleLabels, ...zeroLabels].map((item) => {
        if (!item.pixel) {
          return null;
        }
        const midX = (item.pixel.left + samplePixel.left) / 2;
        const midY = (item.pixel.top + samplePixel.top) / 2;
        return (
          <g key={item.key}>
            <line
              x1={item.pixel.left}
              y1={item.pixel.top}
              x2={samplePixel.left}
              y2={samplePixel.top}
              stroke={item.color}
              strokeDasharray="6 5"
              strokeWidth="2"
              opacity="0.9"
            />
            <text x={item.pixel.left + 10} y={item.pixel.top - 10} fill={item.color} fontSize="13" fontWeight="600">
              {item.key}
            </text>
            <text x={item.pixel.left + 10} y={item.pixel.top + 8} fill={item.color} fontSize="12" fontWeight="600">
              {item.key.startsWith('p') ? `开环极点 ${item.key}` : `开环零点 ${item.key}`}
            </text>
            <text x={midX + 6} y={midY - 8} fill={item.color} fontSize="12" fontWeight="600">
              {item.thetaLabel}
            </text>
          </g>
        );
      })}
      <text x={samplePixel.left + 10} y={samplePixel.top - 10} fill="#1f4e79" fontSize="13" fontWeight="600">
        s0
      </text>
    </svg>
  );
}

function ConditionBreakdownPanel({ selectedSample }: { selectedSample: RootLocusSamplePoint }) {
  const poleAngleDetails = STEP05_POLES.map((pole, index) => {
    const angle = normalizeAngleDegrees(Math.atan2(selectedSample.im - pole.im, selectedSample.re - pole.re) * 180 / Math.PI);
    const magnitude = Math.hypot(selectedSample.re - pole.re, selectedSample.im - pole.im);
    return {
      thetaLabel: STEP05_POLE_THETA_LABELS[index],
      pointLabel: `p${index + 1}`,
      angle,
      magnitude,
      pole,
    };
  });
  const zeroAngleDetails = STEP05_ZEROS.map((zero, index) => {
    const angle = normalizeAngleDegrees(Math.atan2(selectedSample.im - zero.im, selectedSample.re - zero.re) * 180 / Math.PI);
    const magnitude = Math.hypot(selectedSample.re - zero.re, selectedSample.im - zero.im);
    return {
      thetaLabel: STEP05_ZERO_THETA_LABELS[index],
      pointLabel: `z${index + 1}`,
      angle,
      magnitude,
      zero,
    };
  });

  const totalAngleRaw =
    zeroAngleDetails.reduce((sum, item) => sum + item.angle, 0) -
    poleAngleDetails.reduce((sum, item) => sum + item.angle, 0);
  const normalizedTotalAngle = normalizeSignedAngleDegrees(totalAngleRaw);
  const oddPiGap = Math.abs(Math.abs(normalizedTotalAngle) - 180);
  const angleSatisfied = oddPiGap < 18;
  const computedGain =
    poleAngleDetails.reduce((product, item) => product * item.magnitude, 1) /
    Math.max(zeroAngleDetails.reduce((product, item) => product * item.magnitude, 1), 1e-9);

  return (
    <div className="grid gap-3 text-sm">
      <div className="premium-lesson-tone-block premium-tone-cyan">
        左图右参数：当前沿根轨迹吸附到 <code>s_0=({formatSigned(selectedSample.re)}, {formatSigned(selectedSample.im)}j)</code>。
      </div>
      <div className="premium-lesson-surface-elevated rounded-2xl px-3 py-3">
        <div className="font-medium">相角条件逐项展开</div>
        <div className="mt-2 grid gap-2">
          {zeroAngleDetails.map((item) => (
            <div key={item.thetaLabel} className="rounded-2xl bg-background/70 px-3 py-2">
              {item.thetaLabel}: ∠(s₀-{formatSigned(item.zero.re)}) = {item.angle.toFixed(3)}°
            </div>
          ))}
          {poleAngleDetails.map((item) => (
            <div key={item.thetaLabel} className="rounded-2xl bg-background/70 px-3 py-2">
              {item.thetaLabel}: ∠(s₀-{formatSigned(item.pole.re)}) = {item.angle.toFixed(3)}°
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-2xl bg-background/70 px-3 py-3">
          相角和 = Σθz - Σθp = {normalizedTotalAngle.toFixed(3)}°，{angleSatisfied ? '满足奇数倍 π 的资格条件。' : '当前点不满足资格条件。'}
        </div>
      </div>
      <div className="premium-lesson-surface-elevated rounded-2xl px-3 py-3">
        <div className="font-medium">幅值条件逐项展开</div>
        <div className="mt-2 grid gap-2">
          {poleAngleDetails.map((item) => (
            <div key={`${item.pointLabel}-mag`} className="rounded-2xl bg-background/70 px-3 py-2">
              |s₀-{formatSigned(item.pole.re)}| = {item.magnitude.toFixed(4)}
            </div>
          ))}
          {zeroAngleDetails.map((item) => (
            <div key={`${item.pointLabel}-mag`} className="rounded-2xl bg-background/70 px-3 py-2">
              |s₀-{formatSigned(item.zero.re)}| = {item.magnitude.toFixed(4)}
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-2xl bg-background/70 px-3 py-3">
          由幅值条件得 K≈{computedGain.toFixed(4)}；轨迹采样中的 selectedSample.gain≈{(selectedSample.gain ?? computedGain).toFixed(4)}。
        </div>
      </div>
    </div>
  );
}

function ConditionWorkspacePanel({ onWorkspaceParameterChange }: { onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void }) {
  const request = useMemo(() => buildUnit33AnalysisRequest('step-05', { gain: 2 }), []);
  const fallbackResult = useMemo(() => getUnit33FallbackResult('step-05'), []);
  const { result } = useControlEngine(request, fallbackResult);
  const [selectedSample, setSelectedSample] = useState<RootLocusSamplePoint | null>(null);
  const chartRef = useRef<ECharts | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartEpoch, setChartEpoch] = useState(0);

  useEffect(() => {
    if (!result || selectedSample) {
      return;
    }
    const nearest = findNearestSample(result.rootLocus.branches, STEP05_DEFAULT_POINT);
    if (nearest) {
      setSelectedSample(nearest);
    }
  }, [result, selectedSample]);

  const updateSelectedSample = useCallback((sample: RootLocusSamplePoint) => {
    setSelectedSample(sample);
    onWorkspaceParameterChange?.({ key: 'condition_gain', value: sample.gain ?? 0, source: 'drag' });
  }, [onWorkspaceParameterChange]);

  const handlePointerMove = useCallback((event: PointerEvent) => {
    if (!chartRef.current || !chartContainerRef.current || !result) {
      return;
    }
    const rect = chartContainerRef.current.getBoundingClientRect();
    const pixelX = event.clientX - rect.left;
    const pixelY = event.clientY - rect.top;
    const data = chartRef.current.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [pixelX, pixelY]);
    if (!Array.isArray(data) || data.length < 2) {
      return;
    }
    const nearest = findNearestSample(result.rootLocus.branches, {
      re: Number(data[0]),
      im: Number(data[1]),
    });
    if (nearest) {
      updateSelectedSample(nearest);
    }
  }, [result, updateSelectedSample]);

  const stopDragging = useCallback(() => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', stopDragging);
  }, [handlePointerMove]);

  const startDragging = useCallback((_id: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDragging, { once: true });
  }, [handlePointerMove, stopDragging]);

  if (!result || !selectedSample) {
    return null;
  }

  return (
    <div className="mt-4 grid gap-4">
      <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">顶部常显条件</div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 text-sm [&_.katex-display]:m-0">
          <div className="rounded-2xl bg-background/70 px-3 py-3"><BlockMath math={'\\angle G_0(s_0)H(s_0)=(2\\ell+1)\\pi'} /></div>
          <div className="rounded-2xl bg-background/70 px-3 py-3"><BlockMath math={'K=1/|G_0(s_0)H(s_0)|'} /></div>
        </div>
        <div className="premium-lesson-muted mt-3 text-sm">下方工作区固定为左图右参数；拖动手柄时会沿根轨迹吸附，不再退化成直线滑块。</div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
          <div className="premium-lesson-title text-sm font-medium">根轨迹图</div>
          <div className="premium-lesson-muted mt-2 text-sm">沿根轨迹吸附拖动 s₀，图中同步标出开环极点、开环零点以及到动态点的角度连线。</div>
          <div className="mt-4">
            <RootLocusPanel
              result={result}
              caseId={request.caseId}
              chartClassName="min-h-[520px]"
              interactiveHandles={[
                {
                  id: 'step-05-s0',
                  kind: 'pole',
                  renderAs: 'closed-pole',
                  point: selectedSample,
                  draggable: true,
                  ariaLabel: '沿根轨迹吸附拖动 s0',
                },
              ]}
              overlay={chartEpoch > 0 ? <Step05GeometryOverlay chart={chartRef.current} selectedSample={selectedSample} /> : null}
              onHandlePointerDown={startDragging}
              onChartReady={(chart, container) => {
                chartRef.current = chart;
                chartContainerRef.current = container;
                setChartEpoch((current) => current + 1);
              }}
            />
          </div>
        </div>
        <ConditionBreakdownPanel selectedSample={selectedSample} />
      </div>
    </div>
  );
}

function buildStep06ProgressResult(result: ReturnType<typeof getUnit33FallbackResult>, phase: number) {
  const rootLocus = result.rootLocus;
  if (phase === 0) {
    return {
      ...result,
      rootLocus: {
        ...rootLocus,
        branches: [],
        currentPoles: [],
        openLoopPoles: [],
        openLoopZeros: [],
      },
    };
  }
  if (phase === 1) {
    return {
      ...result,
      rootLocus: {
        ...rootLocus,
        branches: [],
        currentPoles: [],
      },
    };
  }
  if (phase === 2 || phase === 3) {
    return {
      ...result,
      rootLocus: {
        ...rootLocus,
        branches: [],
        currentPoles: [],
        openLoopPoles: rootLocus.openLoopPoles,
        openLoopZeros: [],
      },
    };
  }
  return result;
}

function Step06ProgressOverlay({
  chart,
  phase,
}: {
  chart: ECharts | null;
  phase: number;
}) {
  if (!chart || phase < 1) {
    return null;
  }
  const centroid = { re: -2, im: 0 };
  const polePoints = [
    { label: '开环极点 p1', point: { re: 0, im: 0 } },
    { label: '开环极点 p2', point: { re: -2, im: 0 } },
    { label: '开环极点 p3', point: { re: -4, im: 0 } },
  ];
  const realAxisSegments = [
    { start: { re: -8, im: 0 }, end: { re: -4, im: 0 } },
    { start: { re: -2, im: 0 }, end: { re: 0, im: 0 } },
  ];
  const asymptoteTargets = [
    { re: -6.5, im: 0 },
    { re: 0.75, im: 4.85 },
    { re: 0.75, im: -4.85 },
  ];

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      {phase >= 1
        ? polePoints.map((item) => {
            const pixel = projectChartPoint(chart, item.point);
            if (!pixel) {
              return null;
            }
            return (
              <text key={item.label} x={pixel.left + 10} y={pixel.top - 10} fill="#c81d25" fontSize="12" fontWeight="600">
                {item.label}
              </text>
            );
          })
        : null}
      {phase >= 2
        ? realAxisSegments.map((segment, index) => {
            const start = projectChartPoint(chart, segment.start);
            const end = projectChartPoint(chart, segment.end);
            if (!start || !end) {
              return null;
            }
            return (
              <line
                key={`real-axis-${index}`}
                x1={start.left}
                y1={start.top}
                x2={end.left}
                y2={end.top}
                stroke="#0f766e"
                strokeWidth="4"
                strokeLinecap="round"
              />
            );
          })
        : null}
      {phase >= 3
        ? asymptoteTargets.map((target, index) => {
            const start = projectChartPoint(chart, centroid);
            const end = projectChartPoint(chart, target);
            if (!start || !end) {
              return null;
            }
            return (
              <line
                key={`asymptote-${index}`}
                x1={start.left}
                y1={start.top}
                x2={end.left}
                y2={end.top}
                stroke="#7c3aed"
                strokeDasharray="9 6"
                strokeWidth="2.5"
              />
            );
          })
        : null}
    </svg>
  );
}

function SkeletonRuleWorkspace({ onWorkspaceParameterChange }: { onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void }) {
  const [phase, setPhase] = useState(0);
  const request = useMemo(() => buildUnit33AnalysisRequest('step-06', { gain: 12 }), []);
  const fallbackResult = useMemo(() => getUnit33FallbackResult('step-06'), []);
  const { result } = useControlEngine(request, fallbackResult);
  const chartRef = useRef<ECharts | null>(null);
  const [chartEpoch, setChartEpoch] = useState(0);

  const advance = (next: number) => {
    setPhase(next);
    onWorkspaceParameterChange?.({ key: 'rule_phase', value: SVG_PHASES[next], source: 'button' });
  };

  if (!result) {
    return null;
  }
  const phaseResult = buildStep06ProgressResult(result, phase);

  return (
    <div className="mt-4 grid gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        {SKELETON_RULES.map((item, index) => (
          <div
            key={item.title}
            className={`premium-lesson-tone-block ${toneClass(item.tone)} ${phase === index + 1 || (phase === 4 && index === SKELETON_RULES.length - 1) ? 'ring-2 ring-cyan-400/60' : ''}`}
          >
            <div className="font-medium">{item.title}</div>
            <div className="mt-2 text-sm">{item.body}</div>
            <div className="mt-3 rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
              <BlockMath math={item.formula} />
            </div>
          </div>
        ))}
      </div>
      <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">骨架形成绘图区</div>
        <div className="premium-lesson-muted mt-2 text-sm">
          按下方按钮切换当前图层：从空白坐标轴开始，先看开环极点，再补实轴段、渐近线，最后才放出完整轨迹。
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SVG_PHASES.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => advance(index)}
              className={`premium-lesson-control ${index === phase ? 'ring-2 ring-cyan-400' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <RootLocusPanel
            result={phaseResult}
            caseId={request.caseId}
            chartClassName="min-h-[500px]"
            overlay={chartEpoch > 0 ? <Step06ProgressOverlay chart={chartRef.current} phase={phase} /> : null}
            onChartReady={(chart) => {
              chartRef.current = chart;
              setChartEpoch((current) => current + 1);
            }}
          />
        </div>
      </div>
      <div className="premium-lesson-tone-block premium-tone-amber text-sm">
        <div className="font-medium">读图提示与图例</div>
        <div className="mt-2">当前阶段：{SVG_PHASES[phase]}。</div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <div className="rounded-2xl bg-background/70 px-3 py-3">开环极点：红色叉号，决定起点。</div>
          <div className="rounded-2xl bg-background/70 px-3 py-3">实轴根轨迹：青绿色粗线，先判奇偶法则。</div>
          <div className="rounded-2xl bg-background/70 px-3 py-3">渐近线：紫色虚线，回答“零点不够时往哪走”。</div>
        </div>
      </div>
    </div>
  );
}

function KeypointMethodBoard() {
  return (
    <div className="mt-4 grid gap-4">
      <div className="premium-lesson-tone-block premium-tone-cyan">
        <div className="font-medium">分离点与汇合点推导</div>
        <div className="mt-3">
          <ProgressiveRevealChain items={STEP08_BREAKAWAY_REVEALS} revealProgress={0} allowInlineReveal />
        </div>
      </div>
      <div className="premium-lesson-tone-block premium-tone-emerald">
        <div className="font-medium">虚轴交点步骤</div>
        <div className="premium-lesson-muted mt-2 text-sm">顺序固定为：闭环特征方程 → 劳斯表 → 临界增益 → 辅助方程交点频率。</div>
        <div className="mt-3">
          <ProgressiveRevealChain items={STEP08_IMAGINARY_AXIS_REVEALS} revealProgress={0} allowInlineReveal />
        </div>
      </div>
    </div>
  );
}

function renderMedia(step: UNIT_3_3StepDefinition, mediaSrc?: string | null, mediaAlt?: string) {
  if (!mediaSrc) return null;
  return (
    <figure className="premium-lesson-surface-elevated mt-4 overflow-hidden px-4 py-4">
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-border/60 bg-background/60">
        <Image src={mediaSrc} alt={mediaAlt ?? step.title} fill className="object-contain" />
      </div>
      <figcaption className="premium-lesson-muted mt-2 text-xs">图示用于支撑当前环节的读图与判断。</figcaption>
    </figure>
  );
}

function WorkedExampleRevealBoard({
  stepId,
  revealProgress,
  allowInlineReveal,
}: {
  stepId: 'step-07' | 'step-09' | 'step-11';
  revealProgress: number;
  allowInlineReveal: boolean;
}) {
  const revealItems: readonly RevealItem[] =
    stepId === 'step-07'
      ? [
          {
            title: '第一步：先看起点与终点',
            body: '本题有三个开环极点、没有有限零点，所以三条分支都从极点出发，最终有三条无穷远分支。',
            formula: 'G(s)H(s)=\\dfrac{K}{s(s+2)(s+4)}',
            tone: 'cyan',
          },
          {
            title: '第二步：判定实轴区段',
            body: '在实轴上逐段检查右侧开环实极点个数，可得两段合法区间。',
            formula: '(-\\infty,-4),\\ (-2,0)\\in \\text{根轨迹}',
            tone: 'emerald',
          },
          {
            title: '第三步：写出渐近线重心与角度',
            body: '零点不足时，先算重心，再给出无穷远方向。',
            formula: '\\sigma_a=\\dfrac{0+(-2)+(-4)}{3}=-2,\\quad \\phi_q=60^\\circ,180^\\circ,300^\\circ',
            tone: 'amber',
          },
          {
            title: '第四步：回到整体走向',
            body: '先把骨架搭起来，后续关键节点和局部方向只是往骨架上补精细信息。',
            formula: '\\text{先骨架，后关键点，最后补局部方向}',
            tone: 'violet',
          },
        ]
      : stepId === 'step-09'
        ? STEP09_REVEALS
        : STEP11_REVEALS;

  return (
    <div className="mt-4 grid gap-3">
      <ProgressiveRevealChain items={revealItems} revealProgress={revealProgress} allowInlineReveal={allowInlineReveal} />
      {stepId === 'step-09' ? (
        <div className="premium-lesson-tone-block premium-tone-amber text-sm">
          先用 dK/ds 找实轴关键点，再用劳斯判据找稳定边界，两条链不要混写。
        </div>
      ) : null}
      {stepId === 'step-11' ? (
        <div className="premium-lesson-tone-block premium-tone-emerald text-sm">
          先算上半平面复极点出射角，再用共轭对称得到下半平面结果，最后回到根之和 = -4 做全图复核。
        </div>
      ) : null}
    </div>
  );
}

export function UNIT_3_3KnowledgeMapVisual() {
  return (
    <section className="premium-lesson-panel-soft mb-4 px-4 py-4">
      <div className="premium-lesson-kicker">Module 3 Map</div>
      <h2 className="premium-lesson-title mt-2 text-xl font-semibold">从稳定边界走向迁移机制，再走向读图窗口</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          { label: '3-2', title: '稳定边界', body: '先回答“稳定边界在哪里”。', active: false },
          { label: '3-3', title: '迁移机制', body: '再回答“极点怎样走向边界”。', active: true },
          { label: '3-4', title: '读图窗口', body: '最后把图读回对象与参数窗口。', active: false },
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

export function UNIT_3_3StepContentPanel({
  step,
  mediaSrc,
  mediaAlt,
  revealProgress,
  allowInlineReveal,
  onWorkspaceParameterChange,
}: {
  step: UNIT_3_3StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  revealProgress: number;
  allowInlineReveal: boolean;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const blueprint = getStepBlueprint(step);

  return (
    <section className="premium-lesson-panel px-4 py-5">
      <div className="premium-lesson-kicker">{blueprint.kicker} · {UNIT_3_3_STAGE_LABEL[step.stage]}</div>
      <h2 className="premium-lesson-title mt-2 text-2xl font-semibold">{step.title}</h2>
      <p className="premium-lesson-muted mt-3 text-sm sm:text-base">{blueprint.intro}</p>
      {step.id === 'step-05' ? <ConditionWorkspacePanel onWorkspaceParameterChange={onWorkspaceParameterChange} /> : null}
      {step.id === 'step-06' ? <SkeletonRuleWorkspace onWorkspaceParameterChange={onWorkspaceParameterChange} /> : null}
      {step.id === 'step-08' ? <KeypointMethodBoard /> : null}
      {step.id !== 'step-05' && step.id !== 'step-06' && step.id !== 'step-08' ? renderMedia(step, mediaSrc, mediaAlt) : null}
      {step.id === 'step-07' || step.id === 'step-09' || step.id === 'step-11' ? (
        <WorkedExampleRevealBoard
          stepId={step.id as 'step-07' | 'step-09' | 'step-11'}
          revealProgress={revealProgress}
          allowInlineReveal={allowInlineReveal}
        />
      ) : null}
      <div className="mt-4 grid gap-4">
        {blueprint.sections.map((section) => (
          <div key={section.title} className={`premium-lesson-tone-block ${toneClass(section.tone)}`}>
            <div className="font-medium">{section.title}</div>
            {section.body ? <div className="mt-2 text-sm leading-7">{section.body}</div> : null}
            {section.formula ? <div className="mt-3 rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0"><BlockMath math={section.formula} /></div> : null}
            {section.bullets?.length ? <ul className="mt-3 grid gap-2 text-sm leading-7">{section.bullets.map((item) => <li key={item} className="ml-4 list-disc">{item}</li>)}</ul> : null}
          </div>
        ))}
      </div>
      {blueprint.note ? <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">{blueprint.note}</div> : null}
    </section>
  );
}

function getActivitySpec(step: UNIT_3_3StepDefinition): ActivitySpec {
  switch (step.pageType) {
    case 'binary_choice':
      return {
        kind: 'binary_choice',
        helper: '判断只知道稳定区间是否足以解释整条迁移路径。',
        options: [{ value: 'A', label: '已经足够' }, { value: 'B', label: '仍需整条迁移路径' }],
        correct: 'B',
      };
    case 'worked_example_workspace':
      return { kind: 'worked_example', helper: '题面常显，双栏作答。', cards: step.id === 'step-07' ? STEP07_CARDS : STEP09_CARDS };
    case 'activity_cards':
      return { kind: 'activity_cards', helper: '局部出射角与整图守恒两张作答卡双栏并排。', cards: STEP11_CARDS };
    case 'sequence_sort':
      return { kind: 'sequence_sort', helper: '按七步读图法重排顺序。' };
    case 'classification_cards':
      return { kind: 'classification_cards', helper: '把趋势判断归到对应的开环极点类型。' };
    case 'quiz_group':
      return { kind: 'quiz_group', helper: '完成后测题组。', questions: POSTTEST_QUESTIONS };
    default:
      return { kind: 'none', helper: '本页无独立学生作答表单。' };
  }
}

function getRevealContent(step: UNIT_3_3StepDefinition) {
  switch (step.id) {
    case 'step-02': return '正确项：仍需整条迁移路径。边界判断不能替代迁移机制。';
    case 'step-07': return '例题 1 参考：实轴区段为 (-∞,-4) 与 (-2,0)，渐近线重心在 -2，角度为 60°、180°、300°。';
    case 'step-09': return '例题 2 参考：分离点需要先由 dK/ds 找候选点，再筛选区段与 K>0；K=6 对应 s=±j√2。';
    case 'step-11': return '例题 3 参考：先求复极点出射角，再用根之和检查另一实根位置与整图走向。';
    case 'step-12': return '正确顺序：极点零点 -> 实轴区段 -> 渐近线 -> 实轴关键点 -> 虚轴交点 -> 局部方向 -> 全图复核。';
    case 'step-13': return '分类参考：原点极点看低频拖尾，实轴极点看区段与关键点，共轭复极点看局部方向与振荡趋势。';
    case 'step-14': return '后测回看：条件顺序、法则职责、例题分工与读图顺序必须同时成链。';
    default: return null;
  }
}

function renderFieldValue(step: UNIT_3_3StepDefinition, value: string) {
  if (step.pageType === 'classification_cards') {
    return CLASSIFICATION_OPTIONS.find((option) => option.value === value)?.label ?? value;
  }
  if (step.pageType === 'binary_choice') {
    return value === 'B' ? '仍需整条迁移路径' : '已经足够';
  }
  return value;
}

export function UNIT_3_3StudentActivityForm({
  step,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
  readOnly = false,
}: {
  step: UNIT_3_3StepDefinition;
  savedResponse?: UNIT_3_3StepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: UNIT_3_3StepResponse) => void;
  readOnly?: boolean;
}) {
  const commitStudentResponse: typeof onSubmit = (response) => {
    if (readOnly) return;
    onSubmit(response);
  };

  const activity = useMemo(() => getActivitySpec(step), [step]);
  const [draft, setDraft] = useState<Record<string, string>>(savedResponse?.answers ?? {});
  const [sequence, setSequence] = useState(WORKFLOW_SEQUENCE.map((item) => item.id));

  useEffect(() => {
    setDraft(savedResponse?.answers ?? {});
    setSequence(savedResponse?.answers.order ? savedResponse.answers.order.split('||') : WORKFLOW_SEQUENCE.map((item) => item.id));
  }, [savedResponse]);

  const submitted = Boolean(savedResponse);
  const locked = !released && activity.kind !== 'none';
  const submit = (answers: Record<string, string>) => commitStudentResponse({ stepId: step.id, submittedAt: Date.now(), answers });
  const browseHint =
    step.id === 'step-07' || step.id === 'step-09' || step.id === 'step-11'
      ? browseEnabled || revealProgress > 0
        ? '当前显影链已开放浏览，学生可按最下方已显影步骤继续展开。'
        : '教师尚未开放浏览，当前仅显示教师已放出的显影层。'
      : activity.helper;

  if (activity.kind === 'none') return null;

  let body: ReactElement | null = null;
  if (activity.kind === 'binary_choice') {
    body = (
      <div className="grid gap-4">
        <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
          <div className="premium-lesson-title text-sm font-medium">你的判断</div>
          <div className="mt-3"><ChoiceGroup disabled={Boolean(readOnly)} options={activity.options} value={draft.choice ?? ''} onChange={(value) => setDraft((prev) => ({ ...prev, choice: value }))} /></div>
        </div>
        <button type="button" disabled={Boolean(readOnly)} onClick={() => submit({ choice: draft.choice ?? '' })} className="premium-lesson-action-primary">{submitted ? '重新提交判断' : '提交判断'}</button>
      </div>
    );
  } else if (activity.kind === 'worked_example' || activity.kind === 'activity_cards') {
    body = (
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          {activity.cards.map((card) => (
            <div key={card.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">{card.title}</div>
              <div className="premium-lesson-muted mt-2 text-sm">{card.prompt}</div>
              <div className="mt-3"><TextInput disabled={Boolean(readOnly)} value={draft[card.key] ?? ''} onChange={(value) => setDraft((prev) => ({ ...prev, [card.key]: value }))} placeholder={card.placeholder} /></div>
            </div>
          ))}
        </div>
        <button type="button" disabled={Boolean(readOnly)} onClick={() => submit(draft)} className="premium-lesson-action-primary">{submitted ? '重新提交作答卡' : '提交作答卡'}</button>
      </div>
    );
  } else if (activity.kind === 'sequence_sort') {
    body = (
      <div className="grid gap-4">
        <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
          <div className="premium-lesson-title text-sm font-medium">按读图顺序重排步骤</div>
          <div className="mt-3 grid gap-3">
            {sequence.map((id, index) => {
              const item = WORKFLOW_SEQUENCE.find((entry) => entry.id === id);
              if (!item) return null;
              return (
                <div key={id} className="rounded-2xl border border-border/60 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div><div className="font-medium">{index + 1}. {item.label}</div><div className="premium-lesson-muted mt-1 text-sm">{item.explanation}</div></div>
                    <div className="flex gap-2">
                      <button type="button" disabled={Boolean(readOnly) || index === 0} onClick={() => { if (readOnly) return; setSequence((prev) => { const next = [...prev]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; }); }} className="premium-lesson-control disabled:opacity-40"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" disabled={Boolean(readOnly) || index === sequence.length - 1} onClick={() => { if (readOnly) return; setSequence((prev) => { const next = [...prev]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; }); }} className="premium-lesson-control disabled:opacity-40"><ArrowDown className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <button type="button" disabled={Boolean(readOnly)} onClick={() => submit({ order: sequence.join('||') })} className="premium-lesson-action-primary">{submitted ? '重新提交排序' : '提交排序'}</button>
      </div>
    );
  } else if (activity.kind === 'classification_cards') {
    body = (
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CLASSIFICATION_CARDS.map((card) => (
            <div key={card.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">{card.prompt}</div>
              <div className="mt-3"><ChoiceGroup disabled={Boolean(readOnly)} options={CLASSIFICATION_OPTIONS} value={draft[card.key] ?? ''} onChange={(value) => setDraft((prev) => ({ ...prev, [card.key]: value }))} /></div>
            </div>
          ))}
        </div>
        <button type="button" disabled={Boolean(readOnly)} onClick={() => submit(draft)} className="premium-lesson-action-primary">{submitted ? '重新提交分类' : '提交分类'}</button>
      </div>
    );
  } else if (activity.kind === 'quiz_group') {
    body = (
      <div className="grid gap-4">
        {activity.questions.map((question) => (
          <div key={question.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
            <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
            <div className="mt-3">
              {question.type === 'text' ? (
                <TextInput disabled={Boolean(readOnly)} value={draft[question.key] ?? ''} onChange={(value) => setDraft((prev) => ({ ...prev, [question.key]: value }))} placeholder="请用 1-2 句话作答。" />
              ) : (
                <ChoiceGroup disabled={Boolean(readOnly)} options={question.options ?? []} value={draft[question.key] ?? ''} onChange={(value) => setDraft((prev) => ({ ...prev, [question.key]: value }))} />
              )}
            </div>
          </div>
        ))}
        <button type="button" disabled={Boolean(readOnly)} onClick={() => submit(draft)} className="premium-lesson-action-primary">{submitted ? '重新提交后测' : '提交后测'}</button>
      </div>
    );
  }

  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">学生作答区</div>
      <p className="premium-lesson-muted mt-2 text-sm">{locked ? '教师尚未释放本页互动，请先阅读上方静态内容。' : browseHint}</p>
      {locked ? <div className="premium-lesson-tone-block premium-tone-amber mt-4 text-sm">当前互动尚未释放。</div> : <div className="mt-4">{body}</div>}
      <SubmissionStatus submitted={submitted}
          idleText={readOnly ? '演示模式仅本机预览，不会同步到教师端汇总。' : undefined} />
      {answerVisible && getRevealContent(step) ? <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm leading-7">{getRevealContent(step)}</div> : null}
    </section>
  );
}

function summarizeResponses(step: UNIT_3_3StepDefinition, responses: UNIT_3_3TeacherResponseItem[]) {
  const counts = new Map<string, number>();
  for (const item of responses) {
    if (step.pageType === 'binary_choice') {
      const value = renderFieldValue(step, item.response.answers.choice ?? '');
      counts.set(value, (counts.get(value) ?? 0) + 1);
    } else {
      counts.set('已提交', responses.length);
    }
  }
  return Array.from(counts.entries());
}

function supportsAnswerReveal(step: UNIT_3_3StepDefinition) {
  return ['binary_choice', 'worked_example_workspace', 'activity_cards', 'sequence_sort', 'classification_cards', 'quiz_group'].includes(step.pageType);
}

function getTeacherReferenceItems(step: UNIT_3_3StepDefinition) {
  switch (step.pageType) {
    case 'binary_choice': return [{ label: '正确项', value: 'B. 仍需整条迁移路径' }];
    case 'worked_example_workspace': return (step.id === 'step-07' ? STEP07_CARDS : STEP09_CARDS).map((card) => ({ label: card.title, value: card.reference }));
    case 'activity_cards': return STEP11_CARDS.map((card) => ({ label: card.title, value: card.reference }));
    case 'sequence_sort': return WORKFLOW_SEQUENCE.map((item, index) => ({ label: `顺序 ${index + 1}`, value: item.label }));
    case 'classification_cards': return CLASSIFICATION_CARDS.map((card) => ({ label: card.prompt, value: CLASSIFICATION_OPTIONS.find((option) => option.value === card.answer)?.label ?? card.answer }));
    case 'quiz_group': return POSTTEST_QUESTIONS.map((question) => ({ label: question.prompt, value: question.type === 'text' ? question.explanation : question.options?.find((option) => option.value === question.answer)?.label ?? '' }));
    default: return [];
  }
}

export function UNIT_3_3TeacherActivitySummary({
  step,
  responses,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onToggleRelease,
  onToggleBrowse,
  onToggleAnswerVisible,
  onAdvanceReveal,
  onResetReveal,
}: {
  step: UNIT_3_3StepDefinition;
  responses: UNIT_3_3TeacherResponseItem[];
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onToggleRelease: () => void;
  onToggleBrowse: () => void;
  onToggleAnswerVisible: () => void;
  onAdvanceReveal: () => void;
  onResetReveal: () => void;
}) {
  const summary = useMemo(() => summarizeResponses(step, responses), [responses, step]);
  const referenceItems = getTeacherReferenceItems(step);
  const supportsProgressiveReveal = step.id === 'step-07' || step.id === 'step-09' || step.id === 'step-11';
  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="premium-lesson-title text-sm font-medium">教师汇总</div><div className="premium-lesson-muted mt-1 text-sm">当前收到 {responses.length} 份本页作答。</div></div>
        {supportsAnswerReveal(step) ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onToggleRelease} className="premium-lesson-action-secondary">{released ? '撤回互动' : '释放互动'}</button>
            <button type="button" onClick={onToggleBrowse} className="premium-lesson-action-secondary">{browseEnabled ? '关闭浏览' : '开放浏览'}</button>
            <button type="button" onClick={onToggleAnswerVisible} className="premium-lesson-action-primary">{answerVisible ? '隐藏参考答案' : '显示参考答案'}</button>
            {supportsProgressiveReveal ? (
              <>
                <button type="button" onClick={onAdvanceReveal} className="premium-lesson-action-secondary">教师逐步显影 +1</button>
                <button type="button" onClick={onResetReveal} className="premium-lesson-action-secondary">重置显影</button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {supportsProgressiveReveal ? <div className="premium-lesson-muted mt-3 text-sm">当前显影层级：{revealProgress}</div> : null}
      {summary.length ? <div className="mt-4 grid gap-2">{summary.map(([label, count]) => <div key={label} className="premium-lesson-surface-elevated flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm"><span>{label}</span><span className="premium-lesson-caption">{count} 人</span></div>)}</div> : <div className="premium-lesson-muted mt-4 text-sm">本页暂无学生提交。</div>}
      {referenceItems.length ? <div className="mt-4 grid gap-3 text-sm">{referenceItems.map((item) => <div key={item.label} className="premium-lesson-surface-elevated rounded-2xl px-3 py-3"><div className="font-medium">{item.label}</div><div className="premium-lesson-muted mt-1">{item.value}</div></div>)}</div> : null}
    </section>
  );
}

export function UNIT_3_3StudentSummaryPanel({ responses }: { responses: Record<string, UNIT_3_3StepResponse> }) {
  const finishedSteps = UNIT_3_3_LESSON_STEPS.filter((step) => responses[step.id]);
  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">本课学习小结</div>
      <div className="premium-lesson-muted mt-2 text-sm">你已完成 {finishedSteps.length} / {UNIT_3_3_LESSON_STEPS.length} 个互动环节。</div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {['根轨迹定义', '骨架法则', '关键节点', '读图顺序'].map((keyword) => (
          <div key={keyword} className="premium-lesson-surface-elevated px-4 py-3 text-sm">
            <div className="font-medium">{keyword}</div>
            <div className="premium-lesson-muted mt-1">这是 3-3 需要带走的判断锚点。</div>
          </div>
        ))}
      </div>
      <div className="premium-lesson-tone-block premium-tone-emerald mt-4 text-sm">
        你已经把“定义、条件、骨架、关键节点、读图顺序”这条链条搭起来了。下一课将进入读图窗口与对象化判断。
      </div>
    </section>
  );
}
