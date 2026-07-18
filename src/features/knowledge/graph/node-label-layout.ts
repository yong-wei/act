export const KNOWLEDGE_NODE_LABEL_POLICY = {
  fontSize: 13,
  minimumReadableFontSize: 12,
  fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
  fontWeight: 600,
  font: '600 13px "PingFang SC", "Microsoft YaHei", sans-serif',
  maxWidth: 96,
  maxLines: 3,
  lineHeight: 16,
  ellipsis: '…',
  emptyName: '未命名知识节点',
  collisionScale: 1,
  collisionPadding: 6,
  maxMeasuredCharacters: 4096,
} as const;

export const KNOWLEDGE_ROOT_LABEL_POLICY = {
  fontSize: 14,
  minimumReadableFontSize: 12,
  fontFamily: KNOWLEDGE_NODE_LABEL_POLICY.fontFamily,
  fontWeight: 700,
  font: '700 14px "PingFang SC", "Microsoft YaHei", sans-serif',
  minimumLineWidth: KNOWLEDGE_NODE_LABEL_POLICY.maxWidth,
  maxLines: 3,
  lineHeight: 17,
  bubblePadding: 14,
  minimumBubbleRadius: 28,
} as const;

export const KNOWLEDGE_GRAPH_3D_SCREEN_SPACE_CONTRACT = {
  minimumFontSize: KNOWLEDGE_NODE_LABEL_POLICY.minimumReadableFontSize,
  maximumFontSize: 16,
  maximumLabelWorldScale: 4,
  minimumNodeRadius: 4.5,
  maximumNodeWorldScaleGain: 1.45,
  minimumArrowLength: 10,
  maximumArrowWorldLength: 48,
} as const;

export function getKnowledgeGraph3DLabelWorldScale(input: {
  labelScale: number;
  projectedScale: number;
}): number {
  const projectedScale = Math.max(0.0001, input.projectedScale);
  const naturalScreenFontSize = KNOWLEDGE_NODE_LABEL_POLICY.fontSize
    * Math.max(0, input.labelScale) * projectedScale;
  const screenFontSize = Math.min(
    KNOWLEDGE_GRAPH_3D_SCREEN_SPACE_CONTRACT.maximumFontSize,
    Math.max(KNOWLEDGE_GRAPH_3D_SCREEN_SPACE_CONTRACT.minimumFontSize, naturalScreenFontSize),
  );
  return Math.min(
    KNOWLEDGE_GRAPH_3D_SCREEN_SPACE_CONTRACT.maximumLabelWorldScale,
    screenFontSize / (KNOWLEDGE_NODE_LABEL_POLICY.fontSize * projectedScale),
  );
}

export function getKnowledgeGraph3DNodePresentationRadius(
  naturalRadius: number,
  projectedScale: number,
): number {
  const safeRadius = Math.max(0, naturalRadius);
  const readableRadius = KNOWLEDGE_GRAPH_3D_SCREEN_SPACE_CONTRACT.minimumNodeRadius
    / Math.max(0.0001, projectedScale);
  return Math.min(
    safeRadius * KNOWLEDGE_GRAPH_3D_SCREEN_SPACE_CONTRACT.maximumNodeWorldScaleGain,
    Math.max(safeRadius, readableRadius),
  );
}

export function getKnowledgeGraph3DArrowLength(projectedScale: number): number {
  return Math.min(
    KNOWLEDGE_GRAPH_3D_SCREEN_SPACE_CONTRACT.maximumArrowWorldLength,
    Math.max(3, KNOWLEDGE_GRAPH_3D_SCREEN_SPACE_CONTRACT.minimumArrowLength
      / Math.max(0.0001, projectedScale)),
  );
}

export type KnowledgeNodeLabelMeasureText = (text: string) => number;

interface KnowledgeNodeLabelCanvasMeasureContext {
  font: string;
  measureText: (text: string) => { width: number };
}

export interface KnowledgeNodeLabelLine {
  text: string;
  width: number;
}

export interface KnowledgeNodeLabelLayout {
  accessibleName: string;
  displayName: string;
  lines: KnowledgeNodeLabelLine[];
  width: number;
  height: number;
  truncated: boolean;
}

export interface KnowledgeNodeLabelBounds {
  halfWidth: number;
  halfHeight: number;
  collisionRadius: number;
  label: KnowledgeNodeLabelLayout;
}

export interface KnowledgeNodeLabelPaintModel {
  font: string;
  layout: KnowledgeNodeLabelLayout;
  lines: Array<KnowledgeNodeLabelLine & { y: number }>;
}

