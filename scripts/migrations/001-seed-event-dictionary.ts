/**
 * Seed Event Dictionary
 *
 * Populates the EventDictionary table with all known event types.
 */

import { PrismaClient, Prisma } from '@prisma/client';

// Event type metadata from data-governance/event-types.ts
const ALL_EVENTS = [
  // Core events
  {
    eventType: 'answer_submit',
    category: 'assessment',
    priority: 'core',
    description: '学生提交题目答案',
    schema: {
      type: 'object',
      properties: {
        questionId: { type: 'string' },
        answer: { type: 'string' },
        isCorrect: { type: 'boolean' },
        timeSpent: { type: 'number' },
      },
      required: ['questionId', 'answer'],
    },
    competencyMapping: { controlModeling: 0.8, crossDomainTransfer: 0.5 },
  },
  {
    eventType: 'assessment_complete',
    category: 'assessment',
    priority: 'core',
    description: '测评完成，包含总分和分项得分',
    competencyMapping: { controlModeling: 1.0, selfDirectedLearning: 0.3 },
  },
  {
    eventType: 'simulation_finish',
    category: 'simulation',
    priority: 'core',
    description: '仿真任务完成',
    competencyMapping: { parameterDesign: 1.0, engineeringDecision: 0.6, selfDirectedLearning: 0.4 },
  },
  {
    eventType: 'ai_intervention_complete',
    category: 'ai',
    priority: 'core',
    description: 'AI介入完成，记录结果和有效性',
    competencyMapping: { inquiryReflection: 0.7, selfDirectedLearning: 0.5 },
  },
  {
    eventType: 'prompt_assessed',
    category: 'ai',
    priority: 'core',
    description: '提示词被AI评价',
    competencyMapping: { inquiryReflection: 1.0, selfDirectedLearning: 0.3 },
  },
  {
    eventType: 'design_session_complete',
    category: 'design',
    priority: 'core',
    description: '设计会话完成',
    competencyMapping: { controlModeling: 0.8, parameterDesign: 0.8, engineeringDecision: 0.5 },
  },
  {
    eventType: 'ethical_violation',
    category: 'ethics',
    priority: 'core',
    description: '伦理违规事件',
    competencyMapping: { engineeringDecision: -0.8 },
  },
  {
    eventType: 'ethical_resolved',
    category: 'ethics',
    priority: 'core',
    description: '伦理违规已整改',
    competencyMapping: { engineeringDecision: 0.5, selfDirectedLearning: 0.3 },
  },
  // Secondary events
  {
    eventType: 'page_view',
    category: 'navigation',
    priority: 'secondary',
    description: '页面浏览',
  },
  {
    eventType: 'step_enter',
    category: 'navigation',
    priority: 'secondary',
    description: '进入学习步骤',
  },
  {
    eventType: 'step_leave',
    category: 'navigation',
    priority: 'secondary',
    description: '离开学习步骤',
  },
  {
    eventType: 'knowledge_card_open',
    category: 'interaction',
    priority: 'secondary',
    description: '打开知识卡片',
  },
  {
    eventType: 'param_change',
    category: 'interaction',
    priority: 'secondary',
    description: '参数变更（中间状态）',
  },
  {
    eventType: 'hint_request',
    category: 'interaction',
    priority: 'secondary',
    description: '请求提示',
  },
];

const prisma = new PrismaClient();

async function seedEventDictionary() {
  console.log('[Migration] Seeding event dictionary...');

  for (const eventMeta of ALL_EVENTS) {
    await prisma.eventDictionary.upsert({
      where: { eventType: eventMeta.eventType },
      update: {
        category: eventMeta.category,
        priority: eventMeta.priority,
        description: eventMeta.description,
        schema: eventMeta.schema as Prisma.InputJsonValue,
        competencyMapping: eventMeta.competencyMapping as Prisma.InputJsonValue,
      },
      create: {
        eventType: eventMeta.eventType,
        category: eventMeta.category,
        priority: eventMeta.priority,
        description: eventMeta.description,
        schema: eventMeta.schema as Prisma.InputJsonValue,
        competencyMapping: eventMeta.competencyMapping as Prisma.InputJsonValue,
      },
    });

    console.log(`[Migration] Seeded: ${eventMeta.eventType}`);
  }

  console.log('[Migration] Event dictionary seeded successfully');
}

seedEventDictionary()
  .catch((err) => {
    console.error('[Migration] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
