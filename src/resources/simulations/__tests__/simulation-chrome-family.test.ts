import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SCENE_DIR = path.join(ROOT, 'src/resources/simulations/scene');
const COMPONENTS_DIR = path.join(ROOT, 'src/resources/simulations/components');
const CHROME = path.join(SCENE_DIR, 'chrome.tsx');
const ENVIRONMENT = path.join(SCENE_DIR, 'environment/environment-state.tsx');
const QUALITY = path.join(SCENE_DIR, 'quality/quality-state.tsx');
const AUDIO = path.join(SCENE_DIR, 'audio/soundscape-state.tsx');
const ANNOTATIONS = path.join(SCENE_DIR, 'annotations/annotations-state.tsx');
const VIEW_SWITCHER = path.join(COMPONENTS_DIR, 'camera-view-switcher.tsx');
const LOCAL_TOOLS = path.join(ROOT, 'src/app/simulations/_components/simulation-local-tools.tsx');

const read = (file: string) => readFileSync(file, 'utf8');

const walkTsx = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walkTsx(full);
    return full.endsWith('.tsx') ? [full] : [];
  });

describe('scene tooltip single-point wrapper', () => {
  it('exposes SceneTooltip and ChromePopoverButton from scene/chrome', () => {
    const source = read(CHROME);
    expect(source).toContain('@radix-ui/react-tooltip');
    expect(source).toContain('SceneTooltip');
    expect(source).toContain('ChromePopoverButton');
  });

  it('forbids direct radix tooltip imports outside scene/chrome', () => {
    const offenders = [...walkTsx(SCENE_DIR), ...walkTsx(COMPONENTS_DIR)]
      .filter((file) => file !== CHROME)
      .filter((file) => read(file).includes('@radix-ui/react-tooltip'));
    expect(offenders).toEqual([]);
  });
});

describe('bottom chrome family popover form', () => {
  it('mounts the environment preset as a popover button with its data hook', () => {
    const source = read(ENVIRONMENT);
    expect(source).toContain('ChromePopoverButton');
    expect(source).toContain('data-scene-environment-switcher');
    expect(source).toContain('optionDataHook="environment-preset"');
  });

  it('mounts the quality select as a popover button with its data hook', () => {
    const source = read(QUALITY);
    expect(source).toContain('ChromePopoverButton');
    expect(source).toContain('data-scene-quality-select');
  });

  it('mounts the sound control as a popover button with its data hook', () => {
    const source = read(AUDIO);
    expect(source).toContain('ChromePopoverButton');
    expect(source).toContain('data-soundscape-muted');
  });

  it('merges grid and teaching annotations into one popover control', () => {
    const source = read(ANNOTATIONS);
    expect(source).toContain('AnnotationsGridToggle');
    expect(source).toContain('ChromePopoverButton');
    expect(source).toContain('data-teaching-annotations');
    expect(source).toContain('data-grid-toggle');
    expect(source).not.toContain('隐藏教学标注');
  });

  it('marks the merged annotations control as a bottom tool segment for command-deck governance', () => {
    const source = read(ANNOTATIONS);
    expect(source).toContain('data-simulation-local-bottom-tool-segment="annotations-grid-toggle"');
  });

  it('collapses popover trigger labels to icons on narrow viewports', () => {
    const source = read(CHROME);
    expect(source).toContain('max-[480px]:hidden');
  });

  it('keeps the grid toggle out of the view popover and mounts the whole family in one bar', () => {
    const source = read(VIEW_SWITCHER);
    expect(source).toContain('<EnvironmentPresetSwitcher />');
    expect(source).toContain('<SceneQualitySelect />');
    expect(source).toContain('<SoundscapeMuteToggle />');
    expect(source).toContain('<AnnotationsGridToggle');
    expect(source).toContain('速率');
  });

  it('mounts no scattered bottom-32 toggles in any experiment', () => {
    const dir = path.join(ROOT, 'src/resources/simulations/simulations');
    for (const file of walkTsx(dir)) {
      const source = read(file);
      expect(source, `${file} still mounts a scattered toggle`).not.toMatch(/<(EnvironmentPresetSwitcher|SoundscapeMuteToggle|TeachingAnnotationsToggle|SceneQualitySelect) className=/);
    }
  });
});

