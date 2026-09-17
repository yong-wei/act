"""Extend existing root-locus and frequency goals with reviewed semantic targets."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[7]
BATCH=Path(__file__).resolve().parent
inventory=json.loads((BATCH/'inventory.json').read_text())
review=json.loads((BATCH/'review-acceptance.json').read_text())
assert review['status']=='accepted'
assert review['cardHashes']=={c['canonicalId']:c['cardSha256'] for c in inventory['cards']}
for c in inventory['cards']:assert hashlib.sha256((ROOT/c['authoringPath']).read_bytes()).hexdigest()==c['cardSha256']
groups={'root-locus-analysis-foundations':[c for c in inventory['cards'] if c['name']!='转折点'],
        'frequency-response-foundations':[c for c in inventory['cards'] if c['name']=='转折点']}
assert len(groups['root-locus-analysis-foundations'])==10 and len(groups['frequency-response-foundations'])==1
p=ROOT/'src/features/personalization/path-planning/goal-canonical-knowledge.ts';text=p.read_text()
for goal,cards in groups.items():
 marker="  '"+goal+"': [";assert text.count(marker)==1
 section=text.split(marker,1)[1].split('  ],',1)[0]
 present=[c for c in cards if c['canonicalId'] in section]
 if present:
  assert len(present)==len(cards), 'Partially registered topic requires inspection'
 else:
  rows=''.join("\n    { canonicalId: '"+c['canonicalId']+"', label: '"+c['name']+"' }," for c in cards)
  text=text.replace(marker,marker+rows)
lines=text.splitlines(keepends=True)
with p.open('w') as f:
 for start in range(0,len(lines),300):f.writelines(lines[start:start+300])
print('Registered 10 root-locus targets and 1 frequency target in existing goals; goal catalog unchanged')
