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
  const setting = await prisma.platformSetting.findUnique({
    where: { key: HOME_DYNAMIC_MODEL_KEY },
    select: { value: true },
  })

  if (!setting) {
    return defaultValue
  }

  return toBooleanValue(setting.value, defaultValue)
}

export async function setHomeDynamicModelEnabled(enabled: boolean): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key: HOME_DYNAMIC_MODEL_KEY },
    create: { key: HOME_DYNAMIC_MODEL_KEY, value: enabled },
    update: { value: enabled },
  })
}
