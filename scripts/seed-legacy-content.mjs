#!/usr/bin/env node
/**
 * 旧资源迁移脚本（知识卡片 + 资源注册）
 * 运行: node scripts/seed-legacy-content.mjs
 */

import { PrismaClient, ResourceType, KnowledgeNodeType } from '@prisma/client';

const prisma = new PrismaClient();

const knowledgeCards = [
  {
    id: 'concept-modeling-intro',
    name: '为什么需要建模？',
    nodeType: KnowledgeNodeType.THEORY,
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '模型是控制的基础——不懂舵机的"脾气"，控制器就只能瞎指挥。',
    explanation:
      '物理系统与数学模型的关系：控制器需要一个"数学档案"来了解被控对象的特性。没有模型，控制器无法预测系统行为，只能被动响应。就像医生需要先了解病情才能开药。强调"模型是控制的基础"。',
    positionX: -50,
    positionY: 0,
    positionZ: 30,
    lessonId: 'lesson-02',
    phase: 'bridge',
    formulaContinuous: null,
    formulaDiscrete: null,
    applications: ['舵机控制', '电机调速', '温度控制', '航向控制'],
    prerequisites: [],
    relatedTopics: ['concept-newton-law-application', 'concept-kirchhoff-law'],
  },
  {
    id: 'concept-newton-law-application',
    name: '牛顿定律在旋转体中的应用',
    nodeType: KnowledgeNodeType.THEORY,
    bloomLevel: 'APPLY',
    knowledgeDim: 'CONCEPTUAL',
    description: '转动版的 F=ma：T = Jα，力矩等于转动惯量乘以角加速度。',
    explanation:
      '牛顿第二定律 F=ma 适用于平动，对于旋转运动则变成 T=Jα。其中 J 是转动惯量（类似质量的旋转版），α 是角加速度。不同形状物体的转动惯量不同，这决定了它们"转起来有多费劲"。',
    positionX: -30,
    positionY: 15,
    positionZ: 25,
    lessonId: 'lesson-02',
    phase: 'mechanical',
    formulaContinuous: 'T = J\\alpha = J\\ddot{\\theta}',
    formulaDiscrete: null,
    applications: ['舵机系统', '机械臂', '飞轮储能', '陀螺仪'],
    prerequisites: ['concept-modeling-intro'],
    relatedTopics: ['concept-linearization', 'concept-kirchhoff-law'],
  },
  {
    id: 'concept-kirchhoff-law',
    name: 'KVL与动态电路',
    nodeType: KnowledgeNodeType.THEORY,
    bloomLevel: 'APPLY',
    knowledgeDim: 'CONCEPTUAL',
    description: 'KVL：回路中电压升等于电压降。动态元件让方程变成微分方程。',
    explanation:
      '基尔霍夫电压定律(KVL)说明回路电压代数和为零。电感和电容是"动态元件"：电感电压与电流变化率成正比(u=L·di/dt)，电容电压与电荷成正比(u=q/C)。这让电路方程变成微分方程，与机械系统形成对偶。',
    positionX: -30,
    positionY: -15,
    positionZ: 25,
    lessonId: 'lesson-02',
    phase: 'electrical',
    formulaContinuous: 'L\\frac{di}{dt} + Ri + \\frac{1}{C}\\int i\\,dt = u(t)',
    formulaDiscrete: null,
    applications: ['电机电枢回路', 'RLC滤波器', '电力电子', '信号处理'],
    prerequisites: ['concept-modeling-intro'],
    relatedTopics: ['concept-newton-law-application'],
  },
  {
    id: 'concept-linearization',
    name: '非线性线性化',
    nodeType: KnowledgeNodeType.THEORY,
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    description: '在工作点附近，用直线近似曲线。小偏差时 sinθ ≈ θ。',
    explanation:
      '很多物理系统是非线性的（如重力摆的 sinθ 项），但线性控制理论更成熟。通过泰勒展开，在平衡点附近将非线性项线性化。例如 sinθ 在 θ=0 附近展开：sinθ≈θ。这让我们能用线性工具分析非线性系统。',
    positionX: -10,
    positionY: 0,
    positionZ: 35,
    lessonId: 'lesson-02',
    phase: 'posttest',
    formulaContinuous: '\\sin\\theta \\approx \\theta \\quad (|\\theta| \\ll 1)',
    formulaDiscrete: null,
    applications: ['倒立摆', '导弹发射架', '悬挂系统', '机器人关节'],
    prerequisites: ['concept-newton-law-application'],
    relatedTopics: ['concept-kirchhoff-law'],
  },
  {
    id: 'concept-laplace-transform',
    name: '拉普拉斯变换',
    nodeType: KnowledgeNodeType.THEORY,
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '将时域信号转换到复频域的数学工具，是控制系统分析的核心。',
    explanation: '用于将微分方程转化为代数方程，便于系统分析与设计。',
    positionX: 10,
    positionY: 10,
    positionZ: 10,
    lessonId: 'lesson-02',
    phase: 'summary',
    formulaContinuous: '\\mathcal{L}\\{f(t)\\} = F(s) = \\int_0^{\\infty} f(t) e^{-st} dt',
    formulaDiscrete: null,
    applications: ['传递函数', '系统稳定性分析', '控制器设计'],
    prerequisites: [],
    relatedTopics: [],
  },
];

