interface DisposableKnowledgeNodeLabelTexture {
  dispose: () => void;
}

export class KnowledgeNodeLabelTextureCache<T extends DisposableKnowledgeNodeLabelTexture> {
  private readonly textures = new Map<string, { texture: T; used: number }>();
  private disposed = false;
  private clock = 0;

  constructor(private readonly maxEntries = 256) {}

  get size(): number {
    return this.textures.size;
  }

  getOrCreate(key: string, create: () => T): T {
    const cached = this.textures.get(key);
    if (cached) {
      cached.used = ++this.clock;
      return cached.texture;
    }
    if (this.disposed) this.disposed = false;
    const texture = create();
    this.textures.set(key, { texture, used: ++this.clock });
    this.evictToLimit(new Set([key]));
    return texture;
  }

  reconcile(activeKeys: ReadonlySet<string>): void {
    for (const [key, entry] of this.textures) {
      if (activeKeys.has(key)) continue;
      entry.texture.dispose();
      this.textures.delete(key);
    }
    this.evictToLimit(activeKeys);
  }

  private evictToLimit(protectedKeys: ReadonlySet<string>): void {
    while (this.textures.size > Math.max(1, this.maxEntries)) {
      const candidates = [...this.textures.entries()]
        .filter(([key]) => !protectedKeys.has(key))
        .sort((left, right) => left[1].used - right[1].used);
      const victim = candidates[0] ?? [...this.textures.entries()]
        .sort((left, right) => left[1].used - right[1].used)[0];
      if (!victim) return;
      victim[1].texture.dispose();
      this.textures.delete(victim[0]);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.textures.forEach(({ texture }) => texture.dispose());
    this.textures.clear();
  }
}

export interface KnowledgeNodeLabelTextureKeyInput {
  theme: 'light' | 'dark';
  font: string;
  policy: string;
  width: number;
  height: number;
  lines: readonly string[];
}

export function createKnowledgeNodeLabelTextureKey(input: KnowledgeNodeLabelTextureKeyInput): string {
  return JSON.stringify({
    theme: input.theme,
    font: input.font,
    policy: input.policy,
    width: input.width,
    height: input.height,
    lines: [...input.lines],
  });
}

export function createKnowledgeNodeLabelTextureView<T extends { clone: () => T }>(owned: T): T {
  return owned.clone();
}
