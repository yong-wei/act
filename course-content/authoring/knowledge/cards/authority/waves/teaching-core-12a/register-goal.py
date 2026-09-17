"""Register the reviewed response-metrics topic through existing static goal catalogs."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[7]
BATCH = Path(__file__).resolve().parent
review = json.loads((BATCH/'review-acceptance.json').read_text())
assert review['status'] == 'accepted', 'Independent card acceptance required first'
inventory = json.loads((BATCH/'inventory.json').read_text())
assert review['cardHashes'] == {c['canonicalId']: c['cardSha256'] for c in inventory['cards']}
goal = 'response-metrics-foundations'
base = ROOT/'src/features/personalization/path-planning'
edits = {}
def replace(path, old, new):
    source = edits.get(path, path.read_text())
    assert source.count(old) == 1, (str(path), old)
    edits[path] = source.replace(old, new)

replace(base/'registered-goal-ids.ts', "  'first-second-order-dynamics-foundations',", "  'first-second-order-dynamics-foundations',\n  'response-metrics-foundations',")
p = base/'goal-canonical-knowledge.ts'
source = p.read_text()
# Insert after existing final entry, preserving the explicit catalog order.
marker = '\n};'
assert source.count(marker) == 1
rows = ''.join("    { canonicalId: '"+c['canonicalId']+"', label: '"+c['name']+"' },\n" for c in inventory['cards'])
replace(p, marker, "\n  '"+goal+"': [\n"+rows+"  ],"+marker)
p = base/'internal/assemble-plan.ts'
marker = "  { id: 'first-second-order-dynamics-foundations', title: '一二阶动态与阻尼参数', description: '识别时间常数、固有频率与阻尼比，在匹配条件下解释极点和响应变化。', knowledge: 'time-domain-performance' },"
replace(p, marker, marker+"\n  { id: 'response-metrics-foundations', title: '响应指标与长期过程', description: '按统一口径计算峰值、上升和调节时间，区分瞬态、稳态与完整动态过程。', knowledge: 'time-domain-performance' },")
p = base/'adaptive-path-goal-options-client.ts'
marker = '\n];'
replace(p, marker, "\n  { id: 'response-metrics-foundations', label: '响应指标与长期过程', detail: '按统一口径计算峰值、上升和调节时间，区分瞬态、稳态与完整动态过程。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },"+marker)
p = ROOT/'src/lib/__tests__/adaptive-path-goal-options.test.ts'
replace(p, 'toHaveLength(23)', 'toHaveLength(24)')
replace(p, "      'first-second-order-dynamics-foundations',", "      'first-second-order-dynamics-foundations',\n      'response-metrics-foundations',")
p = base/'__tests__/goal-canonical-knowledge.test.ts'
replace(p, 'covers the twenty-three preset goals', 'covers the twenty-four preset goals')
replace(p, "      'first-second-order-dynamics-foundations',", "      'first-second-order-dynamics-foundations',\n      'response-metrics-foundations',")
# Check every intended replacement before any write.
for path, content in edits.items():
    lines = content.splitlines(keepends=True)
    with path.open('w') as stream:
        for start in range(0, len(lines), 300):
            stream.writelines(lines[start:start+300])
print('Registered response-metrics goal and twelve reviewed canonical targets in existing catalogs')
