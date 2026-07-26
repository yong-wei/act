// @vitest-environment jsdom

import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';

import {
  migratePreparationMath,
  PREPARATION_EDITOR_DEPENDENCY_DECISION,
  PREPARATION_MARKDOWN_EXTENSIONS,
  replacePreparationMarkdown,
} from '../preparation-document-editor/rich-markdown-editor';

const fixture = `# 控制系统教学设计

## 目标

- 识别闭环结构
- 计算稳态误差

| 环节 | 时间 |
| --- | ---: |
| 导入 | 5 |

\`\`\`ts
const gain = 2
\`\`\`

公式：$E = mc^2$
`;

describe('preparation rich Markdown adapter', () => {
  it('pins one project-owned editor dependency and its supported surface', () => {
    expect(PREPARATION_EDITOR_DEPENDENCY_DECISION).toEqual({
      package: '@tiptap/react',
      version: '3.28.0',
      canonicalFormat: 'markdown',
      supported: ['headings', 'tables', 'inline-math', 'code-blocks', 'lists'],
    });
  });

  it('round-trips headings, tables, formulas, code and lists without losing meaning', () => {
    const first = new Editor({
      extensions: PREPARATION_MARKDOWN_EXTENSIONS,
      content: fixture,
      contentType: 'markdown',
    });
    migratePreparationMath(first);
    expect(JSON.stringify(first.getJSON())).toContain('"type":"inlineMath"');
    const serialized = first.getMarkdown();
    const second = new Editor({
      extensions: PREPARATION_MARKDOWN_EXTENSIONS,
    });
    replacePreparationMarkdown(second, serialized);
    expect(JSON.stringify(second.getJSON())).toContain('"type":"inlineMath"');
    const reopened = second.getMarkdown();

    expect(reopened).toContain('# 控制系统教学设计');
    expect(reopened).toMatch(/\|\s*环节\s*\|\s*时间\s*\|/);
    expect(reopened).toContain('const gain = 2');
    expect(reopened).toContain('识别闭环结构');
    expect(reopened).toContain('E = mc^2');

    first.destroy();
    second.destroy();
  });
});
