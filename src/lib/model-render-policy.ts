export type ConnectionHint = {
  saveData?: boolean
  effectiveType?: string | null
}

export type HomeModelRenderMode = 'dynamic' | 'static'

const LOW_BANDWIDTH_TYPES = new Set(['slow-2g', '2g', '3g'])

export function shouldForceStaticByConnection(connection?: ConnectionHint | null): boolean {
  if (!connection) {
    return false
  }

  if (connection.saveData) {
    return true
  }

  const effectiveType = `${connection.effectiveType ?? ''}`.trim().toLowerCase()
  if (!effectiveType) {
    return false
  }

  return LOW_BANDWIDTH_TYPES.has(effectiveType)
}

export function resolveHomeModelRenderMode(params: {
  adminEnabled: boolean
  connection?: ConnectionHint | null
}): HomeModelRenderMode {
  if (!params.adminEnabled) {
    return 'static'
  }

  return shouldForceStaticByConnection(params.connection) ? 'static' : 'dynamic'
}
