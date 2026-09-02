'use client';

import type { EngineeringRelationFamily } from '@/lib/authority-domain-shards/contracts';
import { ENGINEERING_RELATION_FAMILIES } from '@/lib/authority-domain-shards/contracts';
import type { AdmittedLocale } from '@/lib/authority-locale-readiness/contracts';
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
  familyFailures: Readonly<Partial<Record<EngineeringRelationFamily, string>>>;
  onRetryFamily: (family: EngineeringRelationFamily) => void;
  /** 教学关系覆盖状态（不可用/未发布等）；null 表示无说明。 */
  teachingCoverageNote: string | null;
}

// 样本描边与画布 nodeStroke 共用同一 tone 色板，面板样本与画布从不矛盾。
const TONE_SAMPLE_COLORS: Readonly<Record<string, string>> = {
  cyan: '#22d3ee',
  violet: '#a78bfa',
  amber: '#fbbf24',
  emerald: '#34d399',
  blue: '#60a5fa',
  muted: '#94a3b8',
};

function NodeTypeShapeSample({ shape, tone }: { shape: string; tone: string }) {
  const color = TONE_SAMPLE_COLORS[tone] ?? TONE_SAMPLE_COLORS.muted;
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

/** 教学顺序为实线、工程关系族为虚线；样本即图例，不再单独渲染 legend 行。 */
function RelationLineSample({ family }: { family: 'teaching' | EngineeringRelationFamily }) {
  return (
    <svg viewBox="0 0 28 8" aria-hidden="true" className="h-2 w-7 shrink-0 overflow-visible" data-active-authority-family-sample={family}>
      <path
        d="M2 4 H26"
        fill="none"
        stroke={family === 'teaching' ? '#7dd3fc' : '#94a3b8'}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeDasharray={family === 'teaching' ? undefined : '4 3'}
      />
    </svg>
  );
}

const toggleClassName = (active: boolean) => `inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-platform-action-primary ${active
  ? 'border-platform-action-primary bg-platform-action-subtle text-platform-fg-primary'
  : 'border-platform-border text-platform-fg-muted hover:bg-platform-action-subtle hover:text-platform-fg-primary'}`;

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
}: ActiveAuthorityFilterPanelProps) {
  return (
    <section
      aria-label={graphCopy(locale, 'filter.panel')}
      data-active-authority-filter-panel="true"
      data-graph-locale={locale}
      className="flex min-w-0 flex-wrap items-start gap-x-4 gap-y-2 rounded-lg border border-platform-border bg-platform-canvas-muted/95 p-2 max-[639px]:w-full"
    >
      <div
        role="group"
        aria-label={graphCopy(locale, 'filter.nodeTypes')}
        data-active-authority-filter-group="node-types"
        className="flex min-w-0 flex-wrap items-center gap-1"
      >
        <span className="mr-0.5 text-[11px] font-semibold text-platform-fg-secondary">{graphCopy(locale, 'filter.nodeTypes')}</span>
        {materializedTypes.map((type) => {
          const visible = !hiddenNodeTypes.has(type.canonicalType);
          return (
            <button
              key={type.canonicalType}
              type="button"
              role="checkbox"
              aria-checked={visible ? 'true' : 'false'}
              onClick={() => onToggleNodeType(type.canonicalType)}
              className={toggleClassName(visible)}
              data-active-authority-type-filter={type.canonicalType}
              data-active-authority-type-visible={visible ? 'true' : 'false'}
            >
              <NodeTypeShapeSample shape={type.shape} tone={type.tone} />
              <span>{nodeTypeLabel(locale, type.canonicalType, type.fallbackLabel)}</span>
            </button>
          );
        })}
      </div>
      <div
        role="group"
        aria-label={graphCopy(locale, 'filter.relationFamilies')}
        data-active-authority-filter-group="relation-families"
        className="flex min-w-0 flex-wrap items-center gap-1"
      >
        <span className="mr-0.5 text-[11px] font-semibold text-platform-fg-secondary">{graphCopy(locale, 'filter.relationFamilies')}</span>
        <span
          data-authority-relation-family="teaching-order"
          className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-sky-300/50 bg-sky-400/10 px-2 py-1.5 text-xs text-sky-100"
        >
          <RelationLineSample family="teaching" />
          {graphCopy(locale, 'filter.teachingOrder')}
          {teachingCoverageNote ? (
            <span data-authority-teaching-coverage="true" className="text-[11px] text-sky-200/80">{teachingCoverageNote}</span>
          ) : null}
        </span>
        {ENGINEERING_RELATION_FAMILIES.map((family) => {
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
                  {failure}
                  <button
                    type="button"
                    onClick={() => onRetryFamily(family)}
                    aria-label={`${graphCopy(locale, 'filter.family.retry')}${familyLabel(locale, family)}`}
                    data-authority-family-retry={family}
                    className="ml-1 underline underline-offset-2"
                  >{graphCopy(locale, 'filter.family.retry')}</button>
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
    </section>
  );
}
