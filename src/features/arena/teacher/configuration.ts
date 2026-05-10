import {
  getArenaChallengeTask,
  getArenaLeaderboardPolicy,
} from '../data/seed-challenges';

export type ArenaPublicationVisibility = 'class' | 'course' | 'public';

export interface CreateArenaChallengePublicationInput {
  taskId: string;
  classId: string;
  visibility: ArenaPublicationVisibility;
  deadline: string;
  leaderboardPolicyId: string;
  homeworkBinding: boolean;
}

export interface ArenaChallengePublication {
  id: string;
  taskId: string;
  classId: string;
  studentVisibility: ArenaPublicationVisibility;
  deadline: string;
  leaderboardPolicyId: string;
  homeworkBinding: boolean;
}

export interface ArenaHomeworkAssessmentInput {
  validSubmission: boolean;
  score: number;
  rank: number;
  diagnosticWeakMetrics: string[];
}

export interface ArenaHomeworkAssessment {
  gradeComponents: {
    completionScore: number;
    masteryScore: number;
    diagnosticScore: number;
    rankContribution: number;
  };
  summary: string;
}

export function createArenaChallengePublication(
  input: CreateArenaChallengePublicationInput,
): ArenaChallengePublication {
  const task = getArenaChallengeTask(input.taskId);
  if (!task) {
    throw new Error(`Unknown arena task: ${input.taskId}`);
  }
  const policy = getArenaLeaderboardPolicy(input.leaderboardPolicyId);
  if (!policy) {
    throw new Error(`Unknown leaderboard policy: ${input.leaderboardPolicyId}`);
  }

  return {
    id: `arena-publication-${input.classId}-${input.taskId}`,
    taskId: input.taskId,
    classId: input.classId,
    studentVisibility: input.visibility,
    deadline: input.deadline,
    leaderboardPolicyId: input.leaderboardPolicyId,
    homeworkBinding: input.homeworkBinding,
  };
}

export function resolvePublishedArenaTasksForStudent(
  publications: readonly ArenaChallengePublication[],
  classId: string,
): ArenaChallengePublication[] {
  return publications.filter((publication) =>
    publication.studentVisibility !== 'class' || publication.classId === classId,
  );
}

export function deriveArenaHomeworkAssessment(
  input: ArenaHomeworkAssessmentInput,
): ArenaHomeworkAssessment {
  const completionScore = input.validSubmission ? 30 : 0;
  const masteryScore = input.validSubmission ? Math.round(Math.max(0, Math.min(100, input.score)) * 0.6) : 0;
  const diagnosticScore = Math.max(0, 10 - input.diagnosticWeakMetrics.length * 2);

  return {
    gradeComponents: {
      completionScore,
      masteryScore,
      diagnosticScore,
      rankContribution: 0,
    },
    summary: `作业评价由达标提交、指标掌握和诊断表现构成；排行榜第 ${input.rank} 名只用于比较，不直接换算为成绩。`,
  };
}
