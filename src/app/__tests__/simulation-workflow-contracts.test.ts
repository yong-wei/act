import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readSource(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('simulation workflow remediation contracts', () => {
  it('no longer renders the inert placeholder bottom command strip', () => {
    const source = readSource('src/app/simulations/_components/simulation-local-tools.tsx');

    // 占位命令条（无行为 span）已由 unify-simulation-chrome-and-camera-views 移除，
    // 底部工具收敛为单排 chrome 家族；提示条保留且可关闭。
    expect(source).not.toContain('data-simulation-local-bottom-toolbar-status');
    expect(source).not.toContain('data-task-workspace-zone="bottom-tools"');
    expect(source).toContain('data-simulation-local-hint-strip');
    expect(source).toContain('aria-label="关闭提示"');
    expect(source).not.toContain('className="hidden"');
  });

  it('renders mission and task return context inside the shared simulation shell', () => {
    const shell = readSource('src/app/simulations/_components/simulation-shell.tsx');
    const destroyer = readSource('src/app/simulations/destroyer/page.tsx');

    expect(shell).toContain('data-simulation-task-context="mission-task-return-saveback"');
    expect(shell).toContain('data-originating-task-id={context.taskId}');
    expect(shell).toContain('data-originating-task-title={context.taskTitle}');
    expect(shell).toContain('data-save-back-status={context.saveBackStatus}');
    expect(shell).toContain("'saved' | 'queued' | 'unsupported' | 'failed'");
    expect(destroyer).toContain('taskContext={simulationTaskContext}');
    expect(destroyer).toContain('returnHref={simulationTaskContext?.returnHref}');
    expect(destroyer).toContain('returnLabel={simulationTaskContext?.returnLabel}');
    expect(destroyer).toContain('saveBackStatus');
    expect(destroyer).toContain('feedbackContext.assignmentTitle');
    expect(destroyer).toContain("feedbackContext.lifecycleState === 'written-back'");
    expect(destroyer).toContain("feedbackContext.lifecycleState === 'teacher-visible'");
    expect(destroyer).toContain("return 'saved'");
  });

  it('announces simulation catalog filter results and provides empty-state recovery', () => {
    const source = readSource('src/app/simulations/page.tsx');

    expect(source).toContain('data-simulation-catalog-live-status="filtered-result-count"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('resetSimulationFilters');
    expect(source).toContain('data-simulation-catalog-empty-state="recoverable"');
    expect(source).toContain('data-simulation-catalog-reset-filters');
  });

  it('explains the virtual-lab compatibility redirect destination', () => {
    const virtualLab = readSource('src/app/virtual-lab/page.tsx');
    const simulations = readSource('src/app/simulations/page.tsx');

    expect(virtualLab).toContain("redirect('/simulations?compat=virtual-lab')");
    expect(simulations).toContain("compatibilitySource === 'virtual-lab'");
    expect(simulations).toContain('data-virtual-lab-compatibility-explanation="redirected-to-simulations"');
  });
});
