/**
 * 十滴水游戏 - 类型定义
 *
 * 游戏规则：
 * - 网格棋盘，每个格子有容量限制（角落2、边缘3、中心4）
 * - 点击格子增加一滴水
 * - 水滴数达到容量时爆炸，向四周各发射一滴
 * - 连锁反应直到系统稳定
 * - 目标：在限定步数内清空棋盘
 */

// 格子位置
export interface Position {
  row: number;
  col: number;
}

// 爆炸方向
export type Direction = 'up' | 'down' | 'left' | 'right';

// 单个格子状态
export interface CellState {
  drops: number;           // 当前水滴数 (0 到 capacity)
  capacity: number;        // 最大容量 (2-4)
  isExploding: boolean;    // 是否正在爆炸（动画状态）
  isReceiving: boolean;    // 是否正在接收水滴（动画状态）
}

// 游戏棋盘类型
export type GameBoard = CellState[][];

// 游戏状态枚举
export type GameStatus = 'idle' | 'playing' | 'processing' | 'won' | 'lost';

// 关卡难度
export type Difficulty = 'tutorial' | 'easy' | 'medium' | 'hard' | 'expert';

// 关卡配置
export interface LevelConfig {
  id: string;
  name: string;
  description: string;
  gridSize: { rows: number; cols: number };
  initialDrops: number;       // 初始可用水滴数 (原 maxMoves)
  initialBoard?: number[][];  // 初始水滴分布（数字表示水滴数）
  difficulty: Difficulty;
  educationalHint?: string;   // 控制理论教育提示
  unlockCondition?: string;   // 解锁条件（上一关ID）
}

// 游戏状态
export interface GameState {
  board: GameBoard;
  dropsAvailable: number;     // 当前可用水滴数 (原 moves 逻辑反转)
  initialDrops: number;       // 本关初始水滴数 (用于计算得分)
  score: number;              // 得分
  gameStatus: GameStatus;
  chainCount: number;         // 当前连锁深度
  maxChainReached: number;    // 本局最大连锁
  currentLevelId: string | null;
}

// 动画事件类型
export interface AnimationEvent {
  type: 'add' | 'explode' | 'receive' | 'clear';
  position: Position;
  direction?: Direction;
  timestamp: number;
}

// 游戏配置常量
export const GAME_CONFIG = {
  // 容量设置
  CORNER_CAPACITY: 2,
  EDGE_CAPACITY: 3,
  CENTER_CAPACITY: 4,

  // 动画延迟 (ms)
  ANIMATION_DROP_APPEAR: 150,
  ANIMATION_EXPLODE: 200,
  ANIMATION_CHAIN_DELAY: 180,
  ANIMATION_RECEIVE: 120,

  // 得分计算
  BASE_SCORE: 100,
  DROP_BONUS: 50,           // 每剩余一滴水加分 (原步数奖励)
  CHAIN_BONUS: 15,          // 每层连锁加分

  // 奖励配置
  REWARD_CONFIG: {
    MIN_CHAIN_FOR_REWARD: 3, // 至少3级连锁才开始奖励
    REWARD_PER_CHAIN: 1,     // 每级奖励多少水滴 (简化版，或者按公式)
  },

  // 默认网格大小
  DEFAULT_GRID_ROWS: 6,
  DEFAULT_GRID_COLS: 6,
} as const;

// 方向向量映射
export const DIRECTION_VECTORS: Record<Direction, Position> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
};

// 所有方向列表
export const ALL_DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];
