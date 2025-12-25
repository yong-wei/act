'use client'

import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

type ShipModelPreviewProps = {
  modelPath: string
  onInteractionStart?: () => void
  onInteractionEnd?: () => void
}

const TARGET_DIRECTION = new THREE.Vector3(-0.85, -0.4, 0.35).normalize()
const DEFAULT_FORWARD = new THREE.Vector3(0, 0, -1)
const MODEL_FORWARD: Record<string, THREE.Vector3> = {
  '/assets/destroyer.glb': new THREE.Vector3(0, 0, -1),
  '/assets/icebreaker.glb': new THREE.Vector3(0, 0, -1),
  '/assets/Lng-carrier.glb': new THREE.Vector3(0, 0, -1),
  '/assets/container.glb': new THREE.Vector3(1, 0, 0),
  '/assets/dredger.glb': new THREE.Vector3(1, 0, 0),
  '/assets/luxury-liner.glb': new THREE.Vector3(-0.85, -0.4, 0.35),
  '/assets/drilling-rig.glb': new THREE.Vector3(-0.85, -0.4, 0.35),
}

function CenteredModel({ modelPath }: { modelPath: string }) {
  const { scene } = useGLTF(modelPath)
  const { model, scale, rotation } = useMemo(() => {
    const cloned = scene.clone(true)
    const box = new THREE.Box3().setFromObject(cloned)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()

    box.getSize(size)
    box.getCenter(center)
    cloned.position.sub(center)

    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const targetSize = 1.6
    const scale = targetSize / maxDim
    const forward = (MODEL_FORWARD[modelPath] ?? DEFAULT_FORWARD).clone().normalize()
    const rotation = new THREE.Quaternion().setFromUnitVectors(forward, TARGET_DIRECTION)

    return { model: cloned, scale, rotation }
  }, [modelPath, scene])

  return (
    <group scale={scale} quaternion={rotation}>
      <primitive object={model} />
    </group>
  )
}

export function ShipModelPreview({
  modelPath,
  onInteractionStart,
  onInteractionEnd,
}: ShipModelPreviewProps) {
  return (
    <div className="relative h-80 w-full overflow-hidden rounded-2xl bg-white/10 backdrop-blur-sm">
      <Canvas
        className="h-full w-full"
        camera={{ position: [0, 0.6, 2.6], fov: 35 }}
        onPointerDown={onInteractionStart}
        onPointerUp={onInteractionEnd}
        onPointerLeave={onInteractionEnd}
        dpr={[1, 1.5]}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[2.5, 4, 4]} intensity={1.1} />
        <directionalLight position={[-3, 1, -2]} intensity={0.4} />
        <Suspense fallback={null}>
          <CenteredModel modelPath={modelPath} />
        </Suspense>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          enableDamping
          dampingFactor={0.12}
          rotateSpeed={0.8}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={(Math.PI * 5) / 6}
          onStart={onInteractionStart}
          onEnd={onInteractionEnd}
        />
      </Canvas>
    </div>
  )
}

const PRELOAD_MODELS = [
  '/assets/container.glb',
  '/assets/destroyer.glb',
  '/assets/dredger.glb',
  '/assets/icebreaker.glb',
  '/assets/Lng-carrier.glb',
  '/assets/luxury-liner.glb',
  '/assets/drilling-rig.glb',
]

PRELOAD_MODELS.forEach((modelPath) => useGLTF.preload(modelPath))
