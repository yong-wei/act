'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { Volume2, VolumeX } from 'lucide-react';

import { ChromePopoverButton } from '../chrome';
import {
  createSoundscapeBus,
  readSoundChannelPreference,
  writeSoundChannelPreference,
  type AlertKind,
  type AmbienceKey,
  type FeedbackKind,
  type SoundChannel,
  type SoundscapeBus,
} from './soundscape-bus';
import { useSceneEnvironment } from '../environment/environment-state';

interface SceneSoundscapeContextValue {
  readonly unlocked: boolean;
  readonly sceneEnabled: boolean;
  readonly uiEnabled: boolean;
  readonly setChannelEnabled: (channel: SoundChannel, enabled: boolean) => void;
  /** 兼容旧语义：双通道均关视为静音。 */
  readonly muted: boolean;
  readonly playFeedback: (kind: FeedbackKind) => void;
  readonly playAlert: (kind: AlertKind) => void;
  readonly setAmbience: (key: AmbienceKey) => void;
}

const SceneSoundscapeContext = createContext<SceneSoundscapeContextValue | null>(null);

/**
 * 首次解锁手势自身的界面音效补播：委托监听器要等 React 提交 unlocked=true 后才注册，
 * 触发解锁的该次 pointerdown 已结束分发；已启用界面音效的用户首次点击（尤其「开始」）不能静默。
 */
function playUnlockingGestureFeedback(bus: SoundscapeBus, event: PointerEvent | KeyboardEvent, uiEnabled: boolean) {
  if (!uiEnabled || !(event instanceof PointerEvent)) return;
  const target = event.target as Element | null;
  if (!target?.closest?.('[data-sim-ui]')) return;
  const button = target.closest('button, [role="button"]');
  if (!button) return;
  bus.playFeedback(button.hasAttribute('data-sound-start') ? 'start' : 'button');
}

/**
 * 音景状态：场景/界面双通道（新用户默认关闭、分通道 localStorage 持久化）、
 * 首次用户手势解锁（autoplay 策略）；AudioContext 延迟到解锁时创建。
 */
export function SceneSoundscapeProvider({ children }: { readonly children: ReactNode }) {
  const busRef = useRef<SoundscapeBus | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [sceneEnabled, setSceneEnabled] = useState(false);
  const [uiEnabled, setUiEnabled] = useState(false);
  const sceneEnabledRef = useRef(sceneEnabled);
  const uiEnabledRef = useRef(uiEnabled);
  sceneEnabledRef.current = sceneEnabled;
  uiEnabledRef.current = uiEnabled;

  const getBus = () => {
    if (!busRef.current) {
      const AudioContextCtor = window.AudioContext
        ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return null;
      busRef.current = createSoundscapeBus(new AudioContextCtor() as never);
    }
    return busRef.current;
  };

  useEffect(() => {
    if (unlocked) return;
    const unlock = (event: PointerEvent | KeyboardEvent) => {
      const bus = getBus();
      if (!bus) return;
      // 新用户（无持久化记录）默认双通道关闭；有记录按记录恢复
      const scenePref = readSoundChannelPreference(window.localStorage, 'scene') ?? false;
      const uiPref = readSoundChannelPreference(window.localStorage, 'ui') ?? false;
      bus.unlock();
      bus.setChannelEnabled('scene', scenePref);
      bus.setChannelEnabled('ui', uiPref);
      setSceneEnabled(scenePref);
      setUiEnabled(uiPref);
      setUnlocked(true);
      playUnlockingGestureFeedback(bus, event, uiPref);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  useEffect(() => () => {
    // provider 卸载：停止永久环境声源并关闭音频上下文（否则离开页面后声音继续、重进叠加）。
    busRef.current?.dispose();
    busRef.current = null;
  }, []);

  // 界面音效统一接线：仿真根内的按钮点击播放普通点击音；data-sound-start 标记的「开始」按钮播放专属音效。
  useEffect(() => {
    if (!unlocked) return;
    const listener = (event: PointerEvent) => {
      if (!uiEnabledRef.current) return;
      const target = event.target as Element | null;
      const root = target?.closest?.('[data-sim-ui]');
      if (!root) return;
      const button = target?.closest?.('button, [role="button"]');
      if (!button) return;
      busRef.current?.playFeedback(button.hasAttribute('data-sound-start') ? 'start' : 'button');
    };
    window.addEventListener('pointerdown', listener);
    return () => window.removeEventListener('pointerdown', listener);
  }, [unlocked]);

  const value = useMemo<SceneSoundscapeContextValue>(() => ({
    unlocked,
    sceneEnabled,
    uiEnabled,
    setChannelEnabled: (channel, enabled) => {
      if (channel === 'scene') setSceneEnabled(enabled);
      else setUiEnabled(enabled);
      writeSoundChannelPreference(window.localStorage, channel, enabled);
      busRef.current?.setChannelEnabled(channel, enabled);
    },
    muted: !sceneEnabled && !uiEnabled,
    playFeedback: (kind) => busRef.current?.playFeedback(kind),
    playAlert: (kind) => busRef.current?.playAlert(kind),
    setAmbience: (key) => busRef.current?.setAmbience(key),
  }), [unlocked, sceneEnabled, uiEnabled]);

  return (
    <SceneSoundscapeContext.Provider value={value}>
      {children}
    </SceneSoundscapeContext.Provider>
  );
}

export function useSceneSoundscape(): SceneSoundscapeContextValue {
  const value = useContext(SceneSoundscapeContext);
  if (!value) throw new Error('useSceneSoundscape must be used within SceneSoundscapeProvider');
  return value;
}

/** 环境预设 → 环境声联动驱动（挂一次即可，位置不限）。 */
export function SoundscapeAmbienceDriver() {
  const { preset } = useSceneEnvironment();
  const { setAmbience } = useSceneSoundscape();
  useEffect(() => {
    setAmbience(preset.ambience);
  }, [preset.ambience, setAmbience]);
  return null;
}

/** 音效按钮（底部 chrome 家族弹出式）：场景/界面双通道独立开关。 */
export function SoundscapeMuteToggle({ className }: { readonly className?: string }) {
  const { sceneEnabled, uiEnabled, setChannelEnabled, muted } = useSceneSoundscape();
  const stateLabel = muted ? '关' : sceneEnabled && uiEnabled ? '双开' : sceneEnabled ? '场景' : '界面';
  return (
    <div className={className} data-soundscape-muted={muted}>
      <ChromePopoverButton
        icon={muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        label="音效"
        currentLabel={stateLabel}
        tooltip={`音效：场景（环境声+告警）与界面（按钮点击）分通道开关（当前：${stateLabel}）`}
        options={[]}
        currentId={null}
        onSelect={() => undefined}
        dataHook="sound"
        ariaLabel="音效"
        tail={(
          <div className="min-w-28">
            {([
              { channel: 'scene' as const, label: '场景', enabled: sceneEnabled },
              { channel: 'ui' as const, label: '界面', enabled: uiEnabled },
            ]).map((row) => (
              <button
                key={row.channel}
                type="button"
                role="switch"
                aria-checked={row.enabled}
                data-sound-channel={row.channel}
                onClick={() => setChannelEnabled(row.channel, !row.enabled)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1 text-xs text-platform-fg-muted hover:text-platform-fg-primary"
              >
                <span>{row.label}</span>
                <span className={row.enabled ? 'font-medium text-platform-fg-primary' : ''}>{row.enabled ? '开' : '关'}</span>
              </button>
            ))}
          </div>
        )}
      />
    </div>
  );
}
