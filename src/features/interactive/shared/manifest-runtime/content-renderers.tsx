'use client';

import Image from 'next/image';
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import type {
  InteractiveModuleRegistry,
  InteractiveRuntimeManifest,
  InteractiveRuntimeModuleManifest,
  InteractiveRuntimeStepManifest,
} from './layout-renderer';

type ContentRecord = Record<string, unknown>;
type TableCell = string | { kind: 'math'; value: string };
type NativeTableData = { columns: string[]; rows: TableCell[][] };
type RevealItem = { body: string; formula?: string; title?: string };
type FormulaSymbol = { symbol: string; meaning: string };

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

function keyValueFormulaTableFromBlock(block: unknown): NativeTableData | null {
  const source = asRecord(block);
  const entries = Object.entries(source)
    .filter(([, value]) => typeof value === 'string' && value.trim())
    .map(([key, value]) => [key, String(value)] as TableCell[]);
  if (!entries.length) return null;
  return { columns: ['对象', '公式'], rows: entries };
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
  const hasLatexCommand = /\\[a-zA-Z]+/.test(value);
  const isBareMathExpression = !inlineMatches.length && (hasLatexCommand || !/[\u4e00-\u9fff]/.test(value));

  if (isSingleMathExpression || isBareMathExpression) {
    return <BlockMath math={normalizeMath(value)} />;
  }

  return <p className="premium-lesson-title text-sm leading-7">{renderInlineContent(value)}</p>;
}

const MODULE_KIND_TITLE: Record<string, string> = {
  'bullet-list-card': '要点',
  'comparison-graphic': '图示',
  'formula-card': '公式',
  'formula-card-row': '公式',
  'goal-card-row': '本次课程目标',
  'image-panel': '图示',
  'interactive-figure-panel': '互动图形',
  'learning-stat-panel': '课堂表现统计',
  'performance-summary': '课堂表现统计',
  'native-formula-table': '公式表',
  'native-table': '表格',
  'problem-statement': '题面',
  'reveal-chain': '推导步骤',
  'stat-panel': '课堂表现统计',
  'step-reveal': '推导步骤',
  'step-reveal-chain': '推导步骤',
  'summary-card': '要点',
  'summary-card-grid': '要点',
};

function titleFromModule(module: InteractiveRuntimeModuleManifest) {
  const title = module.title ?? module.payload.title ?? module.payload.caption;
  if (typeof title === 'string' && title.trim()) return title;
  return MODULE_KIND_TITLE[module.kind] ?? '学习内容';
}

function uniqueStrings(items: string[]) {
  const result: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (trimmed && !result.includes(trimmed)) result.push(trimmed);
  }
  return result;
}

function textFieldsFromPayload(payload: ContentRecord, fields: string[]) {
  return uniqueStrings(
    fields
      .map((field) => payload[field])
      .filter((item): item is string => typeof item === 'string' && Boolean(item.trim())),
  );
}