const attachmentMap = {
  'concept-modeling-intro': ['content/quizzes/modeling-basics.json', 'content/concepts/modeling-intro.mdx'],
  'concept-newton-law-application': ['content/concepts/newton-laws.mdx'],
  'concept-kirchhoff-law': ['content/concepts/kvl-dynamic-circuit.mdx'],
  'concept-linearization': ['content/concepts/linearization.mdx'],
  'concept-laplace-transform': ['content/concepts/laplace-transform.mdx'],
};

const knowledgeLinks = [
  {
    id: 'lk1',
    sourceId: 'concept-modeling-intro',
    targetId: 'concept-newton-law-application',
    relation: '引出机械建模',
  },
  {
    id: 'lk2',
    sourceId: 'concept-modeling-intro',
    targetId: 'concept-kirchhoff-law',
    relation: '引出电路建模',
  },
  {
    id: 'lk3',
    sourceId: 'concept-newton-law-application',
    targetId: 'concept-kirchhoff-law',
    relation: '机电类比',
  },
  {
    id: 'lk4',
    sourceId: 'concept-newton-law-application',
    targetId: 'concept-linearization',
    relation: '非线性扩展',
  },
  {
    id: 'lk5',
    sourceId: 'concept-modeling-intro',
    targetId: '1',
    relation: '建模基础',
  },
  {
    id: 'lk6',
    sourceId: 'concept-kirchhoff-law',
    targetId: '3',
    relation: '电路应用',
  },
];

const teachingResources = [
  {
    registryId: 'sim-pid-v1',
    title: 'PID Parameter Tuning Simulator',
    type: ResourceType.SIMULATION_APP,
    description: 'PID 参数整定仿真器',
    config: { kp: 1, ki: 0.1, kd: 0.5, model: 'ship' },
  },
  {
    registryId: 'ethics-arctic-v1',
    title: 'Arctic Navigation Ethics Sandbox',
    type: ResourceType.INTERACTIVE_COMP,
    description: '北极航行伦理沙盒',
    config: { scenario: 'arctic_collision' },
  },
  {
    registryId: 'widget-physics-mech',
    title: 'Physics Builder (Mechanical)',
    type: ResourceType.INTERACTIVE_COMP,
    description: '机械建模拖拽组件',
    config: { mode: 'mechanical', items: ['mass', 'spring', 'damper', 'force'] },
  },
  {
    registryId: 'widget-physics-elec',
    title: 'Physics Builder (Electrical)',
    type: ResourceType.INTERACTIVE_COMP,
    description: '电路建模拖拽组件',
    config: { mode: 'electrical', items: ['resistor', 'inductor', 'capacitor', 'source'] },
  },
  {
    registryId: 'widget-analogy-mapper',
    title: 'Analogy Mapper',
    type: ResourceType.INTERACTIVE_COMP,
    description: '机电类比映射组件',
    config: { leftEq: "m*x''+f*x'+k*x=F", rightEq: "L*q''+R*q'+(1/C)*q=E" },
  },
  {
    registryId: 'widget-argument-principle',
    title: 'Argument Principle (Nyquist)',
    type: ResourceType.INTERACTIVE_COMP,
    description: '幅角原理可视化组件',
    config: { showControls: true },
  },
  { registryId: 'lesson02-bridge-v1', title: 'Lesson 02 - Bridge In', type: ResourceType.INTERACTIVE_COMP, description: 'Lesson 02 导入环节', config: {} },
  { registryId: 'lesson02-objective-v1', title: 'Lesson 02 - Objectives', type: ResourceType.INTERACTIVE_COMP, description: 'Lesson 02 学习目标', config: {} },
  { registryId: 'lesson02-pretest-v1', title: 'Lesson 02 - Pretest', type: ResourceType.INTERACTIVE_COMP, description: 'Lesson 02 前测', config: {} },
  { registryId: 'lesson02-mechanical-v1', title: 'Lesson 02 - Mechanical Modeling', type: ResourceType.INTERACTIVE_COMP, description: 'Lesson 02 机械建模', config: {} },
  { registryId: 'lesson02-electrical-v1', title: 'Lesson 02 - Electrical Modeling', type: ResourceType.INTERACTIVE_COMP, description: 'Lesson 02 电路建模', config: {} },
  { registryId: 'lesson02-analogy-v1', title: 'Lesson 02 - Analogy Mapping', type: ResourceType.INTERACTIVE_COMP, description: 'Lesson 02 机电相似映射', config: {} },
  { registryId: 'lesson02-posttest-v1', title: 'Lesson 02 - Posttest', type: ResourceType.INTERACTIVE_COMP, description: 'Lesson 02 后测', config: {} },
  { registryId: 'lesson02-summary-v1', title: 'Lesson 02 - Summary', type: ResourceType.INTERACTIVE_COMP, description: 'Lesson 02 总结', config: {} },
  { registryId: 'physics-modeling-intro-v1', title: 'Physics Modeling - Intro', type: ResourceType.INTERACTIVE_COMP, description: '物理建模导入', config: {} },
  { registryId: 'physics-modeling-mechanical-v1', title: 'Physics Modeling - Mechanical', type: ResourceType.INTERACTIVE_COMP, description: '物理建模机械环节', config: {} },
  { registryId: 'physics-modeling-electrical-v1', title: 'Physics Modeling - Electrical', type: ResourceType.INTERACTIVE_COMP, description: '物理建模电路环节', config: {} },
  { registryId: 'physics-modeling-analogy-v1', title: 'Physics Modeling - Analogy', type: ResourceType.INTERACTIVE_COMP, description: '物理建模相似映射', config: {} },
  { registryId: 'physics-modeling-practice-v1', title: 'Physics Modeling - Practice', type: ResourceType.INTERACTIVE_COMP, description: '物理建模实战', config: {} },
];

