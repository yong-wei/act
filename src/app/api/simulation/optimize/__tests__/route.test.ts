import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  optimizePIDParams: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/nextjs-dynamic-error', () => ({
  rethrowIfNextDynamicError: vi.fn(),
}));

vi.mock('@/resources/simulations/lib/monte-carlo-optimizer', () => ({
  DEFAULT_CONSTRAINTS: {
    kpRange: [0.5, 3],
    kiRange: [0.001, 0.1],
    kdRange: [0.1, 5],
  },
  DEFAULT_TARGET: {
    targetHeading: 90,
    maxError: 150,
    maxRudderRate: 5,
    maxOvershoot: 20,
    minSettlingTime: 90,
  },
  optimizePIDParams: mocks.optimizePIDParams,
}));

import { POST } from '@/app/api/simulation/optimize/route';
import { PID_EVIDENCE_BUILD_SOURCE_HASHES } from '@/lib/pid-evidence-runtime-manifest.generated';

describe('POST /api/simulation/optimize', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.stubEnv('COMMERCIAL_UI_EVIDENCE', '1');
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1' } });
    mocks.optimizePIDParams.mockReturnValue({
      bestParams: { kp: 3, ki: 0.001, kd: 5 },
      score: 85.2,
      metrics: { avgError: 26, maxRudderRate: 5, settlingTime: 80, overshoot: 0 },
      iterations: 1,
      searchTime: 10,
      convergenceHistory: [],
      replay: {
        runId: 'optimizer-student-1-1',
        sceneId: 'simulation/optimizer/nomoto-quick-sim',
        scenarioId: 'turn90-calibrated-v1',
        seed: 1,
        protocolVersion: '1.0',
        runtimeVersion: 'simulation-optimizer-runtime-v2',
        modelVersion: 'nomoto-quick-sim-v1',
        checksum: 'sha256:test',
        scenario: {
          id: 'turn90-calibrated-v1',
          duration: 240,
          referenceCompletedAt: 150,
          headingSchedule: [
            { time: 0, headingDeg: 0 },
            { time: 60, headingDeg: 0 },
            { time: 150, headingDeg: 90 },
            { time: 240, headingDeg: 90 },
          ],
          start: { x: 0, z: 0, headingDeg: 0 },
          maxRudderRateDegPerSec: 5,
        },
      },
    });
  });

  it('returns the calibrated scoring scenario and executing bundle proof', async () => {
    const response = await POST(new Request('http://localhost/api/simulation/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: {}, maxIterations: 1, seed: 1 }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.result.replay.scenario).toEqual({
      id: 'turn90-calibrated-v1',
      duration: 240,
      referenceCompletedAt: 150,
      headingSchedule: [
        { time: 0, headingDeg: 0 },
        { time: 60, headingDeg: 0 },
        { time: 150, headingDeg: 90 },
        { time: 240, headingDeg: 90 },
      ],
      start: { x: 0, z: 0, headingDeg: 0 },
      maxRudderRateDegPerSec: 5,
    });
    expect(body.evidenceBuildSourceHashes).toEqual(PID_EVIDENCE_BUILD_SOURCE_HASHES);
  });
});
