import {
  canonicalizeTextbookCoachIdentity,
  identitiesEqual,
  type StructuredTextbookUnitIdentity,
} from './identity';
import { PINNED_TEXTBOOK_IDENTITY_METADATA_KEY } from './session';

/**
 * 从持久化的控灵助手绑定事件中提取服务端可重验证的资源辅导身份。
 * 只接受服务端校验过的 pinned 身份；仅存在于客户端提示中的声明
 * 不构成可恢复的持久化匹配。
 */
export function resourceCoachBindingIdentity(event: unknown): StructuredTextbookUnitIdentity | null {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
  const record = event as Record<string, unknown>;
  if (record.teachingAssistantModeId !== 'resource-coach') return null;
  return canonicalizeTextbookCoachIdentity(record[PINNED_TEXTBOOK_IDENTITY_METADATA_KEY]);
}

export function isExactResourceCoachMatch(
  bindingEvent: unknown,
  requested: StructuredTextbookUnitIdentity,
): boolean {
  const identity = resourceCoachBindingIdentity(bindingEvent);
  return Boolean(identity && identitiesEqual(identity, requested));
}
