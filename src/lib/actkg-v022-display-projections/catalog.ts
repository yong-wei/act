/**
 * Rebuild the Authority domain display catalog from the pinned v0.22 envelope.
 * Membership is many-to-many from module knowledge objects; domain count is
 * data-driven and never hard-coded.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildAuthorityDomainCatalog,
  type AuthorityDomainCatalogAuthoring,
  type AuthorityDomainCatalogRuntime,
  type DomainVisualRole,
} from '@/lib/authority-domain-catalog';

import {
  V022_CONTROLLED_RELEASE_RELATIVE,
  V022EnvelopeError,
  type V022PinnedEnvelope,
} from './envelope';

const MODULE_VERSION_SUFFIX = /-engineering-v\d+(?:\.\d+)*$/u;

export const V022_DOMAIN_CATALOG_CANDIDATE_RELATIVE =
  'course-content/authoring/knowledge/authority-domain-catalog/candidates/control-theory-engineering-v0.22' as const;

interface ComponentReleaseRow {
  component_path: string;
  component_role: string;
  release_version: string;
}

interface ReviewedDomainPresentation {
  domainId: string;
  displayName: string;
  summary: string;
  visualRole: Exclude<DomainVisualRole, 'aggregate'>;
}

/**
 * Reviewed Chinese presentation for envelope modules. Membership and domain
 * identity still come from the release; these strings never include catalog
 * keys, IDs, hashes, or a hard-coded domain count.
 */
export const V022_REVIEWED_DOMAIN_PRESENTATION: readonly ReviewedDomainPresentation[] = [
  {
    domainId: 'root-locus',
    displayName: '根轨迹',
    summary: '在参数变化下追踪闭环极点轨迹，支持稳定性与动态设计。',
    visualRole: 'root-locus',
  },
  {
    domainId: 'system-modeling',
    displayName: '系统建模',
    summary: '从物理对象到系统模型，建立可分析的输入输出与内部结构描述。',
    visualRole: 'modeling',
  },
  {
    domainId: 'time-domain-analysis',
    displayName: '时域分析',
    summary: '以时间响应刻画动态性能，理解过渡过程与稳态行为。',
    visualRole: 'time',
  },
  {
    domainId: 'stability-analysis',
    displayName: '稳定性分析',
    summary: '判断系统是否稳定，并给出可复核的稳定性判据与边界。',
    visualRole: 'stability',
  },
  {
    domainId: 'frequency-domain-analysis',
    displayName: '频域分析',
    summary: '用频率响应描述系统特性，连接幅相裕度与动态性能。',
    visualRole: 'frequency',
  },
  {
    domainId: 'classical-control-design',
    displayName: '经典控制设计',
    summary: '以串联校正与 PID 等方法完成性能指标驱动的控制器设计。',
    visualRole: 'design',
  },
  {
    domainId: 'discrete-time-control-analysis',
    displayName: '离散时间控制分析',
    summary: '面向采样与数字实现，分析离散系统模型与动态特性。',
    visualRole: 'discrete',
  },
  {
    domainId: 'state-space-control-analysis-and-design',
    displayName: '状态空间控制分析与设计',
    summary: '以状态空间模型进行能控能观分析与现代控制综合。',
    visualRole: 'state-space',
  },
  {
    domainId: 'nonlinear-system-analysis',
    displayName: '非线性系统分析',
    summary: '分析非线性动态的平衡、周期运动与局部或全局行为。',
    visualRole: 'nonlinear-analysis',
  },
  {
    domainId: 'lyapunov-stability',
    displayName: '李雅普诺夫稳定性',
    summary: '用能量型函数判断平衡点稳定性，并给出可复核的判据。',
    visualRole: 'lyapunov',
  },
  {
    domainId: 'discrete-time-control-design',
    displayName: '离散时间控制设计',
    summary: '面向采样实现完成离散控制器综合与性能设计。',
    visualRole: 'discrete-design',
  },
  {
    domainId: 'robustness-sensitivity-analysis',
    displayName: '鲁棒性与灵敏度分析',
    summary: '刻画参数与扰动对系统性能的影响，支持鲁棒性判断。',
    visualRole: 'robustness',
  },
  {
    domainId: 'optimal-control-foundations-and-linear-quadratic-design',
    displayName: '最优控制与线性二次型设计',
    summary: '以性能指标最优为目标，完成线性二次型等最优控制设计。',
    visualRole: 'optimal',
  },
  {
    domainId: 'robust-control-analysis-and-design',
    displayName: '鲁棒控制分析与设计',
    summary: '在模型不确定下分析并综合能够保持性能的控制器。',
    visualRole: 'robust-design',
  },
  {
    domainId: 'nonlinear-control-design',
    displayName: '非线性控制设计',
    summary: '针对非线性对象综合控制器，改善局部或大范围动态。',
    visualRole: 'nonlinear-design',
  },
];

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
}

export function domainIdFromModuleVersion(releaseVersion: string): string {
  const domainId = releaseVersion.replace(MODULE_VERSION_SUFFIX, '');
  if (domainId === releaseVersion || domainId.length === 0) {
    throw new V022EnvelopeError('module-domain-id-invalid', `cannot derive domainId from ${releaseVersion}`);
  }
  return domainId;
}

function knowledgeObjectsFromModule(release: Record<string, unknown>): string[] {
  const objects = new Set<string>();
  const entries = release.entries;
  if (Array.isArray(entries)) {
    for (const row of entries) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
      const entry = row as Record<string, unknown>;
      if (entry.entity_role === 'knowledge_object' && typeof entry.entity === 'string') {
        objects.add(entry.entity);
      }
    }
  }
  const canonicalNodes = release.canonical_nodes;
  if (Array.isArray(canonicalNodes)) {
    for (const row of canonicalNodes) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
      const node = row as Record<string, unknown>;
      const id = node.entity_id ?? node.id ?? node.canonical_id;
      if (typeof id === 'string' && id.length > 0) objects.add(id);
    }
  }
  return [...objects];
}

