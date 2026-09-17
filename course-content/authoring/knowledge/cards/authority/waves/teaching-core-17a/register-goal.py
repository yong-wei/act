"""Extend the existing root-locus goal with reviewed canonical targets."""
import hashlib
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[7]
BATCH=Path(__file__).resolve().parent
inventory=json.loads((BATCH/'inventory.json').read_text())
review=json.loads((BATCH/'review-acceptance.json').read_text())
assert review['status']=='accepted'
assert review['cardHashes']=={c['canonicalId']:c['cardSha256'] for c in inventory['cards']}
for card in inventory['cards']:
 assert hashlib.sha256((ROOT/card['authoringPath']).read_bytes()).hexdigest()==card['cardSha256']
p=ROOT/'src/features/personalization/path-planning/goal-canonical-knowledge.ts'
s=p.read_text();marker="  'root-locus-analysis-foundations': ["
assert s.count(marker)==1
section=s.split(marker,1)[1].split('  ],',1)[0]
ids=[c['canonicalId'] for c in inventory['cards']]
assert len(set(ids))==len(ids)
present=[cid for cid in ids if cid in section]
if present:
 assert len(present)==len(ids), 'Partially registered batch requires inspection'
 print('Root-locus targets already registered')
else:
 rows=''.join("\n    { canonicalId: '"+c['canonicalId']+"', label: '"+c['name']+"' }," for c in inventory['cards'])
 updated=s.replace(marker,marker+rows)
 lines=updated.splitlines(keepends=True)
 with p.open('w') as f:
  for i in range(0,len(lines),300):f.writelines(lines[i:i+300])
 print('Extended existing root-locus-analysis-foundations with',len(ids),'reviewed targets; goal catalog unchanged')
