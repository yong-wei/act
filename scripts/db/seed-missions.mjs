#!/usr/bin/env node
/**
 * 任务/关卡数据种子脚本
 * 运行: node scripts/db/seed-missions.mjs
 * 强制覆盖: node scripts/db/seed-missions.mjs --force
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const missions = [
  {
    title: '初识航向控制',
    description: '学习手动控制舵角，理解船舶的基本转向特性。在平静海面上完成90度转向。',
    difficulty: 'EASY',
    order: 1,
    objectives: [
      '完成90度航向转变',
      '航迹误差不超过500米',
      '了解舵角与转向的关系',
    ],
    seaStateConfig: {
      level: 1,
      waveHeight: 0.3,
      windSpeed: 3,
    },
    unlockCriteria: {},
  },
  {
    title: 'P控制器入门',
    description: '学习比例控制原理，使用纯P控制器完成航向保持任务。观察不同Kp值对响应的影响。',
    difficulty: 'EASY',
    order: 2,
    objectives: [
      '使用P控制器完成航向保持',
      '航迹误差不超过300米',
      '调整Kp参数观察响应变化',
      '理解稳态误差的概念',
    ],
    seaStateConfig: {
      level: 2,
      waveHeight: 0.5,
      windSpeed: 7,
    },
    unlockCriteria: {
      requiredScore: 60,
    },
  },
  {
    title: 'PD控制器进阶',
    description: '加入微分项减少超调，学习如何平衡响应速度与稳定性。',
    difficulty: 'MEDIUM',
    order: 3,
    objectives: [
      '使用PD控制器完成任务',
      '航迹误差不超过200米',
      '超调量控制在20%以内',
      '理解Kd参数的作用',
    ],
    seaStateConfig: {
      level: 2,
      waveHeight: 0.5,
      windSpeed: 7,
    },
    unlockCriteria: {
      requiredScore: 65,
    },
  },
  {
    title: 'PID控制器精通',
    description: '完整的PID控制器调参，消除稳态误差，实现高精度航向控制。',
    difficulty: 'MEDIUM',
    order: 4,
    objectives: [
      '使用完整PID控制器',
      '航迹误差不超过100米',
      '稳态误差趋近于零',
      '舵角速度符合CCS规范',
    ],
    seaStateConfig: {
      level: 3,
      waveHeight: 1.0,
      windSpeed: 12,
    },
    unlockCriteria: {
      requiredScore: 70,
    },
  },
  {
    title: '海况挑战：中浪',
    description: '在3级海况下完成航向控制任务，测试控制器的鲁棒性。',
    difficulty: 'HARD',
    order: 5,
    objectives: [
      '在3级海况下完成任务',
      '航迹误差不超过150米',
      '保持舵机在安全范围内',
      '不触发伦理熔断',
    ],
    seaStateConfig: {
      level: 3,
      waveHeight: 1.0,
      windSpeed: 12,
    },
    unlockCriteria: {
      requiredScore: 70,
    },
  },
  {
    title: '海况挑战：大浪',
    description: '在4级海况下完成航向控制任务，需要精心调整参数以应对强干扰。',
    difficulty: 'HARD',
    order: 6,
    objectives: [
      '在4级海况下完成任务',
      '航迹误差不超过200米',
      '舵角速度不超过5°/s',
      '横摇角度不超过15度',
    ],
    seaStateConfig: {
      level: 4,
      waveHeight: 2.0,
      windSpeed: 20,
    },
    unlockCriteria: {
      requiredScore: 75,
    },
  },
  {
    title: '综合评估：专家认证',
    description: '在5级海况下完成复杂航向变化任务，这是对您控制能力的终极考验。',
    difficulty: 'EXPERT',
    order: 7,
    objectives: [
      '在5级海况下完成任务',
      '完成多次航向变化',
      '平均误差不超过150米',
      '全程符合CCS安全规范',
      '获得AI总工的认证',
    ],
    seaStateConfig: {
      level: 5,
      waveHeight: 3.5,
      windSpeed: 30,
    },
    unlockCriteria: {
      requiredScore: 80,
    },
  },
];

async function main() {
  console.log('🚀 开始导入任务数据...\n');

  // 检查现有任务
  const existingCount = await prisma.mission.count();
  if (existingCount > 0) {
    console.log(`⚠️ 发现 ${existingCount} 个现有任务`);
    if (!process.argv.includes('--force')) {
      console.log('使用 --force 参数覆盖现有数据');
      console.log('跳过导入');
      return;
    }
    await prisma.userProgress.deleteMany({});
    await prisma.mission.deleteMany({});
    console.log('已清除现有数据\n');
  }

  // 创建任务
  const createdMissions = [];

  for (const mission of missions) {
    const created = await prisma.mission.create({
      data: {
        title: mission.title,
        description: mission.description,
        difficulty: mission.difficulty,
        order: mission.order,
        objectives: mission.objectives,
        seaStateConfig: mission.seaStateConfig,
        unlockCriteria: mission.unlockCriteria,
      },
    });
    createdMissions.push(created);
    console.log(`✅ 创建任务: ${created.title} (${created.difficulty})`);
  }

  // 更新解锁条件中的任务ID引用
  for (let i = 1; i < createdMissions.length; i++) {
    const mission = createdMissions[i];
    const prevMission = createdMissions[i - 1];

    await prisma.mission.update({
      where: { id: mission.id },
      data: {
        unlockCriteria: {
          requiredMissionId: prevMission.id,
          requiredScore: missions[i].unlockCriteria.requiredScore || 60,
        },
      },
    });
  }
  console.log('\n🔗 已设置任务解锁链关系');

  console.log(`\n✨ 任务数据导入完成！共创建 ${createdMissions.length} 个任务`);
}

main()
  .catch((e) => {
    console.error('❌ 导入失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
