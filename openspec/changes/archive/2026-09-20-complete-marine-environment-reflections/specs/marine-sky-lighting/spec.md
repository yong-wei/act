## ADDED Requirements

### Requirement: Water is an actual consumer of shared sky radiance
The custom water material SHALL sample the declared shared environment radiance rather than substituting a constant horizon color for environment reflection.

#### Scenario: The QA environment contains a directional diagnostic feature
- **WHEN** the environment feature changes direction with world sun and water geometry fixed
- **THEN** water and ship environment reflections follow the feature consistently while the direct sun highlight remains attributable to the sun

### Requirement: Sky translation and atmospheric depth are coherent
The distant sky SHALL avoid finite-world translation parallax, and active water materials SHALL participate in the declared atmospheric depth treatment.

#### Scenario: The camera translates through the operating area
- **WHEN** the camera moves while world objects remain fixed
- **THEN** the sky remains effectively distant, nearby objects retain correct parallax, and water and ship fog remain coherent
