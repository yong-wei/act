import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { assertLearningContentAssetsMatchManifest } from '@/lib/runtime-external-input-bundle';

describe('learning content Git path namespace', () => {
  it('accepts runtime-relative Git paths and still rejects missing or unexpected assets', () => {
    const root = mkdtempSync(join(tmpdir(), 'learning-git-paths-'));
    try {
      const dir = join(root, 'course-content/runtime/knowledge');
      mkdirSync(dir, { recursive: true });
      const card = 'knowledge/cards/authority/nodes/node.md';
      const infographic = 'knowledge/infographs/authority/nodes/node.png';
      const manifest = join(dir, 'authority-learning-content-manifest.json');
      execFileSync('git', ['init', '-q', root]);
      const blob = (bytes: string) => execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: root, input: bytes, encoding: 'utf8' }).trim();
      const sha = (bytes: string) => createHash('sha256').update(bytes).digest('hex');
      const cardBlob = blob('card'), infographicBlob = blob('image');
      const gitTree = new Map([[card, cardBlob], [infographic, infographicBlob]]);
      writeFileSync(manifest, JSON.stringify({ nodes: [{ safeId: 'node', card: { state: 'available', sha256: sha('card') }, infograph: { state: 'available', sha256: sha('image') } }] }));
      expect(() => assertLearningContentAssetsMatchManifest(root, [], gitTree)).not.toThrow();
      expect(() => assertLearningContentAssetsMatchManifest(root, [], new Map([[card, cardBlob]]))).toThrow('missing:' + infographic);
      // A matching working-tree asset cannot conceal different captured Git bytes.
      const workingCard = join(root, 'course-content/runtime', card);
      mkdirSync(join(workingCard, '..'), { recursive: true });
      writeFileSync(workingCard, 'card');
      expect(() => assertLearningContentAssetsMatchManifest(root, [], new Map([[card, blob('changed card')], [infographic, infographicBlob]])))
        .toThrow('hash:' + card);
      expect(() => assertLearningContentAssetsMatchManifest(root, [], new Map([[card, cardBlob], [infographic, blob('changed image')]])))
        .toThrow('hash:' + infographic);
      writeFileSync(manifest, JSON.stringify({ nodes: [{ safeId: 'node', card: { state: 'available' }, infograph: { state: 'missing' } }] }));
      expect(() => assertLearningContentAssetsMatchManifest(root, [], gitTree)).toThrow('unexpected:' + infographic);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
