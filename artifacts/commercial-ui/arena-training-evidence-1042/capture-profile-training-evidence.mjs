import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const baseUrl = process.env.ARENA_UI_EVIDENCE_BASE_URL ?? 'http://localhost:3011';
const outputDirectory = dirname(fileURLToPath(import.meta.url));
const artifactDirectory = 'artifacts/commercial-ui/arena-training-evidence-1042';
const profileFixture = {
  user: {
    id: 'evidence-student-1042',
    name: 'UI Evidence Student',
    email: 'evidence-student@example.test',
    role: 'STUDENT',
  },
  profile: {
    studentNumber: '20261042',
    classId: 'class-evidence',
    className: 'Control Systems',
    techScore: 84,
    ethicsScore: 96,
  },
  statistics: {
    totalSimulations: 0,
    completedMissions: 0,
    ethicalViolations: 0,
    totalSimulationTime: 0,
    averageScore: 0,
  },
  competency: {
    model: 'portrait-v2-cumulative',
    availability: { state: 'SNAPSHOT', reason: 'available' },
    limitations: [],
    overallScore: 76,
    level: 'Developing',
    confidence: 0.74,
    lastTrend: 'stable',
    lastRisk: [],
    evidenceAsOf: '2026-07-25T00:00:00.000Z',
    generatedAt: '2026-07-25T00:00:00.000Z',
    strengths: ['Modeling'],
    improvementAreas: ['PID tuning'],
    dimensions: [],
  },
  latestActivity: { preview: [], grouped: [], total: 0 },
  missionProgress: { total: 0, completed: 0, unlocked: 0, locked: 0 },
  personalizedReinforcement: {
    resources: [],
    adaptivePractice: {
      estimatedAbility: null,
      confidenceInterval: null,
      weakAreas: [],
      recommendedFocus: [],
      questionCount: 0,
      actionUrl: '/assessment/adaptive-practice?intent=practice',
    },
  },
  arenaPortfolio: {
    userId: 'evidence-student-1042',
    controllerCount: 0,
    methodDistribution: [],
    identificationModels: [],
    submissionSummary: { total: 0, valid: 0, invalid: 0 },
    recentSubmissions: [],
    personalBestByTask: [],
    frequentFailureObjects: [],
    improvingMetrics: [],
    growth: {
      evidenceAvailable: false,
      capabilityCoverage: { covered: 0, total: 0 },
      weakCapabilities: [],
      improvingCapabilities: [],
      strongCapabilities: [],
      capabilitySignals: [],
      nextChallenges: [],
    },
    trainingSummary: {
      total: 6,
      recentWindowSize: 5,
      recentPreviewCount: 3,
      latestTrainedAt: '2026-07-25T00:00:00.000Z',
      recentAverageQualityScore: 84,
      recentRuns: [
        {
          id: 'training-1',
          taskId: 'task-cruise-roll-blackbox-identification',
          taskTitle: 'Cruise roll black-box identification',
          scenarioId: 'cruise-roll-controller-preview',
          simulationRunId: 'simulation-run-1',
          qualityScore: 88,
          preview: true,
          officialEligible: false,
          trainedAt: '2026-07-25T00:00:00.000Z',
        },
        {
          id: 'training-2',
          taskId: 'task-second-order-lead-pid',
          taskTitle: 'Second-order lead PID',
          scenarioId: 'second-order-lead-preview',
          simulationRunId: 'simulation-run-2',
          qualityScore: 84,
          preview: true,
          officialEligible: false,
          trainedAt: '2026-07-24T00:00:00.000Z',
        },
        {
          id: 'training-3',
          taskId: 'task-ship-heading-pid-turn',
          taskTitle: 'Ship heading PID turn',
          scenarioId: 'ship-heading-preview',
          simulationRunId: 'simulation-run-3',
          qualityScore: 80,
          preview: true,
          officialEligible: false,
          trainedAt: '2026-07-23T00:00:00.000Z',
        },
      ],
    },
  },
};

const expectedLabels = {
  training: '\u865a\u62df\u4eff\u7711\u8bad\u7ec3',
  preview: '\u975e\u5b98\u65b9\u9884\u89c8',
  run: 'Cruise roll black-box identification',
};
const expectedFragments = [
  '\u5df2\u8bb0\u5f55 6 \u6b21\u8bad\u7ec3',
  '\u6700\u8fd1 5 \u6b21\u5e73\u5747\u8d28\u91cf 84 \u5206',
];
