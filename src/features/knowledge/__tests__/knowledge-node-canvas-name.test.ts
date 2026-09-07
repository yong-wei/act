import { describe, expect, it } from 'vitest';

import {
  deriveKnowledgeNodeCanvasName,
  KNOWLEDGE_NODE_CANVAS_NAME_BUDGET,
  layoutKnowledgeNodeLabel,
} from '../graph/node-label-layout';

describe('canvas name display truncation (#2052 task 2)', () => {
  it('keeps short names unchanged', () => {
    expect(deriveKnowledgeNodeCanvasName('比例控制')).toBe('比例控制');
    expect(deriveKnowledgeNodeCanvasName(null)).toBe('');
    expect(deriveKnowledgeNodeCanvasName(undefined)).toBe('');
  });

  it('truncates long definition sentences at a clause boundary with ellipsis within the budget', () => {
    const longName = '比例控制是指控制器输出与输入偏差成比例的控制规律，其输出的大小取决于偏差的大小，是最基本的比例反馈控制规律';
    const canvas = deriveKnowledgeNodeCanvasName(longName);
    expect(canvas.endsWith('…')).toBe(true);
    expect(Array.from(canvas).length).toBeLessThanOrEqual(KNOWLEDGE_NODE_CANVAS_NAME_BUDGET);
    // 子句边界截断：省略号前的最后一个字符应是子句标点。
    const withoutEllipsis = canvas.slice(0, -1);
    expect(/[，。；：、！？…）】》"']$|[^，。；：、！？…）】》"']$/u.test(withoutEllipsis)).toBe(true);
    // 截断必须是全称前缀（不修改来源内容）。
    expect(longName.startsWith(withoutEllipsis)).toBe(true);
  });

  it('falls back to word or hard truncation when no clause boundary exists in the window', () => {
    const noPunctuation = '超调量是指系统响应超过稳态值的最大偏差幅度通常用百分比表示并且是控制系统的';
    const canvas = deriveKnowledgeNodeCanvasName(noPunctuation);
    expect(canvas.endsWith('…')).toBe(true);
    expect(Array.from(canvas).length).toBeLessThanOrEqual(KNOWLEDGE_NODE_CANVAS_NAME_BUDGET);
  });

  it('keeps the full-name channels intact while the canvas layout truncates', () => {
    const longName = '稳态误差是指系统在稳态条件下输出量与参考输入之间的偏差，反映控制系统对目标值的长期跟踪精度，是评价系统稳态性能的重要指标';
    const canvasName = deriveKnowledgeNodeCanvasName(longName);
    const canvasLayout = layoutKnowledgeNodeLabel(canvasName);
    const fullNameLayout = layoutKnowledgeNodeLabel(longName);
    expect(canvasName).not.toBe(longName);
    expect(canvasLayout.accessibleName).toBe(canvasName);
    // 画布标签行数不超过预算上限；全称通道（hover/抽屉/目录）仍取原始名称。
    expect(canvasLayout.lines.length).toBeLessThanOrEqual(3);
    expect(fullNameLayout.accessibleName).toBe(longName);
  });
});
