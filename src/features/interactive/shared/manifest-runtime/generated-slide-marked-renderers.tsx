'use client';

import { Fragment, useState, type ReactNode } from 'react';
import { BlockMath, InlineMath } from 'react-katex';

import type { InteractiveModuleRegistry } from './layout-renderer';
import type { GeneratedSlideManifest } from './generated-slide-contract';
import {
  generatedSlideFormulaMarkerId,
  generatedSlideRevealVisibleCount,
  generatedSlideTextMarkerId,
  isGeneratedSlideBareFormula,
  splitGeneratedSlideInlineContent,
} from './generated-slide-render-markers';

type RendererExtra = {
  revealProgress: number;
  allowInlineReveal: boolean;
  interactionMode?: 'active' | 'readonly';
};

export function createGeneratedSlideMarkedContentRegistry(
  manifest: GeneratedSlideManifest,
): InteractiveModuleRegistry<RendererExtra> {
  const modules = new Map(manifest.stages.flatMap((stage) => stage.steps)
    .flatMap((step) => step.modules).map((module) => [module.id, module]));
  const source = (moduleId: string) => {
    const module = modules.get(moduleId);
    if (!module) throw new Error(`generated-slide-marker-module-missing:${moduleId}`);
    return module;
  };
  return {
    'content.rich': ({ module }) => {
      const payload = source(module.id).payload;
      return <Panel title="内容">
        <MarkedInline moduleId={module.id} path="text" value={String(payload.text)} />
        {stringArray(payload.bullets).length ? <ul className="interactive-courseware-section interactive-courseware-body">
          {stringArray(payload.bullets).map((value, index) => <li key={index} className="ml-5 list-disc">
            <MarkedInline moduleId={module.id} path={`bullets.${index}`} value={value} />
          </li>)}
        </ul> : null}
      </Panel>;
    },
    'content.cardSet': ({ module }) => {
      const items = recordArray(source(module.id).payload.items);
      return <Panel title="卡片">
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {items.map((item, index) => <article key={index} className="premium-lesson-surface-elevated rounded-2xl px-4 py-3 interactive-courseware-body">
            <h3 className="interactive-courseware-title-level-3"><MarkedInline moduleId={module.id} path={`items.${index}.title`} value={String(item.title)} /></h3>
            <p><MarkedInline moduleId={module.id} path={`items.${index}.body`} value={String(item.body)} /></p>
          </article>)}
        </div>
      </Panel>;
    },
    'content.formula': ({ module }) => {
      const payload = source(module.id).payload;
      return <Panel title="公式">
        <div className="mt-3 space-y-2 overflow-x-auto">
          {stringArray(payload.formulas).map((value, index) => <MarkedFormulaContent key={index} moduleId={module.id} path={`formulas.${index}`} value={value} />)}
        </div>
        {stringArray(payload.notes).map((value, index) => <MarkedInline key={index} moduleId={module.id} path={`notes.${index}`} value={value} />)}
      </Panel>;
    },
    'content.table': ({ module }) => {
      const payload = source(module.id).payload;
      const columns = stringArray(payload.columns);
      const rows = array(payload.rows).map(array);
      return <Panel title="表格">
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left interactive-courseware-body">
            <thead><tr className="border-b border-platform-border">{columns.map((column, index) => <th key={index} className="px-3 py-2 font-semibold"><MarkedInline moduleId={module.id} path={`columns.${index}`} value={column} /></th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-platform-border-soft">
              {row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-3 align-top leading-7">
                {typeof cell === 'string'
                  ? <MarkedInline moduleId={module.id} path={`rows.${rowIndex}.${cellIndex}`} value={cell} />
                  : <FormulaMarker id={generatedSlideFormulaMarkerId(module.id, `rows.${rowIndex}.${cellIndex}`)} block={false} value={String(record(cell).value)} />}
              </td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </Panel>;
    },
    'content.code': ({ module }) => {
      const payload = source(module.id).payload;
      const language = String(payload.language);
      return <Panel title="代码">
        <span className="premium-lesson-chip" data-generated-slide-text-marker={generatedSlideTextMarkerId(module.id, 'language')}>{language.toUpperCase()}</span>
        <pre className="premium-code-block mt-3"><code data-generated-slide-text-marker={generatedSlideTextMarkerId(module.id, 'code')}>{String(payload.code)}</code></pre>
        {typeof payload.note === 'string' ? <MarkedInline moduleId={module.id} path="note" value={payload.note} /> : null}
      </Panel>;
    },
    'content.reveal': ({ module, extra }) => {
      const items = recordArray(source(module.id).payload.items);
      return <MarkedRevealPanel
        moduleId={module.id}
        items={items}
        revealProgress={extra.revealProgress}
        allowInlineReveal={extra.allowInlineReveal}
      />;
    },
  };
}

function MarkedRevealPanel({ moduleId, items, revealProgress, allowInlineReveal }: {
  moduleId: string;
  items: Record<string, unknown>[];
  revealProgress: number;
  allowInlineReveal: boolean;
}) {
  const progressVisibleCount = generatedSlideRevealVisibleCount(items.length, revealProgress);
  const [localVisibleCount, setLocalVisibleCount] = useState(progressVisibleCount);
  const visibleCount = Math.min(items.length, Math.max(progressVisibleCount, localVisibleCount));
  return <Panel title="逐步显示">
    <div className="mt-3 space-y-3" data-progressive-reveal="step_click_reveal">
      {items.slice(0, visibleCount).map((item, index) => {
        const canExpand = allowInlineReveal && index === visibleCount - 1 && visibleCount < items.length;
        const content = <>
          {typeof item.title === 'string' ? <h3 className="interactive-courseware-title-level-3"><MarkedInline moduleId={moduleId} path={`items.${index}.title`} value={item.title} /></h3> : null}
          <MarkedInline moduleId={moduleId} path={`items.${index}.body`} value={String(item.body)} />
          {typeof item.formula === 'string' ? <div className="mt-2 overflow-x-auto"><MarkedFormulaContent moduleId={moduleId} path={`items.${index}.formula`} value={item.formula} /></div> : null}
        </>;
        return canExpand
          ? <button type="button" key={index} className="block w-full rounded-2xl border px-4 py-3 text-left" onClick={() => setLocalVisibleCount((current) => Math.min(items.length, current + 1))}>{content}</button>
          : <article key={index} className="rounded-2xl border border-platform-border bg-platform-surface px-4 py-3">{content}</article>;
      })}
    </div>
  </Panel>;
}

export function GeneratedSlideMarkedActivityPanel({ moduleId, responseKind, payload, projection }: {
  moduleId: string;
  responseKind: unknown;
  payload: Record<string, unknown>;
  projection: 'student' | 'teacher';
}) {
  const prompt = <p className="interactive-courseware-body" style={{ fontSize: 28 }} data-generated-slide-text-marker={generatedSlideTextMarkerId(moduleId, 'prompt')}>{String(payload.prompt)}</p>;
  switch (responseKind) {
    case 'choice.single':
    case 'choice.multi':
      return <section data-generated-slide-measure-container="activity">{prompt}<div className="mt-3 grid gap-2">{recordArray(payload.options).map((option, index) => <button type="button" key={index} disabled>
        <span data-generated-slide-text-marker={generatedSlideTextMarkerId(moduleId, `options.${index}.label`)}>{String(option.label)}</span>
      </button>)}</div></section>;
    case 'text.short':
      return <section data-generated-slide-measure-container="activity">{prompt}<input aria-label={`${projection} 简答`} readOnly placeholder={typeof payload.placeholder === 'string' ? payload.placeholder : undefined}
        {...(typeof payload.placeholder === 'string' ? { 'data-generated-slide-text-marker': generatedSlideTextMarkerId(moduleId, 'placeholder') } : {})} /></section>;
    case 'text.long':
      return <section data-generated-slide-measure-container="activity">{prompt}<textarea aria-label={`${projection} 长答`} readOnly rows={2} placeholder={typeof payload.placeholder === 'string' ? payload.placeholder : undefined}
        {...(typeof payload.placeholder === 'string' ? { 'data-generated-slide-text-marker': generatedSlideTextMarkerId(moduleId, 'placeholder') } : {})} /></section>;
    case 'ordering.sequence':
      return <section data-generated-slide-measure-container="activity">{prompt}<ol>{stringArray(payload.items).map((item, index) => <li key={index} data-generated-slide-text-marker={generatedSlideTextMarkerId(moduleId, `items.${index}`)}>{item}</li>)}</ol></section>;
    case 'matching.pairs':
      return <section data-generated-slide-measure-container="activity">{prompt}<div className="grid grid-cols-2 gap-2">{(['left', 'right'] as const).map((side) => <ul key={side}>{recordArray(payload[side]).map((option, index) => <li key={index} data-generated-slide-text-marker={generatedSlideTextMarkerId(moduleId, `${side}.${index}.label`)}>{String(option.label)}</li>)}</ul>)}</div></section>;
    default:
      throw new Error(`unsupported-generated-slide-response-kind:${moduleId}:${String(responseKind)}`);
  }
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <div className="premium-lesson-panel interactive-courseware-panel" data-generated-slide-measure-container="content"><h2 className="interactive-courseware-title-level-2">{title}</h2>{children}</div>;
}

function MarkedInline({ moduleId, path, value }: { moduleId: string; path: string; value: string }) {
  const parts = splitGeneratedSlideInlineContent(value);
  const hasText = parts.some((part) => part.kind === 'text' && part.value.trim());
  return <span className="interactive-courseware-body" style={{ fontSize: 32 }} {...(hasText ? { 'data-generated-slide-text-marker': generatedSlideTextMarkerId(moduleId, path) } : {})}>
    {parts.map((part, index) => part.kind === 'formula'
      ? <FormulaMarker key={index} id={generatedSlideFormulaMarkerId(moduleId, path, part.index)} block={false} value={part.value} />
      : <Fragment key={index}>{part.value}</Fragment>)}
  </span>;
}

function MarkedFormulaContent({ moduleId, path, value }: { moduleId: string; path: string; value: string }) {
  const bare = isGeneratedSlideBareFormula(value);
  if (bare) return <FormulaMarker id={generatedSlideFormulaMarkerId(moduleId, path)} block value={bare.formula} />;
  return <p className="interactive-courseware-body"><MarkedInline moduleId={moduleId} path={path} value={value} /></p>;
}

function FormulaMarker({ id, block, value }: { id: string; block: boolean; value: string }) {
  return <span data-generated-slide-formula-marker={id}>{block ? <BlockMath math={normalizeMath(value)} /> : <InlineMath math={normalizeMath(value)} />}</span>;
}

function normalizeMath(value: string) { return value.trim().replace(/^\$/, '').replace(/\$$/, '').replace(/\\\\/g, '\\'); }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function stringArray(value: unknown): string[] { return array(value).filter((item): item is string => typeof item === 'string'); }
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function recordArray(value: unknown): Record<string, unknown>[] { return array(value).map(record); }
