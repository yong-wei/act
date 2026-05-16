## 1. Black-Box Preset

- [ ] 1.1 Add a black-box identification preset module under `src/features/control-workbench/presets/`.
- [ ] 1.2 Add experiment controls that call `/api/arena/blackbox-experiments`.
- [ ] 1.3 Add experiment data and dataset summary views.
- [ ] 1.4 Add nominal model draft state tied to dataset hash.

## 2. Preview And Submission

- [ ] 2.1 Build black-box control artifacts from nominal model and controller draft state.
- [ ] 2.2 Add virtual simulation preview through `/api/arena/virtual-simulation-runs`.
- [ ] 2.3 Submit official black-box artifacts through `/api/arena/evaluate`.
- [ ] 2.4 Keep all nominal-model labels distinct from official target labels.

## 3. Verification

- [ ] 3.1 Add tests that black-box experiments use the persisted service path.
- [ ] 3.2 Add tests that foreign dataset hashes remain rejected.
- [ ] 3.3 Add UI/source tests that black-box frequency or response plots are labeled nominal.
