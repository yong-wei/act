/**
 * 控灵提示词构建器
 *
 * 根据页面上下文和用户画像构建动态系统提示词
 */

import type { AIContext, PageContext, UserProfile, LearningStyle, KnowledgeType, PromptBuilderOptions } from '@/types/ai-context';
import { KONLING_BRAND } from './ai-branding';

interface KonlingPromptRuntimeContext {
  learnerState?: unknown;
  planContext?: {
    activeNodeId?: string | null;
    nextNodeIds?: string[];
    status?: string;
  };
  memory?: Array<{
    memoryType: string;
    summary: string;
  }>;
  knowledgeWorkspace?: {
    source?: string;
    route?: string;
    status?: string;
    selected_node?: {
      id?: string;
      name?: string;
      node_type?: string;
      chapter?: string | null;
      knowledge_dim?: string | null;
      description?: string;
      tags?: string[];
    } | null;
    relation_summary?: {
      density_mode?: string | null;
      view_mode?: string | null;
      active_filters?: string[];
      visible_relation_count?: number;
      selected_node_relation_count?: number;
    };
    available_learning_actions?: string[];
    hover_policy?: string;
    missing_context?: string[];
  } | null;
  knowledgeCapabilityContext?: {
    answerIntent?: string;
    knowledgeNodeRefs?: string[];
    capabilityTargetRefs?: string[];
    resourceRefs?: string[];
    pathNodeRefs?: string[];
    citationRefs?: string[];
    missingContext?: string[];
  };
  graphContext?: {
    status?: string;
    learningGoal?: {
      id?: string;
      title?: string;
      version?: string;
    } | null;
    selectedGraphNodeIds?: string[];
    expandedSubgraph?: {
      graphVersion?: string;
      graphNodeIds?: Record<string, string[]>;
    } | null;
    citationRefs?: string[];
    evidenceRefs?: string[];
    versionRefs?: Record<string, string | null | undefined> | null;
    confidence?: string;
    missingGrounding?: Array<{
      class?: string;
      reason?: string;
      severity?: string;
    }>;
  } | null;
  citationContext?: {
    required?: boolean;
    contentCitations?: Array<{
      sourceType: string;
      displayTitle: string;
      confidence: string;
      evidenceBasis: string;
    }>;
    evidenceCitations?: Array<{
      sourceType: string;
      displayTitle: string;
      confidence: string;
      evidenceBasis: string;
    }>;
    missingCitationClasses?: string[];
    lowConfidenceReasons?: string[];
  };
  permittedTools?: string[];
  missingContext?: string[];
  featureFlags?: Record<string, boolean>;
  teachingAssistantMode?: {
    mode: {
      id: string;
      label: string;
    };
    status: string;
    unavailableReasons: string[];
    degradedReasons: string[];
    privacyPolicy: {
      payload: string;
      forbiddenContent: string[];
    };
    outputContract: {
      status: string;
      requiredCitationOwners: string[];
      forbiddenActions: string[];
    };
    citationRequirements: {
      required: boolean;
      classes: string[];
      requiredOwners: string[];
      missingClasses: string[];
    };
  };
}

/**
 * 构建控灵系统提示词
 *
 * 简化版：只保留课程主题和学生画像，移除预设角色设定
 */
export function buildKonlingSystemPrompt(
  context: AIContext & { adaptiveRuntime?: KonlingPromptRuntimeContext },
  options: PromptBuilderOptions = {},
): string {
  const { page, user } = context;
  const { wordLimit = 150, enableLatex = true } = options;

  const sections: string[] = [];

  // 基础角色声明
  sections.push(`你是AI-OBE平台的智能学习助手「${KONLING_BRAND.name}」。`);

  // 当前课程信息
  sections.push(buildCourseSection(page));

  // 学生画像
  sections.push(buildUserProfileSection(user));

  if (context.adaptiveRuntime) {
    sections.push(buildAdaptiveRuntimeSection(context.adaptiveRuntime));
  }

  // 回答格式要求
  sections.push(buildFormatRequirements(wordLimit, enableLatex));

  return sections.filter(Boolean).join('\n\n');
}