describe('local tool workspace cleanup', () => {
  it('removes the inert placeholder command strip', () => {
    const source = read(LOCAL_TOOLS);
    expect(source).not.toContain('commands.map');
    expect(source).not.toContain('重置场景');
    expect(source).not.toContain('记录观察');
    expect(source).not.toContain('导出片段');
  });

  it('offers a close button on the hint strip', () => {
    const source = read(LOCAL_TOOLS);
    expect(source).toContain('data-simulation-local-hint-strip');
    expect(source).toMatch(/aria-label="关闭(提示|引导)?"/);
  });
});

describe('chrome family polish', () => {
  it('closes popovers on outside pointer down', () => {
    const source = read(CHROME);
    expect(source).toContain("window.addEventListener('pointerdown', handlePointerDown)");
    expect(source).toContain('rootRef.current?.contains');
  });

  it('keeps all six controls in one unwrapped uniform row', () => {
    const source = read(VIEW_SWITCHER);
    expect(source).not.toContain('simulation-command-restore-handle flex shrink-0 p-1');
    expect(source).not.toContain('simulation-command-restore-handle flex shrink-0 items-center gap-1 p-1');
  });

  it('keeps sound and annotations panels compact', () => {
    const audio = read(AUDIO);
    const annotations = read(ANNOTATIONS);
    expect(audio).toContain('min-w-28');
    expect(annotations).toContain('min-w-28');
    expect(audio).not.toContain('min-w-36');
    expect(annotations).not.toContain('min-w-36');
  });

  it('offers the wake toggle inside the environment popover', () => {
    const source = read(ENVIRONMENT);
    expect(source).toContain('wakeVisible');
    expect(source).toContain('data-wake-toggle');
  });

  it('gates every experiment wake rig on the wake toggle', () => {
    const dir = path.join(ROOT, 'src/resources/simulations/simulations');
    for (const file of walkTsx(dir)) {
      const source = read(file);
      if (!source.includes('wakeVisible') && !source.includes('WakeParticles') && !source.includes('waterYSampler')) {
        continue;
      }
      expect(source, `${file} missing wakeVisible gate`).toContain('wakeVisible');
      expect(source, `${file} missing wakeVisible early return`).toContain('if (!wakeVisible) return null;');
    }
  });

  it('samples wake water height at the ship position, never the origin', () => {
    const dir = path.join(ROOT, 'src/resources/simulations/simulations');
    for (const file of walkTsx(dir)) {
      const source = read(file);
      expect(source, `${file} still samples water at origin`).not.toContain('params.waterTier], 0, 0, time)');
    }
  });

  it('samples wake water height per particle at its own world position', () => {
    const geometry = read(path.join(ROOT, 'src/resources/simulations/scene/wake/wake-geometry.ts'));
    expect(geometry).toContain('waterYSampler(centerX, centerZ)');
    const dir = path.join(ROOT, 'src/resources/simulations/simulations');
    for (const file of walkTsx(dir)) {
      const source = read(file);
      if (!source.includes('waterYSampler') && !source.includes('wakeVisible') && !source.includes('WakeParticles')) {
        continue;
      }
      expect(source, `${file} still feeds a flat per-frame water height`).not.toContain('waterYSampler={() => waterYRef.current}');
      // 位置感知采样：旧式世界坐标直采，或与可见水面同一坐标基准的共享采样器
      const legacyForm = source.includes('x ?? 0, z ?? 0, timeRef.current');
      // #2098：共享采样器升级为近场批量查询（带限波组+包络，与 GPU 同参数）。
      const sharedForm = source.includes('sampleVisibleWaterHeight(') || source.includes('createNearFieldSurfaceQuery(');
      expect(legacyForm || sharedForm, `${file} missing position-aware wake sampler`).toBe(true);
    }
  });
});
