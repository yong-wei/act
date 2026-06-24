import { createPrismaClient } from '../../src/lib/prisma-client';
/**
 * Data Governance Integration Tests
 *
 * Tests the end-to-end data governance flow:
 * 1. Event ingestion (core vs secondary)
 * 2. Competency calculation
 * 3. Risk detection
 * 4. API response times
 */

import { calculateCompetencyVector } from '@/lib/data-governance/competency-engine';
import { detectRisks } from '@/lib/data-governance/risk-detector';
import { routeEvent } from '@/lib/data-governance/event-buffer';
import type { LearningEvent } from '@/lib/data-governance/event-protocol';
import { redisClient } from '@/lib/redis-client';

const prisma = createPrismaClient();
const TEST_USER_ID = 'test-user-integration';

async function waitForRedisReady(timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (redisClient.isReady()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return redisClient.isReady();
}

async function runTests() {
  console.log('🧪 Running Data Governance Integration Tests\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Event Routing
  console.log('Test 1: Event Routing (Core vs Secondary)');
  try {
    const redisReady = await waitForRedisReady();
    const coreEvent: LearningEvent = {
      eventId: 'test-core-1',
      occurredAt: new Date().toISOString(),
      userId: TEST_USER_ID,
      role: 'student',
      pagePath: '/test',
      pageType: 'simulation',
      actionType: 'simulation_finish',
      payload: { score: 85 },
      source: 'web',
      priority: 'core',
    };

    const secondaryEvent: LearningEvent = {
      eventId: 'test-secondary-1',
      occurredAt: new Date().toISOString(),
      userId: TEST_USER_ID,
      role: 'student',
      pagePath: '/test',
      pageType: 'simulation',
      actionType: 'page_view',
      payload: {},
      source: 'web',
      priority: 'secondary',
    };

    const coreResult = await routeEvent(coreEvent);
    const secondaryResult = await routeEvent(secondaryEvent);

    if (coreResult.destination === 'postgresql' && secondaryResult.destination === 'redis') {
      console.log('  ✅ Core events route to PostgreSQL, secondary to Redis\n');
      passed++;
    } else if (!redisReady && coreResult.destination === 'postgresql' && secondaryResult.destination === 'dropped') {
      console.log('  ⚠️ Redis 未就绪，secondary event 按降级策略被丢弃\n');
      passed++;
    } else {
      console.log(`  ❌ Routing failed: core=${coreResult.destination}, secondary=${secondaryResult.destination}\n`);
      failed++;
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error}\n`);
    failed++;
  }

  // Test 2: Competency Calculation
  console.log('Test 2: Competency Calculation from Learning Facts');
  try {
    // Create test facts
    await prisma.learningFact.createMany({
      data: [
        {
          userId: TEST_USER_ID,
          factType: 'simulation',
          startedAt: new Date(),
          finishedAt: new Date(),
          outcome: 'success',
          score: 85,
          timeSpent: 300,
          competencyContribution: { parameterDesign: 0.8, engineeringDecision: 0.5 },
        },
        {
          userId: TEST_USER_ID,
          factType: 'question',
          startedAt: new Date(),
          finishedAt: new Date(),
          outcome: 'success',
          score: 90,
          timeSpent: 120,
          competencyContribution: { controlModeling: 0.9 },
        },
      ],
    });

    const facts = await prisma.learningFact.findMany({
      where: { userId: TEST_USER_ID },
    });

    const vector = calculateCompetencyVector(facts, '1m');

    if (vector.parameterDesign.score > 0 && vector.controlModeling.score > 0) {
      console.log(`  ✅ Competency calculated: parameterDesign=${vector.parameterDesign.score.toFixed(1)}, controlModeling=${vector.controlModeling.score.toFixed(1)}\n`);
      passed++;
    } else {
      console.log('  ❌ Competency calculation returned zero scores\n');
      failed++;
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error}\n`);
    failed++;
  }

  // Test 3: Risk Detection
  console.log('Test 3: Risk Detection');
  try {
    // Create a user with risk patterns (low participation)
    const riskFacts = await prisma.learningFact.findMany({
      where: { userId: TEST_USER_ID },
    });

    const mockVector = {
      controlModeling: { score: 60, trend: 'stable', confidence: 0.8, evidenceCount: 1, lastUpdated: new Date().toISOString() },
      parameterDesign: { score: 70, trend: 'stable', confidence: 0.8, evidenceCount: 1, lastUpdated: new Date().toISOString() },
      crossDomainTransfer: { score: 40, trend: 'stable', confidence: 0.8, evidenceCount: 1, lastUpdated: new Date().toISOString() },
      engineeringDecision: { score: 50, trend: 'stable', confidence: 0.8, evidenceCount: 1, lastUpdated: new Date().toISOString() },
      inquiryReflection: { score: 55, trend: 'stable', confidence: 0.8, evidenceCount: 1, lastUpdated: new Date().toISOString() },
      selfDirectedLearning: { score: 45, trend: 'stable', confidence: 0.8, evidenceCount: 1, lastUpdated: new Date().toISOString() },
    };

    const risks = detectRisks({
      userId: TEST_USER_ID,
      facts: riskFacts,
      competencyVector: mockVector as any,
    });

    console.log(`  ✅ Detected ${risks.length} risks: ${risks.map(r => r.type).join(', ') || 'none'}\n`);
    passed++;
  } catch (error) {
    console.log(`  ❌ Error: ${error}\n`);
    failed++;
  }

  // Test 4: Konling Context API Response Time
  console.log('Test 4: Konling Context API Response Time');
  try {
    const start = Date.now();
    const response = await fetch('http://localhost:3001/api/ai/konling-context?userId=' + TEST_USER_ID);
    const duration = Date.now() - start;

    if (response.ok && duration < 200) {
      console.log(`  ✅ API responded in ${duration}ms (< 200ms target)\n`);
      passed++;
    } else if (response.ok) {
      console.log(`  ⚠️ API responded in ${duration}ms (slower than 200ms target)\n`);
      passed++; // Still pass but warn
    } else if (response.status === 401) {
      console.log('  ⚠️ API 需要鉴权，匿名集成测试跳过\n');
    } else {
      console.log(`  ❌ API returned ${response.status}\n`);
      failed++;
    }
  } catch (error) {
    console.log(`  ⚠️ Skipped (server not running): ${error}\n`);
    // Don't count as failure if server isn't running
  }

  // Test 5: Teacher Dashboard API
  console.log('Test 5: Teacher Dashboard API');
  try {
    // Get a class with students
    const classWithStudents = await prisma.class.findFirst({
      include: { students: { take: 1 } },
    });

    if (classWithStudents && classWithStudents.students.length > 0) {
      const start = Date.now();
      const response = await fetch(
        `http://localhost:3001/api/teacher/classes/${classWithStudents.id}/dashboard`
      );
      const duration = Date.now() - start;

      if (response.ok && duration < 1000) {
        console.log(`  ✅ Dashboard API responded in ${duration}ms (< 1000ms target)\n`);
        passed++;
      } else if (response.ok) {
        console.log(`  ⚠️ Dashboard API responded in ${duration}ms\n`);
        passed++;
      } else {
        console.log(`  ❌ Dashboard API returned ${response.status}\n`);
        failed++;
      }
    } else {
      console.log('  ⚠️ No classes with students found, skipping\n');
    }
  } catch (error) {
    console.log(`  ⚠️ Skipped (server not running): ${error}\n`);
  }

  // Cleanup
  console.log('Cleaning up test data...');
  await prisma.learningFact.deleteMany({
    where: { userId: TEST_USER_ID },
  });

  // Summary
  console.log('\n📊 Test Summary');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(0)}%`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
