## ADDED Requirements

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
