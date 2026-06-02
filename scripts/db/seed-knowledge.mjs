import { createPrismaClient } from '../lib/prisma-client.mjs';


const prisma = createPrismaClient();

// Data extracted from lesson-knowledge-cards.ts
const LESSON_02_CARDS = [
  {
    id: 'concept-modeling-intro',
    name: '为什么需要建模？',
    nodeType: 'THEORY',
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
    applications: ['舵机控制', '电机调速', '温度控制', '航向控制'],
    prerequisites: [],
    relatedTopics: ['concept-newton-law-application', 'concept-kirchhoff-law'],
  },
  {
    id: 'concept-newton-law-application',
    name: '牛顿定律在旋转体中的应用',
    nodeType: 'THEORY',
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
    applications: ['舵机系统', '机械臂', '飞轮储能', '陀螺仪'],
    prerequisites: ['concept-modeling-intro'],
    relatedTopics: ['concept-linearization', 'concept-kirchhoff-law'],
  },
  {
    id: 'concept-kirchhoff-law',
    name: 'KVL与动态电路',
    nodeType: 'THEORY',
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
    applications: ['电机电枢回路', 'RLC滤波器', '电力电子', '信号处理'],
    prerequisites: ['concept-modeling-intro'],
    relatedTopics: ['concept-newton-law-application'],
  },
  {
    id: 'concept-linearization',
    name: '非线性线性化',
    nodeType: 'THEORY',
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
    applications: ['倒立摆', '导弹发射架', '悬挂系统', '机器人关节'],
    prerequisites: ['concept-newton-law-application'],
    relatedTopics: ['concept-kirchhoff-law'],
  },
];

const attachmentMap = {
  'concept-modeling-intro': ['content/concepts/modeling-intro.mdx'],
  'concept-newton-law-application': ['content/concepts/newton-laws.mdx'],
  'concept-kirchhoff-law': ['content/concepts/kvl-dynamic-circuit.mdx'],
  'concept-linearization': ['content/concepts/linearization.mdx'],
};

const LESSON_02_CARD_LINKS = [
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
    targetId: '1', // Needs '1' to exist in DB
    relation: '建模基础',
  },
  {
    id: 'lk6',
    sourceId: 'concept-kirchhoff-law',
    targetId: '3', // Needs '3' to exist in DB
    relation: '电路应用',
  },
];

// Placeholder for existing graph nodes to prevent FK errors if they don't exist
const BASIC_NODES = [
    {
      id: '1',
      name: '传递函数',
      nodeType: 'THEORY',
      description: '系统在 s 域中的输入输出关系表达式。',
      bloomLevel: 'UNDERSTAND',
      knowledgeDim: 'CONCEPTUAL',
      resources: ['content/concepts/transfer-function.mdx'],
    },
    {
      id: '3',
      name: 'PID控制器',
      nodeType: 'THEORY',
      description: '经典闭环控制器，由比例、积分、微分三部分组成。',
      bloomLevel: 'APPLY',
      knowledgeDim: 'PROCEDURAL',
      resources: ['content/concepts/pid-controller.mdx'],
    },
];

async function main() {
  console.log('🌱 Starting knowledge seeding...');

  // 0. Ensure basic nodes exist
  for (const node of BASIC_NODES) {
      await prisma.knowledgeNode.upsert({
          where: { id: node.id },
          update: {
            name: node.name,
            nodeType: node.nodeType,
            description: node.description,
            bloomLevel: node.bloomLevel,
            knowledgeDim: node.knowledgeDim,
            resources: node.resources ?? [],
          },
          create: {
            id: node.id,
            name: node.name,
            nodeType: node.nodeType,
            description: node.description,
            bloomLevel: node.bloomLevel,
            knowledgeDim: node.knowledgeDim,
            positionX: 0,
            positionY: 0,
            positionZ: 0,
            metadata: {},
            resources: node.resources ?? [],
            tags: [],
            isActive: true
          }
      });
  }

  // 1. Seed Nodes
  for (const card of LESSON_02_CARDS) {
    console.log(`Processing node: ${card.name}`);
    
    // Construct standardized metadata
    const metadata = {
      type: 'rich-text',
      content: card.explanation, 
      learningObjectives: [], 
      formulas: {
        continuous: card.formulaContinuous,
        discrete: card.formulaDiscrete
      },
      applications: card.applications,
      lessonId: card.lessonId,
      phase: card.phase
    };

    const attachmentPaths = attachmentMap[card.id] || [];
    const relatedLinks = card.relatedTopics.map(topic => ({
      type: 'internal-link',
      targetId: topic,
      label: 'Related Topic'
    }));
    const resources = [...attachmentPaths, ...relatedLinks];

    await prisma.knowledgeNode.upsert({
      where: { id: card.id },
      update: {
        name: card.name,
        nodeType: card.nodeType, // Ensure type match
        description: card.description,
        bloomLevel: card.bloomLevel,
        knowledgeDim: card.knowledgeDim, 
        positionX: card.positionX,
        positionY: card.positionY,
        positionZ: card.positionZ,
        metadata: metadata,
        resources: resources,
        tags: ['lesson-02', card.phase],
        isActive: true
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
        metadata: metadata,
        resources: resources,
        tags: ['lesson-02', card.phase],
        isActive: true
      }
    });
  }

  // 2. Seed Links
  for (const link of LESSON_02_CARD_LINKS) {
    console.log(`Processing link: ${link.sourceId} -> ${link.targetId}`);
    
    // Check if both nodes exist (to avoid FK errors if target is missing)
    const sourceExists = await prisma.knowledgeNode.findUnique({ where: { id: link.sourceId } });
    const targetExists = await prisma.knowledgeNode.findUnique({ where: { id: link.targetId } });

    if (sourceExists && targetExists) {
        await prisma.knowledgeLink.upsert({
            where: {
                sourceId_targetId: {
                    sourceId: link.sourceId,
                    targetId: link.targetId
                }
            },
            update: {
                relation: link.relation
            },
            create: {
                sourceId: link.sourceId,
                targetId: link.targetId,
                relation: link.relation
            }
        });
    } else {
        console.warn(`Skipping link ${link.id}: Source or Target node missing.`);
    }
  }

  console.log('✅ Knowledge seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
