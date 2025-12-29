/**
 * 课堂同步 Hook
 * Classroom Sync Hook
 *
 * 使用 WebSocket/Realtime 实现教师-学生同步:
 * - 教师广播: 当 currentStepIndex 改变时广播 SYNC_STEP 事件
 * - 学生接收: 监听 SYNC_STEP，跟随模式下自动跳转
 * - 学生可切换"自由探索"模式脱离广播
 *
 * 技术选型: 支持 Supabase Realtime 或自定义 WebSocket
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type {
  SyncEventPayload,
  SyncEventType,
  ClassroomSession,
} from '@/types/schema';

// ===== 配置 =====

interface ClassroomSyncConfig {
  /** 课堂会话 ID */
  sessionId: string;

  /** 用户 ID */
  userId: string;

  /** 用户角色 */
  role: 'teacher' | 'student';

  /** WebSocket 服务器 URL（可选，默认使用 Supabase） */
  wsUrl?: string;

  /** 启用调试日志 */
  debug?: boolean;
}

// ===== Hook 返回类型 =====

interface ClassroomSyncReturn {
  /** 连接状态 */
  isConnected: boolean;

  /** 在线学生数量 */
  onlineStudents: number;

  /** 当前同步的步骤索引 */
  currentSyncedStep: number | null;

  /** 广播步骤变化（教师用） */
  broadcastStep: (stepIndex: number) => void;

  /** 监听步骤变化（学生用） */
  onStepChange: (callback: (stepIndex: number) => void) => void;

  /** 广播暂停 */
  broadcastPause: () => void;

  /** 广播继续 */
  broadcastResume: () => void;

  /** 断开连接 */
  disconnect: () => void;

  /** 重新连接 */
  reconnect: () => void;
}

// ===== 模拟 WebSocket 客户端（实际项目应替换为 Supabase Realtime） =====

class MockRealtimeChannel {
  private listeners: Map<string, Set<(payload: SyncEventPayload) => void>> =
    new Map();
  private channelName: string;
  private isSubscribed = false;

  constructor(channelName: string) {
    this.channelName = channelName;
  }

  on(
    event: string,
    callback: (payload: SyncEventPayload) => void
  ): MockRealtimeChannel {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
    return this;
  }

  subscribe(callback?: (status: string) => void): MockRealtimeChannel {
    this.isSubscribed = true;
    // 模拟异步订阅
    setTimeout(() => {
      callback?.('SUBSCRIBED');
    }, 100);
    return this;
  }

  unsubscribe(): void {
    this.isSubscribed = false;
    this.listeners.clear();
  }

  send(payload: { type: string; event: string; payload: SyncEventPayload }) {
    // 模拟广播到所有订阅者
    if (this.isSubscribed) {
      const eventListeners = this.listeners.get(payload.event);
      eventListeners?.forEach((callback) => {
        // 模拟网络延迟
        setTimeout(() => callback(payload.payload), 50);
      });
    }
    return this;
  }
}

// 模拟 Supabase 客户端
const mockSupabase = {
  channel: (name: string) => new MockRealtimeChannel(name),
  removeChannel: (channel: MockRealtimeChannel) => {
    channel.unsubscribe();
  },
};

// ===== 主 Hook =====

