'use client';

import Image from 'next/image';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import type {
  InteractiveModuleRegistry,
  InteractiveRuntimeModuleManifest,
  InteractiveRuntimeStepManifest,
} from './layout-renderer';

type ContentRecord = Record<string, unknown>;
type TableCell = string | { kind: 'math'; value: string };
type NativeTableData = { columns: string[]; rows: TableCell[][] };

function asRecord(value: unknown): ContentRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ContentRecord) : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function asTableRows(value: unknown): TableCell[][] {
  if (!Array.isArray(value)) return [];
  const rows: TableCell[][] = [];
  for (const row of value) {
    if (!Array.isArray(row)) continue;
    rows.push(
      row.map((cell) => {
        if (cell && typeof cell === 'object' && !Array.isArray(cell)) {
          const record = cell as ContentRecord;
          if (record.kind === 'math') {
            return { kind: 'math', value: String(record.value ?? '') };
          }
        }
        return String(cell);
      }),
    );
  }
  return rows;
}

function tableFromBlock(block: unknown): NativeTableData | null {
  const source = asRecord(block);
  const columns = asStringArray(source.columns);
  const rows = asTableRows(source.rows);
  if (!columns.length || !rows.length) return null;
  return { columns, rows };
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

function titleFromModule(module: InteractiveRuntimeModuleManifest) {
  const title = module.title ?? module.payload.title;
  if (typeof title === 'string' && title.trim()) return title;
  return module.id.replace(/-/g, ' ');
}

function blockFor(step: InteractiveRuntimeStepManifest, payload: ContentRecord) {
  const key = payload.block_key ?? payload.blockKey ?? payload.formula_key ?? payload.formulaKey ?? payload.image_key ?? payload.imageKey;
  return typeof key === 'string' && key ? step.contentBlocks[key] : undefined;
}

function valueAtField(source: unknown, field: unknown) {
  if (typeof field !== 'string' || !field) return source;
  return asRecord(source)[field];
}

function getFormulaItems(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const payload = module.payload;
  const direct = payload.formula ?? payload.formulas;
  const source = direct ?? valueAtField(blockFor(step, payload), payload.field ?? 'latex');
  const items = asStringArray(source);
  if (typeof source === 'string') items.push(source);

  if (typeof payload.formula_index === 'number') {
    return items[payload.formula_index] ? [items[payload.formula_index]] : [];
  }
  if (typeof payload.formulaIndex === 'number') {
    return items[payload.formulaIndex] ? [items[payload.formulaIndex]] : [];
  }

  return items.filter(Boolean);
}

function getImageSrc(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const payload = module.payload;
  const direct = typeof payload.src === 'string' ? payload.src : undefined;
  if (direct?.trim()) return direct;
  const field = payload.field ?? 'runtime_media';
  const value = valueAtField(blockFor(step, payload), field);
  return typeof value === 'string' && value.trim() ? value : null;
}

function tableFor(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest): NativeTableData | null {
  const payloadTable = tableFromBlock(module.payload);
  if (payloadTable) return payloadTable;
  return tableFromBlock(blockFor(step, module.payload));
}

function revealItems(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const payload = module.payload;
  const directItems = asStringArray(payload.items);
  if (directItems.length) return directItems;
  const block = asRecord(blockFor(step, payload));
  return asStringArray(block.items ?? block.steps ?? block.bullets);
}

function summaryContent(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const payload = module.payload;
  const block = asRecord(blockFor(step, payload));
  const field = typeof payload.field === 'string' ? payload.field : 'text';
  const bulletsKey = typeof payload.bullets_key === 'string'
    ? payload.bullets_key
    : typeof payload.bulletsKey === 'string'
      ? payload.bulletsKey
      : 'bullets';
  const text = typeof payload.text === 'string'
    ? payload.text
    : typeof block[field] === 'string'
      ? String(block[field])
      : typeof block.text === 'string'
        ? block.text
        : undefined;
  const bullets = asStringArray(payload.bullets).length
    ? asStringArray(payload.bullets)
    : asStringArray(block[bulletsKey] ?? block.bullets);
  return { text, bullets };
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
      <FormulaCard title={titleFromModule(module)} formulas={getFormulaItems(step, module)} />
    ),
    'summary-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'native-table': ({ step, module }) => {
      const table = tableFor(step, module);
      if (!table) return null;
      return <NativeTable title={titleFromModule(module)} columns={table.columns} rows={table.rows} />;
    },
    'image-panel': ({ step, module }) => {
      const src = getImageSrc(step, module);
      if (!src) return null;
      return <ImagePanel title={titleFromModule(module)} src={src} />;
    },
    'step-reveal': ({ step, module, extra: renderExtra }) => {
      const items = revealItems(step, module);
      if (!items.length) return null;
      return (
        <StepReveal
          title={titleFromModule(module)}
          items={items}
          revealProgress={renderExtra.revealProgress}
          allowInlineReveal={renderExtra.allowInlineReveal}
        />
      );
    },
  };
}