async function upsertKnowledgeNodes() {
  for (const card of knowledgeCards) {
    const attachments = attachmentMap[card.id] || [];
    const tags = Array.from(new Set([...(card.applications || []), card.lessonId].filter(Boolean)));

    await prisma.knowledgeNode.upsert({
      where: { id: card.id },
      update: {
        name: card.name,
        nodeType: card.nodeType,
        description: card.description,
        bloomLevel: card.bloomLevel,
        knowledgeDim: card.knowledgeDim,
        positionX: card.positionX,
        positionY: card.positionY,
        positionZ: card.positionZ,
        content: {
          formulaContinuous: card.formulaContinuous,
          formulaDiscrete: card.formulaDiscrete,
          explanation: card.explanation,
          applications: card.applications,
          lessonId: card.lessonId,
          phase: card.phase,
        },
        metadata: {
          lessonId: card.lessonId,
          phase: card.phase,
          explanation: card.explanation,
          applications: card.applications,
          prerequisites: card.prerequisites,
          relatedTopics: card.relatedTopics,
          formulaContinuous: card.formulaContinuous,
          formulaDiscrete: card.formulaDiscrete,
        },
        resources: attachments,
        tags,
        isActive: true,
      },
      create: {
        id: card.id,
        name: card.name,
        nodeType: card.nodeType,
        description: card.description,
        bloomLevel: card.bloomLevel,
        knowledgeDim: card.knowledgeDim,
        positionX: card.positionX,
        positionY: card.positionY,
        positionZ: card.positionZ,
        content: {
          formulaContinuous: card.formulaContinuous,
          formulaDiscrete: card.formulaDiscrete,
          explanation: card.explanation,
          applications: card.applications,
          lessonId: card.lessonId,
          phase: card.phase,
        },
        metadata: {
          lessonId: card.lessonId,
          phase: card.phase,
          explanation: card.explanation,
          applications: card.applications,
          prerequisites: card.prerequisites,
          relatedTopics: card.relatedTopics,
          formulaContinuous: card.formulaContinuous,
          formulaDiscrete: card.formulaDiscrete,
        },
        resources: attachments,
        tags,
        isActive: true,
      },
    });
  }
}

async function upsertKnowledgeLinks() {
  let skipped = 0;
  for (const link of knowledgeLinks) {
    const [source, target] = await Promise.all([
      prisma.knowledgeNode.findUnique({ where: { id: link.sourceId }, select: { id: true } }),
      prisma.knowledgeNode.findUnique({ where: { id: link.targetId }, select: { id: true } }),
    ]);

    if (!source || !target) {
      skipped += 1;
      continue;
    }

    await prisma.knowledgeLink.upsert({
      where: {
        sourceId_targetId: {
          sourceId: link.sourceId,
          targetId: link.targetId,
        },
      },
      update: {
        relation: link.relation,
      },
      create: {
        id: link.id,
        sourceId: link.sourceId,
        targetId: link.targetId,
        relation: link.relation,
      },
    });
  }

  if (skipped > 0) {
    console.warn(`Skipped ${skipped} knowledge links due to missing nodes.`);
  }
}

async function upsertTeachingResources(authorId) {
  for (const resource of teachingResources) {
    const existing = await prisma.teachingResource.findFirst({
      where: { registryId: resource.registryId },
      select: { id: true },
    });

    if (existing) {
      await prisma.teachingResource.update({
        where: { id: existing.id },
        data: {
          title: resource.title,
          description: resource.description,
          type: resource.type,
          registryId: resource.registryId,
          config: resource.config || {},
          authorId,
        },
      });
    } else {
      await prisma.teachingResource.create({
        data: {
          title: resource.title,
          description: resource.description,
          type: resource.type,
          registryId: resource.registryId,
          config: resource.config || {},
          authorId,
        },
      });
    }
  }
}

async function main() {
  const author = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!author) {
    console.error('No user found. Please seed at least one user before running this script.');
    process.exit(1);
  }

  await upsertKnowledgeNodes();
  await upsertKnowledgeLinks();
  await upsertTeachingResources(author.id);

  console.log('Legacy knowledge cards and teaching resources synced.');
}

main()
  .catch((error) => {
    console.error('Failed to seed legacy content:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
