'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { BaseControllerId, ControllerId } from '../level-data';
import styles from './ShipAvatar.module.css';

interface ShipAvatarProps {
  controlMode: 'MANUAL' | 'AUTO';
  controllerId: BaseControllerId;
  enableFeedforward: boolean;
  enableSpeedFeedback: boolean;
  controllerLevels?: Partial<Record<ControllerId, number>>;
  showHull?: boolean;
  showWings?: boolean;
  showPanels?: boolean;
  showEngines?: boolean;
  showThrusters?: boolean;
  className?: string;
}

const MIRROR_AXIS_Y = 60;
const HULL_OFFSET = { x: 0, y: 60 };
const baseHullPath =
  'M56 5 L56 -5 L60 -8 L61 -16 Q146 -18 167 -9 L170 -6 L170 6 L167 9 Q148 18 61 16 L60 8 Z';
const wingTopPath = 'M122 44 L119 42 L108 41 L85 18 L61 18 L61 20 L63 20 L58 45 Z';
const wingTop = { x: 0, y: 0 };
const wingBottom = { x: 0, y: 0 };
const panelOffset = { x: 0, y: 60 };
const nosePanelPath = 'M138 8 Q139 0 138 -8 Q148 -7 163 -5 Q165 0 163 5 Z';
const cockpitPath = 'M65 3 L65 -3 L67 -5 L95 -5 L97 -3 L97 3 L95 5 L67 5 L65 3 Z';
const engineTop = { x: 70, y: 42 };
const engineTopPath =
  'M-18 9 Q-21 1 -18 -9 L-12 -6 L-10 -8 Q8 -10 16 -4 L16 4 Q8 10 -10 8 L-12 6 Z';
const engineFlamePath = (cx: number, cy: number, length = 30, width = 8) => {
  const startX = cx - 2;
  const tipX = cx - length;
  const topY = cy - width * 0.5;
  const bottomY = cy + width * 0.5;
  const midX = cx - length * 0.45;
  const innerTop = cy - width * 0.15;
  const innerBottom = cy + width * 0.15;

  return [
    `M${startX} ${innerTop}`,
    `C${midX} ${topY} ${tipX} ${cy - width * 0.1} ${tipX} ${cy}`,
    `C${tipX} ${cy + width * 0.1} ${midX} ${bottomY} ${startX} ${innerBottom}`,
    'Z'
  ].join(' ');
};
const iFlowOrigin = HULL_OFFSET;
const iFlowTopShapes = [
  { path: 'm82.40378,-7.25628c4.25,2 -11.25,-6.5 -19,-8.25c-7.75,-1.75 -20.1875,-3.3125 -35.53125,-6.09375c-15.34375,-2.78125 -56.71875,-12.40625 -40.46875,-7.40625c8.125,2.5 9.25,9.50391 12.47656,6.90137c3.22656,-2.60254 11.30469,3.43847 25.33594,5.76269c14.03125,2.32422 11.4375,-1.60156 26.9375,2.71094c15.5,4.3125 26,4.375 30.25,6.375z', offsetX: 60, offsetY: -6 },
  { path: 'm82.48111,-4.7652c8.24996,0.625 -14.25003,-3.57812 -23.56253,-5.65625c-4.65625,-1.03906 -11.58464,-3.16341 -16.59376,-3.88916c-5.00912,-0.72574 -8.34897,0.69711 -19.32812,-0.74755c-10.97916,-1.44466 -9.78513,-3.63183 -17.13279,-5.45263c-7.34766,-1.8208 -11.29943,1.66227 2.86721,4.9956c14.16664,3.33333 28.58329,4.16668 35.49996,4.50001c6.91667,0.33333 10.50011,5.00001 19.00008,4.25c8.49998,-0.75001 10.99999,1.37498 19.24995,1.99998z', offsetX: 60, offsetY: -4 },
  { path: 'm81.15377,-2.75629c-7.125,-1.25 -14.72917,2.79167 -23.28125,-0.71875c-8.55208,-3.51042 -17.38542,-4.30208 -25.21875,-2.53125c-7.83333,1.77083 -14.39583,-2.41667 -25.375,-6.57812c-10.97917,-4.16145 6.875,-0.29688 14.625,1.57812c7.75,1.875 12.4375,0.3125 21.28125,1.21875c8.84375,0.90625 15.21875,6.28125 21.71875,4.53125c6.5,-1.75 30.5,5 16.25,2.5z', offsetX: 60, offsetY: -3 },
  { path: 'm86.15379,1.8269c0,-5.83333 -10.95832,-1.75001 -22.14583,-2.33334c-11.1875,-0.58334 -12.93752,-7.16666 -28.85417,-4c-15.91665,3.16666 -30.16667,-9.66668 -28.33334,-5c1.83333,4.66668 2,18 -0.66667,22.00001c-2.66667,4.00001 12.00002,-7.00001 29.00001,-4.33334c16.99999,2.66667 17.87501,-5.16666 28.91667,-5.58332c11.04166,-0.41666 21.83332,4.08332 22.08332,-0.75001l0.00001,0z', offsetX: 60, offsetY: -2 }
];
const iFlowOrderedTopShapes = [...iFlowTopShapes]
  .sort((a, b) => a.offsetY - b.offsetY)
  .map((shape, index) => ({ ...shape, orderId: index + 1 }));
