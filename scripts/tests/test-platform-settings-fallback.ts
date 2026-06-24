import assert from 'node:assert/strict';

import { prisma } from '../../src/lib/prisma';
import {
  getDataCenterShowDemoSourceLabels,
  getHomeDynamicModelEnabled,
} from '../../src/lib/platform-settings';

async function main() {
  const originalFindUnique = prisma.platformSetting.findUnique.bind(prisma.platformSetting);

  prisma.platformSetting.findUnique = (async () => {
    throw new Error('relation "PlatformSetting" does not exist');
  }) as typeof prisma.platformSetting.findUnique;

  try {
    const value = await getHomeDynamicModelEnabled(true);
    assert.equal(
      value,
      true,
      '当 PlatformSetting 查询失败时，应回退到默认值而不是抛出 500',
    );

    const dataCenterValue = await getDataCenterShowDemoSourceLabels(false);
    assert.equal(
      dataCenterValue,
      false,
      '数据中心来源标签设置查询失败时，应回退到默认关闭',
    );
  } finally {
    prisma.platformSetting.findUnique = originalFindUnique;
  }

  console.log('platform settings fallback test passed');
}

void main();
