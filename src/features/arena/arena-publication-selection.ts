import type { ArenaPublicationRecord } from './teacher/publication-store';

function publicationPriority(publication: ArenaPublicationRecord): number {
  if (publication.visibility === 'class') return 0;
  if (publication.homeworkBinding) return 1;
  if (publication.visibility === 'course') return 2;
  return 3;
}

function comparePublicationPriority(left: ArenaPublicationRecord, right: ArenaPublicationRecord): number {
  const priority = publicationPriority(left) - publicationPriority(right);
  if (priority !== 0) return priority;
  return Date.parse(left.deadline) - Date.parse(right.deadline);
}

export function selectArenaHallCurrentPublication(
  publications: readonly ArenaPublicationRecord[],
): ArenaPublicationRecord | undefined {
  return [...publications].sort(comparePublicationPriority)[0];
}

export function selectArenaHallPublicationForTask(
  publications: readonly ArenaPublicationRecord[],
  taskId: string,
): ArenaPublicationRecord | undefined {
  return publications
    .filter((publication) => publication.taskId === taskId)
    .sort(comparePublicationPriority)[0];
}
