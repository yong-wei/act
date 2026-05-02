/**
 * AI 方程建模检查 API
 *
 * 使用 Siliconflow API 服务检查学生的微分方程建模
 */

import { getAIModel } from '@/lib/ai-client';
import { generateText } from 'ai';

export const runtime = 'nodejs';
export const maxDuration = 180;

interface CheckModelingRequest {
  equation: string;
  scenario: string;
  targetEquation: string;
}

// 场景配置
const SCENARIO_CONFIGS: Record<string, {
  name: string;
  description: string;
  requiredTerms: string[];
  hints: Record<string, string>;
}> = {
  'missile-launcher': {
    name: '导弹发射架俯仰系统',
    description: '舰载导弹发射架绕水平轴旋转的俯仰运动',
    requiredTerms: ['J', 'theta', 'f', 'mgl', 'sin', 'T'],
    hints: {
      'missing-inertia': '缺少惯性项 J·θ̈',
      'missing-damping': '缺少阻尼项 f·θ̇',
      'missing-gravity': '地球引力去哪了？重力会产生力矩 mgl·sinθ',
      'linearization': '如果写了 sinθ，可以考虑小偏差线性化：sinθ ≈ θ',
    },
  },
  'rudder': {
    name: '舵机系统',
    description: '052D驱逐舰电液伺服舵机',
    requiredTerms: ['m', 'x', 'f', 'k', 'F'],
    hints: {
      'missing-inertia': '缺少惯性项 m·ẍ',
      'missing-damping': '缺少阻尼项 f·ẋ（海水阻力）',
      'missing-spring': '缺少弹性项 k·x（液压刚度）',
    },
  },
  'rlc-circuit': {
    name: 'RLC 电路',
    description: '直流电机电枢回路',
    requiredTerms: ['L', 'R', 'C', 'i', 'u'],
    hints: {
      'missing-inductor': '缺少电感项 L·di/dt',
      'missing-resistor': '缺少电阻项 R·i',
      'missing-capacitor': '缺少电容项 (1/C)∫i·dt',
    },
  },
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckModelingRequest;
    const { equation, scenario, targetEquation } = body;

    if (!equation || !scenario) {
      return new Response(
        JSON.stringify({ error: '缺少必要参数' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 检查 API Key 配置
    if (!process.env.SILICONFLOW_API_KEY) {
      return new Response(
        JSON.stringify({
          error: 'AI 服务未配置',
          feedback: '抱歉，AI 服务暂时不可用。',
          isCorrect: false,
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const scenarioConfig = SCENARIO_CONFIGS[scenario];
    if (!scenarioConfig) {
      return new Response(
        JSON.stringify({ error: '未知场景' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 构建系统提示
    const systemPrompt = `你是自动控制原理的总工程师，负责审核学生的方程建模。

场景：${scenarioConfig.name}
描述：${scenarioConfig.description}
标准答案：${targetEquation}

学生的答案是：${equation}

判断规则：
1. 检查是否包含所有必要项（惯性项、阻尼项、弹性项/重力项）
2. 检查是否考虑了非线性项（如重力矩 mgl·sinθ）
3. 检查符号是否正确（正负号、导数阶次）
4. 不要求格式完全一致，只要物理意义正确即可

如果学生的答案：
- 完全正确或基本正确（只有细微格式差异）：明确说"正确"，给予鼓励
- 漏掉了重力矩项：提示"地球引力去哪了？"
- 写了 sinθ 但没有线性化：提示"如何线性化？"
- 有其他错误：指出具体问题但不直接给答案，引导学生思考

使用专业但易懂的语言，不超过100字。`;

    // 调用 AI 模型
    const result = await generateText({
      model: getAIModel(),
      system: systemPrompt,
      prompt: `请审核学生的方程：${equation}`,
      temperature: 0.3,
      maxTokens: 200,
    });

    const feedback = result.text || '无法获取反馈';

    // 简单判断是否正确
    const isCorrect =
      feedback.includes('正确') ||
      feedback.includes('很好') ||
      feedback.includes('完全正确') ||
      feedback.includes('基本正确');

    return new Response(
      JSON.stringify({
        feedback,
        isCorrect,
        scenario: scenarioConfig.name,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('AI Check Modeling API 错误:', error);
    return new Response(
      JSON.stringify({
        error: '服务器错误',
        feedback: '抱歉，AI 助教暂时无法响应。请稍后再试。',
        isCorrect: false,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
