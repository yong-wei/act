"""Register the reviewed poles-and-zeros topic through existing static goal catalogs."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[7]
BATCH = Path(__file__).resolve().parent
review = json.loads((BATCH/'review-acceptance.json').read_text())
assert review['status'] == 'accepted', 'Independent card acceptance required first'
inventory = json.loads((BATCH/'inventory.json').read_text())
assert review['cardHashes'] == {c['canonicalId']: c['cardSha256'] for c in inventory['cards']}
goal = 'transfer-poles-zeros-foundations'
base = ROOT/'src/features/personalization/path-planning'
edits = {}
def replace(path, old, new):
    source = edits.get(path, path.read_text())
    assert source.count(old) == 1, (str(path), old)
    edits[path] = source.replace(old, new)

replace(base/'registered-goal-ids.ts', "  'feedback-structure-foundations',", "  'feedback-structure-foundations',\n  'transfer-poles-zeros-foundations',")
p = base/'goal-canonical-knowledge.ts'
source = p.read_text()
# Insert after existing final entry, preserving the explicit catalog order.
marker = '\n};'
assert source.count(marker) == 1
rows = ''.join("    { canonicalId: '"+c['canonicalId']+"', label: '"+c['name']+"' },\n" for c in inventory['cards'])
replace(p, marker, "\n  '"+goal+"': [\n"+rows+"  ],"+marker)
p = base/'internal/assemble-plan.ts'
marker = "  { id: 'feedback-structure-foundations', title: '开闭环与反馈结构', description: '区分辅助回路、参考与扰动通道，依据完整结构判断增益、误差和反馈作用。', knowledge: 'transfer-function-model' },"
replace(p, marker, marker+"\n  { id: 'transfer-poles-zeros-foundations', title: '传递函数与零极点', description: '区分直接传递、零极点与隐藏模态，判断闭环和多变量传输关系。', knowledge: 'transfer-function-model' },")
p = base/'adaptive-path-goal-options-client.ts'
marker = '\n];'
replace(p, marker, "\n  { id: 'transfer-poles-zeros-foundations', label: '传递函数与零极点', detail: '区分直接传递、零极点与隐藏模态，判断闭环和多变量传输关系。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },"+marker)
p = ROOT/'src/lib/__tests__/adaptive-path-goal-options.test.ts'
replace(p, 'toHaveLength(20)', 'toHaveLength(21)')
replace(p, "      'feedback-structure-foundations',", "      'feedback-structure-foundations',\n      'transfer-poles-zeros-foundations',")
p = base/'__tests__/goal-canonical-knowledge.test.ts'
replace(p, 'covers the twenty preset goals', 'covers the twenty-one preset goals')
replace(p, "      'feedback-structure-foundations',", "      'feedback-structure-foundations',\n      'transfer-poles-zeros-foundations',")
# Check every intended replacement before any write.
for path, content in edits.items():
    lines = content.splitlines(keepends=True)
    with path.open('w') as stream:
        for start in range(0, len(lines), 300):
            stream.writelines(lines[start:start+300])
print('Registered poles-and-zeros goal and nine reviewed canonical targets in existing catalogs')
