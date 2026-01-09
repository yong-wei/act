'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { BaseControllerId } from '../level-data';
import styles from './ShipAvatar.module.css';

interface ShipAvatarProps {
  controlMode: 'MANUAL' | 'AUTO';
  controllerId: BaseControllerId;
  enableFeedforward: boolean;
  enableSpeedFeedback: boolean;
  className?: string;
}

const baseHullPath = 'M40 60 L52 46 L80 36 L118 32 L158 36 L190 48 L206 60 L190 72 L158 84 L118 88 L80 84 L52 74 Z';
const leftWingPath = 'M86 36 L32 18 L58 54 L104 46 Z';
const rightWingPath = 'M86 84 L32 102 L58 66 L104 74 Z';
const nosePanelPath = 'M154 46 L186 60 L154 74 Z';
const cockpitPath = 'M124 50 L148 60 L124 70 Z';
const enginePort = { x: 36, y: 52 };
const engineStar = { x: 36, y: 68 };

export const ShipAvatar: React.FC<ShipAvatarProps> = ({
  controlMode,
  controllerId,
  enableFeedforward,
  enableSpeedFeedback,
  className
}) => {
  const hasCore = controlMode === 'AUTO';
  const hasI = hasCore && (controllerId === 'PI' || controllerId === 'PID');
  const hasD = hasCore && (controllerId === 'PD' || controllerId === 'PID');
  const hasFF = hasCore && enableFeedforward;
  const hasVF = hasCore && enableSpeedFeedback;

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
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.7" />
            <stop offset="45%" stopColor="#fb7185" stopOpacity="0.15" />
            <stop offset="55%" stopColor="#fb7185" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="iFlowGradient" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.2" />
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

        <g className={styles.tailBase}>
          <path d="M44 50 C20 54 10 56 0 60 C10 64 20 66 44 70 Z" />
        </g>
        <g className={cn(styles.tailCore, !hasCore && styles.tailHidden)}>
          <path d="M50 52 C26 56 14 58 6 60 C14 62 26 64 50 68 Z" />
        </g>
        <g className={cn(styles.tailI, !hasI && styles.tailHidden)}>
          <path d="M58 44 C26 50 12 54 0 60 C12 66 26 70 58 76 Z" />
        </g>

        <g>
          <path className={styles.baseHull} d={baseHullPath} />
          <path className={styles.baseWing} d={leftWingPath} />
          <path className={styles.baseWing} d={rightWingPath} />
          <path className={styles.basePanel} d={nosePanelPath} />
          <path className={styles.basePanel} d={cockpitPath} />
          <circle cx={enginePort.x} cy={enginePort.y} r="6" className={styles.basePanel} />
          <circle cx={engineStar.x} cy={engineStar.y} r="6" className={styles.basePanel} />
        </g>

        <g className={cn(styles.layer, hasCore && styles.layerActive)}>
          <path className={styles.pGlow} d={baseHullPath} />
          <path className={styles.pGlow} d={leftWingPath} />
          <path className={styles.pGlow} d={rightWingPath} />
          <path className={styles.pGlowEdge} d={baseHullPath} />
        </g>

        <g className={cn(styles.layer, hasI && styles.layerActive)}>
          <path className={styles.iFlow} d="M70 34 C42 40 22 50 14 60 C22 70 42 80 70 86 L104 84 C90 72 88 48 104 36 Z" />
        </g>

        <g className={cn(styles.layer, hasD && styles.layerActive)}>
          <path className={styles.dSparks} d="M86 28 L108 20 L128 26 L152 18 L176 28" />
          <path className={styles.dSparksAlt} d="M84 92 L106 104 L132 98 L156 108 L178 94" />
          <path className={styles.dSparks} d="M162 36 L178 50 L200 60 L178 70 L162 84" />
          <path className={styles.dSparksAlt} d="M150 40 L170 54 L186 60 L170 66 L150 80" />
        </g>

        <g className={cn(styles.layer, hasFF && styles.layerActive)}>
          <path className={styles.ffCowl} d="M138 38 L214 60 L138 82 Z" />
          <path className={styles.ffCowl} d="M146 46 L202 60 L146 74 Z" />
        </g>

        <g className={cn(styles.layer, hasVF && styles.layerActive)}>
          <path className={styles.vfArmor} d="M96 22 L134 20 L144 36 L102 38 Z" />
          <path className={styles.vfArmor} d="M112 36 L152 34 L162 50 L118 52 Z" />
          <path className={styles.vfArmor} d="M96 98 L134 100 L144 84 L102 82 Z" />
          <path className={styles.vfArmor} d="M112 84 L152 86 L162 70 L118 68 Z" />
        </g>
      </svg>
    </div>
  );
};
