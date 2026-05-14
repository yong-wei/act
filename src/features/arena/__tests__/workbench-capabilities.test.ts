import { describe, it, expect } from 'vitest';
import { ARENA_CHALLENGE_OBJECTS } from '../data/seed-challenges';
import { inferArenaObjectCapabilities } from '../workbench/capabilities';

describe('inferArenaObjectCapabilities', () => {
  it('white-box transfer-function objects support root locus, Bode, Nyquist', () => {
    const objs = ARENA_CHALLENGE_OBJECTS.filter(
      (o) => o.visibility === 'white-box' && o.adapterType === 'transfer-function',
    );
    expect(objs.length).toBeGreaterThanOrEqual(4);
    for (const obj of objs) {
      const caps = inferArenaObjectCapabilities(obj);
      expect(caps.supportsRootLocus).toBe(true);
      expect(caps.supportsBode).toBe(true);
      expect(caps.supportsNyquist).toBe(true);
      expect(caps.supportsStepResponse).toBe(true);
    }
  });

  it('white-box objects support PID and serial correction', () => {
    const objs = ARENA_CHALLENGE_OBJECTS.filter((o) => o.visibility === 'white-box' && o.adapterType === 'transfer-function');
    for (const obj of objs) {
      const caps = inferArenaObjectCapabilities(obj);
      expect(caps.supportsPid).toBe(true);
      expect(caps.supportsSerialCorrection).toBe(true);
    }
  });

  it('black-box objects support identification but not analysis', () => {
    const objs = ARENA_CHALLENGE_OBJECTS.filter((o) => o.visibility === 'black-box');
    for (const obj of objs) {
      const caps = inferArenaObjectCapabilities(obj);
      expect(caps.supportsIdentification).toBe(true);
      expect(caps.supportsRootLocus).toBe(false);
      expect(caps.supportsBode).toBe(false);
      expect(caps.supportsNyquist).toBe(false);
    }
  });

  it('black-box objects do not expose transfer function capability', () => {
    const objs = ARENA_CHALLENGE_OBJECTS.filter((o) => o.visibility === 'black-box');
    for (const obj of objs) {
      const caps = inferArenaObjectCapabilities(obj);
      expect(caps.hasTransferFunction).toBe(false);
    }
  });

  it('virtual-simulation white-box objects support virtual simulation preview', () => {
    const objs = ARENA_CHALLENGE_OBJECTS.filter(
      (o) => o.source === 'virtual-simulation' && o.visibility === 'white-box',
    );
    for (const obj of objs) {
      const caps = inferArenaObjectCapabilities(obj);
      expect(caps.supportsVirtualSimulationPreview).toBe(true);
    }
  });

  it('objects with workbenchSeed are multi-representation compatible', () => {
    const objs = ARENA_CHALLENGE_OBJECTS.filter((o) => o.workbenchSeed !== undefined);
    for (const obj of objs) {
      const caps = inferArenaObjectCapabilities(obj);
      expect(caps.supportsRootLocus).toBe(true);
      expect(caps.supportsBode).toBe(true);
    }
  });

  it('covers all four required object types', () => {
    const types = new Set(
      ARENA_CHALLENGE_OBJECTS.map((o) => `${o.visibility}:${o.adapterType ?? 'none'}`),
    );
    expect(types.has('white-box:transfer-function')).toBe(true);
    expect(types.has('white-box:homework')).toBe(true);
    expect(types.has('white-box:virtual-simulation')).toBe(true);
    expect(types.has('black-box:virtual-simulation')).toBe(true);
  });
});
