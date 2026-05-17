## 1. Black-Box Preset

- [x] 1.1 Add a black-box identification preset module under `src/features/control-workbench/presets/`.
- [x] 1.2 Add experiment controls that call `/api/arena/blackbox-experiments`.
- [x] 1.3 Add experiment data and dataset summary views.
- [x] 1.4 Add nominal model draft state tied to dataset hash.

## 2. Preview And Submission

- [x] 2.1 Build black-box control artifacts from nominal model and controller draft state.
- [x] 2.2 Add virtual simulation preview through `/api/arena/virtual-simulation-runs`.
- [x] 2.3 Submit official black-box artifacts through `/api/arena/evaluate`.
- [x] 2.4 Keep all nominal-model labels distinct from official target labels.

## 3. Verification

- [x] 3.1 Add tests that black-box experiments use the persisted service path.
- [x] 3.2 Add tests that foreign dataset hashes remain rejected.
- [x] 3.3 Add UI/source tests that black-box frequency or response plots are labeled nominal.
