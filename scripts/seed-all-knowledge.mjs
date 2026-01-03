/**
 * seed-all-knowledge.mjs
 *
 * 统一的知识点种子脚本
 * 将所有 content/concepts/ 下的 MDX 文件关联到数据库中的 KnowledgeNode
 *
 * 运行方式: node scripts/seed-all-knowledge.mjs
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

// ============================================================================
// 知识点定义
// ============================================================================

const KNOWLEDGE_NODES = [
  // Lesson 02: 机理建模（微分方程）
  {
    id: 'node-modeling-intro',
    name: '为什么需要建模',
    filename: 'modeling-intro.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '建模是将物理系统抽象为数学描述的过程，是控制系统设计的基础。',
    position: { x: 10, y: 0, z: 0 },
    tags: ['lesson-02', 'modeling', 'fundamentals']
  },
  {
    id: 'node-newton-laws',
    name: '牛顿定律应用',
    filename: 'newton-laws.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '牛顿力学在旋转体和平移系统中的应用，是机械系统建模的基础。',
    position: { x: 0, y: 20, z: 0 },
    tags: ['lesson-02', 'mechanics', 'newton']
  },
  {
    id: 'node-kvl-circuit',
    name: 'KVL与动态电路',
    filename: 'kvl-dynamic-circuit.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '基尔霍夫电压定律在含有电容、电感的动态电路中的应用。',
    position: { x: 20, y: 20, z: 0 },
    tags: ['lesson-02', 'circuit', 'kvl']
  },
  {
    id: 'node-linearization',
    name: '非线性线性化',
    filename: 'linearization.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '将非线性系统在工作点附近线性化的技术，是经典控制理论的基础。',
    position: { x: 10, y: 30, z: 0 },
    tags: ['lesson-02', 'linearization', 'taylor-series']
  },

  // Lesson 03: 建模（结构化步骤）
  {
    id: 'node-laplace-transform',
    name: '拉普拉斯变换',
    filename: 'laplace-transform.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '将时域微分方程转换为s域代数方程的数学工具。',
    position: { x: 10, y: 10, z: 5 },
    tags: ['lesson-03', 'laplace', 's-domain']
  },
  {
    id: 'node-transfer-function',
    name: '传递函数',
    filename: 'transfer-function.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '描述线性时不变系统输入输出关系的s域表示。',
    position: { x: 20, y: 20, z: 5 },
    tags: ['lesson-03', 'transfer-function', 's-domain']
  },

  // Lesson 05: PID 控制
  {
    id: 'node-pid-controller',
    name: 'PID控制器',
    filename: 'pid-controller.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '最广泛应用的反馈控制器：比例-积分-微分控制。',
    position: { x: 30, y: 30, z: 10 },
    tags: ['lesson-05', 'pid', 'controller']
  },

  // Lesson 13: 豪华邮轮舒适度控制（已有，更新 resources）
  {
    id: 'node-iso-2631',
    name: 'ISO 2631 舒适度标准',
    filename: 'iso-2631.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '国际标准化组织制定的关于人体承受全身振动评价的标准。',
    position: { x: 0, y: 0, z: 15 },
    tags: ['lesson-13', 'iso', 'comfort']
  },
  {
    id: 'node-fin-stabilizer',
    name: '主动减摇鳍',
    filename: 'fin-stabilizer.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'REMEMBER',
    knowledgeDim: 'FACTUAL',
    description: '安装在船体两侧的翼状装置，通过改变攻角产生升力。',
    position: { x: 10, y: 0, z: 15 },
    tags: ['lesson-13', 'fin-stabilizer', 'ship']
  },
  {
    id: 'node-comfort-index',
    name: '舒适度指数',
    filename: 'comfort-index.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '综合考虑加速度、频率和暴露时间的量化指标。',
    position: { x: 0, y: 10, z: 15 },
    tags: ['lesson-13', 'comfort-index', 'vibration']
  },
  {
    id: 'node-roll-damping',
    name: '横摇阻尼',
    filename: 'roll-damping.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    description: '船舶在横摇运动中受到的阻力矩。',
    position: { x: 10, y: 10, z: 15 },
    tags: ['lesson-13', 'roll-damping', 'ship-dynamics']
  },
  {
    id: 'node-trade-off',
    name: '工程折衷',
    filename: 'trade-off.mdx',
    nodeType: 'ETHICS',
    bloomLevel: 'EVALUATE',
    knowledgeDim: 'METACOGNITIVE',
    description: '在相互冲突的工程目标之间进行权衡的决策过程。',
    position: { x: 5, y: 5, z: 20 },
    tags: ['lesson-13', 'ethics', 'trade-off']
  }
];

// ============================================================================
// 知识点关系定义
// ============================================================================

const KNOWLEDGE_LINKS = [
  // Lesson 02 内部关系
  { sourceId: 'node-modeling-intro', targetId: 'node-newton-laws', relation: 'prerequisite' },
  { sourceId: 'node-modeling-intro', targetId: 'node-kvl-circuit', relation: 'prerequisite' },
  { sourceId: 'node-newton-laws', targetId: 'node-linearization', relation: 'follows' },
  { sourceId: 'node-kvl-circuit', targetId: 'node-linearization', relation: 'related' },

  // Lesson 03 关系
  { sourceId: 'node-laplace-transform', targetId: 'node-transfer-function', relation: 'prerequisite' },
  { sourceId: 'node-linearization', targetId: 'node-laplace-transform', relation: 'related' },

  // Lesson 05 关系
  { sourceId: 'node-transfer-function', targetId: 'node-pid-controller', relation: 'prerequisite' },

  // Lesson 13 内部关系
  { sourceId: 'node-roll-damping', targetId: 'node-comfort-index', relation: 'influences' },
  { sourceId: 'node-fin-stabilizer', targetId: 'node-roll-damping', relation: 'implements' },
  { sourceId: 'node-iso-2631', targetId: 'node-comfort-index', relation: 'defines' },
  { sourceId: 'node-trade-off', targetId: 'node-fin-stabilizer', relation: 'governs' },

  // 跨课程关系
  { sourceId: 'node-pid-controller', targetId: 'node-fin-stabilizer', relation: 'related' },
  { sourceId: 'node-transfer-function', targetId: 'node-roll-damping', relation: 'related' }
];

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log('🌱 开始同步所有知识点...\n');

  const contentDir = path.join(process.cwd(), 'content', 'concepts');

  // 1. 同步知识节点
  console.log('📚 同步知识节点...');
  for (const node of KNOWLEDGE_NODES) {
    console.log(`  处理: ${node.name}`);

    // 读取 MDX 文件内容
    const filePath = path.join(contentDir, node.filename);
    let mdxContent = '';
    try {
      mdxContent = await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      console.warn(`  ⚠️ 无法读取文件 ${node.filename}，使用描述作为内容`);
      mdxContent = node.description;
    }

    const metadata = {
      type: 'mdx',
      content: mdxContent,
      lessonId: node.tags.find(t => t.startsWith('lesson-')) || 'general',
    };

    const resources = [
      { path: `content/concepts/${node.filename}`, type: 'mdx' }
    ];

    await prisma.knowledgeNode.upsert({
      where: { id: node.id },
      update: {
        name: node.name,
        nodeType: node.nodeType,
        description: node.description,
        bloomLevel: node.bloomLevel,
        knowledgeDim: node.knowledgeDim,
        positionX: node.position.x,
        positionY: node.position.y,
        positionZ: node.position.z,
        metadata: metadata,
        resources: resources,
        tags: node.tags,
        isActive: true
      },
      create: {
        id: node.id,
        name: node.name,
        nodeType: node.nodeType,
        description: node.description,
        bloomLevel: node.bloomLevel,
        knowledgeDim: node.knowledgeDim,
        positionX: node.position.x,
        positionY: node.position.y,
        positionZ: node.position.z,
        metadata: metadata,
        resources: resources,
        tags: node.tags,
        isActive: true
      }
    });
  }
  console.log(`  ✅ 已同步 ${KNOWLEDGE_NODES.length} 个知识节点\n`);

  // 2. 同步知识关系
  console.log('🔗 同步知识关系...');
  for (const link of KNOWLEDGE_LINKS) {
    console.log(`  处理: ${link.sourceId} → ${link.targetId} (${link.relation})`);

    // 验证源和目标节点存在
    const sourceExists = await prisma.knowledgeNode.findUnique({ where: { id: link.sourceId } });
    const targetExists = await prisma.knowledgeNode.findUnique({ where: { id: link.targetId } });

    if (!sourceExists || !targetExists) {
      console.warn(`  ⚠️ 跳过: 源节点或目标节点不存在`);
      continue;
    }

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
  }
  console.log(`  ✅ 已同步 ${KNOWLEDGE_LINKS.length} 个知识关系\n`);

  // 3. 输出统计信息
  const nodeCount = await prisma.knowledgeNode.count({ where: { isActive: true } });
  const linkCount = await prisma.knowledgeLink.count();
  console.log('📊 统计信息:');
  console.log(`  - 知识节点总数: ${nodeCount}`);
  console.log(`  - 知识关系总数: ${linkCount}`);
  console.log('\n✨ 知识点同步完成!');
}

main()
  .catch((e) => {
    console.error('❌ 同步失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
