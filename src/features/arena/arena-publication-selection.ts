import type { ArenaPublicationRecord } from './teacher/publication-store';

function publicationPriority(publication: ArenaPublicationRecord): number {
  if (publication.visibility === 'class') return 0;
  if (publication.homeworkBinding) return 1;
  if (publication.visibility === 'course') return 2;
  return 3;
}

function publicationLifecyclePriority(publication: ArenaPublicationRecord, now: Date): number {
  if (Date.parse(publication.deadline) >= now.getTime()) return 0;
  if (publication.gradingPolicy.allowLateSubmissions === true) return 1;
  return 2;
}

function comparePublicationPriority(
  left: ArenaPublicationRecord,
  right: ArenaPublicationRecord,
  now: Date,
): number {
  const leftLifecycle = publicationLifecyclePriority(left, now);
  const rightLifecycle = publicationLifecyclePriority(right, now);
  const lifecycle = leftLifecycle - rightLifecycle;
  if (lifecycle !== 0) return lifecycle;

  if (leftLifecycle === 2) {
    const reportDeadlineOrder = Date.parse(right.deadline) - Date.parse(left.deadline);
    if (reportDeadlineOrder !== 0) return reportDeadlineOrder;
  }

  const priority = publicationPriority(left) - publicationPriority(right);
  if (priority !== 0) return priority;

  return Date.parse(left.deadline) - Date.parse(right.deadline);
}

export function selectArenaHallCurrentPublication(
  publications: readonly ArenaPublicationRecord[],
  now = new Date(),
): ArenaPublicationRecord | undefined {
  return [...publications].sort((left, right) => comparePublicationPriority(left, right, now))[0];
}

export function selectArenaHallPublicationForTask(
  publications: readonly ArenaPublicationRecord[],
  taskId: string,
  now = new Date(),
): ArenaPublicationRecord | undefined {
  return publications
    .filter((publication) => publication.taskId === taskId)
    .sort((left, right) => comparePublicationPriority(left, right, now))[0];
}
