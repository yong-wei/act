import {
  GENERATED_ACTIVITY_CLASS,
  type GeneratedResponseKind,
  type GeneratedSlideManifest,
} from './generated-slide-contract';
import type { GeneratedSlideProjection } from './generated-slide-browser-validation';

export interface GeneratedSlideRenderContract {
  moduleIds: string[];
  textIds: string[];
  formulaIds: string[];
}

export type GeneratedSlideInlinePart =
  | { kind: 'text'; value: string; index: number }
  | { kind: 'formula'; value: string; index: number };

export function generatedSlideTextMarkerId(moduleId: string, path: string) {
  return `${moduleId}:payload.${path}:text`;
}

export function generatedSlideFormulaMarkerId(moduleId: string, path: string, index = 0) {
  return `${moduleId}:payload.${path}:formula.${index}`;
}

export function splitGeneratedSlideInlineContent(value: string): GeneratedSlideInlinePart[] {
  let textIndex = 0;
  let formulaIndex = 0;
  return value.split(/(\$[^$]+\$)/g).filter(Boolean).map((part) => {
    if (part.startsWith('$') && part.endsWith('$')) {
      return { kind: 'formula' as const, value: part.slice(1, -1), index: formulaIndex++ };
    }
    return { kind: 'text' as const, value: part, index: textIndex++ };
  });
}

export function isGeneratedSlideBareFormula(value: string) {
  const trimmed = value.trim();
  const inline = trimmed.match(/^\$([^$]+)\$$/);
  if (inline) return { formula: inline[1] };
  if (!trimmed.includes('$') && (/\\[a-zA-Z]+/.test(trimmed) || !/[\u4e00-\u9fff]/.test(trimmed))) {
    return { formula: trimmed };
  }
  return null;
}

export function generatedSlideRevealVisibleCount(itemCount: number, revealProgress: number) {
  return Math.min(itemCount, Math.max(1, revealProgress + 1));
}

export function deriveGeneratedSlideStepRenderContract(input: {
  step: GeneratedSlideManifest['stages'][number]['steps'][number];
  projection: GeneratedSlideProjection;
  revealProgress?: number;
}): GeneratedSlideRenderContract {
  const modules = input.step.modules.filter((module) => input.projection === 'teacher'
    ? module.roleMetadata.teacherVisible
    : module.roleMetadata.studentVisible);
  const textIds: string[] = [];
  const formulaIds: string[] = [];

  const addInline = (moduleId: string, path: string, value: string, allowBareFormula = false) => {
    const bare = allowBareFormula ? isGeneratedSlideBareFormula(value) : null;
    if (bare) {
      formulaIds.push(generatedSlideFormulaMarkerId(moduleId, path));
      return;
    }
    const parts = splitGeneratedSlideInlineContent(value);
    if (parts.some((part) => part.kind === 'text' && part.value.trim())) {
      textIds.push(generatedSlideTextMarkerId(moduleId, path));
    }
    for (const part of parts) {
      if (part.kind === 'formula') formulaIds.push(generatedSlideFormulaMarkerId(moduleId, path, part.index));
    }
  };

  for (const slideModule of modules) {
    const payload = slideModule.payload;
    switch (slideModule.canonicalClass) {
      case 'content.rich':
        addInline(slideModule.id, 'text', requiredString(payload.text));
        optionalStringArray(payload.bullets).forEach((value, index) => addInline(slideModule.id, `bullets.${index}`, value));
        break;
      case 'content.cardSet':
        requiredRecordArray(payload.items).forEach((item, index) => {
          addInline(slideModule.id, `items.${index}.title`, requiredString(item.title));
          addInline(slideModule.id, `items.${index}.body`, requiredString(item.body));
        });
        break;
      case 'content.formula':
        requiredStringArray(payload.formulas).forEach((value, index) => addInline(slideModule.id, `formulas.${index}`, value, true));
        optionalStringArray(payload.notes).forEach((value, index) => addInline(slideModule.id, `notes.${index}`, value));
        break;
      case 'content.table':
        requiredStringArray(payload.columns).forEach((value, index) => addInline(slideModule.id, `columns.${index}`, value));
        requiredArray(payload.rows).forEach((row, rowIndex) => {
          requiredArray(row).forEach((cell, cellIndex) => {
            const path = `rows.${rowIndex}.${cellIndex}`;
            if (typeof cell === 'string') addInline(slideModule.id, path, cell);
            else {
              const record = requiredRecord(cell);
              if (record.kind !== 'math') throw new Error(`unsupported-generated-slide-table-cell:${slideModule.id}:${path}`);
              formulaIds.push(generatedSlideFormulaMarkerId(slideModule.id, path));
            }
          });
        });
        break;
      case 'content.code':
        textIds.push(generatedSlideTextMarkerId(slideModule.id, 'language'));
        textIds.push(generatedSlideTextMarkerId(slideModule.id, 'code'));
        if (typeof payload.note === 'string') addInline(slideModule.id, 'note', payload.note);
        break;
      case 'content.reveal':
        requiredRecordArray(payload.items)
          .slice(0, generatedSlideRevealVisibleCount(
            requiredRecordArray(payload.items).length,
            input.revealProgress ?? 8,
          ))
          .forEach((item, index) => {
          if (typeof item.title === 'string') addInline(slideModule.id, `items.${index}.title`, item.title);
          addInline(slideModule.id, `items.${index}.body`, requiredString(item.body));
          if (typeof item.formula === 'string') addInline(slideModule.id, `items.${index}.formula`, item.formula, true);
        });
        break;
      case GENERATED_ACTIVITY_CLASS:
        deriveActivityMarkers(slideModule.id, slideModule.responseKind, payload, textIds);
        break;
      default:
        throw new Error(`unsupported-generated-slide-module-kind:${slideModule.canonicalClass}`);
    }
  }
  return { moduleIds: modules.map((module) => module.id), textIds, formulaIds };
}

