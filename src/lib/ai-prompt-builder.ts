/**
 * 控灵提示词构建器
 *
 * 根据页面上下文和用户画像构建动态系统提示词
 */

import type { AIContext, PageContext, UserProfile, LearningStyle, KnowledgeType, PromptBuilderOptions } from '@/types/ai-context';
import { KONLING_BRAND } from './ai-branding';

/**
 * 构建控灵系统提示词
 *
 * 简化版：只保留课程主题和学生画像，移除预设角色设定
 */
export function buildKonlingSystemPrompt(context: AIContext, options: PromptBuilderOptions = {}): string {
  const { page, user } = context;
  const { wordLimit = 150, enableLatex = true } = options;

  const sections: string[] = [];

  // 基础角色声明
  sections.push(`你是AI-OBE平台的智能学习助手「${KONLING_BRAND.name}」。`);

  // 当前课程信息
  sections.push(buildCourseSection(page));

  // 学生画像
  sections.push(buildUserProfileSection(user));

  // 回答格式要求
  sections.push(buildFormatRequirements(wordLimit, enableLatex));

  return sections.filter(Boolean).join('\n\n');
}

/**
 * 构建课程信息部分
 */
function buildCourseSection(page: PageContext): string {
  const lines: string[] = [];

  lines.push(`**当前课程**: ${page.courseTitle} (${page.courseId})`);
  lines.push(`**页面类型**: ${getPageTypeLabel(page.pageType)}`);
  lines.push(`**当前主题**: ${page.topic}`);

  if (page.learningObjectives?.length) {
    lines.push(`**学习目标**:`);
    page.learningObjectives.forEach((obj, i) => {
      lines.push(`${i + 1}. ${obj}`);
    });
  }

  if (page.stage) {
    lines.push(`**BOPPPS阶段**: ${getBopppsStageLabel(page.stage)}`);
  }

  if (page.knowledgeType) {
    lines.push(`**知识类型**: ${getKnowledgeTypeLabel(page.knowledgeType)}`);
  }

  return lines.join('\n');
}

/**
 * 构建用户画像部分
 */
function buildUserProfileSection(user: UserProfile): string {
  const lines: string[] = [];

  lines.push(`**学生画像**:`);
  lines.push(`- 姓名: ${user.name}`);
  lines.push(`- 学习风格: ${getLearningStyleLabel(user.learningStyle)}`);
  lines.push(`- 认知水平: L${user.cognitiveLevel}`);

  if (user.fleetGroup) {
    lines.push(`- 所属舰队: ${user.fleetGroup}`);
  }

  if (user.abilityVector) {
    lines.push(`- 能力特点: ${describeAbilityVector(user.abilityVector)}`);
  }

  return lines.join('\n');
}

/**
 * 构建格式要求
 */
function buildFormatRequirements(wordLimit: number, enableLatex: boolean): string {
  const lines: string[] = [];

  lines.push(`**回答格式**:`);
  lines.push(`- 回答控制在${wordLimit}字以内，除非学生要求详细说明`);
  lines.push(`- 使用Markdown格式组织内容`);
  lines.push(`- 关键概念用**粗体**标注`);

  if (enableLatex) {
    lines.push(`- **公式必须使用LaTeX格式**：行内公式用$...$，块级公式用$$...$$`);
    lines.push(`- 例如：二阶系统传递函数写作 $G(s)=\frac{\omega_n^2}{s^2+2\zeta\omega_ns+\omega_n^2}$`);
  }

  lines.push(`- 适当使用emoji增加亲和力，但不过度`);
  lines.push(`- 对于复杂问题，可以分点说明`);
  lines.push(`- 结尾可以提出一个启发性问题，引导学生深入思考`);

  return lines.join('\n');
}

/**
 * 获取页面类型标签
 */
function getPageTypeLabel(pageType: string): string {
  const labels: Record<string, string> = {
    theory: '理论学习',
    practice: '实践操作',
    quiz: '测验评估',
    reflection: '反思总结',
    workspace: '工作空间',
    summary: '课程总结',
  };
  return labels[pageType] || pageType;
}

/**
 * 获取BOPPPS阶段标签
 */
function getBopppsStageLabel(stage: string): string {
  const labels: Record<string, string> = {
    BRIDGE_IN: '导入 (Bridge-in)',
    OBJECTIVE: '学习目标 (Objective)',
    PRE_ASSESSMENT: '前测 (Pre-assessment)',
    PARTICIPATORY: '参与式学习 (Participatory)',
    POST_ASSESSMENT: '后测 (Post-assessment)',
    SUMMARY: '总结 (Summary)',
  };
  return labels[stage] || stage;
}

/**
 * 获取知识类型标签
 */
function getKnowledgeTypeLabel(type: KnowledgeType): string {
  const labels: Record<KnowledgeType, string> = {
    C: '概念性知识 (Conceptual)',
    X: '程序性知识 (Procedural)',
    D: '元认知知识 (Metacognitive)',
  };
  return labels[type] || type;
}

/**
 * 获取学习风格标签
 */
function getLearningStyleLabel(style: LearningStyle): string {
  const labels: Record<LearningStyle, string> = {
    VISUAL: '视觉型 (Visual)',
    TEXTUAL: '文本型 (Textual)',
    INTERACTIVE: '互动型 (Interactive)',
    AUDITORY: '听觉型 (Auditory)',
    LOGICAL: '逻辑型 (Logical)',
  };
  return labels[style] || style;
}

/**
 * 描述能力向量
 */
function describeAbilityVector(vector: { computational?: number; crossDomain?: number; design?: number; analysis?: number; evaluation?: number }): string {
  const abilities: string[] = [];

  if (vector.computational && vector.computational > 0.6) abilities.push('计算能力强');
  if (vector.crossDomain && vector.crossDomain > 0.6) abilities.push('跨域迁移能力强');
  if (vector.design && vector.design > 0.6) abilities.push('设计能力强');
  if (vector.analysis && vector.analysis > 0.6) abilities.push('分析能力强');
  if (vector.evaluation && vector.evaluation > 0.6) abilities.push('评价能力强');

  if (abilities.length === 0) {
    return '综合能力均衡发展';
  }

  return abilities.join('，');
}

/**
 * 构建简化版提示词（用于快速响应）
 */
export function buildSimpleSystemPrompt(context: AIContext): string {
  const { page, user } = context;

  return `你是「${KONLING_BRAND.name}」，AI-OBE平台的智能学习助手。

当前课程: ${page.courseTitle}
主题: ${page.topic}
学习目标: ${page.learningObjectives?.slice(0, 2).join('、') || '掌握核心概念'}

学生: ${user.name}，${getLearningStyleLabel(user.learningStyle)}，L${user.cognitiveLevel}水平

回答控制在150字内。`;
}
