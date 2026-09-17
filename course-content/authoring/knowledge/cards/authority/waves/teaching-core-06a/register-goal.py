"""Register the reviewed signal-flow topic through existing static goal catalogs."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[7]
BATCH = Path(__file__).resolve().parent
review = json.loads((BATCH/'review-acceptance.json').read_text())
assert review['status'] == 'accepted', 'Independent card acceptance required first'
inventory = json.loads((BATCH/'inventory.json').read_text())
assert review['cardHashes'] == {c['canonicalId']: c['cardSha256'] for c in inventory['cards']}
goal = 'signal-flow-foundations'
base = ROOT/'src/features/personalization/path-planning'
edits = {}
def replace(path, old, new):
    source = edits.get(path, path.read_text())
    assert source.count(old) == 1, (str(path), old)
    edits[path] = source.replace(old, new)

replace(base/'registered-goal-ids.ts', "  'local-linearization-foundations',", "  'local-linearization-foundations',\n  'signal-flow-foundations',")
p = base/'goal-canonical-knowledge.ts'
source = p.read_text()
# Insert after existing final entry, preserving the explicit catalog order.
marker = '\n};'
assert source.count(marker) == 1
rows = ''.join("    { canonicalId: '"+c['canonicalId']+"', label: '"+c['name']+"' },\n" for c in inventory['cards'])
replace(p, marker, "\n  '"+goal+"': [\n"+rows+"  ],"+marker)
p = base/'internal/assemble-plan.ts'
marker = "  { id: 'local-linearization-foundations', title: '平衡点与局部线性化', description: '区分平衡点和一般工作点，建立小信号模型并判断局部近似的适用边界。', knowledge: 'transfer-function-model' },"
replace(p, marker, marker+"\n  { id: 'signal-flow-foundations', title: '信号流图基础', description: '由节点方程识别输入输出、支路、前向路径和基本回路，区分路径增益与整图关系。', knowledge: 'transfer-function-model' },")
replace(p, "    intentType: ['system-modeling-process-foundations', 'physical-modeling-interconnection-foundations', 'local-linearization-foundations'].includes(topic.id) ? 'modeling' : 'analysis', recommendedPhase: 'foundation',", "    intentType: ['system-modeling-process-foundations', 'physical-modeling-interconnection-foundations', 'local-linearization-foundations', 'signal-flow-foundations'].includes(topic.id) ? 'modeling' : 'analysis', recommendedPhase: 'foundation',")
p = base/'adaptive-path-goal-options-client.ts'
marker = '\n];'
replace(p, marker, "\n  { id: 'signal-flow-foundations', label: '信号流图基础', detail: '由节点方程识别输入输出、支路、前向路径和基本回路，区分路径增益与整图关系。', intentType: 'modeling', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },"+marker)
p = ROOT/'src/lib/__tests__/adaptive-path-goal-options.test.ts'
replace(p, 'toHaveLength(16)', 'toHaveLength(17)')
replace(p, "      'local-linearization-foundations',", "      'local-linearization-foundations',\n      'signal-flow-foundations',")
p = base/'__tests__/goal-canonical-knowledge.test.ts'
replace(p, 'covers the sixteen preset goals', 'covers the seventeen preset goals')
replace(p, "      'local-linearization-foundations',", "      'local-linearization-foundations',\n      'signal-flow-foundations',")
# Check every intended replacement before any write.
for path, content in edits.items():
    lines = content.splitlines(keepends=True)
    with path.open('w') as stream:
        for start in range(0, len(lines), 300):
            stream.writelines(lines[start:start+300])
print('Registered signal-flow goal and six reviewed canonical targets in existing catalogs')
