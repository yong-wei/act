/**
 * 十滴水游戏 - 核心游戏逻辑（纯函数）
 *
 * 设计理念：所有游戏规则以纯函数实现，无副作用，便于测试和调试
 */

import {
  Position,
  Direction,
  CellState,
  GameBoard,
  GAME_CONFIG,
  DIRECTION_VECTORS,
  ALL_DIRECTIONS,
} from '../types';

/**
 * 计算格子容量
 *
 * 教学意义：边界条件影响系统行为
 * - 角落：2个相邻格子 → 容量2
 * - 边缘：3个相邻格子 → 容量3
 * - 中心：4个相邻格子 → 容量4
 */
export function getCellCapacity(
  row: number,
  col: number,
  gridRows: number,
  gridCols: number
): number {
  const isTopEdge = row === 0;
  const isBottomEdge = row === gridRows - 1;
  const isLeftEdge = col === 0;
  const isRightEdge = col === gridCols - 1;

  const edgeCount = [isTopEdge, isBottomEdge, isLeftEdge, isRightEdge].filter(
    Boolean
  ).length;

  if (edgeCount >= 2) return GAME_CONFIG.CORNER_CAPACITY;
  if (edgeCount === 1) return GAME_CONFIG.EDGE_CAPACITY;
  return GAME_CONFIG.CENTER_CAPACITY;
}

/**
 * 创建空棋盘
 */
export function createEmptyBoard(rows: number, cols: number): GameBoard {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({
      drops: 0,
      capacity: getCellCapacity(row, col, rows, cols),
      isExploding: false,
      isReceiving: false,
    }))
  );
}

/**
 * 从初始数据创建棋盘
 */
export function createBoardFromData(
  initialData: number[][],
  rows: number,
  cols: number
): GameBoard {
  const board = createEmptyBoard(rows, cols);

  for (let r = 0; r < rows && r < initialData.length; r++) {
    for (let c = 0; c < cols && c < (initialData[r]?.length || 0); c++) {
      const drops = initialData[r][c];
      if (drops > 0) {
        board[r][c].drops = Math.min(drops, board[r][c].capacity - 1);
      }
    }
  }

  return board;
}

/**
 * 深拷贝棋盘
 */
export function cloneBoard(board: GameBoard): GameBoard {
  return board.map((row) =>
    row.map((cell) => ({ ...cell }))
  );
}

/**
 * 获取相邻位置
 */
export function getAdjacentPositions(
  pos: Position,
  gridRows: number,
  gridCols: number
): { position: Position; direction: Direction }[] {
  return ALL_DIRECTIONS.map((dir) => ({
    position: {
      row: pos.row + DIRECTION_VECTORS[dir].row,
      col: pos.col + DIRECTION_VECTORS[dir].col,
    },
    direction: dir,
  })).filter(
    ({ position }) =>
      position.row >= 0 &&
      position.row < gridRows &&
      position.col >= 0 &&
      position.col < gridCols
  );
}

/**
 * 爆炸结果
 */
export interface ExplosionResult {
  newBoard: GameBoard;
  explodedCells: Position[];
  chainDepth: number;
}

/**
 * 飞行中的水滴
 */
export interface FlyingDrop {
  id: string; // 用于React Key
  from: Position;
  to: Position | null; // null 表示飞出边界
  direction: Direction;
}

/**
 * 动画步骤
 */
export interface ChainStep {
  explodingCells: Position[];
  flyingDrops: FlyingDrop[];
  boardAfterExplosion: GameBoard; // 爆炸后、飞行前的状态
  boardAfterFlight: GameBoard; // 飞行落地后的状态
}

/**
 * 查找水滴飞行的落点
 * ... (unchanged helper functions)
 */
function findDropLandingPosition(
  board: GameBoard,
  startPos: Position,
  direction: Direction,
  gridRows: number,
  gridCols: number
): Position | null {
  const vector = DIRECTION_VECTORS[direction];
  let currentPos = {
    row: startPos.row + vector.row,
    col: startPos.col + vector.col,
  };

  // 沿方向飞行
  while (isValidPosition(currentPos, gridRows, gridCols)) {
    const cell = board[currentPos.row][currentPos.col];

    // 遇到有水滴的格子，停下
    if (cell.drops > 0) {
      return currentPos;
    }

    // 空格子，继续飞行
    currentPos = {
      row: currentPos.row + vector.row,
      col: currentPos.col + vector.col,
    };
  }

  // 飞出边界，消失
  return null;
}

