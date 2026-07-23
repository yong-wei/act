import { getKnowledgeGraphEvidenceEdgeModulation, KNOWLEDGE_GRAPH_FAMILY_PRESENTATION_CONFIG } from './visual-config';
import { getAllFamiliesCheckedState, KNOWLEDGE_GRAPH_RELATION_FAMILIES } from './relation-family-controls';
import type { KnowledgeGraphRelationFamily } from './relation-contract';

interface RelationFamilyControlProps {
  enabledFamilies: readonly KnowledgeGraphRelationFamily[];
  isLightTheme: boolean;
  placement: 'canvas' | 'inspector' | 'tool-panel';
  onToggleAll: () => void;
  onToggleFamily: (family: KnowledgeGraphRelationFamily) => void;
}

export type RelationFamilyControlPlacement = 'canvas' | 'inspector' | 'tool-panel';

export function resolveRelationFamilyControlPlacement(input: {
  isMobile: boolean;
  inspectorVisible: boolean;
  toolPanelVisible: boolean;
}): RelationFamilyControlPlacement {
  if (!input.isMobile) return 'canvas';
  if (input.inspectorVisible) return 'inspector';
  if (input.toolPanelVisible) return 'tool-panel';
  return 'canvas';
}

function RelationFamilySample({ family, isLightTheme }: {
  family: KnowledgeGraphRelationFamily;
  isLightTheme: boolean;
}) {
  const item = KNOWLEDGE_GRAPH_FAMILY_PRESENTATION_CONFIG[family];
  const dashArray = item.sampleStyle.dash.length > 0 ? item.sampleStyle.dash.join(' ') : undefined;
  const markerId = `knowledge-relation-family-${family}`;
  const sampleColor = isLightTheme ? item.sampleStyle.lightColor : item.sampleStyle.darkColor;
  // 证据不可用样例与画布共享同一调制，图例与画布从不矛盾。
  const evidenceMuted = getKnowledgeGraphEvidenceEdgeModulation('unavailable');

  return (
    <svg viewBox="0 0 42 16" aria-hidden="true" className="h-4 w-10 shrink-0 overflow-visible" data-knowledge-relation-family-sample={family}>
      {item.sampleStyle.hasArrow && (
        <defs>
          <marker id={markerId} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
            <path d="M0,0 L5,2.5 L0,5 Z" fill={sampleColor} />
          </marker>
        </defs>
      )}
      <path
        d={`M3 5 C 14 ${5 - item.sampleStyle.curvature * 36}, 28 ${5 + item.sampleStyle.curvature * 36}, 39 5`}
        fill="none"
        stroke={sampleColor}
        strokeDasharray={dashArray}
        strokeLinecap="round"
        strokeWidth={item.sampleStyle.width}
        markerEnd={item.sampleStyle.hasArrow ? `url(#${markerId})` : undefined}
        opacity={item.sampleStyle.opacity}
      >
        <title>依据可用</title>
      </path>
      <path
        d={`M3 12 C 14 ${12 - item.sampleStyle.curvature * 36}, 28 ${12 + item.sampleStyle.curvature * 36}, 39 12`}
        fill="none"
        stroke={sampleColor}
        strokeDasharray={dashArray}
        strokeLinecap="round"
        strokeWidth={item.sampleStyle.width * evidenceMuted.widthFactor}
        opacity={item.sampleStyle.opacity * evidenceMuted.opacityFactor}
      >
        <title>依据未提供</title>
      </path>
    </svg>
  );
}

export function RelationFamilyControl({ enabledFamilies, isLightTheme, placement, onToggleAll, onToggleFamily }: RelationFamilyControlProps) {
  return (
    <div
      role="group"
      aria-label="关系族显示"
      className={placement === 'canvas'
        ? 'absolute bottom-3 left-3 z-40 grid w-[calc(100%-1.5rem)] min-w-0 grid-cols-[auto_repeat(3,minmax(0,1fr))] items-center gap-1 rounded-xl border border-platform-border bg-platform-surface/95 p-1 shadow-lg backdrop-blur-md sm:w-auto sm:grid-cols-none sm:grid-flow-col sm:p-1.5'
        : 'grid w-full min-w-0 grid-cols-[auto_repeat(3,minmax(0,1fr))] items-center gap-1 rounded-lg border border-platform-border bg-platform-canvas-muted p-1 sm:p-1.5'}
      data-knowledge-relation-family-control={placement === 'canvas' ? 'compact-bottom-left' : `${placement}-header`}
      data-knowledge-mobile-equivalent="same-state-same-control"
      data-knowledge-relation-family-state={enabledFamilies.join(',') || 'none'}
    >
      <button type="button" role="checkbox" aria-checked={getAllFamiliesCheckedState(enabledFamilies)} onClick={onToggleAll}
        className="inline-flex h-8 min-w-0 items-center justify-center rounded-md border border-platform-border px-1.5 text-[11px] font-medium text-platform-fg-secondary transition hover:bg-platform-action-subtle hover:text-platform-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-platform-action-primary sm:px-2"
        data-knowledge-relation-family="all">
        全部
      </button>
      {KNOWLEDGE_GRAPH_RELATION_FAMILIES.map((family) => {
        const enabled = enabledFamilies.includes(family);
        const config = KNOWLEDGE_GRAPH_FAMILY_PRESENTATION_CONFIG[family];
        return (
          <button key={family} type="button" role="checkbox" aria-checked={enabled ? 'true' : 'false'}
            aria-label={`${enabled ? '隐藏' : '显示'}${config.label}关系`} onClick={() => onToggleFamily(family)}
            className={`inline-flex h-8 min-w-0 items-center justify-center gap-0.5 rounded-md border px-1 text-[10px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-platform-action-primary sm:gap-1 sm:px-2 sm:text-[11px] ${enabled
              ? 'border-platform-action-primary bg-platform-action-subtle text-platform-fg-primary'
              : 'border-platform-border text-platform-fg-muted hover:bg-platform-action-subtle hover:text-platform-fg-primary'}`}
            data-knowledge-relation-family={family}>
            <RelationFamilySample family={family} isLightTheme={isLightTheme} />
            <span>{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}
