'use client';

/**
 * CopilotPanel - AI 助教聊天面板
 *
 * 集成到仿真界面的 AI 助手聊天组件
 */

import { useChat, type Message } from 'ai/react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { type SimulationState, type SimulationMetrics } from '@/types/simulation';

interface CopilotPanelProps {
  simulationState?: SimulationState;
  metrics?: SimulationMetrics;
  pidGains?: { kp: number; ki: number; kd: number };
  onParamChange?: (params: { kp?: number; ki?: number; kd?: number; seaStateLevel?: number }) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function CopilotPanel({
  simulationState,
  metrics,
  pidGains,
  onParamChange,
  isCollapsed = false,
  onToggleCollapse,
}: CopilotPanelProps) {
  const [isExpanded, setIsExpanded] = useState(!isCollapsed);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 使用 Vercel AI SDK 的 useChat hook
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    reload,
    stop,
    append,
  } = useChat({
    api: '/api/ai/chat',
    body: {
      simulationState: simulationState
        ? {
            isRunning: simulationState.isRunning,
            isPaused: simulationState.isPaused,
            time: simulationState.time,
            position: simulationState.position,
            heading: simulationState.heading,
            rudder: simulationState.rudder,
            speed: simulationState.speed,
            targetHeading: 0, // 由外部传入
            pidGains: pidGains || { kp: 1.4, ki: 0.02, kd: 0.7 },
            nomotoParams: { K: 0.08, T: 55 },
            seaState: { level: 3, waveHeight: 1.0, windSpeed: 10 },
            metrics: metrics || { avgError: 0, maxRudderRate: 0, currentError: 0 },
          }
        : undefined,
    },
    onError: (err) => {
      console.error('Chat error:', err);
    },
  });

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 快捷问题
  const quickQuestions = [
    '当前仿真状态如何？',
    '请分析我的PID参数',
    '如何减少航迹误差？',
    '什么是诺莫托模型？',
  ];

  const handleQuickQuestion = useCallback(
    (question: string) => {
      append({ role: 'user', content: question });
    },
    [append]
  );

  if (!isExpanded) {
    return (
      <button
        onClick={() => {
          setIsExpanded(true);
          onToggleCollapse?.();
        }}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg transition-transform hover:scale-110"
        title="打开 AI 助教"
      >
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex h-[600px] w-[400px] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-slate-700 bg-gradient-to-r from-amber-900/50 to-orange-900/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
            <svg className="h-6 w-6 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-white">虚拟总工</h3>
            <p className="text-xs text-amber-300">中船重工 AI 助教</p>
          </div>
        </div>
        <button
          onClick={() => {
            setIsExpanded(false);
            onToggleCollapse?.();
          }}
          className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-800/50 p-4">
              <p className="text-sm text-slate-300">
                您好！我是虚拟总工程师，负责指导您完成船舶航向控制系统的设计与调试。
              </p>
              <p className="mt-2 text-sm text-slate-400">
                您可以问我关于PID调参、船舶运动学、安全规范等问题，我也可以直接分析您的仿真数据。
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-500">快捷问题：</p>
              <div className="flex flex-wrap gap-2">
                {quickQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickQuestion(q)}
                    className="rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <MessageBubble key={index} message={message} />
          ))
        )}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className="flex space-x-1">
              <div className="h-2 w-2 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '0ms' }} />
              <div className="h-2 w-2 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-2 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '300ms' }} />
            </div>
            <span>总工正在分析...</span>
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-900/30 p-3 text-sm text-red-300">
            <p>出错了: {error.message}</p>
            <Button size="sm" variant="ghost" onClick={() => reload()} className="mt-2 text-red-300">
              重试
            </Button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区 */}
      <form onSubmit={handleSubmit} className="border-t border-slate-700 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="请输入您的问题..."
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            disabled={isLoading}
          />
          {isLoading ? (
            <Button type="button" onClick={stop} variant="secondary" className="px-4">
              停止
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim()} className="bg-amber-600 px-4 hover:bg-amber-700">
              发送
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

// 消息气泡组件
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-amber-600 text-white'
            : 'bg-slate-800 text-slate-200'
        }`}
      >
        {/* 处理工具调用结果 */}
        {message.toolInvocations?.map((tool, index) => (
          <ToolResultDisplay key={index} tool={tool} />
        ))}
        {/* 普通文本消息 */}
        {message.content && (
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </div>
        )}
      </div>
    </div>
  );
}

// 工具调用结果展示
function ToolResultDisplay({ tool }: { tool: NonNullable<Message['toolInvocations']>[number] }) {
  if (tool.state !== 'result') {
    return (
      <div className="mb-2 rounded bg-slate-700/50 p-2 text-xs text-slate-400">
        正在调用工具: {tool.toolName}...
      </div>
    );
  }

  const result = tool.result as Record<string, unknown>;

  return (
    <div className="mb-2 rounded-lg border border-slate-600 bg-slate-900/50 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-amber-400">
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
        </svg>
        {tool.toolName === 'get_simulation_status' && '仿真状态'}
        {tool.toolName === 'set_simulation_params' && '参数修改'}
        {tool.toolName === 'analyze_result' && '结果分析'}
      </div>
      <pre className="overflow-x-auto text-xs text-slate-300">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}

export default CopilotPanel;
