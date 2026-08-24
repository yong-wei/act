import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import optionAttributionSource from '../../course-content/runtime/resource-governance/micro-tutoring-option-attributions-v2.json';
import { getRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import { MICRO_TUTORING_LEARNING_ACTION_VERSION } from '@/features/assessment/micro-tutoring-learning-actions';
import {
  MICRO_TUTORING_RESOURCE_PROJECTION_SOURCE,
  MICRO_TUTORING_RESOURCE_PROJECTION_VERSION,
  loadMicroTutoringResourceProjection,
  microTutoringResourceRelationSourceRef,
  microTutoringResourceRevision,
} from '@/features/assessment/micro-tutoring-resource-registry';

const OUTPUT_PATH = path.join(
  process.cwd(),
  'course-content/runtime/resource-governance/micro-tutoring-resource-projection.json',
);

type ActionType =
  | 'reading-explanation'
  | 'contrast-discrimination'
  | 'model-operation'
  | 'self-explanation'
  | 'retrieval-practice';

interface NodeResourcePlan {
  registryId: string;
  actionType: ActionType;
  learningObjective: string;
  studentInstruction: string;
  completionCondition: string;
  estimatedMinutes: number;
}

const NODE_RESOURCES: Record<string, NodeResourcePlan> = {
  'kn:autocontrol:feedback-loop': {
    registryId: 'lesson01-feedback-precheck-v1',
    actionType: 'retrieval-practice',
    learningObjective: '判断反馈回路中比较点、前向通道和扰动通道的结构关系。',
    studentInstruction: '完成反馈结构前测，针对刚才选错的结构关系写出一条可核对的纠正说明。',
    completionCondition: '提交前测作答，并在微辅导中记录该资源动作完成。',
    estimatedMinutes: 6,
  },
  'kn:autocontrol:transfer-function-model': {
    registryId: 'lesson04-transfer-precheck',
    actionType: 'retrieval-practice',
    learningObjective: '用零初值传递函数关系描述输入输出，而不是用随意初值或纯增益代替模型。',
    studentInstruction: '完成传递函数前测，标出你选错选项所遗漏的变量、初值或测量通道。',
    completionCondition: '提交前测作答，并记录传递函数建模动作完成。',
    estimatedMinutes: 6,
  },
  'kn:autocontrol:time-domain-performance': {
    registryId: 'lesson06-metric-quick-check',
    actionType: 'retrieval-practice',
    learningObjective: '用超调、调节时间和稳态误差等可计算指标比较时域响应。',
    studentInstruction: '完成时域指标速判，指出刚才错因把哪一个指标误用成了另一个。',
    completionCondition: '提交速判作答，并记录指标提取动作完成。',
    estimatedMinutes: 6,
  },
  'kn:autocontrol:frequency-response': {
    registryId: 'lesson12-frequency-precheck',
    actionType: 'retrieval-practice',
    learningObjective: '从 Bode/频域曲线读取斜率、带宽和相位信息，而不是把图形当插图。',
    studentInstruction: '完成频率响应速判，标出刚才错因跳过的幅频或相频判读步骤。',
    completionCondition: '提交速判作答，并记录频域判读动作完成。',
    estimatedMinutes: 6,
  },
  'kn:autocontrol:stability-margin': {
    registryId: 'lesson14-margin-quick-check',
    actionType: 'retrieval-practice',
    learningObjective: '同时使用幅值裕度和相位裕度判断稳定边界，而不是用单一时域观感代替。',
    studentInstruction: '完成稳定裕度速判，写出刚才错因忽略的那一项裕度或其工程含义。',
    completionCondition: '提交速判作答，并记录裕度判读动作完成。',
    estimatedMinutes: 6,
  },
  'kn:autocontrol:root-locus': {
    registryId: 'lesson10-static-conditions',
    actionType: 'self-explanation',
    learningObjective: '用开环零极点的模值/相角条件解释根轨迹区段，而不是用输入或超调代替几何规则。',
    studentInstruction: '阅读根轨迹模值与相角条件，用一句话说明刚才错因违反了哪一条绘制规则。',
    completionCondition: '写出针对该错因的规则对照说明，并记录自我解释动作完成。',
    estimatedMinutes: 6,
  },
  'kn:autocontrol:controller-correction': {
    registryId: 'lesson15-series-precheck',
    actionType: 'retrieval-practice',
    learningObjective: '按超前/滞后职责选择串联校正，并复核动态、裕度和执行器代价。',
    studentInstruction: '完成串联校正前测，指出刚才错因用单一指标或照搬参数所跳过的校正步骤。',
    completionCondition: '提交前测作答，并记录校正选择动作完成。',
    estimatedMinutes: 6,
  },
  'kn:autocontrol:simulation-validation': {
    registryId: 'lesson11-graphical-thinking-workshop',
    actionType: 'model-operation',
    learningObjective: '把仿真或图形化结果与运行条件、差异记录和可重复证据联系起来。',
    studentInstruction: '在图形化验证工作坊中完成一个有记录的对照步骤，说明刚才错因缺少哪类仿真证据。',
    completionCondition: '提交对照结果，并记录仿真验证动作完成。',
    estimatedMinutes: 6,
  },
  'kn:autocontrol:modern-transfer': {
    registryId: 'sim-scene-destroyer',
    actionType: 'model-operation',
    learningObjective: '把控制器方案迁移到船舶对象时保留扰动、任务指标和证据边界。',
    studentInstruction: '打开驱逐舰航向控制仿真，针对刚才的任务错因核对一项对象约束或扰动条件。',
    completionCondition: '完成一次有对象条件的仿真核验，并记录迁移动作完成。',
    estimatedMinutes: 6,
  },
};

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

async function main() {
  const entriesByNode = new Map<string, {
    plan: NodeResourcePlan;
    relations: Array<{ misconceptionTag: string; rationale: string }>;
  }>();
  for (const attribution of optionAttributionSource.entries) {
    const plan = NODE_RESOURCES[attribution.knowledgeNodeId];
    if (!plan) {
      throw new Error(`No micro-tutoring resource plan for ${attribution.knowledgeNodeId}`);
    }
    const current = entriesByNode.get(attribution.knowledgeNodeId) ?? { plan, relations: [] };
    if (!current.relations.some((relation) => relation.misconceptionTag === attribution.misconceptionTag)) {
      current.relations.push({
        misconceptionTag: attribution.misconceptionTag,
        rationale: `复用已登记资源 ${plan.registryId} 的 ${plan.estimatedMinutes} 分钟${plan.actionType}动作，覆盖选项审核确认的错因：${attribution.evidenceSummary}`,
      });
    }
    entriesByNode.set(attribution.knowledgeNodeId, current);
  }

  const entries = [...entriesByNode.entries()].map(([knowledgeNodeId, { plan, relations }]) => {
    const metadata = getRegisteredResourceMetadata(plan.registryId);
    if (!metadata) {
      throw new Error(`Unknown registryId ${plan.registryId}`);
    }
    const launchTarget = metadata.launchTarget ?? metadata.renderTarget ?? `/interactive-learning/resources/${plan.registryId}`;
    const sortedRelations = [...relations].sort((left, right) =>
      left.misconceptionTag.localeCompare(right.misconceptionTag));
    return {
      id: `micro-tutoring-resource:${plan.registryId}`,
      registryId: plan.registryId,
      teachingResourceRef: `registry:${plan.registryId}`,
      resourceRevision: microTutoringResourceRevision({
        registryId: plan.registryId,
        knowledgeNodeId,
        launchTarget,
      }),
      knowledgeNodeId,
      launchTarget,
      estimatedMinutes: plan.estimatedMinutes,
      privacyLevel: 'student-visible',
      enabled: true,
      action: {
        id: `micro-tutoring-action:${plan.registryId}`,
        version: MICRO_TUTORING_LEARNING_ACTION_VERSION,
        type: plan.actionType,
        learningObjective: plan.learningObjective,
        studentInstruction: plan.studentInstruction,
        completionCondition: plan.completionCondition,
        estimatedMinutes: plan.estimatedMinutes,
      },
      relations: sortedRelations,
      sourceRefs: uniqueSorted(sortedRelations.map((relation) => microTutoringResourceRelationSourceRef({
        knowledgeNodeId,
        misconceptionTag: relation.misconceptionTag,
      }))),
    };
  }).sort((left, right) => left.knowledgeNodeId.localeCompare(right.knowledgeNodeId));

  const projection = {
    version: MICRO_TUTORING_RESOURCE_PROJECTION_VERSION,
    source: MICRO_TUTORING_RESOURCE_PROJECTION_SOURCE,
    actionVersion: MICRO_TUTORING_LEARNING_ACTION_VERSION,
    entries,
  };
  const loaded = loadMicroTutoringResourceProjection(projection, optionAttributionSource);
  if (loaded.issues.length > 0 || !loaded.projection) {
    throw new Error(`Generated resource projection is invalid: ${JSON.stringify(loaded.issues, null, 2)}`);
  }
  await writeFile(OUTPUT_PATH, `${JSON.stringify(projection, null, 2)}\n`);
  console.log(JSON.stringify({
    output: OUTPUT_PATH,
    resources: projection.entries.length,
    relations: projection.entries.reduce((count, entry) => count + entry.relations.length, 0),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
