'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp } from 'lucide-react';
import { TEACHING_RESOURCE_TYPES, type TeachingResourceType } from '@/lib/teaching-projection/contracts';
import { PUBLISHED_RESOURCE_LABELS } from '@/lib/published-resource-reference';

import type { EngineeringRelationFamily } from '@/lib/authority-domain-shards/contracts';
import { ENGINEERING_RELATION_FAMILIES } from '@/lib/authority-domain-shards/contracts';
import type { AdmittedLocale } from '@/lib/authority-locale-readiness/contracts';
import { ACTIVE_RELATION_STYLES, ACTIVE_TONE_COLORS } from './graph/active-renderer/active-authority-visual';
import { familyLabel, graphCopy, nodeTypeLabel } from './active-authority-graph-i18n';

export interface ActiveFilterNodeType {
  canonicalType: string;
  shape: string;
  tone: string;
  fallbackLabel: string;
}

interface ActiveAuthorityFilterPanelProps {
  locale: AdmittedLocale;
  /** 当前有界逻辑图中已物化的注册节点类型（#1742：只列可用控件）。 */
  materializedTypes: readonly ActiveFilterNodeType[];
  hiddenNodeTypes: ReadonlySet<string>;
  onToggleNodeType: (canonicalType: string) => void;
  enabledFamilies: readonly EngineeringRelationFamily[];
  onToggleFamily: (family: EngineeringRelationFamily) => void;
  familyFailures: Readonly<Partial<Record<EngineeringRelationFamily, { message: string; retryable: boolean }>>>;
  onRetryFamily: (family: EngineeringRelationFamily) => void;
  /** 教学关系覆盖状态（不可用/未发布等）；null 表示无说明。 */
  teachingCoverageNote: string | null;
  /** Unified visibility of published teaching and engineering prerequisites. */
  teachingRelationsVisible: boolean;
  onToggleTeachingRelations: () => void;
  selectedResourceTypes?: ReadonlySet<TeachingResourceType>;
  onResourceTypesChange?: (types: ReadonlySet<TeachingResourceType>) => void;
  avoidExpandedKonling?: boolean;
  inFlow?: boolean;
}

// 样本描边与画布 nodeStroke 共用同一 tone 色板，面板样本与画布从不矛盾。

function NodeTypeShapeSample({ shape, tone }: { shape: string; tone: string }) {
  const color = ACTIVE_TONE_COLORS[tone] ?? ACTIVE_TONE_COLORS.muted;
  const common = { fill: 'none', stroke: color, strokeWidth: 2 } as const;
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 shrink-0 overflow-visible" data-active-authority-type-sample={shape}>
      {shape === 'circle' ? (
        <circle cx="8" cy="8" r="5" {...common} />
      ) : shape === 'square' ? (
        <rect x="3" y="3" width="10" height="10" {...common} />
      ) : shape === 'rounded' ? (
        <rect x="3" y="3" width="10" height="10" rx="3.5" {...common} />
      ) : shape === 'diamond' ? (
        <polygon points="8,2 14,8 8,14 2,8" {...common} />
      ) : shape === 'hexagon' ? (
        <polygon points="10.5,2 14,8 10.5,14 5.5,14 2,8 5.5,2" {...common} />
      ) : (
        <circle cx="8" cy="8" r="5" {...common} />
      )}
    </svg>
  );
}

