import { prisma } from '@/lib/prisma'

const HOME_DYNAMIC_MODEL_KEY = 'home_dynamic_model_enabled'
const DATA_CENTER_SHOW_DEMO_SOURCE_LABELS_KEY = 'data_center_show_demo_source_labels'
type PlatformSettingsDb = Pick<typeof prisma, 'platformSetting'>

function toBooleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (value && typeof value === 'object' && 'enabled' in value) {
    return (value as { enabled?: boolean }).enabled === true
  }

  return fallback
}

export async function getHomeDynamicModelEnabled(defaultValue = false): Promise<boolean> {
  try {
    const setting = await prisma.platformSetting.findUnique({
      where: { key: HOME_DYNAMIC_MODEL_KEY },
      select: { value: true },
    })

    if (!setting) {
      return defaultValue
    }

    return toBooleanValue(setting.value, defaultValue)
  } catch (error) {
    console.warn('[platform-settings] 读取首页模型开关失败，已回退默认值。', error)
    return defaultValue
  }
}

export async function setHomeDynamicModelEnabled(
  enabled: boolean,
  db: PlatformSettingsDb = prisma,
): Promise<void> {
  await db.platformSetting.upsert({
    where: { key: HOME_DYNAMIC_MODEL_KEY },
    create: { key: HOME_DYNAMIC_MODEL_KEY, value: enabled },
    update: { value: enabled },
  })
}

export async function getDataCenterShowDemoSourceLabels(defaultValue = false): Promise<boolean> {
  try {
    const setting = await prisma.platformSetting.findUnique({
      where: { key: DATA_CENTER_SHOW_DEMO_SOURCE_LABELS_KEY },
      select: { value: true },
    })

    if (!setting) {
      return defaultValue
    }

    return toBooleanValue(setting.value, defaultValue)
  } catch (error) {
    console.warn('[platform-settings] 读取数据中心来源标签开关失败，已回退默认值。', error)
    return defaultValue
  }
}

export async function setDataCenterShowDemoSourceLabels(
  enabled: boolean,
  db: PlatformSettingsDb = prisma,
): Promise<void> {
  await db.platformSetting.upsert({
    where: { key: DATA_CENTER_SHOW_DEMO_SOURCE_LABELS_KEY },
    create: { key: DATA_CENTER_SHOW_DEMO_SOURCE_LABELS_KEY, value: enabled },
    update: { value: enabled },
  })
}
