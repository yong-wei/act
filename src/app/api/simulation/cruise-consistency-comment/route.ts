import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { getAIModel, isAIServiceConfigured } from '@/lib/ai-client';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      score,
      overshootPass,
      settlePass,
      accelPass,
      target,
      result,
    } = body as {
      score: number;
      overshootPass: boolean;
      settlePass: boolean;
      accelPass: boolean;
      target: { overshoot: number; settlingTime: number; maxLateralAccel: number };
      result: { overshoot: number; settlingTime: number; accel: number };
    };

    if (!isAIServiceConfigured()) {
      const fallback = score >= 80
        ? '目标与调参行为整体一致，建议围绕舒适约束做小范围参数微调。'
        : '目标与行为存在偏差，建议优先固定约束边界，再分步调整控制器参数。';
      return NextResponse.json({ text: fallback, source: 'fallback' });
    }

    const prompt = `你是控制课程助教。请基于一致性评分给出一句中文评语（40字以内，务实，不空话）。
评分=${score}
目标: 超调<=${target.overshoot}%，调节时间<=${target.settlingTime}s，侧向加速度<=${target.maxLateralAccel}g
结果: 超调=${result.overshoot}%，调节时间=${result.settlingTime}s，侧向加速度=${result.accel}g
子项: overshoot=${overshootPass} settle=${settlePass} accel=${accelPass}
输出要求：
1) 先一句评价（是否一致）。
2) 再给一个下一步建议（只一条）。`;

    const generated = await generateText({
      model: getAIModel(),
      prompt,
      temperature: 0.2,
      maxTokens: 120,
    });

    return NextResponse.json({ text: generated.text.trim(), source: 'llm' });
  } catch (error) {
    console.error('Consistency comment generation failed', error);
    return NextResponse.json(
      { text: '一致性评语暂不可用，请先根据三项指标逐一修正。', source: 'fallback' },
      { status: 200 }
    );
  }
}
