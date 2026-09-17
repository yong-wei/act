import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGoalPlanningRegistry } from '@/features/personalization/path-planning/planning-projection-index';
import { GOAL_CANONICAL_KNOWLEDGE } from '@/features/personalization/path-planning/goal-canonical-knowledge';
const batch = dirname(fileURLToPath(import.meta.url));
const progress = JSON.parse(readFileSync('openspec/changes/activate-teaching-card-batch-01/production-progress.json', 'utf8'));
const ids: string[] = progress.inFlightBatch.canonicalIds;
const rows = ids.map((canonicalId) => ({ canonicalId,
  goals: Object.keys(GOAL_CANONICAL_KNOWLEDGE).filter((goalId) => loadGoalPlanningRegistry(goalId).universe.knowledgeIds.includes(canonicalId)),
  directGoals: Object.entries(GOAL_CANONICAL_KNOWLEDGE).filter(([, targets]) => targets.some((r) => r.canonicalId === canonicalId)).map(([id]) => id),
}));
writeFileSync(join(batch, 'goal-scope-before.json'), JSON.stringify({ status: 'scope-only-not-consumption-proof', rows }, null, 2) + '\n');
console.log(JSON.stringify(rows, null, 2));
