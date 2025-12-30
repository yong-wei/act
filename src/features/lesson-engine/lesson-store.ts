/**
 * 课程引擎状态管理
 * Lesson Engine State Management (Zustand)
 *
 * 管理课程播放状态、步骤导航、进度跟踪
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  LessonManifest,
  LessonStep,
  Resource,
  StepProgress,
  LessonSessionState,
  ClassroomSession,
} from '@/types/schema';

// ===== 状态接口 =====

export interface LessonState {
  // 课程数据
  manifest: LessonManifest | null;
  resources: Record<string, Resource>;

  // 播放状态
  currentStepIndex: number;
  totalSteps: number;
  isPlaying: boolean;
  isPaused: boolean;

  // 模式
  isTeacherMode: boolean;
  isFollowMode: boolean; // 学生跟随模式

  // 进度跟踪
  stepProgress: StepProgress[];
  sessionStartTime: Date | null;

  // 课堂同步
  classroomSession: ClassroomSession | null;
  isConnectedToClassroom: boolean;

  // 计算属性
  currentStep: LessonStep | null;
  currentResource: Resource | null;
  progress: number; // 0-100
}

export interface LessonActions {
  // 初始化
  loadLesson: (manifest: LessonManifest, resources: Record<string, Resource>) => void;
  resetLesson: () => void;

  // 导航
  goToStep: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;

  // 模式切换
  setTeacherMode: (isTeacher: boolean) => void;
  setFollowMode: (isFollow: boolean) => void;

  // 播放控制
  play: () => void;
  pause: () => void;

  // 进度更新
  updateStepProgress: (stepId: string, data: Partial<StepProgress>) => void;
  markStepCompleted: (stepId: string, score?: number) => void;

  // 课堂同步
  joinClassroom: (session: ClassroomSession) => void;
  leaveClassroom: () => void;
  receiveStepSync: (stepIndex: number) => void;
}

export type LessonStore = LessonState & LessonActions;

// ===== 初始状态 =====

const initialState: LessonState = {
  manifest: null,
  resources: {},
  currentStepIndex: 0,
  totalSteps: 0,
  isPlaying: false,
  isPaused: false,
  isTeacherMode: false,
  isFollowMode: true,
  stepProgress: [],
  sessionStartTime: null,
  classroomSession: null,
  isConnectedToClassroom: false,
  currentStep: null,
  currentResource: null,
  progress: 0,
};

// ===== Store 创建 =====

export const useLessonStore = create<LessonStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // 加载课程
        loadLesson: (manifest, resources) => {
          const stepProgress: StepProgress[] = manifest.steps.map((step, index) => ({
            stepId: step.id,
            status: index === 0 ? 'available' : 'locked',
            timeSpent: 0,
          }));

          set({
            manifest,
            resources,
            totalSteps: manifest.steps.length,
            currentStepIndex: 0,
            stepProgress,
            sessionStartTime: new Date(),
            isPlaying: true,
            currentStep: manifest.steps[0] || null,
            currentResource: manifest.steps[0]
              ? resources[manifest.steps[0].resourceId] || null
              : null,
            progress: 0,
          });
        },

        // 重置课程
        resetLesson: () => {
          set(initialState);
        },

        // 跳转到指定步骤
        goToStep: (index) => {
          const { manifest, resources, stepProgress, isTeacherMode } = get();
          if (!manifest) return;

          // 边界检查
          if (index < 0 || index >= manifest.steps.length) return;

          // 非教师模式下，检查步骤是否可用
          if (!isTeacherMode) {
            const targetProgress = stepProgress[index];
            if (targetProgress?.status === 'locked') return;
          }

          const newStep = manifest.steps[index];
          const newResource = newStep ? resources[newStep.resourceId] : null;

          // 更新当前步骤进度为进行中
          const newStepProgress = stepProgress.map((sp, i) => {
            if (i === index && sp.status !== 'completed') {
              return {
                ...sp,
                status: 'in_progress' as const,
                startedAt: sp.startedAt || new Date(),
              };
            }
            return sp;
          });

          set({
            currentStepIndex: index,
            currentStep: newStep || null,
            currentResource: newResource,
            stepProgress: newStepProgress,
            progress: Math.round((index / (manifest.steps.length - 1)) * 100),
          });
        },

        // 下一步
        nextStep: () => {
          const { currentStepIndex, totalSteps, goToStep } = get();
          if (currentStepIndex < totalSteps - 1) {
            goToStep(currentStepIndex + 1);
          }
        },

        // 上一步
        prevStep: () => {
          const { currentStepIndex, goToStep } = get();
          if (currentStepIndex > 0) {
            goToStep(currentStepIndex - 1);
          }
        },

        // 设置教师模式
        setTeacherMode: (isTeacher) => {
          set({ isTeacherMode: isTeacher });
        },

        // 设置跟随模式
        setFollowMode: (isFollow) => {
          set({ isFollowMode: isFollow });
        },

        // 播放
        play: () => {
          set({ isPlaying: true, isPaused: false });
        },

        // 暂停
        pause: () => {
          set({ isPaused: true });
        },

        // 更新步骤进度
        updateStepProgress: (stepId, data) => {
          const { stepProgress } = get();
          const newProgress = stepProgress.map((sp) =>
            sp.stepId === stepId ? { ...sp, ...data } : sp
          );
          set({ stepProgress: newProgress });
        },

        // 标记步骤完成
        markStepCompleted: (stepId, score) => {
          const { stepProgress, currentStepIndex, manifest } = get();

          const newProgress = stepProgress.map((sp, index) => {
            if (sp.stepId === stepId) {
              return {
                ...sp,
                status: 'completed' as const,
                completedAt: new Date(),
                score,
              };
            }
            // 解锁下一步
            if (index === currentStepIndex + 1 && sp.status === 'locked') {
              return { ...sp, status: 'available' as const };
            }
            return sp;
          });

          // 计算总体进度
          const completedCount = newProgress.filter(
            (sp) => sp.status === 'completed'
          ).length;
          const totalCount = manifest?.steps.length || 1;
          const progress = Math.round((completedCount / totalCount) * 100);

          set({ stepProgress: newProgress, progress });
        },

        // 加入课堂
        joinClassroom: (session) => {
          set({
            classroomSession: session,
            isConnectedToClassroom: true,
            isFollowMode: true,
          });
        },

        // 离开课堂
        leaveClassroom: () => {
          set({
            classroomSession: null,
            isConnectedToClassroom: false,
          });
        },

        // 接收步骤同步
        receiveStepSync: (stepIndex) => {
          const { isFollowMode, goToStep } = get();
          if (isFollowMode) {
            goToStep(stepIndex);
          }
        },
      }),
      {
        name: 'lesson-storage',
        partialize: (state) => ({
          // 仅持久化部分状态
          stepProgress: state.stepProgress,
          currentStepIndex: state.currentStepIndex,
        }),
      }
    ),
    { name: 'LessonStore' }
  )
);

// ===== 选择器 =====

export const selectCurrentStep = (state: LessonStore) => state.currentStep;
export const selectCurrentResource = (state: LessonStore) => state.currentResource;
export const selectProgress = (state: LessonStore) => state.progress;
export const selectIsTeacherMode = (state: LessonStore) => state.isTeacherMode;
export const selectCanGoNext = (state: LessonStore) =>
  state.currentStepIndex < state.totalSteps - 1;
export const selectCanGoPrev = (state: LessonStore) => state.currentStepIndex > 0;
