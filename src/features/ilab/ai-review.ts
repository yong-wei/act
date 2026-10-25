import { recordAiCall, type AiUsageLedger, type IlabAiDeployment } from './ai-data';

const SCENARIOS: Record<number, string> = {
  2: '方案校核',
  10: '手绘曲线评估',
  11: '手绘曲线评估',
  13: '校正方案评审',
  24: '实验报告辅助生成',
};

export function ilabAiScenario(seq: number): string | null {
  return SCENARIOS[seq] ?? null;
}

function deploymentFor(baseUrl: string): IlabAiDeployment {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(baseUrl) ? '本地运行' : '公有云服务';
}

export async function reviewIlabStep(input: {
  ledger: AiUsageLedger;
  seq: number;
  summary: string;
  fetcher?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}): Promise<{ ledger: AiUsageLedger; note: string; call: Parameters<typeof recordAiCall>[1] } | null> {
  const scenario = ilabAiScenario(input.seq);
  if (!scenario) return null;
  const env = input.env ?? process.env;
  const apiKey = env.AI_API_KEY || env.SILICONFLOW_API_KEY || '';
  const baseUrl = env.AI_BASE_URL || env.SILICONFLOW_API_URL || '';
  const model = env.AI_MODEL || env.SILICONFLOW_MODEL || '';
  const provider = env.AI_PROVIDER || 'siliconflow';
  if (!apiKey.trim() || !baseUrl.trim() || !model.trim()) return null;

  const fetcher = input.fetcher ?? fetch;
  try {
    const response = await fetcher(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 240,
        messages: [{
          role: 'user',
          content: `你是自动控制实验助教。场景是${scenario}。只根据下面的步骤摘要给不超过 80 字的中文建议，不要打分，不要编造船型参数。\n${input.summary.slice(0, 800)}`,
        }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return null;
    const body = await response.json() as {
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      choices?: Array<{ message?: { content?: string } }>;
    };
    const note = body.choices?.[0]?.message?.content?.replace(/\s+/g, ' ').trim() ?? '';
    if (!note) return null;
    const usageMissing = typeof body.usage?.prompt_tokens !== 'number' || typeof body.usage?.completion_tokens !== 'number';
    const call = {
      scenario,
      model,
      provider: provider === 'siliconflow' ? 'SiliconFlow' : provider,
      deployment: deploymentFor(baseUrl),
      inputTokens: usageMissing ? 0 : body.usage?.prompt_tokens ?? 0,
      outputTokens: usageMissing ? 0 : body.usage?.completion_tokens ?? 0,
      usageMissing,
    };
    return {
      note: note.slice(0, 120),
      call,
      ledger: recordAiCall(input.ledger, call),
    };
  } catch {
    return null;
  }
}
