const MODEL_POSTER: Record<string, string> = {
  '/assets/destroyer.glb': '/assets/destroyer.png',
  '/assets/icebreaker.glb': '/assets/icebreaker.png',
  '/assets/Lng-carrier.glb': '/assets/Lng-carrier.png',
  '/assets/container.glb': '/assets/container.png',
  '/assets/dredger.glb': '/assets/dredger-tianjing.png',
  '/assets/luxury-liner.glb': '/assets/luxury-liner.png',
  '/assets/drilling-rig.glb': '/assets/drilling-rig.png',
}

const PACKAGE_POSTERS: ReadonlyArray<readonly [string, string]> = [
  ['type055-nanchang-101', '/assets/destroyer.png'],
  ['lng-changheng', '/assets/Lng-carrier.png'],
  ['msc-tessa', '/assets/container.png'],
  ['xue-long-2', '/assets/icebreaker.png'],
  ['adora-magic-city', '/assets/luxury-liner.png'],
  ['hysy-981', '/assets/drilling-rig.png'],
  ['dredger-tianjing', '/assets/dredger-tianjing.png'],
]

export function getShipModelPosterPath(modelPath: string) {
  const exact = MODEL_POSTER[modelPath]
  if (exact) return exact
  const byPackage = PACKAGE_POSTERS.find(([token]) => modelPath.includes(token))
  return byPackage?.[1] ?? '/assets/destroyer.png'
}
