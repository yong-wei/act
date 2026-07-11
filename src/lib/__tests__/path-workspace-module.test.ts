import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PathWorkspaceModule } from '@/features/adaptive/path-workspace-module';

describe('PathWorkspaceModule', () => {
  it('stacks title and trailing content at narrow widths without removing readable title width', () => {
    const html = renderToStaticMarkup(createElement(
      PathWorkspaceModule,
      {
        moduleId: 'current-path',
        openModuleId: 'current-path',
        onToggle: () => undefined,
        eyebrow: 'Active route',
        title: '当前学习路径',
        summary: '紧凑摘要',
        trailing: createElement('span', null, '当前节点：验证阶跃响应'),
      },
      createElement('div', null, '路径内容'),
    ));

    expect(html).toContain('data-adaptive-path-module-header="responsive"');
    expect(html).toContain('flex-col');
    expect(html).toContain('sm:flex-row');
    expect(html).toContain('min-w-0');
    expect(html).toContain('break-words');
    expect(html).toContain('max-w-full');
  });
});
