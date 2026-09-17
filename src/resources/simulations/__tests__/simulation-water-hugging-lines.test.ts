import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const LINES_INDEX = path.join(ROOT, 'src/resources/simulations/scene/lines/index.tsx');
const DESTROYER = path.join(ROOT, 'src/resources/simulations/simulations/destroyer-simulation.tsx');
const ACTUAL_PATH = path.join(ROOT, 'src/resources/simulations/scene/annotations/actual-path-trail.tsx');

const read = (file: string) => readFileSync(file, 'utf8');

describe('water-hugging line module', () => {
  it('lifts vertices by the near-field visible surface query with epsilon and low-tier stride (#2098)', () => {
    const source = read(LINES_INDEX);
    expect(source).toContain('createNearFieldSurfaceQuery');
    expect(source).toContain('epsilon');
    expect(source).toContain("waterTier === 'low'");
  });

  it('includes the Gerstner water mesh base height so lines hug the actual surface', () => {
    const source = read(LINES_INDEX);
    expect(source).toContain('GERSTNER_WATER_BASE_Y');
    // 与可见近场曲面同一坐标基准：网格跟随原点（舰位）采样
    expect(source).toContain('waterOriginSampler');
  });
});

describe('experiment line overlays migrated to water hugging', () => {
  it.each([
    ['lng-simulation.tsx', 'TrajectoryLine'],
    ['container-simulation.tsx', 'TrajectoryLine'],
    ['cruise-simulation.tsx', 'TrajectoryLine'],
    ['cruise-simulation.tsx', 'DesiredRouteLine'],
    ['drilling-simulation.tsx', 'TrajectoryLine'],
    ['dredger-simulation.tsx', 'TrajectoryLine'],
    ['icebreaker-simulation.tsx', 'TrailLine'],
  ])('%s routes %s through WaterHuggingLine', (file, component) => {
    const source = read(path.join(ROOT, 'src/resources/simulations/simulations', file));
    const start = source.indexOf(`function ${component}`);
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, start + 900);
    expect(body).toContain('WaterHuggingLine');
  });

  it('routes the annotations actual path trail through water hugging', () => {
    const source = read(ACTUAL_PATH);
    expect(source).toContain('WaterHuggingLine');
  });
});

describe('destroyer heading convention adaptation', () => {
  it('feeds wake and camera samplers through the adapter on psi radians', () => {
    const source = read(DESTROYER);
    expect(source).toContain('transformRef.current.heading = platformHeadingToSceneRad(toDegrees(sim.headingRad))');
    expect(source).toContain('headingSampler={() => platformHeadingToSceneRad(toDegrees(simRef.current.headingRad))}');
    expect(source).not.toContain('headingSampler={() => simRef.current.headingRad}');
    expect(source).not.toContain('transformRef.current.heading = sim.headingRad');
  });

  it('feeds the annotations target heading through the adapter', () => {
    const source = read(DESTROYER);
    expect(source).toContain('targetHeadingSampler={() => platformHeadingToSceneRad(scenarioLogic.getDesiredHeading(hudState.time))}');
    expect(source).not.toContain('targetHeadingSampler={() => toRadians(');
  });
});
