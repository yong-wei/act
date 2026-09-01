import {
  canonicalizeTextbookCoachIdentity,
  identitiesEqual,
  type StructuredTextbookUnitIdentity,
} from './identity';
import { PINNED_TEXTBOOK_IDENTITY_METADATA_KEY } from './session';

/**
 * 从持久化的控灵助手绑定事件中提取服务端可重验证的资源辅导身份。
 * 优先使用服务端校验过的 pinned 身份，其次才是创建时持久化的客户端提示；
 * 非 resource-coach 绑定一律不参与匹配。
 */
export function resourceCoachBindingIdentity(event: unknown): StructuredTextbookUnitIdentity | null {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
  const record = event as Record<string, unknown>;
  if (record.teachingAssistantModeId !== 'resource-coach') return null;
  return canonicalizeTextbookCoachIdentity(record[PINNED_TEXTBOOK_IDENTITY_METADATA_KEY])
    ?? canonicalizeTextbookCoachIdentity(record.modeClientContextHints);
}

export function isExactResourceCoachMatch(
  bindingEvent: unknown,
  requested: StructuredTextbookUnitIdentity,
): boolean {
  const identity = resourceCoachBindingIdentity(bindingEvent);
  return Boolean(identity && identitiesEqual(identity, requested));
}
