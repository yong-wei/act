'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import { SubmissionStatus } from '@/features/interactive/shared/submission-status';
import {
  getUNIT_4_3PageContract,
  type UNIT_4_3StepDefinition,
  type UNIT_4_3StepResponse,
} from '@/lib/unit-4-3-course';
import type { WorkspaceParameterChange } from './workspace';

type TeacherResponseItem = {
  studentName: string;
  response: UNIT_4_3StepResponse;
};

const STEP_01_QUESTIONS = [
  {
    key: 'map-q1',
    prompt: '哪句话仍停留在“只报结构名”的层次？',
    options: [
      '写清对象分析、参数方向与问题清单，再进入首轮验证。',
      '直接报出一个结构名称，不解释对象、代价和下一轮入口。',
      '先写清边界，再决定是否进入复合结构。',
    ],
    answer: '直接报出一个结构名称，不解释对象、代价和下一轮入口。',
  },
  {
    key: 'map-q2',
    prompt: '哪种说法错误地跳过了 4-3 的边界？',
    options: [
      '4-3 负责把起步卡推进成第一版方案。',
      '4-3 直接完成多目标优化，无需首轮验证。',
      '4-4 接住 4-3 的问题清单继续权衡。',
    ],
    answer: '4-3 直接完成多目标优化，无需首轮验证。',
  },
  {
    key: 'map-q3',
    prompt: '哪句话忽略了问题清单的必要性？',
    options: [
      '首轮验证后要写清收益、代价和下一轮优先项。',
      '只看一个最好看的指标即可宣布方案完成。',
      '问题清单是 4-4 的输入，而不是附属备注。',
    ],
    answer: '只看一个最好看的指标即可宣布方案完成。',
  },
] as const;

const STEP_03_OPTIONS = [
  '继续单结构',
  '进入复合结构',
  '反馈 + 前馈组合',
] as const;

const STEP_14_QUESTIONS = [
  {
    key: 'post-q1',
    prompt: '参数方向至少要写清哪三类内容？',
    options: [
      '只写参数数值即可',
      '先改什么、希望换来什么、可能先透支什么',
      '只写结构名称和调参软件',
    ],
    answer: '先改什么、希望换来什么、可能先透支什么',
  },
  {
    key: 'post-q2',
    prompt: '首轮验证的正确产物是什么？',
    options: [
      '宣布方案最终完成',
      '把收益、代价与下一轮优先项压成问题清单',
      '删除前面所有对象分析',
    ],
    answer: '把收益、代价与下一轮优先项压成问题清单',
  },
  {
    key: 'post-q3',
    prompt: '4-4 会继续处理哪一类问题？',
    options: [
      '把第一版方案中的多目标拉扯继续权衡',
      '重新回到是否使用拉氏变换',
      '删除所有验证读数，只看结构长度',
    ],
    answer: '把第一版方案中的多目标拉扯继续权衡',
  },
] as const;

const ACTIVITY_CARD_FIELDS: Record<string, Array<{ key: string; title: string; placeholder: string }>> = {
  'step-02': [
    { key: 'mainConflict', title: '当前主矛盾', placeholder: '对象最紧的矛盾落在哪里？' },
    { key: 'hardConstraint', title: '当前硬约束', placeholder: '当前最不能越过的边界是什么？' },
    { key: 'singleRisk', title: '继续单结构最先失守处', placeholder: '若继续强推单结构，最可能先透支哪里？' },
    { key: 'validationReadout', title: '首轮验证重点读数', placeholder: '第一轮最该盯哪组读数？' },
  ],
  'step-05': [
    { key: 'piRole', title: 'PI 负责什么', placeholder: '写一句 PI 的职责。' },
    { key: 'leadRole', title: '超前负责什么', placeholder: '写一句超前的职责。' },
  ],
  'step-06': [
    { key: 'lagBenefit', title: '主要收益', placeholder: '这一版为何更偏稳健？' },
    { key: 'lagCost', title: '主要代价', placeholder: '这一版最明显的代价是什么？' },
  ],
  'step-07': [
    { key: 'integralRole', title: '积分负责什么', placeholder: '积分主要补哪一段行为？' },
    { key: 'derivativeRole', title: '微分与滤波负责什么', placeholder: '微分和滤波分别在克制什么？' },
  ],
  'step-08': [
    { key: 'headingLeadChoice', title: '为何先上超前', placeholder: '写出不先补低频能力的原因。' },
  ],
  'step-10': [
    { key: 'satisfiedTargets', title: '已满足的目标', placeholder: '这一版已经接住了哪些目标？' },
    { key: 'nextIssue', title: '已暴露代价与下一轮优先项', placeholder: '下一轮最值得先改什么？' },
  ],
  'step-13': [
    { key: 'rollBoundary', title: '为何不能继续沿用频段分工口径', placeholder: '说明该案例为何必须回到通道重写。' },
  ],
};

