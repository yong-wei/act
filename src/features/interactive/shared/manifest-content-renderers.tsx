'use client';

import Image from 'next/image';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import type {
  InteractiveModuleRegistry,
  InteractiveRuntimeStepManifest,
} from './interactive-manifest-renderer';

type ContentRecord = Record<string, unknown>;
type TableCell = string | { kind: 'math'; value: string };

function asRecord(value: unknown): ContentRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ContentRecord) : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function normalizeMath(value: string) {
  return value
    .trim()
    .replace(/^\$/, '')
    .replace(/\$$/, '')
    .replace(/\\\\/g, '\\');
}

function renderInlineContent(text: string) {
  const parts = text.split(/(\$[^$]+\$)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith('$') && part.endsWith('$')) {
      return <InlineMath key={`${part}-${index}`} math={normalizeMath(part)} />;
    }
    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

function renderTableCell(cell: TableCell) {
  if (typeof cell === 'string') return renderInlineContent(cell);
  return <InlineMath math={normalizeMath(cell.value)} />;
}

function titleFromId(id: string) {
  const labels: Record<string, string> = {
    'plant-card': '客船对象',
    'recovered-solution-card': '4-5 固定超前可用解',
    'problem-focus': '问题聚焦',
    'mismatch-figure': '驱逐舰失配证据',
    'figure-reading-cue': '读图口令',
    'bridge-conclusion': '本页结论',
    'objective-header': '本次课程目标',
    'objective-list': '完成这轮迁移判断后应能做到',
    'objective-bridge': '主线桥接',
    'migration-formula': '迁移判断式',
    'scenario-compare-table': '场景配置对比表',
    'priority-summary': '优先判断',
    'legacy-weight-card': '客船平衡权重',
    'legacy-objective-card': '沿用旧总代价',
    'mismatch-reveal': '三类失配信号',
    'mismatch-conclusion': '结论',
    'legacy-objective': '客船总代价',
    'destroyer-objective': '驱逐舰专用代价函数',
    'metric-duty-table': '五项职责表',
    'objective-summary': '目标重排结论',
    'overload-chain': '固定结构职责过载链',
    'search-condition-reveal': '结构搜索引入条件',
    'candidate-structures': '五类候选结构',
    'entry-conclusion': '入口判断',
    'encoding-formula': '统一编码定义',
    'structure-codebook': '五类结构码本',
    'decode-reveal': '解码显影链',
    'scheme-matrix': '四类方案矩阵',
    'comparison-figure': '四类方案主比较图',
    'question-table': '问题矩阵表',
    'comparison-reveal': '比较结论',
    'comparison-conclusion': '比较页结论',
    'convergence-figure': '结构搜索收敛证据',
    'probe-figure': '组合结构专项验证',
    'control-formulas': '组合控制器表达式',
    'control-effects-figure': '控制效果曲线',
    'boundary-reveal': '边界判断',
    'posttest-header': '阶段后测',
    'posttest-note': '提交说明',
    'summary-list': '五条总结',
    'main-chain': '本课主线链条',
    'next-step-card': '4-7 去向',
  };
  return labels[id] ?? id.replace(/-/g, ' ');
}

function getFormulaItems(step: InteractiveRuntimeStepManifest, moduleId: string) {
  const blocks = step.contentBlocks;
  const formulas = asStringArray(blocks.key_formulas);
  const items: string[] = [];

  if (moduleId === 'plant-card' && formulas[0]) items.push(formulas[0]);
  if (moduleId === 'recovered-solution-card' && formulas[1]) items.push(formulas[1]);
  if (moduleId === 'legacy-weight-card' && formulas[0]) items.push(formulas[0]);
  if (moduleId === 'legacy-objective-card' && formulas[1]) items.push(formulas[1]);
  if (moduleId === 'migration-formula') items.push(String(asRecord(blocks.migration_formula).latex ?? ''));
  if (moduleId === 'legacy-objective') {
    items.push('$J_p(\\theta)=0.30\\bar t_s+0.30\\overline{\\mathrm{ITAE}}+0.20\\overline{\\mathrm{ITSE}}+0.20\\bar E_u$');
  }
  if (moduleId === 'destroyer-objective') items.push(String(asRecord(blocks.destroyer_objective).latex ?? ''));
  if (moduleId === 'overload-chain') items.push(String(asRecord(blocks.overload_chain).latex ?? ''));
  if (moduleId === 'encoding-formula') items.push(...asStringArray(asRecord(blocks.encoding_formula).latex));
  if (moduleId === 'control-formulas') items.push(...asStringArray(asRecord(blocks.control_formulas).latex));

  return items.filter(Boolean);
}

function getImageSrc(step: InteractiveRuntimeStepManifest, moduleId: string) {
  const keyByModule: Record<string, string> = {
    'mismatch-figure': 'mismatch_figure',
    'comparison-figure': 'comparison_figure',
    'convergence-figure': 'convergence_figure',
    'probe-figure': 'probe_figure',
    'control-effects-figure': 'control_effects_figure',
  };
  const key = keyByModule[moduleId];
  if (!key) return null;
  return String(asRecord(step.contentBlocks[key]).runtime_media ?? '') || null;
}

function tableFor(step: InteractiveRuntimeStepManifest, moduleId: string) {
  if (moduleId === 'scenario-compare-table') {
    const source = asRecord(step.contentBlocks.scenario_table);
    return {
      columns: asStringArray(source.columns),
      rows: [
        ['对象模型', '客船航向保持对象', '驱逐舰快速机动对象'],
        ['任务语义', '稳定、平顺、能量协调', '快速转向、航迹贴合、动作边界并列检查'],
        ['参考轨迹', '相对平缓的航向保持输入', '连续快速机动的方波与航迹约束'],
        ['动作筛选线', '控制峰值和能量作为综合复核', '峰值动作与控制能量分开筛选'],
        ['优先判断', '先看综合可接受性', '先判断目标是否对题，再判断结构是否够用'],
      ],
    };
  }
  if (moduleId === 'metric-duty-table') {
    const source = asRecord(step.contentBlocks.metric_duty_table);
    return {
      columns: asStringArray(source.columns),
      rows: [
        ['切换段误差', '回答快速机动初段能否跟上。'],
        ['全程跟踪误差', '回答全程航向偏差是否被持续压低。'],
        ['航迹偏离', '回答船是否真正走到位。'],
        ['峰值动作', '回答执行机构瞬时动作是否越界。'],
        ['控制能量', '回答持续动作代价是否可接受。'],
      ],
    };
  }
  if (moduleId === 'structure-codebook') {
    const source = asRecord(step.contentBlocks.codebook_table);
    return {
      columns: asStringArray(source.columns),
      rows: [
        ['PI', '$z_1,z_2$', '$z_3,z_4,z_5$', '比例增益与积分时间常数'],
        ['超前', '$z_1,z_2,z_3$', '$z_4,z_5$', '增益、时间常数与超前系数'],
        ['PI + 超前', '$z_1,z_2,z_3,z_4$', '$z_5$', '低频消差与中频提速共同生效'],
        ['滞后 + 超前', '$z_1,z_2,z_3,z_4,z_5$', '无', '低频修正与相位提升同时编码'],
        ['带微分滤波的 PID', '$z_1,z_2,z_3,z_4$', '$z_5$', '比例、积分、微分与滤波常数'],
      ],
    };
  }
  if (moduleId === 'question-table') {
    const source = asRecord(step.contentBlocks.question_table);
    return {
      columns: asStringArray(source.columns),
      rows: [
        ['旧目标 + 旧结构', '目标和结构都沿用客船语言', '直接暴露目标错位和拖尾。'],
        ['旧目标 + 变结构', '只放开结构', '检查结构搜索是否能弥补错误目标。'],
        ['新目标 + 旧结构', '只改写比较对象', '检查固定结构的边界是否仍在。'],
        ['新目标 + 变结构', '目标与结构同时打开', '检查可用域是否重新打开。'],
      ],
    };
  }
  return null;
}

function revealItems(moduleId: string) {
  const items: Record<string, string[]> = {
    'mismatch-reveal': [
      '客船语言把首段收敛和总体能量看得比连续快速机动更重。',
      '固定超前结构只有三项有效参数，低频恢复、中频提速和动作边界只能互相挤占。',
      '当验证换成“方波跟踪 + 航迹积分”后，旧写法的缺口被持续放大。',
    ],
    'search-condition-reveal': [
      '固定结构已无法同时解释速度收益、动作边界和稳健性余量。',
      '同一组参数同时承担低频、中频和高频职责。',
      '继续调参只会在同一小块可用域里交换代价。',
    ],
    'decode-reveal': [
      '先根据 $z_0$ 判结构编号。',
      '再列出有效槽位与忽略槽位。',
      '最后把有效槽位映射回工程参数。',
    ],
    'comparison-reveal': [
      '旧目标 + 旧结构：直接暴露目标错位。',
      '旧目标 + 变结构：只放开结构无法弥补错误目标。',
      '新目标 + 旧结构 / 新目标 + 变结构：进一步暴露结构边界与重新打开的可用域。',
    ],
    'boundary-reveal': [
      '收敛图只说明搜索会把结果推向哪一类结构家族。',
      '组合结构候选虽然总代价更低，但前馈与测速反馈最终收缩成零增益。',
      '只要筛选线没有写成真正硬约束，优化器就会继续沿总代价允许的方向下降。',
    ],
  };
  return items[moduleId] ?? [];
}

function summaryContent(step: InteractiveRuntimeStepManifest, moduleId: string) {
  const blocks = step.contentBlocks;
  const map: Record<string, { text?: string; bullets?: string[] }> = {
    'problem-focus': {
      text: '同一对象族进入驱逐舰快速机动任务后，为什么“继续微调参数”已经不足以描述问题。',
    },
    'figure-reading-cue': {
      text: '左图看方波切换段拖尾，右图看航迹偏离如何被积分放大。',
    },
    'bridge-conclusion': {
      text: '本课不是先换算法，而是先检查原来的问题写法为什么失效。',
    },
    'objective-header': { text: '完成这轮迁移判断后，我们应能做到什么。' },
    'objective-list': { bullets: asStringArray(asRecord(blocks.objective_list).bullets) },
    'objective-bridge': { text: '本课承接 4-5 的固定结构可用解，正式把结构边界显性化。' },
    'priority-summary': {
      text: '驱逐舰不是“更快一点的客船”，而是对象、参考和筛选线同时改写后的新任务。',
    },
    'mismatch-conclusion': {
      text: '这里暴露的不是某一组参数偶然失败，而是固定超前结构和旧判断链一起迁移后已经不再对题。',
    },
    'objective-summary': {
      text: '驱逐舰场景改写的不是一组权重，而是整张比较对象清单。',
    },
    'candidate-structures': { bullets: asStringArray(asRecord(blocks.candidate_structures).bullets) },
    'entry-conclusion': {
      text: '引入结构搜索不是因为算法更复杂，而是因为固定结构已经不能完整承接当前任务。',
    },
    'scheme-matrix': {
      bullets: [
        '驱逐舰采用客船代价函数但是固定结构。',
        '驱逐舰采用客船代价函数但是变结构搜索。',
        '驱逐舰采用专用代价函数但是固定结构。',
        '驱逐舰采用专用代价函数和变结构搜索。',
      ],
    },
    'comparison-conclusion': {
      text: '四类方案存在的意义，是把“目标是否对题”和“结构是否够用”拆开，而不是只给出一个看起来最好的结果。',
    },
    'posttest-header': { text: String(asRecord(blocks.posttest_header).text ?? '') },
    'posttest-note': { text: String(asRecord(blocks.posttest_note).text ?? '') },
    'summary-list': { bullets: asStringArray(asRecord(blocks.summary_list).bullets) },
    'main-chain': { text: String(asRecord(blocks.main_chain).text ?? '') },
    'next-step-card': {
      text: '4-7 将把结构编码、目标函数、约束建立和结果解释并入完整工程设计闭环。',
    },
  };
  return map[moduleId] ?? { text: step.evidenceSequence.join(' -> ') };
}

function FormulaCard({ title, formulas }: { title: string; formulas: string[] }) {
  return (
    <div className="premium-lesson-panel">
      <div className="premium-lesson-kicker">{title}</div>
      <div className="mt-3 space-y-2 overflow-x-auto">
        {formulas.map((formula) => (
          <BlockMath key={formula} math={normalizeMath(formula)} />
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ title, text, bullets }: { title: string; text?: string; bullets?: string[] }) {
  return (
    <div className="premium-lesson-panel">
      <div className="premium-lesson-kicker">{title}</div>
      {text ? <p className="premium-lesson-title mt-2 text-sm leading-7">{renderInlineContent(text)}</p> : null}
      {bullets?.length ? (
        <ul className="premium-lesson-muted mt-3 space-y-2 text-sm leading-7">
          {bullets.map((bullet) => (
            <li key={bullet} className="ml-5 list-disc">{renderInlineContent(bullet)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function NativeTable({ title, columns, rows }: { title: string; columns: string[]; rows: TableCell[][] }) {
  return (
    <div className="premium-lesson-panel overflow-hidden">
      <div className="premium-lesson-kicker">{title}</div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-700">
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 font-semibold">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row[0]}-${index}`} className="border-b border-slate-100">
                {row.map((cell, cellIndex) => (
                  <td key={`${row[0]}-${cellIndex}`} className="px-3 py-3 align-top leading-7">
                    {renderTableCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImagePanel({ title, src }: { title: string; src: string }) {
  return (
    <div className="premium-lesson-panel">
      <div className="premium-lesson-kicker">{title}</div>
      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <Image src={src} alt={title} width={1600} height={960} className="h-auto w-full" />
      </div>
    </div>
  );
}

function StepReveal({
  title,
  items,
  revealProgress,
  allowInlineReveal,
}: {
  title: string;
  items: string[];
  revealProgress: number;
  allowInlineReveal: boolean;
}) {
  const teacherVisibleCount = Math.min(items.length, Math.max(1, revealProgress + 1));
  const [localVisibleCount, setLocalVisibleCount] = useState(teacherVisibleCount);

  useEffect(() => {
    setLocalVisibleCount(teacherVisibleCount);
  }, [teacherVisibleCount, title]);

  const visibleCount = Math.min(items.length, Math.max(teacherVisibleCount, localVisibleCount));

  return (
    <div className="premium-lesson-panel">
      <div className="premium-lesson-kicker">{title}</div>
      <div className="mt-3 space-y-3">
        {items.slice(0, visibleCount).map((item, index) => {
          const canExpand = allowInlineReveal && index === visibleCount - 1 && visibleCount < items.length;
          return (
            <button
              key={item}
              type="button"
              onClick={() => {
                if (canExpand) setLocalVisibleCount((prev) => Math.min(items.length, prev + 1));
              }}
              className={`block w-full rounded-2xl border px-4 py-3 text-left ${
                canExpand ? 'border-cyan-200 bg-cyan-50 hover:border-cyan-300' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="premium-lesson-kicker">第 {index + 1} 层</div>
              <p className="premium-lesson-title mt-1 text-sm leading-7">{renderInlineContent(item)}</p>
              {canExpand ? <p className="premium-lesson-muted mt-2 text-xs">点击当前最下方步骤继续显示下一层。</p> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function createManifestContentModuleRegistry(extra: {
  revealProgress: number;
  allowInlineReveal: boolean;
}): InteractiveModuleRegistry<typeof extra> {
  return {
    'formula-card': ({ step, module }) => (
      <FormulaCard title={titleFromId(module.id)} formulas={getFormulaItems(step, module.id)} />
    ),
    'summary-card': ({ step, module }) => {
      const content = summaryContent(step, module.id);
      return <SummaryCard title={titleFromId(module.id)} text={content.text} bullets={content.bullets} />;
    },
    'native-table': ({ step, module }) => {
      const table = tableFor(step, module.id);
      if (!table) return null;
      return <NativeTable title={titleFromId(module.id)} columns={table.columns} rows={table.rows} />;
    },
    'image-panel': ({ step, module }) => {
      const src = getImageSrc(step, module.id);
      if (!src) return null;
      return <ImagePanel title={titleFromId(module.id)} src={src} />;
    },
    'step-reveal': ({ module, extra: renderExtra }) => {
      const items = revealItems(module.id);
      if (!items.length) return null;
      return (
        <StepReveal
          title={titleFromId(module.id)}
          items={items}
          revealProgress={renderExtra.revealProgress}
          allowInlineReveal={renderExtra.allowInlineReveal}
        />
      );
    },
  };
}
