import { describe, expect, it } from 'vitest';

import {
  resolveGovernedRegistryCard,
  verifyGovernedRegistryCard,
} from '@/features/ai/companion/governed-registry-card';
import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';

/**
 * 治理注册表资源卡身份与内容哈希校验：
 * 以真实注册表条目验证「解析成功 + 打开校验通过」，内容字段变化产生哈希漂移。
 */

const SAMPLE_NODE = (() => {
  const first = getAllRegisteredResourceMetadata()[0];
  return first ? `registry:${first.id}` : null;
})();

describe('governed registry resource card', () => {
  it.skipIf(SAMPLE_NODE === null)('round-trips a registered resource with a content hash', () => {
    const card = resolveGovernedRegistryCard(SAMPLE_NODE as string);
    expect(card).not.toBeNull();
    expect(card?.kind).toBe('governed-registry-resource');
    expect(card?.versionHash).toMatch(/^registry-sha256:[a-f0-9]{64}$/);

    const verified = verifyGovernedRegistryCard(card!.resourceId, card!.versionHash);
    expect(verified.status).toBe('available');
  });

  it.skipIf(SAMPLE_NODE === null)('degrades on hash drift when governance content changes', () => {
    const card = resolveGovernedRegistryCard(SAMPLE_NODE as string);
    expect(card).not.toBeNull();
    const drifted = verifyGovernedRegistryCard(card!.resourceId, 'registry-sha256:deadbeef');
    expect(drifted).toMatchObject({ status: 'unavailable', reason: 'hash-drift' });
  });

  it('returns null for unknown or removed registry nodes', () => {
    expect(resolveGovernedRegistryCard('registry:definitely-not-registered')).toBeNull();
    expect(resolveGovernedRegistryCard('not-a-registry-id')).toBeNull();
    expect(verifyGovernedRegistryCard('registry:definitely-not-registered', 'registry-sha256:0').status)
      .toBe('unavailable');
  });
});
