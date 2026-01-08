/**
 * 十滴水游戏 - 关卡数据（飞行水滴版）
 *
 * 游戏机制：水滴爆炸后沿方向飞行
 * - 空格子：水滴穿过
 * - 有水滴的格子：水滴停下并累加
 * - 边界：水滴消失
 *
 * 关卡设计考虑：
 * - 空格子形成"通道"，水滴可以远程传递
 * - 有水滴的格子是"阻挡点"，会捕获飞行的水滴
 * - 需要利用连锁反应的传播特性
 */

import type { LevelConfig } from '../types';

export const LEVELS: LevelConfig[] = [
  // ===== 教程关卡 =====
  {
    id: 'tutorial-1',
    name: '认识飞行水滴',
    description: '水滴爆炸后会沿方向飞行，穿过空格子，遇到有水滴的格子才会停下。',
    gridSize: { rows: 3, cols: 3 },
    initialDrops: 3,
    difficulty: 'tutorial',
    // 空心布局：角落有水滴，中间是空的
    initialBoard: [
      [1, 0, 1],
      [0, 0, 0],
      [1, 0, 1],
    ],
    educationalHint:
      '水滴像信号一样传播——空格子是"透明介质"，有水滴的格子是"接收器"。这类似于波的传播特性。',
  },
  {
    id: 'tutorial-2',
    name: '阻挡与穿透',
    description: '中间的水滴快满了，角落的也是。试试点击中间，看看会发生什么。注意观察水滴如何穿过空白区域。',
    gridSize: { rows: 4, cols: 4 },
    initialDrops: 6,
    difficulty: 'tutorial',
    // 调整后的布局：中间易爆，角落易爆
    initialBoard: [
      [2, 0, 0, 2],
      [0, 3, 3, 0],
      [0, 3, 3, 0],
      [2, 0, 0, 2],
    ],
    educationalHint:
      '有水滴的格子像"阻抗匹配点"——它们会吸收飞来的能量。设计控制系统时，阻抗匹配是信号传输的关键。',
  },

  // ===== 简单关卡 =====
  {
    id: 'level-3',
    name: '十字通道',
    description: '利用十字形的空白通道，让水滴飞向目标位置。',
    gridSize: { rows: 5, cols: 5 },
    initialDrops: 5,
    difficulty: 'easy',
    initialBoard: [
      [1, 0, 1, 0, 1],
      [0, 0, 0, 0, 0],
      [1, 0, 1, 0, 1],
      [0, 0, 0, 0, 0],
      [1, 0, 1, 0, 1],
    ],
    educationalHint:
      '这个棋盘展示了"网格拓扑"——信号可以沿着通道传播。类似于控制网络中的信息流动路径。',
  },
  {
    id: 'level-4',
    name: '边缘防线',
    description: '边缘的水滴形成防线，需要找到突破口。',
    gridSize: { rows: 5, cols: 5 },
    initialDrops: 6,
    difficulty: 'easy',
    initialBoard: [
      [0, 1, 1, 1, 0],
      [1, 0, 0, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 0, 0, 1],
      [0, 1, 1, 1, 0],
    ],
    educationalHint:
      '边界条件决定了系统的稳定性。当边缘都被"激活"时，系统处于高能状态，一触即发。',
  },

  // ===== 中等关卡 =====
  {
    id: 'level-5',
    name: '对角线传播',
    description: '水滴只能直线飞行，但你可以利用中间的接力点实现对角线效果。',
    gridSize: { rows: 5, cols: 5 },
    initialDrops: 6,
    difficulty: 'medium',
    initialBoard: [
      [1, 0, 0, 0, 0],
      [0, 1, 0, 0, 0],
      [0, 0, 2, 0, 0],
      [0, 0, 0, 1, 0],
      [0, 0, 0, 0, 1],
    ],
    educationalHint:
      '虽然信号只能直线传播，但通过中继节点可以实现复杂路径。这是网络控制和多跳通信的基本原理。',
  },
  {
    id: 'level-6',
    name: '临界矩阵',
    description: '大部分格子都接近满载，选择正确的触发点至关重要。',
    gridSize: { rows: 4, cols: 4 },
    initialDrops: 4,
    difficulty: 'medium',
    initialBoard: [
      [1, 2, 2, 1],
      [2, 2, 2, 2],
      [2, 2, 2, 2],
      [1, 2, 2, 1],
    ],
    educationalHint:
      '当系统处于临界状态时，输入的位置比输入的大小更重要。这是"分岔控制"的核心——在正确的点施加正确的力。',
  },

  // ===== 困难关卡 =====
  {
    id: 'level-7',
    name: '隧道迷宫',
    description: '复杂的通道网络，水滴会飞向意想不到的地方。',
    gridSize: { rows: 6, cols: 6 },
    initialDrops: 8,
    difficulty: 'hard',
    initialBoard: [
      [1, 0, 1, 0, 1, 0],
      [0, 0, 0, 0, 0, 1],
      [1, 0, 1, 0, 1, 0],
      [0, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 1, 0],
      [0, 1, 0, 1, 0, 1],
    ],
    educationalHint:
      '复杂网络中的信号传播难以预测。这就是为什么大型控制系统需要仿真和分析——直觉往往不可靠。',
  },
  {
    id: 'level-8',
    name: '链式反应',
    description: '设计一个触发点，让连锁反应自动清空整个棋盘。',
    gridSize: { rows: 5, cols: 5 },
    initialDrops: 3,
    difficulty: 'hard',
    initialBoard: [
      [1, 1, 0, 1, 1],
      [1, 0, 0, 0, 1],
      [0, 0, 1, 0, 0],
      [1, 0, 0, 0, 1],
      [1, 1, 0, 1, 1],
    ],
    educationalHint:
      '一个精心设计的输入可以触发一系列自动反应。这是"前馈控制"的思想——预测系统行为并设计最优输入。',
  },

  // ===== 专家关卡 =====
  {
    id: 'level-9',
    name: '螺旋清除',
    description: '从外向内的螺旋布局，需要找到正确的清除顺序。',
    gridSize: { rows: 6, cols: 6 },
    initialDrops: 10,
    difficulty: 'expert',
    initialBoard: [
      [1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 0, 1],
      [1, 0, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1],
    ],
    educationalHint:
      '嵌套结构需要从内到外或从外到内的策略。这类似于多层控制架构——高层控制影响低层，反之亦然。',
  },
  {
    id: 'level-10',
    name: '终极挑战',
    description: '密集布局，极少的步数。你能找到最优解吗？',
    gridSize: { rows: 6, cols: 6 },
    initialDrops: 6,
    difficulty: 'expert',
    initialBoard: [
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 0, 0, 1, 1],
      [1, 1, 0, 0, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
    ],
    educationalHint:
      '恭喜挑战成功！你已经掌握了信号传播、级联效应、临界控制等核心概念。这些知识在船舶自动驾驶、电网控制、通信网络中都有重要应用。',
  },
];

/**
 * 根据ID获取关卡配置
 */
export function getLevelById(id: string): LevelConfig | undefined {
  return LEVELS.find((level) => level.id === id);
}

/**
 * 获取下一关配置
 */
export function getNextLevel(currentId: string): LevelConfig | undefined {
  const currentIndex = LEVELS.findIndex((level) => level.id === currentId);
  if (currentIndex >= 0 && currentIndex < LEVELS.length - 1) {
    return LEVELS[currentIndex + 1];
  }
  return undefined;
}

/**
 * 获取关卡索引
 */
export function getLevelIndex(id: string): number {
  return LEVELS.findIndex((level) => level.id === id);
}
