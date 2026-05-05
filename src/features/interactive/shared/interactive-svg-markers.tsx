import type { SVGProps } from 'react';

export type InteractiveSvgMarkerKind =
  | 'arrow-slim-concave'
  | 'arrow-open-wide-concave'
  | 'dot-filled'
  | 'dot-hollow'
  | 'diamond-filled'
  | 'diamond-hollow'
  | 'start-dot-filled'
  | 'start-dot-hollow'
  | 'pole-cross';

export type InteractiveSvgPointMarkerKind = Exclude<
  InteractiveSvgMarkerKind,
  'arrow-slim-concave' | 'arrow-open-wide-concave'
>;

export const INTERACTIVE_SVG_MARKER_KINDS: InteractiveSvgMarkerKind[] = [
  'arrow-slim-concave',
  'arrow-open-wide-concave',
  'dot-filled',
  'dot-hollow',
  'diamond-filled',
  'diamond-hollow',
  'start-dot-filled',
  'start-dot-hollow',
  'pole-cross'
];

export const INTERACTIVE_SVG_PRODUCTION_ARROW_KIND = 'arrow-slim-concave' satisfies InteractiveSvgMarkerKind;
export const INTERACTIVE_SVG_LEGACY_REVIEW_ARROW_KIND = 'arrow-open-wide-concave' satisfies InteractiveSvgMarkerKind;

const DEFAULT_PREFIX = 'interactive-svg-marker';
const BASE_LINE_STROKE_WIDTH = 7;
const BASE_SLIM_ARROW_SIZE = 32;
const BASE_OPEN_ARROW_SIZE = 24;
const BASE_STANDARD_MARKER_SIZE = 30;
const ECHARTS_POLE_CROSS_SYMBOL =
  'path://M -0.85 -0.58 L -0.58 -0.85 L 0 -0.27 L 0.58 -0.85 L 0.85 -0.58 L 0.27 0 L 0.85 0.58 L 0.58 0.85 L 0 0.27 L -0.58 0.85 L -0.85 0.58 L -0.27 0 Z';

export class InteractiveSvgMarkerRegistry {
  static markerId(kind: InteractiveSvgMarkerKind, prefix = DEFAULT_PREFIX) {
    return `${prefix}-${kind}`;
  }

  static markerUrl(kind: InteractiveSvgMarkerKind, prefix = DEFAULT_PREFIX) {
    return `url(#${InteractiveSvgMarkerRegistry.markerId(kind, prefix)})`;
  }
}

export function getInteractiveSvgMarkerSize(kind: InteractiveSvgMarkerKind, lineStrokeWidth = BASE_LINE_STROKE_WIDTH) {
  const baseSize = kind === 'arrow-slim-concave'
    ? BASE_SLIM_ARROW_SIZE
    : kind === 'arrow-open-wide-concave'
      ? BASE_OPEN_ARROW_SIZE
      : BASE_STANDARD_MARKER_SIZE;
  return Number(((lineStrokeWidth / BASE_LINE_STROKE_WIDTH) * baseSize).toFixed(2));
}

export function getInteractiveSvgMarkerStrokeWidth(kind: InteractiveSvgMarkerKind, lineStrokeWidth = BASE_LINE_STROKE_WIDTH) {
  if (kind === 'arrow-open-wide-concave') return lineStrokeWidth;
  if (kind === 'pole-cross') return Math.max(1.8, lineStrokeWidth * 0.55);
  if (kind === 'dot-hollow' || kind === 'diamond-hollow' || kind === 'start-dot-hollow') {
    return Math.max(1.6, lineStrokeWidth * 0.38);
  }
  return Math.max(1.4, lineStrokeWidth * 0.24);
}

type MarkerStyle = {
  color: string;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth: number;
};

function markerStyle(color: string, strokeWidth: number, fillColor?: string, strokeColor?: string): MarkerStyle {
  return {
    color,
    fillColor: fillColor ?? color,
    strokeColor: strokeColor ?? color,
    strokeWidth
  };
}

function hollowMarkerFill(style: MarkerStyle) {
  return style.fillColor === style.color ? 'white' : style.fillColor;
}

function markerViewport(size: number, aspect = 1) {
  return {
    markerWidth: size,
    markerHeight: size * aspect
  };
}

function renderMarkerShape(kind: InteractiveSvgMarkerKind, style: MarkerStyle) {
  switch (kind) {
    case 'arrow-slim-concave':
      return (
        <path
          d="M1 1.35 C4.75 2.7 9.65 4.25 16.2 6 C9.65 7.75 4.75 9.3 1 10.65 Z"
          fill={style.fillColor}
        />
      );
    case 'arrow-open-wide-concave':
      return (
        <g fill="none" stroke={style.strokeColor} strokeLinecap="round" strokeLinejoin="round" strokeWidth={style.strokeWidth}>
          <path d="M1.2 -12.5 C6.15 5 20 7 22.2 7.5" />
          <path d="M1.2 27.5 C6.15 10 20 8 22.2 7.5" />
        </g>
      );
    case 'dot-filled':
    case 'start-dot-filled':
      return <circle cx="6" cy="6" r="3.45" fill={style.fillColor} />;
    case 'dot-hollow':
    case 'start-dot-hollow':
      return <circle cx="6" cy="6" r="3.25" fill={hollowMarkerFill(style)} stroke={style.strokeColor} strokeWidth={style.strokeWidth} />;
    case 'diamond-filled':
      return <path d="M6 1.25 L10.75 6 L6 10.75 L1.25 6 Z" fill={style.fillColor} />;
    case 'diamond-hollow':
      return <path d="M6 1.45 L10.55 6 L6 10.55 L1.45 6 Z" fill={hollowMarkerFill(style)} stroke={style.strokeColor} strokeLinejoin="round" strokeWidth={style.strokeWidth} />;
    case 'pole-cross':
      return (
        <path
          d="M2.25 2.25 L9.75 9.75 M9.75 2.25 L2.25 9.75"
          fill="none"
          stroke={style.strokeColor}
          strokeLinecap="round"
          strokeWidth={style.strokeWidth + 0.25}
        />
      );
    default:
      return null;
  }
}

