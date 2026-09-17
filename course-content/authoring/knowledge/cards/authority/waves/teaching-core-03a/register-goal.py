"""Register the reviewed local linearization topic through existing static goal catalogs."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[7]
BATCH = Path(__file__).resolve().parent
review = json.loads((BATCH/'review-acceptance.json').read_text())
assert review['status'] == 'accepted', 'Independent card acceptance required first'
inventory = json.loads((BATCH/'inventory.json').read_text())
assert review['cardHashes'] == {c['canonicalId']: c['cardSha256'] for c in inventory['cards']}
goal = 'local-linearization-foundations'
base = ROOT/'src/features/personalization/path-planning'
edits = {}
def replace(path, old, new):
    source = edits.get(path, path.read_text())
    assert source.count(old) == 1, (str(path), old)
    edits[path] = source.replace(old, new)

replace(base/'registered-goal-ids.ts', "  'state-space-controllability-foundations',", "  'state-space-controllability-foundations',\n  'local-linearization-foundations',")
p = base/'goal-canonical-knowledge.ts'
source = p.read_text()
# Insert after existing final entry, preserving the explicit catalog order.
marker = '\n};'
assert source.count(marker) == 1
rows = ''.join("    { canonicalId: '"+c['canonicalId']+"', label: '"+c['name']+"' },\n" for c in inventory['cards'])
replace(p, marker, "\n  '"+goal+"': [\n"+rows+"  ],"+marker)
p = base/'internal/assemble-plan.ts'
marker = "  { id: 'state-space-controllability-foundations', title: '状态空间实现与可控性', description: '建立状态表达，运用秩与模态判据分析可达性、估计误差和极点配置的条件。', knowledge: 'modern-transfer' },"
replace(p, marker, marker+"\n  { id: 'local-linearization-foundations', title: '平衡点与局部线性化', description: '区分平衡点和一般工作点，建立小信号模型并判断局部近似的适用边界。', knowledge: 'transfer-function-model' },")
replace(p, "    intentType: ['system-modeling-process-foundations', 'physical-modeling-interconnection-foundations'].includes(topic.id) ? 'modeling' : 'analysis', recommendedPhase: 'foundation',", "    intentType: ['system-modeling-process-foundations', 'physical-modeling-interconnection-foundations', 'local-linearization-foundations'].includes(topic.id) ? 'modeling' : 'analysis', recommendedPhase: 'foundation',")
p = base/'adaptive-path-goal-options-client.ts'
marker = '\n];'
replace(p, marker, "\n  { id: 'local-linearization-foundations', label: '平衡点与局部线性化', detail: '区分平衡点和一般工作点，建立小信号模型并判断局部近似的适用边界。', intentType: 'modeling', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },"+marker)
p = ROOT/'src/lib/__tests__/adaptive-path-goal-options.test.ts'
replace(p, 'toHaveLength(15)', 'toHaveLength(16)')
replace(p, "      'state-space-controllability-foundations',", "      'state-space-controllability-foundations',\n      'local-linearization-foundations',")
p = base/'__tests__/goal-canonical-knowledge.test.ts'
replace(p, 'covers the fifteen preset goals', 'covers the sixteen preset goals')
replace(p, "      'state-space-controllability-foundations',", "      'state-space-controllability-foundations',\n      'local-linearization-foundations',")
# Check every intended replacement before any write.
for path, content in edits.items():
    lines = content.splitlines(keepends=True)
    with path.open('w') as stream:
        for start in range(0, len(lines), 300):
            stream.writelines(lines[start:start+300])
print('Registered local linearization goal and six reviewed canonical targets in existing catalogs')