const WORKSPACE_FIELDS = [
  { key: 'analysis-card', title: '对象分析记录单', placeholder: '写出主矛盾、硬约束、单结构风险和验证重点。' },
  { key: 'scheme-card', title: '初始方案表达卡', placeholder: '写出结构、职责分工与参数方向。' },
  { key: 'issue-card', title: '问题清单移交表', placeholder: '写出收益、代价与下一轮优先项。' },
] as const;

const REVEAL_STEPS: Record<string, Array<{ title: string; body: string }>> = {
  'step-09': [
    { title: '第 1 层：由超调量反推阻尼要求', body: '若要求超调量不超过 20%，可把阻尼比先定在约 0.46。' },
    { title: '第 2 层：由调节时间估计速度下界', body: '为了把调节时间压到 40 s 左右，可把首轮目标截止频率取在 0.18 rad/s 附近。' },
    { title: '第 3 层：由相位缺额确定超前量', body: '设计点处原对象相位偏低，因此需要额外补一段相位来把相角裕度托回目标附近。' },
    { title: '第 4 层：根据慢极点布置零极点', body: '超前网络的零极点位置决定了“先补中频、再看代价”的参数方向表达。' },
    { title: '第 5 层：由幅值条件确定总增益', body: '满足设计截止频率处的幅值条件后，第一版超前方案才算写成可运行表达。' },
  ],
  'step-11': [
    { title: '第 1 层：对象要求', body: '先看低频能力、超调、调节时间和相角裕度是否被同时提出要求。' },
    { title: '第 2 层：为何不继续单结构', body: '若单结构已经明显透支另一项指标，就不应再继续强推同一条机制线。' },
    { title: '第 3 层：为何转入复合结构', body: '复合结构意味着把两类职责分开承担，而不是继续把压力压在一条线上。' },
    { title: '第 4 层：首轮验证重点', body: '最小完整链条必须回到“结构分流 + 参数方向 + 首轮验证”的闭环。' },
  ],
};

const PI_LEAD_RUNTIME_SRC = '/course-runtime/lessons/4-3/media/4-3-pi-lead-compound-quad.png';
const ROLL_STRUCTURE_RUNTIME_SRC = '/course-runtime/lessons/4-3/media/4-3-roll-fin-compensation-structure.png';

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function SurfaceCard({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('premium-lesson-panel mt-4 px-5 py-4', className)}>
      {title ? <h3 className="premium-lesson-title text-lg font-semibold">{title}</h3> : null}
      <div className={title ? 'mt-3 space-y-3' : 'space-y-3'}>{children}</div>
    </section>
  );
}

function TextareaCard({
  title,
  value,
  onChange,
  placeholder,
  half = false,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  half?: boolean;
}) {
  return (
    <div className={cn('premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4', half && 'md:col-span-1')}>
      <div className="premium-lesson-title text-sm font-medium">{title}</div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="premium-lesson-input mt-3 min-h-[132px] resize-y text-sm"
      />
    </div>
  );
}

function MediaPanel({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="premium-lesson-surface-elevated overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/50">
      <img src={src} alt={alt} className="h-auto w-full object-cover" />
    </div>
  );
}

