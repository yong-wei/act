'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { PublicAuthorityRootShard } from '@/lib/authority-domain-shards/contracts';
import {
  packActiveAuthorityRootEntries,
  type ActiveAuthorityRootPackedEntry,
} from './active-authority-root-entries';
import { KNOWLEDGE_ROOT_BUBBLE_STYLE } from './graph/root-layout';
import {
  KNOWLEDGE_ROOT_LABEL_POLICY,
  layoutKnowledgeRootLabel,
} from './graph/graph-presentation-contract';

interface ActiveAuthorityRootCanvasProps {
  catalog: PublicAuthorityRootShard['root'];
  onEnterDomain: (visualRole: string) => void;
}

export function ActiveAuthorityRootCanvas({
  catalog,
  onEnterDomain,
}: ActiveAuthorityRootCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ viewportWidth: 960, viewportHeight: 640 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => {
      const rect = host.getBoundingClientRect();
      setViewport({
        viewportWidth: Math.max(1, rect.width),
        viewportHeight: Math.max(1, rect.height),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const entries = useMemo(
    () => packActiveAuthorityRootEntries(catalog, viewport),
    [catalog, viewport],
  );
  const bounds = useMemo(() => rootBounds(entries), [entries]);

  return (
    <div
      ref={hostRef}
      className="relative min-h-[28rem] flex-1"
      data-authority-shard-root="true"
      data-authority-root-canvas="true"
      data-authority-root-domain-count={catalog.domains.length}
    >
      <svg
        className="h-full w-full"
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
        role="group"
        aria-label="当前知识领域圆形入口"
      >
        {entries.map((entry) => (
          <RootBubble
            key={entry.packingId}
            entry={entry}
            onEnterDomain={onEnterDomain}
          />
        ))}
      </svg>
    </div>
  );
}

function RootBubble({
  entry,
  onEnterDomain,
}: {
  entry: ActiveAuthorityRootPackedEntry;
  onEnterDomain: (visualRole: string) => void;
}) {
  const isAggregate = entry.kind === 'aggregate';
  const common = {
    'data-authority-root-entry': entry.kind,
    'data-authority-root-unavailable': entry.unavailable ? 'true' : 'false',
  };

  const nameLayout = layoutKnowledgeRootLabel(entry.name);
  const summaryLayout = entry.unavailable || !entry.summary
    ? null
    : layoutKnowledgeRootLabel(entry.summary);
  const nameHeight = nameLayout.lines.length * KNOWLEDGE_ROOT_LABEL_POLICY.lineHeight;
  const summaryHeight = summaryLayout
    ? summaryLayout.lines.length * 12
    : 0;
  const blockHeight = nameHeight + (summaryLayout ? 6 + summaryHeight : 0);
  const nameStartY = entry.y - blockHeight / 2 + KNOWLEDGE_ROOT_LABEL_POLICY.lineHeight / 2;

  const body = (
    <g pointerEvents="none" aria-hidden="true">
      {isAggregate ? (
        <circle
          cx={entry.x}
          cy={entry.y}
          r={entry.radius + 6}
          fill="none"
          stroke={KNOWLEDGE_ROOT_BUBBLE_STYLE.highlight}
          strokeWidth={2}
        />
      ) : null}
      <circle
        cx={entry.x}
        cy={entry.y}
        r={entry.radius}
        fill={isAggregate ? KNOWLEDGE_ROOT_BUBBLE_STYLE.surfaceDepth : KNOWLEDGE_ROOT_BUBBLE_STYLE.surface}
        stroke={KNOWLEDGE_ROOT_BUBBLE_STYLE.rim}
        strokeWidth={isAggregate ? 2.5 : 1.5}
      />
      <text
        data-authority-root-label="name"
        x={entry.x}
        y={nameStartY}
        textAnchor="middle"
        fill={KNOWLEDGE_ROOT_BUBBLE_STYLE.label}
        fontSize={KNOWLEDGE_ROOT_LABEL_POLICY.fontSize}
        fontWeight={KNOWLEDGE_ROOT_LABEL_POLICY.fontWeight}
      >
        {nameLayout.lines.map((line, index) => (
          <tspan
            key={`${line.text}-${index}`}
            x={entry.x}
            dy={index === 0 ? 0 : KNOWLEDGE_ROOT_LABEL_POLICY.lineHeight}
          >
            {line.text}
          </tspan>
        ))}
      </text>
      {summaryLayout ? (
        <text
          data-authority-root-label="summary"
          x={entry.x}
          y={nameStartY + nameHeight + 6}
          textAnchor="middle"
          fill={KNOWLEDGE_ROOT_BUBBLE_STYLE.label}
          fontSize={10}
          opacity={0.88}
        >
          {summaryLayout.lines.map((line, index) => (
            <tspan
              key={`${line.text}-${index}`}
              x={entry.x}
              dy={index === 0 ? 0 : 12}
            >
              {line.text}
            </tspan>
          ))}
        </text>
      ) : null}
    </g>
  );

  if (isAggregate) {
    return (
      <g
        {...common}
        data-authority-aggregate-entry="true"
        aria-label={entry.name}
      >
        {body}
      </g>
    );
  }

  return (
    <g {...common}>
      <title>{entry.name}</title>
      {body}
      <foreignObject
        x={entry.x - entry.radius}
        y={entry.y - entry.radius}
        width={entry.radius * 2}
        height={entry.radius * 2}
      >
        <button
          type="button"
          data-authority-domain-entry={entry.visualRole ?? undefined}
          disabled={entry.unavailable || !entry.visualRole}
          aria-label={entry.name}
          aria-disabled={entry.unavailable || !entry.visualRole}
          onClick={() => {
            if (entry.unavailable || !entry.visualRole) return;
            onEnterDomain(entry.visualRole);
          }}
          className="h-full w-full cursor-pointer rounded-full bg-transparent disabled:cursor-not-allowed"
        />
      </foreignObject>
    </g>
  );
}

function rootBounds(entries: readonly ActiveAuthorityRootPackedEntry[]) {
  if (entries.length === 0) {
    return { minX: -160, minY: -160, width: 320, height: 320 };
  }
  const pad = 28;
  const minX = Math.min(...entries.map((entry) => entry.x - entry.radius)) - pad;
  const maxX = Math.max(...entries.map((entry) => entry.x + entry.radius)) + pad;
  const minY = Math.min(...entries.map((entry) => entry.y - entry.radius)) - pad;
  const maxY = Math.max(...entries.map((entry) => entry.y + entry.radius)) + pad;
  return {
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}
