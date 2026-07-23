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

import {
  createSoundscapeBus,
  readSoundscapeMutedPreference,
  writeSoundscapeMutedPreference,
  type AlertKind,
  type AmbienceKey,
  type FeedbackKind,
  type SoundscapeBus,
} from './soundscape-bus';
import { useSceneEnvironment } from '../environment/environment-state';

interface SceneSoundscapeContextValue {
  readonly unlocked: boolean;
  readonly muted: boolean;
  readonly mute: () => void;
  readonly unmute: () => void;
  readonly playFeedback: (kind: FeedbackKind) => void;
  readonly playAlert: (kind: AlertKind) => void;
  readonly setAmbience: (key: AmbienceKey) => void;
}

const SceneSoundscapeContext = createContext<SceneSoundscapeContextValue | null>(null);

/**
 * 音景状态：偏好默认开启、首次用户手势解锁（autoplay 策略）、
 * 一键静音并持久化；AudioContext 延迟到解锁时创建。
 */
export function SceneSoundscapeProvider({ children }: { readonly children: ReactNode }) {
  const busRef = useRef<SoundscapeBus | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [muted, setMuted] = useState(false);

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
    const unlock = () => {
      const bus = getBus();
      if (!bus) return;
      bus.unlock();
      if (readSoundscapeMutedPreference(window.localStorage)) {
        bus.mute();
        setMuted(true);
      }
      setUnlocked(true);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  const value = useMemo<SceneSoundscapeContextValue>(() => ({
    unlocked,
    muted,
    mute: () => {
      setMuted(true);
      writeSoundscapeMutedPreference(window.localStorage, true);
      busRef.current?.mute();
    },
    unmute: () => {
      setMuted(false);
      writeSoundscapeMutedPreference(window.localStorage, false);
      busRef.current?.unmute();
    },
    playFeedback: (kind) => busRef.current?.playFeedback(kind),
    playAlert: (kind) => busRef.current?.playAlert(kind),
    setAmbience: (key) => busRef.current?.setAmbience(key),
  }), [unlocked, muted]);

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

/** 一键静音切换（偏好持久化）。 */
export function SoundscapeMuteToggle({ className }: { readonly className?: string }) {
  const { muted, mute, unmute } = useSceneSoundscape();
  return (
    <button
      type="button"
      className={className}
      aria-pressed={muted}
      data-soundscape-muted={muted}
      onClick={() => (muted ? unmute() : mute())}
    >
      {muted ? '取消静音' : '静音'}
    </button>
  );
}
