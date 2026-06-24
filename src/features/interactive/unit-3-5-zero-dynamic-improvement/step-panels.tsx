'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BlockMath } from 'react-katex';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';

import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import {
  UNIT_3_5_LESSON_STEPS,
  UNIT_3_5_STAGE_LABEL,
  type UNIT_3_5StepDefinition,
  type UNIT_3_5StepResponse,
} from '@/lib/unit-3-5-course';
import { UNIT_3_5InlineRichText } from './rich-text';
import { UNIT_3_5RootLocusWorkspace } from './root-locus-workspace';
import {
  BAND_LABEL_OPTIONS,
  BRANCH_REGION_OPTIONS,
  COMPARE_NOTE_KEYWORDS,
  DERIVATION_FIELDS,
  IMPROVED_METRIC_OPTIONS,
  PHASE_PEAK_OPTIONS,
  POST_QUIZ_QUESTIONS,
  PRETEST_QUESTIONS,
  RISK_TAG_OPTIONS,
  RULE_CHECK_OPTIONS,
  SCENARIO_CARDS,
  SCENARIO_SORT_COLUMNS,
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

const MARKDOWN_COMPONENTS = {
  p: ({ children }: { children?: ReactNode }) => <p className="mt-2 text-sm leading-7">{children}</p>,
  ul: ({ children }: { children?: ReactNode }) => <ul className="mt-3 grid gap-2 text-sm leading-7">{children}</ul>,
  li: ({ children }: { children?: ReactNode }) => <li className="ml-4 list-disc">{children}</li>,
  table: ({ children }: { children?: ReactNode }) => (
    <div className="mt-3 overflow-x-auto rounded-2xl border border-border/60 bg-background/55">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: ReactNode }) => <thead className="bg-background/70">{children}</thead>,
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border-b border-border/60 px-3 py-2 font-medium text-foreground/85">{children}</th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border-b border-border/40 px-3 py-2 align-top text-foreground/85">{children}</td>
  ),
  code: ({ children }: { children?: ReactNode }) => (
    <code className="rounded bg-background/80 px-1.5 py-0.5 text-[0.9em]">{children}</code>
  ),
};

export interface UNIT_3_5TeacherResponseItem {
  studentName: string;
  response: UNIT_3_5StepResponse;
}

function getToneClass(tone: Tone = 'slate') {
  return `premium-tone-${tone}`;
}

function renderMarkdown(markdown: string) {
  return (
    <ReactMarkdown
      components={MARKDOWN_COMPONENTS}
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
    >
      {markdown}
    </ReactMarkdown>
  );
}

interface ProgressiveFormulaItem {
  title: string;
  math: string;
}

