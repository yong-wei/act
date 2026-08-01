export const PRESET_RUNTIME_BINDING_FIELD = '__presetRuntimeBinding';
export const PRESET_RUNTIME_BINDING_SCHEMA_VERSION = 'preset-runtime-step-binding-v1';

export interface PresetRuntimeStepBinding {
  schemaVersion: typeof PRESET_RUNTIME_BINDING_SCHEMA_VERSION;
  sourcePresetKey: string;
  runtimeLessonId: string;
  runtimeStepId: string;
}

type BindingParseResult =
  | { state: 'absent' }
  | { state: 'malformed' }
  | { state: 'valid'; binding: PresetRuntimeStepBinding };

type BoundItem<T> = {
  item: T;
  binding: PresetRuntimeStepBinding;
};

export type PlanRuntimeBindingResolution<T> =
  | { state: 'absent' }
  | { state: 'invalid' }
  | {
    state: 'valid';
    sourcePresetKey: string;
    runtimeLessonId: string;
    items: Array<BoundItem<T>>;
  };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function createPresetRuntimeStepBinding(input: {
  sourcePresetKey: string;
  runtimeLessonId: string;
  runtimeStepId: string;
}): PresetRuntimeStepBinding {
  return {
    schemaVersion: PRESET_RUNTIME_BINDING_SCHEMA_VERSION,
    sourcePresetKey: input.sourcePresetKey,
    runtimeLessonId: input.runtimeLessonId,
    runtimeStepId: input.runtimeStepId,
  };
}

export function readPresetRuntimeStepBinding(overrideConfig: unknown): BindingParseResult {
  const config = record(overrideConfig);
  if (!config || !(PRESET_RUNTIME_BINDING_FIELD in config)) return { state: 'absent' };

  const value = record(config[PRESET_RUNTIME_BINDING_FIELD]);
  if (!value || value.schemaVersion !== PRESET_RUNTIME_BINDING_SCHEMA_VERSION) {
    return { state: 'malformed' };
  }
  const sourcePresetKey = nonEmptyString(value.sourcePresetKey);
  const runtimeLessonId = nonEmptyString(value.runtimeLessonId);
  const runtimeStepId = nonEmptyString(value.runtimeStepId);
  if (!sourcePresetKey || !runtimeLessonId || !runtimeStepId) return { state: 'malformed' };

  return {
    state: 'valid',
    binding: {
      schemaVersion: PRESET_RUNTIME_BINDING_SCHEMA_VERSION,
      sourcePresetKey,
      runtimeLessonId,
      runtimeStepId,
    },
  };
}

export function stripPresetRuntimeStepBinding(overrideConfig: unknown): Record<string, unknown> {
  const config = record(overrideConfig);
  if (!config) return {};
  const sanitized = { ...config };
  delete sanitized[PRESET_RUNTIME_BINDING_FIELD];
  return sanitized;
}

export function withPresetRuntimeStepBinding(
  overrideConfig: unknown,
  binding: PresetRuntimeStepBinding,
): Record<string, unknown> {
  return {
    ...stripPresetRuntimeStepBinding(overrideConfig),
    [PRESET_RUNTIME_BINDING_FIELD]: binding,
  };
}

export function resolvePlanRuntimeBindings<T extends { overrideConfig?: unknown }>(
  items: T[],
): PlanRuntimeBindingResolution<T> {
  const boundItems: Array<BoundItem<T>> = [];
  for (const item of items) {
    const parsed = readPresetRuntimeStepBinding(item.overrideConfig);
    if (parsed.state === 'malformed') return { state: 'invalid' };
    if (parsed.state === 'valid') boundItems.push({ item, binding: parsed.binding });
  }
  if (boundItems.length === 0) return { state: 'absent' };

  const sourcePresetKey = boundItems[0].binding.sourcePresetKey;
  const runtimeLessonId = boundItems[0].binding.runtimeLessonId;
  const runtimeStepIds = new Set<string>();
  for (const { binding } of boundItems) {
    if (
      binding.sourcePresetKey !== sourcePresetKey
      || binding.runtimeLessonId !== runtimeLessonId
      || runtimeStepIds.has(binding.runtimeStepId)
    ) {
      return { state: 'invalid' };
    }
    runtimeStepIds.add(binding.runtimeStepId);
  }

  return {
    state: 'valid',
    sourcePresetKey,
    runtimeLessonId,
    items: boundItems,
  };
}
