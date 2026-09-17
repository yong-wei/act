"""Register the reviewed physical modeling topic through existing static goal catalogs."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[7]
BATCH = Path(__file__).resolve().parent
review = json.loads((BATCH/'review-acceptance.json').read_text())
assert review['status'] == 'accepted', 'Independent card acceptance required first'
inventory = json.loads((BATCH/'inventory.json').read_text())
assert review['cardHashes'] == {c['canonicalId']: c['cardSha256'] for c in inventory['cards']}
goal = 'physical-modeling-interconnection-foundations'
base = ROOT/'src/features/personalization/path-planning'
edits = {}
def replace(path, old, new):
    source = edits.get(path, path.read_text())
    assert source.count(old) == 1, (str(path), old)
    edits[path] = source.replace(old, new)

replace(base/'registered-goal-ids.ts', "  'system-modeling-process-foundations',", "  'system-modeling-process-foundations',\n  'physical-modeling-interconnection-foundations',")
p = base/'goal-canonical-knowledge.ts'
source = p.read_text()
# Insert after existing final entry, preserving the explicit catalog order.
marker = '\n};'
assert source.count(marker) == 1
rows = ''.join("    { canonicalId: '"+c['canonicalId']+"', label: '"+c['name']+"' },\n" for c in inventory['cards'])
replace(p, marker, "\n  '"+goal+"': [\n"+rows+"  ],"+marker)
p = base/'internal/assemble-plan.ts'
marker = "  { id: 'system-modeling-process-foundations', title: '系统建模流程与适用边界', description: '明确建模目的、状态和简化假设，比较模型保真度与跨物理系统的相似条件。', knowledge: 'transfer-function-model' },"
replace(p, marker, marker+"\n  { id: 'physical-modeling-interconnection-foundations', title: '物理系统与互连建模', description: '从受力和守恒关系建立模型，辨别串并联、负载效应及测量环节的适用条件。', knowledge: 'transfer-function-model' },")
replace(p, "    intentType: topic.id === 'system-modeling-process-foundations' ? 'modeling' : 'analysis', recommendedPhase: 'foundation',", "    intentType: ['system-modeling-process-foundations', 'physical-modeling-interconnection-foundations'].includes(topic.id) ? 'modeling' : 'analysis', recommendedPhase: 'foundation',")
p = base/'adaptive-path-goal-options-client.ts'
marker = '\n];'
replace(p, marker, "\n  { id: 'physical-modeling-interconnection-foundations', label: '物理系统与互连建模', detail: '从受力和守恒关系建立模型，辨别串并联、负载效应及测量环节的适用条件。', intentType: 'modeling', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },"+marker)
p = ROOT/'src/lib/__tests__/adaptive-path-goal-options.test.ts'
replace(p, 'toHaveLength(13)', 'toHaveLength(14)')
replace(p, "      'system-modeling-process-foundations',", "      'system-modeling-process-foundations',\n      'physical-modeling-interconnection-foundations',")
p = base/'__tests__/goal-canonical-knowledge.test.ts'
replace(p, 'covers the thirteen preset goals', 'covers the fourteen preset goals')
replace(p, "      'system-modeling-process-foundations',", "      'system-modeling-process-foundations',\n      'physical-modeling-interconnection-foundations',")
# Check every intended replacement before any write.
for path, content in edits.items():
    lines = content.splitlines(keepends=True)
    with path.open('w') as stream:
        for start in range(0, len(lines), 300):
            stream.writelines(lines[start:start+300])
print('Registered physical modeling goal and eight reviewed canonical targets in existing catalogs')
