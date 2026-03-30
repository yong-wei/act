/**
 * AI助手上下文类型定义
 *
 * 定义页面上下文、用户画像、AI上下文等类型
 */

import type { Message } from 'ai/react';

/**
 * 页面类型
 */
export type PageType = 'theory' | 'practice' | 'quiz' | 'reflection' | 'workspace' | 'summary';

/**
 * 知识类型 (C: 概念性, X: 程序性, D: 元认知)
 */
export type KnowledgeType = 'C' | 'X' | 'D';

/**
 * 学习风格
 */
export type LearningStyle = 'VISUAL' | 'TEXTUAL' | 'INTERACTIVE' | 'AUDITORY' | 'LOGICAL';

/**
 * BOPPPS阶段
 */
export type BopppsStage = 'BRIDGE_IN' | 'OBJECTIVE' | 'PRE_ASSESSMENT' | 'PARTICIPATORY' | 'POST_ASSESSMENT' | 'SUMMARY';

/**
 * 能力向量
 */
export interface AbilityVector {
  computational: number; // 计算能力
  crossDomain: number;   // 跨域能力
  design: number;        // 设计能力
  analysis: number;      // 分析能力
  evaluation: number;    // 评价能力
}

/**
 * 页面上下文
 */
export interface PageContext {
  /** 课程ID (如: unit-2-1-modeling-language-v1, lesson-02, simulation) */
  courseId: string;
  /** 课程标题 */
  courseTitle: string;
  /** 页面类型 */
  pageType: PageType;
  /** 当前步骤ID */
  stepId: string;
  /** 当前主题 */
  topic: string;
  /** 学习目标 */
  learningObjectives: string[];
  /** 知识类型 */
  knowledgeType: KnowledgeType;
  /** BOPPPS阶段 */
  stage?: BopppsStage;
  /** 当前页面URL */
  url?: string;
}

/**
 * 用户画像
 */
export interface UserProfile {
  /** 用户ID */
  id: string;
  /** 姓名 */
  name: string;
  /** 学习风格 */
  learningStyle: LearningStyle;
  /** 认知水平 (1-5) */
  cognitiveLevel: 1 | 2 | 3 | 4 | 5;
  /** 能力向量 */
  abilityVector: AbilityVector;
  /** 舰队/班组 */
  fleetGroup?: string;
  /** 班级 */
  className?: string;
}

/**
 * AI上下文
 */
export interface AIContext {
  /** 页面上下文 */
  page: PageContext;
  /** 用户画像 */
  user: UserProfile;
  /** 会话历史 */
  sessionHistory?: Message[];
}

/**
 * 步骤AI上下文 (用于课程配置)
 */
export interface StepAIContext {
  /** 该步骤的具体主题 */
  topic: string;
  /** 该步骤的教学目的 */
  purpose: string;
  /** 核心概念列表 */
  keyConcepts: string[];
  /** 常见误解 */
  commonMisconceptions?: string[];
  /** AI助手引导提示词 */
  aiHints?: string;
  /** 学习目标 */
  learningObjectives?: string[];
  /** 知识类型 */
  knowledgeType?: KnowledgeType;
}

/**
 * 会话信息
 */
export interface KonlingSessionInfo {
  /** 会话ID */
  id: string;
  /** 用户ID */
  userId: string;
  /** 课程ID */
  courseId: string;
  /** 页面/步骤ID */
  pageId: string;
  /** 会话标题 */
  title: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
  /** 过期时间 */
  expiresAt: Date;
  /** 消息数量 */
  messageCount: number;
}

/**
 * 会话消息
 */
export interface KonlingSessionMessage {
  /** 消息ID */
  id: string;
  /** 角色 */
  role: 'user' | 'assistant' | 'system';
  /** 内容 */
  content: string;
  /** 创建时间 */
  createdAt: Date;
  /** 工具调用 */
  toolInvocations?: Array<{
    toolName: string;
    args: Record<string, unknown>;
    result?: unknown;
  }>;
}

/**
 * 创建会话请求
 */
export interface CreateSessionRequest {
  courseId: string;
  pageId: string;
  title: string;
  pageContext: PageContext;
}

/**
 * 发送消息请求
 */
export interface SendMessageRequest {
  content: string;
  pageContext?: PageContext;
}

/**
 * 聊天请求体
 */
export interface ChatRequestBody {
  messages: Message[];
  pageContext?: PageContext;
  userProfile?: UserProfile;
  sessionId?: string;
  courseId?: string;
  pageId?: string;
}

/**
 * 提示词构建选项
 */
export interface PromptBuilderOptions {
  /** 是否包含用户画像 */
  includeUserProfile?: boolean;
  /** 是否包含会话历史 */
  includeSessionHistory?: boolean;
  /** 字数限制 */
  wordLimit?: number;
  /** 是否启用LaTeX */
  enableLatex?: boolean;
}

/**
 * AI助手页面上下文配置
 *
 * 页面通过导出此配置来显式声明AI助手上下文
 * 如未导出，将基于路径自动推断
 *
 * @example
 * ```typescript
 * export const aiContextConfig: AIContextConfig = {
 *   courseId: 'lesson-02',
 *   courseTitle: '系统建模基础',
 *   pageType: 'theory',
 *   learningObjectives: ['理解系统建模概念'],
 *   tools: ['analyze_system'],
 * };
 * ```
 */
export interface AIContextConfig {
  /** 是否启用AI助手 (默认true) */
  enabled?: boolean;
  /** 课程ID (如: lesson-02, unit-2-1-modeling-language-v1, simulation) */
  courseId: string;
  /** 课程标题 */
  courseTitle: string;
  /** 页面类型 */
  pageType: PageType;
  /** 步骤ID (可选) */
  stepId?: string;
  /** 当前主题 (可选，默认使用courseTitle) */
  topic?: string;
  /** 学习目标列表 */
  learningObjectives?: string[];
  /** 知识类型 */
  knowledgeType?: KnowledgeType;
  /** 可用工具列表 */
  tools?: string[];
  /** 快捷问题列表 */
  quickQuestions?: Array<{ label: string; question: string }>;
  /** 系统提示词扩展 */
  systemPromptExtension?: string;
}

/**
 * 全局AI上下文状态
 */
export interface GlobalAIContextState {
  /** 当前页面上下文 */
  pageContext: PageContext | null;
  /** 用户画像 */
  userProfile: UserProfile | null;
  /** 是否启用AI助手 */
  enabled: boolean;
  /** 是否显示侧边栏 */
  isOpen: boolean;
  /** 未读消息数 */
  unreadCount: number;
}
