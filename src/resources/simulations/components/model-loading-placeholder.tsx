'use client'

import { Html, useProgress } from '@react-three/drei'
import { simulationScenePalette } from './simulation-theme'

export function ModelLoadingPlaceholder({
  label = '模型加载中',
  sublabel = '场景已就绪，可先观察环境',
}: {
  label?: string
  sublabel?: string
}) {
  const { progress, active } = useProgress()
  const percent = Math.round(progress)

  return (
    <group position={[0, 20, 0]}>
      <mesh position={[0, -8, 0]}>
        <boxGeometry args={[56, 12, 14]} />
        <meshStandardMaterial color={simulationScenePalette.mutedStroke} metalness={0.3} roughness={0.55} />
      </mesh>
      <Html center distanceFactor={22}>
        <div className="rounded-xl border border-platform-border-strong bg-platform-surface-overlay/86 px-4 py-3 text-center text-platform-fg-primary shadow-lg">
          <div
            className="mx-auto mb-2 h-1.5 w-32 overflow-hidden rounded-full bg-platform-border"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            data-loading-progress={percent}
          >
            <div
              className="h-full rounded-full bg-platform-action-primary transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs font-medium">{active ? `${label} ${percent}%` : label}</p>
          <p className="mt-1 text-[11px] text-platform-fg-secondary">{sublabel}</p>
        </div>
      </Html>
    </group>
  )
}