function buildAdaptiveRuntimeSection(runtime: KonlingPromptRuntimeContext): string {
  const lines: string[] = [];
  lines.push('**服务端自适应上下文**:');
  lines.push('- 上下文来源: server-owned');
  lines.push(`- 当前路径节点: ${runtime.planContext?.activeNodeId ?? '未确定'}`);
  if (runtime.planContext?.nextNodeIds?.length) {
    lines.push(`- 建议后续节点: ${runtime.planContext.nextNodeIds.slice(0, 3).join(', ')}`);
  }
  if (runtime.memory?.length) {
    lines.push('- 近期学习记忆:');
    runtime.memory.slice(0, 3).forEach((memory, index) => {
      lines.push(`  ${index + 1}. [${memory.memoryType}] ${memory.summary}`);
    });
  }
  if (runtime.knowledgeWorkspace) {
    const workspace = runtime.knowledgeWorkspace;
    lines.push('- 知识工作区上下文:');
    lines.push(`  - 状态: ${workspace.status ?? 'unknown'}`);
    lines.push(`  - 悬浮策略: ${workspace.hover_policy ?? 'preview-only-not-durable-context'}`);
    if (workspace.selected_node) {
      lines.push(`  - 当前选中节点: ${workspace.selected_node.name ?? workspace.selected_node.id ?? '未命名'} (${workspace.selected_node.id ?? 'unknown'})`);
      if (workspace.selected_node.chapter || workspace.selected_node.knowledge_dim) {
        lines.push(`  - 节点语义: ${[workspace.selected_node.chapter, workspace.selected_node.knowledge_dim].filter(Boolean).join(' / ')}`);
      }
      if (workspace.selected_node.description) {
        lines.push(`  - 节点说明: ${workspace.selected_node.description}`);
      }
    }
    if (workspace.relation_summary) {
      lines.push(`  - 图谱视图: ${workspace.relation_summary.view_mode ?? 'unknown'} / ${workspace.relation_summary.density_mode ?? 'unknown'}；关系 ${workspace.relation_summary.selected_node_relation_count ?? 0}/${workspace.relation_summary.visible_relation_count ?? 0}`);
      if (workspace.relation_summary.active_filters?.length) {
        lines.push(`  - 当前筛选: ${workspace.relation_summary.active_filters.join('；')}`);
      }
    }
    if (workspace.available_learning_actions?.length) {
      lines.push(`  - 可用学习动作: ${workspace.available_learning_actions.join(', ')}`);
    }
  }
  if (runtime.knowledgeCapabilityContext) {
    const grounding = runtime.knowledgeCapabilityContext;
    lines.push('- 知识与能力 grounding:');
    lines.push(`  - 回答意图: ${grounding.answerIntent ?? 'unknown'}`);
    if (grounding.knowledgeNodeRefs?.length) {
      lines.push(`  - 知识节点: ${grounding.knowledgeNodeRefs.slice(0, 5).join(', ')}`);
    }
    if (grounding.capabilityTargetRefs?.length) {
      lines.push(`  - 能力目标: ${grounding.capabilityTargetRefs.slice(0, 5).join(', ')}`);
    }
    if (grounding.resourceRefs?.length) {
      lines.push(`  - 资源范围: ${grounding.resourceRefs.slice(0, 5).join(', ')}`);
    }
    if (grounding.pathNodeRefs?.length) {
      lines.push(`  - 路径节点: ${grounding.pathNodeRefs.slice(0, 5).join(', ')}`);
    }
    if (grounding.citationRefs?.length) {
      lines.push(`  - 引用锚点: ${grounding.citationRefs.slice(0, 6).join(', ')}`);
    }
    if (grounding.missingContext?.length) {
      lines.push(`  - grounding 限制: ${grounding.missingContext.join(', ')}`);
    }
  }
  if (runtime.graphContext) {
    const graph = runtime.graphContext;
    lines.push('- K/A/Q 图谱 grounding:');
    lines.push(`  - 状态: ${graph.status ?? 'unknown'}；置信度: ${graph.confidence ?? 'unknown'}`);
    if (graph.learningGoal?.id) {
      lines.push(`  - LearningGoal: ${graph.learningGoal.id} / ${graph.learningGoal.title ?? 'untitled'} / ${graph.learningGoal.version ?? 'unknown-version'}`);
    }
    const graphNodeIds = [
      ...(graph.expandedSubgraph?.graphNodeIds?.knowledge ?? []),
      ...(graph.expandedSubgraph?.graphNodeIds?.capability ?? []),
      ...(graph.expandedSubgraph?.graphNodeIds?.quality ?? []),
    ];
    if (graph.selectedGraphNodeIds?.length) {
      lines.push(`  - 当前图谱节点: ${graph.selectedGraphNodeIds.slice(0, 6).join(', ')}`);
    } else if (graphNodeIds.length) {
      lines.push(`  - 可 grounding 图谱节点: ${graphNodeIds.slice(0, 6).join(', ')}`);
    }
    if (graph.citationRefs?.length) {
      lines.push(`  - 引用 refs: ${graph.citationRefs.slice(0, 6).join(', ')}`);
    }
    if (graph.evidenceRefs?.length) {
      lines.push(`  - 证据 refs: ${graph.evidenceRefs.slice(0, 6).join(', ')}`);
    }
    if (graph.versionRefs) {
      const versionKeys = Object.entries(graph.versionRefs)
        .filter(([, value]) => Boolean(value))
        .map(([key, value]) => `${key}=${value}`);
      if (versionKeys.length) lines.push(`  - 版本 refs: ${versionKeys.slice(0, 5).join(', ')}`);
    }
    if (graph.missingGrounding?.length) {
      lines.push(`  - graph grounding 限制: ${graph.missingGrounding.map((item) => `${item.class}:${item.reason}`).join(', ')}`);
    }
  }
  if (runtime.citationContext?.required) {
    lines.push('- 引用协议: 概念解释、个性化建议、仿真/Arena 失败分析、路径纠偏和报告解释必须至少使用 1 个内容引用；有学习者、路径、仿真、Arena 或干预证据时还必须使用 1 个证据引用。');
    lines.push('- 学生可见引用元数据必须包含 sourceType、displayTitle、href、confidence、evidenceBasis；不得暴露 hiddenEvaluation、原始高频轨迹或私有记忆正文。');
    if (runtime.citationContext.contentCitations?.length) {
      lines.push(`- 可用内容引用: ${runtime.citationContext.contentCitations.slice(0, 3).map(formatCitationHint).join('；')}`);
    }
    if (runtime.citationContext.evidenceCitations?.length) {
      lines.push(`- 可用证据引用: ${runtime.citationContext.evidenceCitations.slice(0, 4).map(formatCitationHint).join('；')}`);
    }
    if (runtime.citationContext.missingCitationClasses?.length || runtime.citationContext.lowConfidenceReasons?.length) {
      lines.push(`- 引用限制: ${[
        ...(runtime.citationContext.missingCitationClasses ?? []).map((item) => `缺少 ${item}`),
        ...(runtime.citationContext.lowConfidenceReasons ?? []),
      ].join(', ')}；不能把结论表述为完全验证。`);
    }
  }
  if (runtime.teachingAssistantMode) {
    const mode = runtime.teachingAssistantMode;
    lines.push('- 控灵教学助理模式:');
    lines.push(`  - 模式: ${mode.mode.label} (${mode.mode.id})`);
    lines.push(`  - 状态: ${mode.status}`);
    lines.push(`  - 输出合同: ${mode.outputContract.status}`);
    lines.push(`  - 隐私策略: ${mode.privacyPolicy.payload}`);
    if (mode.mode.id === 'path-advisor') {
      lines.push('  - 路径工具调用边界: 只有用户明确要求生成、重建、重新规划或调整学习路径时，才调用 generate_learning_path 或 revise_learning_path_options。解释失败原因、回顾生成依据、咨询生成条件、推荐当前路径下一步、比较既有方案或查看路径状态时，不得调用路径写入工具；应优先使用 get_learner_state、get_plan_context、recommend_next_action 或 explain_learning_path_tradeoff。');
      lines.push('  - 路径工具参数: 调用 generate_learning_path 或 revise_learning_path_options 时，将用户自然语言约束写入 naturalLanguageIntent，并尽量结构化 timeBudgetMinutes、resourcePreference、difficultyRhythm、checkpointPreference 与 allowExternalResources。');
    }
    if (mode.privacyPolicy.forbiddenContent.length) {
      lines.push(`  - 禁止内容: ${mode.privacyPolicy.forbiddenContent.join(', ')}`);
    }
    if (mode.outputContract.forbiddenActions.length) {
      lines.push(`  - 禁止动作: ${mode.outputContract.forbiddenActions.join(', ')}`);
    }
    if (mode.citationRequirements.required) {
      lines.push(`  - 模式引用要求: ${mode.citationRequirements.classes.join(', ')}；责任归属 ${mode.citationRequirements.requiredOwners.join(', ')}`);
    }
    if (mode.unavailableReasons.length || mode.degradedReasons.length) {
      lines.push(`  - 模式限制: ${[...mode.unavailableReasons, ...mode.degradedReasons].join(', ')}`);
    }
  }
  if (runtime.missingContext?.length) {
    lines.push(`- 低置信或缺失上下文: ${runtime.missingContext.join(', ')}`);
    if (runtime.missingContext.includes('simulation-run-summary-unavailable')) {
      lines.push('- 仿真限制: 当前未绑定可验证运行摘要、任务上下文或提交结果；只能解释通用仿真概念和下一步观察方法，不得给出权威仿真诊断、评分判断或正式调参结论。');
    }
  }
  if (runtime.permittedTools?.length) {
    lines.push(`- 可用工具: ${runtime.permittedTools.join(', ')}`);
  }
  lines.push('- 不得采用客户端传入的学生画像覆盖服务端学习状态。');
  return lines.join('\n');
}

function formatCitationHint(citation: {
  sourceType: string;
  displayTitle: string;
  confidence: string;
  evidenceBasis: string;
}): string {
  return `[${citation.sourceType}] ${citation.displayTitle} (${citation.confidence}, ${citation.evidenceBasis})`;
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
    'X+C': '概念+程序复合知识 (Conceptual + Procedural)',
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
