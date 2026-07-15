import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import {
  createKnowledgeNodeLabelTextureKey,
  createKnowledgeNodeLabelTextureView,
  KnowledgeNodeLabelTextureCache,
} from '../graph/node-label-texture-cache';

describe('knowledge node label texture cache', () => {
  it('reuses stable textures and disposes every cached texture exactly once', () => {
    const cache = new KnowledgeNodeLabelTextureCache<{ dispose: () => void }>();
    const first = { dispose: vi.fn() };
    const second = { dispose: vi.fn() };
    const firstFactory = vi.fn(() => first);

    expect(cache.getOrCreate('dark|共享标签', firstFactory)).toBe(first);
    expect(cache.getOrCreate('dark|共享标签', firstFactory)).toBe(first);
    expect(cache.getOrCreate('light|共享标签', () => second)).toBe(second);
    expect(firstFactory).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(2);

    cache.dispose();
    cache.dispose();

    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(second.dispose).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(0);
  });

  it('reconciles A to B to A without returning a disposed resource and stays bounded', () => {
    const cache = new KnowledgeNodeLabelTextureCache<{ dispose: () => void }>(1);
    const firstA = { dispose: vi.fn() };
    const secondA = { dispose: vi.fn() };
    const b = { dispose: vi.fn() };
    expect(cache.getOrCreate('A', () => firstA)).toBe(firstA);
    cache.reconcile(new Set(['B']));
    expect(firstA.dispose).toHaveBeenCalledTimes(1);
    expect(cache.getOrCreate('B', () => b)).toBe(b);
    cache.reconcile(new Set(['A']));
    expect(b.dispose).toHaveBeenCalledTimes(1);
    expect(cache.getOrCreate('A', () => secondA)).toBe(secondA);
    expect(cache.size).toBe(1);
    cache.dispose();
    expect(secondA.dispose).toHaveBeenCalledTimes(1);
  });

  it('uses a structured key for theme, font, policy, dimensions, and lines', () => {
    const base = { font: '600 13px sans', policy: 'v1', width: 96, height: 48 };
    const dark = createKnowledgeNodeLabelTextureKey({ ...base, theme: 'dark', lines: ['A|B', 'C'] });
    const light = createKnowledgeNodeLabelTextureKey({ ...base, theme: 'light', lines: ['A|B', 'C'] });
    const collisionCandidate = createKnowledgeNodeLabelTextureKey({
      ...base, theme: 'dark', lines: ['A', 'B|C'],
    });
    expect(new Set([dark, light, collisionCandidate])).toHaveLength(3);
  });

  it('keeps the cached Three texture independent from an externally disposed sprite view', () => {
    const cache = new KnowledgeNodeLabelTextureCache<THREE.Texture>();
    const owned = new THREE.Texture();
    const ownedDispose = vi.spyOn(owned, 'dispose');
    const cached = cache.getOrCreate('owned', () => owned);
    const spriteView = createKnowledgeNodeLabelTextureView(cached);
    expect(spriteView).not.toBe(owned);
    spriteView.dispose();
    expect(ownedDispose).not.toHaveBeenCalled();
    cache.reconcile(new Set());
    expect(ownedDispose).toHaveBeenCalledTimes(1);
  });
});
