'use client';

import Image from 'next/image';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import {
  getUNIT_4_5PageContract,
  isUNIT_4_5PerCardTextStep,
  type UNIT_4_5StepDefinition,
  type UNIT_4_5StepResponse,
} from '@/lib/unit-4-5-course';

type TeacherResponseItem = { studentName: string; response: UNIT_4_5StepResponse };
type TableCell = string | { kind: 'math'; value: string };
type PromptField = {
  key: string;
  title: string;
  prompt: string;
  placeholder: string;
  referenceAnswer: string;
};

const FORMULAS = {
  plant: 'P_h(s)=\\dfrac{0.01715}{s(s+0.1)(s+2.14375)}',
  structure: 'C_h(s)=K\\dfrac{Ts+1}{\\alpha Ts+1},\\ 0<\\alpha<1',
  unconstrainedCandidate: 'C_u(s)=5\\dfrac{10s+1}{2s+1}',
  hardConstraints: 'M_p\\le 20\\%,\\ \\max|u(t)|\\le 7,\\ \\varphi_m\\ge 45^\\circ',
  parameterRange: '1\\le K\\le 6,\\ 4\\le T\\le 15,\\ 0.15\\le \\alpha\\le 0.85',
  jFree:
    'J_{\\mathrm{free}}(\\theta)=w_1\\dfrac{t_s(\\theta)}{40}+w_2\\dfrac{ITAE(\\theta)}{ITAE_0}+w_3\\dfrac{ITSE(\\theta)}{ITSE_0}+w_4\\dfrac{E_u(\\theta)}{E_{u,0}}',
  jCon: 'J_{\\mathrm{con}}(\\theta)=J_{\\mathrm{free}}(\\theta)+P(\\theta)',
  penalty:
    'P(\\theta)=50\\max(0,M_p-20)^2+20\\max(0,u_{\\max}-7)^2+5\\max(0,45-\\varphi_m)^2',
  x0: 'x_0=[2.796,\\ 10,\\ 0.406]^\\mathsf{T}',
  lbub: 'lb=[1,\\ 4,\\ 0.15]^\\mathsf{T},\\quad ub=[6,\\ 15,\\ 0.85]^\\mathsf{T}',
  objective:
    'J_B(\\theta)=0.30\\dfrac{t_s(\\theta)}{40}+0.30\\dfrac{ITAE(\\theta)}{ITAE_0}+0.20\\dfrac{ITSE(\\theta)}{ITSE_0}+0.20\\dfrac{E_u(\\theta)}{E_{u,0}}',
  nonlcon: 'M_p\\le 20\\%,\\quad u_{\\max}\\le 7,\\quad \\varphi_m\\ge 45^\\circ',
  initialController: 'C_0(s)=2.796\\dfrac{10s+1}{4.06s+1}',
  weightB: 'C_B(s)=2.0644\\dfrac{9.9804s+1}{2.0809s+1}',
  constrainedB: 'C_{B,c}(s)=1.7679\\dfrac{10.4676s+1}{2.6452s+1}',
  weightA: 'A=[0.40,\\ 0.30,\\ 0.20,\\ 0.10]',
  weightMid: 'B=[0.30,\\ 0.30,\\ 0.20,\\ 0.20]',
  weightC: 'C=[0.20,\\ 0.25,\\ 0.25,\\ 0.30]',
  optimizedLeadLag: 'C_{LL}^\\star(s)=1.7679\\dfrac{10.4676s+1}{2.6452s+1}',
  optimizedPid:
    'C_{PID}^\\star(s)=0.3205\\left(1+\\dfrac{1}{137.3s}+\\dfrac{100.0s}{5.0s+1}\\right)',
  marginWarning: 'u_{\\max}^\\star=6.996\\approx 7',
} as const;

