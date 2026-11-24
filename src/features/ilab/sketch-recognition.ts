import { recordAiCall, type AiUsageLedger, type IlabAiDeployment } from './ai-data';
import {
  parseSketchVerdict,
  sketchLabelForId,
  SKETCH_VISION_MODEL,
  sketchVerdictFields,
  type SketchPlotId,
  type SketchVerdict,
} from './sketch-plots';

const IMAGE_URL = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_CHARS = 180_000;

export interface SketchRecognitionContext {
  mode?: 'analysis' | 'prediction';
  plotId?: SketchPlotId;
  vesselKey?: string;
  vesselTitle?: string;
  stepSeq?: number;
  stepTitle?: string;
  promptFocus?: string;
  originId?: string;
}

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

function buildSketchPrompt(context?: SketchRecognitionContext): string {
  const plotCatalog =
    '图种说明：nyquist（奈奎斯特图，复平面曲线）、bode（伯德图，随频率变化的幅频/相频曲线）、' +
    'root-locus（根轨迹图，s 平面上的闭环极点轨迹）、time-response（时域响应图，横轴是时间）、' +
    'frequency-amplitude（共振幅频图，横轴为频率比，纵轴为响应幅值倍率）、' +
    'planar-envelope（平面轨迹与警戒圈图，横轴东向位移 E、纵轴北向位移 N 及同心警戒圈）。';

  const blankRule =
    '注意：底图可能包含预设坐标轴、刻度线、参考虚线或警戒圈底板；只有检测到学生手绘的深蓝或橙红墨迹曲线时才算有效作答。' +
    '若画面只有空白或只有模板坐标轴而无手绘曲线，blank 必须为 true 且 plotKind 为 other。';

  const contextLines: string[] = [];
  if (context?.vesselTitle || context?.vesselKey) {
    contextLines.push(`实验对象：${context.vesselTitle || context.vesselKey}`);
  }
  if (context?.stepSeq !== undefined || context?.stepTitle) {
    const seqPart = context.stepSeq !== undefined ? `第 ${context.stepSeq} 步` : '';
    const titlePart = context.stepTitle ? `「${context.stepTitle}」` : '';
    contextLines.push(`当前步骤：${seqPart}${titlePart}`);
  }
  if (context?.plotId) {
    contextLines.push(`目标坐标系：${sketchLabelForId(context.plotId)}（${context.plotId}）`);
  }
  if (context?.promptFocus) {
    contextLines.push(`重点核查关注：${context.promptFocus}`);
  }

  const modeDirective = context?.mode === 'prediction'
    ? '当前为「运行前物理预测」模式：请结合坐标轴标尺与工程物理机理，判断学生手绘预测曲线的起终点、变化趋势、峰值/临界线或安全警戒圈关系是否合理；' +
      'featureChecks 列出 2~3 条具体物理特征核查要点；socraticHint 必须以苏格拉底式启发反问引导学生自行检验机理，严禁直接说出标准答案的数值或完整结论。'
    : '当前为「机理辨识与图形核验」模式：判断手绘曲线属于哪一类图并检查主要图形特征是否自洽；可附带 1~3 条 featureChecks 与 1 条引导反思的 socraticHint。';

  const outputFormat =
    '只输出严格 JSON：{"plotKind":"nyquist|bode|root-locus|time-response|frequency-amplitude|planar-envelope|other",' +
    '"blank":false,"evaluation":"不超过80字的中文评价，不要打分，不要提到模型名称",' +
    '"featureChecks":["特征核查要点1","特征核查要点2"],"socraticHint":"启发思考的引导提问"}';

  return [
    '你是船舶与海洋工程自动控制实验的看图助教。',
    plotCatalog,
    blankRule,
    contextLines.length > 0 ? `实验上下文：${contextLines.join('；')}。` : '',
    modeDirective,
    outputFormat,
  ].filter(Boolean).join('\n');
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
  context?: SketchRecognitionContext;
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
    max_tokens: 350,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: buildSketchPrompt(input.context) },
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