function ProgressiveFormulaStack({
  items,
}: {
  items: ProgressiveFormulaItem[];
}) {
  const [revealedCount, setRevealedCount] = useState(1);
  const visibleItems = items.slice(0, revealedCount);

  return (
    <div className="mt-3 grid gap-3">
      {visibleItems.map((item, index) => {
        const isBottomCard = index === visibleItems.length - 1;
        const canRevealNext = isBottomCard && revealedCount < items.length;

        if (canRevealNext) {
          return (
            <button
              key={item.title}
              type="button"
              onClick={() => setRevealedCount((current) => Math.min(items.length, current + 1))}
              className="rounded-2xl border border-cyan-300/40 bg-background/70 px-3 py-3 text-left text-sm transition hover:border-cyan-300/70"
            >
              <div className="mb-2 text-sm font-medium">{item.title}</div>
              <div className="[&_.katex-display]:m-0">
                <BlockMath math={item.math} />
              </div>
              <div className="mt-3 text-xs text-cyan-200">点击本卡揭示下一层</div>
            </button>
          );
        }

        return (
          <div key={item.title} className="rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
            <div className="mb-2 text-sm font-medium">{item.title}</div>
            <BlockMath math={item.math} />
          </div>
        );
      })}
    </div>
  );
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
            body: '必须先完成三题和一句直觉，再允许使用控灵助手中的快捷提问。AI 在这里只做错因对照，不代替独立判断。',
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
            title: '为什么要另看边界',
            tone: 'amber',
            body: '因为右半平面零点会把“零点改善动态”变成带条件的结论，真正需要追问的是逆响应、额外相位滞后与带宽边界。',
          },
        ],
      };
    case 'step-07':
      return {
        kicker: 'Structure',
        intro: 'PD 与测速反馈都能增大阻尼，但结构图不能混着认。测速反馈保留外环单位负反馈，同时在对象输入前叠加速度项反馈；它不显式增加前向零点。',
        sections: [
          {
            title: '本页要回答的问题',
            tone: 'cyan',
            body: '先把结构图、被控对象和两条等效特征方程对上，再回答：测速反馈是否在前向通道显式增加零点？',
          },
        ],
      };
    case 'step-08':
      return {
        kicker: 'Formula',
        intro: '这一页必须把“公式看懂”推进到“会反求参数”。本例目标阻尼给定为 0.5，最终应推出 Kd = Kt = 0.3。',
        sections: [
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
            bullets: ['共同点：都让系统先变得更不爱振荡。', '提高阻尼不等于结构相同。', '不同点：PD 显式增加前向零点；测速反馈不显式增加前向零点。', '三域图不能退化成单域标签页。'],
          },
        ],
      };
    case 'step-10':
      return {
        kicker: 'PD Frequency',
        intro: 'PD 单独装置的关键不是“更强”，而是它会持续抬升中高频，从而推动交叉频率右移，同时带来高频代价。',
        sections: [
          {
            title: '阅读顺序',
            tone: 'amber',
            bullets: ['先沿用上一步对象。', '再写理想 PD 控制器。', '随后按频率特性、幅频特性、相频特性的顺序阅读。', '最后再回到高频代价。'],
          },
        ],
      };
    case 'step-11':
      return {
        kicker: 'Lead Frequency',
        intro: '超前装置更像在关键频带制造相位峰，它不是持续抬高整个中高频，而是把补相角集中在需要的位置。',
        sections: [
          {
            title: '阅读顺序',
            tone: 'cyan',
            body: '先认超前网络标准形式，再分别读幅频特性、相频特性、最大超前角出现频率和最大超前角。',
          },
        ],
      };
    case 'step-12':
      return {
        kicker: 'Design Rules',
        intro: '这一页只做初步判断：什么时候优先想 PD，什么时候优先想超前，什么时候需要先承认还得继续判边界。',
        sections: [
          {
            title: '设计原则',
            tone: 'emerald',
            bullets: ['PD 先看是否需要抬交叉、提响应积极性。', '超前先看是否需要在截止频率附近补相角、守住稳定裕度。', '二者都不直接等于完整整定答案。'],
          },
        ],
      };
    case 'step-13':
      return {
        kicker: 'NMP Entrance',
        intro: '非最小相入口的重点是把镜像零点、逆响应和“先反向动”放在一起看，确认问题不只是名字变化。',
        sections: [
          {
            title: '阅读顺序',
            tone: 'rose',
            bullets: ['先认最小相与非最小相开环对象。', '再看对照图中的逆响应与额外相位滞后。', '最后再回到 5.4 保守带宽实例表。'],
          },
        ],
      };
    case 'step-14':
      return {
        kicker: 'Bandwidth Boundary',
        intro: '右半平面零点真正危险的地方，在于它会把“想更快”变成更早撞上稳定边界的风险，所以动作通常是先保守带宽。',
        sections: [
          {
            title: '频域后果卡',
            tone: 'amber',
            bullets: ['右半平面零点带来额外相位滞后。', '过度提高带宽会更早逼近稳定边界。', '保守动作是先守交叉频率与相角裕度。'],
          },
        ],
        note: '为什么非最小相对象往往要先保守带宽：因为右半平面零点会带来逆响应与额外相位滞后。',
      };
    case 'step-15':
      return {
        kicker: 'Post-check',
        intro: '最后一页把后测、四个观察量、风险边界和 3-6 入口收拢成一张判断地图，准备带进下一课的统一对象实验。',
        sections: [
          {
            title: '收束提醒',
            tone: 'violet',
            body: '四个观察量会以紧凑卡片形式回收，最后一起指向 3-6 的统一对象实验。',
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
      return '参考口径：PD 的频域本质是抬升中高频幅值、推动截止频率右移，代价是高频噪声与控制动作放大。';
    case 'step-11':
      return '参考口径：超前更像在关键频带补相角，核心改善的是相角裕度。';
    case 'step-12':
      return '参考口径：PD 主打抬交叉，超前主打补相角；遇到边界约束时要先承认还需继续判断。';
    case 'step-13':
      return '参考解释：右半平面零点会带来逆响应与额外相位滞后，因此“先反向动”不是偶然现象。';
    case 'step-14':
      return '参考口径：右半平面零点会带来额外相位滞后，保守动作通常是先守交叉频率与相角裕度。';
    case 'step-15':
      return '参考口径：本课最后要带走四个观察量与风险边界，并把它们转成 3-6 的统一对象实验入口。';
    default:
      return null;
  }
}

function supportsAnswerReveal(step: UNIT_3_5StepDefinition) {
  return !['display', 'risk_prediction_submit'].includes(step.pageType);
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
      <textarea aria-label={placeholder ?? '零点动态改善学习记录'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="premium-lesson-input min-h-[120px] w-full"
      />
    );
  }

  return (
    <input aria-label={placeholder ?? '零点动态改善输入'}
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

function renderStepSupplement(
  step: UNIT_3_5StepDefinition,
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void,
  mediaSrc?: string | null,
) {
  switch (step.id) {
    case 'step-04':
      return (
        <div className="mt-4 grid gap-4">
          <div className="premium-lesson-tone-block premium-tone-violet">
            <div className="font-medium">对象式先落页，再看分支被拉走</div>
            <div className="mt-2 text-sm leading-7">本页把两个旧示例合并为一个“添加零点”模式。先切换基线，再进入添加零点，沿实轴拖动零点标注，观察被拉走的分支与实轴区段如何一起重排。</div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
                <div className="mb-2 text-sm font-medium">基线对象</div>
                <BlockMath math={'L_0(s)=\\frac{K}{s(s+1)}'} />
              </div>
              <div className="rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
                <div className="mb-2 text-sm font-medium">添加零点后的开环对象</div>
                <BlockMath math={'L_z(s)=\\frac{K(s+z)}{s(s+1)},\\quad z>0'} />
              </div>
            </div>
          </div>
          <UNIT_3_5RootLocusWorkspace stepId="step-04" onWorkspaceParameterChange={onWorkspaceParameterChange} />
        </div>
      );
    case 'step-05':
      return (
        <div className="mt-4 grid gap-4">
          <div className="premium-lesson-tone-block premium-tone-violet">
            <div className="font-medium">三阶对象必须先把讲义公式和零点位置说清</div>
            <div className="mt-2 text-sm leading-7">本页同样只保留“基线”和“添加零点”两个模式。你需要在同一组极点下拖动零点位置，比较主导分支在哪一段被改写得更明显。</div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
                <div className="mb-2 text-sm font-medium">基线对象</div>
                <BlockMath math={'L_3(s)=\\frac{K}{s(s+1)(s+4)}'} />
              </div>
              <div className="rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
                <div className="mb-2 text-sm font-medium">添加零点后的开环对象</div>
                <BlockMath math={'L_z(s)=\\frac{K(s+z)}{s(s+1)(s+4)},\\quad z>0'} />
              </div>
            </div>
          </div>
          <UNIT_3_5RootLocusWorkspace stepId="step-05" onWorkspaceParameterChange={onWorkspaceParameterChange} />
        </div>
      );
    case 'step-07':
      return (
        <div className="mt-4 grid gap-4">
          <div className="premium-lesson-tone-block premium-tone-violet">
            <div className="font-medium">先把结构图和公式一一对上，再进入判断</div>
            <div className="mt-3 grid gap-3">
              <div className="rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
                <div className="mb-2 text-sm font-medium">被控对象</div>
                <BlockMath math={'G_p(s)=\\frac{4}{s(s+0.8)}'} />
              </div>
              <div className="rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
                <div className="mb-2 text-sm font-medium">相应的闭环传递函数</div>
                <BlockMath math={'T_0(s)=\\frac{4}{s^2+0.8s+4}'} />
              </div>
              <div className="rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
                <div className="mb-2 text-sm font-medium">PD 等效特征方程</div>
                <BlockMath math={'s^2+\\left(2\\zeta\\omega_n+K_d\\omega_n^2\\right)s+\\omega_n^2=0'} />
              </div>
              <div className="rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
                <div className="mb-2 text-sm font-medium">测速反馈等效特征方程</div>
                <BlockMath math={'s^2+\\left(2\\zeta\\omega_n+K_t\\omega_n^2\\right)s+\\omega_n^2=0'} />
              </div>
            </div>
            <div className="mt-3 rounded-2xl border border-border/50 bg-background/65 px-3 py-3 text-sm leading-7">
              问题：测速反馈是否在前向通道显式增加零点？
            </div>
          </div>
        </div>
      );
    case 'step-08':
      return (
        <div className="mt-4 grid gap-4">
          <div className="premium-lesson-tone-block premium-tone-violet">
            <div className="font-medium">等效阻尼推导链</div>
            <div className="mt-3 grid gap-3">
              <div className="rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
                <BlockMath math={'\\zeta_{PD}=\\zeta+\\frac{1}{2}K_d\\omega_n,\\qquad \\zeta_v=\\zeta+\\frac{1}{2}K_t\\omega_n'} />
              </div>
              <div className="rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
                <BlockMath math={'K_d=K_t=\\frac{2(\\zeta^\\star-\\zeta)}{\\omega_n}'} />
              </div>
            </div>
            <div className="mt-3">
              {renderMarkdown(
                [
                  '1. 把闭环特征方程改写成标准二阶形式 $s^2+2\\zeta_{\\mathrm{eq}}\\omega_n s+\\omega_n^2=0$。',
                  '2. 对 `PD` 结构，有 $2\\zeta_{\\mathrm{eq}}\\omega_n=2\\zeta\\omega_n+K_d\\omega_n^2$，因此 $\\zeta_{PD}=\\zeta+\\frac{1}{2}K_d\\omega_n$。',
                  '3. 对测速反馈，有 $2\\zeta_{\\mathrm{eq}}\\omega_n=2\\zeta\\omega_n+K_t\\omega_n^2$，因此 $\\zeta_v=\\zeta+\\frac{1}{2}K_t\\omega_n$。',
                  '4. 本例取 $\\omega_n=2$、$\\zeta=0.2$、$\\zeta^\\star=0.5$，即可得到 $K_d=K_t=0.3$。',
                ].join('\n'),
              )}
            </div>
          </div>
        </div>
      );
    case 'step-09':
      return (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.12fr)_minmax(280px,0.88fr)]">
          <div className="premium-lesson-tone-block premium-tone-violet">
            <div className="font-medium">闭环传函对照</div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
                <BlockMath math={'T_{PD}(s)=\\frac{4(1+0.3s)}{s^2+2s+4}'} />
              </div>
              <div className="rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
                <BlockMath math={'T_v(s)=\\frac{4}{s^2+2s+4}'} />
              </div>
            </div>
            <div className="mt-3">
              {renderMarkdown(
                '| 结构 | 超调量 | 2% 调节时间 | 解读 |\n| --- | --- | --- | --- |\n| 校正前 | 约 `52.3%` | 约 `9.92 s` | 典型欠阻尼且拖尾明显 |\n| `PD` 后 | 约 `20.5%` | 约 `3.82 s` | 阻尼显著改善，但输入通道零点让前段抬升更积极 |\n| 测速反馈后 | 约 `16.3%` | 约 `4.04 s` | 阻尼改善接近 `PD`，但因为没有显式前向零点，超调更克制 |',
              )}
            </div>
          </div>
          <div className="grid gap-4">
            <div className="premium-lesson-tone-block premium-tone-emerald">
              <div className="font-medium">三域指标速记</div>
              <div className="mt-3">
                {renderMarkdown(
                  '| 结构 | 共振峰值 | 带宽 |\n| --- | --- | --- |\n| 校正前 | 约 `8.14 dB` | 约 `3.04 rad/s` |\n| `PD` 后 | 约 `2.04 dB` | 约 `2.97 rad/s` |\n| 测速反馈后 | 约 `1.25 dB` | 约 `2.56 rad/s` |',
                )}
              </div>
            </div>
            <div className="premium-lesson-tone-block premium-tone-cyan">
              <div className="font-medium">课堂判断锚点</div>
              <ul className="mt-3 grid gap-2 text-sm leading-7">
                <li className="ml-4 list-disc">共同点：两种结构都先把系统从明显欠阻尼拉回更可控区间。</li>
                <li className="ml-4 list-disc">根轨迹与时域的差异，要追溯到前向零点是否显式出现。</li>
                <li className="ml-4 list-disc">频域代价不同，决定了“同样提阻尼”并不等于“结构相同”。</li>
              </ul>
            </div>
          </div>
        </div>
      );
    case 'step-10':
      return (
        <div className="mt-4 grid gap-4">
          <div className="premium-lesson-tone-block premium-tone-violet">
            <div className="font-medium">4.1 先沿用上一步对象，再按讲义顺序展开 PD 的频域证据</div>
            <ProgressiveFormulaStack
              items={[
                { title: '沿用上一步对象', math: 'G_p(s)=\\frac{4}{s(s+0.8)}' },
                { title: '理想 PD 控制器', math: 'G_{PD}(s)=1+T_d s' },
                { title: '频率特性', math: 'G_{PD}(j\\omega)=1+j\\omega T_d' },
                { title: '幅频特性', math: '\\left|G_{PD}(j\\omega)\\right|=\\sqrt{1+(\\omega T_d)^2}' },
                { title: '相频特性', math: '\\phi_{PD}(\\omega)=\\arctan(\\omega T_d)' },
              ]}
            />
            <div className="mt-3 rounded-2xl border border-border/50 bg-background/65 px-3 py-3 text-sm leading-7">
              {renderMarkdown(
                [
                  '- 在低频段，$|G_{PD}(j\\omega)| \\approx 1$，几乎不动直流和低频增益。',
                  '- 当频率越过拐点 $\\omega_d=1/T_d$ 后，幅值按 `+20 dB/dec` 持续抬升。',
                  '- `PD` 先把中高频幅值往上托，交叉频率才有机会右移；交叉频率右移后，系统才表现为“更快”。',
                  '- 高频代价是噪声、测量抖动和控制动作一起被放大。',
                ].join('\n'),
              )}
            </div>
          </div>
        </div>
      );
    case 'step-11':
      return (
        <div className="mt-4 grid gap-4">
          <div className="premium-lesson-tone-block premium-tone-cyan">
            <div className="font-medium">先认超前网络标准形式，再给每条公式一个明确名称</div>
            <ProgressiveFormulaStack
              items={[
                { title: '超前网络标准形式', math: 'G_{\\text{lead}}(s)=\\frac{Ts+1}{\\alpha Ts+1},\\qquad 0<\\alpha<1' },
                { title: '幅频特性', math: '\\left|G_{\\text{lead}}(j\\omega)\\right|=\\sqrt{\\frac{1+(\\omega T)^2}{1+(\\alpha \\omega T)^2}}' },
                { title: '相频特性', math: '\\phi_{\\text{lead}}(\\omega)=\\arctan(\\omega T)-\\arctan(\\alpha \\omega T)' },
                { title: '最大超前角出现频率', math: '\\omega_m=\\frac{1}{T\\sqrt{\\alpha}}' },
                { title: '最大超前角', math: '\\phi_m=\\sin^{-1}\\left(\\frac{1-\\alpha}{1+\\alpha}\\right)' },
              ]}
            />
            <div className="mt-3 rounded-2xl border border-border/50 bg-background/65 px-3 py-3 text-sm leading-7">
              {renderMarkdown(
                [
                  '- 零点先提供提前相位，极点再把提前相位收住，所以相位提升只集中在中间一段关键频带。',
                  '- 相位峰最有价值的位置通常就在截止频率附近，因为这里直接决定相角裕度还能不能守住。',
                  '- 当 $\\omega < \\omega_z=1/T$ 时，幅值几乎不变。',
                  '- 在 $\\omega_z$ 到 $\\omega_p=1/(\\alpha T)$ 之间，幅值按 `+20 dB/dec` 上升。',
                  '- 超过极点频率后，幅值不再继续无限抬升，而是趋于有限增益 $20\\log_{10}(1/\\alpha)$。',
                  '- 超前不是持续抬整个中高频，而是在关键频带制造相位峰。',
                ].join('\n'),
              )}
            </div>
          </div>
        </div>
      );
    case 'step-12':
      return (
        <div className="mt-4 grid gap-4">
          <div className="premium-lesson-tone-block premium-tone-cyan">
            <div className="font-medium">图 6｜PD 与超前：零点位置可以相同，但频域整形方式不同</div>
            <div className="mt-2 text-sm leading-7">先看频域图，再回头看根轨迹和阶跃响应；对 `PD` 与超前而言，频域整形是起因，根轨迹差异是结果。</div>
          </div>
          <div className="premium-lesson-tone-block premium-tone-violet">
            <div className="font-medium">频域与适用规律表</div>
            <div className="mt-3">
              {renderMarkdown(
                '| 结构 | 交叉频率 | 相角裕度 | 频域解释 |\n| --- | --- | --- | --- |\n| 校正前 | 约 `1.92 rad/s` | 约 `22.6°` | 中频段补角不足，速度和裕度都偏紧 |\n| `PD` 后 | 约 `2.10 rad/s` | 约 `53.1°` | 中高频抬升明显，交叉点右移，速度提高且裕度改善 |\n| 超前后 | 约 `2.09 rad/s` | 约 `45.9°` | 在交叉频率附近主动补角，裕度提高且高频放大更受控 |\n\n| 结构 | 更适合的场景 | 不适合的场景 | 一句话概括 |\n| --- | --- | --- | --- |\n| `PD` | 主要目标是提高响应速度、增大阻尼、提高截止频率；高频噪声约束不太强；对象本身较低阶或主导低阶特征明显 | 测量噪声强、执行机构高频能力有限、不能接受明显高频放大 | “先抬中高频，再把交叉点往右推” |\n| 超前校正 | 主要矛盾是相角裕度不足；希望在截止频率附近主动补角；需要比 `PD` 更可控的高频代价；幅值裕度和整体带宽仍有可调整空间 | 高频放大约束极严、低频精度本身才是主要矛盾、需要同时解决稳态与动态多重冲突 | “在关键频段补相角，不让高频一路抬上去” |\n\n| 结构 | 超调量 | 2% 调节时间 |\n| --- | --- | --- |\n| 校正前 | 约 `52.3%` | 约 `9.92 s` |\n| `PD` 后 | 约 `20.5%` | 约 `3.82 s` |\n| 超前后 | 约 `25.7%` | 约 `3.84 s` |',
              )}
            </div>
          </div>
        </div>
      );
    case 'step-13':
      return (
        <div className="mt-4 grid gap-4">
          <div className="premium-lesson-tone-block premium-tone-violet">
            <div className="font-medium">先把最小相与非最小相的公式放在最上方</div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
                <div className="mb-2 text-sm font-medium">最小相开环对象</div>
                <BlockMath math={'L_{\\text{mp}}(s)=K\\frac{4(s+1)}{s(s+2)(s+5)}'} />
              </div>
              <div className="rounded-2xl bg-background/70 px-3 py-3 text-sm [&_.katex-display]:m-0">
                <div className="mb-2 text-sm font-medium">非最小相开环对象</div>
                <BlockMath math={'L_{\\text{nmp}}(s)=K\\frac{4(1-s)}{s(s+2)(s+5)}'} />
              </div>
            </div>
          </div>
          {mediaSrc ? (
            <figure className="premium-lesson-surface-elevated overflow-hidden px-4 py-4">
              <div className="mb-3 text-sm font-medium">对照图：先比较镜像零点下的响应与频域后果</div>
              <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-border/60 bg-background/60">
                <Image src={mediaSrc} alt={step.title} fill className="object-contain" />
              </div>
            </figure>
          ) : null}
          <div className="premium-lesson-tone-block premium-tone-rose">
            <div className="font-medium">现象与分析</div>
            <ul className="mt-3 grid gap-2 text-sm leading-7">
              <li className="ml-4 list-disc">唯一差别是零点位于左半平面还是右半平面。</li>
              <li className="ml-4 list-disc">非最小相最先暴露的是逆响应与额外相位滞后，不是单纯“更慢”。</li>
              <li className="ml-4 list-disc">因此“先反向动”必须同时回到结构来源和频域代价解释。</li>
            </ul>
          </div>
          <div className="premium-lesson-tone-block premium-tone-violet">
            <div className="font-medium">5.4 保守带宽实例表</div>
            <div className="mt-3">
              {renderMarkdown(
                '| 增益 | 最深逆响应 | 最大峰值 | 解读 |\n| --- | --- | --- | --- |\n| `K=0.6` | 约 `-0.106` | 无明显正向峰值 | 保守，逆响应较轻 |\n| `K=1.0` | 约 `-0.186` | 峰值约 `1.158` | 中等控制，能跟踪但代价已显现 |\n| `K=2.0` | 约 `-0.428` | 峰值约 `2.195` | 过激，逆响应和峰值同时恶化 |',
              )}
            </div>
          </div>
        </div>
      );
    case 'step-15':
      return (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { title: '根轨迹观察量', body: '先看分支是否被零点拉走，以及主导极点候选区是否整体更有利。' },
              { title: '时域观察量', body: '再看调节时间、超调与是否出现前冲或逆向初始动作。' },
              { title: '频域观察量', body: '继续检查相位是更提前还是更滞后，带宽是更容易提高还是更早触顶。' },
              { title: '结构判断观察量', body: '最后回到结构来源，确认差异究竟来自零点位置、结构通道还是边界约束。' },
            ].map((item) => (
              <div key={item.title} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="text-sm font-medium">{item.title}</div>
                <div className="premium-lesson-muted mt-2 text-sm leading-7">{item.body}</div>
              </div>
            ))}
          </div>
          <div className="premium-lesson-tone-block premium-tone-violet">
            <div className="font-medium">下一课去向</div>
            <div className="mt-2 text-sm leading-7">3-6 将在统一对象上把 PD、测速反馈、超前与非最小相边界放入实验链，四个观察量会继续作为统一比较框架保留下来。</div>
          </div>
        </div>
      );
    default:
      return null;
  }
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
  onWorkspaceParameterChange,
}: {
  step: UNIT_3_5StepDefinition;
  mediaSrc?: string | null;
  mediaAlt?: string;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const blueprint = getStepBlueprint(step);
  const shouldRenderMedia = Boolean(mediaSrc) && !['step-04', 'step-05', 'step-13'].includes(step.id);

  return (
    <section className="premium-lesson-panel px-4 py-5">
      <div className="premium-lesson-kicker">
        {blueprint.kicker} · {UNIT_3_5_STAGE_LABEL[step.stage]}
      </div>
      <h2 className="premium-lesson-title mt-2 text-2xl font-semibold">
        <UNIT_3_5InlineRichText text={step.title} />
      </h2>
      <p className="premium-lesson-muted mt-3 text-sm sm:text-base">{blueprint.intro}</p>

      {shouldRenderMedia ? (
        <figure className="premium-lesson-surface-elevated mt-4 overflow-hidden px-4 py-4">
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-border/60 bg-background/60">
            <Image src={mediaSrc!} alt={mediaAlt ?? step.title} fill className="object-contain" />
          </div>
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
      {renderStepSupplement(step, onWorkspaceParameterChange, mediaSrc)}
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
            <div className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
              <div className="premium-lesson-title text-sm font-medium">问题：测速反馈是否在前向通道显式增加零点？</div>
              <div className="premium-lesson-muted mt-2 text-sm">先看上方结构图与公式，再提交“是 / 否”的判断，并补一句结构理由。</div>
            </div>
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
      case 'rule_check':
        return (
          <div className="grid gap-4">
            {[
              {
                key: 'rule-1',
                statement: '右半平面零点会带来额外相位滞后，所以通常先保守交叉频率与相角裕度。',
              },
              {
                key: 'rule-2',
                statement: '非最小相对象要继续把带宽往上推。',
              },
              {
                key: 'rule-3',
                statement: '右半平面零点很危险。',
              },
            ].map((item) => (
              <div key={item.key} className="premium-lesson-surface-elevated rounded-3xl px-4 py-4">
                <div className="premium-lesson-title text-sm font-medium">{item.statement}</div>
                <div className="mt-3">
                  <SelectField
                    value={draft[item.key] ?? ''}
                    onChange={(value) => updateDraft(item.key, value, 'select')}
                    options={RULE_CHECK_OPTIONS}
                  />
                </div>
              </div>
            ))}
            <TextInput
              value={draft.rule_reason ?? ''}
              onChange={(value) => updateDraft('rule_reason', value)}
              placeholder="补一句：为什么右半平面零点会限制带宽"
              multiline
            />
            <button type="button" onClick={() => submit(draft)} className="premium-lesson-action-primary">
              {submitted ? '重新提交规则判断' : '提交规则判断'}
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
