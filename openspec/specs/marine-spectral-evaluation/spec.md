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

