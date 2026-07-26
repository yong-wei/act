export type AssignmentPublicationRepairRevision = {
  id: string;
  assignmentId: string;
  revisionNumber: number;
  publishedAt: Date | null;
  contentHash: string | null;
  audienceSignature: string;
  activeAudienceIds: string[];
  dependencyCounts: Record<string, number>;
};

export type AssignmentPublicationRepairAction = {
  assignmentId: string;
  contentHash: string;
  retainedRevisionId: string;
  revisionId: string;
  action: 'delete-unreferenced' | 'archive-dependent';
  activeAudienceIds: string[];
  dependencyCounts: Record<string, number>;
};

export type AssignmentPublicationRepairPlan = {
  actions: AssignmentPublicationRepairAction[];
  ambiguous: Array<{
    assignmentId: string;
    revisionIds: string[];
    reason: 'missing-content-digest';
  }>;
};

export function planAssignmentPublicationDuplicateRepair(
  revisions: readonly AssignmentPublicationRepairRevision[],
): AssignmentPublicationRepairPlan {
  const byAssignment = new Map<string, AssignmentPublicationRepairRevision[]>();
  for (const revision of revisions) {
    const group = byAssignment.get(revision.assignmentId) ?? [];
    group.push(revision);
    byAssignment.set(revision.assignmentId, group);
  }

  const actions: AssignmentPublicationRepairAction[] = [];
  const ambiguous: AssignmentPublicationRepairPlan['ambiguous'] = [];
  for (const [assignmentId, assignmentRevisions] of byAssignment) {
    if (assignmentRevisions.length > 1 && assignmentRevisions.some((revision) => !revision.contentHash)) {
      ambiguous.push({
        assignmentId,
        revisionIds: assignmentRevisions.map((revision) => revision.id).sort(),
        reason: 'missing-content-digest',
      });
    }
    const byDigest = new Map<string, AssignmentPublicationRepairRevision[]>();
    for (const revision of assignmentRevisions) {
      if (!revision.contentHash) continue;
      const publicationSignature = `${revision.contentHash}:${revision.audienceSignature}`;
      const group = byDigest.get(publicationSignature) ?? [];
      group.push(revision);
      byDigest.set(publicationSignature, group);
    }
    for (const duplicateRevisions of byDigest.values()) {
      if (duplicateRevisions.length < 2) continue;
      const ordered = [...duplicateRevisions].sort(comparePublicationRecency);
      const retained = ordered[0];
      for (const duplicate of ordered.slice(1)) {
        const hasRetainedDependency = Object.values(duplicate.dependencyCounts).some((count) => count > 0);
        actions.push({
          assignmentId,
          contentHash: retained.contentHash!,
          retainedRevisionId: retained.id,
          revisionId: duplicate.id,
          action: hasRetainedDependency ? 'archive-dependent' : 'delete-unreferenced',
          activeAudienceIds: [...duplicate.activeAudienceIds].sort(),
          dependencyCounts: { ...duplicate.dependencyCounts },
        });
      }
    }
  }
  return {
    actions: actions.sort((left, right) => left.assignmentId.localeCompare(right.assignmentId)
      || left.revisionId.localeCompare(right.revisionId)),
    ambiguous: ambiguous.sort((left, right) => left.assignmentId.localeCompare(right.assignmentId)),
  };
}

function comparePublicationRecency(
  left: AssignmentPublicationRepairRevision,
  right: AssignmentPublicationRepairRevision,
): number {
  return (right.publishedAt?.getTime() ?? 0) - (left.publishedAt?.getTime() ?? 0)
    || right.revisionNumber - left.revisionNumber
    || right.id.localeCompare(left.id);
}
