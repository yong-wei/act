## Overview

Implement a controlled recomputation command with two modes:

- `dry-run`: inspect historical submissions and print planned changes.
- `apply`: update only derived scoring context and trace fields.

The command consumes the shared scorer from
`standardize-manifest-objective-scoring`. It must stop if that scorer is not
available or if lesson identity cannot be resolved unambiguously.

## Data Sources

Primary source data:

- `InteractionLog` event payload and ids.
- `StudentStepResponse.responseData` immutable submissions.
- manifest objective metadata and reference answers.
- existing `LearningFact` context and source fields.

Mutable state such as `StudentState.data.responses` may be used only as a
diagnostic fallback, not as the main answer source.

## Update Policy

The apply mode may update:

- derived score and correctness fields.
- scoring version and scoring detail.
- sourceLogId when sourceEventId can be matched to a persisted log.
- recomputation audit metadata.

The apply mode must not overwrite raw submitted answers, event payloads,
attempt identity, or submitted timestamps.

## Reporting

Both modes should report lesson, session, step, question type, old score, new
score, correctness change, affected user count, and source-link repair count.

## Safety

The command must be idempotent. A second run with no new raw evidence should
produce no additional writes except harmless audit timestamps if explicitly
designed.
