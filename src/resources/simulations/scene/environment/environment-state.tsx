'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { CloudSun } from 'lucide-react';

import { ChromePopoverButton } from '../chrome';

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
  /** 尾迹粒子场可见性（环境菜单内开关，默认开）。 */
  readonly wakeVisible: boolean;
  readonly setWakeVisible: (visible: boolean) => void;
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
  const [wakeVisible, setWakeVisible] = useState(true);
  const value = useMemo<SceneEnvironmentContextValue>(
    () => ({
      preset: getEnvironmentPreset(presetId),
      presetId,
      presets: SCENE_ENVIRONMENT_PRESETS,
      setPresetId,
      wakeVisible,
      setWakeVisible,
    }),
    [presetId, wakeVisible]
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

/** 场景 chrome 中的手动环境预设切换器（底部 chrome 家族弹出式按钮；尾流开关在菜单内）。 */
export function EnvironmentPresetSwitcher({ className }: { readonly className?: string }) {
  const { presetId, presets, setPresetId, wakeVisible, setWakeVisible } = useSceneEnvironment();
  const current = presets.find((preset) => preset.id === presetId);
  return (
    <div className={className} data-scene-environment-switcher="true">
      <ChromePopoverButton
        icon={<CloudSun className="h-4 w-4" />}
        label="环境"
        currentLabel={current?.label ?? ''}
        tooltip={`环境预设：切换海况、天空与光照（当前：${current?.label ?? ''}；尾流：${wakeVisible ? '开' : '关'}）`}
        options={presets.map((preset) => ({ id: preset.id, label: preset.label }))}
        currentId={presetId}
        onSelect={setPresetId}
        dataHook="environment"
        ariaLabel="环境预设"
        optionDataHook="environment-preset"
        tail={(
          <button
            type="button"
            role="switch"
            aria-checked={wakeVisible}
            data-wake-toggle={wakeVisible}
            onClick={() => setWakeVisible(!wakeVisible)}
            className="mt-1 flex w-full items-center justify-between border-t border-platform-border px-2 py-1 text-xs text-platform-fg-muted hover:text-platform-fg-primary"
          >
            <span>尾流</span>
            <span className={wakeVisible ? 'font-medium text-platform-fg-primary' : ''}>{wakeVisible ? '开' : '关'}</span>
          </button>
        )}
      />
    </div>
  );
}
