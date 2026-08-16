/**
 * Snapshot-bound reviewed zh-CN labels for the 25 v0.18 neighborhood objects
 * whose sealed preferred row is missing or classifier-unsafe.
 */

import type { AuthoritativeV2MultilingualLabelRecord } from '@/lib/authoritative-knowledge/contracts';
import { projectionCanonicalJson, projectionSha256 } from '@/lib/teaching-projection/hash';

export const V018_REVIEWED_NEIGHBORHOOD_OVERLAY_CONTRACT =
  'actkg-v018-reviewed-neighborhood-labels/v1' as const;
export const V018_REVIEWED_NEIGHBORHOOD_MERGE_POLICY =
  'replace-unsafe-preferred-omit-unsafe-alternatives/v1' as const;

export const V018_REVIEWED_NEIGHBORHOOD_RELEASE_ID =
  'ctr:release:control-theory-engineering-v0.18' as const;
export const V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_ID =
  'snap-1b64a853dda5668d83d0d2f09cadf72937330ced6aa49611f8027a9d5ec008ed' as const;
export const V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_HASH =
  '1b64a853dda5668d83d0d2f09cadf72937330ced6aa49611f8027a9d5ec008ed' as const;

const ROWS: readonly { entityId: string; label: string }[] = Object.freeze([
  { entityId: 'ctc:c782502fe412ef828c662650', label: '闭环传递函数伴随概念' },
  { entityId: 'ctkg:v3e-canonical-b7b7a94ac3ee3d3acf2ef957', label: '复极点冲激响应陈述' },
  { entityId: 'ctkg:v3e-canonical-daf84a56d5b06c9372f9f94e', label: '双实极点冲激响应陈述' },
  { entityId: 'ctkg:v3e-object-03b16fad0404c4dd8faf890e', label: '电容冲激响应非有界稳定' },
  { entityId: 'ctkg:v3e-object-16159373810de1c2e6810049', label: '滞后超前校正设计步骤' },
  { entityId: 'ctkg:v3e-object-1d9e463a8ef2d200a9e2fd86', label: '校正后闭环三分贝带宽' },
  { entityId: 'ctkg:v3e-object-1e9a880ef2f53925b280abc7', label: '奈奎斯特负一包围等价' },
  { entityId: 'ctkg:v3e-object-26dc00e8e926791fd4186758', label: '比例积分消除斜坡误差' },
  { entityId: 'ctkg:v3e-object-2aba0655d57881d80d76aa5c', label: '单位阶跃采样变换' },
  { entityId: 'ctkg:v3e-object-2fd3b8dfc79284046cb06990', label: '模数转换器' },
  { entityId: 'ctkg:v3e-object-44779d6418d71c86c7eff611', label: '零阶保持器半周期滞后' },
  { entityId: 'ctkg:v3e-object-4bd700342fd42e5919246020', label: '二阶惯性奈奎斯特心形线' },
  { entityId: 'ctkg:v3e-object-63c9fa4ef92407188e1a4129', label: '比例积分根轨迹设计步骤' },
  { entityId: 'ctkg:v3e-object-81b011029a6f0d8278513e00', label: '例七点一卫星双积分模型' },
  { entityId: 'ctkg:v3e-object-9103ed62af432260b2436f00', label: '赫尔维茨稳定参数范围题' },
  { entityId: 'ctkg:v3e-object-9581ae46c5b411c0d37c0d18', label: '含饱和环节、二阶环节与积分器的振荡控制系统' },
  { entityId: 'ctkg:v3e-object-97327e6eff406ea493160ac8', label: '超前网络最大相位频率' },
  { entityId: 'ctkg:v3e-object-a4caed97afa5648edabbacbe', label: '四阶以内赫尔维茨简式' },
  { entityId: 'ctkg:v3e-object-ad8b643ceb4e40e532ac3728', label: '模数转换采样与量化' },
  { entityId: 'ctkg:v3e-object-cb6ca6b992b089bcdc2f0285', label: '单位阶跃采样信号变换' },
  { entityId: 'ctkg:v3e-object-d74df2af2499a774657bcf10', label: '零阶保持器平均滞后' },
  { entityId: 'ctkg:v3e-object-d812fa08ed1f541982be0df4', label: '数模转换器' },
  { entityId: 'ctkg:v3e-object-ec5c814d08e046bef4d598e8', label: '描述函数极限环交点' },
  { entityId: 'ctkg:v3e-object-f2043c62f7852b9f7e0bb3a8', label: '奈奎斯特频率混叠' },
  { entityId: 'ctkg:v3e-object-f30daee6e2771214763c8437', label: '三极点开环传递函数陈述' },
]);

export const V018_REVIEWED_NEIGHBORHOOD_ENTITY_IDS: readonly string[] = Object.freeze(
  ROWS.map((row) => row.entityId),
);

export const V018_REVIEWED_NEIGHBORHOOD_LABELS: readonly AuthoritativeV2MultilingualLabelRecord[] =
  Object.freeze(ROWS.map((row, ordinal) => Object.freeze({
    releaseId: V018_REVIEWED_NEIGHBORHOOD_RELEASE_ID,
    ordinal: 10_000 + ordinal,
    entityId: row.entityId,
    language: 'zh-CN',
    label: row.label,
    labelType: 'canonical_preferred',
    terminologyAssertionId: `ctt:zh-cn-v018-neighborhood-${row.entityId.replace(/[^a-z0-9]+/giu, '').slice(-20)}`,
    payload: Object.freeze({
      contract: V018_REVIEWED_NEIGHBORHOOD_OVERLAY_CONTRACT,
      snapshotId: V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_ID,
      snapshotHash: V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_HASH,
    }),
  })));

export function reviewedNeighborhoodOverlayArtifact(): {
  readonly contract: typeof V018_REVIEWED_NEIGHBORHOOD_OVERLAY_CONTRACT;
  readonly mergePolicy: typeof V018_REVIEWED_NEIGHBORHOOD_MERGE_POLICY;
  readonly releaseId: typeof V018_REVIEWED_NEIGHBORHOOD_RELEASE_ID;
  readonly snapshotId: typeof V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_ID;
  readonly snapshotHash: typeof V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_HASH;
  readonly labels: readonly { entityId: string; label: string }[];
} {
  return Object.freeze({
    contract: V018_REVIEWED_NEIGHBORHOOD_OVERLAY_CONTRACT,
    mergePolicy: V018_REVIEWED_NEIGHBORHOOD_MERGE_POLICY,
    releaseId: V018_REVIEWED_NEIGHBORHOOD_RELEASE_ID,
    snapshotId: V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_ID,
    snapshotHash: V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_HASH,
    labels: ROWS,
  });
}

export function reviewedNeighborhoodOverlaySha256(): string {
  return projectionSha256(projectionCanonicalJson(reviewedNeighborhoodOverlayArtifact()));
}

export function reviewedNeighborhoodLabelsForSnapshot(
  snapshot: { releaseId: string; snapshotId: string; snapshotHash: string },
): readonly AuthoritativeV2MultilingualLabelRecord[] {
  if (
    snapshot.releaseId !== V018_REVIEWED_NEIGHBORHOOD_RELEASE_ID
    || snapshot.snapshotId !== V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_ID
    || snapshot.snapshotHash !== V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_HASH
  ) {
    return Object.freeze([]);
  }
  return V018_REVIEWED_NEIGHBORHOOD_LABELS;
}
