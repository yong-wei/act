#!/bin/bash
# 域闭合循环：$1=域id $2=Codex scope 序号
set -e
DOMAIN="$1"; SCOPE_N="$2"
R=/Users/YW/.codex/worktrees/act-resource
python3 - "$DOMAIN" <<'PY'
import json, sys
domain = sys.argv[1]
cw = json.load(open('/tmp/remediation-run/crosswalk-full.json'))
packs = json.load(open('/tmp/remediation-run/relations/relation-review-packs.json'))
pack = next(p for p in packs if p['domainId'] == domain)
lines = [f'{domain} 域共 {pack["memberCount"]} 成员。', '']
seen = set()
for row in pack['rows']:
    cid = row['canonicalId']
    if cid in seen: continue
    seen.add(cid)
    e = cw['entries'].get(cid, {})
    lines.append(f"{cid} | {e.get('label') or ''} | {(e.get('description') or '')[:70]}")
open(f'/tmp/remediation-run/review/{domain}-members.txt', 'w').write('\n'.join(lines))
print('members:', len(seen))
PY
cat > /tmp/remediation/run/task.tmp 2>/dev/null || true
sed -e "s/robustness-sensitivity-analysis/$DOMAIN/g" -e "s|/tmp/remediation-run/review/rsa-members.txt|/tmp/remediation/run/members.txt|g" /tmp/remediation-run/codex-rsa-task.txt | sed "s|/tmp/remediation/run/members.txt|/tmp/remediation-run/review/$DOMAIN-members.txt|g" > "/tmp/remediation-run/codex-$DOMAIN-task.txt"
cd "$R" && python3 - "$DOMAIN" "$SCOPE_N" <<'PY'
import subprocess, sys, os
domain, scope_n = sys.argv[1], sys.argv[2]
env = {k: v for k, v in os.environ.items() if 'proxy' not in k.lower()}
r = subprocess.run(['python3', '/Users/YW/.agents/skills/use-codex/scripts/run_codex.py',
  '--scope', f'act:issue-1515:review-{scope_n}', '--model', 'gpt-5.6-sol', '--effort', 'medium',
  '--permission', 'read', '--prompt-file', f'/tmp/remediation-run/codex-{domain}-task.txt'],
  capture_output=True, text=True, env=env, timeout=1800)
open(f'/tmp/remediation-run/review/{domain}-review.log', 'w').write(r.stdout + r.stderr)
print('captured', len(r.stdout))
PY
