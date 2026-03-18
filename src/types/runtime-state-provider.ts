/**
 * 前端运行时状态提供者接口
 *
 * 页面通过window.AIOBE_RUNTIME_PROVIDER实现此接口
 * 使AI助手能够获取页面实时状态
 */

import type { PageType } from './ai-context';
import type { RuntimeStateSnapshot } from './ai-context-layered';

/**
 * 前端页面暴露的运行时状态提供者接口
 * 页面通过window.AIOBE_RUNTIME_PROVIDER实现此接口
 */
export interface RuntimeStateProvider {
  /** 获取当前运行时状态 */
  getRuntimeState(): Promise<RuntimeStateSnapshot> | RuntimeStateSnapshot;

  /** 订阅状态变化 */
  subscribe(callback: (state: RuntimeStateSnapshot) => void): () => void;

  /** 取消订阅 */
  unsubscribe?(callback: (state: RuntimeStateSnapshot) => void): void;

  /** 获取页面类型 */
  getPageType(): PageType;

  /** 获取当前课程ID */
  getCourseId(): string;

  /** 获取当前步骤ID */
  getStepId(): string;

  /** 获取提供者版本 */
  getVersion?(): string;
}

/**
 * 状态变化回调函数类型
 */
export type StateChangeCallback = (state: RuntimeStateSnapshot) => void;

/**
 * 提供者配置选项
 */
export interface RuntimeProviderConfig {
  /** 轮询间隔(ms)，0表示禁用轮询 */
  pollInterval: number;
  /** 是否启用事件驱动更新 */
  enableEventDriven: boolean;
  /** 最大交互历史记录数 */
  maxInteractionHistory: number;
  /** 调试模式 */
  debug?: boolean;
}

/**
 * 默认提供者配置
 */
export const DEFAULT_PROVIDER_CONFIG: RuntimeProviderConfig = {
  pollInterval: 5000,
  enableEventDriven: true,
  maxInteractionHistory: 100,
  debug: false,
};

/**
 * 状态提供者管理器
 * 用于管理多个提供者的注册和发现
 */
export interface RuntimeProviderManager {
  /** 注册提供者 */
  register(provider: RuntimeStateProvider): void;

  /** 注销提供者 */
  unregister(courseId: string, stepId: string): void;

  /** 获取指定页面的提供者 */
  getProvider(courseId: string, stepId: string): RuntimeStateProvider | undefined;

  /** 获取当前活跃的提供者 */
  getActiveProvider(): RuntimeStateProvider | undefined;

  /** 设置活跃提供者 */
  setActiveProvider(courseId: string, stepId: string): void;
}

declare global {
  interface Window {
    /** 全局运行时状态提供者 */
    AIOBE_RUNTIME_PROVIDER?: RuntimeStateProvider;

    /** 运行时提供者管理器（可选） */
    AIOBE_PROVIDER_MANAGER?: RuntimeProviderManager;

    /** 调试用的状态查看器 */
    __AIOBE_DEBUG__?: {
      getLastSnapshot: () => RuntimeStateSnapshot | undefined;
      getInteractionHistory: () => unknown[];
    };
  }
}

export {};
