const MODEL_POSTER: Record<string, string> = {
  '/assets/destroyer.glb': '/assets/destroyer.webp',
  '/assets/icebreaker.glb': '/assets/icebreaker.webp',
  '/assets/Lng-carrier.glb': '/assets/Lng-carrier.webp',
  '/assets/container.glb': '/assets/container.webp',
  '/assets/dredger.glb': '/assets/dredger-tianjing.webp',
  '/assets/luxury-liner.glb': '/assets/luxury-liner.webp',
  '/assets/drilling-rig.glb': '/assets/drilling-rig.webp',
}

const PACKAGE_POSTERS: ReadonlyArray<readonly [string, string]> = [
  ['type055-nanchang-101', '/assets/destroyer.webp'],
  ['lng-changheng', '/assets/Lng-carrier.webp'],
  ['msc-tessa', '/assets/container.webp'],
  ['xue-long-2', '/assets/icebreaker.webp'],
  ['adora-magic-city', '/assets/luxury-liner.webp'],
  ['hysy-981', '/assets/drilling-rig.webp'],
  ['dredger-tianjing', '/assets/dredger-tianjing.webp'],
]

export function getShipModelPosterPath(modelPath: string) {
  const exact = MODEL_POSTER[modelPath]
  if (exact) return exact
  const byPackage = PACKAGE_POSTERS.find(([token]) => modelPath.includes(token))
  return byPackage?.[1] ?? '/assets/destroyer.webp'
}
