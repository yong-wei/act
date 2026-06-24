import { createPrismaClient } from '@/lib/prisma-client';

type PrismaClientInstance = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientInstance };

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
function getPrismaClient(): PrismaClientInstance {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient({
      log: ['warn', 'error'],
    });
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClientInstance, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client as object, property, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
  set(_target, property, value) {
    return Reflect.set(getPrismaClient() as object, property, value);
  },
});
