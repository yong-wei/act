import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveControlWorkbenchSession } from '../session-resolver';

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('classic four-view control workbench preset', () => {
  it('resolves the second-order Arena task to the classic white-box preset', () => {
    const result = resolveControlWorkbenchSession({
      arenaTask: 'task-second-order-lead-pid',
      preset: 'multi-representation-linkage',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.session.defaultPreset).toBe('classic-whitebox');
    expect(result.session.allowedViews).toEqual(
      expect.arrayContaining(['time-domain', 'bode', 'root-locus', 'nyquist']),
    );
    expect(result.session.allowedViews).not.toContain('metric-summary');
    expect(result.session.workingModel?.representation.kind).toBe('transfer-function');
  });

  it('mounts the classic preset from the unified control workbench shell', () => {
    expect(existsSync(join(repoRoot, 'src/features/control-workbench/presets/classic-four-view-preset.tsx'))).toBe(true);

    const shellSource = readRepoFile('src/features/control-workbench/shell/control-workbench-shell.tsx');
    const presetSource = readRepoFile('src/features/control-workbench/presets/classic-four-view-preset.tsx');

    expect(shellSource).toContain('ClassicFourViewPreset');
    expect(shellSource).toContain("session.defaultPreset === 'classic-whitebox'");
    expect(shellSource).not.toContain("session.defaultPreset === 'classic-whitebox' && 'taskId' in session");
    expect(shellSource).toContain('viewConfigs={viewConfigs}');
    expect(presetSource).toContain('MultiRepresentationLinkageClient');
    expect(presetSource).toContain("arenaTaskId: 'taskId' in session ? session.taskId : undefined");
    expect(presetSource).toContain('plantModel,');
    expect(presetSource).toContain('embed: true');
    expect(presetSource).toContain("publicationId: 'publicationId' in session ? session.publicationId : undefined");
    expect(presetSource).toContain('viewConfigs: mapClassicViewConfigs(viewConfigs)');
  });

  it('remounts the embedded chart client when the selected plant model changes', () => {
    const presetSource = readRepoFile('src/features/control-workbench/presets/classic-four-view-preset.tsx');

    expect(presetSource).toContain('const plantModel = buildClassicPlantModel(session)');
    expect(presetSource).toContain("key={plantModel?.objectId ?? plantModel?.id ?? 'classic-whitebox'}");
    expect(presetSource).toContain('plantModel,');
  });

  it('resolves free explore to a renderable classic preset model', () => {
    const result = resolveControlWorkbenchSession({
      mode: 'explore',
      preset: 'classic-four-view',
    });
    const presetSource = readRepoFile('src/features/control-workbench/presets/classic-four-view-preset.tsx');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.session.mode).toBe('explore');
    expect('taskId' in result.session).toBe(false);
    expect(result.session.defaultPreset).toBe('classic-whitebox');
    expect(result.session.allowedViews).toEqual(
      expect.arrayContaining(['time-domain', 'bode', 'root-locus', 'nyquist']),
    );
    expect(result.session.workingModel?.representation.kind).toBe('transfer-function');
    expect(presetSource).not.toContain("!('taskId' in session)");
    expect(presetSource).toContain('session.workingModel');
  });

  it('renders the naked free-explore control workbench through the classic four-view client', () => {
    const result = resolveControlWorkbenchSession({});
    const shellSource = readRepoFile('src/features/control-workbench/shell/control-workbench-shell.tsx');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.session.defaultPreset).toBe('free-explore');
    expect(result.session.allowedViews).toEqual(
      expect.arrayContaining(['time-domain', 'bode', 'root-locus', 'nyquist']),
    );
    expect(result.session.workingModel?.representation.kind).toBe('transfer-function');
    expect(shellSource).toContain("session.defaultPreset === 'classic-whitebox' || session.defaultPreset === 'free-explore'");
    expect(shellSource).toContain('<ClassicFourViewPreset');
  });

  it('keeps the legacy multi-representation route as the shared client wrapper', () => {
    const routeSource = readRepoFile('src/app/interactive-learning/multi-representation-linkage/page.tsx');

    expect(routeSource).toContain('MultiRepresentationLinkageClient');
    expect(routeSource).toContain('arenaTaskId: firstValue(searchParams?.arenaTask)');
    expect(routeSource).toContain('publicationId: firstValue(searchParams?.publicationId)');
  });

  it('passes workbench view selection into the embedded chart rendering', () => {
    const clientSource = readRepoFile('src/features/interactive/multi-representation-linkage/page-client.tsx');
    const submitSource = readRepoFile('src/features/interactive/multi-representation-linkage/arena-submit-panel.tsx');

    expect(clientSource).toContain('selectedViewOptions');
    expect(clientSource).toContain("initialParams.viewConfigs");
    expect(clientSource).toContain('resolvePanelSelectedOptions(panel, timeDomainOptions)');
    expect(clientSource).toContain('resolvePanelSelectedOptions(panel, bodeOptions)');
    expect(clientSource).toContain('resolvePanelSelectedOptions(panel, nyquistOptions)');
    expect(clientSource).toContain("options.has('corrected-output')");
    expect(clientSource).toContain("options.has('correction-device')");
    expect(clientSource).toContain("options.has('uncorrected-open-loop')");
    expect(clientSource).toContain('const [panelSourceSelections, setPanelSourceSelections]');
    expect(clientSource).toContain('selectPanelSource(panelSourceSelections, panel.id, sourceOptions)');
    expect(clientSource).toContain('[panelId]: sourceId');
    expect(clientSource).not.toContain('rootLocusSourceId');
    expect(clientSource).not.toContain('nyquistSourceId');
    expect(clientSource).toContain('publicationId={initialParams.publicationId}');
    expect(submitSource).toContain('publicationId');
    expect(submitSource).toContain('publicationId,');
  });

  it('keeps incompatible classic preset requests fail-closed and Chinese', () => {
    const result = resolveControlWorkbenchSession({
      arenaTask: 'task-cruise-roll-blackbox-identification',
      preset: 'multi-representation-linkage',
    });
    const presetSource = readRepoFile('src/features/control-workbench/presets/classic-four-view-preset.tsx');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.session.defaultPreset).toBe('classic-whitebox');
    expect(result.session.workingModel).toBeNull();
    expect(presetSource).toContain('当前挑战不支持经典白箱四视图工作台');
    expect(presetSource).toContain('不会渲染隐藏对象的传递函数图表');
  });
});
