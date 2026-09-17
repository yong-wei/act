"""Register the reviewed damping-and-frequency topic through existing static goal catalogs."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[7]
BATCH = Path(__file__).resolve().parent
review = json.loads((BATCH/'review-acceptance.json').read_text())
assert review['status'] == 'accepted', 'Independent card acceptance required first'
inventory = json.loads((BATCH/'inventory.json').read_text())
assert review['cardHashes'] == {c['canonicalId']: c['cardSha256'] for c in inventory['cards']}
goal = 'first-second-order-dynamics-foundations'
base = ROOT/'src/features/personalization/path-planning'
edits = {}
def replace(path, old, new):
    source = edits.get(path, path.read_text())
    assert source.count(old) == 1, (str(path), old)
    edits[path] = source.replace(old, new)

replace(base/'registered-goal-ids.ts', "  'input-response-foundations',", "  'input-response-foundations',\n  'first-second-order-dynamics-foundations',")
p = base/'goal-canonical-knowledge.ts'
source = p.read_text()
# Insert after existing final entry, preserving the explicit catalog order.
marker = '\n};'
assert source.count(marker) == 1
rows = ''.join("    { canonicalId: '"+c['canonicalId']+"', label: '"+c['name']+"' },\n" for c in inventory['cards'])
replace(p, marker, "\n  '"+goal+"': [\n"+rows+"  ],"+marker)
p = base/'internal/assemble-plan.ts'
marker = "  { id: 'input-response-foundations', title: '典型输入与系统响应', description: '根据输入与初态区分脉冲、自然和卷积响应，复核时域与复频域表达。', knowledge: 'transfer-function-model' },"
replace(p, marker, marker+"\n  { id: 'first-second-order-dynamics-foundations', title: '一二阶动态与阻尼参数', description: '识别时间常数、固有频率与阻尼比，在匹配条件下解释极点和响应变化。', knowledge: 'time-domain-performance' },")
p = base/'adaptive-path-goal-options-client.ts'
marker = '\n];'
replace(p, marker, "\n  { id: 'first-second-order-dynamics-foundations', label: '一二阶动态与阻尼参数', detail: '识别时间常数、固有频率与阻尼比，在匹配条件下解释极点和响应变化。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },"+marker)
p = ROOT/'src/lib/__tests__/adaptive-path-goal-options.test.ts'
replace(p, 'toHaveLength(22)', 'toHaveLength(23)')
replace(p, "      'input-response-foundations',", "      'input-response-foundations',\n      'first-second-order-dynamics-foundations',")
p = base/'__tests__/goal-canonical-knowledge.test.ts'
replace(p, 'covers the twenty-two preset goals', 'covers the twenty-three preset goals')
replace(p, "      'input-response-foundations',", "      'input-response-foundations',\n      'first-second-order-dynamics-foundations',")
# Check every intended replacement before any write.
for path, content in edits.items():
    lines = content.splitlines(keepends=True)
    with path.open('w') as stream:
        for start in range(0, len(lines), 300):
            stream.writelines(lines[start:start+300])
print('Registered damping-and-frequency goal and eleven reviewed canonical targets in existing catalogs')