/**
 * 计算完整的连锁反应步骤（用于动画）
 */
export function calculateChainSteps(
  board: GameBoard,
  startPos: Position
): { steps: ChainStep[]; finalBoard: GameBoard; totalMoves: number; maxChain: number } {
  const steps: ChainStep[] = [];
  let currentBoard = cloneBoard(board);
  const gridRows = currentBoard.length;
  const gridCols = currentBoard[0].length;

  // 初始点击
  currentBoard[startPos.row][startPos.col].drops += 1;

  let chainDepth = 0;
  let hasExplosion = true;

  while (hasExplosion) {
    hasExplosion = false;
    const explosionsThisRound: Position[] = [];

    // 1. 找出所有需要爆炸的格子
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const cell = currentBoard[r][c];
        if (cell.drops >= cell.capacity) {
          explosionsThisRound.push({ row: r, col: c });
        }
      }
    }

    if (explosionsThisRound.length > 0) {
      hasExplosion = true;
      chainDepth++;

      const boardAfterExplosion = cloneBoard(currentBoard);
      const flyingDrops: FlyingDrop[] = [];

      // 2. 处理爆炸：清空格子，生成飞行水滴
      for (const pos of explosionsThisRound) {
        boardAfterExplosion[pos.row][pos.col].drops = 0;
        
        for (const direction of ALL_DIRECTIONS) {
           // 查找落点（基于爆炸后的棋盘，因为水滴已经消失）
           // 注意：这里有个逻辑细微差别。
           // 原版 processAddDrop 是 "并行" 爆炸。所有爆炸同时发生。
           // 所以查找落点时，应该基于 "所有爆炸都发生后" 的状态吗？
           // 是的，爆炸是同时的。所有爆炸源都变空了。
           // 但是，如果A爆炸射向B，B也爆炸，那A的水滴会穿过B吗？
           // 原始逻辑中：
           // for (const pos of explosionsThisRound) { currentBoard... = 0 }
           // 然后再 calculate landing。
           // 所以是的，水滴会穿过同时爆炸的格子。
        }
      }
      
      // 更新 boardAfterExplosion 为完全清空的状态
      // 注意：上面的循环里我已经改了 boardAfterExplosion
      // 但我们需要对 flyingDrops 进行计算，计算时要用 boardAfterExplosion
      
      for (const pos of explosionsThisRound) {
         for (const direction of ALL_DIRECTIONS) {
             const landingPos = findDropLandingPosition(
               boardAfterExplosion,
               pos,
               direction,
               gridRows,
               gridCols
             );
             
             flyingDrops.push({
               id: `${chainDepth}-${pos.row}-${pos.col}-${direction}`,
               from: pos,
               to: landingPos,
               direction
             });
         }
      }

      // 3. 计算落地后的状态
      const boardAfterFlight = cloneBoard(boardAfterExplosion);
      for (const drop of flyingDrops) {
        if (drop.to) {
          boardAfterFlight[drop.to.row][drop.to.col].drops += 1;
        }
      }

      steps.push({
        explodingCells: explosionsThisRound,
        flyingDrops,
        boardAfterExplosion,
        boardAfterFlight,
      });

      // 更新当前板为下一轮的起点
      currentBoard = boardAfterFlight;
    }
  }

  return {
    steps,
    finalBoard: currentBoard,
    totalMoves: 1, // 每次调用只算一步
    maxChain: chainDepth,
  };
}

/**
 * 处理单次点击的完整连锁反应
 * ... (original processAddDrop)
 */
