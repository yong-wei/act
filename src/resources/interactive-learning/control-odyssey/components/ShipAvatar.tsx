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

const baseHullPath = 'M32 60 L72 26 L142 26 L192 60 L142 94 L72 94 Z';
const leftWingPath = 'M72 26 L52 12 L110 26 Z';
const rightWingPath = 'M72 94 L52 108 L110 94 Z';
const nosePanelPath = 'M142 42 L170 60 L142 78 Z';

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
          <path d="M40 50 C18 54 10 56 0 60 C10 64 18 66 40 70 Z" />
        </g>
        <g className={cn(styles.tailCore, !hasCore && styles.tailHidden)}>
          <path d="M46 52 C24 56 14 58 4 60 C14 62 24 64 46 68 Z" />
        </g>
        <g className={cn(styles.tailI, !hasI && styles.tailHidden)}>
          <path d="M54 44 C24 50 12 54 0 60 C12 66 24 70 54 76 Z" />
        </g>

        <g>
          <path className={styles.baseHull} d={baseHullPath} />
          <path className={styles.baseWing} d={leftWingPath} />
          <path className={styles.baseWing} d={rightWingPath} />
          <path className={styles.basePanel} d={nosePanelPath} />
          <circle cx="52" cy="48" r="6" className={styles.basePanel} />
          <circle cx="52" cy="72" r="6" className={styles.basePanel} />
        </g>

        <g className={cn(styles.layer, hasCore && styles.layerActive)}>
          <path className={styles.pGlow} d={baseHullPath} />
        </g>

        <g className={cn(styles.layer, hasI && styles.layerActive)}>
          <path className={styles.iFlow} d="M60 36 C44 38 22 50 12 60 C22 70 44 82 60 84 L94 84 C80 72 76 48 94 36 Z" />
        </g>

        <g className={cn(styles.layer, hasD && styles.layerActive)}>
          <path className={styles.dSparks} d="M70 24 L110 14 L150 24" />
          <path className={styles.dSparks} d="M70 96 L110 106 L150 96" />
          <path className={styles.dSparks} d="M150 34 L190 60 L150 86" />
        </g>

        <g className={cn(styles.layer, hasFF && styles.layerActive)}>
          <path className={styles.ffCowl} d="M130 40 L210 60 L130 80 Z" />
        </g>

        <g className={cn(styles.layer, hasVF && styles.layerActive)}>
          <path className={styles.vfArmor} d="M40 30 L72 22 L72 42 L44 50 Z" />
          <path className={styles.vfArmor} d="M40 90 L72 78 L72 98 L44 104 Z" />
          <path className={styles.vfArmor} d="M120 24 L148 24 L158 36 L128 38 Z" />
          <path className={styles.vfArmor} d="M120 96 L148 96 L158 84 L128 82 Z" />
        </g>
      </svg>
    </div>
  );
};
