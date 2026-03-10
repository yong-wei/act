import assert from 'node:assert/strict';
import { adminStatesMockData } from '../../src/features/admin/states/stats-data';

function main() {
  assert.equal(adminStatesMockData.userScale.teachers, 18, '教师人数必须为 18');
  assert.equal(adminStatesMockData.userScale.students, 1890, '学生人数必须为 1890');
  assert.equal(adminStatesMockData.interactionByType.length, 6, '互动环节应为前 6 项');
  assert.equal(
    adminStatesMockData.simulationVisits.length,
    7,
    '仿真访问量必须按 7 个仿真分别统计'
  );
  assert.ok(
    adminStatesMockData.controlOdysseyVisits > Math.max(...adminStatesMockData.simulationVisits.map((item) => item.visits)),
    '控制奥德赛访问量应显著高于单个仿真'
  );
  for (const item of adminStatesMockData.interactionByType) {
    assert.ok(item.avgPerStudent >= 2 && item.avgPerStudent <= 3, `互动环节 ${item.type} 人均次数应在 2-3 次`);
  }

  for (const item of adminStatesMockData.simulationVisits) {
    const avg = item.visits / adminStatesMockData.userScale.students;
    assert.ok(avg >= 3 && avg <= 8, `仿真 ${item.simulation} 人均访问应在 3-8 次`);
  }

  console.log('admin states mock data test passed');
}

main();
