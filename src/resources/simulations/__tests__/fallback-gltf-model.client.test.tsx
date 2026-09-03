// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { FallbackGltfModel } from '../components/fallback-gltf-model';

/**
 * 共享回退链的行为合同：主候选失败沿链回退；主候选 URL 变化后错误边界重建，
 * 已回退的场景能恢复到新的可用 LOD（issue #1898 Codex 第五轮 P2 回归）。
 */

const mounts: Array<{ root: Root; container: HTMLDivElement }> = [];

afterEach(async () => {
  while (mounts.length) {
    const mounted = mounts.pop()!;
    await act(async () => mounted.root.unmount());
    mounted.container.remove();
  }
});

/** 在自身渲染阶段抛错（模拟 useGLTF 加载失败），确保被测边界能捕获。 */
function ThrowingModel({ url }: { url: string }) {
  throw new Error(`boom:${url}`);
}

function mount(candidates: readonly string[], badUrls: ReadonlySet<string>) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mounts.push({ root, container });
  const view = (
    <FallbackGltfModel
      candidates={candidates}
      render={(url) => (badUrls.has(url)
        ? <ThrowingModel url={url} />
        : <span data-mounted-url={url} />)}
    />
  );
  act(() => root.render(view));
  return { container, root, view };
}

describe('FallbackGltfModel boundary recovery', () => {
  it('falls through the chain when the primary candidate fails', () => {
    const { container } = mount(['lod0', 'legacy'], new Set(['lod0']));
    expect(container.querySelector('[data-mounted-url="legacy"]')).not.toBeNull();
    expect(container.querySelector('[data-mounted-url="lod0"]')).toBeNull();
  });

  it('recovers to a new primary LOD after an earlier candidate failed', () => {
    const { root, container } = mount(['lod0', 'legacy'], new Set(['lod0']));
    expect(container.querySelector('[data-mounted-url="legacy"]')).not.toBeNull();

    // 质量档切换：新的主候选 lod1 可用——错误边界必须重建并直接挂载 lod1
    act(() => root.render(
      <FallbackGltfModel
        candidates={['lod1', 'legacy']}
        render={(url) => (url === 'lod0'
          ? <ThrowingModel url={url} />
          : <span data-mounted-url={url} />)}
      />
    ));
    expect(container.querySelector('[data-mounted-url="lod1"]')).not.toBeNull();
    expect(container.querySelector('[data-mounted-url="legacy"]')).toBeNull();
  });

  it('still falls back when the new primary also fails', () => {
    const { root, container } = mount(['lod0', 'legacy'], new Set(['lod0']));
    act(() => root.render(
      <FallbackGltfModel
        candidates={['lod1', 'legacy']}
        render={(url) => (url === 'legacy'
          ? <span data-mounted-url={url} />
          : <ThrowingModel url={url} />)}
      />
    ));
    expect(container.querySelector('[data-mounted-url="legacy"]')).not.toBeNull();
    expect(container.querySelector('[data-mounted-url="lod1"]')).toBeNull();
  });
});
