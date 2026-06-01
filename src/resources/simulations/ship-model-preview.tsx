'use client'

import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from 'react'
import Image from 'next/image'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { shouldForceStaticByConnection, type ConnectionHint } from '@/lib/model-render-policy'
import { getShipModelPosterPath } from '@/resources/simulations/ship-model-assets'

type ShipModelPreviewProps = {
  modelPath: string
  onInteractionStart?: () => void
  onInteractionEnd?: () => void
}

type PreloadPriority = 'high' | 'idle'

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

const preloadRequested = new Set<string>()
let preloadQueue = Promise.resolve()

function runInIdle(callback: () => void) {
  if (typeof window === 'undefined') {
    callback()
    return
  }

  const maybeWindow = window as Window & {
    requestIdleCallback?: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number
  }

  if (typeof maybeWindow.requestIdleCallback === 'function') {
    maybeWindow.requestIdleCallback(() => callback(), { timeout: 1200 })
    return
  }

  window.setTimeout(callback, 180)
}

function getConnectionHint(): ConnectionHint | undefined {
  if (typeof navigator === 'undefined') {
    return undefined
  }

  const maybeNavigator = navigator as Navigator & {
    connection?: ConnectionHint
  }

  return maybeNavigator.connection
}

function queuePreload(run: () => void) {
  preloadQueue = preloadQueue
    .then(() => {
      run()
    })
    .catch(() => {
      run()
    })
}

export function preloadShipModel(modelPath: string, priority: PreloadPriority = 'idle') {
  if (!modelPath || preloadRequested.has(modelPath)) {
    return
  }

  if (shouldForceStaticByConnection(getConnectionHint())) {
    return
  }

  preloadRequested.add(modelPath)

  const run = () => {
    queuePreload(() => {
      useGLTF.preload(modelPath)
    })
  }

  if (priority === 'high') {
    run()
    return
  }

  runInIdle(run)
}

class ModelLoadBoundary extends Component<{
  children: ReactNode
  onError: () => void
}> {
  componentDidCatch(_error: unknown, _errorInfo: ErrorInfo) {
    this.props.onError()
  }

  render() {
    return this.props.children
  }
}

function CenteredModel({ modelPath, onReady }: { modelPath: string; onReady: () => void }) {
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

  useEffect(() => {
    onReady()
  }, [onReady])

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
  const retryTimerRef = useRef<number | null>(null)
  const [showCanvas, setShowCanvas] = useState(false)
  const [isModelReady, setIsModelReady] = useState(false)
  const [isStaticOnly, setIsStaticOnly] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [retryKey, setRetryKey] = useState(0)
  const [loadFailed, setLoadFailed] = useState(false)

  const posterPath = getShipModelPosterPath(modelPath)

  useEffect(() => {
    setShowCanvas(false)
    setIsModelReady(false)
    setRetryCount(0)
    setRetryKey(0)
    setLoadFailed(false)

    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }

    const staticOnly = shouldForceStaticByConnection(getConnectionHint())
    setIsStaticOnly(staticOnly)
    if (staticOnly) {
      return
    }

    const timer = window.setTimeout(() => {
      preloadShipModel(modelPath, 'high')
      setShowCanvas(true)
    }, 120)

    return () => {
      window.clearTimeout(timer)
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [modelPath])

  const handleModelError = () => {
    setIsModelReady(false)
    if (retryCount < 2) {
      const nextRetryCount = retryCount + 1
      setRetryCount(nextRetryCount)
      retryTimerRef.current = window.setTimeout(() => {
        preloadShipModel(modelPath, 'high')
        setRetryKey((prev) => prev + 1)
        setShowCanvas(true)
      }, 600 * nextRetryCount)
      return
    }

    setShowCanvas(false)
    setLoadFailed(true)
  }

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
      <Image
        src={posterPath}
        alt="模型预览"
        fill
        sizes="(max-width: 1024px) 100vw, 50vw"
        className={`absolute inset-0 object-cover transition-opacity duration-500 ${
          isModelReady ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {showCanvas && !isStaticOnly && !loadFailed ? (
        <Canvas
          key={`${modelPath}-${retryKey}`}
          className={`h-full w-full transition-opacity duration-500 ${isModelReady ? 'opacity-100' : 'opacity-60'}`}
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
          <ModelLoadBoundary onError={handleModelError}>
            <Suspense fallback={null}>
              <CenteredModel modelPath={modelPath} onReady={() => setIsModelReady(true)} />
            </Suspense>
          </ModelLoadBoundary>
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
      ) : null}

      {!isModelReady ? (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4">
          <div className="rounded-full border border-white/20 bg-slate-900/70 px-3 py-1 text-xs text-slate-100">
            {isStaticOnly
              ? '弱网模式：静态预览'
              : loadFailed
                ? '模型加载失败，已切换静态预览'
                : retryCount > 0
                  ? '模型重试加载中...'
                  : '模型加载中...'}
          </div>
        </div>
      ) : null}
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