const ffOrigin = HULL_OFFSET;
const ffLayers = [
  { id: 'small', path: 'M152 -8 L182 0 L152 8 Z', index: 0, size: 1 },
  { id: 'medium', path: 'M146 -14 L190 0 L146 14 Z', index: 1, size: 2 },
  { id: 'large', path: 'M138 -22 L198 0 L138 22 Z', index: 2, size: 3 }
];
const vfArmorBasePath1 = 'M-18 0 L-5 1 L-4 10 L-17 10 Z';
const vfArmorBasePath2 = 'M-14 1 L5 3 L7 11 L-13 10 Z';
const vfArmorBasePath3 = 'M-18 3 L0 7 L8 15 L-16 12 Z';
const vfArmorBasePath4 = 'M-17 0 L-4 0 L-4 10 L-17 10 Z';
const vfArmorBasePath5 = 'M-17 0 L4 1 L4 10 L-17 10 Z';
const vfArmorBasePath6 = 'M-15 1 L9 3 L9 10 L-15 10 Z';
const vfArmorTopShapes = [
  { id: 'r1c1', x: 115, y: 32, column: 0, path: vfArmorBasePath1 },
  { id: 'r1c2', x: 127, y: 32, column: 1, path: vfArmorBasePath2 },
  { id: 'r1c3', x: 153, y: 32, column: 2, path: vfArmorBasePath3 },
  { id: 'r2c1', x: 115, y: 46, column: 0, path: vfArmorBasePath4 },
  { id: 'r2c2', x: 131, y: 46, column: 1, path: vfArmorBasePath5 },
  { id: 'r2c3', x: 153, y: 46, column: 2, path: vfArmorBasePath6 }
];
const vfArmorShapes = [
  ...vfArmorTopShapes.map((armor) => ({ ...armor, mirror: false })),
  ...vfArmorTopShapes.map((armor) => ({
    ...armor,
    id: `mirror-${armor.id}`,
    mirror: true
  }))
];
const buildPulseValues = (intensity: number, low = 0.7) =>
  `${(intensity * low).toFixed(2)};${intensity.toFixed(2)};${(intensity * low).toFixed(2)}`;
const iFlowShapes = (() => {
  const ordered = iFlowOrderedTopShapes.map((shape) => ({
    id: shape.orderId,
    path: shape.path,
    offsetX: shape.offsetX ?? 0,
    offsetY: shape.offsetY,
    mirror: false
  }));
  if (ordered.length < 3) return ordered;
  return [
    ...ordered,
    { ...ordered[2], id: 5, mirror: true },
    { ...ordered[1], id: 6, mirror: true },
    { ...ordered[0], id: 7, mirror: true }
  ];
})();
const iFlowShapeById = new Map<number, (typeof iFlowShapes)[number]>(
  iFlowShapes.map((shape) => [shape.id, shape])
);
const iFlowStageSets = [
  [2, 4, 6],
  [2, 3, 4, 5, 6],
  [1, 2, 3, 4, 5, 6, 7]
];
const iFlowAllIds = iFlowStageSets[2];
const buildIFlowIntensityMap = (level: number) => {
  const intensityMap = new Map<number, number>();
  if (level <= 0) return intensityMap;
  if (level <= 3) {
    iFlowStageSets[level - 1].forEach((id) => intensityMap.set(id, 0.35));
    return intensityMap;
  }
  if (level >= 10) {
    iFlowAllIds.forEach((id) => intensityMap.set(id, 1.2));
    return intensityMap;
  }

  const isHighStage = level >= 7;
  const baseIntensity = isHighStage ? 0.7 : 0.35;
  const upgradeIntensity = isHighStage ? 1 : 0.7;
  const upgradeSet = iFlowStageSets[level - (isHighStage ? 7 : 4)];

  iFlowAllIds.forEach((id) => intensityMap.set(id, baseIntensity));
  upgradeSet.forEach((id) => intensityMap.set(id, upgradeIntensity));
  return intensityMap;
};

