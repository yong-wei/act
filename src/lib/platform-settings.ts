import { prisma } from '@/lib/prisma'

const HOME_DYNAMIC_MODEL_KEY = 'home_dynamic_model_enabled'

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

export async function setHomeDynamicModelEnabled(enabled: boolean): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key: HOME_DYNAMIC_MODEL_KEY },
    create: { key: HOME_DYNAMIC_MODEL_KEY, value: enabled },
    update: { value: enabled },
  })
}
