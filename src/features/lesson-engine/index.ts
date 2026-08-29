/**
 * 课程引擎模块导出
 * Lesson Engine Module Exports
 */

export {
  ContextInjector,
  useLessonContext,
  getAISystemPrompt,
  getAIPersonaConfig,
} from './ContextInjector';

// 状态管理
export {
  useLessonStore,
  selectCurrentStep,
  selectCurrentResource,
  selectProgress,
  selectIsTeacherMode,
  selectCanGoNext,
  selectCanGoPrev,
  type LessonState,
  type LessonActions,
  type LessonStore,
} from './lesson-store';
