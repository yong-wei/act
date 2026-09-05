import type {
  AdaptiveLearningPathDeficit,
  AdaptiveLearningPathLearnerStateSnapshot,
  AdaptiveLearningPathPlanNode,
} from '@/features/personalization/path-planning/public-api';
import type { ColdStartCollectionImpact } from '@/lib/cold-start-evidence-collection';
import { studentVisibleColdStartLimitation } from '@/lib/cold-start-evidence-collection-copy';

export const PERSONALIZED_PATH_DECISION_EVIDENCE_VERSION = 'personalized-path-decision-evidence.v1';

export type PersonalizedPathDecisionSource = 'profile' | 'rule' | 'constraint' | 'degraded';
export type PersonalizedPathDecisionImpactKind = 'added' | 'removed' | 'advanced' | 'resource-type';

export interface PersonalizedPathDecisionSnapshot {
  version: typeof PERSONALIZED_PATH_DECISION_EVIDENCE_VERSION;
  capturedAt: string;
  plannerVersion: string;
  learnerStateVersion: string | null;
  learnerStateGeneratedAt: string | null;
  weakTargets: Array<{
    targetId: string;
    kind: string;
    value: number;
    confidence: number;
    evidenceCount: number;
  }>;
  preferredModalities: string[];
  preferredModalityConfidence: string;
  evidenceWindow: AdaptiveLearningPathLearnerStateSnapshot['evidenceWindow'];
  freshness: AdaptiveLearningPathLearnerStateSnapshot['freshness'] | 'missing';
  sourceCoverage: Record<string, string>;
  missingEvidence: string[];
  limitations: string[];
  degradationReasons: string[];
}

export interface PersonalizedPathDecisionImpact {
  kind: PersonalizedPathDecisionImpactKind;
  source: PersonalizedPathDecisionSource;
  reasonCode: string;
  nodeId?: string;
  resourceType?: string;
}

export interface PersonalizedPathDecisionExplanation {
  code: string;
  studentText: string;
}

export interface PersonalizedPathDecisionPathEvidence {
  optionId: string;
  styleId: string;
  impacts: PersonalizedPathDecisionImpact[];
  explanations: PersonalizedPathDecisionExplanation[];
}

export interface PersonalizedPathDecisionEvidence {
  snapshot: PersonalizedPathDecisionSnapshot;
  paths: PersonalizedPathDecisionPathEvidence[];
}

export interface PersonalizedPathDecisionPathInput {
  optionId: string;
  styleId: string;
  policyFamily?: string;
  nodeIds: string[];
  planNodes?: AdaptiveLearningPathPlanNode[];
  resourceMix?: Record<string, number>;
  recommendationProvenance?: {
    personalizationNotes?: string[];
    limitations?: string[];
    confidence?: string;
  };
}

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  video: '视频',
  handout: '讲义',
  knowledge_card: '知识卡片',
  simulation: '仿真',
  adaptive_quiz: '自适应练习',
  quiz: '练习题',
  audio: '音频',
  textbook_section: '教材阅读',
};

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function targetLabel(targetId: string): string {
  const finalSegment = targetId.split(':').at(-1) ?? targetId;
  const normalized = finalSegment.replaceAll('-', ' ').trim();
  return /[\u3400-\u9fff]/u.test(normalized) ? normalized : '当前学习目标';
}

function resourceTypeLabel(resourceType: string): string {
  return RESOURCE_TYPE_LABELS[resourceType] ?? '学习';
}

function isTrustedPreference(snapshot: AdaptiveLearningPathLearnerStateSnapshot | null | undefined): boolean {
  return Boolean(
    snapshot
      && snapshot.confidence.level !== 'none'
      && snapshot.confidence.level !== 'low'
      && snapshot.preferredModalityConfidence !== 'none'
      && snapshot.preferredModalityConfidence !== 'low'
      && snapshot.freshness !== 'stale'
      && snapshot.freshness !== 'partial',
  );
}

export function listPersonalizedPathDegradationReasons(
  snapshot: AdaptiveLearningPathLearnerStateSnapshot | null | undefined,
): string[] {
  const trustedPreference = isTrustedPreference(snapshot);
  return unique([
    !snapshot || snapshot.confidence.level === 'none' || snapshot.confidence.level === 'low'
      ? 'insufficient-evidence'
      : null,
    snapshot?.primaryPortraitState === 'UNAVAILABLE' ? 'portrait-unavailable' : null,
    snapshot?.primaryPortraitState === 'NO_EVIDENCE' ? 'no-portrait-evidence' : null,
    snapshot?.freshness === 'stale' ? 'stale-evidence' : null,
    snapshot?.freshness === 'partial' ? 'partial-evidence' : null,
    snapshot?.missingEvidence.length ? 'missing-evidence' : null,
    snapshot?.preferredModalities.length && !trustedPreference ? 'preference-untrusted' : null,
  ]);
}

