import { recordAiCall, type AiUsageLedger, type IlabAiDeployment } from './ai-data';
import {
  parseSketchVerdict,
  SKETCH_VISION_MODEL,
  sketchVerdictFields,
  type SketchVerdict,
} from './sketch-plots';

const IMAGE_URL = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_CHARS = 180_000;

export type SketchRecognition =
  | { ok: true; verdict: SketchVerdict; fields: Record<string, string>; call: Parameters<typeof recordAiCall>[1] }
  | { ok: false; message: string };

function deploymentFor(baseUrl: string): IlabAiDeployment {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(baseUrl) ? '本地运行' : '公有云服务';
}

function messageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((part) => {
    if (typeof part === 'string') return part;
    if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') return part.text;
    return '';
  }).join('');
}

export function acceptSketchImage(image: string): string | null {
  const trimmed = image.trim();
  if (!IMAGE_URL.test(trimmed) || trimmed.length > MAX_IMAGE_CHARS) {
    return '手绘图无法识别，请重画一张较小的图。';
  }
  return null;
}

export async function recognizeSketch(input: {
  image: string;
  fetcher?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}): Promise<SketchRecognition> {
  const rejected = acceptSketchImage(input.image);
  if (rejected) return { ok: false, message: rejected };
  const env = input.env ?? process.env;
  const provider = (env.AI_PROVIDER || 'siliconflow').trim() || 'siliconflow';
  const baseUrl = (
    env.AI_BASE_URL ||
    env.SILICONFLOW_API_URL ||
    (provider === 'siliconflow' ? 'https://api.siliconflow.cn/v1' : '')
  ).trim();
  const apiKeys = Array.from(
    new Set([env.AI_API_KEY, env.SILICONFLOW_API_KEY].map((k) => (k ?? '').trim()).filter(Boolean)),
  );
  if (apiKeys.length === 0 || !baseUrl) {
    return { ok: false, message: '图像识别暂时不可用，请稍后重试。' };
  }

  const fetcher = input.fetcher ?? fetch;
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const payload = JSON.stringify({
    model: SKETCH_VISION_MODEL,
    temperature: 0,
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: '你是自动控制实验的看图助教。判断这张学生手绘图属于哪一种：nyquist（奈奎斯特图，复平面曲线）、bode（伯德图，常有两条随频率变化的曲线）、root-locus（根轨迹图，s 平面上的轨迹）、time-response（时域响应图，横轴是时间）。画布几乎空白时 blank 为 true，plotKind 为 other。只输出 JSON：{"plotKind":"nyquist|bode|root-locus|time-response|other","blank":false,"evaluation":"不超过80字的中文评价，不要打分，不要提到模型名称"}',
        },
        { type: 'image_url', image_url: { url: input.image.trim() } },
      ],
    }],
  });
  try {
    let response: Response | null = null;
    for (let i = 0; i < apiKeys.length; i += 1) {
      response = await fetcher(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKeys[i]}`,
          'content-type': 'application/json',
        },
        body: payload,
        signal: AbortSignal.timeout(45000),
      });
      if ((response.status !== 401 && response.status !== 403) || i === apiKeys.length - 1) {
        break;
      }
    }
    if (!response || !response.ok) return { ok: false, message: '图像识别暂时不可用，请稍后重试。' };
    const body = await response.json() as {
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const verdict = parseSketchVerdict(messageText(body.choices?.[0]?.message?.content));
    if (!verdict) return { ok: false, message: '图像识别没有给出可用结果，请重画后再试。' };
    const usageMissing = typeof body.usage?.prompt_tokens !== 'number' || typeof body.usage?.completion_tokens !== 'number';
    const call = {
      scenario: '手绘曲线识别',
      model: SKETCH_VISION_MODEL,
      provider: provider === 'siliconflow' ? 'SiliconFlow' : provider,
      deployment: deploymentFor(baseUrl),
      inputTokens: usageMissing ? 0 : body.usage?.prompt_tokens ?? 0,
      outputTokens: usageMissing ? 0 : body.usage?.completion_tokens ?? 0,
      usageMissing,
    };
    return { ok: true, verdict, fields: sketchVerdictFields(verdict), call };
  } catch {
    return { ok: false, message: '图像识别暂时不可用，请稍后重试。' };
  }
}

export function ledgerWithSketch(ledger: AiUsageLedger, recognition: SketchRecognition): AiUsageLedger {
  return recognition.ok ? recordAiCall(ledger, recognition.call) : ledger;
}