const PROMPT_FIELDS: Record<string, readonly PromptField[]> = {
  'step-04': [
    {
      key: 'constraint-role-card',
      title: '控制量爆表先被哪条边界挡住',
      prompt: '哪一条边界最直接挡住控制量爆表？',
      placeholder: '写出最直接对应的硬约束，并说明它在裁决什么风险。',
      referenceAnswer: '最直接挡住控制量爆表的是 $u_{\\max}\\le 7$，因为它直接裁决执行机构是否还能实现当前解。',
    },
    {
      key: 'misread-card',
      title: '相角裕度未崩塌为何仍不足够',
      prompt: '为什么相角裕度没崩塌，仍不能说明候选整体可交付？',
      placeholder: '围绕超调、控制峰值和整体可交付性作答。',
      referenceAnswer: '交付裁决不是只看相角裕度；若超调和控制峰值已经越界，整体结果仍然不可交付。',
    },
  ],
  'step-05': [
    {
      key: 'role-task',
      title: '职责判断',
      prompt: '$1\\le K\\le 6$ 与 $u_{\\max}\\le 7$ 分别在回答什么问题？',
      placeholder: '分别写出“结构语义 / 搜索区间”和“结果交付 / 输出边界”这两层职责。',
      referenceAnswer: '$1\\le K\\le 6$ 回答结构语义与搜索区间，$u_{\\max}\\le 7$ 回答输出侧结果是否还能交付。',
    },
  ],
  'step-07': [
    {
      key: 'solver-task',
      title: '五项定义判断',
      prompt: '为什么本页重点不是 API，而是问题定义？',
      placeholder: '围绕对象、结构、起点与范围、目标函数、约束函数如何共同决定求解行为作答。',
      referenceAnswer: '因为求解器只是消费已写清的问题定义；真正决定求解行为的是对象、结构、起点与范围、目标函数与约束函数。',
    },
  ],
  'step-08': [
    {
      key: 'same-weight-task',
      title: '可行域迁移判断',
      prompt: '为什么这里改写的是可行域，而不是权重语言？',
      placeholder: '围绕“同一权重没有变化，但越界解被排出可行域”作答。',
      referenceAnswer: '同一权重并没有变化，变化的是越界解被排出可行域，最优点因此在新的可行域内迁移。',
    },
  ],
  'step-12': [
    {
      key: 'posttest-q1',
      title: '后测 1',
      prompt: '同一权重下为何分出两组参数？',
      placeholder: '从可行域迁移，而不是“偏好变了”这一层回答。',
      referenceAnswer: '不是因为偏好变了，而是因为越界解被排出可行域，最优点被迫迁移到新的可行域内。',
    },
    {
      key: 'posttest-q2',
      title: '后测 2',
      prompt: '参数范围和输出侧硬约束分别回答什么问题？',
      placeholder: '分别写出结构语义和结果交付两层语言。',
      referenceAnswer: '参数范围回答结构语义与搜索区间，输出侧硬约束回答结果是否还能交付。',
    },
    {
      key: 'posttest-q3',
      title: '后测 3',
      prompt: '为什么当前结果仍需继续被审视？',
      placeholder: '围绕控制峰值余量与结构边界继续露头作答。',
      referenceAnswer: '因为当前结果虽已可接受，但控制峰值余量很窄，结构一旦改变最优区间会明显改写，所以不能把它当成终局。',
    },
  ],
};