function deriveActivityMarkers(
  moduleId: string,
  responseKind: string | undefined,
  payload: Record<string, unknown>,
  textIds: string[],
) {
  if (!responseKind) throw new Error(`unsupported-generated-slide-response-kind:${moduleId}:missing`);
  textIds.push(generatedSlideTextMarkerId(moduleId, 'prompt'));
  switch (responseKind as GeneratedResponseKind) {
    case 'choice.single':
    case 'choice.multi':
      requiredRecordArray(payload.options).forEach((_option, index) => {
        textIds.push(generatedSlideTextMarkerId(moduleId, `options.${index}.label`));
      });
      return;
    case 'text.short':
    case 'text.long':
      if (typeof payload.placeholder === 'string' && payload.placeholder.trim()) {
        textIds.push(generatedSlideTextMarkerId(moduleId, 'placeholder'));
      }
      return;
    case 'ordering.sequence':
      requiredStringArray(payload.items).forEach((_item, index) => {
        textIds.push(generatedSlideTextMarkerId(moduleId, `items.${index}`));
      });
      return;
    case 'matching.pairs':
      for (const side of ['left', 'right'] as const) {
        requiredRecordArray(payload[side]).forEach((_option, index) => {
          textIds.push(generatedSlideTextMarkerId(moduleId, `${side}.${index}.label`));
        });
      }
      return;
    default:
      throw new Error(`unsupported-generated-slide-response-kind:${moduleId}:${responseKind}`);
  }
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('generated-slide-marker-invalid-string');
  return value;
}

function requiredArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('generated-slide-marker-invalid-array');
  return value;
}

function requiredStringArray(value: unknown): string[] {
  return requiredArray(value).map(requiredString);
}

function optionalStringArray(value: unknown): string[] {
  return value === undefined ? [] : requiredStringArray(value);
}

function requiredRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('generated-slide-marker-invalid-record');
  return value as Record<string, unknown>;
}

function requiredRecordArray(value: unknown): Record<string, unknown>[] {
  return requiredArray(value).map(requiredRecord);
}
