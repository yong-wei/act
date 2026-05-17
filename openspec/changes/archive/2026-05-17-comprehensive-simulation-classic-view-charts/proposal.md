## Why

The classic four-view workbench still compresses time-domain curves under fixed ranges and does not consistently show the reference signal. Root-locus and Nyquist views also need explicit before/after correction switching when correction is enabled.

## What Changes

- Auto-range the time-domain response axis from the visible curve extrema with approximately 10% visual margin.
- Show the reference input signal in the time-domain view as a dashed curve.
- Align legend color and line-style samples with the actual uncorrected output, corrected output, and reference curves.
- Allow root-locus view to switch between uncorrected and corrected sources when correction is enabled.
- Allow Nyquist view to switch between uncorrected and corrected sources when correction is enabled.
- Keep free exploration and Arena challenge contexts on the same classic four-view behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `control-workbench-view-configuration`: time-domain signal visibility, auto range, legend styling, and root-locus/Nyquist source switching.

## Impact

- Affected frontend areas:
  - classic four-view preset and embedded multi-representation chart client
  - time-domain chart scaling and legend rendering
  - root-locus and Nyquist source selection controls
  - view configuration tests and at least one browser rendering check
