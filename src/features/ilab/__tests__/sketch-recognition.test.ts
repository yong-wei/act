import { describe, expect, it } from 'vitest';

import { parseSketchVerdict, sketchReadingError } from '../sketch-plots';
import { recognizeSketch } from '../sketch-recognition';

const PNG = `data:image/png;base64,${'A'.repeat(80)}`;

describe('手绘图识别', () => {
  it('解析视觉模型返回的图种', () => {
    expect(parseSketchVerdict('```json\n{"plotKind":"bode","blank":false,"evaluation":"有两条随频率变化的曲线。"}\n```')).toEqual({
      plotKind: 'bode',
      blank: false,
      evaluation: '有两条随频率变化的曲线。',
    });
    expect(parseSketchVerdict('不是图')).toBeNull();
  });

  it('空白或图种不一致不能通过', () => {
    expect(sketchReadingError({ plotKind: '伯德图', sketchKind: 'bode', sketchBlank: '0' })).toBeNull();
    expect(sketchReadingError({ plotKind: '伯德图', sketchKind: 'nyquist', sketchBlank: '0' })).toContain('不一致');
    expect(sketchReadingError({ plotKind: '根轨迹图', sketchKind: 'other', sketchBlank: '1' })).toContain('空的');
    expect(sketchReadingError({ plotKind: '时域响应图' })).toContain('识别');
  });

  it('调用视觉模型而不是文本模型', async () => {
    let requested = '';
    const fetcher = (async (_url: string, init?: RequestInit) => {
      requested = String(init?.body ?? '');
      return new Response(JSON.stringify({
        usage: { prompt_tokens: 12, completion_tokens: 8 },
        choices: [{ message: { content: '{"plotKind":"nyquist","blank":false,"evaluation":"复平面上的一条曲线。"}' } }],
      }), { status: 200 });
    }) as typeof fetch;
    const result = await recognizeSketch({
      image: PNG,
      fetcher,
      env: { AI_API_KEY: 'test-key', AI_BASE_URL: 'https://api.siliconflow.cn/v1', AI_MODEL: 'Qwen/Qwen3.5-35B-A3B' },
    });
    expect(result.ok).toBe(true);
    expect(requested).toContain('Qwen/Qwen3-VL-30B-A3B-Instruct');
    expect(requested).not.toContain('Qwen3.5-35B-A3B');
    expect(requested).toContain('image_url');
  });

  it('模型不可用时不假装识别成功', async () => {
    const result = await recognizeSketch({
      image: PNG,
      env: { AI_API_KEY: '', AI_BASE_URL: '', SILICONFLOW_API_KEY: '', SILICONFLOW_API_URL: '' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('暂时不可用');
  });
});