function ManifestContentTitle({ children }: { children: ReactNode }) {
  return (
    <div className="premium-lesson-title text-base font-semibold leading-7 tracking-normal">
      {typeof children === 'string' ? renderInlineContent(children) : children}
    </div>
  );
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

function formulaItemsFromSource(source: unknown): string[] {
  const directItems = asStringArray(source);
  if (typeof source === 'string') directItems.push(source);
  const record = asRecord(source);
  directItems.push(
    ...asStringArray(record.items),
    ...asStringArray(record.formulas),
    ...asStringArray(record.latex),
    ...asStringArray(record.math),
    ...asStringArray(record.values),
  );
  for (const key of ['formula', 'latex', 'math'] as const) {
    const value = record[key];
    if (typeof value === 'string') directItems.push(value);
  }
  return uniqueStrings(directItems);
}

function getFormulaItems(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const payload = module.payload;
  const direct = payload.formula ?? payload.formulas;
  const keyedBlock = blockFor(step, payload);
  const fallbackBlock = asRecord(blockByKey(step, 'formula_block'));
  const moduleBlock = blockByModuleId(step, module);
  const keyFormulas = asStringArray(step.contentBlocks.key_formulas);
  const formulaModuleIndex = moduleIndexByKind(step, module, ['formula-card']);
  const requestedField = Object.prototype.hasOwnProperty.call(payload, 'field') ? payload.field : 'latex';
  const source = direct
    ?? valueAtField(keyedBlock, requestedField)
    ?? valueAtField(keyedBlock, 'formula')
    ?? valueAtField(keyedBlock, 'formulas')
    ?? valueAtField(keyedBlock, 'latex')
    ?? valueAtField(keyedBlock, 'math')
    ?? valueAtField(keyedBlock, 'items')
    ?? keyedBlock
    ?? valueAtField(moduleBlock, requestedField)
    ?? valueAtField(moduleBlock, 'formula')
    ?? valueAtField(moduleBlock, 'latex')
    ?? valueAtField(moduleBlock, 'math')
    ?? valueAtField(moduleBlock, 'formulas')
    ?? valueAtField(moduleBlock, 'items')
    ?? moduleBlock
    ?? payload.text
    ?? (
      formulaModuleIndex >= 0 && keyFormulas[formulaModuleIndex] !== undefined
        ? keyFormulas[formulaModuleIndex]
        : undefined
    )
    ?? [fallbackBlock.object, fallbackBlock.controller, fallbackBlock.controller_form].filter(Boolean);
  const items = formulaItemsFromSource(source);

  if (typeof payload.formula_index === 'number') {
    return items[payload.formula_index] ? [items[payload.formula_index]] : [];
  }
  if (typeof payload.formulaIndex === 'number') {
    return items[payload.formulaIndex] ? [items[payload.formulaIndex]] : [];
  }

  return items.filter(Boolean);
}

function formulaNotes(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const hasExplicitFormula = Boolean(module.payload.formula ?? module.payload.formulas);
  const keyedBlock = asRecord(blockFor(step, module.payload));
  const moduleBlock = asRecord(blockByModuleId(step, module));
  const blockNotes = textFieldsFromPayload(keyedBlock, ['body', 'note', 'explanation', 'text'])
    .concat(textFieldsFromPayload(moduleBlock, ['body', 'note', 'explanation', 'text']));
  return textFieldsFromPayload(
    module.payload,
    hasExplicitFormula ? ['body', 'text', 'note', 'explanation'] : ['body', 'note', 'explanation'],
  ).concat(blockNotes);
}

function formulaSymbolFromValue(value: unknown): FormulaSymbol | null {
  if (typeof value === 'string' && value.trim()) return { symbol: value, meaning: '' };
  const record = asRecord(value);
  const symbol = [record.symbol, record.latex, record.math, record.name, record.value]
    .find((item): item is string => typeof item === 'string' && Boolean(item.trim()));
  if (!symbol) return null;
  const meaning = [record.meaning, record.description, record.text, record.explanation, record.note]
    .find((item): item is string => typeof item === 'string' && Boolean(item.trim())) ?? '';
  return { symbol, meaning };
}

function formulaSymbols(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const sources = [
    module.payload.symbols,
    asRecord(blockFor(step, module.payload)).symbols,
    asRecord(blockByModuleId(step, module)).symbols,
  ];
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    const symbols = source
      .map(formulaSymbolFromValue)
      .filter((item): item is FormulaSymbol => Boolean(item));
    if (symbols.length) return symbols;
  }
  return [];
}

function runtimeMediaPath(manifest: InteractiveRuntimeManifest, path: string) {
  if (path.startsWith('/')) return path;
  return `/course-runtime/lessons/${manifest.lessonId}/media/${path}`;
}

function mediaPathFromBlock(value: unknown, imageIndex: number, imageCount: number) {
  const record = asRecord(value);
  const direct = record.runtime_media ?? record.runtimeMedia ?? record.path ?? record.src ?? record.asset;
  if (typeof direct === 'string' && direct.trim()) return direct;

  const items = Array.isArray(record.assets)
    ? record.assets
    : Array.isArray(record.items)
      ? record.items
      : Array.isArray(value)
        ? value
        : [];
  if (items.length) {
    const selected = items.length === imageCount ? items[imageIndex] : items[0];
    if (typeof selected === 'string' && selected.trim()) return selected;
    const selectedRecord = asRecord(selected);
    const selectedPath = selectedRecord.runtime_media ?? selectedRecord.runtimeMedia ?? selectedRecord.path ?? selectedRecord.src ?? selectedRecord.asset;
    if (typeof selectedPath === 'string' && selectedPath.trim()) return selectedPath;
  }
  return null;
}