export interface KnowledgeRootLabelLayout extends KnowledgeNodeLabelLayout {
  fontSize: number;
}

export function getKnowledgeNodeSemanticLabel(
  name: string | null | undefined,
  kind: 'domain' | 'node'
) {
  const accessibleName = layoutKnowledgeNodeLabel(name).accessibleName;
  return {
    accessibleName,
    ariaLabel: `${accessibleName}，${kind === 'domain' ? '知识领域' : '知识节点'}`,
    title: accessibleName,
  };
}

function isWideCharacter(character: string): boolean {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Emoji_Presentation}]/u.test(character);
}

export function createKnowledgeNodeLabelFallbackMeasureText(): KnowledgeNodeLabelMeasureText {
  return (text) => Array.from(text).reduce((width, character) => {
    if (/\p{Mark}/u.test(character)) return width;
    if (/\s/u.test(character)) return width + 4.2;
    if (isWideCharacter(character)) return width + KNOWLEDGE_NODE_LABEL_POLICY.fontSize;
    if (/[WM]/u.test(character)) return width + KNOWLEDGE_NODE_LABEL_POLICY.fontSize;
    if (/[A-Z]/u.test(character)) return width + 9.2;
    if (/[a-z0-9]/u.test(character)) return width + 7.1;
    return width + 5.6;
  }, 0);
}

export function createCanvasKnowledgeNodeLabelMeasureText(
  context: KnowledgeNodeLabelCanvasMeasureContext
): KnowledgeNodeLabelMeasureText {
  context.font = KNOWLEDGE_NODE_LABEL_POLICY.font;
  return (text) => {
    context.font = KNOWLEDGE_NODE_LABEL_POLICY.font;
    const width = context.measureText(text).width;
    return Number.isFinite(width) && width >= 0
      ? width
      : createKnowledgeNodeLabelFallbackMeasureText()(text);
  };
}

const fallbackMeasureText = createKnowledgeNodeLabelFallbackMeasureText();
let sharedCanvasMeasureText: KnowledgeNodeLabelMeasureText | null = null;

export function getSharedKnowledgeNodeLabelMeasureText(): KnowledgeNodeLabelMeasureText {
  if (sharedCanvasMeasureText) return sharedCanvasMeasureText;
  if (typeof document === 'undefined') return fallbackMeasureText;
  if (typeof CanvasRenderingContext2D === 'undefined') return fallbackMeasureText;
  try {
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return fallbackMeasureText;
    sharedCanvasMeasureText = createCanvasKnowledgeNodeLabelMeasureText(context);
    return sharedCanvasMeasureText;
  } catch {
    return fallbackMeasureText;
  }
}

export function measureKnowledgeNodeLabelText(text: string): number {
  return getSharedKnowledgeNodeLabelMeasureText()(text);
}

function splitDisplayTokens(text: string): string[] {
  return text.match(/\s+|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Emoji_Presentation}]|[^\s\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Emoji_Presentation}]+/gu) ?? [];
}

