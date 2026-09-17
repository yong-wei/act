"""Register the reviewed block-diagram topic through existing static goal catalogs."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[7]
BATCH = Path(__file__).resolve().parent
review = json.loads((BATCH/'review-acceptance.json').read_text())
assert review['status'] == 'accepted', 'Independent card acceptance required first'
inventory = json.loads((BATCH/'inventory.json').read_text())
assert review['cardHashes'] == {c['canonicalId']: c['cardSha256'] for c in inventory['cards']}
goal = 'block-diagram-modeling-foundations'
base = ROOT/'src/features/personalization/path-planning'
edits = {}
def replace(path, old, new):
    source = edits.get(path, path.read_text())
    assert source.count(old) == 1, (str(path), old)
    edits[path] = source.replace(old, new)

replace(base/'registered-goal-ids.ts', "  'signal-flow-foundations',", "  'signal-flow-foundations',\n  'block-diagram-modeling-foundations',")
p = base/'goal-canonical-knowledge.ts'
source = p.read_text()
# Insert after existing final entry, preserving the explicit catalog order.
marker = '\n};'
assert source.count(marker) == 1
rows = ''.join("    { canonicalId: '"+c['canonicalId']+"', label: '"+c['name']+"' },\n" for c in inventory['cards'])
replace(p, marker, "\n  '"+goal+"': [\n"+rows+"  ],"+marker)
p = base/'internal/assemble-plan.ts'
marker = "  { id: 'signal-flow-foundations', title: '信号流图基础', description: '由节点方程识别输入输出、支路、前向路径和基本回路，区分路径增益与整图关系。', knowledge: 'transfer-function-model' },"
replace(p, marker, marker+"\n  { id: 'block-diagram-modeling-foundations', title: '结构图建模与等效化简', description: '从变量方程建立结构图，保留输入位置和负载条件，验证代数化简与反馈互联。', knowledge: 'transfer-function-model' },")
replace(p, "    intentType: ['system-modeling-process-foundations', 'physical-modeling-interconnection-foundations', 'local-linearization-foundations', 'signal-flow-foundations'].includes(topic.id) ? 'modeling' : 'analysis', recommendedPhase: 'foundation',", "    intentType: ['system-modeling-process-foundations', 'physical-modeling-interconnection-foundations', 'local-linearization-foundations', 'signal-flow-foundations', 'block-diagram-modeling-foundations'].includes(topic.id) ? 'modeling' : 'analysis', recommendedPhase: 'foundation',")
p = base/'adaptive-path-goal-options-client.ts'
marker = '\n];'
replace(p, marker, "\n  { id: 'block-diagram-modeling-foundations', label: '结构图建模与等效化简', detail: '从变量方程建立结构图，保留输入位置和负载条件，验证代数化简与反馈互联。', intentType: 'modeling', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },"+marker)
p = ROOT/'src/lib/__tests__/adaptive-path-goal-options.test.ts'
replace(p, 'toHaveLength(17)', 'toHaveLength(18)')
replace(p, "      'signal-flow-foundations',", "      'signal-flow-foundations',\n      'block-diagram-modeling-foundations',")
p = base/'__tests__/goal-canonical-knowledge.test.ts'
replace(p, 'covers the seventeen preset goals', 'covers the eighteen preset goals')
replace(p, "      'signal-flow-foundations',", "      'signal-flow-foundations',\n      'block-diagram-modeling-foundations',")
# Check every intended replacement before any write.
for path, content in edits.items():
    lines = content.splitlines(keepends=True)
    with path.open('w') as stream:
        for start in range(0, len(lines), 300):
            stream.writelines(lines[start:start+300])
print('Registered block-diagram goal and seven reviewed canonical targets in existing catalogs')
