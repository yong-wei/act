# Design: Qwen SmartLesson Duration Correction

## Generation Prompt

The shared system instruction requires the model to recalculate every nested
`steps.minutes` total before emitting JSON. The stage request adds the expected
stage duration when the confirmed outline is available. Outline generation
retains the whole-lesson duration invariant.

If an older or incomplete outline cannot be parsed, stage generation keeps the
existing request path and uses a generic arithmetic reminder rather than
failing before the provider call.

## Correction Prompt

For a sole `stage-step-duration-mismatch`, the worker reads the expected stage
duration from the outline and the actual total from the validation message.
When the candidate contains a usable step array, it also computes a positive
integer allocation whose length matches the original step count and whose sum
equals the expected duration. The correction instruction tells the model to
apply that allocation while preserving semantic fields and source bindings.

If the candidate does not expose a usable step array, or its step count is
greater than the authoritative stage duration and therefore cannot receive
positive integer minutes, the targeted context omits the allocation. The
correction instruction then permits merging or reducing steps while retaining
the original teaching semantics and source bindings, and still requires exact
sum equality.

## Compatibility

The Zod schemas and deterministic duration gates remain unchanged. The model,
provider configuration, correction count, and persistence contract remain
unchanged. The prompt version changes so provider-attempt audit records
distinguish the new request contract.
