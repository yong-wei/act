export const PLATFORM_LAYERS = {
  account: 70,
  overlay: 90,
  floatingDock: 120,
  konlingSide: 130,
  konlingWorkspace: 140,
  textbookWorkspace: 150,
} as const;

export type PlatformLayer = keyof typeof PLATFORM_LAYERS;

export function platformLayerStyle(layer: PlatformLayer) {
  return { zIndex: PLATFORM_LAYERS[layer] };
}
