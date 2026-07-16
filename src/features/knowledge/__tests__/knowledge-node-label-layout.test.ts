import { describe, expect, it } from 'vitest';

import {
  KNOWLEDGE_GRAPH_3D_SCREEN_SPACE_CONTRACT,
  KNOWLEDGE_NODE_LABEL_POLICY,
  createCanvasKnowledgeNodeLabelMeasureText,
  createKnowledgeNodeLabelFallbackMeasureText,
  getKnowledgeGraph3DArrowLength,
  getKnowledgeGraph3DLabelWorldScale,
  getKnowledgeGraph3DNodePresentationRadius,
  getKnowledgeNodeLabelBounds,
  getKnowledgeNodeLabelPaintModel,
  getKnowledgeNodeLabelSpritePresentation,
  getKnowledgeNodeLabelTextureSize,
  getKnowledgeNodeSemanticLabel,
  layoutKnowledgeNodeLabel,
  type KnowledgeNodeLabelMeasureText,
} from '../graph/node-label-layout';

const reviewMeasureText: KnowledgeNodeLabelMeasureText = (text) => Array.from(text).reduce((width, character) => {
  if (character === 'W' || character === 'M') return width + 16;
  if (/\p{Script=Han}/u.test(character)) return width + 13;
  if (/\s/u.test(character)) return width + 4;
  return width + 7;
}, 0);

