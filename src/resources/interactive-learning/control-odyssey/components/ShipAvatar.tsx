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

const baseHullPath = 'M36 60 L48 42 L72 30 L108 24 L152 28 L186 44 L206 60 L186 76 L152 92 L108 96 L72 90 L48 78 Z';
const leftWingPath = 'M72 30 L36 8 L108 32 Z';
const rightWingPath = 'M72 90 L36 112 L108 88 Z';
const tailFinPath = 'M48 56 L28 40 L34 60 L28 80 L48 64 Z';
const nosePanelPath = 'M150 44 L182 60 L150 76 Z';
const cockpitPath = 'M118 48 L146 60 L118 72 Z';
const enginePort = { x: 34, y: 46 };
const engineMid = { x: 30, y: 60 };
const engineStar = { x: 34, y: 74 };

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
          <linearGradient id="pGlowGradient" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#fb7185" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.2" />
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
          <path className={styles.baseWing} d={tailFinPath} />
          <path className={styles.basePanel} d={nosePanelPath} />
          <path className={styles.basePanel} d={cockpitPath} />
          <circle cx={enginePort.x} cy={enginePort.y} r="6" className={styles.basePanel} />
          <circle cx={engineMid.x} cy={engineMid.y} r="7" className={styles.basePanel} />
          <circle cx={engineStar.x} cy={engineStar.y} r="6" className={styles.basePanel} />
        </g>

        <g className={cn(styles.layer, hasCore && styles.layerActive)}>
          <path className={styles.pGlow} d={baseHullPath} />
          <path className={styles.pGlow} d={leftWingPath} />
          <path className={styles.pGlow} d={rightWingPath} />
        </g>

        <g className={cn(styles.layer, hasI && styles.layerActive)}>
          <path className={styles.iFlow} d="M70 34 C42 40 22 50 14 60 C22 70 42 80 70 86 L104 84 C90 72 88 48 104 36 Z" />
        </g>

        <g className={cn(styles.layer, hasD && styles.layerActive)}>
          <path className={styles.dSparks} d="M78 26 L122 14 L166 26" />
          <path className={styles.dSparks} d="M78 94 L122 106 L166 94" />
          <path className={styles.dSparks} d="M162 34 L206 60 L162 86" />
        </g>

        <g className={cn(styles.layer, hasFF && styles.layerActive)}>
          <path className={styles.ffCowl} d="M138 38 L214 60 L138 82 Z" />
          <path className={styles.ffCowl} d="M146 46 L202 60 L146 74 Z" />
        </g>

        <g className={cn(styles.layer, hasVF && styles.layerActive)}>
          <path className={styles.vfArmor} d="M46 28 L82 20 L82 40 L50 46 Z" />
          <path className={styles.vfArmor} d="M46 92 L82 80 L82 100 L50 104 Z" />
          <path className={styles.vfArmor} d="M114 24 L150 26 L162 38 L122 40 Z" />
          <path className={styles.vfArmor} d="M114 96 L150 94 L162 82 L122 80 Z" />
          <path className={styles.vfArmor} d="M78 52 L110 50 L116 60 L110 70 L78 68 Z" />
        </g>
      </svg>
    </div>
  );
};
