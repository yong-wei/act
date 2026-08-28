import type {
  GoalPluginEvidencePort,
  PersonalizationGoalHint,
  PersonalizationGoalHintField,
  PersonalizationGoalPlugin,
  PersonalizationGoalResolution,
} from './types';
import { readString } from './json';

function mappingError(kind: string, key: string): Error {
  return new Error(`personalization-plugin-registry:${kind}:${key}`);
}

export class PersonalizationPluginRegistry {
  private readonly plugins = new Map<string, PersonalizationGoalPlugin>();
  private readonly courseToGoal = new Map<string, string>();
  private readonly lessonToGoal = new Map<string, string>();
  private readonly taskToGoal = new Map<string, string>();

  register(plugin: PersonalizationGoalPlugin): void {
    if (this.plugins.has(plugin.goalId)) {
      throw mappingError('duplicate-goal', plugin.goalId);
    }
    this.indexIds(this.courseToGoal, plugin.courseIds, plugin.goalId, 'course');
    this.indexIds(this.lessonToGoal, plugin.lessonIds, plugin.goalId, 'lesson');
    this.indexIds(this.taskToGoal, plugin.arenaTaskIds, plugin.goalId, 'task');
    this.plugins.set(plugin.goalId, plugin);
  }

  get(goalId: string): PersonalizationGoalPlugin | null {
    return this.plugins.get(goalId) ?? null;
  }

  list(): PersonalizationGoalPlugin[] {
    return [...this.plugins.values()];
  }

  listGoalIds(): string[] {
    return [...this.plugins.keys()];
  }

  resolve(hint: PersonalizationGoalHint): PersonalizationGoalResolution {
    const requestedVersion = readString(hint.pluginVersion);
    const explicitGoalId = readString(hint.goalId);
    const matches: Array<{ goalId: string; field: PersonalizationGoalHintField }> = [];

    if (explicitGoalId) {
      matches.push({ goalId: explicitGoalId, field: 'goalId' });
    }
    this.collectMapped(matches, 'courseId', hint.courseId, this.courseToGoal);
    this.collectMapped(matches, 'lessonId', hint.lessonId, this.lessonToGoal);
    this.collectMapped(matches, 'taskId', hint.taskId, this.taskToGoal);

    if (matches.length === 0) {
      return {
        status: 'unsupported',
        reason: 'unknown-mapping',
        goalId: explicitGoalId,
        limitation: 'unsupported-goal',
      };
    }

    const uniqueGoalIds = [...new Set(matches.map((match) => match.goalId))];
    if (uniqueGoalIds.length > 1) {
      return {
        status: 'unsupported',
        reason: 'conflicting-mapping',
        goalId: explicitGoalId,
        limitation: 'unsupported-goal',
      };
    }

    const goalId = uniqueGoalIds[0];
    const plugin = this.plugins.get(goalId);
    if (!plugin) {
      return {
        status: 'unsupported',
        reason: 'unknown-mapping',
        goalId,
        limitation: 'unsupported-goal',
      };
    }
    if (plugin.status === 'retired') {
      return {
        status: 'unsupported',
        reason: 'plugin-retired',
        goalId,
        limitation: 'unsupported-goal',
      };
    }
    if (plugin.status !== 'active') {
      return {
        status: 'unsupported',
        reason: 'plugin-unavailable',
        goalId,
        limitation: 'unsupported-goal',
      };
    }
    if (requestedVersion && requestedVersion !== plugin.version) {
      return {
        status: 'unsupported',
        reason: 'version-unavailable',
        goalId,
        limitation: 'unsupported-goal',
      };
    }

    return {
      status: 'resolved',
      context: {
        goalId: plugin.goalId,
        pluginId: plugin.pluginId,
        pluginVersion: plugin.version,
        matchedBy: [...new Set(matches.map((match) => match.field))],
      },
    };
  }

  createEvidencePort<TDb>(goalId: string, db: TDb): GoalPluginEvidencePort | null {
    const plugin = this.get(goalId);
    if (!plugin || plugin.status !== 'active') return null;
    return plugin.createEvidencePort(db);
  }

  private indexIds(
    index: Map<string, string>,
    ids: readonly string[],
    goalId: string,
    kind: string,
  ): void {
    for (const id of ids) {
      const existing = index.get(id);
      if (existing && existing !== goalId) {
        throw mappingError(`conflicting-${kind}`, id);
      }
      index.set(id, goalId);
    }
  }

  private collectMapped(
    matches: Array<{ goalId: string; field: PersonalizationGoalHintField }>,
    field: PersonalizationGoalHintField,
    raw: string | null | undefined,
    index: Map<string, string>,
  ): void {
    const value = readString(raw);
    if (!value) return;
    const goalId = index.get(value);
    if (goalId) {
      matches.push({ goalId, field });
    }
  }
}

export function createPersonalizationPluginRegistry(): PersonalizationPluginRegistry {
  return new PersonalizationPluginRegistry();
}
