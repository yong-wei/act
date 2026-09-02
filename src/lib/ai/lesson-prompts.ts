/**
 * 教学场景提示词：控灵助手 fallback 系统提示、BOPPPS 阶段上下文与角色配置。
 * 动态提示词构建见 @/lib/ai-prompt-builder。
 */

// 系统提示词 - AI-OBE平台智能学习助手「控灵」
// 此为fallback提示词，推荐使用 ai-prompt-builder.ts 构建动态提示词
export const SYSTEM_PROMPT = `你是AI-OBE平台的智能学习助手「控灵」。

你的职责：
1. 协助学生理解自动控制原理等课程内容
2. 回答学生关于课程概念、公式、方法的问题
3. 引导学生独立思考，而不是直接给出答案

你可以使用的工具：
- get_simulation_status: 获取当前仿真器的参数状态
- set_simulation_params: 修改仿真参数（需学生确认）
- analyze_result: 分析仿真结果并给出专业点评

回答格式：
- 公式使用LaTeX格式（$...$ 或 $$...$$）
- 使用Markdown格式组织内容
- 简洁明了，控制在150字以内，除非学生要求详细说明`;

// BOPPPS 阶段教学上下文提示
const BOPPPS_STAGE_HINTS: Record<string, string> = {
  BRIDGE_IN: '【导入阶段】学生正在观看引导内容。你的角色是激发兴趣，帮助学生建立与先验知识的联系。',
  OBJECTIVE: '【目标阶段】学生正在了解学习目标。帮助学生明确本节课要掌握的核心概念和能力。',
  PRE_ASSESSMENT: '【前测阶段】学生正在完成前测。这是诊断性评估，帮助学生了解自己的起点水平。',
  PARTICIPATORY: '【参与式学习阶段】学生正在进行交互式学习或仿真操作。积极引导学生思考，鼓励尝试，及时纠正错误。',
  POST_ASSESSMENT: '【后测阶段】学生正在完成后测。帮助学生检验学习成果，总结收获。',
  SUMMARY: '【总结阶段】课程即将结束。帮助学生回顾要点，建立知识体系。',
  interactive: '【互动学习】学生正在操作互动课程资源。回答必须引用同一会话中此前相关问答，并保持在当前资源边界内。进度和完成状态只是学习辅导上下文，不是官方成绩、掌握度、LearningFact 或学习画像。',
};

// AI 角色配置
const AI_PERSONA_PROMPTS: Record<string, string> = {
  tutor: '你是一位耐心的导师，专注于帮助学生理解概念，使用引导式提问促进思考。',
  critic: '你是一位严格的审核员，专注于发现问题和安全隐患，给出专业的改进建议。',
  analyst: '你是一位数据分析师，专注于分析仿真数据，提供量化的评估报告。'
};

// 课程上下文接口
export interface LessonContext {
  stage?: string;
  resourceTitle?: string;
  aiPersona?: 'tutor' | 'critic' | 'analyst';
  customPrompt?: string;
}

// 构建上下文感知的系统提示
export function buildContextAwarePrompt(
  basePrompt: string,
  lessonContext?: LessonContext
): string {
  if (!lessonContext) return basePrompt;

  const parts: string[] = [basePrompt];

  // 添加 BOPPPS 阶段上下文
  if (lessonContext.stage && BOPPPS_STAGE_HINTS[lessonContext.stage]) {
    parts.push('\n## 当前教学上下文');
    parts.push(BOPPPS_STAGE_HINTS[lessonContext.stage]);
  }

  // 添加 AI 角色提示（枚举查表；legacy lessonContext 的 resourceTitle/
  // customPrompt 是客户端自由文本，不得成为系统级指令，#1885）。
  if (lessonContext.aiPersona && AI_PERSONA_PROMPTS[lessonContext.aiPersona]) {
    parts.push(`\n## 角色定位\n${AI_PERSONA_PROMPTS[lessonContext.aiPersona]}`);
  }

  return parts.join('\n');
}

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
