export const CANONICAL_INTERACTIVE_RESPONSE_KINDS = [
  'choice.single',
  'choice.binary',
  'choice.multi',
  'text.short',
  'text.long',
  'text.structured',
  'parameter.set',
  'ordering.sequence',
  'matching.pairs',
  'table.builder',
  'simulation.result',
  'training.result',
] as const;

export type InteractiveResponseKind = typeof CANONICAL_INTERACTIVE_RESPONSE_KINDS[number];

export type InteractiveResponseCategory =
  | 'objective'
  | 'subjective'
  | 'parameter'
  | 'simulation'
  | 'training';

export type InteractiveResponseScoringMode = 'objective' | 'subjective' | 'unsupported';

export interface InteractiveResponseKindMetadata {
  kind: InteractiveResponseKind;
  category: InteractiveResponseCategory;
  scoring: InteractiveResponseScoringMode;
}

export interface ResolvedInteractiveResponseKind extends InteractiveResponseKindMetadata {
  legacyResponseKind?: string;
}

const CANONICAL_RESPONSE_KIND_SET = new Set<string>(CANONICAL_INTERACTIVE_RESPONSE_KINDS);

const RESPONSE_KIND_ALIASES: Record<string, InteractiveResponseKind> = {
  single_choice: 'choice.single',
  singlechoice: 'choice.single',
  binary_choice: 'choice.binary',
  binarychoice: 'choice.binary',
  true_false: 'choice.binary',
  truefalse: 'choice.binary',
  multi_choice: 'choice.multi',
  multichoice: 'choice.multi',
  multi_select: 'choice.multi',
  multiselect: 'choice.multi',
  fill_text: 'text.short',
  freetext: 'text.short',
  free_text: 'text.short',
  observation_text: 'text.short',
  observationtext: 'text.short',
  short_response: 'text.short',
  shortresponse: 'text.short',
  short_text: 'text.short',
  shorttext: 'text.short',
  text: 'text.short',
  long_text: 'text.long',
  longtext: 'text.long',
  structured: 'text.structured',
  structured_response: 'text.structured',
  structuredresponse: 'text.structured',
  structured_submit: 'text.structured',
  structuredsubmit: 'text.structured',
  parameter_record: 'parameter.set',
  parameterrecord: 'parameter.set',
  parameter_set: 'parameter.set',
  parameterset: 'parameter.set',
  drag_sort: 'ordering.sequence',
  dragsort: 'ordering.sequence',
  card_sort: 'ordering.sequence',
  cardsort: 'ordering.sequence',
  sorting: 'ordering.sequence',
  drag_match: 'matching.pairs',
  dragmatch: 'matching.pairs',
  match: 'matching.pairs',
  matching: 'matching.pairs',
  triple_match: 'matching.pairs',
  triplematch: 'matching.pairs',
  table: 'table.builder',
  table_builder: 'table.builder',
  tablebuilder: 'table.builder',
  simulation_result: 'simulation.result',
  simulationresult: 'simulation.result',
  training_result: 'training.result',
  trainingresult: 'training.result',
};

const RESPONSE_KIND_METADATA: Record<InteractiveResponseKind, InteractiveResponseKindMetadata> = {
  'choice.single': {
    kind: 'choice.single',
    category: 'objective',
    scoring: 'objective',
  },
  'choice.binary': {
    kind: 'choice.binary',
    category: 'objective',
    scoring: 'objective',
  },
  'choice.multi': {
    kind: 'choice.multi',
    category: 'objective',
    scoring: 'objective',
  },
  'text.short': {
    kind: 'text.short',
    category: 'subjective',
    scoring: 'subjective',
  },
  'text.long': {
    kind: 'text.long',
    category: 'subjective',
    scoring: 'subjective',
  },
  'text.structured': {
    kind: 'text.structured',
    category: 'subjective',
    scoring: 'subjective',
  },
  'parameter.set': {
    kind: 'parameter.set',
    category: 'parameter',
    scoring: 'unsupported',
  },
  'ordering.sequence': {
    kind: 'ordering.sequence',
    category: 'objective',
    scoring: 'objective',
  },
  'matching.pairs': {
    kind: 'matching.pairs',
    category: 'objective',
    scoring: 'objective',
  },
  'table.builder': {
    kind: 'table.builder',
    category: 'subjective',
    scoring: 'subjective',
  },
  'simulation.result': {
    kind: 'simulation.result',
    category: 'simulation',
    scoring: 'unsupported',
  },
  'training.result': {
    kind: 'training.result',
    category: 'training',
    scoring: 'unsupported',
  },
};

function aliasKey(value: string): string {
  return value.trim().replace(/-/g, '_').toLowerCase();
}

function tryNormalizeInteractiveResponseKind(value: string | null | undefined): InteractiveResponseKind | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (isCanonicalInteractiveResponseKind(raw)) return raw;
  return RESPONSE_KIND_ALIASES[aliasKey(raw)] ?? null;
}

export function isCanonicalInteractiveResponseKind(value: string): value is InteractiveResponseKind {
  return CANONICAL_RESPONSE_KIND_SET.has(value);
}

export function normalizeInteractiveResponseKind(value: string | null | undefined): InteractiveResponseKind {
  const kind = tryNormalizeInteractiveResponseKind(value);
  if (kind) return kind;
  const raw = String(value ?? '').trim();
  throw new Error(raw ? `Unknown interactive response kind: ${raw}` : 'Missing interactive response kind');
}

export function getInteractiveResponseKindMetadata(
  value: string | null | undefined,
): InteractiveResponseKindMetadata {
  return RESPONSE_KIND_METADATA[normalizeInteractiveResponseKind(value)];
}

export function resolveInteractiveResponseKind(value: string | null | undefined): ResolvedInteractiveResponseKind {
  const raw = String(value ?? '').trim();
  const kind = normalizeInteractiveResponseKind(raw);
  const metadata = RESPONSE_KIND_METADATA[kind];
  return {
    ...metadata,
    ...(raw && raw !== kind ? { legacyResponseKind: raw } : {}),
  };
}

export function isObjectiveInteractiveResponseKind(value: string | null | undefined): boolean {
  const kind = tryNormalizeInteractiveResponseKind(value);
  return kind ? RESPONSE_KIND_METADATA[kind].scoring === 'objective' : false;
}

export function isSubjectiveInteractiveResponseKind(value: string | null | undefined): boolean {
  const kind = tryNormalizeInteractiveResponseKind(value);
  return kind ? RESPONSE_KIND_METADATA[kind].category === 'subjective' : false;
}

export function isChoiceSingleResponseKind(value: string | null | undefined): boolean {
  const kind = tryNormalizeInteractiveResponseKind(value);
  return kind === 'choice.single' || kind === 'choice.binary';
}

export function isChoiceMultiResponseKind(value: string | null | undefined): boolean {
  return tryNormalizeInteractiveResponseKind(value) === 'choice.multi';
}

export function isOrderingResponseKind(value: string | null | undefined): boolean {
  return tryNormalizeInteractiveResponseKind(value) === 'ordering.sequence';
}

export function isMatchingResponseKind(value: string | null | undefined): boolean {
  return tryNormalizeInteractiveResponseKind(value) === 'matching.pairs';
}

export function isParameterSetResponseKind(value: string | null | undefined): boolean {
  return tryNormalizeInteractiveResponseKind(value) === 'parameter.set';
}
