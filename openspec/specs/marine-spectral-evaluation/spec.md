# marine-spectral-evaluation Specification

## Purpose
TBD - created by archiving change evaluate-marine-spectral-backends. Update Purpose after archive.
## Requirements
### Requirement: Spectral experiments isolate variables
Spectral evaluation SHALL separate wave-algorithm effects from renderer, material and resolution changes.

#### Scenario: Backends are compared
- **WHEN** the benchmark compares Gerstner, WebGL FFT and WebGPU FFT
- **THEN** the report states controlled variables, unresolved differences and actual hardware results

### Requirement: Experimental results do not activate production changes
This evaluation SHALL NOT change the production renderer or default ocean backend; adoption SHALL require a separate approved change.

#### Scenario: The experiment finds a promising result
- **WHEN** a spectral candidate improves selected metrics
- **THEN** the output is an evidence-based recommendation and production defaults remain unchanged

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

### Requirement: Spectral resolution preserves physical sea state
Spectral generation SHALL preserve declared energy, direction and frequency coverage when only numerical resolution changes.

#### Scenario: FFT resolution changes
- **WHEN** The same physical band and target sea state use 128, 256 and 512 samples
- **THEN** Measured Hs remains within the declared normalization tolerance rather than scaling with inverse sample count.

### Requirement: GPU ocean outputs have independent numerical validation
Implemented spectral candidates SHALL validate actual GPU height and derivative outputs against an independent reference.

#### Scenario: A small GPU transform is checked
- **WHEN** The runner executes a small transform with known modes
- **THEN** Read-back output meets the declared error bounds; a TypeScript stage mirror alone is insufficient.

