'use client';

import { memo, useEffect, useRef } from 'react';

import { GovernedRichText } from '@/components/shared/governed-rich-text';
import type { GovernedRichTextProjection } from '@/lib/governed-math';

export interface SemanticLabelModel {
  id: string;
  richTitle?: GovernedRichTextProjection;
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

function SemanticLabelContent({
  label,
  theme,
}: {
  label: SemanticLabelModel;
  theme: 'light' | 'dark';
}) {
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
      {labels.filter((label) => label.visible || label.richTitle).map((label) => (
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
