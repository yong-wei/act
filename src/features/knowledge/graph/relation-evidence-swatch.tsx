import {
  getKnowledgeGraphEvidenceEdgeModulation,
  KNOWLEDGE_GRAPH_FAMILY_PRESENTATION_CONFIG,
} from './visual-config';
import type { KnowledgeGraphRelationFamily } from './relation-contract';

interface RelationEvidenceSwatchProps {
  evidenceState?: 'available' | 'unavailable';
  family?: KnowledgeGraphRelationFamily;
  isLightTheme: boolean;
}

/**
 * Inspector 关系行的证据样例：与画布、图例共享同一族样式与证据调制，
 * 同一条关系在三个表面永不矛盾。unknown 状态保持未调制呈现。
 */
export function RelationEvidenceSwatch({
  evidenceState,
  family = 'association',
  isLightTheme,
}: RelationEvidenceSwatchProps) {
  const style = KNOWLEDGE_GRAPH_FAMILY_PRESENTATION_CONFIG[family].sampleStyle;
  const modulation = getKnowledgeGraphEvidenceEdgeModulation(evidenceState);

  return (
    <svg
      viewBox="0 0 18 8"
      aria-hidden="true"
      className="h-2 w-[18px] shrink-0"
      data-knowledge-relation-evidence-swatch={evidenceState ?? 'unknown'}
      data-evidence-family={family}
    >
      <path
        d="M2 4 L16 4"
        fill="none"
        stroke={isLightTheme ? style.lightColor : style.darkColor}
        strokeDasharray={style.dash.length > 0 ? style.dash.join(' ') : undefined}
        strokeLinecap="round"
        strokeWidth={style.width * modulation.widthFactor}
        opacity={style.opacity * modulation.opacityFactor}
      />
    </svg>
  );
}
