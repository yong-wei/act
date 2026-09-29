import type { ComparisonOceanProbe } from './shared-ocean-surface';

type Sample = { x: number; z: number; height: number; slopeX: number; slopeZ: number; time: number };
/** Bounded scene-local asynchronous contact cache; no second wave model. */
export function createMarineSurfaceSampling() {
  const samples = new Map<string, Sample>();
  const pending = new Map<string, readonly [number, number]>();
  let active = true;
  let busy = false;
  let epoch = 0;
  let lastTime = 0;
  let centerX = 0; let centerZ = 0;
  const keyFor = (x: number, z: number) => `${Math.round(x * 10)}:${Math.round(z * 10)}`;
  return {
    heightAt(x: number, z: number) {
      const key = keyFor(x, z);
      const exact = samples.get(key);
      if (!exact || lastTime - exact.time > 0.1) {
        pending.delete(key); pending.set(key, [x, z]);
        if (pending.size > 128) {
          let farthest = key; let distance = -1;
          for (const [candidate, point] of pending) {
            const d = (point[0] - centerX) ** 2 + (point[1] - centerZ) ** 2;
            if (d > distance) { farthest = candidate; distance = d; }
          }
          pending.delete(farthest);
        }
      }
      if (exact && lastTime - exact.time < 0.5) return exact.height;
      let nearest: Sample | undefined; let distance = 8 * 8;
      for (const sample of samples.values()) {
        if (lastTime - sample.time > 0.5) continue;
        const d = (x - sample.x) ** 2 + (z - sample.z) ** 2;
        if (d < distance) { nearest = sample; distance = d; }
      }
      return nearest ? nearest.height + nearest.slopeX * (x - nearest.x) + nearest.slopeZ * (z - nearest.z) : -1;
    },
    async update(surface: ComparisonOceanProbe, x: number, z: number) {
      centerX = x; centerZ = z;
      lastTime = surface.identity().time;
      if (busy || !active || pending.size === 0) return;
      const batch = [...pending.entries()].sort((a, b) =>
        Math.hypot(a[1][0] - x, a[1][1] - z) - Math.hypot(b[1][0] - x, b[1][1] - z)).slice(0, 8);
      for (const [key] of batch) pending.delete(key);
      const generation = epoch;
      const time = lastTime;
      busy = true;
      try {
        const result = await surface.sampleSurface(batch.map(([, point]) => point));
        if (!active || generation !== epoch) return;
        result.forEach((sample, index) => {
          const key = batch[index][0];
          samples.delete(key); samples.set(key, { ...sample, time });
        });
        while (samples.size > 512) samples.delete(samples.keys().next().value!);
      } finally { busy = false; }
    },
    reset() { epoch += 1; samples.clear(); pending.clear(); lastTime = 0; },
    diagnostics: () => ({ samples: [...samples.values()], pending: pending.size, busy, time: lastTime }),
    dispose() { active = false; epoch += 1; samples.clear(); pending.clear(); },
  };
}
export type MarineSurfaceSampling = ReturnType<typeof createMarineSurfaceSampling>;
