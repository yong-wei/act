## Why

Black-box workbench flow is functional, but Arena Pro needs it to teach engineering reality: experiments have cost, nominal models are uncertain, virtual preview is not official evaluation, and hidden scenarios test generalization.

## What Changes

- Add black-box experiment budget and coverage feedback.
- Explain nominal-model confidence and preview-to-official mismatch.
- Strengthen black-box result feedback without revealing hidden target details.

## Capabilities

### New Capabilities

- `arena-blackbox-engineering-training`

### Modified Capabilities

- None.

## Impact

- `src/features/control-workbench/presets/blackbox-identification-preset.tsx`
- Black-box experiment and virtual simulation APIs
- `src/features/arena/submissions/*black*`
- `prisma/schema.prisma` if additional budget or confidence persistence is required
