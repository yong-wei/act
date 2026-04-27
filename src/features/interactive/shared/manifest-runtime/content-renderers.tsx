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
  return value
    .filter((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')
    .map((item) => String(item));
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

function renderFormulaContent(formula: string) {
  const value = formula.trim();
  const inlineMatches = value.match(/\$[^$]+\$/g) ?? [];
  const nonMathText = value.replace(/\$[^$]+\$/g, '').trim();
  const isSingleMathExpression = inlineMatches.length === 1 && !nonMathText;
  const isBareMathExpression = !inlineMatches.length && !/[\u4e00-\u9fff]/.test(value);

  if (isSingleMathExpression || isBareMathExpression) {
    return <BlockMath math={normalizeMath(value)} />;
  }

  return <p className="premium-lesson-title text-sm leading-7">{renderInlineContent(value)}</p>;
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

function blockByKey(step: InteractiveRuntimeStepManifest, key: string) {
  return step.contentBlocks[key];
}

function blockByModuleId(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const normalizedId = module.id.replace(/-/g, '_');
  const candidates = [
    normalizedId,
    normalizedId.replace(/_card$/, ''),
    normalizedId.replace(/_cards$/, ''),
    normalizedId.replace(/_list$/, '_list'),
    normalizedId.replace(/_figure$/, '_figure'),
    normalizedId.replace(/_reading$/, '_reading'),
  ];
  const parts = normalizedId.split('_').filter(Boolean);
  if (parts.length > 1) {
    candidates.push(parts.slice(-2).join('_'));
    candidates.push(parts[parts.length - 1]);
  }
  if (normalizedId.includes('conclusion')) {
    candidates.push('conclusion', 'structure_conclusion', 'delivery_judgment');
  }
  if (normalizedId.includes('reading') && normalizedId.includes('prompt')) candidates.push('reading_prompt');
  if (normalizedId.includes('prompt')) candidates.push('prompt');
  if (normalizedId.includes('criteria')) candidates.push('criteria');
  if (normalizedId.includes('setting')) candidates.push('search_settings');
  if (normalizedId.includes('family') || normalizedId.includes('structure')) candidates.push('structures', 'structure_code_fields');
  if (normalizedId.includes('frontier') || normalizedId.includes('method')) candidates.push('frontier_methods');
  if (normalizedId.includes('limitation')) candidates.push('limitations');
  if (normalizedId.includes('header')) candidates.push('header');
  if (normalizedId.includes('explanation')) candidates.push('figure_explanation', 'formula_explanation');
  for (const key of candidates) {
    const block = blockByKey(step, key);
    if (block !== undefined) return block;
  }
  return undefined;
}

function moduleIndexByKind(
  step: InteractiveRuntimeStepManifest,
  module: InteractiveRuntimeModuleManifest,
  kinds: string[],
) {
  return step.modules
    .filter((item) => kinds.includes(item.kind))
    .findIndex((item) => item.id === module.id);
}

function firstBlockWithTable(step: InteractiveRuntimeStepManifest) {
  for (const value of Object.values(step.contentBlocks)) {
    const table = tableFromBlock(value);
    if (table) return table;
  }
  return null;
}

function valueAtField(source: unknown, field: unknown) {
  if (typeof field !== 'string' || !field) return source;
  return asRecord(source)[field];
}

function getFormulaItems(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const payload = module.payload;
  const direct = payload.formula ?? payload.formulas;
  const fallbackBlock = asRecord(blockByKey(step, 'formula_block'));
  const moduleBlock = blockByModuleId(step, module);
  const keyFormulas = asStringArray(step.contentBlocks.key_formulas);
  const formulaModuleIndex = moduleIndexByKind(step, module, ['formula-card']);
  const requestedField = Object.prototype.hasOwnProperty.call(payload, 'field') ? payload.field : 'latex';
  const source = direct
    ?? valueAtField(blockFor(step, payload), requestedField)
    ?? valueAtField(moduleBlock, requestedField)
    ?? valueAtField(moduleBlock, 'formulas')
    ?? (
      formulaModuleIndex >= 0 && keyFormulas[formulaModuleIndex] !== undefined
        ? keyFormulas[formulaModuleIndex]
        : undefined
    )
    ?? [fallbackBlock.object, fallbackBlock.controller, fallbackBlock.controller_form].filter(Boolean);
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
  if (typeof value === 'string' && value.trim()) return value;

  const mediaItems = Object.values(step.contentBlocks).flatMap((block) => {
    const record = asRecord(block);
    if (typeof record.runtime_media === 'string') return [record.runtime_media];
    if (Array.isArray(block)) {
      return block
        .map((item) => asRecord(item).runtime_media)
        .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
    }
    return [];
  });
  const imageModuleIndex = step.modules
    .filter((item) => item.kind === 'image-panel')
    .findIndex((item) => item.id === module.id);
  return mediaItems[imageModuleIndex] ?? mediaItems[0] ?? null;
}

function imageModulePosition(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const modules = step.modules.filter((item) => item.kind === 'image-panel');
  return {
    index: modules.findIndex((item) => item.id === module.id),
    count: modules.length,
  };
}

function textFromRecord(value: unknown) {
  const record = asRecord(value);
  return [
    record.caption,
    record.explanation,
    record.note,
    record.conclusion,
    record.source ? `图源：${record.source}` : undefined,
  ]
    .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
}

function imageNotesFromValue(value: unknown, imageIndex: number, imageCount: number): string[] {
  if (typeof value === 'string' && value.trim()) return [value];

  if (Array.isArray(value)) {
    const indexed = value[imageIndex];
    if (value.length === imageCount && indexed !== undefined) {
      if (typeof indexed === 'string') return indexed.trim() ? [indexed] : [];
      const indexedRecordItems = listFromRecordItems([indexed]);
      return indexedRecordItems.length ? indexedRecordItems : textFromRecord(indexed);
    }
    if (imageCount === 1) {
      const arrayItems = asStringArray(value).filter(Boolean);
      if (arrayItems.length) return arrayItems;
      return listFromRecordItems(value);
    }
  }

  return textFromRecord(value);
}

function imageNotes(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const { index, count } = imageModulePosition(step, module);
  const imageIndex = Math.max(0, index);
  const notes: string[] = [];
  const payloadNotes = imageNotesFromValue(
    module.payload.caption ?? module.payload.explanation ?? module.payload.note,
    imageIndex,
    count,
  );
  notes.push(...payloadNotes);

  const block = blockFor(step, module.payload) ?? blockByModuleId(step, module);
  notes.push(...imageNotesFromValue(block, imageIndex, count));

  const media = step.contentBlocks.media;
  if (Array.isArray(media)) {
    notes.push(...imageNotesFromValue(media[imageIndex], imageIndex, count));
  } else {
    notes.push(...textFromRecord(media));
  }

  for (const key of [
    'figure_explanations',
    'figure_explanation',
    'figure_reading',
    'figure_requirements',
    'parameter_explanation',
    'formula_explanation',
  ]) {
    notes.push(...imageNotesFromValue(step.contentBlocks[key], imageIndex, count));
  }

  const uniqueNotes: string[] = [];
  for (const note of notes) {
    if (note && !uniqueNotes.includes(note)) uniqueNotes.push(note);
  }
  return uniqueNotes;
}

function tableFor(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest): NativeTableData | null {
  const payloadTable = tableFromBlock(module.payload);
  if (payloadTable) return payloadTable;
  const keyedTable = tableFromBlock(blockFor(step, module.payload));
  if (keyedTable) return keyedTable;

  const tables = Object.values(step.contentBlocks)
    .map(tableFromBlock)
    .filter((table): table is NativeTableData => Boolean(table));
  const tableModuleIndex = step.modules
    .filter((item) => item.kind === 'native-table' || item.kind === 'native-formula-table' || item.kind === 'table-card')
    .findIndex((item) => item.id === module.id);
  return tables[tableModuleIndex] ?? firstBlockWithTable(step);
}

function revealItems(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const payload = module.payload;
  const directItems = asStringArray(payload.items);
  if (directItems.length) return directItems;
  const block = asRecord(blockFor(step, payload) ?? blockByModuleId(step, module));
  const items = asStringArray(block.items ?? block.steps ?? block.bullets);
  return items.length ? items : asStringArray(step.contentBlocks.reveal_layers);
}

function summaryContent(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const payload = module.payload;
  const rawBlock = blockFor(step, payload) ?? blockByModuleId(step, module);
  const block = asRecord(rawBlock);
  const field = typeof payload.field === 'string' ? payload.field : 'text';
  const bulletsKey = typeof payload.bullets_key === 'string'
    ? payload.bullets_key
    : typeof payload.bulletsKey === 'string'
      ? payload.bulletsKey
      : 'bullets';
  const text = typeof payload.text === 'string'
    ? payload.text
    : typeof rawBlock === 'string'
      ? rawBlock
    : typeof block[field] === 'string'
      ? String(block[field])
      : typeof block.text === 'string'
        ? block.text
        : undefined;
  const recordItems = listFromRecordItems(rawBlock);
  const rawArrayItems = Array.isArray(rawBlock) ? asStringArray([...rawBlock]) : [];
  const bullets = asStringArray(payload.bullets).length
    ? asStringArray(payload.bullets)
    : recordItems.length
      ? recordItems
    : rawArrayItems.length
      ? rawArrayItems
    : asStringArray(
      block[bulletsKey]
        ?? block.bullets
        ?? step.contentBlocks.takeaways
        ?? step.contentBlocks.goal_cards
        ?? step.contentBlocks.target_constraints,
    );
  return { text, bullets };
}

function listFromRecordItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = asRecord(item);
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') return String(item);
      const title = typeof record.title === 'string' ? record.title : '';
      const name = typeof record.name === 'string' ? record.name : '';
      const label = typeof record.label === 'string' ? record.label : '';
      const domain = typeof record.domain === 'string' ? record.domain : '';
      const caption = typeof record.caption === 'string' ? record.caption : '';
      const heading = title || name || label || domain || caption;
      const explanation = typeof record.explanation === 'string' ? record.explanation : '';
      const note = typeof record.note === 'string' ? record.note : '';
      const body = typeof record.body === 'string' ? record.body : '';
      const prompt = typeof record.prompt === 'string' ? record.prompt : '';
      const value = typeof record.value === 'string' ? record.value : '';
      const detail = explanation || note || body || prompt || value;
      return [heading, detail].filter(Boolean).join('：');
    })
    .filter(Boolean);
}

