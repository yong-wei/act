import type { ArenaPublicationRecord } from './teacher/publication-store';

function publicationPriority(publication: ArenaPublicationRecord): number {
  if (publication.visibility === 'class') return 0;
  if (publication.homeworkBinding) return 1;
  if (publication.visibility === 'course') return 2;
  return 3;
}

export function selectArenaHallPublicationForTask(
  publications: readonly ArenaPublicationRecord[],
  taskId: string,
): ArenaPublicationRecord | undefined {
  return publications
    .filter((publication) => publication.taskId === taskId)
    .sort((left, right) => publicationPriority(left) - publicationPriority(right))[0];
}