function nodeCoversDeficit(
  node: AdaptiveLearningPathPlanNode | undefined,
  deficit: AdaptiveLearningPathDeficit,
): boolean {
  if (!node) return false;
  return deficit.kind === 'knowledge'
    ? node.knowledgeCoverage.includes(deficit.targetId)
    : Boolean(node.capabilityTargets?.includes(deficit.targetId));
}

export function degradationStudentText(reason: string): string {
  if (reason === 'portrait-unavailable') return '能力画像暂不可用（画像更新或证据收集中），暂时不能据此给出个性化判断。';
  if (reason === 'no-portrait-evidence') return '能力画像还没有足够证据，暂时不能据此给出个性化判断。';
  if (reason === 'stale-evidence') return '部分学习证据已经过期，暂时不能据此给出个性化判断。';
  if (reason === 'partial-evidence') return '部分学习证据仍然不完整，暂时不能据此给出个性化判断。';
  if (reason === 'missing-evidence') return '部分学习证据仍然缺失，暂时不能据此给出个性化判断。';
  return '目前学习记录不足，暂时无法判断你的资源偏好。';
}

export function buildPersonalizedPathDecisionSnapshot(input: {
  capturedAt: string;
  plannerVersion: string;
  learnerStateSnapshot?: AdaptiveLearningPathLearnerStateSnapshot | null;
  deficits: AdaptiveLearningPathDeficit[];
}): PersonalizedPathDecisionSnapshot {
  const snapshot = input.learnerStateSnapshot ?? null;
  const degradationReasons = listPersonalizedPathDegradationReasons(snapshot);
  const limitations = unique([
    ...degradationReasons.map((reason) => {
      if (reason === 'portrait-unavailable') return '能力画像暂不可用（画像更新或证据收集中），能力类薄弱项判断已降级。';
      if (reason === 'no-portrait-evidence') return '能力画像还没有足够证据，能力类薄弱项判断已降级。';
      if (reason === 'insufficient-evidence') return '当前没有足够的有效学习证据支持个性化判断。';
      if (reason === 'stale-evidence') return '部分学习证据已经过期。';
      if (reason === 'partial-evidence') return '部分学习证据仍然不完整。';
      if (reason === 'missing-evidence') return '部分学习证据仍然缺失。';
      return '学习方式偏好证据不足或已过期，暂时无法据此判断。';
    }),
    ...(snapshot?.missingEvidence ?? []),
  ]);
  return {
    version: PERSONALIZED_PATH_DECISION_EVIDENCE_VERSION,
    capturedAt: input.capturedAt,
    plannerVersion: input.plannerVersion,
    learnerStateVersion: snapshot?.payloadVersion ?? null,
    learnerStateGeneratedAt: snapshot?.generatedAt ?? null,
    weakTargets: input.deficits.map((deficit) => ({
      targetId: deficit.targetId,
      kind: deficit.kind,
      value: deficit.value,
      confidence: deficit.confidence,
      evidenceCount: deficit.evidenceCount,
    })),
    preferredModalities: [...(snapshot?.preferredModalities ?? [])],
    preferredModalityConfidence: snapshot?.preferredModalityConfidence ?? 'none',
    evidenceWindow: snapshot?.evidenceWindow ?? null,
    freshness: snapshot?.freshness ?? 'missing',
    sourceCoverage: { ...(snapshot?.sourceCoverage ?? {}) },
    missingEvidence: [...(snapshot?.missingEvidence ?? [])],
    limitations,
    degradationReasons,
  };
}