function splitTextAtMeasuredWidth(
  text: string,
  maxWidth: number,
  measureText: KnowledgeNodeLabelMeasureText
): string[] {
  const lines: string[] = [];
  let current = '';
  for (const character of Array.from(text)) {
    const candidate = `${current}${character}`;
    if (current && measureText(candidate) > maxWidth) {
      lines.push(current.trim());
      current = character.trimStart();
    } else {
      current = candidate;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}

export function layoutKnowledgeRootLabel(
  name: string | null | undefined,
  measureText: KnowledgeNodeLabelMeasureText = getSharedKnowledgeNodeLabelMeasureText()
): KnowledgeRootLabelLayout {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const accessibleName = trimmedName || KNOWLEDGE_NODE_LABEL_POLICY.emptyName;
  const displayName = accessibleName.replace(/\s+/gu, ' ');
  const measuredWidth = measureText(displayName);
  const targetLineWidth = Math.max(
    KNOWLEDGE_ROOT_LABEL_POLICY.minimumLineWidth,
    Math.ceil(measuredWidth / KNOWLEDGE_ROOT_LABEL_POLICY.maxLines)
  );
  const lineTexts = splitTextAtMeasuredWidth(displayName, targetLineWidth, measureText);

  while (lineTexts.length > KNOWLEDGE_ROOT_LABEL_POLICY.maxLines) {
    const shortestPairIndex = lineTexts.slice(0, -1).reduce((bestIndex, line, index) => {
      const width = measureText(`${line}${lineTexts[index + 1]}`);
      const bestWidth = measureText(`${lineTexts[bestIndex]}${lineTexts[bestIndex + 1]}`);
      return width < bestWidth ? index : bestIndex;
    }, 0);
    lineTexts.splice(
      shortestPairIndex,
      2,
      `${lineTexts[shortestPairIndex]}${lineTexts[shortestPairIndex + 1]}`
    );
  }

  const lines = lineTexts.map((text) => ({ text, width: measureText(text) }));
  return {
    accessibleName,
    displayName,
    lines,
    width: Math.max(0, ...lines.map((line) => line.width)),
    height: lines.length * KNOWLEDGE_ROOT_LABEL_POLICY.lineHeight,
    truncated: false,
    fontSize: KNOWLEDGE_ROOT_LABEL_POLICY.fontSize,
  };
}

export function getKnowledgeRootLabelBounds(input: {
  name: string | null | undefined;
  minimumBodyRadius?: number;
  measureText?: KnowledgeNodeLabelMeasureText;
}): KnowledgeNodeLabelBounds {
  const label = layoutKnowledgeRootLabel(input.name, input.measureText);
  const labelHalfWidth = label.width / 2 + KNOWLEDGE_ROOT_LABEL_POLICY.bubblePadding;
  const labelHalfHeight = label.height / 2 + KNOWLEDGE_ROOT_LABEL_POLICY.bubblePadding;
  const collisionRadius = Math.max(
    input.minimumBodyRadius ?? 0,
    KNOWLEDGE_ROOT_LABEL_POLICY.minimumBubbleRadius,
    Math.hypot(labelHalfWidth, labelHalfHeight)
  );
  return {
    halfWidth: labelHalfWidth,
    halfHeight: labelHalfHeight,
    collisionRadius,
    label,
  };
}

export function getKnowledgeRootLabelPaintModel(
  name: string | null | undefined,
  measureText: KnowledgeNodeLabelMeasureText = getSharedKnowledgeNodeLabelMeasureText()
): KnowledgeNodeLabelPaintModel {
  const layout = layoutKnowledgeRootLabel(name, measureText);
  return {
    font: KNOWLEDGE_ROOT_LABEL_POLICY.font,
    layout,
    lines: layout.lines.map((line, index) => ({
      ...line,
      y: (index - (layout.lines.length - 1) / 2) * KNOWLEDGE_ROOT_LABEL_POLICY.lineHeight,
    })),
  };
}

function fitTokenPrefix(token: string, measureText: KnowledgeNodeLabelMeasureText): [string, string] {
  const characters = Array.from(token);
  let end = 0;
  while (end < characters.length) {
    const candidate = characters.slice(0, end + 1).join('');
    if (measureText(candidate) > KNOWLEDGE_NODE_LABEL_POLICY.maxWidth) break;
    end += 1;
  }
  const safeEnd = Math.max(1, end);
  return [characters.slice(0, safeEnd).join(''), characters.slice(safeEnd).join('')];
}

function withTerminalEllipsis(text: string, measureText: KnowledgeNodeLabelMeasureText): string {
  const ellipsis = KNOWLEDGE_NODE_LABEL_POLICY.ellipsis;
  const characters = Array.from(text.trimEnd()).filter((character) => character !== ellipsis);
  while (
    characters.length > 0
    && measureText(`${characters.join('')}${ellipsis}`) > KNOWLEDGE_NODE_LABEL_POLICY.maxWidth
  ) {
    characters.pop();
  }
  return `${characters.join('')}${ellipsis}`;
}

export function layoutKnowledgeNodeLabel(
  name: string | null | undefined,
  measureText: KnowledgeNodeLabelMeasureText = getSharedKnowledgeNodeLabelMeasureText()
): KnowledgeNodeLabelLayout {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const accessibleName = trimmedName || KNOWLEDGE_NODE_LABEL_POLICY.emptyName;
  const normalizedName = accessibleName.replace(/\s+/gu, ' ');
  const measuredCharacters = Array.from(normalizedName);
  const sourceWasCapped = measuredCharacters.length > KNOWLEDGE_NODE_LABEL_POLICY.maxMeasuredCharacters;
  const displayName = measuredCharacters
    .slice(0, KNOWLEDGE_NODE_LABEL_POLICY.maxMeasuredCharacters)
    .join('');
  const pending = splitDisplayTokens(displayName);
  const lineTexts: string[] = [];
  let currentLine = '';

  while (pending.length > 0 && lineTexts.length < KNOWLEDGE_NODE_LABEL_POLICY.maxLines) {
    const token = pending.shift()!;
    if (/^\s+$/u.test(token) && currentLine.length === 0) continue;
    const candidate = `${currentLine}${token}`.trimEnd();
    if (candidate && measureText(candidate) <= KNOWLEDGE_NODE_LABEL_POLICY.maxWidth) {
      currentLine = `${currentLine}${token}`;
      continue;
    }
    if (currentLine.trim().length > 0) {
      lineTexts.push(currentLine.trim());
      currentLine = '';
      pending.unshift(token);
      continue;
    }
    if (/^\s+$/u.test(token)) continue;
    const [prefix, remainder] = fitTokenPrefix(token, measureText);
    lineTexts.push(prefix);
    if (remainder) pending.unshift(remainder);
  }

  if (currentLine.trim().length > 0 && lineTexts.length < KNOWLEDGE_NODE_LABEL_POLICY.maxLines) {
    lineTexts.push(currentLine.trim());
    currentLine = '';
  }

  const truncated = sourceWasCapped || pending.length > 0 || currentLine.trim().length > 0;
  if (truncated && lineTexts.length > 0) {
    lineTexts[lineTexts.length - 1] = withTerminalEllipsis(lineTexts[lineTexts.length - 1], measureText);
  }

  const lines = lineTexts.map((text) => ({ text, width: measureText(text) }));
  return {
    accessibleName,
    displayName,
    lines,
    width: Math.max(0, ...lines.map((line) => line.width)),
    height: lines.length * KNOWLEDGE_NODE_LABEL_POLICY.lineHeight,
    truncated,
  };
}

export function getKnowledgeNodeLabelBounds(input: {
  name: string | null | undefined;
  bodyRadius: number;
  measureText?: KnowledgeNodeLabelMeasureText;
}): KnowledgeNodeLabelBounds {
  const label = layoutKnowledgeNodeLabel(input.name, input.measureText);
  const labelHalfWidth = label.width * KNOWLEDGE_NODE_LABEL_POLICY.collisionScale / 2
    + KNOWLEDGE_NODE_LABEL_POLICY.collisionPadding;
  const labelHalfHeight = label.height * KNOWLEDGE_NODE_LABEL_POLICY.collisionScale / 2
    + KNOWLEDGE_NODE_LABEL_POLICY.collisionPadding;
  const halfWidth = Math.max(input.bodyRadius, labelHalfWidth);
  const halfHeight = Math.max(input.bodyRadius, labelHalfHeight);
  return {
    halfWidth,
    halfHeight,
    collisionRadius: Math.hypot(halfWidth, halfHeight),
    label,
  };
}

export function getKnowledgeNodeLabelPaintModel(
  name: string | null | undefined,
  measureText: KnowledgeNodeLabelMeasureText = getSharedKnowledgeNodeLabelMeasureText()
): KnowledgeNodeLabelPaintModel {
  const layout = layoutKnowledgeNodeLabel(name, measureText);
  return {
    font: KNOWLEDGE_NODE_LABEL_POLICY.font,
    layout,
    lines: layout.lines.map((line, index) => ({
      ...line,
      y: (index - (layout.lines.length - 1) / 2) * KNOWLEDGE_NODE_LABEL_POLICY.lineHeight,
    })),
  };
}

export function getKnowledgeNodeLabelTextureSize(
  layout: KnowledgeNodeLabelLayout,
  textureScale: number
) {
  const safeScale = Number.isFinite(textureScale) && textureScale > 0 ? textureScale : 1;
  return {
    width: Math.max(1, Math.ceil(
      (layout.width + KNOWLEDGE_NODE_LABEL_POLICY.collisionPadding * 2) * safeScale
    )),
    height: Math.max(1, Math.ceil(
      (layout.height + KNOWLEDGE_NODE_LABEL_POLICY.collisionPadding * 2) * safeScale
    )),
  };
}

export function getKnowledgeNodeLabelSpritePresentation(layout: KnowledgeNodeLabelLayout) {
  return {
    position: [0, 0, 0] as const,
    scale: [
      layout.width + KNOWLEDGE_NODE_LABEL_POLICY.collisionPadding * 2,
      layout.height + KNOWLEDGE_NODE_LABEL_POLICY.collisionPadding * 2,
      1,
    ] as const,
    depthTest: false,
    depthWrite: false,
    renderOrder: 10,
  };
}
