'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import {
  DEFAULT_ENVIRONMENT_PRESET_ID,
  getEnvironmentPreset,
  SCENE_ENVIRONMENT_PRESETS,
  type SceneEnvironmentPreset,
  type SceneEnvironmentPresetId,
} from './environment-presets';

interface SceneEnvironmentContextValue {
  readonly preset: SceneEnvironmentPreset;
  readonly presetId: SceneEnvironmentPresetId;
  readonly presets: readonly SceneEnvironmentPreset[];
  readonly setPresetId: (id: SceneEnvironmentPresetId) => void;
}

const SceneEnvironmentContext = createContext<SceneEnvironmentContextValue | null>(null);

/** 环境预设切换器状态：场景本体（Canvas 内）与切换器 chrome（Canvas 外）共享。 */
export function SceneEnvironmentProvider({
  children,
  defaultPresetId = DEFAULT_ENVIRONMENT_PRESET_ID,
}: {
  readonly children: ReactNode;
  readonly defaultPresetId?: SceneEnvironmentPresetId;
}) {
  const [presetId, setPresetId] = useState<SceneEnvironmentPresetId>(defaultPresetId);
  const value = useMemo<SceneEnvironmentContextValue>(
    () => ({
      preset: getEnvironmentPreset(presetId),
      presetId,
      presets: SCENE_ENVIRONMENT_PRESETS,
      setPresetId,
    }),
    [presetId]
  );
  return (
    <SceneEnvironmentContext.Provider value={value}>
      {children}
    </SceneEnvironmentContext.Provider>
  );
}

export function useSceneEnvironment(): SceneEnvironmentContextValue {
  const value = useContext(SceneEnvironmentContext);
  if (!value) throw new Error('useSceneEnvironment must be used within SceneEnvironmentProvider');
  return value;
}

/** 场景 chrome 中的手动环境预设切换器（ pill 按钮组）。 */
export function EnvironmentPresetSwitcher({ className }: { readonly className?: string }) {
  const { presetId, presets, setPresetId } = useSceneEnvironment();
  return (
    <div
      className={className}
      role="radiogroup"
      aria-label="环境预设"
      data-scene-environment-switcher="true"
    >
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          role="radio"
          aria-checked={preset.id === presetId}
          data-environment-preset={preset.id}
          onClick={() => setPresetId(preset.id)}
          className={
            preset.id === presetId
              ? 'rounded-md border border-platform-border bg-platform-action-subtle px-2 py-1 text-xs font-medium text-platform-fg-primary'
              : 'rounded-md border border-transparent px-2 py-1 text-xs text-platform-fg-muted hover:text-platform-fg-primary'
          }
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
