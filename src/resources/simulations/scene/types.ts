/**
 * 场景视觉管线：船舶视觉档案。
 *
 * 所有管线模块（water/wake/environment/camera/audio/quality/annotations/post）
 * 仅通过该档案获取实验间差异；模块实现内不得硬编码任何实验身份、
 * 路由或档案键（用户硬性架构要求，见 change proposal）。
 */
export interface SceneShipVisualProfile {
  /** 船长（米）：尾迹 Froude 语义与海面尺度基准。 */
  readonly shipLengthMeters: number;
  /** 设计航速（节）：Froude 活跃度换算基准。 */
  readonly designSpeedKnots: number;
  /** 船体模型 URL（public 相对路径，可为压缩后资产）。 */
  readonly modelUrl: string;
  /** 模型局部坐标中的水线高度。 */
  readonly waterlineY: number;
  /** 尾迹发射锚点（模型局部坐标）：船尾中线与左右肩部。 */
  readonly wakeAnchors: {
    readonly stern: readonly [number, number, number];
    readonly portShoulder: readonly [number, number, number];
    readonly starboardShoulder: readonly [number, number, number];
  };
}
