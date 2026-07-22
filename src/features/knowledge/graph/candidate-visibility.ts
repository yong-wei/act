/**
 * Candidate 治理可见性：candidate: true 节点对学习者默认排除（连同关联边），
 * teacher/review 上下文原样保留。过滤发生在视图模型层，布局、标签碰撞与
 * 密度逻辑永远看不到候选节点。
 */

interface KnowledgeGraphCandidateNodeLike {
  candidate?: boolean;
  id: string;
}

interface KnowledgeGraphCandidateLinkLike {
  sourceId: string;
  targetId: string;
}

export interface KnowledgeGraphCandidateSnapshotLike {
  corridorCycleEdgeIds: string[];
  corridorLinks: KnowledgeGraphCandidateLinkLike[];
  links: KnowledgeGraphCandidateLinkLike[];
  membershipLinks: KnowledgeGraphCandidateLinkLike[];
  nodes: KnowledgeGraphCandidateNodeLike[];
}

export function isKnowledgeGraphTeacherReviewRole(viewerRole?: string | null): boolean {
  return viewerRole === 'teacher' || viewerRole === 'admin';
}

export function filterKnowledgeGraphCandidateSnapshot<S extends KnowledgeGraphCandidateSnapshotLike>(
  snapshot: S,
  viewerRole?: string | null
): S & { hiddenCandidateNodeCount: number } {
  if (isKnowledgeGraphTeacherReviewRole(viewerRole)) {
    return { ...snapshot, hiddenCandidateNodeCount: 0 };
  }
  const candidateNodeIds = new Set(
    snapshot.nodes.filter((node) => node.candidate === true).map((node) => node.id)
  );
  if (candidateNodeIds.size === 0) {
    return { ...snapshot, hiddenCandidateNodeCount: 0 };
  }
  const visibleLinks = <L extends KnowledgeGraphCandidateLinkLike>(links: L[]): L[] => (
    links.filter((link) => !candidateNodeIds.has(link.sourceId) && !candidateNodeIds.has(link.targetId))
  );
  return {
    ...snapshot,
    nodes: snapshot.nodes.filter((node) => !candidateNodeIds.has(node.id)),
    links: visibleLinks(snapshot.links),
    corridorLinks: visibleLinks(snapshot.corridorLinks),
    membershipLinks: visibleLinks(snapshot.membershipLinks),
    hiddenCandidateNodeCount: candidateNodeIds.size,
  };
}
