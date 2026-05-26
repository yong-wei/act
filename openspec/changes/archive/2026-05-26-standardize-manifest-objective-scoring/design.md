## Overview

Introduce a small shared scoring library that accepts manifest objective
metadata and a submitted answer payload, then returns a versioned scoring
result. Both browser telemetry construction and server materialization use the
same library.

## Scoring Result

The scorer should return:

- `scoringVersion`
- `kind`
- `answered`
- `score`
- `isCorrect`
- `normalizedSubmitted`
- `normalizedReference`
- `detail`
- `unsupportedReason`, when scoring cannot be performed

Raw student answers remain stored separately and are not overwritten by
normalized values.

## Objective Rules

- Single choice and boolean: exact normalized option equality.
- Multi-select: compare selected option sets; report correct hits, missed
  correct options, and extra wrong options.
- Ordering: compare item order structurally and report full or partial order
  credit.
- Matching: normalize each pair by the prompt-side item, compare answer-side
  values per pair, and ignore submitted pair order.

## Compatibility

The shared scorer must preserve unsupported scoring semantics already required
by manifest submission evidence. Missing reference answers produce explicit
unsupported results, not zero scores.

## Test Strategy

Tests should exercise the scorer directly and through both current callers. The
matching regression must cover submitted pairs in a different order from the
reference.
