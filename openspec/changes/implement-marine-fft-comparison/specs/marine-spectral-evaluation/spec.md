## ADDED Requirements

### Requirement: Spectral candidates execute a real GPU ocean pipeline
A candidate reported as implemented SHALL execute spectral evolution, a two-dimensional inverse FFT and a rendered displacement or normal output in the declared backend.

#### Scenario: The WebGL FFT candidate is selected
- **WHEN** the experiment switches from Gerstner to WebGL FFT
- **THEN** a real GPU FFT-produced surface is drawn with the controlled vessel and scene, rather than only changing report metadata

### Requirement: Comparison reports consume executed measurements
The comparison runner SHALL consume actual scenario measurements and SHALL not overwrite completed measurements with an all-null skeleton.

#### Scenario: Two supported candidates have valid measurements
- **WHEN** another backend is unsupported on the tested device
- **THEN** the report preserves the valid pairwise comparison and identifies the unsupported or incomplete backend separately

### Requirement: Experimental completion requires observed outcomes
A keep-current-path recommendation SHALL not by itself establish completion when runnable candidates or measurements are absent.

#### Scenario: A completion decision is reviewed
- **WHEN** the team proposes to close the experimental work
- **THEN** actual runnable-candidate evidence, controlled dynamic comparisons and measured tradeoffs are present, and missing implementation or hardware tests remain explicitly unresolved
