import type { ArenaSubmissionRecord } from './submissions/submission-service';

export interface ArenaWeakMetricSignal {
  metricId: string;
  affectedSubmissionCount: number;
  lowestSatisfaction: number;
}

export interface ArenaTeachingAnalytics {
  submissionCount: number;
  stability: {
    unstableSubmissionIds: string[];
  };
  weakMetrics: ArenaWeakMetricSignal[];
  tradeoffBias: {
    speedOverEnergyStudentLabels: string[];
  };
  identification: {
    weakBlackBoxStudentLabels: string[];
  };
  iterationImprovement: {
    improvedToValidStudentLabels: string[];
  };
  blindTuning: {
    suspectedStudentLabels: string[];
  };
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'));
}

function isUnstable(submission: ArenaSubmissionRecord): boolean {
  const stability = submission.evaluation.hardConstraintResults.find(
    (result) => result.id === 'closed_loop_stable',
  );

  return stability ? stability.passed === false : submission.evaluation.valid === false;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function groupByStudent(submissions: ArenaSubmissionRecord[]): Map<string, ArenaSubmissionRecord[]> {
  const grouped = new Map<string, ArenaSubmissionRecord[]>();
  for (const submission of submissions) {
    const key = submission.userId ?? submission.studentLabel;
    grouped.set(key, [...(grouped.get(key) ?? []), submission]);
  }

  for (const group of Array.from(grouped.values())) {
    group.sort((left, right) => Date.parse(left.submittedAt) - Date.parse(right.submittedAt));
  }

  return grouped;
}

function buildWeakMetrics(submissions: ArenaSubmissionRecord[]): ArenaWeakMetricSignal[] {
  const metricSignals = new Map<string, { count: number; lowest: number }>();

  for (const submission of submissions) {
    for (const [metricId, satisfaction] of Object.entries(submission.evaluation.satisfaction)) {
      if (!Number.isFinite(satisfaction) || satisfaction >= 0.6) {
        continue;
      }
      const current = metricSignals.get(metricId) ?? { count: 0, lowest: 1 };
      metricSignals.set(metricId, {
        count: current.count + 1,
        lowest: Math.min(current.lowest, satisfaction),
      });
    }
  }

  return Array.from(metricSignals.entries())
    .map(([metricId, signal]) => ({
      metricId,
      affectedSubmissionCount: signal.count,
      lowestSatisfaction: signal.lowest,
    }))
    .sort((left, right) => (
      right.affectedSubmissionCount - left.affectedSubmissionCount
      || left.metricId.localeCompare(right.metricId)
    ));
}

export function buildArenaTeachingAnalytics(submissions: ArenaSubmissionRecord[]): ArenaTeachingAnalytics {
  const unstableSubmissionIds = submissions
    .filter(isUnstable)
    .map((submission) => submission.id);

  const speedOverEnergyStudentLabels = submissions
    .filter((submission) => (
      submission.evaluation.valid
      && (submission.evaluation.satisfaction.settlingTime ?? 0) >= 0.85
      && (submission.evaluation.satisfaction.controlEnergy ?? 1) < 0.5
    ))
    .map((submission) => submission.studentLabel);

  const weakBlackBoxStudentLabels = submissions
    .filter((submission) => {
      const identificationQuality = readNumber(submission.artifact.params.identificationQuality);
      const identificationFit = readNumber(submission.evaluation.metrics.identificationFit);
      return identificationQuality !== null
        ? identificationQuality < 0.6
        : identificationFit !== null && identificationFit < 0.6;
    })
    .map((submission) => submission.studentLabel);

  const improvedToValidStudentLabels: string[] = [];
  const suspectedBlindTuningLabels: string[] = [];

  for (const group of Array.from(groupByStudent(submissions).values())) {
    const first = group[0];
    const last = group[group.length - 1];
    if (!first || !last) {
      continue;
    }

    const hadEarlyFailure = group.some((submission, index) => (
      index < group.length - 1
      && (!submission.evaluation.valid || submission.evaluation.score < 50)
    ));
    const laterValidHighScore = last.evaluation.valid && last.evaluation.score >= 80;
    if (hadEarlyFailure && laterValidHighScore) {
      improvedToValidStudentLabels.push(last.studentLabel);
    }

    const maxTuningRunCount = Math.max(
      ...group.map((submission) => readNumber(submission.artifact.params.tuningRunCount) ?? 0),
    );
    const scoreGain = last.evaluation.score - first.evaluation.score;
    if (group.length >= 2 && maxTuningRunCount >= 20 && scoreGain <= 5) {
      suspectedBlindTuningLabels.push(last.studentLabel);
    }
  }

  return {
    submissionCount: submissions.length,
    stability: {
      unstableSubmissionIds,
    },
    weakMetrics: buildWeakMetrics(submissions),
    tradeoffBias: {
      speedOverEnergyStudentLabels: uniqueSorted(speedOverEnergyStudentLabels),
    },
    identification: {
      weakBlackBoxStudentLabels: uniqueSorted(weakBlackBoxStudentLabels),
    },
    iterationImprovement: {
      improvedToValidStudentLabels: uniqueSorted(improvedToValidStudentLabels),
    },
    blindTuning: {
      suspectedStudentLabels: uniqueSorted(suspectedBlindTuningLabels),
    },
  };
}
