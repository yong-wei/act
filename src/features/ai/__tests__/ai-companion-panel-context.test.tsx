import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated' }),
}));

import { AICompanionPanel } from '../companion/ai-companion-panel';

describe('Arena-aware AI companion panel', () => {
  it('renders the selected MPC task fields instead of PID defaults', () => {
    const html = renderToStaticMarkup(
      <AICompanionPanel
        title="横摇对象 MPC 隐藏场景挑战"
        sessionId="arena:task-ship-roll-mpc-hidden-scenarios"
        arenaTaskId="task-ship-roll-mpc-hidden-scenarios"
        method="mpc"
      />,
    );

    expect(html).toContain('预测时域');
    expect(html).toContain('隐藏场景最差表现');
    expect(html).not.toContain('Kp');
  });

  it('mounts the companion in the task-bound control workbench', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/control-workbench/shell/control-workbench-shell.tsx'),
      'utf8',
    );

    expect(source).toContain("from '@/features/ai/companion/ai-companion-panel'");
    expect(source).toContain('<AICompanionPanel');
    expect(source).toContain('arenaTaskId={session.taskId}');
  });
});
