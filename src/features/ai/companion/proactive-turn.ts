/**
 * 控灵主动陪伴主动回合（批 4 / 任务 2.2）。
 *
 * 投递成功后围绕 companion 上下文执行一次轻量 LLM 回合：
 * - 不伪造用户消息：指令仅作为 LLM 输入 prompt，不写入 KonlingSession.messages；
 * - 零外溢副作用：不挂工具、不写 LearningFact / 学生画像 / konlingMemory，
 *   生成结果只作为 companion-origin 助手消息追加回同一会话；
 * - 失败静默降级：模型未配置或生成异常时返回 null，投递保留静态文案消息。
 */

import { generateText } from 'ai';

import { getConfiguredAIModel } from '@/lib/ai/provider-runtime';

const PROACTIVE_TURN_MAX_OUTPUT_TOKENS = 300;

export interface CompanionProactiveTurnInput {
  userId: string;
  eventType: string;
  pageKind: string;
  pageRef: string;
  reasons: string[];
}

const EVENT_INSTRUCTIONS: Record<string, string> = {
  'pause-candidate': '学生刚在页面上停留了一会儿，可能是遇到了困难或走神。请给一句轻量的关心，询问是否需要帮助，不要替学生总结页面内容。',
  'wrong-answer': '学生刚在自适应练习中答错了一题。请先给一句简短的安慰与鼓励，不讲解具体知识点，也绝对不要给出答案或正确选项；告诉学生点击资源卡或回到对话可以看到讲解。',
  'progress-milestone': '学生刚在自适应练习中取得了进步。请给一句具体的表扬，并鼓励保持节奏。',
  'resource-completed': '学生刚完成一个学习资源。请给一句肯定，并用一句话建议下一步。',
};

function buildProactivePrompt(input: CompanionProactiveTurnInput): string {
  const instruction = EVENT_INSTRUCTIONS[input.eventType]
    ?? '请给学生一句简短、温暖的学习陪伴话语。';
  const reasonLines = input.reasons.length > 0
    ? input.reasons.map((reason) => `- ${reason}`).join('\n')
    : '-（本页暂无附加资源说明）';
  return [
    `触发场景：${input.eventType}（页面类型 ${input.pageKind}）。`,
    instruction,
    input.reasons.length > 0 ? '可参考的治理资源说明（不得编造未列出的资源）：\n' + reasonLines : '',
    '要求：1-2 句话、总共不超过 80 字；语气自然、不说教；不要使用列表格式；不要提及“系统”或“触发”。',
  ].filter(Boolean).join('\n');
}

/** 执行一次主动回合；返回 null 表示降级（保留投递静态文案）。 */
export async function runCompanionProactiveTurn(
  input: CompanionProactiveTurnInput,
): Promise<string | null> {
  try {
    const model = await getConfiguredAIModel();
    const result = await generateText({
      model,
      prompt: buildProactivePrompt(input),
      maxOutputTokens: PROACTIVE_TURN_MAX_OUTPUT_TOKENS,
      temperature: 0.7,
    });
    const content = result.text?.trim();
    return content ? content.slice(0, 600) : null;
  } catch (error) {
    console.error('companion proactive turn degraded', error);
    return null;
  }
}
