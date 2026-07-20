import type { Drift, Json } from './types';

export interface SelectedValue { path: string; value: Json }

function tokens(selector: string): string[] {
  if (!selector.startsWith('$')) throw new Error(`invalid selector: ${selector}`);
  return selector.slice(1).match(/\.[A-Za-z_][A-Za-z0-9_]*|\.\*|\[\*\]/gu)?.map((token) => token === '[*]' || token === '.*' ? '*' : token.slice(1)) ?? [];
}

export function selectJson(root: Json, selector: string): SelectedValue[] {
  let current: SelectedValue[] = [{ path: '$', value: root }];
  for (const token of tokens(selector)) {
    const next: SelectedValue[] = [];
    for (const item of current) {
      if (token === '*') {
        if (Array.isArray(item.value)) item.value.forEach((value, index) => next.push({ path: `${item.path}[${index}]`, value }));
        else if (item.value && typeof item.value === 'object') for (const [key, value] of Object.entries(item.value)) next.push({ path: `${item.path}.${key}`, value });
      } else if (item.value && typeof item.value === 'object' && !Array.isArray(item.value) && token in item.value) next.push({ path: `${item.path}.${token}`, value: item.value[token]! });
    }
    current = next;
  }
  return current;
}

function pathPattern(selector: string): RegExp {
  const parts = selector.slice(1).match(/\.[A-Za-z_][A-Za-z0-9_]*|\.\*|\[\*\]/gu) ?? [];
  const body = parts.map((part) => part === '[*]' ? '\\[\\d+\\]' : part === '.*' ? '\\.[^.\\[]+' : `\\.${part.slice(1)}`).join('');
  return new RegExp(`^\\$${body}$`, 'u');
}

export function auditIdBearingPaths(payload: Json, selectors: string[], scope: string): Drift[] {
  const allowed = selectors.map(pathPattern);
  const allowedContainers = selectors.filter((selector) => selector.endsWith('[*]')).map((selector) => pathPattern(selector.slice(0, -3)));
  const drift: Drift[] = [];
  const visit = (value: Json, pointer: string): void => {
    if (Array.isArray(value)) value.forEach((child, index) => visit(child, `${pointer}[${index}]`));
    else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
      const childPath = `${pointer}.${key}`;
      if (/(?:Id|Ids)$/u.test(key) && ![...allowed, ...allowedContainers].some((pattern) => pattern.test(childPath))) drift.push({ code: 'UNKNOWN_ID_BEARING_PATH', scope, observed: childPath });
      visit(child, childPath);
    }
  };
  visit(payload, '$');
  return drift;
}