export const ShipAvatar: React.FC<ShipAvatarProps> = ({
  controlMode,
  controllerId,
  enableFeedforward,
  enableSpeedFeedback,
  controllerLevels,
  showHull = true,
  showWings = true,
  showPanels = true,
  showEngines = true,
  showThrusters = true,
  className
}) => {
  const hasCore = controlMode === 'AUTO';
  const hasI = hasCore && (controllerId === 'PI' || controllerId === 'PID');
  const hasD = hasCore && (controllerId === 'PD' || controllerId === 'PID');
  const hasFF = hasCore && enableFeedforward;
  const hasVF = hasCore && enableSpeedFeedback;
  const getLevel = (id: ControllerId) =>
    Math.min(10, Math.max(0, controllerLevels?.[id] ?? 0));
  const pLevel = hasCore ? getLevel('P') : 0;
  const iLevel = hasI ? getLevel('PI') : 0;
  const dLevel = hasD ? getLevel('PD') : 0;
  const ffLevel = hasFF ? getLevel('FF') : 0;
  const vfLevel = hasVF ? getLevel('VFB') : 0;
  const mirrorTransform = `translate(0 ${MIRROR_AXIS_Y * 2}) scale(1 -1)`;
  const mirrorWithOffset = (x: number, y: number) =>
    `translate(${x} ${y}) ${mirrorTransform}`;
  const hullTransform = `translate(${HULL_OFFSET.x} ${HULL_OFFSET.y})`;
  const dAuraTransform = 'translate(110 60) scale(1.06) translate(-110 -60)';
  const pIntensityFor = (index: number) => {
    if (pLevel >= index + 6) return 1;
    if (pLevel >= index + 1) return 0.5;
    return 0;
  };
  const tieredIntensityFor = (level: number, index: number, base: number) => {
    if (level >= 10) return 1.2;
    if (level >= index + 7) return 1;
    if (level >= index + 4) return 0.7;
    if (level >= index + 1) return base;
    return 0;
  };
  const iFlowIntensityMap = buildIFlowIntensityMap(iLevel);
  const iFlowActiveShapes = iFlowAllIds
    .map((id) => {
      const shape = iFlowShapeById.get(id);
      const intensity = iFlowIntensityMap.get(id) ?? 0;
      if (!shape || intensity <= 0) return null;
      return { ...shape, intensity };
    })
    .filter(Boolean) as Array<(typeof iFlowShapes)[number] & { intensity: number }>;
  const dHullIntensity = tieredIntensityFor(dLevel, 0, 0.35);
  const dWingIntensity = tieredIntensityFor(dLevel, 1, 0.35);
  const dEngineIntensity = tieredIntensityFor(dLevel, 2, 0.35);

  return (
    <div className={cn(styles.ship, className)}>
      <svg className={styles.svg} viewBox="0 0 220 120" aria-hidden="true">
        <defs>
          <linearGradient id="hullMetalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1f2937" />
            <stop offset="45%" stopColor="#374151" />
            <stop offset="100%" stopColor="#111827" />
          </linearGradient>
          <linearGradient id="wingMetalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#111827" />
            <stop offset="50%" stopColor="#2f3640" />
            <stop offset="100%" stopColor="#0b1016" />
          </linearGradient>
          <linearGradient id="pGlowGradient" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#fb7185" stopOpacity="0.85" />
            <stop offset="35%" stopColor="#fb7185" stopOpacity="0.18" />
            <stop offset="50%" stopColor="#fb7185" stopOpacity="0.05" />
            <stop offset="65%" stopColor="#fb7185" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#fb7185" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="iFlowGradient" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.05" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="ffCowlGradient" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.1" />
            <stop offset="70%" stopColor="#c084fc" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#e879f9" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="tailBaseGradient" x1="100%" y1="50%" x2="0%" y2="50%">
            <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#1f2937" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="tailCoreGradient" x1="100%" y1="50%" x2="0%" y2="50%">
            <stop offset="0%" stopColor="#fb7185" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="tailIGradient" x1="100%" y1="50%" x2="0%" y2="50%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
          <filter id="glowSoft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glowStrong" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="sparkJitter" x="-40%" y="-40%" width="180%" height="180%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" seed="8" result="noise">
              <animate attributeName="baseFrequency" dur="1.4s" values="0.7;0.9;0.6" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" />
          </filter>
        </defs>

        {showThrusters && (
          <>
            <g className={styles.tailBase}>
              <path d={engineFlamePath(engineTop.x, engineTop.y, 56, 14)} />
              <g transform={mirrorTransform}>
                <path d={engineFlamePath(engineTop.x, engineTop.y, 56, 14)} />
              </g>
            </g>
            <g className={cn(styles.tailCore, !hasCore && styles.tailHidden)}>
              <path d={engineFlamePath(engineTop.x, engineTop.y, 44, 10)} />
              <g transform={mirrorTransform}>
                <path d={engineFlamePath(engineTop.x, engineTop.y, 44, 10)} />
              </g>
            </g>
            <g className={cn(styles.tailI, !hasI && styles.tailHidden)}>
              <path d={engineFlamePath(engineTop.x, engineTop.y, 68, 18)} />
              <g transform={mirrorTransform}>
                <path d={engineFlamePath(engineTop.x, engineTop.y, 68, 18)} />
              </g>
            </g>
          </>
        )}

        <g>
          {showWings && (
            <>
              <g transform={`translate(${wingTop.x} ${wingTop.y})`}>
                <path className={styles.baseWing} d={wingTopPath} />
              </g>
              <g transform={mirrorWithOffset(wingBottom.x, wingBottom.y)}>
                <path className={styles.baseWing} d={wingTopPath} />
              </g>
            </>
          )}
          {showHull && <path className={styles.baseHull} d={baseHullPath} transform={hullTransform} />}
          {showEngines && (
            <path className={styles.baseHull} d={engineTopPath} transform={`translate(${engineTop.x} ${engineTop.y})`} />
          )}
          {showEngines && (
            <g transform={mirrorTransform}>
              <path
                className={styles.baseHull}
                d={engineTopPath}
                transform={`translate(${engineTop.x} ${engineTop.y})`}
              />
            </g>
          )}
          {showPanels && (
            <path
              className={styles.basePanel}
              d={nosePanelPath}
              transform={`translate(${panelOffset.x} ${panelOffset.y})`}
            />
          )}
          {showPanels && (
            <path
              className={styles.basePanel}
              d={cockpitPath}
              transform={`translate(${panelOffset.x} ${panelOffset.y})`}
            />
          )}
        </g>

        <g className={cn(styles.layer, hasCore && styles.layerActive)}>
          {showHull && pIntensityFor(0) > 0 && (
            <path
              className={styles.pGlow}
              d={baseHullPath}
              transform={hullTransform}
            >
              <animate
                attributeName="opacity"
                values={buildPulseValues(pIntensityFor(0))}
                dur="2.2s"
                repeatCount="indefinite"
              />
            </path>
          )}
          {showPanels && pIntensityFor(1) > 0 && (
            <path
              className={styles.pGlow}
              d={nosePanelPath}
              transform={`translate(${panelOffset.x} ${panelOffset.y})`}
            >
              <animate
                attributeName="opacity"
                values={buildPulseValues(pIntensityFor(1))}
                dur="2.2s"
                repeatCount="indefinite"
              />
            </path>
          )}
          {showPanels && pIntensityFor(2) > 0 && (
            <path
              className={styles.pGlow}
              d={cockpitPath}
              transform={`translate(${panelOffset.x} ${panelOffset.y})`}
            >
              <animate
                attributeName="opacity"
                values={buildPulseValues(pIntensityFor(2))}
                dur="2.2s"
                repeatCount="indefinite"
              />
            </path>
          )}
          {showWings && pIntensityFor(3) > 0 && (
            <g transform={`translate(${wingTop.x} ${wingTop.y})`}>
              <path className={styles.pGlow} d={wingTopPath}>
                <animate
                  attributeName="opacity"
                  values={buildPulseValues(pIntensityFor(3))}
                  dur="2.2s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          )}
          {showWings && pIntensityFor(3) > 0 && (
            <g transform={mirrorWithOffset(wingBottom.x, wingBottom.y)}>
              <path className={styles.pGlow} d={wingTopPath}>
                <animate
                  attributeName="opacity"
                  values={buildPulseValues(pIntensityFor(3))}
                  dur="2.2s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          )}
          {showEngines && pIntensityFor(4) > 0 && (
            <path
              className={styles.pGlow}
              d={engineTopPath}
              transform={`translate(${engineTop.x} ${engineTop.y})`}
            >
              <animate
                attributeName="opacity"
                values={buildPulseValues(pIntensityFor(4))}
                dur="2.2s"
                repeatCount="indefinite"
              />
            </path>
          )}
          {showEngines && pIntensityFor(4) > 0 && (
            <g transform={mirrorTransform}>
              <path
                className={styles.pGlow}
                d={engineTopPath}
                transform={`translate(${engineTop.x} ${engineTop.y})`}
              >
                <animate
                  attributeName="opacity"
                  values={buildPulseValues(pIntensityFor(4))}
                  dur="2.2s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          )}
        </g>

        <g className={cn(styles.layer, hasI && styles.layerActive)}>
          {iFlowActiveShapes.map((shape) => {
            const flowTransform = `translate(${iFlowOrigin.x + shape.offsetX} ${iFlowOrigin.y + shape.offsetY})`;
            const flowBody = (
              <g transform={flowTransform}>
                <path className={styles.iFlowShape} d={shape.path}>
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0 0; -8 1; 0 0"
                    dur="1.6s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values={buildPulseValues(shape.intensity, 0.6)}
                    dur="1.6s"
                    repeatCount="indefinite"
                  />
                </path>
              </g>
            );

            if (shape.mirror) {
              return (
                <g key={`i-flow-${shape.id}`} transform={mirrorTransform}>
                  {flowBody}
                </g>
              );
            }

            return <g key={`i-flow-${shape.id}`}>{flowBody}</g>;
          })}
        </g>

        <g className={cn(styles.layer, hasD && styles.layerActive)}>
          <g className={styles.dAura} transform={dAuraTransform}>
            {showHull && dHullIntensity > 0 && (
              <path d={baseHullPath} transform={hullTransform}>
                <animate
                  attributeName="stroke-opacity"
                  values={buildPulseValues(dHullIntensity, 0.6)}
                  dur="1.6s"
                  repeatCount="indefinite"
                />
              </path>
            )}
            {showWings && dWingIntensity > 0 && (
              <>
                <g transform={`translate(${wingTop.x} ${wingTop.y})`}>
                  <path d={wingTopPath}>
                    <animate
                      attributeName="stroke-opacity"
                      values={buildPulseValues(dWingIntensity, 0.6)}
                      dur="1.6s"
                      repeatCount="indefinite"
                    />
                  </path>
                </g>
                <g transform={mirrorWithOffset(wingBottom.x, wingBottom.y)}>
                  <path d={wingTopPath}>
                    <animate
                      attributeName="stroke-opacity"
                      values={buildPulseValues(dWingIntensity, 0.6)}
                      dur="1.6s"
                      repeatCount="indefinite"
                    />
                  </path>
                </g>
              </>
            )}
            {showEngines && dEngineIntensity > 0 && (
              <>
                <path
                  d={engineTopPath}
                  transform={`translate(${engineTop.x} ${engineTop.y})`}
                >
                  <animate
                    attributeName="stroke-opacity"
                    values={buildPulseValues(dEngineIntensity, 0.6)}
                    dur="1.6s"
                    repeatCount="indefinite"
                  />
                </path>
                <g transform={mirrorTransform}>
                  <path
                    d={engineTopPath}
                    transform={`translate(${engineTop.x} ${engineTop.y})`}
                  >
                    <animate
                      attributeName="stroke-opacity"
                      values={buildPulseValues(dEngineIntensity, 0.6)}
                      dur="1.6s"
                      repeatCount="indefinite"
                    />
                  </path>
                </g>
              </>
            )}
          </g>
        </g>

        <g className={cn(styles.layer, hasFF && styles.layerActive)}>
          {ffLayers
            .map((layer) => ({
              ...layer,
              intensity: tieredIntensityFor(ffLevel, layer.index, 0.35)
            }))
            .filter((layer) => layer.intensity > 0)
            .sort((a, b) => b.size - a.size)
            .map((layer) => (
              <g key={`ff-${layer.id}`} transform={`translate(${ffOrigin.x} ${ffOrigin.y})`}>
                <path className={styles.ffCowl} d={layer.path} style={{ fillOpacity: layer.intensity }}>
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0 0; 3 0; 0 0"
                    dur="2.6s"
                    repeatCount="indefinite"
                  />
                </path>
              </g>
            ))}
        </g>

        <g className={cn(styles.layer, hasVF && styles.layerActive)}>
          {vfArmorShapes.map((armor) => {
            const intensity = tieredIntensityFor(vfLevel, 2 - armor.column, 0.35);
            if (intensity <= 0) return null;
            const armorPath = (
              <path
                key={armor.id}
                className={styles.vfArmor}
                d={armor.path}
                transform={`translate(${armor.x} ${armor.y})`}
              >
                <animate
                  attributeName="opacity"
                  values={buildPulseValues(intensity, 0.6)}
                  dur="2.4s"
                  repeatCount="indefinite"
                />
              </path>
            );

            if (armor.mirror) {
              return (
                <g key={armor.id} transform={mirrorTransform}>
                  {armorPath}
                </g>
              );
            }

            return armorPath;
          })}
        </g>
      </svg>
    </div>
  );
};
