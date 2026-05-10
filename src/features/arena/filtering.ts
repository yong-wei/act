import type {
  ChallengeObjectSource,
  ChallengeTask,
  ControllerMethod,
  LeaderboardType,
  ModelVisibility,
} from './types';
import { getArenaChallengeObject } from './data/seed-challenges';

export type HomeworkFilter = 'all' | 'homework-capable' | 'open-practice';

export interface ArenaTaskFilters {
  query?: string;
  chapter?: string;
  source?: ChallengeObjectSource | 'all';
  method?: ControllerMethod | 'all';
  difficulty?: ChallengeTask['difficulty'] | 'all';
  visibility?: ModelVisibility | 'all';
  homework?: HomeworkFilter;
  leaderboard?: LeaderboardType | 'all';
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function matchesQuery(task: ChallengeTask, query: string | undefined): boolean {
  const normalizedQuery = normalize(query ?? '');
  if (!normalizedQuery) return true;

  const object = getArenaChallengeObject(task.objectId);
  const haystack = normalize([
    task.title,
    task.goal,
    object?.name,
    object?.chapter,
    object?.tags.join(' '),
    object?.relatedKnowledge.join(' '),
  ].filter(Boolean).join(' '));

  return normalizedQuery.split(/\s+/).every((term) => haystack.includes(term));
}

export function filterArenaChallengeTasks(
  tasks: readonly ChallengeTask[],
  filters: ArenaTaskFilters,
): ChallengeTask[] {
  return tasks.filter((task) => {
    const object = getArenaChallengeObject(task.objectId);
    if (!object) return false;

    if (!matchesQuery(task, filters.query)) return false;
    if (filters.chapter && !object.chapter.includes(filters.chapter)) return false;
    if (filters.source && filters.source !== 'all' && object.source !== filters.source) return false;
    if (filters.method && filters.method !== 'all' && !task.allowedMethods.includes(filters.method)) return false;
    if (filters.difficulty && filters.difficulty !== 'all' && task.difficulty !== filters.difficulty) return false;
    if (filters.visibility && filters.visibility !== 'all' && object.visibility !== filters.visibility) return false;
    if (filters.leaderboard && filters.leaderboard !== 'all' && !task.leaderboardTypes.includes(filters.leaderboard)) return false;
    if (filters.homework === 'homework-capable' && !task.homeworkEligible) return false;
    if (filters.homework === 'open-practice' && task.practiceMode !== 'open') return false;

    return true;
  });
}
