/**
 * 场景资源台账（#2103）：注册/释放/复用的有界生命周期跟踪与稳态断言。
 *
 * 纯模块。预设切换与路由进出后资源计数应回到文档化稳态区间——台账提供
 * 计数与"未释放泄漏"报告；释放仍被共享缓存的纹理由所有者声明（shared）
 * 不计为泄漏。QA 探针可读取当前快照。
 */

export type MarineResourceKind =
  | 'pmrem-render-target'
  | 'pmrem-generator'
  | 'water-material'
  | 'water-geometry'
  | 'wake-buffer'
  | 'environment-object-geometry';

export interface MarineResourceEntry {
  readonly id: string;
  readonly kind: MarineResourceKind;
  /** 共享缓存所有（如 preset PMREM）：释放由所有者管理，不计泄漏。 */
  readonly shared?: boolean;
  /** 估算字节（RT/纹理为估算，不冒充显存测量）。 */
  readonly estimatedBytes?: number;
}

export class MarineSceneResourceLedger {
  private readonly entries = new Map<string, MarineResourceEntry>();

  register(entry: MarineResourceEntry): void {
    this.entries.set(entry.id, entry);
  }

  release(id: string): boolean {
    return this.entries.delete(id);
  }

  count(kind?: MarineResourceKind): number {
    if (!kind) return this.entries.size;
    let total = 0;
    for (const entry of this.entries.values()) {
      if (entry.kind === kind) total += 1;
    }
    return total;
  }

  /** 估算字节合计（仅报告口径）。 */
  estimatedBytes(): number {
    let total = 0;
    for (const entry of this.entries.values()) total += entry.estimatedBytes ?? 0;
    return total;
  }

  snapshot(): readonly MarineResourceEntry[] {
    return [...this.entries.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  /**
   * 稳态检查：重复切换/路由循环后，非共享残留即泄漏。
   * 返回泄漏条目（shared 与空台账都通过）。
   */
  leaks(): readonly MarineResourceEntry[] {
    return this.snapshot().filter((entry) => !entry.shared);
  }
}

/** 全局默认台账（QA 探针与模块注册用）。 */
export const marineSceneResourceLedger = new MarineSceneResourceLedger();