function markerProps(kind: InteractiveSvgMarkerKind, size: number) {
  if (kind === 'arrow-slim-concave') {
    return {
      viewBox: '0 0 17 12',
      refX: 1,
      refY: 6,
      ...markerViewport(size, 12 / 17)
    };
  }

  if (kind === 'arrow-open-wide-concave') {
    return {
      viewBox: '-7 -24 38 64',
      refX: 11.4,
      refY: 7.5,
      markerWidth: size * 1.58,
      markerHeight: size * 2.67
    };
  }

  if (kind === 'dot-hollow') {
    return {
      viewBox: '0 0 12 12',
      refX: 2.75,
      refY: 6,
      ...markerViewport(size)
    };
  }

  if (kind === 'diamond-hollow') {
    return {
      viewBox: '0 0 12 12',
      refX: 1.45,
      refY: 6,
      ...markerViewport(size)
    };
  }

  if (kind === 'start-dot-hollow') {
    return {
      viewBox: '0 0 12 12',
      refX: 9.25,
      refY: 6,
      ...markerViewport(size)
    };
  }

  return {
    viewBox: '0 0 12 12',
    refX: 6,
    refY: 6,
    ...markerViewport(size)
  };
}

export function InteractiveSvgMarkerDefs({
  prefix = DEFAULT_PREFIX,
  color = 'currentColor',
  fillColor,
  strokeColor,
  size,
  lineStrokeWidth = BASE_LINE_STROKE_WIDTH,
  strokeWidth,
  kinds = INTERACTIVE_SVG_MARKER_KINDS
}: {
  prefix?: string;
  color?: string;
  fillColor?: string;
  strokeColor?: string;
  size?: number;
  lineStrokeWidth?: number;
  strokeWidth?: number;
  kinds?: InteractiveSvgMarkerKind[];
}) {
  return (
    <defs>
      {kinds.map((kind) => {
        const markerSize = size ?? getInteractiveSvgMarkerSize(kind, lineStrokeWidth);
        const markerStrokeWidth = strokeWidth ?? getInteractiveSvgMarkerStrokeWidth(kind, lineStrokeWidth);
        const style = markerStyle(color, markerStrokeWidth, fillColor, strokeColor);
        const props = markerProps(kind, markerSize);
        return (
          <marker
            key={kind}
            id={InteractiveSvgMarkerRegistry.markerId(kind, prefix)}
            markerUnits="userSpaceOnUse"
            orient="auto"
            {...props}
          >
            {renderMarkerShape(kind, style)}
          </marker>
        );
      })}
    </defs>
  );
}

export function InteractiveSvgPointMarker({
  kind,
  x,
  y,
  size = 12,
  color = 'currentColor',
  fillColor,
  strokeColor,
  strokeWidth = 1.7,
  ...props
}: {
  kind: InteractiveSvgPointMarkerKind;
  x: number;
  y: number;
  size?: number;
  color?: string;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
} & Omit<SVGProps<SVGGElement>, 'color'>) {
  const style = markerStyle(color, strokeWidth, fillColor, strokeColor);
  const scale = size / 12;

  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${scale})`} {...props}>
      {renderMarkerShape(kind, style)}
    </g>
  );
}

export function getInteractiveSvgEChartsPointMarker(
  kind: InteractiveSvgPointMarkerKind,
  {
    size = kind === 'pole-cross' ? 18 : 10,
    color = 'currentColor',
    fillColor,
    strokeColor,
    strokeWidth = kind === 'pole-cross' ? 2.2 : 1.8,
  }: {
    size?: number;
    color?: string;
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
  } = {},
) {
  const resolvedFill = fillColor ?? (
    kind === 'dot-hollow' || kind === 'diamond-hollow' || kind === 'start-dot-hollow'
      ? '#ffffff'
      : color
  );
  const resolvedStroke = strokeColor ?? color;

  if (kind === 'pole-cross') {
    return {
      symbol: ECHARTS_POLE_CROSS_SYMBOL,
      symbolSize: size,
      itemStyle: { color: resolvedStroke },
      lineStyle: { color: resolvedStroke, width: strokeWidth },
    };
  }

  return {
    symbol: kind === 'diamond-filled' || kind === 'diamond-hollow' ? 'diamond' : 'circle',
    symbolSize: size,
    itemStyle: {
      color: resolvedFill,
      borderColor: resolvedStroke,
      borderWidth: kind === 'dot-filled' || kind === 'diamond-filled' || kind === 'start-dot-filled'
        ? (strokeColor ? strokeWidth : 0)
        : strokeWidth,
    },
  };
}
