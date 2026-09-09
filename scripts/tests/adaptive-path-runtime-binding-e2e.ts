/**
 * #2055 端到端验收：物化本地 Runtime release 后以 control-correction 生成候选，
 * 断言候选节点携带真实 runtime 绑定（releaseId/对象键/校验值非空、OSS 资源数非零），
 * 并对无活动 release 环境断言显式 `no-active-release` 降级。运行：
 *   npx tsx --import ./scripts/konling-blind-audit/server-only-shim.mjs \
 *     scripts/tests/adaptive-path-runtime-binding-e2e.ts
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';

import {
  attachAdaptivePathRuntimeBindings,
} from '@/lib/konling-agent-runtime';
import {
  buildResourceNodeRegistryFromTeachingResources,
  loadRuntimeResourceProjectionInputs,
} from '@/lib/teacher-resource-node-data';
import { loadAllLessonRuntimeResourceCatalogEntries } from '@/lib/course-bundle/runtime-reads';
import { loadAllTextbookStructureRuntimeCatalogEntries } from '@/lib/structured-textbook-runtime';
import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import {
  CONTROL_CORRECTION_PATH_ROUND_GOAL_ID,
  getRegisteredAdaptiveLearningPathGoal,
  planLearningPath,
} from '@/features/personalization/path-planning/public-api';
import {
  ACT_RUNTIME_RELEASE_MANIFEST_FILENAME,
  buildRuntimeReleaseManifest,
} from '@/lib/runtime-release';

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, 'course-content/runtime', ACT_RUNTIME_RELEASE_MANIFEST_FILENAME);

function writeLocalReleaseManifest() {
  assert.ok(!existsSync(manifestPath), '本地已存在活动 release manifest，请在干净工作树运行本验收');
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  return buildRuntimeReleaseManifest(path.join(repoRoot, 'course-content/runtime'), {
    releaseId: 'local-e2e-2055',
    sourceRevision,
  }).then((manifest) => {
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 1)}\n`);
    return manifest;
  });
}

async function buildRegistry() {
  const [runtimeLessons, runtimeTextbooks, runtimeResourceProjections] = await Promise.all([
    loadAllLessonRuntimeResourceCatalogEntries(),
    loadAllTextbookStructureRuntimeCatalogEntries(),
    loadRuntimeResourceProjectionInputs({ allowMissing: false }),
  ]);
  return buildResourceNodeRegistryFromTeachingResources(
    [],
    getAllRegisteredResourceMetadata(),
    runtimeLessons,
    runtimeTextbooks,
    runtimeResourceProjections,
  );
}

async function buildLocalPlan(goalId: string, registry: Awaited<ReturnType<typeof buildRegistry>>) {
  const registeredGoal = getRegisteredAdaptiveLearningPathGoal(goalId);
  assert.ok(registeredGoal, `${goalId} 目标必须已注册`);
  return planLearningPath({
    studentId: 'student-e2e-2055',
    goal: registeredGoal.goal,
    learnerState: {
      primaryPortraitState: 'NO_EVIDENCE',
      primaryPortraitAvailability: 'unavailable',
    } as never,
    registry,
    constraints: {
      timeBudgetMinutes: 120,
      privacyScopes: ['student-visible'],
      completedNodeIds: [],
      currentNodeId: null,
    },
    candidatePoolDiagnostics: {
      totalCandidates: registry.nodes.length,
      pathEligibleCandidates: registry.audit.pathEligibleNodes,
      candidateCountsByFamily: {},
      sourceFamilies: [],
      excluded: { total: 0, byReason: {} },
      sourceFamilyIssues: {},
      missingSourceReasons: {},
      nodeEligibilityMissingReasons: {},
    },
    sourcePackRole: 'student',
    now: new Date(),
  });
}

const evidence: Record<string, unknown> = { generatedAt: new Date().toISOString() };

async function main(): Promise<void> {
  const registry = await buildRegistry();

  // 1. 基线（无活动 release）：资产承载节点显式 no-active-release，批次受限不静默。
  const planBeforeRelease = await buildLocalPlan(CONTROL_CORRECTION_PATH_ROUND_GOAL_ID, registry);
  const before = await attachAdaptivePathRuntimeBindings(planBeforeRelease);
  if (before.bindings.length > 0) {
    assert.ok(
      before.bindings.every((binding) => binding.state === 'no-active-release'),
      '无活动 release 时资产承载节点应统一记录 no-active-release',
    );
    assert.deepEqual(before.limitationCodes, ['no-active-runtime-release']);
  }
  evidence.beforeLocalRelease = {
    bindingCount: before.bindings.length,
    limitationCodes: before.limitationCodes,
  };

  // 2. 物化本地 release 后按目标生成候选：存在可绑定节点时绑定非零且携带
  //    releaseId/对象键/校验值；零绑定目标必须显式受限（不静默空记录）。
  const release = await writeLocalReleaseManifest();
  try {
    const goals = [CONTROL_CORRECTION_PATH_ROUND_GOAL_ID, 'frequency-response-foundations'];
    const totalBound: unknown[] = [];
    for (const goalId of goals) {
      const plan = await buildLocalPlan(goalId, registry);
      const attached = await attachAdaptivePathRuntimeBindings(plan);
      const bound = attached.bindings.filter((binding) => binding.state === 'bound');
      assert.ok(
        attached.bindings.every((binding) => binding.state !== undefined && binding.reason !== undefined),
        '每个资产承载节点必须有显式绑定状态（bound 或失败原因）',
      );
      if (bound.length > 0) {
        assert.ok(bound.every((binding) => binding.runtimeReleaseId === release.releaseId), 'bound 绑定必须携带 releaseId');
        assert.ok(bound.every((binding) => typeof binding.objectKey === 'string' && binding.objectKey.length > 0), 'bound 绑定必须携带对象键');
        assert.ok(bound.every((binding) => /^[a-f0-9]{64}$/.test(binding.contentSha256 ?? '')), 'bound 绑定必须携带 manifest 校验值');
        // 绑定字段独立于导航 target：节点 target 仍是学生可导航路由（无 /api/ 形态）。
        const boundNodeIds = new Set(bound.map((binding) => binding.nodeId));
        const boundPlanNodes = [
          ...attached.plan.mainPath,
          ...(attached.plan.policyBundle?.paths ?? []).flatMap((path) => path.planNodes ?? []),
        ].filter((node) => boundNodeIds.has(node.nodeId));
        assert.ok(
          boundPlanNodes.every((node) => !node.target.startsWith('/api/')),
          '绑定节点导航 target 必须保持学生可导航路由',
        );
        assert.ok(
          boundPlanNodes.every((node) => node.runtimeResourceBinding?.state === 'bound'),
          '绑定必须写回 plan 节点 runtimeResourceBinding 字段',
        );
      } else if (attached.bindings.length > 0) {
        assert.ok(
          attached.limitationCodes.length > 0,
          `目标 ${goalId} 零绑定时必须显式受限（limitationCodes 为空）`,
        );
      }
      totalBound.push(...bound);
      const byState = attached.bindings.reduce<Record<string, number>>((counts, binding) => {
        counts[binding.state] = (counts[binding.state] ?? 0) + 1;
        return counts;
      }, {});
      evidence[goalId] = {
        bindingCount: attached.bindings.length,
        byState,
        boundSample: bound.slice(0, 5).map((binding) => ({
          nodeId: binding.nodeId,
          resourceId: binding.resourceId,
          objectKey: binding.objectKey,
          contentSha256: binding.contentSha256,
        })),
        limitationCodes: attached.limitationCodes,
      };
      console.log(`  ${goalId}: 绑定 ${attached.bindings.length} 条，bound ${bound.length}，byState=${JSON.stringify(byState)}，limitationCodes=${JSON.stringify(attached.limitationCodes)}`);
    }
    assert.ok(
      totalBound.length > 0,
      '物化本地 release 后候选 OSS 资源数必须非零（control-correction 与 frequency-response 至少一个目标存在可绑定节点）',
    );

    // 3. 池级证据：同一活动 release 下，可路径（pathEligible）注册表节点的可绑定 OSS 计数非零。
    const { resolveAdaptivePathNodeRuntimeBindings } = await import('@/features/personalization/path-planning/adaptive-path-runtime-binding');
    const { resolveActiveTeachingProjection, resolveTeachingProjectionStorePaths } = await import('@/lib/teaching-projection/store');
    const { readActiveRuntimeReleaseManifest } = await import('@/lib/runtime-active-release');
    const projection = resolveActiveTeachingProjection(
      resolveTeachingProjectionStorePaths(path.join(repoRoot, 'course-content/runtime/knowledge/projection')),
    );
    assert.ok(projection.status === 'available' && projection.staged, '本地教学投影必须可读');
    const manifest = await readActiveRuntimeReleaseManifest(path.join(repoRoot, 'course-content/runtime'));
    assert.ok(manifest, '本地 release manifest 必须可读');
    const poolBindings = resolveAdaptivePathNodeRuntimeBindings({
      nodes: registry.nodes
        .filter((node) => node.eligibility.pathEligible)
        .map((node) => ({ nodeId: node.id, nodeType: node.type })),
      projection: {
        projectionId: projection.staged.projectionId,
        resourcesByResourceId: new Map(projection.staged.artifacts.resources.map((resource) => [
          resource.resourceId,
          { resourceType: resource.resourceType, sourcePath: resource.sourcePath },
        ])),
      },
      release: {
        releaseId: manifest.releaseId,
        filesByPath: new Map(manifest.files.map((file) => [file.path, { sha256: file.sha256, objectKey: file.objectKey }])),
        filesBySha256: new Map(manifest.files.map((file) => [file.sha256, { path: file.path }])),
      },
    });
    const poolBound = poolBindings.filter((binding) => binding.state === 'bound');
    assert.ok(poolBound.length > 0, `可路径节点的可绑定 OSS 资源计数必须非零（实际 ${poolBound.length}）`);
    evidence.poolPathEligibleBound = poolBound.length;
    console.log(`PASS #2055 端到端：候选级 bound=${totalBound.length}，可路径池级 bound=${poolBound.length}，releaseId=${release.releaseId}（${release.fileCount} 文件）`);
  } finally {
    if (existsSync(manifestPath)) unlinkSync(manifestPath);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
