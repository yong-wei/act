/**
 * 伦理熔断常量定义
 */

// 伦理阈值（船舶控制安全限制）
export const ETHICAL_THRESHOLDS = {
  // 舵角速度限制 (度/秒)
  // 过快的舵角变化可能导致液压系统过载
  MAX_RUDDER_RATE: 5.0,

  // 横摇角限制 (度)
  // 过大的横摇可能导致船体倾覆
  MAX_ROLL_ANGLE: 15.0,

  // 最大转向角速度 (度/秒)
  // 过快的转向可能影响船员和货物安全
  MAX_YAW_RATE: 3.0,

  // 最小碰撞距离 (米)
  // 与障碍物的最小安全距离
  MIN_COLLISION_DISTANCE: 100,

  // 最大能耗率 (积分单位/秒)
  // 过高的能耗可能导致系统过热
  MAX_ENERGY_RATE: 50,
} as const;

// 违规类型描述
export const VIOLATION_DESCRIPTIONS: Record<string, { title: string; consequence: string; suggestion: string }> = {
  EXCESSIVE_RUDDER_RATE: {
    title: '舵机过载警告',
    consequence: '舵角变化速度过快可能导致液压系统爆裂、舵机机械故障，严重时可能丧失船舶控制能力。',
    suggestion: '建议降低 PID 控制器的 Kp 参数，或增加 Kd 参数以平滑控制输出。在恶劣海况下应适当降低控制增益。',
  },
  EXCESSIVE_ROLL_ANGLE: {
    title: '横摇危险警告',
    consequence: '船体横摇角度过大可能导致货物移位、船员受伤，极端情况下可能发生船体倾覆事故。',
    suggestion: '建议降低航速、调整航向以避开横浪，或启用减摇鳍系统稳定船体。',
  },
  COLLISION_RISK: {
    title: '碰撞风险警告',
    consequence: '船舶与障碍物距离过近，存在碰撞风险，可能造成船体损伤、人员伤亡和环境污染。',
    suggestion: '立即采取规避措施，调整航向远离障碍物，必要时减速或倒车。',
  },
  ENVIRONMENTAL_HAZARD: {
    title: '环境危害警告',
    consequence: '当前操作可能对海洋环境造成危害，如排放超标、噪音污染等。',
    suggestion: '检查设备运行状态，确保符合环保规范。',
  },
  SAFETY_VIOLATION: {
    title: '安全违规警告',
    consequence: '当前操作违反船舶安全操作规程，可能危及船舶和人员安全。',
    suggestion: '停止当前操作，按照安全规程进行整改。',
  },
};

// 违规严重等级
export const VIOLATION_SEVERITY = {
  EXCESSIVE_RUDDER_RATE: 'HIGH',
  EXCESSIVE_ROLL_ANGLE: 'CRITICAL',
  COLLISION_RISK: 'CRITICAL',
  ENVIRONMENTAL_HAZARD: 'MEDIUM',
  SAFETY_VIOLATION: 'HIGH',
} as const;

// 伦理分扣减规则
export const ETHICS_SCORE_DEDUCTION = {
  CRITICAL: 10, // 严重违规扣10分
  HIGH: 5,      // 高风险违规扣5分
  MEDIUM: 2,    // 中等违规扣2分
  LOW: 1,       // 轻微违规扣1分
} as const;
