/**
 * Namespace-qualified identity helpers for Canonical SAR composition (#1114).
 *
 * Bare source IDs are not unique across authority domains. All internal indexes,
 * frontiers, binding endpoint matches, and candidate/edge identity surfaces use
 * `${namespace}::${localId}`.
 */

import {
  SAR_SOURCE_NAMESPACES,
  type SarSourceNamespace,
} from './contracts';

export const SAR_NAMESPACE_ID_SEPARATOR = '::' as const;

export type SarQualifiedId = `${SarSourceNamespace}::${string}`;

export function qualifySarId(
  namespace: SarSourceNamespace,
  localId: string,
): SarQualifiedId {
  if (!localId.trim()) {
    throw new Error('SAR local id must be non-empty');
  }
  if (localId.includes(SAR_NAMESPACE_ID_SEPARATOR)) {
    throw new Error(
      `SAR local id must not contain namespace separator ${SAR_NAMESPACE_ID_SEPARATOR}: ${localId}`,
    );
  }
  return `${namespace}${SAR_NAMESPACE_ID_SEPARATOR}${localId}`;
}

export function isSarSourceNamespace(value: string): value is SarSourceNamespace {
  return (SAR_SOURCE_NAMESPACES as readonly string[]).includes(value);
}

export function parseSarQualifiedId(
  qualified: string,
): { namespace: SarSourceNamespace; localId: string } | null {
  const sep = qualified.indexOf(SAR_NAMESPACE_ID_SEPARATOR);
  if (sep <= 0) return null;
  const namespace = qualified.slice(0, sep);
  const localId = qualified.slice(sep + SAR_NAMESPACE_ID_SEPARATOR.length);
  if (!isSarSourceNamespace(namespace) || !localId) return null;
  return { namespace, localId };
}

export function assertSarQualifiedId(qualified: string): SarQualifiedId {
  const parsed = parseSarQualifiedId(qualified);
  if (!parsed) {
    throw new Error(`Invalid SAR qualified id: ${qualified}`);
  }
  return qualifySarId(parsed.namespace, parsed.localId);
}

export function sameSarEndpoint(
  left: { namespace: SarSourceNamespace; localId: string },
  right: { namespace: SarSourceNamespace; localId: string },
): boolean {
  return left.namespace === right.namespace && left.localId === right.localId;
}
