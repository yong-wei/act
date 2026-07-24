import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  cloneDesignState,
  createDesignSnapshot,
  getRestoredPointIdentityCounters,
  readDesignSnapshots,
  writeDesignSnapshots,
  type MultiRepresentationDesignState,
} from '../multi-representation-linkage/design-snapshots';
import { DEFAULT_CORRECTION_STATE } from '../multi-representation-linkage/model';

function createDesign(): MultiRepresentationDesignState {
  return {
    objectId: 'object-a',
    modelPoles: [{ id: 'p-1', re: -1, im: 0, pairKey: null }],
    modelZeros: [],
    gain: 2,
    closedLoopGain: 2,
    responseType: 'step',
    showMargins: true,
    correctionState: { ...DEFAULT_CORRECTION_STATE, enabled: true, controllerGain: 2 },
    timeRange: { start: 0, end: 10, samples: 201 },
    frequencyRange: { min: 0.1, max: 20, samples: 80 },
  };
}

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe('design snapshots', () => {
  it('deeply isolates a saved design from later edits', () => {
    const design = createDesign();
    const snapshot = createDesignSnapshot(design, 0, 42);
    design.modelPoles[0]!.re = -9;
    design.correctionState.controllerGain = 9;
    design.timeRange.end = 99;

    expect(snapshot.design.modelPoles[0]!.re).toBe(-1);
    expect(snapshot.design.correctionState.controllerGain).toBe(2);
    expect(snapshot.design.timeRange.end).toBe(10);
  });

  it('round-trips valid snapshots through session storage', () => {
    const storage = createStorage();
    const snapshot = createDesignSnapshot(createDesign(), 1, 42);
    writeDesignSnapshots(storage, 'workbench-a', [snapshot]);

    expect(readDesignSnapshots(storage, 'workbench-a')).toEqual([snapshot]);
    expect(readDesignSnapshots(storage, 'workbench-b')).toEqual([]);
  });

  it('ignores corrupted session values without altering a valid design', () => {
    const storage = createStorage();
    storage.setItem('workbench-a', JSON.stringify([{ id: 'bad', design: { gain: 'not-a-number' } }]));

    expect(readDesignSnapshots(storage, 'workbench-a')).toEqual([]);
    expect(cloneDesignState(createDesign()).objectId).toBe('object-a');
  });

  it('advances editable point identity counters beyond restored snapshot points', () => {
    const design = createDesign();
    design.modelPoles = [
      { id: 'pole-102', re: -1, im: 1, pairKey: 'pole-pair-104' },
      { id: 'pole-103', re: -1, im: -1, pairKey: 'pole-pair-104' },
    ];
    design.modelZeros = [{ id: 'zero-118', re: -2, im: 0, pairKey: null }];

    expect(getRestoredPointIdentityCounters(design)).toEqual({ id: 119, pair: 105 });
  });

  it('connects visible snapshots to all four classic comparison views as static series', () => {
    const pageSource = readFileSync(
      join(process.cwd(), 'src/features/interactive/multi-representation-linkage/page-client.tsx'),
      'utf8',
    );
    const chartSource = readFileSync(
      join(process.cwd(), 'src/resources/control-system/charts/control-analysis-panels.tsx'),
      'utf8',
    );

    expect(pageSource).toContain('TimeDomainComparisonPanel panels={panels}');
    expect(pageSource).toContain('visibleSnapshotSeries.map');
    expect(pageSource).toContain('comparisonSeries={visibleSnapshotSeries}');
    expect(pageSource).toContain('NyquistPanel result={selectedNyquistSource.result} comparisonSeries={visibleSnapshotSeries}');
    expect(chartSource).toContain('staticComparisonSeries');
    expect(chartSource).toContain('staticComparisonMarkerSeries');
    expect(chartSource).toContain('snapshotOpenLoopPoles');
    expect(chartSource).toContain('snapshotOpenLoopZeros');
    expect(chartSource).toContain('snapshotCurrentPoles');
    expect(chartSource).toContain('silent: true');
  });

  it('keeps Arena artifact construction independent from design snapshots', () => {
    const artifactSource = readFileSync(
      join(process.cwd(), 'src/features/arena/workbench/artifact-mappers.ts'),
      'utf8',
    );
    const submitSource = readFileSync(
      join(process.cwd(), 'src/features/interactive/multi-representation-linkage/arena-submit-panel.tsx'),
      'utf8',
    );

    expect(artifactSource).toContain('const { task, correctionState, now } = input;');
    expect(artifactSource).not.toContain('DesignSnapshot');
    expect(submitSource).toContain('correctionState,');
    expect(submitSource).not.toContain('designSnapshots');
  });
});
