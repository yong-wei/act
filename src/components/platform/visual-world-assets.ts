export type PlatformVisualWorld = 'arena';

export type ArenaVisualAssetId =
  | 'control-bench'
  | 'challenge-map'
  | 'score-field'
  | 'empty-state';

export interface PlatformVisualAsset {
  id: ArenaVisualAssetId;
  src: string;
  alt: string;
  themeFit: readonly ('light' | 'dark')[];
  usage: 'shell-accent' | 'entry-card' | 'status-panel' | 'empty-state';
}

export const ARENA_VISUAL_ASSETS: Record<ArenaVisualAssetId, PlatformVisualAsset> = {
  'control-bench': {
    id: 'control-bench',
    src: '/assets/platform/visual-worlds/arena/control-bench.svg',
    alt: '',
    themeFit: ['light', 'dark'],
    usage: 'shell-accent',
  },
  'challenge-map': {
    id: 'challenge-map',
    src: '/assets/platform/visual-worlds/arena/challenge-map.svg',
    alt: '',
    themeFit: ['light', 'dark'],
    usage: 'entry-card',
  },
  'score-field': {
    id: 'score-field',
    src: '/assets/platform/visual-worlds/arena/score-field.svg',
    alt: '',
    themeFit: ['light', 'dark'],
    usage: 'status-panel',
  },
  'empty-state': {
    id: 'empty-state',
    src: '/assets/platform/visual-worlds/arena/empty-state.svg',
    alt: '',
    themeFit: ['light', 'dark'],
    usage: 'empty-state',
  },
};
