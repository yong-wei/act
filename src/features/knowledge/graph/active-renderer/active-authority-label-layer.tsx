'use client';

import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

import { GovernedRichText } from '@/components/shared/governed-rich-text';
import { GovernedFormulaLabel } from '../semantic-label-layer';
import type {
  ActiveAuthorityLabelDescriptor,
  ActiveAuthorityLabelPlacement,
} from './active-authority-geometry';

export interface ActiveAuthorityLabelLayerHandle {
  sync: (placements: readonly ActiveAuthorityLabelPlacement[]) => void;
  cancel: () => void;
}

function currentTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function hasRichContent(label: ActiveAuthorityLabelDescriptor): boolean {
  const richTitle = label.richTitle;
  return Boolean(
    richTitle
    && richTitle.state !== 'missing'
    && (richTitle.state !== 'available' || richTitle.blocks.some((block) => block.spans.length > 0)),
  );
}

function applyLabelPlacements(
  layer: HTMLDivElement,
  placements: readonly ActiveAuthorityLabelPlacement[],
): void {
  let visibleCount = 0;
  const elements = new Map(
    Array.from(layer.querySelectorAll<HTMLElement>('[data-active-authority-label-id]'))
      .map((element) => [element.dataset.activeAuthorityLabelId ?? '', element] as const),
  );
  for (const placement of placements) {
    const element = elements.get(placement.id);
    if (!element) continue;
    element.hidden = !placement.visible;
    element.style.left = `${placement.x}px`;
    element.style.top = `${placement.y}px`;
    element.style.width = `${placement.width}px`;
    element.style.minHeight = `${placement.height}px`;
    element.style.fontSize = `${placement.fontSize}px`;
    element.style.opacity = String(placement.opacity);
    element.dataset.activeAuthorityLabelVisible = placement.visible ? 'true' : 'false';
    if (placement.visible) visibleCount += 1;
  }
  layer.dataset.activeAuthorityVisibleLabelCount = String(visibleCount);
}

function ActiveLabelContent({
  label,
  theme,
}: {
  label: ActiveAuthorityLabelDescriptor;
  theme: 'light' | 'dark';
}) {
  if (label.mathematics && label.mathematics.state !== 'missing') {
    return (
      <>
        <GovernedFormulaLabel
          projection={label.mathematics}
          humanContext={label.mathematics.state === 'available'
            ? label.humanContext ?? label.displayName
            : undefined}
          theme={theme}
        />
        {label.mathematics.state === 'available' && !label.humanContext ? (
          <span className="sr-only" data-active-authority-label-fallback="true">{label.displayName}</span>
        ) : null}
      </>
    );
  }
  if (hasRichContent(label)) {
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
    <span data-active-authority-label-fallback="true">
      {label.fallbackLines.map((line, index) => (
        <span key={`${label.id}:${index}`} className="block">{line}</span>
      ))}
    </span>
  );
}

const MemoActiveLabelContent = memo(ActiveLabelContent);

export const ActiveAuthorityLabelLayer = forwardRef<
  ActiveAuthorityLabelLayerHandle,
  {
    labels: readonly ActiveAuthorityLabelDescriptor[];
    className?: string;
  }
>(function ActiveAuthorityLabelLayer({ labels, className }, ref) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(currentTheme);

  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return undefined;
    const observer = new MutationObserver(() => setTheme(currentTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => observer.disconnect();
  }, []);

  useImperativeHandle(ref, () => ({
    sync(placements) {
      const layer = layerRef.current;
      if (layer) applyLabelPlacements(layer, placements);
    },
    cancel() {
      // The renderer owns the single rAF projection batch. The layer only
      // mutates existing DOM nodes when that batch is delivered.
    },
  }), []);

  return (
    <div
      ref={layerRef}
      className={`pointer-events-none absolute inset-0 z-20 overflow-hidden ${className ?? ''}`}
      data-active-authority-screen-label-layer="true"
      data-active-authority-label-budget={String(labels.length)}
      data-active-authority-visible-label-count="0"
      aria-hidden="false"
    >
      {labels.map((label) => {
        const style: CSSProperties = {
          position: 'absolute',
          left: 0,
          top: 0,
          width: label.width,
          minHeight: label.height,
          fontSize: label.fontSize,
          lineHeight: 1.2,
          transform: 'translate(-50%, -50%)',
        };
        return (
          <div
            key={label.id}
            data-active-authority-label-id={label.id}
            data-active-authority-screen-label={label.id}
            data-semantic-label-id={label.id}
            data-knowledge-2d-node-label={label.id}
            data-knowledge-3d-node-label={label.id}
            data-active-authority-label-kind={label.isRoot ? 'root' : 'node'}
            data-active-authority-label-visible="false"
            data-active-authority-label-accessible-name={label.accessibleName}
            hidden
            className="absolute rounded bg-platform-canvas/85 px-1.5 py-0.5 text-center font-medium text-platform-fg-primary"
            style={style}
          >
            <MemoActiveLabelContent label={label} theme={theme} />
          </div>
        );
      })}
    </div>
  );
});
