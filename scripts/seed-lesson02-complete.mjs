
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Lesson 02 Complete Resources...');

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('Admin not found');

  const resources = [
    // 1. Bridge-in
    {
      title: 'L02-B-01: 导入视频-舵机失控',
      description: '展示驱逐舰在海浪中舵机失控的画面，引出建模需求。',
      type: 'STATIC_MEDIA',
      content: 'https://example.com/video/destroyer-unstable.mp4',
      aiHints: '这是导入环节。'
    },
    // 2. Objective
    {
      title: 'L02-O-01: 学习目标清单',
      description: '本节课的三大核心目标。',
      type: 'STATIC_TEXT',
      content: '# 学习目标\n1. 识别机械与电路元件特性\n2. 列写微分方程\n3. 理解机电相似性',
      aiHints: '向学生展示清晰的目标。'
    },
    // 3. Pre-assessment
    {
      title: 'L02-P1-01: 前测-物理定律连线',
      description: '快速测试学生对牛顿定律和电磁学的记忆。',
      type: 'STATIC_TEXT', // Could be interactive quiz widget in future
      content: '## 连线题\n将左侧元件与右侧定律连接...', 
      aiHints: '检测基础知识。'
    },
    // 4. Participatory - Mechanical
    {
      title: 'L02-P2-01: 机械建模工坊',
      description: '交互式搭建机械系统（质量块-弹簧-阻尼）。',
      type: 'INTERACTIVE_COMP',
      registryId: 'widget-physics-mech',
      config: { mode: 'mechanical' },
      aiHints: '学生正在搭建机械模型，关注阻尼对系统稳定性的影响。'
    },
    // 4. Participatory - Electrical
    {
      title: 'L02-P2-02: 电路建模工坊',
      description: '交互式搭建 RLC 电路。',
      type: 'INTERACTIVE_COMP',
      registryId: 'widget-physics-elec',
      config: { mode: 'electrical' },
      aiHints: '学生正在搭建电路，提示 KVL 定律的应用。'
    },
    // 4. Participatory - Analogy
    {
      title: 'L02-P2-03: 机电相似性映射',
      description: '拖拽匹配机械参数与电路参数。',
      type: 'INTERACTIVE_COMP',
      registryId: 'widget-analogy-mapper',
      aiHints: '解释为什么质量 m 对应电感 L（都是惯性/储能元件）。'
    },
    // 5. Post-assessment
    {
      title: 'L02-P3-01: 导弹发射架建模挑战',
      description: '应用题：考虑重力矩的倒立摆模型。',
      type: 'STATIC_TEXT',
      content: '## 挑战任务\n为图中的导弹发射架建立方程，注意重力矩的影响。',
      aiHints: '检查学生是否写出了 mgl*sin(theta)。'
    },
    // 6. Summary
    {
      title: 'L02-S-01: 知识回顾',
      description: '本节课核心公式汇总。',
      type: 'STATIC_TEXT',
      content: '# 总结\n二阶系统标准式：$$ T\\ddot{y} + 2\\xi\\dot{y} + y = K u $$',
      aiHints: '总结全课。'
    }
  ];

  for (const res of resources) {
    await prisma.teachingResource.create({
      data: {
        title: res.title,
        description: res.description,
        type: res.type,
        content: res.content,
        registryId: res.registryId,
        config: res.config || {},
        aiHints: res.aiHints,
        authorId: admin.id
      }
    });
    console.log(`✅ Created: ${res.title}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
