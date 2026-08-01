/**
 * Widget Props - Base interfaces for AI-integrated interactive widgets
 *
 * These types define the contract for widgets used in the BOPPPS lesson framework.
 * Widgets can operate in two modes:
 * 1. Standalone - Full UI with navigation (via /interactive-learning/* routes)
 * 2. Embedded - Minimal chrome, AI-integrated (via BOPPPS lesson player)
 */

import type { LessonContext } from '@/lib/ai-client';

/**
 * Widget state snapshot for AI context reporting
 */
export interface WidgetState {
  /** Current phase/step within the widget */
  phase?: string;
  /** Completion percentage (0-100) */
  progress: number;
  /** Widget-specific data snapshot */
  data: Record<string, unknown>;
  /** Timestamp of last update */
  timestamp: number;
}

/**
 * Widget completion result
 */
export interface WidgetResult {
  /** Whether the widget was completed successfully */
  success: boolean;
  /** Score if applicable (0-100) */
  score?: number;
  /** Detailed result data */
  data?: Record<string, unknown>;
}

/**
 * Base props for all AI-integrated widgets
 */
export interface BaseWidgetProps {
  /** Embedding mode: affects UI chrome visibility */
  embedded?: boolean;

  /** Callback when widget state changes (for AI context) */
  onStateChange?: (state: WidgetState) => void;

  /** Callback when widget completes (for BOPPPS progression) */
  onComplete?: (result?: WidgetResult) => void | Promise<void>;

  /** Lesson context from ContextInjector (auto-injected when embedded) */
  lessonContext?: LessonContext;

  /** Custom class name for layout adjustments */
  className?: string;
}

/**
 * Physics Builder Widget Props
 */
export interface PhysicsBuilderWidgetProps extends BaseWidgetProps {
  /** Builder mode: mechanical or electrical */
  mode: 'mechanical' | 'electrical';

  /** Initial component items to display in sidebar */
  items?: string[];

  /** Target equation for validation (LaTeX format) */
  targetEquation?: string;

  /** Show/hide equation display panel */
  showEquation?: boolean;

  /** Enable/disable AI hints */
  enableAIHints?: boolean;
}

/**
 * Analogy Mapper Widget Props
 */
export interface AnalogyMapperWidgetProps extends BaseWidgetProps {
  /** Left side equation (mechanical) */
  leftEq?: string;

  /** Right side equation (electrical) */
  rightEq?: string;

  /** Pre-completed mappings (for partial completion) */
  completedMappings?: string[];

  /** Required mappings to complete before onComplete triggers */
  requiredMappings?: string[];
}

/**
 * Argument Principle Widget Props
 */
export interface ArgumentPrincipleWidgetProps extends BaseWidgetProps {
  /** Initial function (transfer function format) */
  initialFunction?: {
    numerator: number[];
    denominator: number[];
  };

  /** Initial contour parameters */
  initialContour?: {
    type: 'circle' | 'semicircle' | 'custom';
    radius?: number;
    center?: { x: number; y: number };
  };

  /** Show/hide control panels */
  showControls?: boolean;

  /** Target winding number for validation */
  targetWindingNumber?: number;
}

/**
 * PID Simulator Widget Props
 */
export interface PidSimulatorWidgetProps extends BaseWidgetProps {
  /** Initial PID parameters */
  kp?: number;
  ki?: number;
  kd?: number;

  /** Initial model selection */
  model?: 'motor' | 'ship' | 'usv' | 'dps' | 'dredger' | 'fin';

  /** Show back navigation link */
  showBackLink?: boolean;
}