function renderInlineContent(text: string) {
  const parts = text.split(/(\$[^$]+\$)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith('$') && part.endsWith('$')) {
      return <InlineMath key={`${part}-${index}`} math={part.slice(1, -1)} />;
    }
    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

function renderTableCell(cell: TableCell) {
  if (typeof cell === 'string') return cell;
  return <InlineMath math={cell.value} />;
}

function FormulaCard({ title, formula, note }: { title: string; formula: string; note?: string }) {
  return (
    <div className="premium-lesson-panel">
      <div className="premium-lesson-kicker">{title}</div>
      <div className="mt-3 overflow-x-auto">
        <BlockMath math={formula} />
      </div>
      {note ? <p className="premium-lesson-muted mt-2 text-sm">{renderInlineContent(note)}</p> : null}
    </div>
  );
}

function SummaryCard({
  title,
  text,
  bullets,
}: {
  title?: string;
  text?: string;
  bullets?: readonly string[];
}) {
  return (
    <div className="premium-lesson-panel">
      {title ? <div className="premium-lesson-kicker">{title}</div> : null}
      {text ? <p className="premium-lesson-title mt-2 text-base leading-7">{renderInlineContent(text)}</p> : null}
      {bullets?.length ? (
        <ul className="premium-lesson-muted mt-3 space-y-2 text-sm leading-7">
          {bullets.map((bullet) => (
            <li key={bullet} className="ml-5 list-disc">
              {renderInlineContent(bullet)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function TablePanel({
  title,
  columns,
  rows,
  highlightKeys,
  note,
}: {
  title?: string;
  columns: readonly string[];
  rows: readonly (readonly TableCell[])[];
  highlightKeys?: readonly string[];
  note?: string;
}) {
  const highlightSet = new Set(highlightKeys ?? []);

  return (
    <div className="premium-lesson-panel overflow-hidden">
      {title ? <div className="premium-lesson-kicker">{title}</div> : null}
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-700">
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rowKey = typeof row[0] === 'string' ? row[0] : row[0].value;
              return (
                <tr
                  key={rowKey}
                  className={
                    highlightSet.has(rowKey)
                      ? 'border-b border-amber-100 bg-amber-50'
                      : 'border-b border-slate-100'
                  }
                >
                  {row.map((cell, index) => (
                    <td key={`${rowKey}-${index}`} className="px-3 py-2 align-top">
                      {renderTableCell(cell)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {note ? <p className="premium-lesson-muted mt-3 text-sm">{renderInlineContent(note)}</p> : null}
    </div>
  );
}

function ImagePanel({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <div className="premium-lesson-panel">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <Image src={src} alt={alt} width={1600} height={960} className="h-auto w-full" />
      </div>
      <p className="premium-lesson-muted mt-3 text-sm">{renderInlineContent(caption)}</p>
    </div>
  );
}

function FormulaRow({ items }: { items: readonly { title: string; formula: string }[] }) {
  return (
    <div className={`grid gap-4 ${items.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
      {items.map((item) => (
        <FormulaCard key={item.title} title={item.title} formula={item.formula} />
      ))}
    </div>
  );
}

function RevealChain({
  stepKey,
  title,
  steps,
  revealProgress,
  allowInlineReveal,
}: {
  stepKey: string;
  title: string;
  steps: readonly string[];
  revealProgress: number;
  allowInlineReveal: boolean;
}) {
  const teacherVisibleCount = Math.min(steps.length, Math.max(1, revealProgress + 1));
  const [localVisibleCount, setLocalVisibleCount] = useState(teacherVisibleCount);

  useEffect(() => {
    setLocalVisibleCount(teacherVisibleCount);
  }, [stepKey, teacherVisibleCount]);

  const visibleCount = Math.min(steps.length, Math.max(teacherVisibleCount, localVisibleCount));

  return (
    <div className="premium-lesson-panel">
      <div className="premium-lesson-kicker">{title}</div>
      <div className="mt-3 space-y-3">
        {steps.slice(0, visibleCount).map((item, index) => {
          const isLastVisible = index === visibleCount - 1;
          const canExpand = allowInlineReveal && isLastVisible && visibleCount < steps.length;
          return (
            <button
              key={`${stepKey}-${item}`}
              type="button"
              onClick={() => {
                if (canExpand) {
                  setLocalVisibleCount((prev) => Math.min(steps.length, prev + 1));
                }
              }}
              className={`block w-full rounded-2xl border px-4 py-3 text-left ${
                canExpand ? 'border-cyan-200 bg-cyan-50 hover:border-cyan-300' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="premium-lesson-kicker">第 {index + 1} 层</div>
              <p className="premium-lesson-title mt-1 text-sm leading-7">{renderInlineContent(item)}</p>
              {canExpand ? (
                <p className="premium-lesson-muted mt-2 text-xs">点击当前最下方步骤继续显示下一层。</p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PromptCard({
  title,
  prompt,
  placeholder,
  value,
  onChange,
  onSubmit,
  submitted,
  answerVisible,
  referenceAnswer,
}: {
  title: string;
  prompt: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitted: boolean;
  answerVisible: boolean;
  referenceAnswer: string;
}) {
  return (
    <div className="premium-lesson-panel">
      <div className="premium-lesson-kicker">{title}</div>
      <p className="premium-lesson-title mt-2 text-sm leading-7">{renderInlineContent(prompt)}</p>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="premium-lesson-input mt-3 min-h-[120px] w-full"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!value.trim()}
          className="premium-lesson-action-primary disabled:opacity-40"
        >
          提交答案
        </button>
        <span className="premium-lesson-caption text-xs">
          {submitted ? '已提交，可继续修改后重提。' : '独立提交本卡。'}
        </span>
      </div>
      {answerVisible ? (
        <div className="premium-lesson-tone-block premium-tone-cyan mt-4 text-sm leading-7">
          <strong>参考解释：</strong>
          {renderInlineContent(referenceAnswer)}
        </div>
      ) : null}
    </div>
  );
}

function TeacherControlPanel({
  step,
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
  step: UNIT_4_5StepDefinition;
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
  const pageContract = getUNIT_4_5PageContract(step.id);

  return (
    <div className="premium-lesson-panel">
      <div className="premium-lesson-kicker">教师控制</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {pageContract.teacherControls.releaseActivity !== 'not_applicable' ? (
          <button
            type="button"
            onClick={onToggleRelease}
            className={`premium-lesson-action-tone ${released ? 'premium-tone-emerald' : 'premium-tone-slate'}`}
          >
            {released ? '已发放作答' : '发放作答'}
          </button>
        ) : null}
        {pageContract.teacherControls.openBrowse !== 'not_applicable' &&
        pageContract.teacherControls.openBrowse !== 'page_load_open' ? (
          <button
            type="button"
            onClick={onToggleBrowse}
            className={`premium-lesson-action-tone ${browseEnabled ? 'premium-tone-cyan' : 'premium-tone-slate'}`}
          >
            {browseEnabled ? '已开放浏览' : '开放浏览'}
          </button>
        ) : null}
        {pageContract.teacherControls.revealReferenceAnswer !== 'not_applicable' ? (
          <button
            type="button"
            onClick={onToggleAnswerVisible}
            className={`premium-lesson-action-tone ${answerVisible ? 'premium-tone-amber' : 'premium-tone-slate'}`}
          >
            {answerVisible ? '隐藏参考答案' : '显示参考答案'}
          </button>
        ) : null}
        {pageContract.teacherControls.teacherStepReveal === 'teacher_only' ? (
          <>
            <button
              type="button"
              onClick={onAdvanceReveal}
              className="premium-lesson-action-tone premium-tone-cyan"
            >
              推进显影
            </button>
            <button
              type="button"
              onClick={onResetReveal}
              className="premium-lesson-action-tone premium-tone-slate"
            >
              重置显影
            </button>
          </>
        ) : null}
      </div>
      {pageContract.teacherControls.teacherStepReveal === 'teacher_only' ? (
        <p className="premium-lesson-muted mt-3 text-sm">当前教师显影层级：{revealProgress + 1}</p>
      ) : null}
    </div>
  );
}

function renderStepContent(
  step: UNIT_4_5StepDefinition,
  mediaSrc: string | null,
  mediaAlt: string,
  revealProgress: number,
  allowInlineReveal: boolean,
) {
  switch (step.id) {
    case 'step-01':
      return (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <FormulaCard title="主案例对象" formula={FORMULAS.plant} note="当前对象仍是客船航向保持主案例。" />
            <FormulaCard title="固定结构" formula={FORMULAS.structure} />
            <FormulaCard title="无约束候选" formula={FORMULAS.unconstrainedCandidate} note="这是 $4$-$4$ 留下的无约束候选，不是最终可交付方案。" />
            <SummaryCard title="问题句" text="时间指标更好，为什么仍不可交付？" />
            <SummaryCard title="本页结论" text="本课先不继续谈求解器，而是先把更优与可交付的断裂看清。更优不等于可交付。" />
          </div>
          <div className="space-y-4">
            {mediaSrc ? (
              <ImagePanel
                src={mediaSrc}
                alt={mediaAlt}
                caption="客船航向保持：无约束候选为什么不可直接交付。先看闭环输出确实更快压向目标，再看控制量已经明显冲出可接受动作区间。"
              />
            ) : null}
          </div>
        </div>
      );
    case 'step-02':
      return (
        <div className="space-y-4">
          <SummaryCard title="课程目标" text="完成这一轮实践后，我们应能做到什么？" />
          <SummaryCard
            bullets={[
              '指出无约束候选在哪些工程边界上失守。',
              '把超调、控制峰值和相角裕度写成硬约束。',
              '区分参数范围与输出侧硬约束的职责。',
              '解释罚函数与 $fmincon/nonlcon$ 为什么会改写最优点位置。',
              '比较起始方案、无约束候选和带约束可用解，并说明剩余风险。',
            ]}
          />
          <SummaryCard text="本课承接 $4$-$4$ 的无约束建模，真正解决“最优不等于可用”。" />
        </div>
      );
    case 'step-03':
      return (
        <div className="space-y-4">
          <SummaryCard
            title="比较对象"
            text="当前仍是客船航向保持主案例；左表回收自由目标收益，右表专门复核这些收益是否伴随新的工程失守。"
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <TablePanel
              title="表 1. 客船航向保持主案例中的自由目标收益"
              columns={['指标', '4-3 起始方案', '4-4 无约束候选', '收益判断']}
              rows={[
                ['调节时间 / s', '36.0', '19.6', '更快'],
                ['ITAE', '63.6924', '20.1632', '拖尾更短'],
                ['ITSE', '16.5282', '5.3330', '前中段误差强度下降'],
                ['控制能量', '125.7148', '774.9575', '为收益支付了更大动作代价'],
              ]}
            />
            <TablePanel
              title="表 2. 同一主案例下的工程复核"
              columns={['指标', '4-3 起始方案', '4-4 无约束候选', '复核结论']}
              rows={[
                ['超调 / %', '18.8636', '20.2410', '已越过舒适性边界'],
                ['调节时间 / s', '36.0', '19.6', '收敛明显更快'],
                ['ITAE', '63.6924', '20.1632', '拖尾明显缩短'],
                ['ITSE', '16.5282', '5.3330', '前中段误差强度下降'],
                ['控制能量', '125.7148', '774.9575', '动作代价急剧上升'],
                ['控制峰值', '6.8867', '25.0000', '远超执行机构边界'],
                ['相角裕度 / deg', '49.0462', '47.8274', '裕度未崩塌，但并没有换来更稳妥的整体结果'],
              ]}
              highlightKeys={['超调 / %', '控制峰值', '相角裕度 / deg']}
              note="先读收益列，再读越界列，最后判断这些收益是不是建立在越界代价之上。"
            />
          </div>
          <SummaryCard text="自由目标收益是真实存在的，但它不能自动等于工程可用。" />
        </div>
      );
    case 'step-04':
      return (
        <div className="space-y-4">
          <FormulaCard title="三条必须常显的硬约束" formula={FORMULAS.hardConstraints} note="本页所有判断都以这三条边界为固定参照。" />
          <TablePanel
            columns={['硬约束', '挡住的风险', '若不显性写出会发生什么']}
            rows={[
              [{ kind: 'math', value: 'M_p\\le 20\\%' }, '舒适性与修航平稳程度', '把越摆当作可无限接受的提速代价'],
              [{ kind: 'math', value: 'u_{\\max}\\le 7' }, '执行机构物理能力', '候选解看似更快，实际已不可实现'],
              [{ kind: 'math', value: '\\varphi_m\\ge 45^\\circ' }, '闭环稳健性储备', '只看时域变快，不看模型偏差和扰动下的脆弱性'],
            ]}
          />
          <SummaryCard text="硬约束不是在表扬哪一组更优，而是在裁决结果能否交付。" />
        </div>
      );
    case 'step-05':
      return (
        <div className="space-y-4">
          <FormulaCard title="参数范围" formula={FORMULAS.parameterRange} />
          <SummaryCard text="参数范围负责结构可解释，硬约束负责结果可交付。" />
          <TablePanel
            columns={['设计对象', '在模型中的角色', '具体职责']}
            rows={[
              [{ kind: 'math', value: 'K,T,\\alpha' }, '参数范围', '维持固定结构可解释区间，告诉搜索只能在这一结构语义内移动'],
              ['超调、控制峰值、相角裕度', '硬约束', '结果越界时进入罚函数或直接判为不可行'],
              ['调节时间、ITAE、控制能量', '软目标', '在守住边界后继续争取更好表现'],
              ['ITSE、截止频率、幅值裕度', '复核项', '求解后解释为什么当前结果可信而不是偶然数值'],
            ]}
          />
        </div>
      );
    case 'step-06':
      return (
        <div className="space-y-4">
          <FormulaCard title="自由目标" formula={FORMULAS.jFree} />
          <FormulaCard title="带约束总代价" formula={FORMULAS.jCon} />
          <FormulaCard title="罚函数" formula={FORMULAS.penalty} />
          <RevealChain
            stepKey={step.id}
            title="解释链"
            steps={[
              '只要三条硬约束都未越界，$P(\\theta)=0$，搜索仍按原有偏好推进。',
              '一旦某一项越界，罚项开始增大，总代价不再只奖励更快或更省。',
              '越界越严重，罚项增长越快，搜索会被推回可交付区域。',
            ]}
            revealProgress={revealProgress}
            allowInlineReveal={allowInlineReveal}
          />
          <SummaryCard text="偏好没变，规则变了。" />
        </div>
      );
    case 'step-07':
      return (
        <div className="space-y-4">
          <TablePanel
            title="表 5. 求解器真正消费的五项定义"
            columns={['项目', '当前写法', '作用']}
            rows={[
              ['对象', { kind: 'math', value: 'P_h(s)=\\dfrac{0.01715}{s(s+0.1)(s+2.14375)}' }, '提供被控对象模型'],
              ['结构', { kind: 'math', value: 'C_h(s)=K\\dfrac{Ts+1}{\\alpha Ts+1}' }, '固定参数化形式'],
              ['起点与范围', { kind: 'math', value: 'x_0=[2.796,\\ 10,\\ 0.406]^\\mathsf{T},\\ lb=[1,\\ 4,\\ 0.15]^\\mathsf{T},\\ ub=[6,\\ 15,\\ 0.85]^\\mathsf{T}' }, '告诉搜索从哪里出发、能走到哪里'],
              ['目标函数', { kind: 'math', value: 'J_B(\\theta)=0.30\\dfrac{t_s(\\theta)}{40}+0.30\\dfrac{ITAE(\\theta)}{ITAE_0}+0.20\\dfrac{ITSE(\\theta)}{ITSE_0}+0.20\\dfrac{E_u(\\theta)}{E_{u,0}}' }, '告诉求解器想把什么继续压低'],
              ['约束函数', { kind: 'math', value: 'M_p\\le 20\\%,\\quad u_{\\max}\\le 7,\\quad \\varphi_m\\ge 45^\\circ' }, '把交付边界写成可行性判定'],
            ]}
          />
          <RevealChain
            stepKey={step.id}
            title="六步求解链"
            steps={[
              '先给出 $x_0/lb/ub$，让搜索知道从哪里出发、能走到哪里。',
              '再写 $objective$，把上一课保留下来的偏好继续保留下来。',
              '再写 $nonlcon$，把三条硬约束显式交给求解器。',
              '随后调用 $fmincon$，让它在边界内重新搜索。',
              '求解结果先回读成 $x_\\star$，不要直接跳到“优化成功”。',
              '最后把 $x_\\star$ 翻译成 $C_\\star(s)$，再回到控制器结构解释结果。',
            ]}
            revealProgress={revealProgress}
            allowInlineReveal={allowInlineReveal}
          />
          <SummaryCard text="求解器只是在消费已经写清的问题定义，不会替我们决定边界来自哪里。" />
        </div>
      );
    case 'step-08':
      return (
        <div className="space-y-4">
          <FormulaRow
            items={[
              { title: '起始方案', formula: FORMULAS.initialController },
              { title: '同权重无约束解', formula: FORMULAS.weightB },
              { title: '同权重带约束解', formula: FORMULAS.constrainedB },
            ]}
          />
          <TablePanel
            title="表 6. 同一权重下的三方案对比"
            columns={['方案', '调节时间 / s', 'ITAE', 'ITSE', '控制能量', '控制峰值', '相角裕度 / deg']}
            rows={[
              ['4-3 起始方案', '36.0', '63.692', '16.528', '125.715', '6.887', '49.046'],
              ['同权重无约束解', '13.5', '28.265', '12.404', '122.910', '9.901', '67.747'],
              ['同权重带约束解', '15.4', '37.784', '16.486', '79.767', '6.996', '67.694'],
            ]}
          />
          {mediaSrc ? (
            <ImagePanel src={mediaSrc} alt={mediaAlt} caption="平衡权重下：无约束最优与带约束最优为什么会分出两组不同解。" />
          ) : null}
          <RevealChain
            stepKey={step.id}
            title="解释链"
            steps={[
              '同一权重没有变化。',
              '越界解被排出可行域。',
              '最优点因此在新的可行域内迁移。',
            ]}
            revealProgress={revealProgress}
            allowInlineReveal={allowInlineReveal}
          />
          <SummaryCard text="改写的是可行域，不是权重语言。" />
        </div>
      );
    case 'step-09':
      return (
        <div className="space-y-4">
          <FormulaRow
            items={[
              { title: '速度优先', formula: FORMULAS.weightA },
              { title: '平衡权重', formula: FORMULAS.weightMid },
              { title: '动作代价优先', formula: FORMULAS.weightC },
            ]}
          />
          <TablePanel
            title="表 7. 约束内权重扫掠结果"
            columns={['方案', '调节时间 / s', 'ITAE', '控制能量', '控制峰值', 'φm / deg', '超调 / %']}
            rows={[
              ['速度优先 A', '15.7', '38.479', '77.371', '6.902', '67.684', '1.963'],
              ['平衡权重 B', '15.4', '37.784', '79.767', '6.996', '67.694', '1.819'],
              ['动作代价优先 C', '25.4', '52.566', '51.145', '4.825', '67.113', '2.167'],
            ]}
          />
          {mediaSrc ? (
            <ImagePanel src={mediaSrc} alt={mediaAlt} caption="同一结构下，权重改变会重排可行解的收益分布。" />
          ) : null}
          <RevealChain
            stepKey={step.id}
            title="趋势总结"
            steps={[
              '硬约束主导后，继续把权重往“更快”那一侧推，并不会无限换来速度收益。',
              '当权重显著照顾动作代价时，可行解会主动回到更保守的时间尺度。',
            ]}
            revealProgress={revealProgress}
            allowInlineReveal={allowInlineReveal}
          />
        </div>
      );
    case 'step-10':
      return (
        <div className="space-y-4">
          <FormulaRow
            items={[
              { title: '优化超前结构', formula: FORMULAS.optimizedLeadLag },
              { title: '优化 PID', formula: FORMULAS.optimizedPid },
            ]}
          />
          <TablePanel
            title="表 8. 同一主案例下，不同结构的最优解对比"
            columns={['方案', '调节时间 / s', 'ITAE', 'ITSE', '控制能量', '控制峰值', '相角裕度 / deg', '超调 / %']}
            rows={[
              ['优化超前结构', '15.4', '37.784', '16.486', '79.766', '6.996', '67.694', '1.820'],
              ['优化 PID', '200.0', '1063.966', '118.036', '95.775', '6.731', '70.601', '4.123'],
            ]}
          />
          {mediaSrc ? (
            <ImagePanel src={mediaSrc} alt={mediaAlt} caption="同一性能指标函数下，结构改变会把最优点带向不同区间。" />
          ) : null}
          <SummaryCard
            bullets={[
              '参数优化只能回答“在这一个结构里怎样调最好”，不能替我们回答“这个结构本身是不是最合适”。',
              '结构一旦变化，最优点会移动到完全不同的代价分布上。',
              '这正是 $4$-$6$ 要接住的结构边界问题。',
            ]}
          />
        </div>
      );
    case 'step-11':
      return (
        <div className="space-y-4">
          <TablePanel
            title="表 9. 三方案关键指标对比"
            columns={['指标', '4-3 起始方案', '越界无约束候选', '4-5 带约束可用解']}
            rows={[
              ['超调 / %', '18.8636', '20.2410', '1.8194'],
              ['调节时间 / s', '36.0', '19.6', '15.4'],
              ['ITAE', '63.6924', '20.1632', '37.7835'],
              ['ITSE', '16.5282', '5.3330', '16.4860'],
              ['控制能量', '125.7148', '774.9575', '79.7669'],
              ['控制峰值', '6.8867', '25.0000', '6.9960'],
              ['相角裕度 / deg', '49.0462', '47.8274', '67.6942'],
            ]}
          />
          <SummaryCard
            title="可接受标准"
            bullets={[
              '参数仍能回到当前结构机理上解释。',
              '超调、控制峰值和相角裕度三条边界全部守住。',
              '改进收益能够在统一证据下被读出来。',
            ]}
          />
          <FormulaCard title="余量告警" formula={FORMULAS.marginWarning} note="当前结构仍成立，但余量并不宽松。" />
          <RevealChain
            stepKey={step.id}
            title="收束链"
            steps={[
              '无约束候选把收益建立在越界代价上。',
              '带约束可用解把优化重新拉回可用设计空间。',
              '当前结果可接受，但固定结构边界并未解决。',
            ]}
            revealProgress={revealProgress}
            allowInlineReveal={allowInlineReveal}
          />
          <SummaryCard text="结构差异已露头，$4$-$6$ 才进入结构边界主线。" />
        </div>
      );
    case 'step-12':
      return (
        <div className="space-y-4">
          <SummaryCard title="后测标题卡" text="阶段判断后测：把边界、求解与解释重新连成一条链。" />
          <SummaryCard text="本页只做后测，不再兼任总结页。" />
        </div>
      );
    case 'step-13':
      return (
        <div className="space-y-4">
          <SummaryCard
            title="五条带走"
            bullets={[
              '无约束候选的收益是真实的，但建立在越界代价之上。',
              '参数范围和输出侧硬约束不是同一层语言。',
              '罚函数与 $nonlcon$ 的价值在于把边界写进求解器规则。',
              '同一权重下最优点变化，说明变化发生在可行域。',
              '固定结构下的可接受解已经形成，但结构边界尚未进入主线。',
            ]}
          />
          {mediaSrc ? (
            <ImagePanel src={mediaSrc} alt={mediaAlt} caption="信息图：从越界候选到带约束可用解的证据闭环。" />
          ) : null}
          <SummaryCard text="下一课转入结构边界与场景迁移。" />
        </div>
      );
    default:
      return null;
  }
}

export function UNIT_4_5StepContentPanel({
  step,
  mediaSrc,
  mediaAlt,
  revealProgress,
  allowInlineReveal,
}: {
  step: UNIT_4_5StepDefinition;
  mediaSrc: string | null;
  mediaAlt: string;
  revealProgress: number;
  allowInlineReveal: boolean;
}) {
  return <section className="space-y-4">{renderStepContent(step, mediaSrc, mediaAlt, revealProgress, allowInlineReveal)}</section>;
}

export function UNIT_4_5StudentActivityForm({
  step,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress: _revealProgress,
  onSubmit,
}: {
  step: UNIT_4_5StepDefinition;
  savedResponse?: UNIT_4_5StepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: UNIT_4_5StepResponse) => void;
}) {
  const prompts = PROMPT_FIELDS[step.id] ?? [];
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>(savedResponse?.answers ?? {});

  useEffect(() => {
    setDraftAnswers(savedResponse?.answers ?? {});
  }, [savedResponse, step.id]);

  const submittedKeys = useMemo(() => new Set(Object.keys(savedResponse?.answers ?? {})), [savedResponse?.answers]);
  const hasSubmittablePrompts =
    prompts.length > 0 && (isUNIT_4_5PerCardTextStep(step.id) || step.pageType === 'quiz_group');

  if (!hasSubmittablePrompts) {
    return (
      <div className="premium-lesson-panel">
        <div className="premium-lesson-kicker">本页作答</div>
        <SubmissionStatus submitted={false} idleText="本页为阅读、显影或总结页，无需提交答案。" />
      </div>
    );
  }

  if (!released) {
    return (
      <div className="premium-lesson-panel">
        <div className="premium-lesson-kicker">本页作答</div>
        <div className="premium-lesson-tone-block premium-tone-amber mt-3">教师尚未发放本页作答卡，请先阅读上方证据。</div>
      </div>
    );
  }

  if (!browseEnabled && step.pageType === 'quiz_group') {
    return (
      <div className="premium-lesson-panel">
        <div className="premium-lesson-kicker">本页作答</div>
        <div className="premium-lesson-tone-block premium-tone-amber mt-3">教师尚未开放浏览，请等待课堂推进。</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {prompts.map((field) => (
        <PromptCard
          key={field.key}
          title={field.title}
          prompt={field.prompt}
          placeholder={field.placeholder}
          value={draftAnswers[field.key] ?? ''}
          onChange={(value) => setDraftAnswers((prev) => ({ ...prev, [field.key]: value }))}
          onSubmit={() =>
            onSubmit({
              stepId: step.id,
              submittedAt: Date.now(),
              answers: {
                ...(savedResponse?.answers ?? {}),
                ...draftAnswers,
                [field.key]: draftAnswers[field.key] ?? '',
              },
            })
          }
          submitted={submittedKeys.has(field.key)}
          answerVisible={answerVisible}
          referenceAnswer={field.referenceAnswer}
        />
      ))}
      <div className="premium-lesson-panel">
        <div className="premium-lesson-kicker">提交状态</div>
        <SubmissionStatus
          submitted={prompts.every((field) => submittedKeys.has(field.key))}
          submittedText="本页作答卡已至少提交一次，可继续修改并逐卡重提。"
          idleText="各作答卡独立提交，教师端会按卡汇总。"
        />
      </div>
    </div>
  );
}

export function UNIT_4_5TeacherActivitySummary({
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
  step: UNIT_4_5StepDefinition;
  responses: TeacherResponseItem[];
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
  const prompts = PROMPT_FIELDS[step.id] ?? [];

  return (
    <div className="space-y-4">
      <TeacherControlPanel
        step={step}
        released={released}
        browseEnabled={browseEnabled}
        answerVisible={answerVisible}
        revealProgress={revealProgress}
        onToggleRelease={onToggleRelease}
        onToggleBrowse={onToggleBrowse}
        onToggleAnswerVisible={onToggleAnswerVisible}
        onAdvanceReveal={onAdvanceReveal}
        onResetReveal={onResetReveal}
      />

      <div className="premium-lesson-panel">
        <div className="premium-lesson-kicker">教师汇总</div>
        <p className="premium-lesson-muted mt-2 text-sm">
          当前已有 {responses.length} 份作答记录。含隐藏作答卡或后测题组的页面，会在此展示学生答案。
        </p>
        {!prompts.length ? (
          <div className="premium-lesson-muted mt-4 text-sm">本页没有学生提交项。</div>
        ) : responses.length ? (
          <div className="mt-4 space-y-4">
            {responses.map((item) => (
              <div
                key={`${item.studentName}-${item.response.submittedAt}`}
                className="premium-lesson-surface-elevated space-y-3 p-4"
              >
                <div className="premium-lesson-title text-sm font-semibold">{item.studentName}</div>
                {prompts.map((field) => {
                  const value = item.response.answers[field.key];
                  if (!value) return null;
                  return (
                    <div key={field.key}>
                      <div className="premium-lesson-kicker">{field.title}</div>
                      <p className="premium-lesson-title mt-1 whitespace-pre-wrap text-sm leading-7">{value}</p>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className="premium-lesson-muted mt-4 text-sm">暂无学生提交。</div>
        )}
      </div>

      {answerVisible && prompts.length ? (
        <div className="premium-lesson-panel">
          <div className="premium-lesson-kicker">参考解释</div>
          <div className="mt-3 space-y-3">
            {prompts.map((field) => (
              <div key={field.key} className="premium-lesson-tone-block premium-tone-cyan text-sm leading-7">
                <strong>{field.title}：</strong>
                {renderInlineContent(field.referenceAnswer)}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
