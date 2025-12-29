'use client';

/**
 * AI Copilot 页面
 *
 * 独立的 AI 助教页面，提供完整的聊天界面
 */

import { useChat } from 'ai/react';
import { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function CopilotPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
  });

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 快捷问题
  const quickQuestions = [
    { label: '仿真状态', question: '请获取当前的仿真状态' },
    { label: 'PID原理', question: '请解释PID控制器的工作原理' },
    { label: '诺莫托模型', question: '什么是诺莫托船舶模型？参数K和T代表什么？' },
    { label: '调参建议', question: '我的航迹误差较大，应该如何调整PID参数？' },
    { label: '安全规范', question: '根据CCS规范，舵角速度的安全限制是多少？' },
    { label: '海况影响', question: '不同海况等级对船舶控制有什么影响？' },
  ];

  return (
    <div className="flex h-screen flex-col bg-gradient-to-b from-slate-950 to-slate-900">
      {/* 头部 */}
      <header className="border-b border-slate-800 bg-slate-950/80 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600">
              <svg className="h-7 w-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">AI 虚拟总工</h1>
              <p className="text-sm text-amber-400">中船重工船舶控制教学助手</p>
            </div>
          </div>
          <a
            href="/simulations/destroyer"
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            返回仿真
          </a>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 overflow-hidden">
        <div className="mx-auto flex h-full max-w-4xl flex-col p-6">
          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            {messages.length === 0 ? (
              <div className="space-y-6">
                {/* 欢迎信息 */}
                <div className="rounded-xl bg-gradient-to-br from-amber-900/30 to-orange-900/20 p-6">
                  <h2 className="mb-3 text-lg font-semibold text-amber-300">欢迎使用 AI 虚拟总工</h2>
                  <p className="text-slate-300">
                    我是由中船重工指派的虚拟总工程师，专门负责船舶自动控制系统的教学与审核工作。
                    我可以帮助您：
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-400">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      查看和分析仿真器状态
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      指导 PID 参数调整
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      解释船舶控制原理
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      根据 CCS 规范审核您的设计
                    </li>
                  </ul>
                </div>

                {/* 快捷问题 */}
                <div>
                  <p className="mb-3 text-sm text-slate-500">快捷问题</p>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {quickQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => append({ role: 'user', content: q.question })}
                        className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-left text-sm text-slate-300 transition-colors hover:border-amber-600 hover:bg-slate-800"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                        message.role === 'user'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-800 text-slate-200'
                      }`}
                    >
                      {/* 工具调用结果 */}
                      {message.toolInvocations?.map((tool, i) => (
                        <div key={i} className="mb-3 rounded-lg border border-slate-600 bg-slate-900/80 p-3">
                          <div className="mb-2 text-xs text-amber-400">
                            {tool.toolName === 'get_simulation_status' && '📊 仿真状态'}
                            {tool.toolName === 'set_simulation_params' && '⚙️ 参数修改'}
                            {tool.toolName === 'analyze_result' && '📈 结果分析'}
                          </div>
                          {tool.state === 'result' && (
                            <pre className="overflow-x-auto text-xs text-slate-400">
                              {JSON.stringify(tool.result, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                      {/* 文本消息 */}
                      {message.content && (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {message.content}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <div className="flex space-x-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-amber-400" />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '150ms' }} />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span>总工正在思考...</span>
                  </div>
                )}
                {error && (
                  <div className="rounded-lg bg-red-900/30 p-4 text-red-300">
                    <p className="text-sm">出错了: {error.message}</p>
                    <Button size="sm" variant="ghost" onClick={() => reload()} className="mt-2">
                      重试
                    </Button>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* 输入区 */}
          <form onSubmit={handleSubmit} className="mt-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="请输入您的问题，例如：如何减少航迹误差？"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                disabled={isLoading}
              />
              {isLoading ? (
                <Button type="button" onClick={stop} size="lg" variant="secondary" className="px-6">
                  停止
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="lg"
                  disabled={!input.trim()}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 hover:from-amber-600 hover:to-orange-600"
                >
                  发送
                </Button>
              )}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