function stringFromKnownBlocks(step: InteractiveRuntimeStepManifest, keys: string[]) {
  for (const key of keys) {
    const block = asRecord(blockByKey(step, key));
    const value = block.text ?? block.lead ?? block.note ?? block.task ?? block.explanation;
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

function listFromKnownBlocks(step: InteractiveRuntimeStepManifest, keys: string[]) {
  for (const key of keys) {
    const value = blockByKey(step, key);
    const items = asStringArray(value);
    if (items.length) return items;
    const block = asRecord(value);
    const fields = asStringArray(block.fields ?? block.items ?? block.goals ?? block.requirements);
    if (fields.length) return fields;
  }
  return [];
}

function FormulaCard({ title, formulas }: { title: string; formulas: string[] }) {
  if (!formulas.length) return null;
  return (
    <div className="premium-lesson-panel">
      <div className="premium-lesson-kicker">{title}</div>
      <div className="mt-3 space-y-2 overflow-x-auto">
        {formulas.map((formula) => (
          <Fragment key={formula}>{renderFormulaContent(formula)}</Fragment>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ title, text, bullets }: { title: string; text?: string; bullets?: string[] }) {
  if (!text && !bullets?.length) return null;
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

function CardGrid({ title, items, columns = 'md:grid-cols-2' }: { title: string; items: string[]; columns?: string }) {
  if (!items.length) return null;
  return (
    <div className="premium-lesson-panel">
      <div className="premium-lesson-kicker">{title}</div>
      <div className={`mt-3 grid gap-3 ${columns}`}>
        {items.map((item) => (
          <div key={item} className="premium-lesson-surface-elevated rounded-2xl px-4 py-3 text-sm leading-7">
            {renderInlineContent(item)}
          </div>
        ))}
      </div>
    </div>
  );
}

function PathStageMap({ title, lead, items }: { title: string; lead?: string; items: string[] }) {
  return (
    <div className="premium-lesson-panel">
      <div className="premium-lesson-kicker">{title}</div>
      {items.length ? (
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
          {items.map((item, index) => (
            <Fragment key={item}>
              <div className="premium-lesson-surface-elevated rounded-2xl px-4 py-3 text-center text-sm font-semibold">
                {renderInlineContent(item)}
              </div>
              {index < items.length - 1 ? <div className="hidden items-center text-slate-500 md:flex">→</div> : null}
            </Fragment>
          ))}
        </div>
      ) : null}
      {lead ? <p className="premium-lesson-muted mt-3 text-sm leading-7">{renderInlineContent(lead)}</p> : null}
    </div>
  );
}

function ProblemStatement({ title, block }: { title: string; block: ContentRecord }) {
  const formulas = [block.object, block.controller, block.controller_form]
    .filter(Boolean)
    .map((item) => String(item));
  const notes = [block.note, block.task, block.given_condition, block.explanation]
    .filter(Boolean)
    .map((item) => String(item));
  const goals = asStringArray(block.goals ?? block.requirements);

  if (!formulas.length && !notes.length && !goals.length) return null;

  return (
    <div className="premium-lesson-panel">
      <div className="premium-lesson-kicker">{title}</div>
      {formulas.length ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {formulas.map((formula) => (
            <div key={formula} className="overflow-x-auto rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <BlockMath math={normalizeMath(formula)} />
            </div>
          ))}
        </div>
      ) : null}
      {notes.map((note) => (
        <p key={note} className="premium-lesson-muted mt-3 text-sm leading-7">{renderInlineContent(note)}</p>
      ))}
      {goals.length ? (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {goals.map((goal) => (
            <div key={goal} className="premium-lesson-surface-elevated rounded-2xl px-4 py-3 text-sm leading-7">
              {renderInlineContent(goal)}
            </div>
          ))}
        </div>
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
                <th key={column} className="px-3 py-2 font-semibold">{renderInlineContent(column)}</th>
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

function ImagePanel({ title, src, notes }: { title: string; src: string; notes: string[] }) {
  return (
    <div className="premium-lesson-panel">
      <div className="premium-lesson-kicker">{title}</div>
      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <Image src={src} alt={title} width={1600} height={960} className="h-auto w-full" />
      </div>
      {notes.length ? (
        <ul className="premium-lesson-muted mt-3 space-y-2 text-sm leading-7">
          {notes.map((note) => (
            <li key={note} className="ml-5 list-disc">{renderInlineContent(note)}</li>
          ))}
        </ul>
      ) : null}
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
    'stage-map': ({ step }) => {
      const intro = asRecord(step.contentBlocks.page_intro);
      const title = typeof intro.title === 'string' ? intro.title : '路径定位';
      const lead = typeof intro.lead === 'string' ? intro.lead : undefined;
      const items = asStringArray(intro.path_items ?? step.contentBlocks.path_items);
      return <PathStageMap title={title} lead={lead} items={items} />;
    },
    'goal-card-row': ({ step }) => {
      const items = listFromKnownBlocks(step, ['goal_cards']);
      return <CardGrid title="课程目标" items={items} />;
    },
    'goal-card-set': ({ step }) => {
      const items = listFromKnownBlocks(step, ['target_constraints', 'goal_cards']);
      return <CardGrid title="目标约束" items={items} columns="md:grid-cols-3" />;
    },
    'question-card-set': ({ step }) => {
      const items = listFromKnownBlocks(step, ['question_cards']);
      return <CardGrid title="问题组" items={items} />;
    },
    'formula-card': ({ step, module }) => (
      <FormulaCard title={titleFromModule(module)} formulas={getFormulaItems(step, module)} />
    ),
    'formula-card-row': ({ step, module }) => (
      <FormulaCard title={titleFromModule(module)} formulas={getFormulaItems(step, module)} />
    ),
    'summary-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'bullet-list-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'equation-card-row': ({ step, module }) => {
      const block = blockFor(step, module.payload) ?? blockByModuleId(step, module) ?? step.contentBlocks.target_cards;
      const items = listFromRecordItems(block);
      return <CardGrid title={titleFromModule(module)} items={items} columns="md:grid-cols-4" />;
    },
    'native-table': ({ step, module }) => {
      const table = tableFor(step, module);
      if (!table) return null;
      return <NativeTable title={titleFromModule(module)} columns={table.columns} rows={table.rows} />;
    },
    'native-formula-table': ({ step, module }) => {
      const table = tableFor(step, module);
      if (!table) return null;
      return <NativeTable title={titleFromModule(module)} columns={table.columns} rows={table.rows} />;
    },
    'table-card': ({ step, module }) => {
      const table = tableFor(step, module);
      if (!table) return null;
      return <NativeTable title={titleFromModule(module)} columns={table.columns} rows={table.rows} />;
    },
    'image-panel': ({ step, module }) => {
      const src = getImageSrc(step, module);
      if (!src) return null;
      return <ImagePanel title={titleFromModule(module)} src={src} notes={imageNotes(step, module)} />;
    },
    'native-figure': ({ step, module }) => {
      const block = asRecord(blockFor(step, module.payload) ?? blockByModuleId(step, module));
      const caption = typeof block.caption === 'string' ? block.caption : titleFromModule(module);
      const conclusion = typeof block.conclusion === 'string' ? block.conclusion : undefined;
      const source = typeof block.source === 'string' ? `图源：${block.source}` : undefined;
      return <SummaryCard title={caption} text={conclusion ?? source} bullets={conclusion && source ? [source] : []} />;
    },
    'stat-panel': ({ step, module }) => {
      const block = asRecord(blockFor(step, module.payload) ?? blockByModuleId(step, module));
      const fields = asStringArray(block.fields);
      const bullets = asStringArray(block.bullets);
      const note = typeof block.note === 'string' ? block.note : undefined;
      return <SummaryCard title={titleFromModule(module)} text={note} bullets={[...fields, ...bullets]} />;
    },
    'problem-statement': ({ step, module }) => {
      const block = asRecord(
        blockByKey(step, 'problem_statement')
          ?? blockByKey(step, 'fixed_problem')
          ?? blockByKey(step, 'formula_block')
          ?? module.payload,
      );
      return <ProblemStatement title={titleFromModule(module)} block={block} />;
    },
    'title-card': ({ step, module }) => {
      const text = stringFromKnownBlocks(step, ['post_quiz_title', 'page_intro']);
      return text ? <SummaryCard title={titleFromModule(module)} text={text} /> : null;
    },
    'quiz-stack': ({ step, module }) => {
      const items = listFromKnownBlocks(step, ['post_quiz_items']);
      return <CardGrid title={titleFromModule(module)} items={items} columns="grid-cols-1" />;
    },
    'route-card': ({ step, module }) => {
      const text = stringFromKnownBlocks(step, ['next_route']);
      return text ? <SummaryCard title={titleFromModule(module)} text={text} /> : null;
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
    'step-reveal-chain': ({ step, module, extra: renderExtra }) => {
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