export function buildV022DomainCatalogAuthoring(input: {
  repoRoot: string;
  envelope: V022PinnedEnvelope;
}): {
  authoring: AuthorityDomainCatalogAuthoring;
  runtime: AuthorityDomainCatalogRuntime;
  publishedConceptCount: number;
  orphanCount: number;
} {
  const releaseRoot = path.join(input.repoRoot, V022_CONTROLLED_RELEASE_RELATIVE);
  const components = readJson(path.join(releaseRoot, 'component-releases.json'));
  const rows = components.components;
  if (!Array.isArray(rows)) {
    throw new V022EnvelopeError('component-manifest-invalid', 'component-releases.json is missing components');
  }
  const presentationById = new Map(V022_REVIEWED_DOMAIN_PRESENTATION.map((row) => [row.domainId, row]));
  const modules: Array<{ domainId: string; objects: string[] }> = [];
  let sawIntegration = false;
  let sawTerminology = false;
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new V022EnvelopeError('component-manifest-invalid', 'component row is invalid');
    }
    const row = raw as ComponentReleaseRow;
    if (row.component_role === 'integration') {
      if (row.release_version !== input.envelope.integrationVersion) {
        throw new V022EnvelopeError('envelope-mix', 'integration component is not v0.20');
      }
      sawIntegration = true;
      continue;
    }
    if (row.component_role === 'terminology') {
      if (row.release_version !== input.envelope.terminologyVersion) {
        throw new V022EnvelopeError('envelope-mix', 'terminology component is not v0.5');
      }
      sawTerminology = true;
      continue;
    }
    if (row.component_role !== 'module') {
      throw new V022EnvelopeError('component-role-unknown', `unsupported component role ${row.component_role}`);
    }
    const domainId = domainIdFromModuleVersion(row.release_version);
    const release = readJson(path.join(releaseRoot, row.component_path));
    modules.push({ domainId, objects: knowledgeObjectsFromModule(release) });
  }
  if (!sawIntegration || !sawTerminology) {
    throw new V022EnvelopeError('envelope-incomplete', 'v0.22 envelope is missing integration or terminology');
  }
  if (modules.length === 0) {
    throw new V022EnvelopeError('domain-set-empty', 'v0.22 envelope declared no peer modules');
  }

  const domainProjection = readJson(path.join(releaseRoot, 'domain-projection.json'));
  const published = new Set<string>();
  const nodes = domainProjection.nodes;
  if (!Array.isArray(nodes)) {
    throw new V022EnvelopeError('domain-projection-invalid', 'domain-projection.json nodes are missing');
  }
  for (const node of nodes) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
    const entityId = (node as Record<string, unknown>).entity_id;
    const status = (node as Record<string, unknown>).publication_status;
    if (typeof entityId === 'string' && status === 'published') published.add(entityId);
  }

  const memberships = new Map<string, Set<string>>();
  for (const moduleDefinition of modules) {
    if (!presentationById.has(moduleDefinition.domainId)) {
      throw new V022EnvelopeError('domain-presentation-missing', `missing reviewed presentation for ${moduleDefinition.domainId}`);
    }
    for (const canonicalId of moduleDefinition.objects) {
      if (!published.has(canonicalId)) continue;
      const domains = memberships.get(canonicalId) ?? new Set<string>();
      domains.add(moduleDefinition.domainId);
      memberships.set(canonicalId, domains);
    }
  }
  const orphans = [...published].filter((id) => !memberships.has(id));
  if (orphans.length > 0) {
    throw new V022EnvelopeError(
      'published-concept-uncovered',
      `${orphans.length} published concepts have zero domain memberships`,
    );
  }

  const authoring: AuthorityDomainCatalogAuthoring = {
    contract: 'act-authority-domain-display-catalog-authoring/v1',
    catalogVersion: 'v0.22-candidate',
    reviewStatus: 'reviewed',
    authorityBinding: {
      snapshotId: input.envelope.snapshotId,
      snapshotHash: input.envelope.snapshotHash,
      releaseId: input.envelope.releaseId,
      releaseSetId: input.envelope.releaseSetId,
    },
    domains: modules.map((module, index) => {
      const presentation = presentationById.get(module.domainId)!;
      return {
        domainId: presentation.domainId,
        order: index + 1,
        displayName: presentation.displayName,
        summary: presentation.summary,
        presentationRole: 'domain' as const,
        visualRole: presentation.visualRole,
      };
    }),
    aggregate: {
      entryId: 'control-theory-integration',
      order: 0,
      displayName: '控制理论综合',
      summary: '全局汇总入口，帮助先建立知识版图再进入具体领域。',
      presentationRole: 'aggregate',
      visualRole: 'aggregate',
    },
    memberships: [...memberships.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([canonicalId, domainIds]) => {
        const ordered = modules
          .map((module) => module.domainId)
          .filter((domainId) => domainIds.has(domainId));
        return {
          canonicalId,
          domainIds: ordered,
          preferredDomainId: ordered[0]!,
        };
      }),
  };

  const runtime = buildAuthorityDomainCatalog(
    authoring,
    [...published].map((canonicalId) => ({ canonicalId })),
  );
  return {
    authoring,
    runtime,
    publishedConceptCount: published.size,
    orphanCount: 0,
  };
}
