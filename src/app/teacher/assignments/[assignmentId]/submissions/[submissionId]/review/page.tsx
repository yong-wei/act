import { TeacherReviewWorkspace } from "@/features/assignments/teacher-review-workspace";
import type { TeacherReviewQueueMode } from "@/features/assignments/teacher-review-contracts";

export default async function TeacherAssignmentReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ assignmentId: string; submissionId: string }>;
  searchParams: Promise<{
    questionId?: string;
    mode?: string;
    status?: string;
    reviewId?: string;
    gradingRunId?: string;
  }>;
}) {
  const [{ assignmentId, submissionId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const mode: TeacherReviewQueueMode =
    query.mode === "question" ? "question" : "student";

  return (
    <TeacherReviewWorkspace
      assignmentId={assignmentId}
      submissionId={submissionId}
      initialQuestionId={query.questionId ?? ""}
      initialMode={mode}
      initialStatus={query.status ?? "ALL"}
      initialReviewId={query.reviewId ?? null}
      initialGradingRunId={query.gradingRunId ?? null}
    />
  );
}
