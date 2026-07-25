import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SCENE_DIR = path.join(process.cwd(), 'src/resources/simulations/scene');
const ASSET_DIR = path.join(process.cwd(), 'public/assets/simulation-scene');
const EXPERIMENT_IDS = ['destroyer', 'lng', 'container', 'cruise', 'drilling', 'icebreaker', 'dredger'];

function walkFiles(dir: string, filter: (name: string) => boolean): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(full, filter));
    else if (filter(entry.name)) files.push(full);
  }
  return files;
}

describe('scene pipeline module skeleton', () => {
  const modules = ['water', 'wake', 'environment', 'camera', 'audio', 'quality', 'annotations', 'post'];

  it.each(modules)('has shared module %s with an entry point', (mod) => {
    expect(existsSync(path.join(SCENE_DIR, mod, 'index.ts'))).toBe(true);
  });

  it('keeps pipeline modules free of experiment-specific hardcoding', () => {
    const files = walkFiles(SCENE_DIR, (name) => /\.(ts|tsx)$/.test(name));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const id of EXPERIMENT_IDS) {
        expect(source, `${file} must not hardcode experiment id "${id}"`).not.toContain(id);
      }
    }
  });

  it('defines the ship visual profile contract', () => {
    const types = readFileSync(path.join(SCENE_DIR, 'types.ts'), 'utf8');
    expect(types).toContain('SceneShipVisualProfile');
    expect(types).toContain('shipLengthMeters');
    expect(types).toContain('designSpeedKnots');
    expect(types).toContain('wakeAnchors');
  });
});

describe('simulation scene assets', () => {
  it('keeps manifest entries and files in one-to-one correspondence', () => {
    const manifest = JSON.parse(
      readFileSync(path.join(ASSET_DIR, 'manifest.json'), 'utf8')
    ) as { files: string[] };
    const listed = new Set(manifest.files);
    const onDisk = walkFiles(
      ASSET_DIR,
      (name) => name !== 'manifest.json' && name !== 'PROVENANCE.md'
    ).map((file) => path.relative(ASSET_DIR, file));
    for (const file of onDisk) {
      expect(listed.has(file), `asset ${file} is not listed in manifest.json`).toBe(true);
    }
    for (const file of listed) {
      expect(existsSync(path.join(ASSET_DIR, file)), `manifest asset ${file} is missing on disk`).toBe(true);
    }
  });
});
