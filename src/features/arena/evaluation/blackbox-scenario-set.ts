export interface CruiseRollHiddenScenario {
  id: string;
  duration: number;
  sampleTime: number;
  initialRoll: number;
  disturbanceAmplitude: number;
  disturbanceFrequency: number;
  disturbancePhase: number;
  secondaryDisturbanceAmplitude: number;
  rollLimit: number;
  controlLimit: number;
  model: {
    damping: number;
    stiffness: number;
    controlEffectiveness: number;
  };
}

export interface CruiseRollHiddenScenarioSet {
  id: string;
  scenarios: readonly CruiseRollHiddenScenario[];
}

export const CRUISE_ROLL_HIDDEN_OFFICIAL_SCENARIO_SET_ID = 'cruise-roll-hidden-official-v1';

export const CRUISE_ROLL_HIDDEN_OFFICIAL_SCENARIO_SET: CruiseRollHiddenScenarioSet = {
  id: CRUISE_ROLL_HIDDEN_OFFICIAL_SCENARIO_SET_ID,
  scenarios: [
    {
      id: 'official-hidden-1',
      duration: 14,
      sampleTime: 0.2,
      initialRoll: 0.12,
      disturbanceAmplitude: 0.06,
      disturbanceFrequency: 0.7,
      disturbancePhase: 0.4,
      secondaryDisturbanceAmplitude: 0.02,
      rollLimit: 0.75,
      controlLimit: 5,
      model: { damping: 0.72, stiffness: 1.18, controlEffectiveness: 0.68 },
    },
    {
      id: 'official-hidden-2',
      duration: 16,
      sampleTime: 0.2,
      initialRoll: -0.18,
      disturbanceAmplitude: 0.085,
      disturbanceFrequency: 0.92,
      disturbancePhase: 1.1,
      secondaryDisturbanceAmplitude: 0.035,
      rollLimit: 0.75,
      controlLimit: 4.5,
      model: { damping: 0.64, stiffness: 1.06, controlEffectiveness: 0.62 },
    },
    {
      id: 'official-hidden-3',
      duration: 18,
      sampleTime: 0.2,
      initialRoll: 0.24,
      disturbanceAmplitude: 0.07,
      disturbanceFrequency: 0.55,
      disturbancePhase: 2.2,
      secondaryDisturbanceAmplitude: 0.04,
      rollLimit: 0.75,
      controlLimit: 4.8,
      model: { damping: 0.58, stiffness: 0.98, controlEffectiveness: 0.58 },
    },
  ],
};
