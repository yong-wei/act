// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { buildPublishedResourceHref } from '@/lib/published-resource-reference';
import { openResourceViewer } from '../open-resource-viewer';
import { UniversalResourceViewerHost } from '../universal-resource-viewer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('published resource reference viewer', () => {
  it.each(['知识卡', '信息图'])('opens the verified publication page for %s instead of an empty inline shell', async (resourceKind) => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const href = buildPublishedResourceHref({ resourceId: resourceKind === '知识卡' ? 'act:card:published-card' : 'act:infographic:published-infograph',
      projectionId: 'proj-' + 'a'.repeat(64), projectionHash: 'a'.repeat(64),
      snapshotId: 'snap-' + 'b'.repeat(64), snapshotHash: 'b'.repeat(64), resourceVersion: 'c'.repeat(64) });
    try {
      await act(async () => { root.render(<UniversalResourceViewerHost />); });
      await act(async () => { openResourceViewer({ title: '已发布内容', resourceKind, href }); });
      expect(document.querySelector('iframe')?.getAttribute('src')).toBe(href);
      expect(document.body.textContent).not.toContain('当前信息图暂无可显示图像');
    } finally {
      await act(async () => { root.unmount(); });
      container.remove();
    }
  });
});
