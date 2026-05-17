## 1. Time-Domain Chart Behavior

- [ ] 1.1 Add tests for y-axis bounds derived from visible finite curve extrema with about 10% margin.
- [ ] 1.2 Display the reference input signal as a dashed curve in the time-domain response view.
- [ ] 1.3 Unify curve style and legend style definitions for reference, uncorrected output, and corrected output.

## 2. Correction Source Switching

- [ ] 2.1 Add root-locus source switching between uncorrected and corrected views when correction is enabled.
- [ ] 2.2 Add Nyquist source switching between uncorrected and corrected views when correction is enabled.
- [ ] 2.3 Keep source-switch behavior shared by free-explore and Arena challenge contexts.

## 3. Validation

- [ ] 3.1 Run `openspec validate comprehensive-simulation-classic-view-charts --strict`.
- [ ] 3.2 Run targeted chart and view-configuration tests.
- [ ] 3.3 Run at least one browser rendering check for the classic four-view chart surface.
