import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  getControlWorkbenchObjectGroups,
  selectControlWorkbenchObject,
} from '../object-selection';
import { resolveControlWorkbenchSession } from '../session-resolver';

const repoRoot = process.cwd();

function freeExploreSession() {
  const result = resolveControlWorkbenchSession({
    mode: 'explore',
    preset: 'classic-four-view',
  });

  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected free explore session');
  if (result.session.mode !== 'explore') throw new Error('Expected explore session');
  return result.session;
}

describe('control workbench object selection', () => {
  it('groups object options with selected state, LaTeX model, and labels', () => {
    const groups = getControlWorkbenchObjectGroups(freeExploreSession());
    const typicalGroup = groups.find((group) => group.id === 'typical');
    const selected = groups.flatMap((group) => group.options).find((option) => option.selected);

    expect(typicalGroup?.label).toBe('典型对象');
    expect(selected).toMatchObject({
      id: 'plant-second-order-underdamped',
      selected: true,
      compatible: true,
      modelLatex: 'G(s)=\\frac{16}{s^2+2.4s+16}',
    });
    expect(selected?.labels.map((label) => label.value)).toEqual(
      expect.arrayContaining(['典型对象', '白箱模型', 'transfer-function']),
    );
  });

  it('updates the free-explore session when a compatible white-box object is selected', () => {
    const result = selectControlWorkbenchObject(freeExploreSession(), 'plant-first-order-lag');

    expect(result.error).toBeUndefined();
    if (result.session.mode !== 'explore') throw new Error('Expected explore session');
    expect(result.session.object.id).toBe('plant-first-order-lag');
    expect(result.session.selectedObjectId).toBe('plant-first-order-lag');
    expect(result.session.workingModel?.sourceObjectId).toBe('plant-first-order-lag');
    expect(result.session.workingModel?.representation.kind).toBe('transfer-function');
    if (result.session.workingModel?.representation.kind !== 'transfer-function') {
      throw new Error('Expected transfer-function working model');
    }
    expect(result.session.workingModel?.representation.latex).toBe('G(s)=\\frac{4}{2s+1}');
  });

  it('keeps the previous working model when an incompatible object is selected', () => {
    const session = freeExploreSession();
    const result = selectControlWorkbenchObject(session, 'plant-cruise-roll-blackbox');

    expect(result.error).toContain('当前预设只支持公开传递函数的白箱对象');
    expect(result.session.object.id).toBe('plant-second-order-underdamped');
    expect(result.session.workingModel?.sourceObjectId).toBe('plant-second-order-underdamped');
  });

  it('renders a collapsible selector with formula rendering and label semantics in the shell', () => {
    const source = readFileSync(
      join(repoRoot, 'src/features/control-workbench/shell/control-workbench-shell.tsx'),
      'utf8',
    );

    expect(source).toContain('aria-expanded');
    expect(source).toContain('InlineMath');
    expect(source).toContain('对象选择');
    expect(source).toContain('aria-disabled');
    expect(source).toContain('dark:border-cyan');
  });
});
