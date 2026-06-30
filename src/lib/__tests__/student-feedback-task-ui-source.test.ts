import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readSource(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('student feedback task UI source contracts', () => {
  it('wires report feedback, adaptive practice, evidence, growth, missions, and portfolio to the shared assignment contract', () => {
    const documentFeedback = readSource('src/app/assessment/document-feedback/page.tsx');
    const gradingUi = readSource('src/features/assessment/document-rubric-grading-ui.tsx');
    const feedbackPanel = readSource('src/features/assessment/student-feedback-task-panel.tsx');
    const adaptivePractice = readSource('src/app/assessment/adaptive-practice/page.tsx');
    const missions = readSource('src/app/(main)/missions/page.tsx');
    const evidence = readSource('src/app/(main)/profile/evidence/page.tsx');
    const growth = readSource('src/app/(main)/profile/growth/page.tsx');
    const portfolio = readSource('src/app/(main)/profile/portfolio/page.tsx');
    const resource = readSource('src/app/interactive-learning/resources/[id]/page.tsx');
    const destroyer = readSource('src/app/simulations/destroyer/page.tsx');
    const learningEvidenceRoute = readSource('src/app/api/learning-evidence/route.ts');
    const missionsRoute = readSource('src/app/api/missions/route.ts');
    const feedbackContextRoute = readSource('src/app/api/student-feedback-task/context/route.ts');
    const verifiedContextHook = readSource('src/features/assessment/use-verified-feedback-task-context.ts');

    expect(documentFeedback).toContain('buildFeedbackTaskContext');
    expect(documentFeedback).toContain('feedbackContext');
    expect(gradingUi).toContain('StudentFeedbackTaskPanel');
    expect(gradingUi).toContain('surface="document-feedback"');
    expect(feedbackPanel).toContain('data-student-feedback-teacher-intervention-id={context.teacherIntervention?.id ?? undefined}');
    expect(feedbackPanel).toContain('data-student-feedback-teacher-intervention-status={context.teacherIntervention?.status ?? undefined}');
    expect(feedbackPanel).toContain('data-student-visible-teacher-intervention="feedback-task"');
    expect(adaptivePractice).toContain('buildFeedbackTaskContext');
    expect(adaptivePractice).toContain('useVerifiedFeedbackTaskContext(localFeedbackContext, searchParams)');
    expect(adaptivePractice).toContain('withFeedbackTaskHref');
    expect(adaptivePractice).toContain("teacherInterventionId: searchParams.get('teacherInterventionId')");
    expect(adaptivePractice).toContain('window.location.assign(withFeedbackTaskHref(pathNodeContextHref(node');
    expect(adaptivePractice).toContain('href={withFeedbackTaskHref(nextPathAction.href)}');
    expect(adaptivePractice).toContain('surface="adaptive-practice"');
    expect(missions).toContain('buildFeedbackTaskContext');
    expect(missions).toContain('useVerifiedFeedbackTaskContext(localFeedbackContext, searchParams)');
    expect(missions).toContain("teacherInterventionId: searchParams.get('teacherInterventionId')");
    expect(missions).toContain("missionQuery.set('teacherInterventionId'");
    expect(missions).toContain('buildFeedbackTaskHref(`/simulations/destroyer?mission=');
    expect(missions).toContain("missionQuery.set('criterion'");
    expect(missions).toContain("missionQuery.set('source'");
    expect(missions).toContain('fetch(`/api/missions?${missionQuery.toString()}`)');
    expect(missions).toContain('surface="missions"');
    expect(evidence).toContain('buildFeedbackTaskContext');
    expect(evidence).toContain("apiPath={feedbackContext ? '/api/learning-evidence' : '/api/student/evidence'}");
    expect(evidence).toContain('assignment={feedbackContext?.assignmentId}');
    expect(evidence).toContain('surface="evidence"');
    expect(growth).toContain('buildFeedbackTaskContext');
    expect(growth).toContain('useVerifiedFeedbackTaskContext(localFeedbackContext, searchParams)');
    expect(growth).toContain('surface="growth"');
    expect(portfolio).toContain('buildPortfolioFeedbackDraft');
    expect(portfolio).toContain('useVerifiedFeedbackTaskContext(localFeedbackContext, searchParams)');
    expect(portfolio).toContain('surface="portfolio"');
    expect(portfolio).toContain("status === 'authenticated' && session?.user?.role !== 'STUDENT'");
    expect(portfolio.indexOf("status === 'authenticated' && session?.user?.role !== 'STUDENT'")).toBeLessThan(
      portfolio.indexOf("status === 'loading' || (loading && !hasLocalPortfolioTask)")
    );
    expect(resource).toContain('buildFeedbackTaskContext');
    expect(resource).toContain('useVerifiedFeedbackTaskContext(localFeedbackContext, searchParams)');
    expect(resource).toContain('buildFeedbackTaskHref(feedbackContext.returnHref');
    expect(resource).toContain("status: 'completed'");
    expect(resource).toContain('surface="resource"');
    expect(destroyer).toContain('StudentFeedbackTaskPanel');
    expect(destroyer).toContain('surface="simulation-destroyer"');
    expect(learningEvidenceRoute).toContain('listEvidenceTimeline');
    expect(learningEvidenceRoute).toContain('buildLearningEvidenceAssignmentResponse');
    expect(learningEvidenceRoute).toContain('resolveVerifiedTeacherInterventionId');
    expect(learningEvidenceRoute).toContain("teacherInterventionId: request.nextUrl.searchParams.get('teacherInterventionId')");
    expect(missionsRoute).toContain('getFeedbackTaskMissionTarget');
    expect(missionsRoute).toContain('resolveVerifiedTeacherInterventionId');
    expect(missionsRoute).toContain("teacherInterventionId: url.searchParams.get('teacherInterventionId')");
    expect(missionsRoute).toContain("criterion: url.searchParams.get('criterion')");
    expect(missionsRoute).toContain("source: url.searchParams.get('source')");
    expect(missionsRoute).toContain('feedbackTarget.missionOrders.includes(mission.order)');
    expect(feedbackContextRoute).toContain('resolveVerifiedTeacherInterventionId');
    expect(feedbackContextRoute).toContain('buildFeedbackTaskContext(query, { verifiedTeacherInterventionId })');
    expect(verifiedContextHook).toContain('/api/student-feedback-task/context?');
  });

  it('keeps audit remediation evidence linked to the concrete batch findings', () => {
    const chapter58 = readSource('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20/chapters/66-function-state-flows-batch58.md');
    const chapter59 = readSource('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20/chapters/67-function-state-flows-batch59.md');

    expect(chapter58).toContain('audit-remediation-student-learning-closure');
    expect(chapter58).toContain('../remediation/audit-remediation-student-learning-closure/evidence.md');
    expect(chapter59).toContain('audit-remediation-student-learning-closure');
    expect(chapter59).toContain('../remediation/audit-remediation-student-learning-closure/evidence.md');
  });
});