function getImageSrc(
  manifest: InteractiveRuntimeManifest,
  step: InteractiveRuntimeStepManifest,
  module: InteractiveRuntimeModuleManifest,
) {
  const payload = module.payload;
  const direct = [payload.src, payload.path, payload.runtime_media, payload.runtimeMedia, payload.fallback_image, payload.fallbackImage]
    .find((item): item is string => typeof item === 'string' && Boolean(item.trim()));
  if (direct?.trim()) return runtimeMediaPath(manifest, direct);
  const { index, count } = imageModulePosition(step, module);
  const imageIndex = Math.max(0, index);
  const field = payload.field ?? 'runtime_media';
  const value = valueAtField(blockFor(step, payload), field);
  if (typeof value === 'string' && value.trim()) return value;
  const blockMediaPath = mediaPathFromBlock(blockFor(step, payload) ?? blockByModuleId(step, module), imageIndex, count);
  if (blockMediaPath) return runtimeMediaPath(manifest, blockMediaPath);

  const mediaItems = Object.values(step.contentBlocks).flatMap((block) => {
    const record = asRecord(block);
    if (typeof record.runtime_media === 'string') return [record.runtime_media];
    if (typeof record.path === 'string') return [runtimeMediaPath(manifest, record.path)];
    if (typeof record.asset === 'string') return [runtimeMediaPath(manifest, record.asset)];
    if (Array.isArray(block)) {
      return block
        .map((item) => asRecord(item).runtime_media ?? asRecord(item).asset)
        .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
    }
    return [];
  });
  return mediaItems[imageIndex] ?? mediaItems[0] ?? null;
}

function imageModulePosition(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const modules = step.modules.filter((item) => ['content.figure', 'image-panel', 'comparison-graphic', 'interactive-figure-panel', 'media-card'].includes(item.kind));
  return {
    index: modules.findIndex((item) => item.id === module.id),
    count: modules.length,
  };
}

function imageItemsFromPayload(manifest: InteractiveRuntimeManifest, payload: ContentRecord) {
  const items = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.assets)
      ? payload.assets
      : Array.isArray(payload.fallback_images)
        ? payload.fallback_images
        : Array.isArray(payload.fallbackImages)
          ? payload.fallbackImages
          : [];
  return items
    .map((item) => {
      if (typeof item === 'string') {
        return { src: runtimeMediaPath(manifest, item), caption: '' };
      }
      const record = asRecord(item);
      const path = [record.path, record.src, record.runtime_media, record.runtimeMedia, record.asset]
        .find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
      if (!path) return null;
      const caption = [record.caption, record.explanation, record.note]
        .find((value): value is string => typeof value === 'string' && Boolean(value.trim())) ?? '';
      return { src: runtimeMediaPath(manifest, path), caption };
    })
    .filter((item): item is { src: string; caption: string } => Boolean(item));
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
  const keyedFormulaTable = keyValueFormulaTableFromBlock(blockFor(step, module.payload));
  if (keyedFormulaTable) return keyedFormulaTable;

  const tables = Object.values(step.contentBlocks)
    .map(tableFromBlock)
    .filter((table): table is NativeTableData => Boolean(table));
  const tableModuleIndex = step.modules
    .filter((item) => item.kind === 'native-table' || item.kind === 'native-formula-table' || item.kind === 'table-card')
    .findIndex((item) => item.id === module.id);
  return tables[tableModuleIndex] ?? firstBlockWithTable(step);
}

function revealItemFromValue(value: unknown): RevealItem | null {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return { body: String(value) };
  }
  const record = asRecord(value);
  const body = record.body ?? record.text ?? record.prompt ?? record.explanation ?? record.note ?? record.value;
  const formula = record.formula ?? record.latex ?? record.math;
  const title = record.title ?? record.label ?? record.name;
  if (typeof body !== 'string' && typeof formula !== 'string') return null;
  return {
    body: typeof body === 'string' ? body : '',
    formula: typeof formula === 'string' ? formula : undefined,
    title: typeof title === 'string' ? title : undefined,
  };
}

function revealItemsFromValue(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map(revealItemFromValue)
    .filter((item): item is RevealItem => Boolean(item));
}

