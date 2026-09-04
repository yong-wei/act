/**
 * 冲突引用语义一致性（Issue #1946）。
 *
 * 作业/测评冲突必须由同一学生（或每个被引用学生两来源齐全的群体）、
 * 14 天时间窗、以及支持声明方向的分值证明。只确认 evidenceRefs 存在不够。
 */
import {
  diagnosisClauseDeclaresConflict,
  splitDiagnosisClauses,
} from '@/lib/diagnosis-pseudo-conflict';

export const DIAGNOSIS_CONFLICT_COMPARABLE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

const ASSIGNMENT_HIGH_ASSESSMENT_LOW = /作业[\s\S]{0,24}(?:得?分)?(?:较?高|偏高|更好)[\s\S]{0,32}(?:测评|测验|诊断测评)[\s\S]{0,16}(?:得?分)?(?:较?低|偏低|更差)/;
const ASSESSMENT_LOW_THEN_ASSIGNMENT_HIGH = /(?:测评|测验|诊断测评)[\s\S]{0,16}(?:得?分)?(?:较?低|偏低|更差)[\s\S]{0,32}作业[\s\S]{0,24}(?:得?分)?(?:较?高|偏高|更好)/;
const ASSIGNMENT_LOW_ASSESSMENT_HIGH = /作业[\s\S]{0,24}(?:得?分)?(?:较?低|偏低|更差)[\s\S]{0,32}(?:测评|测验|诊断测评)[\s\S]{0,16}(?:得?分)?(?:较?高|偏高|更好)/;
const ASSESSMENT_HIGH_THEN_ASSIGNMENT_LOW = /(?:测评|测验|诊断测评)[\s\S]{0,16}(?:得?分)?(?:较?高|偏高|更好)[\s\S]{0,32}作业[\s\S]{0,24}(?:得?分)?(?:较?低|偏低|更差)/;

type AssignmentRow = {
  id: string;
  userId: string;
  score: number;
  totalPoints: number;
  reviewedAt: string;
};

type AssessmentRow = {
  id: string;
  userId: string;
  score: number;
  completedAt: string;
};

export type DiagnosisConflictEvidenceSource = {
  summary: string;
  limitations: ReadonlyArray<string>;
  findings: ReadonlyArray<{
    title: string;
    summary?: string;
    evidenceRefs: ReadonlyArray<string>;
  }>;
  evidenceRefs: ReadonlyArray<string>;
};

export type DiagnosisConflictEvidenceInput = {
  assignmentSubmissions?: ReadonlyArray<AssignmentRow>;
  assessmentSessions?: ReadonlyArray<AssessmentRow>;
};

function conflictText(source: DiagnosisConflictEvidenceSource): string {
  return [
    source.summary,
    ...source.limitations,
    ...source.findings.flatMap((finding) => [finding.title, finding.summary ?? '']),
  ].join('');
}

export function diagnosisReportDeclaresConflict(source: DiagnosisConflictEvidenceSource): boolean {
  return [source.summary, ...source.limitations, ...source.findings.flatMap((finding) => [
    finding.title,
    finding.summary ?? '',
  ])].some((text) => splitDiagnosisClauses(text).some(diagnosisClauseDeclaresConflict));
}

function claimedAssignmentHigh(text: string): boolean {
  return ASSIGNMENT_HIGH_ASSESSMENT_LOW.test(text) || ASSESSMENT_LOW_THEN_ASSIGNMENT_HIGH.test(text);
}

function claimedAssignmentLow(text: string): boolean {
  return ASSIGNMENT_LOW_ASSESSMENT_HIGH.test(text) || ASSESSMENT_HIGH_THEN_ASSIGNMENT_LOW.test(text);
}

function assignmentPercent(row: AssignmentRow): number {
  return Math.round((row.score / row.totalPoints) * 10000) / 100;
}

function parseTime(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function detectConflictEvidenceInconsistencies(
  source: DiagnosisConflictEvidenceSource,
  input: DiagnosisConflictEvidenceInput,
): string[] {
  if (!diagnosisReportDeclaresConflict(source)) return [];

  const cited = new Set([
    ...source.evidenceRefs,
    ...source.findings.flatMap((finding) => finding.evidenceRefs),
  ]);
  const assignments = (input.assignmentSubmissions ?? []).filter((row) => (
    cited.has(`assignment-submission:${row.id}`)
  ));
  const assessments = (input.assessmentSessions ?? []).filter((row) => (
    cited.has(`adaptive-assessment-session:${row.id}`)
  ));
  if (assignments.length === 0 || assessments.length === 0) {
    return ['conflict-evidence-missing-sources'];
  }

  const assignmentUsers = new Set(assignments.map((row) => row.userId));
  const assessmentUsers = new Set(assessments.map((row) => row.userId));
  for (const userId of assignmentUsers) {
    if (!assessmentUsers.has(userId)) return ['conflict-evidence-cross-student'];
  }
  for (const userId of assessmentUsers) {
    if (!assignmentUsers.has(userId)) return ['conflict-evidence-cross-student'];
  }

  const text = conflictText(source);
  const wantAssignmentHigh = claimedAssignmentHigh(text);
  const wantAssignmentLow = claimedAssignmentLow(text);
  let supportingPair = false;

  for (const userId of assignmentUsers) {
    const studentAssignments = assignments.filter((row) => row.userId === userId);
    const studentAssessments = assessments.filter((row) => row.userId === userId);
    if (studentAssignments.length === 0 || studentAssessments.length === 0) {
      return ['conflict-evidence-cross-student'];
    }
    for (const assignment of studentAssignments) {
      for (const assessment of studentAssessments) {
        const pairError = inspectCitedPair(
          assignment,
          assessment,
          wantAssignmentHigh,
          wantAssignmentLow,
        );
        if (pairError) return [pairError];
        supportingPair = true;
      }
    }
  }

  return supportingPair ? [] : ['conflict-evidence-unproved'];
}

function inspectCitedPair(
  assignment: AssignmentRow,
  assessment: AssessmentRow,
  wantAssignmentHigh: boolean,
  wantAssignmentLow: boolean,
): string | null {
  const assignmentAt = parseTime(assignment.reviewedAt);
  const assessmentAt = parseTime(assessment.completedAt);
  if (assignmentAt === null || assessmentAt === null
    || Math.abs(assignmentAt - assessmentAt) > DIAGNOSIS_CONFLICT_COMPARABLE_WINDOW_MS) {
    return 'conflict-evidence-time-window';
  }
  const assignmentScore = assignmentPercent(assignment);
  const assessmentScore = assessment.score;
  if (wantAssignmentHigh) {
    if (assignmentScore === assessmentScore) return 'conflict-evidence-equal-scores';
    if (assignmentScore < assessmentScore) return 'conflict-evidence-wrong-direction';
    return null;
  }
  if (wantAssignmentLow) {
    if (assignmentScore === assessmentScore) return 'conflict-evidence-equal-scores';
    if (assignmentScore > assessmentScore) return 'conflict-evidence-wrong-direction';
    return null;
  }
  return Math.abs(assignmentScore - assessmentScore) >= 1 ? null : 'conflict-evidence-equal-scores';
}
