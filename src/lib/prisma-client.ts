import 'dotenv/config';
import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function parsePositiveInteger(value: string | null): number | undefined {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    return undefined;
  }
  return Number(value);
}

function createPgAdapterConfig(databaseUrl: string | undefined): {
  poolConfig: ConstructorParameters<typeof PrismaPg>[0];
  adapterOptions: NonNullable<ConstructorParameters<typeof PrismaPg>[1]>;
} {
  if (!databaseUrl) {
    throw new Error('Environment variable not found: DATABASE_URL');
  }

  const poolConfig: {
    connectionString: string;
    max?: number;
    connectionTimeoutMillis?: number;
  } = { connectionString: databaseUrl };
  const adapterOptions: NonNullable<ConstructorParameters<typeof PrismaPg>[1]> = {};

  try {
    const url = new URL(databaseUrl);
    const connectionLimit = parsePositiveInteger(url.searchParams.get('connection_limit'));
    const poolTimeoutSeconds = parsePositiveInteger(url.searchParams.get('pool_timeout'));
    const schema = url.searchParams.get('schema')?.trim();

    if (connectionLimit !== undefined) {
      poolConfig.max = connectionLimit;
      url.searchParams.delete('connection_limit');
    }

    if (poolTimeoutSeconds !== undefined) {
      poolConfig.connectionTimeoutMillis = poolTimeoutSeconds * 1000;
      url.searchParams.delete('pool_timeout');
    }

    if (schema) {
      adapterOptions.schema = schema;
      url.searchParams.delete('schema');
    }

    poolConfig.connectionString = url.toString();
  } catch {
    poolConfig.connectionString = databaseUrl;
  }

  return { poolConfig, adapterOptions };
}

export function createPrismaClient(options: Prisma.PrismaClientOptions = {}) {
  const { poolConfig, adapterOptions } = createPgAdapterConfig(process.env.DATABASE_URL);
  return new PrismaClient({
    adapter: new PrismaPg(poolConfig, adapterOptions),
    ...options,
  });
}
