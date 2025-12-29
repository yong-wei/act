/**
 * AI 客户端配置
 *
 * 使用硅基流动 (SiliconFlow) API 服务
 * 模型：Qwen/Qwen3-Omni-30B-A3B-Thinking
 */

import { createOpenAI } from '@ai-sdk/openai';

// 硅基流动 API 客户端（OpenAI 兼容）
export const siliconflow = createOpenAI({
  baseURL: process.env.SILICONFLOW_API_URL || 'https://api.siliconflow.cn/v1',
  apiKey: process.env.SILICONFLOW_API_KEY || '',
  compatibility: 'compatible', // 使用 OpenAI 兼容模式
});

// 默认模型
export const DEFAULT_MODEL = process.env.SILICONFLOW_MODEL || 'Qwen/Qwen3-Omni-30B-A3B-Thinking';

// 获取 AI 模型实例
export function getAIModel(modelId?: string) {
  return siliconflow(modelId || DEFAULT_MODEL);
}

// 系统提示词 - 虚拟总工程师
export const SYSTEM_PROMPT = `你是由中船重工指派的虚拟总工程师，专门负责船舶自动控制系统的教学与审核工作。

你的身份和职责：
1. 作为船舶控制领域的资深专家，你拥有查看仿真器状态和修改参数的权限
2. 你需要根据中国船级社(CCS)规范审核学生的控制系统设计
3. 你要帮助学生理解PID控制原理、诺莫托船舶模型等专业知识
4. 当学生的设计存在安全隐患时，你必须指出并要求整改

你可以使用的工具：
- get_simulation_status: 获取当前仿真器的参数状态
- set_simulation_params: 修改PID参数或环境配置（需学生确认）
- analyze_result: 分析仿真结果并给出专业点评

交互风格：
- 使用专业但易懂的语言，适合工程类学生
- 对于安全问题要严肃对待，给出具体的数值分析
- 鼓励学生思考和尝试，但要指出明显的错误
- 引用相关规范（如CCS规范、IMO要求）增加权威性

回答格式：
- 简洁明了，重点突出
- 涉及数值时给出具体数据
- 必要时使用Markdown格式组织内容`;

// 用于分析仿真结果的提示词模板
export const ANALYSIS_PROMPT_TEMPLATE = `请分析以下船舶航向控制仿真结果：

## 仿真参数
- 控制模式: {controlMode}
- PID参数: Kp={kp}, Ki={ki}, Kd={kd}
- 诺莫托模型: K={nomotoK}, T={nomotoT}

## 仿真指标
- 平均航迹误差: {avgError} 米
- 最大舵角速度: {maxRudderRate} °/s
- 仿真时长: {duration} 秒

## 要求
1. 评估控制性能是否达标（航迹误差是否小于200米）
2. 分析是否存在过调或震荡问题
3. 根据CCS规范评估是否存在安全隐患
4. 给出具体的参数调整建议`;
