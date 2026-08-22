export interface FrozenAssignmentSubmissionLineage {
  assignmentRevisionId: string;
  studentId: string;
  frozenStudentId: string;
  frozenAudienceClassId: string;
  audience: {
    classId: string;
    assignmentRevisionId: string;
  };
  revision: {
    id: string;
  };
}

export function hasConsistentFrozenAssignmentSubmissionLineage(
  submission: FrozenAssignmentSubmissionLineage,
  classId: string,
) {
  return submission.studentId === submission.frozenStudentId
    && submission.frozenAudienceClassId === classId
    && submission.audience.classId === submission.frozenAudienceClassId
    && submission.audience.assignmentRevisionId === submission.assignmentRevisionId
    && submission.revision.id === submission.assignmentRevisionId;
}
