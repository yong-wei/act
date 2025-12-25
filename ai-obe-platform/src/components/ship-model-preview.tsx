'use client'

import { Suspense, useMemo, useRef, type MutableRefObject, type RefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

type ShipModelPreviewProps = {
  modelPath: string
  onInteractionStart?: () => void
  onInteractionEnd?: () => void
}

const STANDARD_FORWARD = new THREE.Vector3(0, 0, 1)
const DEFAULT_FORWARD = new THREE.Vector3(0, 0, -1)
const CAMERA_DISTANCE = 2.6
const CAMERA_POSITION: [number, number, number] = [
  -CAMERA_DISTANCE * 0.5,
  CAMERA_DISTANCE * 0.7071,
  -CAMERA_DISTANCE * 0.5,
]
const ORBIT_POLAR_ANGLE = Math.PI / 4
const AUTO_ORBIT_SPEED = 0.35
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const MODEL_FORWARD: Record<string, THREE.Vector3> = {
  '/assets/destroyer.glb': new THREE.Vector3(0, 0, -1),
  '/assets/icebreaker.glb': new THREE.Vector3(0, 0, -1),
  '/assets/Lng-carrier.glb': new THREE.Vector3(0, 0, -1),
  '/assets/container.glb': new THREE.Vector3(1, 0, 0),
  '/assets/dredger.glb': new THREE.Vector3(1, 0, 0),
  '/assets/luxury-liner.glb': new THREE.Vector3(0, 0, -1),
  '/assets/drilling-rig.glb': new THREE.Vector3(0, 0, -1),
}
const MODEL_YAW_ROTATION: Record<string, number> = {
  '/assets/dredger.glb': Math.PI,
  '/assets/Lng-carrier.glb': Math.PI,
  '/assets/container.glb': Math.PI,
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
    const rotation = new THREE.Quaternion().setFromUnitVectors(forward, STANDARD_FORWARD)
    const extraYaw = MODEL_YAW_ROTATION[modelPath] ?? 0
    if (extraYaw !== 0) {
      rotation.multiply(new THREE.Quaternion().setFromAxisAngle(Y_AXIS, extraYaw))
    }

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
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const isInteractingRef = useRef(false)

  const handleInteractionStart = () => {
    isInteractingRef.current = true
    onInteractionStart?.()
  }

  const handleInteractionEnd = () => {
    isInteractingRef.current = false
    onInteractionEnd?.()
  }

  return (
    <div className="relative h-80 w-full overflow-hidden rounded-2xl bg-white/10 backdrop-blur-sm">
      <Canvas
        className="h-full w-full"
        camera={{ position: CAMERA_POSITION, fov: 35 }}
        onPointerDown={handleInteractionStart}
        onPointerUp={handleInteractionEnd}
        onPointerLeave={handleInteractionEnd}
        dpr={[1, 1.5]}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[2.5, 4, 4]} intensity={1.1} />
        <directionalLight position={[-3, 1, -2]} intensity={0.4} />
        <AutoOrbit controlsRef={controlsRef} isInteractingRef={isInteractingRef} />
        <Suspense fallback={null}>
          <CenteredModel modelPath={modelPath} />
        </Suspense>
        <OrbitControls
          ref={controlsRef}
          enableZoom={false}
          enablePan={false}
          enableDamping
          dampingFactor={0.12}
          rotateSpeed={0.8}
          minPolarAngle={ORBIT_POLAR_ANGLE}
          maxPolarAngle={ORBIT_POLAR_ANGLE}
          onStart={handleInteractionStart}
          onEnd={handleInteractionEnd}
        />
      </Canvas>
    </div>
  )
}

function AutoOrbit({
  controlsRef,
  isInteractingRef,
}: {
  controlsRef: RefObject<OrbitControlsImpl>
  isInteractingRef: MutableRefObject<boolean>
}) {
  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (!controls || isInteractingRef.current) {
      return
    }
    controls.setAzimuthalAngle(controls.getAzimuthalAngle() + delta * AUTO_ORBIT_SPEED)
    controls.update()
  })

  return null
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