export function useClassroomSync(
  config: ClassroomSyncConfig
): ClassroomSyncReturn {
  const { sessionId, userId, role, debug = false } = config;

  // 状态
  const [isConnected, setIsConnected] = useState(false);
  const [onlineStudents, setOnlineStudents] = useState(0);
  const [currentSyncedStep, setCurrentSyncedStep] = useState<number | null>(
    null
  );

  // Refs
  const channelRef = useRef<MockRealtimeChannel | null>(null);
  const stepChangeCallbackRef = useRef<((stepIndex: number) => void) | null>(
    null
  );

  // 日志函数
  const log = useCallback(
    (message: string, data?: unknown) => {
      if (debug) {
        console.log(`[ClassroomSync] ${message}`, data || '');
      }
    },
    [debug]
  );

  // 创建事件载荷
  const createPayload = useCallback(
    (type: SyncEventType, data: SyncEventPayload['data']): SyncEventPayload => ({
      type,
      classroomSessionId: sessionId,
      senderId: userId,
      senderRole: role,
      timestamp: Date.now(),
      data,
    }),
    [sessionId, userId, role]
  );

  // 广播步骤变化
  const broadcastStep = useCallback(
    (stepIndex: number) => {
      if (role !== 'teacher') {
        log('只有教师可以广播步骤变化');
        return;
      }

      const payload = createPayload('SYNC_STEP', { stepIndex });
      channelRef.current?.send({
        type: 'broadcast',
        event: 'SYNC_STEP',
        payload,
      });
      setCurrentSyncedStep(stepIndex);
      log('广播步骤变化', { stepIndex });
    },
    [role, createPayload, log]
  );

  // 注册步骤变化回调
  const onStepChange = useCallback(
    (callback: (stepIndex: number) => void) => {
      stepChangeCallbackRef.current = callback;
    },
    []
  );

  // 广播暂停
  const broadcastPause = useCallback(() => {
    if (role !== 'teacher') return;

    const payload = createPayload('TEACHER_PAUSE', {});
    channelRef.current?.send({
      type: 'broadcast',
      event: 'TEACHER_PAUSE',
      payload,
    });
    log('广播暂停');
  }, [role, createPayload, log]);

  // 广播继续
  const broadcastResume = useCallback(() => {
    if (role !== 'teacher') return;

    const payload = createPayload('TEACHER_RESUME', {});
    channelRef.current?.send({
      type: 'broadcast',
      event: 'TEACHER_RESUME',
      payload,
    });
    log('广播继续');
  }, [role, createPayload, log]);

  // 断开连接
  const disconnect = useCallback(() => {
    if (channelRef.current) {
      // 发送离开事件
      const payload = createPayload('STUDENT_LEAVE', {
        userInfo: { userId, userName: '' },
      });
      channelRef.current.send({
        type: 'broadcast',
        event: 'STUDENT_LEAVE',
        payload,
      });

      mockSupabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setIsConnected(false);
      log('已断开连接');
    }
  }, [userId, createPayload, log]);

  // 重新连接
  const reconnect = useCallback(() => {
    disconnect();
    // 重新初始化连接（通过 effect）
  }, [disconnect]);

  // 初始化连接
  useEffect(() => {
    const channelName = `classroom_session_${sessionId}`;
    log('正在连接课堂频道', { channelName, role });

    // 创建频道
    const channel = mockSupabase.channel(channelName);
    channelRef.current = channel;

    // 监听同步事件
    channel
      .on('SYNC_STEP', (payload: SyncEventPayload) => {
        if (payload.senderId !== userId) {
          log('收到步骤同步', payload.data);
          const stepIndex = payload.data.stepIndex;
          if (typeof stepIndex === 'number') {
            setCurrentSyncedStep(stepIndex);
            stepChangeCallbackRef.current?.(stepIndex);
          }
        }
      })
      .on('STUDENT_JOIN', (payload: SyncEventPayload) => {
        log('学生加入', payload.data.userInfo);
        setOnlineStudents((prev) => prev + 1);
      })
      .on('STUDENT_LEAVE', (payload: SyncEventPayload) => {
        log('学生离开', payload.data.userInfo);
        setOnlineStudents((prev) => Math.max(0, prev - 1));
      })
      .on('TEACHER_PAUSE', () => {
        log('教师暂停');
      })
      .on('TEACHER_RESUME', () => {
        log('教师继续');
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          log('已连接到课堂频道');

          // 发送加入事件
          if (role === 'student') {
            const payload = createPayload('STUDENT_JOIN', {
              userInfo: { userId, userName: '' },
            });
            channel.send({
              type: 'broadcast',
              event: 'STUDENT_JOIN',
              payload,
            });
          }
        }
      });

    // 清理函数
    return () => {
      disconnect();
    };
  }, [sessionId, userId, role, createPayload, log, disconnect]);

  return {
    isConnected,
    onlineStudents,
    currentSyncedStep,
    broadcastStep,
    onStepChange,
    broadcastPause,
    broadcastResume,
    disconnect,
    reconnect,
  };
}

// ===== 辅助 Hook: 集成到 LessonPlayer =====

interface UseLessonSyncOptions {
  /** 课堂会话 */
  session: ClassroomSession | null;

  /** 用户 ID */
  userId: string;

  /** 是否为教师 */
  isTeacher: boolean;

  /** 是否跟随模式 */
  isFollowMode: boolean;

  /** 跳转到步骤回调 */
  goToStep: (index: number) => void;
}

export function useLessonSync({
  session,
  userId,
  isTeacher,
  isFollowMode,
  goToStep,
}: UseLessonSyncOptions): ClassroomSyncReturn | null {
  // 始终调用 hook，但传入空会话 ID 时会被禁用
  const sessionId = session?.id ?? '';
  const isEnabled = !!session;

  const sync = useClassroomSync({
    sessionId: sessionId || 'disabled',
    userId,
    role: isTeacher ? 'teacher' : 'student',
    debug: process.env.NODE_ENV === 'development',
  });

  // 学生跟随模式下自动跳转
  useEffect(() => {
    if (isEnabled && !isTeacher && isFollowMode) {
      sync.onStepChange((stepIndex) => {
        goToStep(stepIndex);
      });
    }
  }, [isEnabled, sync, isTeacher, isFollowMode, goToStep]);

  // 如果没有会话，返回 null
  return isEnabled ? sync : null;
}

export default useClassroomSync;
