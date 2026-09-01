'use client';

import { memo, useEffect, useMemo, useRef } from 'react';

import { GovernedRichText } from '@/components/shared/governed-rich-text';
import {
  renderGovernedKatexHtml,
  type GovernedFormulaProjection,
  type GovernedRichTextProjection,
} from '@/lib/governed-math';

export interface SemanticLabelModel {
  id: string;
  richTitle?: GovernedRichTextProjection;
  /** Governed formula projection for Formula nodes (#1740). */
  mathematics?: GovernedFormulaProjection;
  /** Bounded human name shown as secondary context under the expression. */
  humanContext?: string;
  fallbackLines: readonly string[];
  accessibleName: string;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  isRootBubble: boolean;
  opacity: number;
}

/**
 * Shared governed formula label for 2D and 3D semantic label layers (#1740):
 * the expression is the primary glyph, the human name is bounded secondary
 * context, and KaTeX output is cached by immutable render identity so force
 * and camera frames only move placement — never re-execute rendering.
 */
export function GovernedFormulaLabel({
  projection,
  humanContext,
  theme,
}: {
  projection: GovernedFormulaProjection;
  humanContext?: string;
  theme: 'light' | 'dark';
}) {
  const html = useMemo(() => (
    projection.state === 'available'
      ? renderGovernedKatexHtml({
        latex: projection.latex,
        displayMode: projection.display === 'block',
        macroProfileId: projection.macroProfileId,
        macroProfileHash: projection.macroProfileHash,
        theme,
      })
      : null
  ), [projection, theme]);
  if (projection.state === 'registered-unavailable') {
    return (
      <span
        data-governed-formula-label="unavailable"
        className="block max-w-full truncate"
        aria-label={projection.accessibleName}
      >
        {projection.fallbackText}
      </span>
    );
  }
  if (projection.state !== 'available' || html === null) return null;
  return (
    <>
      <span
        data-governed-formula-label={projection.renderKey}
        className="block max-w-full overflow-hidden"
        aria-label={projection.accessibleLabel}
      >
        <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
      </span>
      {humanContext ? (
        <span className="block max-w-full truncate text-[0.82em] font-normal opacity-80">
          {humanContext}
        </span>
      ) : null}
    </>
  );
}

function SemanticLabelContent({
  label,
  theme,
}: {
  label: SemanticLabelModel;
  theme: 'light' | 'dark';
}) {
  if (label.mathematics && label.mathematics.state !== 'missing') {
    return (
      <GovernedFormulaLabel
        projection={label.mathematics}
        humanContext={label.humanContext}
        theme={theme}
      />
    );
  }
  if (label.richTitle && label.richTitle.state !== 'missing') {
    return (
      <GovernedRichText
        projection={label.richTitle}
        theme={theme}
        density="canvas"
        className="pointer-events-none block max-w-full"
      />
    );
  }
  return (
    <>
      {label.fallbackLines.map((line, index) => (
        <span key={`${label.id}:${index}`}>{line}</span>
      ))}
    </>
  );
}

const MemoSemanticLabelContent = memo(SemanticLabelContent);

export function SemanticLabelLayer({
  labels,
  theme,
  layerAttr = 'data-knowledge-semantic-label-layer',
}: {
  labels: readonly SemanticLabelModel[];
  theme: 'light' | 'dark';
  layerAttr?: string;
}) {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    for (const label of labels) {
      const node = layer.querySelector<HTMLElement>(`[data-semantic-label-id="${CSS.escape(label.id)}"]`);
      if (!node) continue;
      node.style.left = `${label.x}px`;
      node.style.top = `${label.y}px`;
      node.style.width = `${label.width}px`;
      node.style.minHeight = `${label.height}px`;
      node.style.fontSize = `${label.fontSize}px`;
      node.style.opacity = String(label.opacity);
      node.hidden = !label.visible;
    }
  }, [labels]);

  return (
    <div
      ref={layerRef}
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
      {...{ [layerAttr]: 'true' }}
      data-knowledge-visible-label-count={String(labels.filter((label) => label.visible).length)}
      aria-hidden="false"
    >
      {labels.filter((label) => label.visible || label.richTitle || (label.mathematics && label.mathematics.state !== 'missing')).map((label) => (
        <div
          key={label.id}
          data-semantic-label-id={label.id}
          data-knowledge-3d-node-label={label.id}
          data-knowledge-2d-node-label={label.id}
          data-knowledge-screen-font-size={String(label.fontSize)}
          data-knowledge-root-label={label.isRootBubble ? 'inside-complete' : undefined}
          data-knowledge-complete-name={label.isRootBubble ? label.accessibleName : undefined}
          hidden={!label.visible}
          className={label.isRootBubble
            ? 'absolute flex flex-col items-center justify-center text-center font-bold leading-tight text-platform-fg-inverse [text-shadow:0_0_2px_hsl(var(--platform-canvas)),0_0_5px_hsl(var(--platform-canvas))]'
            : 'absolute flex flex-col items-center justify-center text-center font-semibold leading-tight text-platform-fg-primary [text-shadow:0_0_2px_hsl(var(--platform-canvas)),0_0_4px_hsl(var(--platform-canvas))]'}
          style={{
            left: label.x,
            top: label.y,
            width: label.width,
            minHeight: label.height,
            fontSize: label.fontSize,
            opacity: label.opacity,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <MemoSemanticLabelContent label={label} theme={theme} />
        </div>
      ))}
    </div>
  );
}
