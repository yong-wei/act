/**
 * 十滴水游戏 - Zustand 状态管理
 *
 * 管理游戏状态、处理用户交互、协调动画
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  GameState,
  GameBoard,
  Position,
  LevelConfig,
  GameStatus,
} from '../types';
import { GAME_CONFIG } from '../types';
import {
  createEmptyBoard,
  createBoardFromData,
  cloneBoard,
  processAddDrop,
  calculateChainSteps,
  isBoardCleared,
  calculateScore,
  type FlyingDrop,
} from '../utils/game-logic';

interface GameActions {
  // 初始化
  loadLevel: (config: LevelConfig) => void;
  resetLevel: () => void;

  // 游戏操作
  addDrop: (position: Position) => Promise<void>;
  undo: () => void;

  // 状态控制
  setGameStatus: (status: GameStatus) => void;
  setCellExploding: (position: Position, isExploding: boolean) => void;
  setCellReceiving: (position: Position, isReceiving: boolean) => void;
}

interface HistorySnapshot {
  board: GameBoard;
  dropsAvailable: number;
}

interface GameStore extends GameState, GameActions {
  // 历史记录（用于撤销）
  history: HistorySnapshot[];
  // 当前关卡配置
  currentLevelConfig: LevelConfig | null;
  // 飞行中的水滴（用于动画）
  activeFlyingDrops: FlyingDrop[];
}

const initialState: Omit<GameStore, keyof GameActions> = {
  board: [],
  dropsAvailable: 0,
  initialDrops: 0,
  score: 0,
  gameStatus: 'idle',
  chainCount: 0,
  maxChainReached: 0,
  currentLevelId: null,
  history: [],
  currentLevelConfig: null,
  activeFlyingDrops: [],
};

export const useTenDropsGame = create<GameStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      loadLevel: (config: LevelConfig) => {
        const { rows, cols } = config.gridSize;

        // 创建棋盘
        const board = config.initialBoard
          ? createBoardFromData(config.initialBoard, rows, cols)
          : createEmptyBoard(rows, cols);

        set({
          board,
          dropsAvailable: config.initialDrops,
          initialDrops: config.initialDrops,
          score: 0,
          gameStatus: 'playing',
          chainCount: 0,
          maxChainReached: 0,
          currentLevelId: config.id,
          history: [],
          currentLevelConfig: config,
          activeFlyingDrops: [],
        });
      },

      resetLevel: () => {
        const { currentLevelConfig } = get();
        if (currentLevelConfig) {
          get().loadLevel(currentLevelConfig);
        }
      },

      addDrop: async (position: Position) => {
        const {
          board,
          dropsAvailable,
          initialDrops,
          gameStatus,
          maxChainReached,
          history,
        } = get();

        // 检查是否可以操作
        if (gameStatus !== 'playing') return;
        if (dropsAvailable <= 0) return;

        // 保存当前状态到历史（用于撤销）
        const newHistory = [...history, { board: cloneBoard(board), dropsAvailable }];

        // 立即扣除水滴
        set({ 
          gameStatus: 'processing', 
          history: newHistory,
          dropsAvailable: dropsAvailable - 1 
        });

        // 计算这一步的完整模拟
        const { steps, finalBoard, maxChain } = calculateChainSteps(board, position);
        
        // 播放动画序列
        if (steps.length > 0) {
           // 1. 初始点击增加水滴
           const initialBoard = cloneBoard(board);
           initialBoard[position.row][position.col].drops += 1;
           set({ board: initialBoard });
           
           // 短暂等待，显示初始水滴增加
           await new Promise(r => setTimeout(r, 100));
           
           for (const step of steps) {
             // 2. 显示爆炸效果
             const explodingBoard = cloneBoard(get().board);
             step.explodingCells.forEach(p => {
               explodingBoard[p.row][p.col].isExploding = true;
             });
             set({ board: explodingBoard });
             
             // 等待爆炸动画
             await new Promise(r => setTimeout(r, 300));
             
             // 3. 爆炸结束，水滴飞出
             set({ 
               board: step.boardAfterExplosion, 
               activeFlyingDrops: step.flyingDrops 
             });
             
             // 等待飞行时间
             await new Promise(r => setTimeout(r, 500));
             
             // 4. 水滴落地
             set({ 
               activeFlyingDrops: [],
               board: step.boardAfterFlight 
             });
             
             // 小停顿
             await new Promise(r => setTimeout(r, 100));
           }
        } else {
           // 无连锁，直接设置状态
           set({ board: finalBoard });
           // 小停顿，让用户看到结果
           await new Promise(r => setTimeout(r, 200));
        }

        // 计算奖励
        let reward = 0;
        if (maxChain >= GAME_CONFIG.REWARD_CONFIG.MIN_CHAIN_FOR_REWARD) {
           // 简单的奖励逻辑：每级连锁奖1滴（或者每3级奖1滴，看配置）
           // 这里按照：chain 3 -> +1, chain 4 -> +2 ...
           // reward = maxChain - 2; 
           // 或者按配置：
           reward = (maxChain - GAME_CONFIG.REWARD_CONFIG.MIN_CHAIN_FOR_REWARD + 1) * GAME_CONFIG.REWARD_CONFIG.REWARD_PER_CHAIN;
        }
        
        const currentDrops = get().dropsAvailable; // 这里已经是 -1 后的值
        const newDrops = currentDrops + reward;

        // 更新最终状态
        const newMaxChain = Math.max(maxChainReached, maxChain);
        const cleared = isBoardCleared(finalBoard);

        let newStatus: GameStatus = 'playing';
        let newScore = get().score; // 累加分数吗？还是重新计算？原逻辑是重新计算。
        // 原逻辑：calculateScore 基于 movesUsed。
        // 新逻辑：Score 可以基于 cleared + dropsLeft + totalChain.
        
        if (cleared) {
          newStatus = 'won';
          // 胜利分数：基础分 + 剩余水滴 * 50 + 最大连锁 * 15
          newScore = GAME_CONFIG.BASE_SCORE + newDrops * GAME_CONFIG.DROP_BONUS + newMaxChain * GAME_CONFIG.CHAIN_BONUS;
        } else if (newDrops <= 0) {
          newStatus = 'lost';
        }

        set({
          board: finalBoard,
          dropsAvailable: newDrops,
          score: newScore,
          chainCount: maxChain,
          maxChainReached: newMaxChain,
          gameStatus: newStatus,
          activeFlyingDrops: [], 
        });
      },

      undo: () => {
        const { history, gameStatus } = get();

        // 只能在游戏进行中撤销
        if (gameStatus !== 'playing' || history.length === 0) return;

        const prevState = history[history.length - 1];

        set({
          board: prevState.board,
          dropsAvailable: prevState.dropsAvailable,
          history: history.slice(0, -1),
          chainCount: 0,
        });
      },

      setGameStatus: (status: GameStatus) => {
        set({ gameStatus: status });
      },

      setCellExploding: (position: Position, isExploding: boolean) => {
        const { board } = get();
        const newBoard = cloneBoard(board);
        newBoard[position.row][position.col].isExploding = isExploding;
        set({ board: newBoard });
      },

      setCellReceiving: (position: Position, isReceiving: boolean) => {
        const { board } = get();
        const newBoard = cloneBoard(board);
        newBoard[position.row][position.col].isReceiving = isReceiving;
        set({ board: newBoard });
      },
    }),
    { name: 'TenDropsGame' }
  )
);

// 选择器
export const selectBoard = (state: GameStore) => state.board;
export const selectDropsAvailable = (state: GameStore) => state.dropsAvailable; // 新选择器
export const selectInitialDrops = (state: GameStore) => state.initialDrops; // 新选择器
export const selectGameStatus = (state: GameStore) => state.gameStatus;
export const selectScore = (state: GameStore) => state.score;
export const selectChainCount = (state: GameStore) => state.chainCount;
export const selectMaxChain = (state: GameStore) => state.maxChainReached;
export const selectCanUndo = (state: GameStore) =>
  state.history.length > 0 && state.gameStatus === 'playing';
export const selectCurrentLevel = (state: GameStore) => state.currentLevelConfig;
export const selectActiveFlyingDrops = (state: GameStore) => state.activeFlyingDrops;
