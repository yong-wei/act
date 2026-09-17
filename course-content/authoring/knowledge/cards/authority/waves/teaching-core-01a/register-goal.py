"""Register the reviewed modeling topic through existing static goal catalogs."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[7]
BATCH = Path(__file__).resolve().parent
review = json.loads((BATCH/'review-acceptance.json').read_text())
assert review['status'] == 'accepted', 'Independent card acceptance required first'
inventory = json.loads((BATCH/'inventory.json').read_text())
assert review['cardHashes'] == {c['canonicalId']: c['cardSha256'] for c in inventory['cards']}
goal = 'system-modeling-process-foundations'
base = ROOT/'src/features/personalization/path-planning'
edits = {}
def replace(path, old, new):
    source = edits.get(path, path.read_text())
    assert source.count(old) == 1, (str(path), old)
    edits[path] = source.replace(old, new)

replace(base/'registered-goal-ids.ts', "  'steady-state-control-foundations',", "  'steady-state-control-foundations',\n  'system-modeling-process-foundations',")
p = base/'goal-canonical-knowledge.ts'
source = p.read_text()
# Insert after existing final entry, preserving the explicit catalog order.
marker = '\n};'
assert source.count(marker) == 1
rows = ''.join("    { canonicalId: '"+c['canonicalId']+"', label: '"+c['name']+"' },\n" for c in inventory['cards'])
replace(p, marker, "\n  '"+goal+"': [\n"+rows+"  ],"+marker)
p = base/'internal/assemble-plan.ts'
marker = "  { id: 'steady-state-control-foundations', title: '稳态精度与PI基础', description: '区分系统型别、稳态误差与积分作用，理解PI的精度收益和动态代价。', knowledge: 'controller-correction' },"
replace(p, marker, marker+"\n  { id: 'system-modeling-process-foundations', title: '系统建模流程与适用边界', description: '明确建模目的、状态和简化假设，比较模型保真度与跨物理系统的相似条件。', knowledge: 'transfer-function-model' },")
replace(p, "    intentType: 'analysis', recommendedPhase: 'foundation',", "    intentType: topic.id === 'system-modeling-process-foundations' ? 'modeling' : 'analysis', recommendedPhase: 'foundation',")
p = base/'adaptive-path-goal-options-client.ts'
marker = '\n];'
replace(p, marker, "\n  { id: 'system-modeling-process-foundations', label: '系统建模流程与适用边界', detail: '明确建模目的、状态和简化假设，比较模型保真度与跨物理系统的相似条件。', intentType: 'modeling', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },"+marker)
p = ROOT/'src/lib/__tests__/adaptive-path-goal-options.test.ts'
replace(p, 'toHaveLength(12)', 'toHaveLength(13)')
replace(p, "      'steady-state-control-foundations',", "      'steady-state-control-foundations',\n      'system-modeling-process-foundations',")
p = base/'__tests__/goal-canonical-knowledge.test.ts'
replace(p, 'covers the twelve preset goals', 'covers the thirteen preset goals')
replace(p, "      'steady-state-control-foundations',", "      'steady-state-control-foundations',\n      'system-modeling-process-foundations',")
# Check every intended replacement before any write.
for path, content in edits.items():
    lines = content.splitlines(keepends=True)
    with path.open('w') as stream:
        for start in range(0, len(lines), 300):
            stream.writelines(lines[start:start+300])
print('Registered modeling goal and six reviewed canonical targets in existing catalogs')