function revealItems(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest): RevealItem[] {
  const payload = module.payload;
  const directItems = revealItemsFromValue(payload.items);
  if (directItems.length) return directItems;
  const rawBlock = blockFor(step, payload) ?? blockByModuleId(step, module);
  const rawBlockItems = revealItemsFromValue(rawBlock);
  if (rawBlockItems.length) return rawBlockItems;
  const block = asRecord(rawBlock);
  const items = revealItemsFromValue(block.items ?? block.steps ?? block.layers ?? block.bullets);
  if (items.length) return items;
  const revealLayers = step.contentBlocks.reveal_layers ?? step.contentBlocks.reveal_steps;
  const layerItems = revealItemsFromValue(revealLayers);
  if (layerItems.length) return layerItems;
  return listFromRecordItems(revealLayers).map((body) => ({ body }));
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
        : typeof block.body === 'string'
          ? block.body
          : typeof block.lead === 'string'
            ? block.lead
            : undefined;
  const recordItems = listFromRecordItems(rawBlock);
  const sectionItems = listFromRecordItems(block.sections);
  const rawArrayItems = Array.isArray(rawBlock) ? asStringArray([...rawBlock]) : [];
  const bullets = asStringArray(payload.bullets).length
    ? asStringArray(payload.bullets)
    : recordItems.length
      ? recordItems
    : sectionItems.length
      ? sectionItems
    : rawArrayItems.length
      ? rawArrayItems
    : asStringArray(
      block[bulletsKey]
        ?? block.items
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
    const value = block.text ?? block.lead ?? block.note ?? block.task ?? block.explanation ?? block.body;
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

function cardGridItems(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const payloadItems = asStringArray(module.payload.items);
  if (payloadItems.length) return payloadItems;
  const rawBlock = blockFor(step, module.payload) ?? blockByModuleId(step, module);
  const block = asRecord(rawBlock);
  const fromItems = asStringArray(block.items);
  if (fromItems.length) return fromItems;
  const recordItems = listFromRecordItems(rawBlock);
  if (recordItems.length) return recordItems;
  const content = summaryContent(step, module);
  return [content.text, ...content.bullets].filter((item): item is string => Boolean(item));
}

function learningStatItems(step: InteractiveRuntimeStepManifest, module: InteractiveRuntimeModuleManifest) {
  const block = asRecord(blockFor(step, module.payload) ?? blockByModuleId(step, module));
  const studentFields = asStringArray(block.student_fields ?? block.studentFields);
  const teacherFields = asStringArray(block.teacher_fields ?? block.teacherFields);
  const studentItems = asStringArray(block.student);
  const teacherItems = asStringArray(block.teacher);
  const genericFields = asStringArray(block.fields);
  const items: string[] = [];
  if (studentFields.length) items.push(`学生端：${studentFields.join('、')}`);
  if (teacherFields.length) items.push(`教师端：${teacherFields.join('、')}`);
  if (studentItems.length) items.push(`学生端：${studentItems.join('、')}`);
  if (teacherItems.length) items.push(`教师端：${teacherItems.join('、')}`);
  if (!items.length) items.push(...genericFields);
  return items;
}

function FormulaSymbolList({ symbols }: { symbols: FormulaSymbol[] }) {
  if (!symbols.length) return null;
  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50/70 p-3 text-sm leading-7">
      <div className="premium-lesson-title font-semibold">符号说明</div>
      <dl className="mt-2 grid gap-2 md:grid-cols-2">
        {symbols.map((item) => (
          <div key={`${item.symbol}-${item.meaning}`} className="flex gap-2">
            <dt className="shrink-0">
              <InlineMath math={normalizeMath(item.symbol)} />
            </dt>
            {item.meaning ? <dd className="premium-lesson-muted">{renderInlineContent(item.meaning)}</dd> : null}
          </div>
        ))}
      </dl>
    </div>
  );
}

function FormulaCard({
  title,
  formulas,
  notes,
  symbols = [],
}: {
  title: string;
  formulas: string[];
  notes?: string[];
  symbols?: FormulaSymbol[];
}) {
  if (!formulas.length) return null;
  const noteBlock = notes?.length ? (
    <div className="premium-lesson-muted mt-2 space-y-2 text-sm leading-7">
      {notes.map((note) => (
        <p key={note}>{renderInlineContent(note)}</p>
      ))}
    </div>
  ) : null;
  const formulaBlock = (
    <div className="mt-3 space-y-2 overflow-x-auto">
      {formulas.map((formula) => (
        <Fragment key={formula}>{renderFormulaContent(formula)}</Fragment>
      ))}
    </div>
  );
  return (
    <div className="premium-lesson-panel">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      {symbols.length ? formulaBlock : noteBlock}
      {symbols.length ? <FormulaSymbolList symbols={symbols} /> : null}
      {symbols.length ? noteBlock : formulaBlock}
    </div>
  );
}

function SummaryCard({ title, text, bullets }: { title: string; text?: string; bullets?: string[] }) {
  if (!text && !bullets?.length) return null;
  return (
    <div className="premium-lesson-panel">
      <ManifestContentTitle>{title}</ManifestContentTitle>
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
      <ManifestContentTitle>{title}</ManifestContentTitle>
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

function CourseObjectiveList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="premium-lesson-panel">
      <ManifestContentTitle>完成本次课程后，学习者能够</ManifestContentTitle>
      <ol className="premium-lesson-muted mt-3 space-y-3">
        {items.map((item, index) => (
          <li key={item} className="flex gap-3">
            <span className="premium-lesson-caption shrink-0 font-semibold">{index + 1}.</span>
            <span>{renderInlineContent(item)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PathStageMap({ title, lead, items }: { title: string; lead?: string; items: string[] }) {
  return (
    <div className="premium-lesson-panel">
      <ManifestContentTitle>{title}</ManifestContentTitle>
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
  const notes = [block.text, block.body, block.prompt, block.note, block.task, block.given_condition, block.explanation]
    .filter(Boolean)
    .map((item) => String(item));
  const goals = asStringArray(block.goals ?? block.requirements);

  if (!formulas.length && !notes.length && !goals.length) return null;

  return (
    <div className="premium-lesson-panel">
      <ManifestContentTitle>{title}</ManifestContentTitle>
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

function NativeTable({
  title,
  columns,
  rows,
  notes,
}: {
  title: string;
  columns: string[];
  rows: TableCell[][];
  notes?: string[];
}) {
  return (
    <div className="premium-lesson-panel overflow-hidden">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      {notes?.length ? (
        <div className="premium-lesson-muted mt-2 space-y-2 text-sm leading-7">
          {notes.map((note) => (
            <p key={note}>{renderInlineContent(note)}</p>
          ))}
        </div>
      ) : null}
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
      <ManifestContentTitle>{title}</ManifestContentTitle>
      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <Image src={src} alt={title} width={1600} height={960} className="h-auto w-full" unoptimized />
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

function ImageGallery({ title, items }: { title: string; items: Array<{ src: string; caption: string }> }) {
  if (!items.length) return null;
  return (
    <div className="premium-lesson-panel">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.src} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <Image src={item.src} alt={item.caption || title} width={1600} height={960} className="h-auto w-full" unoptimized />
            {item.caption ? (
              <p className="premium-lesson-muted border-t border-slate-100 px-3 py-2 text-sm leading-6">
                {renderInlineContent(item.caption)}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepReveal({
  title,
  items,
  revealProgress,
  allowInlineReveal,
  onInlineReveal,
}: {
  title: string;
  items: RevealItem[];
  revealProgress: number;
  allowInlineReveal: boolean;
  onInlineReveal?: () => void;
}) {
  const teacherVisibleCount = Math.min(items.length, Math.max(1, revealProgress + 1));
  const [localVisibleCount, setLocalVisibleCount] = useState(teacherVisibleCount);

  useEffect(() => {
    setLocalVisibleCount(teacherVisibleCount);
  }, [teacherVisibleCount, title]);

  const visibleCount = onInlineReveal
    ? teacherVisibleCount
    : Math.min(items.length, Math.max(teacherVisibleCount, localVisibleCount));

  return (
    <div className="premium-lesson-panel">
      <ManifestContentTitle>{title}</ManifestContentTitle>
      <div className="mt-3 space-y-3" data-progressive-reveal="step_click_reveal">
        {items.slice(0, visibleCount).map((item, index) => {
          const canExpand = allowInlineReveal && index === visibleCount - 1 && visibleCount < items.length;
          const showNext = () => {
            if (!canExpand) return;
            if (onInlineReveal) {
              onInlineReveal?.();
              return;
            }
            setLocalVisibleCount((prev) => Math.min(items.length, prev + 1));
          };
          return (
            <div
              key={`${item.title ?? ''}:${item.body}:${item.formula ?? ''}`}
              role={canExpand ? 'button' : undefined}
              tabIndex={canExpand ? 0 : undefined}
              onClick={showNext}
              onKeyDown={(event) => {
                if (!canExpand || (event.key !== 'Enter' && event.key !== ' ')) return;
                event.preventDefault();
                showNext();
              }}
              className={`block w-full rounded-2xl border px-4 py-3 text-left ${
                canExpand ? 'cursor-pointer border-cyan-200 bg-cyan-50 hover:border-cyan-300' : 'border-slate-200 bg-slate-50'
              }`}
            >
              {item.title ? <ManifestContentTitle>{item.title}</ManifestContentTitle> : null}
              {item.body ? (
                <p className="premium-lesson-title text-sm leading-7">{renderInlineContent(item.body)}</p>
              ) : null}
              {item.formula ? <div className="mt-2 overflow-x-auto">{renderFormulaContent(item.formula)}</div> : null}
              {canExpand ? <p className="premium-lesson-muted mt-2 text-xs">点击当前最下方步骤继续显示下一层。</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function createManifestContentModuleRegistry(extra: {
  revealProgress: number;
  allowInlineReveal: boolean;
  onInlineReveal?: () => void;
}): InteractiveModuleRegistry<typeof extra> {
  return {
    'content.rich': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'content.cardSet': ({ step, module }) => {
      const items = cardGridItems(step, module);
      if (items.length) return <CardGrid title={titleFromModule(module)} items={items} />;
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'content.formula': ({ step, module }) => (
      <FormulaCard
        title={titleFromModule(module)}
        formulas={getFormulaItems(step, module)}
        notes={formulaNotes(step, module)}
        symbols={formulaSymbols(step, module)}
      />
    ),
    'content.table': ({ step, module }) => {
      const table = tableFor(step, module);
      if (table) return <NativeTable title={titleFromModule(module)} columns={table.columns} rows={table.rows} notes={textFieldsFromPayload(module.payload, ['text', 'note', 'explanation'])} />;
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'content.figure': ({ manifest, step, module }) => {
      const galleryItems = imageItemsFromPayload(manifest, module.payload);
      if (galleryItems.length > 1) return <ImageGallery title={titleFromModule(module)} items={galleryItems} />;
      if (galleryItems.length === 1) {
        const [item] = galleryItems;
        const notes = [item.caption, ...imageNotes(step, module)].filter((value) => value.trim());
        return <ImagePanel title={titleFromModule(module)} src={item.src} notes={notes} />;
      }
      const src = getImageSrc(manifest, step, module);
      if (src) return <ImagePanel title={titleFromModule(module)} src={src} notes={imageNotes(step, module)} />;
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'content.reveal': ({ step, module, extra: renderExtra }) => {
      const items = revealItems(step, module);
      if (items.length) {
        return (
          <StepReveal
            title={titleFromModule(module)}
            items={items}
            revealProgress={renderExtra.revealProgress}
            allowInlineReveal={renderExtra.allowInlineReveal}
            onInlineReveal={renderExtra.onInlineReveal}
          />
        );
      }
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'content.stageMap': ({ step, module }) => {
      const intro = asRecord(step.contentBlocks.page_intro);
      const title = typeof intro.title === 'string' ? intro.title : titleFromModule(module);
      const lead = typeof intro.lead === 'string' ? intro.lead : summaryContent(step, module).text;
      const payloadItems = asStringArray(module.payload.items ?? module.payload.path_items ?? module.payload.pathItems);
      const items = payloadItems.length ? payloadItems : asStringArray(intro.path_items ?? step.contentBlocks.path_items);
      if (items.length) return <PathStageMap title={title} lead={lead} items={items} />;
      const content = summaryContent(step, module);
      return <SummaryCard title={title} text={content.text} bullets={content.bullets} />;
    },
    'compute.panel': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'analytics.summary': ({ step, module }) => (
      <CardGrid title={titleFromModule(module)} items={learningStatItems(step, module)} columns="md:grid-cols-2" />
    ),
    'layout.support': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'stage-map': ({ step }) => {
      const intro = asRecord(step.contentBlocks.page_intro);
      const title = typeof intro.title === 'string' ? intro.title : '路径定位';
      const lead = typeof intro.lead === 'string' ? intro.lead : undefined;
      const items = asStringArray(intro.path_items ?? step.contentBlocks.path_items);
      return <PathStageMap title={title} lead={lead} items={items} />;
    },
    'goal-card-row': ({ step, module }) => {
      const payloadItems = asStringArray(module.payload.items ?? module.payload.goals ?? module.payload.requirements);
      const rawBlock = blockFor(step, module.payload);
      const block = asRecord(rawBlock);
      const arrayBlockItems = Array.isArray(rawBlock) ? asStringArray([...rawBlock]) : [];
      const blockItems = arrayBlockItems.length ? arrayBlockItems : asStringArray(block.items ?? block.goals ?? block.requirements);
      const items = payloadItems.length ? payloadItems : blockItems.length ? blockItems : listFromKnownBlocks(step, ['goal_cards']);
      return <CourseObjectiveList items={items} />;
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
      <FormulaCard
        title={titleFromModule(module)}
        formulas={getFormulaItems(step, module)}
        notes={formulaNotes(step, module)}
        symbols={formulaSymbols(step, module)}
      />
    ),
    'formula-card-row': ({ step, module }) => (
      <FormulaCard
        title={titleFromModule(module)}
        formulas={getFormulaItems(step, module)}
        notes={formulaNotes(step, module)}
        symbols={formulaSymbols(step, module)}
      />
    ),
    'formula-chain': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'summary-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'summary-card-row': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <CardGrid title={titleFromModule(module)} items={[content.text, ...content.bullets].filter(Boolean) as string[]} columns="md:grid-cols-2" />;
    },
    'summary-card-grid': ({ step, module }) => (
      <CardGrid title={titleFromModule(module)} items={cardGridItems(step, module)} columns="md:grid-cols-2" />
    ),
    'question-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'question-card-row': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <CardGrid title={titleFromModule(module)} items={[content.text, ...content.bullets].filter(Boolean) as string[]} />;
    },
    'boundary-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'process-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'objective-list': ({ step, module }) => {
      const content = summaryContent(step, module);
      const items = content.bullets.length
        ? content.bullets
        : [content.text].filter((item): item is string => Boolean(item));
      return <CourseObjectiveList items={items} />;
    },
    'bullet-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'reason-record': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'notice-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'comparison-table': ({ step, module }) => {
      const table = tableFor(step, module);
      if (table) return <NativeTable title={titleFromModule(module)} columns={table.columns} rows={table.rows} notes={textFieldsFromPayload(module.payload, ['text', 'note', 'explanation'])} />;
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'structured-compare': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'row-focus-toggle': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'tab-selector': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'overlay-strip': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'graphic': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'interactive-figure': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'interactive-figure-panel': ({ manifest, step, module }) => {
      const galleryItems = imageItemsFromPayload(manifest, module.payload);
      if (galleryItems.length > 1) return <ImageGallery title={titleFromModule(module)} items={galleryItems} />;
      const src = getImageSrc(manifest, step, module);
      if (src) return <ImagePanel title={titleFromModule(module)} src={src} notes={imageNotes(step, module)} />;
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'rule-card-row': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <CardGrid title={titleFromModule(module)} items={[content.text, ...content.bullets].filter(Boolean) as string[]} />;
    },
    'card-bank': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <CardGrid title={titleFromModule(module)} items={[content.text, ...content.bullets].filter(Boolean) as string[]} />;
    },
    'evidence-bank': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <CardGrid title={titleFromModule(module)} items={[content.text, ...content.bullets].filter(Boolean) as string[]} columns="grid-cols-1" />;
    },
    'example-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'worked-example-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'condition-list': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'reference-answer-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'comparison-graphic': ({ manifest, step, module }) => {
      const src = getImageSrc(manifest, step, module);
      if (src) return <ImagePanel title={titleFromModule(module)} src={src} notes={imageNotes(step, module)} />;
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'band-focus-panel': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'ai-compare-workspace': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'revision-note': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'case-context-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'metric-strip': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <CardGrid title={titleFromModule(module)} items={[content.text, ...content.bullets].filter(Boolean) as string[]} columns="md:grid-cols-4" />;
    },
    'teacher-strip': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'next-step-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'reflection-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'key-task-card': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'next-step-card-row': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <CardGrid title={titleFromModule(module)} items={[content.text, ...content.bullets].filter(Boolean) as string[]} columns="md:grid-cols-3" />;
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
      return <NativeTable title={titleFromModule(module)} columns={table.columns} rows={table.rows} notes={textFieldsFromPayload(module.payload, ['text', 'note', 'explanation'])} />;
    },
    'native-formula-table': ({ step, module }) => {
      const table = tableFor(step, module);
      if (!table) return null;
      return <NativeTable title={titleFromModule(module)} columns={table.columns} rows={table.rows} notes={textFieldsFromPayload(module.payload, ['text', 'note', 'explanation'])} />;
    },
    'table-card': ({ step, module }) => {
      const table = tableFor(step, module);
      if (!table) return null;
      return <NativeTable title={titleFromModule(module)} columns={table.columns} rows={table.rows} notes={textFieldsFromPayload(module.payload, ['text', 'note', 'explanation'])} />;
    },
    'template-card': ({ step, module }) => {
      const block = blockFor(step, module.payload) ?? blockByModuleId(step, module);
      const source = valueAtField(block, module.payload.field);
      const items = asStringArray(module.payload.items).length
        ? asStringArray(module.payload.items)
        : asStringArray(source).length
          ? asStringArray(source)
          : listFromRecordItems(source);
      return <CardGrid title={titleFromModule(module)} items={items} columns="grid-cols-1" />;
    },
    'image-panel': ({ manifest, step, module }) => {
      const src = getImageSrc(manifest, step, module);
      if (!src) return null;
      return <ImagePanel title={titleFromModule(module)} src={src} notes={imageNotes(step, module)} />;
    },
    'figure': ({ manifest, step, module }) => {
      const src = getImageSrc(manifest, step, module);
      if (!src) return null;
      return <ImagePanel title={titleFromModule(module)} src={src} notes={imageNotes(step, module)} />;
    },
    'media-card': ({ manifest, step, module }) => {
      const src = getImageSrc(manifest, step, module);
      if (src) return <ImagePanel title={titleFromModule(module)} src={src} notes={imageNotes(step, module)} />;
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'native-figure': ({ step, module }) => {
      const block = asRecord(blockFor(step, module.payload) ?? blockByModuleId(step, module));
      const caption = typeof block.caption === 'string' ? block.caption : titleFromModule(module);
      const conclusion = typeof block.conclusion === 'string' ? block.conclusion : undefined;
      const source = typeof block.source === 'string' ? `图源：${block.source}` : undefined;
      return <SummaryCard title={caption} text={conclusion ?? source} bullets={conclusion && source ? [source] : []} />;
    },
    'figure-note': ({ step, module }) => {
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
    'rust-analysis-panel': ({ module }) => (
      <SummaryCard
        title={titleFromModule(module)}
        text={typeof module.payload.text === 'string' ? module.payload.text : undefined}
        bullets={asStringArray(module.payload.items)}
      />
    ),
    'rust-time-compare-panel': ({ module }) => (
      <SummaryCard
        title={titleFromModule(module)}
        text={typeof module.payload.text === 'string' ? module.payload.text : undefined}
        bullets={asStringArray(module.payload.items)}
      />
    ),
    'rust-bode-compare-panel': ({ module }) => (
      <SummaryCard
        title={titleFromModule(module)}
        text={typeof module.payload.text === 'string' ? module.payload.text : undefined}
        bullets={asStringArray(module.payload.items)}
      />
    ),
    'stat-panel': ({ step, module }) => {
      const block = asRecord(blockFor(step, module.payload) ?? blockByModuleId(step, module));
      const fields = asStringArray(block.fields);
      const bullets = asStringArray(block.bullets);
      const note = typeof block.note === 'string' ? block.note : undefined;
      return <SummaryCard title={titleFromModule(module)} text={note} bullets={[...fields, ...bullets]} />;
    },
    'learning-stat-panel': ({ step, module }) => (
      <CardGrid title={titleFromModule(module)} items={learningStatItems(step, module)} columns="md:grid-cols-2" />
    ),
    'performance-summary': ({ step, module }) => (
      <CardGrid title={titleFromModule(module)} items={learningStatItems(step, module)} columns="md:grid-cols-2" />
    ),
    'problem-statement': ({ step, module }) => {
      const rawBlock = blockFor(step, module.payload)
        ?? blockByKey(step, 'problem_statement')
          ?? blockByKey(step, 'fixed_problem')
          ?? blockByKey(step, 'formula_block')
          ?? module.payload;
      const block = typeof rawBlock === 'string' ? { text: rawBlock } : asRecord(rawBlock);
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
          onInlineReveal={renderExtra.onInlineReveal}
        />
      );
    },
    'reveal-chain': ({ step, module, extra: renderExtra }) => {
      const items = revealItems(step, module);
      if (!items.length) return null;
      return (
        <StepReveal
          title={titleFromModule(module)}
          items={items}
          revealProgress={renderExtra.revealProgress}
          allowInlineReveal={renderExtra.allowInlineReveal}
          onInlineReveal={renderExtra.onInlineReveal}
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
          onInlineReveal={renderExtra.onInlineReveal}
        />
      );
    },
    'step-reveal-column': ({ step, module, extra: renderExtra }) => {
      const items = revealItems(step, module);
      if (items.length) {
        return (
          <StepReveal
            title={titleFromModule(module)}
            items={items}
            revealProgress={renderExtra.revealProgress}
            allowInlineReveal={renderExtra.allowInlineReveal}
            onInlineReveal={renderExtra.onInlineReveal}
          />
        );
      }
      const content = summaryContent(step, module);
      return <SummaryCard title={titleFromModule(module)} text={content.text} bullets={content.bullets} />;
    },
  };
}
