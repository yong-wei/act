/**
 * 伦理违规记录 API
 *
 * POST /api/ethics/violation - 记录违规并生成 AI 批评
 * PATCH /api/ethics/violation - 提交整改方案
 */

import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// 请求验证 schema
const createViolationSchema = z.object({
  simulationLogId: z.string(),
  violationType: z.enum([
    'EXCESSIVE_RUDDER_RATE',
    'EXCESSIVE_ROLL_ANGLE',
    'COLLISION_RISK',
    'ENVIRONMENTAL_HAZARD',
    'SAFETY_VIOLATION',
  ]),
  thresholdValue: z.number(),
  actualValue: z.number(),
});

const submitJustificationSchema = z.object({
  ethicalLogId: z.string(),
  studentJustification: z.string().min(10, '整改方案至少需要10个字符'),
});

/**
 * POST - 创建违规记录
 */
export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createViolationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: '无效的请求数据', details: parsed.error.errors }, { status: 400 });
    }

    const { simulationLogId, violationType, thresholdValue, actualValue } = parsed.data;

    // 生成 AI 批评（这里可以调用 AI 服务）
    const aiCritique = generateAICritique(violationType, thresholdValue, actualValue);

    // 创建违规记录
    const ethicalLog = await prisma.ethicalLog.create({
      data: {
        simulationLogId,
        userId: session.user.id,
        violationType,
        thresholdValue,
        actualValue,
        aiCritique,
      },
    });

    // 更新 SimulationLog 的违规标记
    await prisma.simulationLog.update({
      where: { id: simulationLogId },
      data: { isEthicalViolation: true },
    });

    // 扣减用户伦理分
    const deduction = getDeduction(violationType);
    await prisma.studentProfile.upsert({
      where: { userId: session.user.id },
      update: {
        ethicsScore: {
          decrement: deduction,
        },
      },
      create: {
        userId: session.user.id,
        techScore: 0,
        ethicsScore: 100 - deduction,
      },
    });

    // 确保伦理分不低于 0
    await prisma.studentProfile.updateMany({
      where: {
        userId: session.user.id,
        ethicsScore: { lt: 0 },
      },
      data: {
        ethicsScore: 0,
      },
    });

    return NextResponse.json({
      success: true,
      ethicalLog: {
        id: ethicalLog.id,
        violationType: ethicalLog.violationType,
        aiCritique: ethicalLog.aiCritique,
        deduction,
      },
    });
  } catch (error) {
    console.error('创建违规记录失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

/**
 * PATCH - 提交整改方案
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = submitJustificationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: '无效的请求数据', details: parsed.error.errors }, { status: 400 });
    }

    const { ethicalLogId, studentJustification } = parsed.data;

    // 验证该记录属于当前用户
    const existing = await prisma.ethicalLog.findFirst({
      where: {
        id: ethicalLogId,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: '记录不存在或无权访问' }, { status: 404 });
    }

    // 更新整改方案
    const updated = await prisma.ethicalLog.update({
      where: { id: ethicalLogId },
      data: {
        studentJustification,
        isResolved: true,
        resolvedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      ethicalLog: {
        id: updated.id,
        isResolved: updated.isResolved,
        resolvedAt: updated.resolvedAt,
      },
    });
  } catch (error) {
    console.error('提交整改方案失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

/**
 * 生成 AI 批评（简化版本，实际应调用 LLM）
 */
function generateAICritique(
  violationType: string,
  thresholdValue: number,
  actualValue: number
): string {
  const critiques: Record<string, string> = {
    EXCESSIVE_RUDDER_RATE: `您的舵角变化速度达到了 ${actualValue.toFixed(2)}°/s，超过了安全阈值 ${thresholdValue.toFixed(2)}°/s。根据CCS《船舶操纵性规范》，这种快速的舵角变化可能导致液压舵机系统承受过大的瞬时负荷，长期如此会加速液压密封件磨损，严重时可能导致液压系统泄漏甚至爆裂。建议您调整PID控制器参数，降低Kp值以减小系统响应的激进程度，同时可以适当增加Kd值来平滑控制输出。`,

    EXCESSIVE_ROLL_ANGLE: `检测到船体横摇角度达到 ${actualValue.toFixed(2)}°，已超过安全限制 ${thresholdValue.toFixed(2)}°。根据IMO《完整稳性规则》，如此大的横摇角度表明船舶正处于危险的稳性状态。这可能是由于不当的转向操作或恶劣海况导致。在极端情况下，船体可能发生倾覆，威胁船员和货物安全。建议立即降低航速，避免大幅度转向，并考虑启用减摇鳍或调整压载水分布。`,

    COLLISION_RISK: `船舶与障碍物的距离已低于最小安全距离 ${thresholdValue.toFixed(0)} 米，当前距离仅 ${actualValue.toFixed(0)} 米。根据《国际海上避碰规则》，您有责任采取一切必要行动避免碰撞。碰撞可能造成船体破损、货物损失、人员伤亡及海洋环境污染。建议立即采取规避行动，包括但不限于：改变航向、减速、必要时倒车。同时应鸣放警告信号并通知附近船只。`,

    ENVIRONMENTAL_HAZARD: `您的操作可能对海洋环境造成危害。根据《MARPOL公约》相关规定，船舶运营者有义务保护海洋环境。请检查相关系统运行状态，确保排放物达标，并采取措施减少对海洋生态的影响。`,

    SAFETY_VIOLATION: `检测到安全违规行为。根据《SOLAS公约》和相关船舶安全操作规程，您的操作不符合安全标准。请立即停止当前操作，按照安全规程进行整改，确保船舶和人员安全。`,
  };

  return critiques[violationType] || '发生安全违规，请分析原因并提出整改措施。';
}

/**
 * 获取违规扣分
 */
function getDeduction(violationType: string): number {
  const deductions: Record<string, number> = {
    EXCESSIVE_RUDDER_RATE: 5,
    EXCESSIVE_ROLL_ANGLE: 10,
    COLLISION_RISK: 10,
    ENVIRONMENTAL_HAZARD: 3,
    SAFETY_VIOLATION: 5,
  };
  return deductions[violationType] || 5;
}
