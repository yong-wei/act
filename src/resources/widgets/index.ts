/**
 * Widgets Module - Unified Exports
 *
 * All AI-integrated widgets for BOPPPS lesson plan embedding.
 * These wrappers provide:
 * - AI context integration (useLessonContext, useLessonAI)
 * - State reporting (onStateChange, onComplete callbacks)
 * - Embedded mode support (minimal UI for lesson player)
 */

export { default as PhysicsBuilderWidget } from './physics-builder';
export { default as AnalogyMapperWidget } from './analogy-mapper';
export { default as ArgumentPrincipleWidget } from './argument-principle';

// Re-export prop types for external use
export type {
  BaseWidgetProps,
  WidgetState,
  WidgetResult,
  PhysicsBuilderWidgetProps,
  AnalogyMapperWidgetProps,
  ArgumentPrincipleWidgetProps,
} from '@/resources/widgets/widget-props';
