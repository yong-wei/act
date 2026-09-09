const MODEL_POSTER: Record<string, string> = {
  '/assets/destroyer.glb': '/assets/destroyer.png',
  '/assets/icebreaker.glb': '/assets/icebreaker.png',
  '/assets/Lng-carrier.glb': '/assets/Lng-carrier.png',
  '/assets/container.glb': '/assets/container.png',
  '/assets/dredger.glb': '/assets/dredger-tianjing.png',
  '/assets/luxury-liner.glb': '/assets/luxury-liner.png',
  '/assets/drilling-rig.glb': '/assets/drilling-rig.png',
}

const MODEL_POSTER_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ['/assets/model-releases/type055-nanchang-101/', '/assets/destroyer.png'],
  ['/assets/model-releases/lng-changheng/', '/assets/Lng-carrier.png'],
  ['/assets/model-releases/msc-tessa/', '/assets/container.png'],
  ['/assets/model-releases/xue-long-2/', '/assets/icebreaker.png'],
  ['/assets/model-releases/adora-magic-city/', '/assets/luxury-liner.png'],
  ['/assets/model-releases/hysy-981/', '/assets/drilling-rig.png'],
  ['/assets/model-releases/dredger-tianjing/', '/assets/dredger-tianjing.png'],
]

export function getShipModelPosterPath(modelPath: string) {
  const exact = MODEL_POSTER[modelPath]
  if (exact) return exact
  const prefix = MODEL_POSTER_PREFIXES.find(([pathPrefix]) => modelPath.startsWith(pathPrefix))
  return prefix?.[1] ?? '/assets/destroyer.png'
}