/** 样本即图例；先后修来源仍保留在关系载荷中。 */
function RelationLineSample({ family }: { family: 'teaching' | EngineeringRelationFamily }) {
  const style = ACTIVE_RELATION_STYLES[family === 'teaching' ? 'prerequisite-order' : family];
  return (
    <svg viewBox="0 0 28 8" aria-hidden="true" className="h-2 w-7 shrink-0 overflow-visible" data-active-authority-family-sample={family}>
      <path
        d="M2 4 H26"
        fill="none"
        stroke={style.color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeDasharray={style.dash?.join(' ')}
      />
      {style.directed ? <path d="M22 1 L26 4 L22 7" fill="none" stroke={style.color} strokeWidth={1.5} /> : null}
    </svg>
  );
}

const toggleClassName = (active: boolean) => `inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-platform-action-primary ${active
  ? 'border-platform-action-primary bg-platform-action-subtle text-platform-fg-primary'
  : 'border-platform-border text-platform-fg-muted hover:bg-platform-action-subtle hover:text-platform-fg-primary'}`;

const EMPTY_RESOURCE_TYPES = new Set<TeachingResourceType>();
const RESOURCE_GROUPS = TEACHING_RESOURCE_TYPES.reduce<Array<{ type: TeachingResourceType; members: TeachingResourceType[] }>>((groups, type) => {
  const group = groups.find((entry) => PUBLISHED_RESOURCE_LABELS[entry.type] === PUBLISHED_RESOURCE_LABELS[type]);
  if (group) group.members.push(type);
  else groups.push({ type, members: [type] });
  return groups;
}, []);

export function ActiveAuthorityFilterPanel({
  locale,
  materializedTypes,
  hiddenNodeTypes,
  onToggleNodeType,
  enabledFamilies,
  onToggleFamily,
  familyFailures,
  onRetryFamily,
  teachingCoverageNote,
  teachingRelationsVisible,
  onToggleTeachingRelations,
  selectedResourceTypes = EMPTY_RESOURCE_TYPES,
  onResourceTypesChange,
  avoidExpandedKonling = false,
  inFlow = false,
}: ActiveAuthorityFilterPanelProps) {
  const [menuOpen, setMenuOpen] = useState<'types' | 'resources' | null>(null);
  const typesOpen = menuOpen === 'types';
  const resourcesOpen = menuOpen === 'resources';
  const [menuPosition, setMenuPosition] = useState<{ left: number; bottom: number; width: number; maxHeight: number } | null>(null);
  const typeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const resourceTriggerRef = useRef<HTMLButtonElement | null>(null);
  const typeMenuRef = useRef<HTMLDivElement | null>(null);
  const typeMenuId = useId();
  useEffect(() => {
    if (!menuOpen) return;
    const update = () => {
      const rect = (menuOpen === 'types' ? typeTriggerRef.current : resourceTriggerRef.current)?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(260, window.innerWidth - 24);
      setMenuPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        bottom: window.innerHeight - rect.top + 8, width, maxHeight: Math.max(0, Math.min(320, rect.top - 24)) });
    };
    const closeOutside = (event: PointerEvent) => {
      if (!typeMenuRef.current?.contains(event.target as Node) && !typeTriggerRef.current?.contains(event.target as Node)
        && !resourceTriggerRef.current?.contains(event.target as Node)) setMenuOpen(null);
    };
    update();
    const focus = window.requestAnimationFrame(() => typeMenuRef.current?.querySelector<HTMLButtonElement>('button')?.focus());
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    document.addEventListener('pointerdown', closeOutside);
    return () => {
      window.cancelAnimationFrame(focus);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      document.removeEventListener('pointerdown', closeOutside);
    };
  }, [menuOpen]);
  return (
    <section
      aria-label={graphCopy(locale, 'filter.panel')}
      data-active-authority-filter-panel="true"
      data-active-authority-filter-placement={inFlow ? 'below-canvas' : 'compact-bottom-left'}
      data-graph-locale={locale}
      className={inFlow
        ? 'pointer-events-auto relative z-20 mt-2 flex w-fit max-w-full min-w-0 shrink-0 flex-wrap items-center gap-1 rounded-xl border border-platform-border bg-platform-surface p-1 sm:p-1.5'
        : avoidExpandedKonling
        ? 'pointer-events-auto absolute bottom-0 left-20 z-40 flex max-w-[calc(100%-5rem)] min-w-0 flex-wrap items-center gap-1 rounded-xl border border-platform-border bg-platform-surface/95 p-1.5 shadow-lg backdrop-blur-md'
        : 'pointer-events-auto absolute bottom-0 left-0 z-40 flex max-w-full min-w-0 flex-wrap items-center gap-1 rounded-xl border border-platform-border bg-platform-surface/95 p-1 shadow-lg backdrop-blur-md sm:p-1.5'}
    >
      <div className="flex items-center gap-1" data-active-authority-filter-group="node-types">
        <button ref={typeTriggerRef} type="button" aria-haspopup="dialog" aria-expanded={typesOpen}
          aria-controls={typesOpen ? typeMenuId : undefined} onClick={() => setMenuOpen((open) => open === 'types' ? null : 'types')}
          className={toggleClassName(typesOpen)} data-active-authority-type-menu-trigger>
          {graphCopy(locale, 'filter.nodeTypes')} ({materializedTypes.filter((type) => !hiddenNodeTypes.has(type.canonicalType)).length})
          <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button ref={resourceTriggerRef} type="button" aria-haspopup="dialog" aria-expanded={resourcesOpen}
          aria-controls={resourcesOpen ? typeMenuId : undefined} onClick={() => setMenuOpen((open) => open === 'resources' ? null : 'resources')}
          className={toggleClassName(resourcesOpen || selectedResourceTypes.size > 0)} data-active-authority-resource-menu-trigger>
          {graphCopy(locale, 'filter.nodeResources')}{selectedResourceTypes.size > 0 ? ' (' + RESOURCE_GROUPS.filter((group) => group.members.some((type) => selectedResourceTypes.has(type))).length + ')' : ''}
          <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        {menuOpen && menuPosition ? createPortal(
          <div ref={typeMenuRef} id={typeMenuId} role="dialog" aria-label={graphCopy(locale, typesOpen ? 'filter.nodeTypes' : 'filter.nodeResources')}
            className="fixed z-[180] overflow-y-auto rounded-xl border border-platform-border bg-platform-surface p-2 shadow-xl"
            style={menuPosition} data-active-authority-type-menu={typesOpen ? true : undefined} data-active-authority-resource-menu={resourcesOpen ? true : undefined} data-side="top"
            onKeyDown={(event) => {
              if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setMenuOpen(null); (typesOpen ? typeTriggerRef.current : resourceTriggerRef.current)?.focus(); }
            }}>
            {typesOpen ? materializedTypes.map((type) => {
              const visible = !hiddenNodeTypes.has(type.canonicalType);
              return <button key={type.canonicalType} type="button" role="checkbox" aria-checked={visible}
                onClick={() => onToggleNodeType(type.canonicalType)} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-platform-fg-primary hover:bg-platform-action-subtle"
                data-active-authority-type-filter={type.canonicalType} data-active-authority-type-visible={visible ? 'true' : 'false'}>
                <span aria-hidden="true" className="w-4">{visible ? '✓' : ''}</span>
                <NodeTypeShapeSample shape={type.shape} tone={type.tone} />
                <span>{nodeTypeLabel(locale, type.canonicalType, type.fallbackLabel)}</span>
              </button>;
            }) : <>
              <button type="button" role="checkbox" aria-checked={selectedResourceTypes.size === 0}
                onClick={() => onResourceTypesChange?.(new Set())} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-platform-fg-primary hover:bg-platform-action-subtle"
                data-active-authority-resource-type="all">
                <span aria-hidden="true" className="w-4">{selectedResourceTypes.size === 0 ? '✓' : ''}</span>{graphCopy(locale, 'filter.anyResourceTypes')}
              </button>
              {RESOURCE_GROUPS.map((group) => {
                const selected = group.members.some((type) => selectedResourceTypes.has(type));
                return <button key={group.type} type="button" role="checkbox" aria-checked={selected}
                  onClick={() => {
                    const next = new Set(selectedResourceTypes);
                    for (const type of group.members) { if (selected) next.delete(type); else next.add(type); }
                    onResourceTypesChange?.(next);
                  }} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-platform-fg-primary hover:bg-platform-action-subtle"
                  data-active-authority-resource-type={group.type}>
                  <span aria-hidden="true" className="w-4">{selected ? '✓' : ''}</span>{graphCopy(locale, `filter.resourceType.${group.type}`)}
                </button>;
              })}
            </>}
          </div>, document.body,
        ) : null}
      </div>
      <div
        role="group"
        aria-label={graphCopy(locale, 'filter.relationFamilies')}
        data-active-authority-filter-group="relation-families"
        className="flex min-w-0 flex-wrap items-center gap-1"
      >
        <span className="mr-0.5 text-[11px] font-semibold text-platform-fg-secondary">{graphCopy(locale, 'filter.relationFamilies')}</span>
        <button
          type="button"
          role="checkbox"
          aria-checked={teachingRelationsVisible ? 'true' : 'false'}
          onClick={onToggleTeachingRelations}
          className={`inline-flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-platform-action-primary ${teachingRelationsVisible
            ? 'border-sky-300/50 bg-sky-400/10 text-sky-100'
            : 'border-platform-border text-platform-fg-muted hover:bg-platform-action-subtle hover:text-platform-fg-primary'}`}
          data-authority-relation-family="prerequisite-order"
          data-authority-family-enabled={teachingRelationsVisible ? 'true' : 'false'}
        >
          <RelationLineSample family="teaching" />
          {graphCopy(locale, 'filter.family.prerequisite-order')}
          {teachingCoverageNote ? (
            <span data-authority-teaching-coverage="true" className="text-[11px] text-sky-200/80">{teachingCoverageNote}</span>
          ) : null}
        </button>
        {familyFailures['prerequisite-order'] ? (
          <span role="alert" data-authority-family-failure="prerequisite-order" className="max-w-44 text-[11px] text-red-200">
            {familyFailures['prerequisite-order'].message}
            {familyFailures['prerequisite-order'].retryable ? (
              <button type="button" onClick={() => onRetryFamily('prerequisite-order')}
                data-authority-family-retry="prerequisite-order" className="ml-1 underline underline-offset-2">
                {graphCopy(locale, 'filter.family.retry')}
              </button>
            ) : null}
          </span>
        ) : null}
        {ENGINEERING_RELATION_FAMILIES.filter((family) => family !== 'prerequisite-order').map((family) => {
          const enabled = enabledFamilies.includes(family);
          const failure = familyFailures[family];
          return (
            <span key={family} className="inline-flex min-w-0 items-center gap-1">
              <button
                type="button"
                role="checkbox"
                aria-checked={enabled ? 'true' : 'false'}
                aria-label={failure ? `${familyLabel(locale, family)}${graphCopy(locale, 'filter.family.loadFailed')}` : undefined}
                onClick={() => onToggleFamily(family)}
                className={toggleClassName(enabled)}
                data-authority-relation-family={family}
                data-authority-family-enabled={enabled ? 'true' : 'false'}
              >
                <RelationLineSample family={family} />
                <span>{familyLabel(locale, family)}</span>
              </button>
              {failure ? (
                <span
                  role="alert"
                  aria-live="polite"
                  data-authority-family-failure={family}
                  className="max-w-44 text-[11px] text-red-200"
                >
                  {failure.message}
                  {failure.retryable ? (
                    <button
                      type="button"
                      onClick={() => onRetryFamily(family)}
                      aria-label={`${graphCopy(locale, 'filter.family.retry')}${familyLabel(locale, family)}`}
                      data-authority-family-retry={family}
                      className="ml-1 underline underline-offset-2"
                    >{graphCopy(locale, 'filter.family.retry')}</button>
                  ) : null}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
    </section>
  );
}
