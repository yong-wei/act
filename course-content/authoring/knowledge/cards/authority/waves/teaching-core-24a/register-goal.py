"""Bind the reviewed controller topics to existing semantically suitable goals."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[7]
BATCH=Path(__file__).resolve().parent
inventory=json.loads((BATCH/'inventory.json').read_text());review=json.loads((BATCH/'review-acceptance.json').read_text())
assert review['status']=='accepted'
assert review['cardHashes']=={c['canonicalId']:c['cardSha256'] for c in inventory['cards']}
for c in inventory['cards']:assert hashlib.sha256((ROOT/c['authoringPath']).read_bytes()).hexdigest()==c['cardSha256']
orders={'frequency-response-foundations':[1,2,3,4,6],'control-correction':[5]}
by_order={c['order']:c for c in inventory['cards']};assert set(by_order)==set(range(1,7))
assert sorted(n for values in orders.values() for n in values)==list(range(1,7))
p=ROOT/'src/features/personalization/path-planning/goal-canonical-knowledge.ts';text=p.read_text()
for goal,selected in orders.items():
 cards=[by_order[n] for n in selected];marker="  '"+goal+"': [";assert text.count(marker)==1
 section=text.split(marker,1)[1].split('  ],',1)[0];present=[c for c in cards if c['canonicalId'] in section]
 if present:assert len(present)==len(cards), 'Partially registered topic requires inspection'
 else:
  rows=''.join("\n    { canonicalId: '"+c['canonicalId']+"', label: '"+c['name']+"' }," for c in cards);text=text.replace(marker,marker+rows)
lines=text.splitlines(keepends=True)
with p.open('w') as f:
 for start in range(0,len(lines),300):f.writelines(lines[start:start+300])
print('Registered 6 reviewed targets across existing design and feedback-structure goals')