export function buildPersonalizedPathDecisionEvidence(input: {
  capturedAt: string;
  plannerVersion: string;
  learnerStateSnapshot?: AdaptiveLearningPathLearnerStateSnapshot | null;
  deficits: AdaptiveLearningPathDeficit[];
  paths: PersonalizedPathDecisionPathInput[];
  collectionImpacts?: ColdStartCollectionImpact[];
  collectionLimitationCodes?: string[];
}): PersonalizedPathDecisionEvidence {
  const snapshot = buildPersonalizedPathDecisionSnapshot(input);
  if (input.collectionLimitationCodes?.length) {
    snapshot.limitations = unique([
      ...snapshot.limitations,
      ...input.collectionLimitationCodes.map((code) => studentVisibleColdStartLimitation(code) ?? code),
    ]);
  }
  const suppressPersonalizedConclusions = snapshot.degradationReasons.length > 0;
  const trustedPreference = isTrustedPreference(input.learnerStateSnapshot) && !suppressPersonalizedConclusions;
  const allNodeIds = input.paths.map((path) => path.nodeIds);
  const sharedNodeIds = new Set(
    allNodeIds[0]?.filter((nodeId) => allNodeIds.every((ids) => ids.includes(nodeId))) ?? [],
  );
  const evidencedTargets = input.deficits.filter((deficit) => deficit.evidenceCount >= 2 && deficit.confidence >= 0.5);
  const profileSource: PersonalizedPathDecisionSource = suppressPersonalizedConclusions ? 'degraded' : 'profile';

  const paths = input.paths.map((path) => {
    const impacts: PersonalizedPathDecisionImpact[] = [];
    const uniqueNodeIds = path.nodeIds.filter((nodeId) => !sharedNodeIds.has(nodeId));
    for (const nodeId of uniqueNodeIds) {
      const node = path.planNodes?.find((item) => item.nodeId === nodeId);
      const matchesProfile = evidencedTargets.some((deficit) => nodeCoversDeficit(node, deficit));
      impacts.push({
        kind: 'added',
        source: matchesProfile ? profileSource : 'rule',
        reasonCode: matchesProfile
          ? (suppressPersonalizedConclusions ? 'evidence-degraded' : 'weak-target')
          : 'policy-family-difference',
        nodeId,
      });
    }
    for (const other of input.paths) {
      if (other.optionId === path.optionId) continue;
      for (const nodeId of sharedNodeIds) {
        const thisIndex = path.nodeIds.indexOf(nodeId);
        const otherIndex = other.nodeIds.indexOf(nodeId);
        if (thisIndex >= 0 && otherIndex >= 0 && thisIndex < otherIndex) {
          impacts.push({
            kind: 'advanced',
            source: profileSource,
            reasonCode: suppressPersonalizedConclusions ? 'evidence-degraded' : 'earlier-than-sibling',
            nodeId,
          });
        }
      }
    }
    const appliedModalities = trustedPreference
      ? snapshot.preferredModalities.filter((modality) => (path.resourceMix?.[modality] ?? 0) > 0)
      : [];
    for (const modality of appliedModalities) {
      impacts.push({
        kind: 'resource-type',
        source: 'profile',
        reasonCode: 'preferred-modality-applied',
        resourceType: modality,
      });
    }
    for (const modality of snapshot.preferredModalities) {
      if (appliedModalities.includes(modality)) continue;
      impacts.push({
        kind: 'resource-type',
        source: trustedPreference ? 'constraint' : 'degraded',
        reasonCode: trustedPreference ? 'preferred-modality-unavailable' : 'preference-untrusted',
        resourceType: modality,
      });
    }

    const explanations: PersonalizedPathDecisionExplanation[] = snapshot.degradationReasons.map((reason) => ({
      code: reason,
      studentText: degradationStudentText(reason),
    }));
    if (!suppressPersonalizedConclusions) {
      for (const deficit of evidencedTargets) {
        const affected = impacts.some((impact) =>
          impact.kind === 'added'
          && impact.source === 'profile'
          && impact.reasonCode === 'weak-target'
          && nodeCoversDeficit(path.planNodes?.find((item) => item.nodeId === impact.nodeId), deficit),
        );
        if (!affected) continue;
        explanations.push({
          code: 'weak-target',
          studentText: `你在${targetLabel(deficit.targetId)}相关学习中的掌握度仍有提升空间，因此增加了相关讲解和练习。`,
        });
      }
      for (const modality of appliedModalities) {
        explanations.push({
          code: 'preferred-modality-applied',
          studentText: `根据你的学习方式偏好，优先安排了${resourceTypeLabel(modality)}类学习资源。`,
        });
      }
      for (const modality of snapshot.preferredModalities) {
        if (appliedModalities.includes(modality)) continue;
        explanations.push({
          code: 'preferred-modality-unavailable',
          studentText: `当前可用资源未能落实你的${resourceTypeLabel(modality)}偏好。`,
        });
      }
    }
    for (const collectionImpact of input.collectionImpacts ?? []) {
      impacts.push({
        kind: collectionImpact.kind === 'resource-type' ? 'resource-type' : 'added',
        source: 'profile',
        reasonCode: collectionImpact.reasonCode,
        resourceType: collectionImpact.kind === 'resource-type'
          ? Object.keys(path.resourceMix ?? {})[0]
          : undefined,
      });
      explanations.push({
        code: collectionImpact.reasonCode,
        studentText: collectionImpact.studentText,
      });
    }

    const uniqueExplanations = explanations.filter((explanation, index) =>
      explanations.findIndex((candidate) => candidate.studentText === explanation.studentText) === index);

    return {
      optionId: path.optionId,
      styleId: path.styleId,
      impacts,
      explanations: uniqueExplanations,
    };
  });

  return { snapshot, paths };
}
