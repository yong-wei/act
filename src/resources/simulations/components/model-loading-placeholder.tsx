'use client'

import { Html } from '@react-three/drei'

export function ModelLoadingPlaceholder({
  label = '模型加载中',
  sublabel = '场景已就绪，可先观察环境',
}: {
  label?: string
  sublabel?: string
}) {
  return (
    <group position={[0, 20, 0]}>
      <mesh position={[0, -8, 0]}>
        <boxGeometry args={[56, 12, 14]} />
        <meshStandardMaterial color="#64748b" metalness={0.3} roughness={0.55} />
      </mesh>
      <Html center distanceFactor={22}>
        <div className="rounded-xl border border-white/20 bg-slate-900/80 px-4 py-3 text-center text-slate-100 shadow-lg">
          <div className="mx-auto mb-2 h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-amber-400" />
          <p className="text-xs font-medium">{label}</p>
          <p className="mt-1 text-[11px] text-slate-300">{sublabel}</p>
        </div>
      </Html>
    </group>
  )
}
