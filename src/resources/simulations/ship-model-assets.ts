const MODEL_POSTER: Record<string, string> = {
  '/assets/destroyer.glb': '/assets/destroyer.png',
  '/assets/icebreaker.glb': '/assets/icebreaker.png',
  '/assets/Lng-carrier.glb': '/assets/Lng-carrier.png',
  '/assets/container.glb': '/assets/container.png',
  '/assets/dredger.glb': '/assets/dredger.png',
  '/assets/luxury-liner.glb': '/assets/luxury-liner.png',
  '/assets/drilling-rig.glb': '/assets/drilling-rig.png',
}

export function getShipModelPosterPath(modelPath: string) {
  return MODEL_POSTER[modelPath] ?? '/assets/destroyer.png'
}
