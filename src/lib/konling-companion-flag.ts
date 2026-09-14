const DISABLED = new Set(['0', 'false', 'off', 'no']);

/** 主动陪伴默认开启；仅显式 false/0/off/no 关闭。 */
export function isKonlingCompanionEnabled(): boolean {
  const raw = process.env.KONLING_COMPANION_ENABLED;
  if (raw == null || raw.trim() === '') return true;
  return !DISABLED.has(raw.trim().toLowerCase());
}
