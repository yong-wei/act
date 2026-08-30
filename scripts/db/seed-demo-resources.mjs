import { createPrismaClient } from '../lib/prisma-client.mjs';


const prisma = createPrismaClient();

async function main() {
  console.log('🌱 Seeding Demo Resources...');

  // 1. Get Admin User
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  });

  if (!admin) {
    console.error('❌ Admin user not found. Please run "node scripts/db/seed-admin.mjs" first.');
    process.exit(1);
  }

  // 2. Define Resources
  const resources = [
    {
      title: '第2课：控制系统建模基础 (讲义)',
      description: '介绍微分方程建模的基本概念，包含牛顿定律和基尔霍夫定律的应用。',
      type: 'STATIC_TEXT',
      content: `
# 控制系统建模

## 1. 为什么要建模？
模型是控制的基础——不懂舵机的"脾气"，控制器就只能瞎指挥。

## 2. 机械系统建模
牛顿第二定律在旋转体中的应用：
$$ T = J\\alpha $$

## 3. 电路系统建模
KVL 与动态电路分析。
      `,
      aiHints: '这是本节课的理论基础，重点解释物理公式的含义。'
    },
    {
      title: 'PID 参数整定实训 (仿真)',
      description: '交互式 PID 模拟器，允许学生调节 Kp, Ki, Kd 参数并观察阶跃响应。',
      type: 'SIMULATION_APP',
      registryId: 'sim-pid-v1', // Matches resource-registry.ts
      config: { kp: 1.0, ki: 0.0, kd: 0.0 },
      aiHints: '学生正在进行 PID 调参。如果超调量过大，建议减小 Kp 或增大 Kd。'
    },
    {
      title: '北极航道伦理决策 (沙盘)',
      description: '模拟北极航行中遇到的突发状况，需要在环保与安全之间做出生死抉择。',
      type: 'INTERACTIVE_COMP',
      registryId: 'ethics-arctic-v1',
      config: { scenario: 'arctic_collision' },
      aiHints: '这是一个伦理困境。关注学生的选择倾向（功利主义 vs 义务论）。'
    },
    {
      title: '课后测验：稳定性分析',
      description: '关于 Nyquist 判据的快速选择题。',
      type: 'STATIC_TEXT',
      content: '## 测验\n\n1. Nyquist 曲线包围 (-1, j0) 点的次数决定了什么？',
      aiHints: '这是前测环节。'
    }
  ];

  // 3. Insert Resources
  for (const res of resources) {
    await prisma.teachingResource.create({
      data: {
        title: res.title,
        description: res.description,
        type: res.type, // Will be cast automatically or fail if string doesn't match enum
        content: res.content,
        registryId: res.registryId,
        config: res.config || {},
        aiHints: res.aiHints,
        authorId: admin.id
      }
    });
    console.log(`✅ Created: ${res.title}`);
  }

  console.log('✨ Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
