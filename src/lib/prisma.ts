import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Prisma Client 配置
 *
 * 连接池参数通过 DATABASE_URL 环境变量配置：
 * - connection_limit=10: 连接池大小（默认3，提高到10以支持更多并发）
 * - pool_timeout=20: 连接获取超时时间（默认10秒，提高到20秒避免超时）
 *
 * 示例 DATABASE_URL:
 * postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
