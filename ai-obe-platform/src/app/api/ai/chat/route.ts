/**
 * AI Copilot 聊天 API
 *
 * 使用 Vercel AI SDK 实现流式聊天响应
 * 支持 Function Calling 工具调用
 */

import { streamText, convertToCoreMessages, type Message } from 'ai';
import { getAIModel, SYSTEM_PROMPT } from '@/lib/ai-client';
import { aiTools, updateSimulationState } from '@/lib/ai-tools';
import { getServerAuthSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    // 验证用户身份
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: '未授权' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { messages, simulationState } = body as {
      messages: Message[];
      simulationState?: Record<string, unknown>;
    };

    // 如果提供了仿真状态，更新到工具存储
    if (simulationState) {
      updateSimulationState(simulationState as Parameters<typeof updateSimulationState>[0]);
    }

    // 检查 API Key 配置
    if (!process.env.SILICONFLOW_API_KEY) {
      return new Response(
        JSON.stringify({
          error: 'AI 服务未配置',
          message: '请在环境变量中配置 SILICONFLOW_API_KEY',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 使用 Vercel AI SDK 生成流式响应
    const result = await streamText({
      model: getAIModel(),
      system: SYSTEM_PROMPT,
      messages: convertToCoreMessages(messages),
      tools: aiTools,
      maxSteps: 5, // 允许最多5轮工具调用
      toolChoice: 'auto',
      temperature: 0.7,
      maxTokens: 2000,
    });

    // 返回流式响应
    return result.toDataStreamResponse();
  } catch (error) {
    console.error('AI Chat API 错误:', error);
    return new Response(
      JSON.stringify({
        error: '服务器错误',
        message: error instanceof Error ? error.message : '未知错误',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