describe('shared knowledge node label layout', () => {
  it.each([
    ['1280x720 dark default', 0.75],
    ['1280x720 light fit-view', 0.35],
    ['390x844 dark default', 0.55],
    ['390x844 light fit-view', 0.4],
  ])('bounds 3D screen-space readability for %s', (_case, projectedScale) => {
    const labelWorldScale = getKnowledgeGraph3DLabelWorldScale({ labelScale: 1, projectedScale });
    const radius = getKnowledgeGraph3DNodePresentationRadius(6, projectedScale);
    const arrowLength = getKnowledgeGraph3DArrowLength(projectedScale);
    expect(13 * labelWorldScale * projectedScale).toBeGreaterThanOrEqual(12 - Number.EPSILON * 12);
    expect(13 * labelWorldScale * projectedScale).toBeLessThanOrEqual(16);
    expect(radius).toBeGreaterThanOrEqual(6);
    expect(radius).toBeLessThanOrEqual(6 * 1.45);
    expect(arrowLength * projectedScale).toBeGreaterThanOrEqual(
      KNOWLEDGE_GRAPH_3D_SCREEN_SPACE_CONTRACT.minimumArrowLength,
    );
    expect(arrowLength).toBeLessThanOrEqual(
      KNOWLEDGE_GRAPH_3D_SCREEN_SPACE_CONTRACT.maximumArrowWorldLength,
    );
  });
  it('caps pathological 3D label world scale while keeping normal fit projections readable', () => {
    expect(getKnowledgeGraph3DLabelWorldScale({ labelScale: 1, projectedScale: 0.0001 })).toBe(4);
    expect(getKnowledgeGraph3DLabelWorldScale({ labelScale: 1, projectedScale: 0.75 })).toBeLessThanOrEqual(4);
  });
  it.each([
    ['中文标签适合按字换行', '中文标签适合按字换行'],
    ['Pneumonoultramicroscopicsilicovolcanoconiosis', 'Pneumonoultramicroscopicsilicovolcanoconiosis'],
    ['状态空间 StateSpaceRepresentation 混合文本', '状态空间 StateSpaceRepresentation 混合文本'],
  ])('wraps %s with the same bounded policy', (name, accessibleName) => {
    const layout = layoutKnowledgeNodeLabel(name);

    expect(layout.lines.length).toBeGreaterThan(1);
    expect(layout.lines).toHaveLength(Math.min(layout.lines.length, KNOWLEDGE_NODE_LABEL_POLICY.maxLines));
    expect(layout.lines.every((line) => line.width <= KNOWLEDGE_NODE_LABEL_POLICY.maxWidth)).toBe(true);
    expect(layout.accessibleName).toBe(accessibleName);
    expect(layout.width).toBeLessThanOrEqual(KNOWLEDGE_NODE_LABEL_POLICY.maxWidth);
  });

  it.each([
    'WWWWWWWWWWWWWWWWWWWW',
    'MMMMMMMMMMMMMMMMMMMM',
    '连续中文标签用于验证真实测量',
    '混合WWWW控制MMMM文本LongWord',
    `WWMM中文${'ExtremelyLongWWMM'.repeat(100)}`,
  ])('uses the injected renderer measurement for %s', (name) => {
    const layout = layoutKnowledgeNodeLabel(name, reviewMeasureText);

    expect(layout.lines.every((line) => line.width === reviewMeasureText(line.text))).toBe(true);
    expect(layout.lines.every((line) => line.width <= KNOWLEDGE_NODE_LABEL_POLICY.maxWidth)).toBe(true);
    if (layout.truncated) expect(layout.lines.at(-1)?.text.endsWith('…')).toBe(true);
  });

  it('creates a shared Canvas measurement provider and a conservative no-DOM fallback', () => {
    const context = {
      font: '',
      measureText: (text: string) => ({ width: Array.from(text).length * 17 }),
    };
    const canvasMeasure = createCanvasKnowledgeNodeLabelMeasureText(context);
    const fallbackMeasure = createKnowledgeNodeLabelFallbackMeasureText();

    expect(canvasMeasure('WW')).toBe(34);
    expect(context.font).toBe(KNOWLEDGE_NODE_LABEL_POLICY.font);
    expect(fallbackMeasure('WW')).toBeGreaterThanOrEqual(KNOWLEDGE_NODE_LABEL_POLICY.fontSize * 2);
    expect(fallbackMeasure('MM')).toBeGreaterThanOrEqual(KNOWLEDGE_NODE_LABEL_POLICY.fontSize * 2);
    expect(fallbackMeasure('中文')).toBeGreaterThanOrEqual(KNOWLEDGE_NODE_LABEL_POLICY.fontSize * 2);
  });

  it('uses an explicit fallback for an empty name without exposing implementation language', () => {
    const layout = layoutKnowledgeNodeLabel(' \n\t ');

    expect(layout.accessibleName).toBe('未命名知识节点');
    expect(layout.lines.map((line) => line.text).join('')).toBe('未命名知识节点');
    expect(layout.truncated).toBe(false);
  });

  it('truncates an extreme name predictably with one terminal ellipsis', () => {
    const name = `超长知识节点${'MixedUnbrokenWord中文'.repeat(800)}`;
    const first = layoutKnowledgeNodeLabel(name);
    const second = layoutKnowledgeNodeLabel(name);

    expect(second).toEqual(first);
    expect(first.lines).toHaveLength(KNOWLEDGE_NODE_LABEL_POLICY.maxLines);
    expect(first.lines.at(-1)?.text.endsWith(KNOWLEDGE_NODE_LABEL_POLICY.ellipsis)).toBe(true);
    expect(first.lines.flatMap((line) => Array.from(line.text)).filter((character) => (
      character === KNOWLEDGE_NODE_LABEL_POLICY.ellipsis
    ))).toHaveLength(1);
    expect(first.accessibleName).toBe(name);
    expect(first.truncated).toBe(true);
  });

  it('returns centered rectangular bounds that include the label and bounded node body', () => {
    const short = getKnowledgeNodeLabelBounds({ name: '短名', bodyRadius: 10 });
    const long = getKnowledgeNodeLabelBounds({
      name: 'A deliberately long English knowledge concept label',
      bodyRadius: 10,
    });

    expect(short.halfWidth).toBeGreaterThanOrEqual(10);
    expect(short.halfHeight).toBeGreaterThanOrEqual(10);
    expect(long.halfWidth).toBeGreaterThan(short.halfWidth);
    expect(long.collisionRadius).toBeCloseTo(Math.hypot(long.halfWidth, long.halfHeight));
    expect(long.label.lines.length).toBeLessThanOrEqual(KNOWLEDGE_NODE_LABEL_POLICY.maxLines);
  });

  it('keeps the complete untruncated name in semantic button and tooltip text', () => {
    const name = `完整名称${'VeryLongMixedName中文'.repeat(40)}`;
    const semantic = getKnowledgeNodeSemanticLabel(name, 'node');

    expect(semantic.accessibleName).toBe(name);
    expect(semantic.ariaLabel).toBe(`${name}，知识节点`);
    expect(semantic.title).toBe(name);
    expect(getKnowledgeNodeSemanticLabel('', 'domain')).toEqual({
      accessibleName: '未命名知识节点',
      ariaLabel: '未命名知识节点，知识领域',
      title: '未命名知识节点',
    });
  });

  it('uses one measured layout for 2D painting, 3D texture sizing, and centered sprite projection', () => {
    const name = 'WWWW中文MMMM mixed label';
    const paint = getKnowledgeNodeLabelPaintModel(name, reviewMeasureText);
    const texture = getKnowledgeNodeLabelTextureSize(paint.layout, 4);
    const sprite = getKnowledgeNodeLabelSpritePresentation(paint.layout);

    expect(paint.lines.every((line) => reviewMeasureText(line.text) <= paint.layout.width)).toBe(true);
    expect(texture.width).toBeGreaterThanOrEqual(
      Math.ceil((paint.layout.width + KNOWLEDGE_NODE_LABEL_POLICY.collisionPadding * 2) * 4)
    );
    expect(texture.height).toBeGreaterThanOrEqual(
      Math.ceil((paint.layout.height + KNOWLEDGE_NODE_LABEL_POLICY.collisionPadding * 2) * 4)
    );
    expect(sprite.position).toEqual([0, 0, 0]);
    expect(sprite.depthTest).toBe(false);
    expect(sprite.depthWrite).toBe(false);
    expect(sprite.renderOrder).toBeGreaterThan(0);

    const rotatedOrigin = sprite.position.map((coordinate) => coordinate * Math.cos(Math.PI / 3));
    expect(rotatedOrigin).toEqual([0, 0, 0]);
  });
});
