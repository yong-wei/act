import { describe, expect, it } from 'vitest';

import {
  buildTeacherClassInsightsHref,
  buildTeacherHistoryHref,
  formatTeacherStudentDisplayId,
  buildTeacherStudentInsightsHref,
  rankStudentsByAttention,
  summarizeGovernanceState,
  type TeacherStudentInsightSummary,
} from '../teacher-insights';

describe('teacher-insights helpers', () => {
  it('builds the class insights route with class context', () => {
    expect(buildTeacherClassInsightsHref('class-42')).toBe('/teacher/classes/class-42/analytics-v2');
  });

  it('builds the student insights route nested under the class', () => {
    expect(buildTeacherStudentInsightsHref('class-42', 'student-9')).toBe('/teacher/classes/class-42/students/student-9');
  });

  it('builds the teacher history route', () => {
    expect(buildTeacherHistoryHref()).toBe('/teacher/history');
  });

  it('summarizes governance progress from coverage and freshness', () => {
    expect(
      summarizeGovernanceState({
        totalStudents: 40,
        coveredStudents: 32,
        classSnapshotAt: '2026-03-19T07:00:00.000Z',
        latestStudentSnapshotAt: '2026-03-19T07:10:00.000Z',
        now: new Date('2026-03-19T07:18:00.000Z'),
      })
    ).toMatchObject({
      tone: 'healthy',
      label: '治理结果可用',
      coverageRatio: 0.8,
    });
  });

  it('marks governance as pending when no student has been covered yet', () => {
    expect(
      summarizeGovernanceState({
        totalStudents: 18,
        coveredStudents: 0,
        classSnapshotAt: null,
        latestStudentSnapshotAt: null,
        now: new Date('2026-03-19T07:18:00.000Z'),
      })
    ).toMatchObject({
      tone: 'pending',
      label: '治理结果待生成',
      coverageRatio: 0,
    });
  });

  it('ranks students by risk first, then by overall score and growth activity', () => {
    const students: TeacherStudentInsightSummary[] = [
      {
        id: 'low-risk',
        name: '低风险学生',
        overallScore: 81,
        overallLevel: '良好',
        riskLevel: 'low',
        trendDirection: 'up',
        recentTrend: '稳步提升',
        growthRecordCount: 3,
        recommendationCount: 1,
        strengths: [],
        weaknesses: [],
      },
      {
        id: 'high-risk',
        name: '高风险学生',
        overallScore: 58,
        overallLevel: '需关注',
        riskLevel: 'high',
        trendDirection: 'down',
        recentTrend: '明显下滑',
        growthRecordCount: 0,
        recommendationCount: 4,
        strengths: [],
        weaknesses: ['跨域迁移'],
      },
      {
        id: 'medium-risk',
        name: '中风险学生',
        overallScore: 58,
        overallLevel: '中等',
        riskLevel: 'medium',
        trendDirection: 'stable',
        recentTrend: '表现平稳',
        growthRecordCount: 1,
        recommendationCount: 2,
        strengths: [],
        weaknesses: ['参数调优'],
      },
    ];

    expect(rankStudentsByAttention(students).map((student) => student.id)).toEqual([
      'high-risk',
      'medium-risk',
      'low-risk',
    ]);
  });

  it('prefers student number when formatting the display identifier', () => {
    expect(formatTeacherStudentDisplayId({
      studentNumber: '2024001001',
      email: 'student@example.com',
      fallbackId: 'abcdef123456',
    })).toBe('2024001001');
  });

  it('falls back to email and shortened id when student number is missing', () => {
    expect(formatTeacherStudentDisplayId({
      studentNumber: null,
      email: 'student@example.com',
      fallbackId: 'abcdef123456',
    })).toBe('student@example.com');

    expect(formatTeacherStudentDisplayId({
      studentNumber: null,
      email: null,
      fallbackId: 'abcdef123456',
    })).toBe('abcdef12');
  });
});