export function processAddDrop(
  board: GameBoard,
  position: Position
): ExplosionResult {
  let currentBoard = cloneBoard(board);
  const allExplodedCells: Position[] = [];
  let chainDepth = 0;

  const gridRows = currentBoard.length;
  const gridCols = currentBoard[0].length;

  // 添加初始水滴
  currentBoard[position.row][position.col].drops += 1;

  // 处理连锁反应
  let hasExplosion = true;
  while (hasExplosion) {
    hasExplosion = false;
    const explosionsThisRound: Position[] = [];

    // 找出所有需要爆炸的格子
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const cell = currentBoard[r][c];
        if (cell.drops >= cell.capacity) {
          explosionsThisRound.push({ row: r, col: c });
        }
      }
    }

    if (explosionsThisRound.length > 0) {
      hasExplosion = true;
      chainDepth++;
      allExplodedCells.push(...explosionsThisRound);

      // 处理所有爆炸，清空格子并发射水滴
      for (const pos of explosionsThisRound) {
        currentBoard[pos.row][pos.col].drops = 0;
      }

      // 收集所有飞行中的水滴
      const flyingDrops: FlyingDrop[] = [];
      for (const pos of explosionsThisRound) {
        for (const direction of ALL_DIRECTIONS) {
          const landingPos = findDropLandingPosition(
            currentBoard,
            pos,
            direction,
            gridRows,
            gridCols
          );

          flyingDrops.push({
            id: `${chainDepth}-${pos.row}-${pos.col}-${direction}`,
            from: pos,
            to: landingPos,
            direction,
          });
        }
      }

      // 处理所有飞行的水滴，找到落点
      for (const drop of flyingDrops) {
        if (drop.to) {
          currentBoard[drop.to.row][drop.to.col].drops += 1;
        }
      }
    }
  }

  return {
    newBoard: currentBoard,
    explodedCells: allExplodedCells,
    chainDepth,
  };
}

/**
 * 检查棋盘是否清空（胜利条件）
 */
export function isBoardCleared(board: GameBoard): boolean {
  return board.every((row) => row.every((cell) => cell.drops === 0));
}

/**
 * 计算棋盘总水滴数
 */
export function getTotalDrops(board: GameBoard): number {
  return board.reduce(
    (total, row) => total + row.reduce((rowTotal, cell) => rowTotal + cell.drops, 0),
    0
  );
}

/**
 * 计算得分
 *
 * 得分 = 基础分 + 剩余水滴奖励 + 连锁奖励
 */
export function calculateScore(
  cleared: boolean,
  movesUsed: number,
  maxMoves: number,
  maxChain: number
): number {
  if (!cleared) return 0;

  const baseScore = GAME_CONFIG.BASE_SCORE;
  const moveBonus = Math.max(0, maxMoves - movesUsed) * GAME_CONFIG.DROP_BONUS;
  const chainBonus = maxChain * GAME_CONFIG.CHAIN_BONUS;

  return baseScore + moveBonus + chainBonus;
}

/**
 * 检查位置是否有效
 */
export function isValidPosition(
  pos: Position,
  gridRows: number,
  gridCols: number
): boolean {
  return pos.row >= 0 && pos.row < gridRows && pos.col >= 0 && pos.col < gridCols;
}

/**
 * 获取格子状态描述（用于调试和教育面板）
 */
export function getCellDescription(cell: CellState): string {
  const fillPercent = Math.round((cell.drops / cell.capacity) * 100);
  if (cell.drops === 0) return '空';
  if (fillPercent >= 100) return '临界';
  if (fillPercent >= 75) return '接近满载';
  if (fillPercent >= 50) return '半满';
  return '少量';
}

/**
 * 分析棋盘状态（用于教育提示）
 */
export function analyzeBoardState(board: GameBoard): {
  totalDrops: number;
  criticalCells: number;
  averageFill: number;
  mostDangerousArea: 'corner' | 'edge' | 'center' | null;
} {
  let totalDrops = 0;
  let criticalCells = 0;
  let totalCapacity = 0;
  const areaStats = { corner: 0, edge: 0, center: 0 };

  const gridRows = board.length;
  const gridCols = board[0]?.length || 0;

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const cell = board[r][c];
      totalDrops += cell.drops;
      totalCapacity += cell.capacity;

      if (cell.drops >= cell.capacity - 1 && cell.drops > 0) {
        criticalCells++;

        // 统计危险区域
        if (cell.capacity === GAME_CONFIG.CORNER_CAPACITY) {
          areaStats.corner++;
        } else if (cell.capacity === GAME_CONFIG.EDGE_CAPACITY) {
          areaStats.edge++;
        } else {
          areaStats.center++;
        }
      }
    }
  }

  const averageFill = totalCapacity > 0 ? totalDrops / totalCapacity : 0;

  let mostDangerousArea: 'corner' | 'edge' | 'center' | null = null;
  const maxDanger = Math.max(areaStats.corner, areaStats.edge, areaStats.center);
  if (maxDanger > 0) {
    if (areaStats.corner === maxDanger) mostDangerousArea = 'corner';
    else if (areaStats.edge === maxDanger) mostDangerousArea = 'edge';
    else mostDangerousArea = 'center';
  }

  return { totalDrops, criticalCells, averageFill, mostDangerousArea };
}