function TablePanel({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <SurfaceCard title={title}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-slate-300">
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${title}-${rowIndex}`} className="border-b border-white/5 align-top last:border-b-0">
                {row.map((cell, cellIndex) => (
                  <td key={`${title}-${rowIndex}-${cellIndex}`} className="px-3 py-3 text-slate-100">
                    {cell.includes('C(') || cell.includes('s)=') || cell.includes('\\') ? <BlockMath math={cell} /> : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SurfaceCard>
  );
}

function RevealChain({
  stepId,
  revealProgress,
  allowInlineReveal,
}: {
  stepId: string;
  revealProgress: number;
  allowInlineReveal: boolean;
}) {
  const steps = REVEAL_STEPS[stepId] ?? [];
  const [localRevealProgress, setLocalRevealProgress] = useState(0);

  useEffect(() => {
    setLocalRevealProgress(0);
  }, [stepId]);

  const visibleCount = Math.min(steps.length, Math.max(revealProgress, allowInlineReveal ? localRevealProgress : 0) + 1);

  return (
    <div className="space-y-3" data-progressive-reveal="step_click_reveal">
      {steps.map((item, index) => {
        const visible = index < visibleCount;
        return (
          <button
            key={`${stepId}-${item.title}`}
            type="button"
            className={cn(
              'block w-full rounded-[28px] border px-4 py-4 text-left transition',
              visible ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-white/10 bg-slate-950/40 opacity-70',
            )}
            onClick={() => {
              if (allowInlineReveal && index === visibleCount - 1 && visibleCount < steps.length) {
                setLocalRevealProgress((current) => current + 1);
              }
            }}
          >
            <div className="premium-lesson-title text-sm font-medium">{item.title}</div>
            {visible ? <div className="premium-lesson-muted mt-2 text-sm leading-6">{item.body}</div> : null}
          </button>
        );
      })}
    </div>
  );
}

export function UNIT_4_3KnowledgeMapVisual() {
  return (
    <SurfaceCard title="4-2 → 4-3 → 4-4 路径图">
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ['4-2', '单结构起步卡'],
          ['4-3', '第一版方案与首轮验证'],
          ['4-4', '多目标权衡与下一轮调整'],
        ].map(([stage, detail]) => (
          <div key={stage} className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4">
            <div className="premium-lesson-kicker">{stage}</div>
            <div className="premium-lesson-title mt-2 text-base font-semibold">{detail}</div>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}

export function UNIT_4_3StepAiAssistant({
  step: _step,
  onAiEvent: _onAiEvent,
}: {
  step: UNIT_4_3StepDefinition;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}) {
  return null;
}

function renderStepBody(stepId: string, mediaSrc: string | null, mediaAlt: string, revealProgress: number, allowInlineReveal: boolean) {
  switch (stepId) {
    case 'step-01':
      return (
        <>
          <UNIT_4_3KnowledgeMapVisual />
          <SurfaceCard title="本课目标与边界">
            <div className="grid gap-3 md:grid-cols-2">
              {[
                '对象分析：把模型、任务和约束改写成设计入口。',
                '结构分流：判断继续单结构、进入复合结构还是改写通道。',
                '参数方向：写清先改哪段行为、预期改善什么、最可能先透支什么。',
                '首轮验证与问题清单：确认这一版是否值得继续推进。',
              ].map((item) => (
                <div key={item} className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4 text-sm leading-6">
                  {item}
                </div>
              ))}
            </div>
            <div className="premium-lesson-tone-block premium-tone-amber">本课只负责第一版方案落地，不直接进入下一轮多目标优化。</div>
          </SurfaceCard>
        </>
      );
    case 'step-02':
      return (
        <SurfaceCard title="对象分析四问">
          <div className="grid gap-3 md:grid-cols-2">
            {['当前最紧矛盾在哪里。', '原有单结构还能否继续推。', '新机制应当补到哪里。', '首轮验证先盯什么。'].map((item) => (
              <div key={item} className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4">{item}</div>
            ))}
          </div>
          <div className="premium-lesson-tone-block premium-tone-cyan">对象分析记录单：当前主矛盾、当前硬约束、继续单结构最先失守处、首轮验证重点读数。</div>
        </SurfaceCard>
      );
    case 'step-03':
      return (
        <>
          <TablePanel
            title="表 1 · 结构分流判断"
            headers={['当前观察', '更合适的起步方向', '设计含义']}
            rows={[
              ['低频精度不足，但动态品质尚可', '继续 PI/滞后 单结构', '先把低频能力补上，再验证是否带来过大动态代价'],
              ['超调、相角裕度或阻尼更紧', '继续 PD/超前 单结构', '先整理中频动态品质，再看速度与高频代价'],
              ['单结构已经改善一项，却明显透支另一项', '进入复合结构', '第二条机制线用来分担职责，而不是把第一条机制线越推越激进'],
              ['给定或扰动通道可测且主问题来自该通道', '反馈 + 前馈组合', '让前馈定向补偿通道，反馈继续保底'],
            ]}
          />
          <SurfaceCard title="职责重分配结论">
            <p className="premium-lesson-muted text-sm leading-6">
              复合结构意味着职责重分配：原来压在一条机制线上的任务，需要改由两条或多条职责线共同承担。
            </p>
          </SurfaceCard>
        </>
      );
    case 'step-04':
      return (
        <>
          <TablePanel
            title="表 2 · 三类复合结构总览"
            headers={['形式', '一般表达式', '更适合解决的问题', '结构分工']}
            rows={[
              ['PI + 超前', 'C(s)=K(1+1/(T_i s))(T_\\alpha s+1)/(\\alpha T_\\alpha s+1)', '既要压低静差，又要把中频相位和阻尼拉回可接受范围', 'PI 负责低频托举，超前负责中频整理'],
              ['滞后 + 超前', 'C(s)=K(T_\\ell s+1)/(\\beta T_\\ell s+1)(T_\\alpha s+1)/(\\alpha T_\\alpha s+1)', '速度尚可但低频增益不够，同时又不希望明显牺牲相位裕量', '滞后补低频，超前补相位'],
              ['带微分滤波 PID', 'C(s)=K(1+1/(T_i s)+T_d s/(T_f s+1))', '需要零静差，又希望提前整理动态品质，同时控制高频放大', '积分补低频，微分改善中频，滤波限制高频代价'],
            ]}
          />
          <SurfaceCard title="职责总览">
            <p className="premium-lesson-muted text-sm leading-6">同一条机制线不足以完成任务时，第二条机制线通常用来补足另一段行为。</p>
          </SurfaceCard>
        </>
      );
    case 'step-05':
    case 'step-06':
    case 'step-07':
      const methodMediaSrc =
        stepId === 'step-05'
          ? mediaSrc ?? PI_LEAD_RUNTIME_SRC
          : stepId === 'step-07'
            ? mediaSrc ?? ROLL_STRUCTURE_RUNTIME_SRC
            : mediaSrc;
      return (
        <>
          <SurfaceCard title="方法页">
            <div className="space-y-3">
              <div className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4">
                <div className="premium-lesson-title text-sm font-medium">对象与控制器</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <BlockMath math={stepId === 'step-05' ? 'P_1(s)=\\dfrac{1}{(s+1)(0.4s+1)}' : stepId === 'step-06' ? 'P_2(s)=\\dfrac{1}{(s+1)(0.5s+1)(0.1s+1)}' : 'P_3(s)=\\dfrac{1}{(s+1)(s+2)}'} />
                  <BlockMath math={stepId === 'step-05' ? 'C_1(s)=6\\left(1+\\dfrac{1}{1.8s}\\right)\\dfrac{0.9s+1}{0.18s+1}' : stepId === 'step-06' ? 'C_2(s)=6\\dfrac{5s+1}{20s+1}\\dfrac{0.8s+1}{0.16s+1}' : 'C_3(s)=3.5\\left(1+\\dfrac{1}{1.5s}+\\dfrac{0.25s}{0.05s+1}\\right)'} />
                </div>
              </div>
              <div className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4 text-sm leading-6">
                {stepId === 'step-05'
                  ? 'PI 环节负责提高低频增益，超前环节负责在截止频率附近补相位。'
                  : stepId === 'step-06'
                    ? '滞后环节负责提高低频增益，超前环节负责补回相位储备。'
                    : '积分补低频、微分整理中频、滤波限制高频代价。'}
              </div>
            </div>
          </SurfaceCard>
          {methodMediaSrc ? <SurfaceCard title="四联图证据"><MediaPanel src={methodMediaSrc} alt={mediaAlt} /></SurfaceCard> : null}
        </>
      );
    case 'step-08':
      return (
        <SurfaceCard title="客船案例入口">
          <div className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4">
            <div className="premium-lesson-title text-sm font-medium">问题陈述</div>
            <p className="premium-lesson-muted mt-3 text-sm leading-6">
              当前任务不是重做低频保持，而是先在保证超调量不超过 20%、控制峰值不超过 7 的前提下，把调节时间压到 40 s 左右。
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {['超调量不超过 20%', '调节时间约 40 s', '控制峰值不超过 7'].map((item) => (
              <div key={item} className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4 text-sm">{item}</div>
            ))}
          </div>
        </SurfaceCard>
      );
    case 'step-09':
    case 'step-11':
      return (
        <>
          <SurfaceCard title={stepId === 'step-09' ? '客船参数方向显影' : '最小例题显影'}>
            <div className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4">
              <div className="premium-lesson-title text-sm font-medium">题面固定区</div>
              <p className="premium-lesson-muted mt-3 text-sm leading-6">
                {stepId === 'step-09'
                  ? '参数方向不是参数表，而是一条“先改什么、希望换来什么、可能承担什么”的设计语言。'
                  : '这道最小例题用来固定“何时从单结构进入复合结构”的触发条件。'}
              </p>
            </div>
          </SurfaceCard>
          <SurfaceCard title="逐步显影链">
            <RevealChain stepId={stepId} revealProgress={revealProgress} allowInlineReveal={allowInlineReveal} />
          </SurfaceCard>
        </>
      );
    case 'step-10':
      return (
        <>
          <TablePanel
            title="表 6 · 客船首轮验证"
            headers={['指标', '校正前', '校正后', '结果解释']}
            rows={[
              ['超调量', '13.50%', '18.86%', '仍满足 20% 约束，但已接近上限'],
              ['峰值时间', '42.16 s', '15.72 s', '修航过程显著加快'],
              ['调节时间', '65.48 s', '36.02 s', '已达到约 40 s 的目标'],
              ['控制峰值', '1.00', '6.89', '控制力度已较强，接近约束上限'],
            ]}
          />
          {mediaSrc ? <SurfaceCard title="客船四联图"><MediaPanel src={mediaSrc} alt={mediaAlt} /></SurfaceCard> : null}
        </>
      );
    case 'step-12':
      return (
        <>
          <SurfaceCard title="三张模板卡">
            <div className="grid gap-3 md:grid-cols-3">
              {['对象分析记录单', '初始方案表达卡', '问题清单移交表'].map((item) => (
                <div key={item} className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4 text-sm">
                  {item}
                </div>
              ))}
            </div>
          </SurfaceCard>
          <SurfaceCard title="提交说明">
            <p className="premium-lesson-muted text-sm leading-6">本页不是统一大表单，而是三份最小提交物，分别对应对象分析、初始方案与问题清单移交。</p>
          </SurfaceCard>
        </>
      );
    case 'step-13':
      const rollCaseMediaSrc = mediaSrc ?? ROLL_STRUCTURE_RUNTIME_SRC;
      return (
        <>
          <SurfaceCard title="横摇减摇鳍边界案例">
            <p className="premium-lesson-muted text-sm leading-6">
              当任务从给定跟踪转为扰动抑制时，设计要先回到物理通道和控制通道表达，而不是继续沿用原来的频段分工口径。
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <BlockMath math={'G_{\\varphi M_f}(s)=\\dfrac{1}{2.052s^2+0.3929s+1}'} />
              <BlockMath math={'G_c(s)=\\dfrac{2(2.052s^2+0.3929s+1)}{s}=4.104s+0.7858+\\dfrac{2}{s}'} />
            </div>
          </SurfaceCard>
          <TablePanel
            title="表 7 · 横摇边界读数"
            headers={['指标', '原系统', '校正后', '含义']}
            rows={[
              ['共振峰值', '11.32 dB', '1.77 dB', '横摇共振被显著压低'],
              ['共振频率', '0.687 rad/s', '0.687 rad/s', '主要改的是峰值高度，而不是移动共振点'],
              ['振幅比', '1', '0.333', '共振处横摇响应约降为原来的三分之一'],
            ]}
          />
          {rollCaseMediaSrc ? <SurfaceCard title="结构图与对照图"><MediaPanel src={rollCaseMediaSrc} alt={mediaAlt} /></SurfaceCard> : null}
        </>
      );
    case 'step-14':
      return (
        <SurfaceCard title="收束与去向">
          <div className="grid gap-3">
            {[
              '第一版方案必须包含对象分析、结构分流、参数方向、首轮验证与问题清单。',
              '复合结构的意义在于职责分配，而不是公式长度。',
              '首轮验证的价值在于形成下一轮入口。',
              '4-4 将继续处理多个指标同时拉扯时，下一轮该先改什么。',
            ].map((item) => (
              <div key={item} className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4 text-sm leading-6">
                {item}
              </div>
            ))}
          </div>
        </SurfaceCard>
      );
    default:
      return null;
  }
}

export function UNIT_4_3StepContentPanel({
  step,
  mediaSrc,
  mediaAlt,
  revealProgress,
  allowInlineReveal,
}: {
  step: UNIT_4_3StepDefinition;
  mediaSrc: string | null;
  mediaAlt: string;
  revealProgress: number;
  allowInlineReveal: boolean;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  return <div>{renderStepBody(step.id, mediaSrc, mediaAlt, revealProgress, allowInlineReveal)}</div>;
}

export function UNIT_4_3StudentActivityForm({
  step,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
}: {
  step: UNIT_4_3StepDefinition;
  savedResponse?: UNIT_4_3StepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: UNIT_4_3StepResponse) => void;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const pageContract = getUNIT_4_3PageContract(step.id);
  const [answers, setAnswers] = useState<Record<string, string>>(savedResponse?.answers ?? {});

  useEffect(() => {
    setAnswers(savedResponse?.answers ?? {});
  }, [savedResponse, step.id]);

  if (pageContract.interactionKind === 'none') {
    return null;
  }

  const disabled = !released || (pageContract.teacherControls.openBrowse === 'teacher_toggle' && !browseEnabled && revealProgress === 0);
  const submit = () => {
    onSubmit({
      stepId: step.id,
      submittedAt: Date.now(),
      answers,
    });
  };

  return (
    <SurfaceCard title="学生作答区">
      <SubmissionStatus
        submitted={Boolean(savedResponse)}
        submittedText="已提交当前页面作答。"
        idleText={disabled ? '等待教师发放或开放浏览后再提交。' : '提交后会同步到教师端汇总。'}
      />

      {step.id === 'step-01' || step.id === 'step-14' ? (
        <div className="space-y-3">
          {(step.id === 'step-01' ? STEP_01_QUESTIONS : STEP_14_QUESTIONS).map((question) => (
            <div key={question.key} className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4">
              <div className="premium-lesson-title text-sm font-medium">{question.prompt}</div>
              <div className="mt-3 space-y-2">
                {question.options.map((option) => (
                  <label key={option} className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name={question.key}
                      checked={answers[question.key] === option}
                      disabled={disabled}
                      onChange={() => setAnswers((current) => ({ ...current, [question.key]: option }))}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              {answerVisible ? <div className="premium-lesson-muted mt-3 text-sm">参考答案：{question.answer}</div> : null}
            </div>
          ))}
        </div>
      ) : null}

      {step.id === 'step-03' ? (
        <div className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4">
          <div className="premium-lesson-title text-sm font-medium">当前观察更适合走哪一路分流？</div>
          <div className="mt-3 space-y-2">
            {STEP_03_OPTIONS.map((option) => (
              <label key={option} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="branch-choice"
                  checked={answers['branch-choice'] === option}
                  disabled={disabled}
                  onChange={() => setAnswers((current) => ({ ...current, 'branch-choice': option }))}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
          {answerVisible ? <div className="premium-lesson-muted mt-3 text-sm">参考答案：进入哪一路分流，必须和表 1 的当前观察一一对应。</div> : null}
        </div>
      ) : null}

      {ACTIVITY_CARD_FIELDS[step.id] ? (
        <div className="grid gap-3 md:grid-cols-2">
          {ACTIVITY_CARD_FIELDS[step.id].map((field) => (
            <TextareaCard
              key={field.key}
              title={field.title}
              value={answers[field.key] ?? ''}
              onChange={(value) => setAnswers((current) => ({ ...current, [field.key]: value }))}
              placeholder={field.placeholder}
              half
            />
          ))}
        </div>
      ) : null}

      {step.id === 'step-12' ? (
        <div className="grid gap-3">
          {WORKSPACE_FIELDS.map((field) => (
            <TextareaCard
              key={field.key}
              title={field.title}
              value={answers[field.key] ?? ''}
              onChange={(value) => setAnswers((current) => ({ ...current, [field.key]: value }))}
              placeholder={field.placeholder}
            />
          ))}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button type="button" disabled={disabled} onClick={submit} className="premium-lesson-action-primary">
          提交答案
        </button>
      </div>
    </SurfaceCard>
  );
}

export function UNIT_4_3StudentSummaryPanel({
  responses,
}: {
  responses: Record<string, UNIT_4_3StepResponse>;
}) {
  const completedCount = Object.keys(responses).length;
  return (
    <SurfaceCard title="第一版方案学习收束">
      <div className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4 text-sm leading-6">
        已完成 {completedCount} 个步骤的作答记录。请把对象分析、结构分流、参数方向、首轮验证与问题清单一起带到 4-4。
      </div>
    </SurfaceCard>
  );
}

export function UNIT_4_3TeacherActivitySummary({
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
  step: UNIT_4_3StepDefinition;
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
  return (
    <SurfaceCard title="教师汇总与控制">
      <div className="grid gap-3 md:grid-cols-2">
        <button type="button" onClick={onToggleRelease} className="premium-lesson-action-secondary">
          {released ? '收起作答' : '发放作答'}
        </button>
        <button type="button" onClick={onToggleBrowse} className="premium-lesson-action-secondary">
          {browseEnabled ? '关闭浏览' : '开放浏览'}
        </button>
        <button type="button" onClick={onToggleAnswerVisible} className="premium-lesson-action-secondary">
          {answerVisible ? '隐藏参考答案' : '显示参考答案'}
        </button>
        {step.pageType === 'worked_example_reveal' ? (
          <div className="flex gap-2">
            <button type="button" onClick={onAdvanceReveal} className="premium-lesson-action-secondary flex-1">
              教师逐步显影 +1
            </button>
            <button type="button" onClick={onResetReveal} className="premium-lesson-action-secondary flex-1">
              重置显影
            </button>
          </div>
        ) : null}
      </div>
      <div className="premium-lesson-muted text-sm">当前显影层级：{revealProgress}</div>
      <div className="premium-lesson-surface-elevated rounded-3xl border border-white/10 p-4">
        <div className="premium-lesson-title text-sm font-medium">学生提交概览</div>
        <div className="premium-lesson-muted mt-2 text-sm">当前页已收到 {responses.length} 份提交。</div>
        <div className="mt-3 space-y-2">
          {responses.length ? (
            responses.map((item) => (
              <div key={`${step.id}-${item.studentName}`} className="rounded-2xl border border-white/10 px-3 py-2 text-sm">
                <div className="font-medium">{item.studentName}</div>
                <div className="mt-1 text-slate-300">{Object.values(item.response.answers).filter(Boolean).join(' / ') || '已提交空白内容'}</div>
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-300">当前尚无学生提交。</div>
          )}
        </div>
      </div>
    </SurfaceCard>
  );
}
