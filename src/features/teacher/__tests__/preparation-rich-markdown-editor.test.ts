// @vitest-environment jsdom

import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';

import {
  migratePreparationMath,
  insertProtectedEditorImages,
  isProtectedEditorAssetReference,
  PREPARATION_EDITOR_DEPENDENCY_DECISION,
  PREPARATION_MARKDOWN_EXTENSIONS,
  replacePreparationMarkdown,
  validateProtectedEditorMarkdownAssets,
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
      supported: ['headings', 'tables', 'inline-math', 'images', 'code-blocks', 'lists'],
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

  it('round-trips protected images without allowing inline data URLs', () => {
    const editor = new Editor({
      extensions: PREPARATION_MARKDOWN_EXTENSIONS,
      content: '![结构图](/api/assignment-assets/asset-1 "asset:asset-1")',
      contentType: 'markdown',
    });

    expect(editor.getMarkdown()).toContain('/api/assignment-assets/asset-1');
    expect(editor.getMarkdown()).toContain('asset:asset-1');
    expect(isProtectedEditorAssetReference({
      assetId: 'asset-1',
      href: '/api/assignment-assets/asset-1',
    })).toBe(true);
    expect(isProtectedEditorAssetReference({
      assetId: 'asset-1',
      href: 'data:image/png;base64,abc',
    })).toBe(false);
    expect(isProtectedEditorAssetReference({
      assetId: 'asset-1") ![外链](https://example.com/image.png',
      href: '/api/assignment-assets/asset-1)',
    })).toBe(false);
    editor.destroy();
  });

  it('inserts uploaded images through stable protected references and reports failures', async () => {
    const editor = new Editor({ extensions: PREPARATION_MARKDOWN_EXTENSIONS });
    const pending: number[] = [];
    const errors: Array<string | null> = [];
    const files = [
      new File(['first'], 'diagram.png', { type: 'image/png' }),
      new File(['second'], 'broken.png', { type: 'image/png' }),
    ];

    await insertProtectedEditorImages(
      editor,
      files,
      async (file) => {
        if (file.name === 'broken.png') throw new Error('upload-failed');
        return {
          assetId: 'asset-1',
          href: '/api/assignment-assets/asset-1',
          altText: '闭环结构图',
        };
      },
      {
        onPendingChange: (delta) => pending.push(delta),
        onError: (message) => errors.push(message),
      },
    );

    expect(editor.getMarkdown()).toContain('![闭环结构图](/api/assignment-assets/asset-1 "asset:asset-1")');
    expect(pending).toEqual([1, 1, -1, -1]);
    expect(errors.at(-1)).toContain('broken.png');
    editor.destroy();
  });

  it('rejects external, unidentified, and host-foreign image references before save', () => {
    const owned = (asset: { assetId: string }) => asset.assetId === 'asset-owned';
    expect(validateProtectedEditorMarkdownAssets(
      '![图](/api/assignment-assets/asset-owned "asset:asset-owned")',
      owned,
    )).toBe(true);
    expect(validateProtectedEditorMarkdownAssets(
      '![图](https://example.com/image.png "asset:asset-owned")',
      owned,
    )).toBe(false);
    expect(validateProtectedEditorMarkdownAssets(
      '![图](/api/assignment-assets/asset-owned)',
      owned,
    )).toBe(false);
    expect(validateProtectedEditorMarkdownAssets(
      '![图](/api/assignment-assets/asset-foreign "asset:asset-foreign")',
      owned,
    )).toBe(false);
    expect(validateProtectedEditorMarkdownAssets(
      '<img src="https://example.com/image.png" alt="外部图">',
      owned,
    )).toBe(false);
  });
});
