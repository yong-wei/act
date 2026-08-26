#!/usr/bin/env bash
set -Eeuo pipefail

# Execute the authorized r4 production transition. The outer journal owns the
# Authority pointer and the Runtime lifecycle together; the Runtime activator
# deliberately returns with consumers stopped so the final active receipt can
# become durable before application visibility resumes.

PROJECT_DIR="${ACT_RUNTIME_PROJECT_DIR:-/home/projects/act}"
STATE_DIR="${ACT_RUNTIME_STATE_DIR:-$PROJECT_DIR/data/runtime}"
AUTHORITY_ROOT="${ACT_AUTHORITY_STORE_DIR:-$PROJECT_DIR/course-content/authoring/knowledge/authority}"
VIEW_ROOT="${ACT_RUNTIME_BLOB_VIEW_ROOT:-$PROJECT_DIR/data/runtime/blob-views}"
LIFECYCLE="${ACT_RUNTIME_BLOB_LIFECYCLE_SCRIPT:-$PROJECT_DIR/scripts/runtime-release/runtime-blob-release-lifecycle.py}"
ACTIVATION="${ACT_RUNTIME_BLOB_ACTIVATION_TRANSACTION:-$PROJECT_DIR/scripts/runtime-release/runtime-blob-activation-transaction.py}"
HOST_STATE="${ACT_RUNTIME_HOST_STATE_SCRIPT:-$PROJECT_DIR/scripts/runtime-release/runtime-release-host-state.py}"
ACTIVATOR="${ACT_RUNTIME_BLOB_ACTIVATOR:-$PROJECT_DIR/scripts/activate-runtime-blob-release.sh}"
DEPLOY="${ACT_RUNTIME_APP_DEPLOY_SCRIPT:-$PROJECT_DIR/scripts/4-deploy.sh}"
RAM_ROLE="${ACT_RUNTIME_OSS_RAM_ROLE:-act-runtime-oss-read}"

candidate_dir=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --candidate-dir) candidate_dir="$2"; shift 2 ;;
    --ram-role) RAM_ROLE="$2"; shift 2 ;;
    *) echo "ERROR: unknown argument: $1" >&2; exit 1 ;;
  esac
done
[[ "$candidate_dir" = /* && -d "$candidate_dir" && ! -L "$candidate_dir" ]] || { echo "ERROR: --candidate-dir must be an absolute real directory" >&2; exit 1; }
[[ "$RAM_ROLE" =~ ^[A-Za-z0-9_+=,.@-]{1,128}$ ]] || { echo "ERROR: invalid RAM role" >&2; exit 1; }
for file in "$LIFECYCLE" "$ACTIVATION" "$HOST_STATE" "$ACTIVATOR" "$DEPLOY" "$candidate_dir/candidate-receipt.json" "$candidate_dir/authority-current.json" "$candidate_dir/runtime-stage.json" "$candidate_dir/predecessor-observation.json" "$candidate_dir/lifecycle-identity.json" "$candidate_dir/manifest.json" "$candidate_dir/release-receipt.json" "$candidate_dir/publisher-verification.json"; do
  [[ -f "$file" && ! -L "$file" ]] || { echo "ERROR: required regular file is missing: $file" >&2; exit 1; }
done

mkdir -p "$STATE_DIR/knowledge-cutover-transactions"
lock_path="$STATE_DIR/knowledge-cutover-transactions/r4-c5.lock"
exec 9>"$lock_path"
flock -x 9

journal_path="$STATE_DIR/knowledge-cutover-transactions/r4-c5-current.json"
status_path="$STATE_DIR/knowledge-cutover-transactions/r4-c5-status.json"
previous_pointer="$candidate_dir/previous-authority-current.json"
final_receipt="$STATE_DIR/coordinated-active-receipt.json"
previous_final_receipt="$candidate_dir/previous-coordinated-active-receipt.json"
transaction_id=""
opened_at=""
authority_mutated=0
runtime_activated=0
consumers_stopped=0
completed=0
rollback_image=""
previous_final_receipt_present=0
final_receipt_written=0
final_receipt_hash=""

active_image() {
  local image
  image="$(podman inspect --format '{{.Image}}' act-obe-app 2>/dev/null || true)"
  [[ "$image" =~ ^(sha256:)?[a-f0-9]{64}$ ]] || { echo "ERROR: active app image is unavailable" >&2; return 1; }
  printf 'sha256:%s\n' "${image#sha256:}"
}

stop_consumers() {
  local name
  for name in act-obe-app act-obe-worker act-obe-submission-scanner act-obe-submission-gc; do
    if podman container exists "$name" && [[ "$(podman inspect --format '{{.State.Running}}' "$name")" == "true" ]]; then
      podman stop --time 45 "$name" >/dev/null
    fi
  done
  for name in act-obe-app act-obe-worker act-obe-submission-scanner act-obe-submission-gc; do
    if podman container exists "$name" && [[ "$(podman inspect --format '{{.State.Running}}' "$name")" == "true" ]]; then
      echo "ERROR: consumer is still running: $name" >&2
      return 1
    fi
  done
  consumers_stopped=1
}

write_journal() {
  local status="$1"
  python3 - "$candidate_dir/candidate-receipt.json" "$candidate_dir/authority-current.json" "$previous_pointer" "$journal_path" "$status_path" "$status" "$transaction_id" "$opened_at" <<'PY'
import datetime, hashlib, json, os, sys, tempfile
candidate_path, successor_path, predecessor_path, output_path, status_path, status, transaction_id, opened_at = sys.argv[1:]
candidate = json.load(open(candidate_path, encoding='utf-8'))
before = open(predecessor_path, 'rb').read() if os.path.exists(predecessor_path) else b''
after = open(successor_path, 'rb').read()
journal = {
  'contract': 'cutover-transaction-journal/v1',
  'transactionId': transaction_id,
  'openedAt': opened_at,
  'candidateReceiptHash': candidate['receiptHash'],
  'predecessor': [{'selectorId': 'authority:current', 'identity': hashlib.sha256(before).hexdigest()}],
  'orderedMutations': [{'selectorId': 'authority:current', 'expectedPredecessorIdentity': hashlib.sha256(before).hexdigest(), 'successorIdentity': hashlib.sha256(after).hexdigest()}],
  'compensationPlan': [{'selectorId': 'authority:current', 'restoreIdentity': hashlib.sha256(before).hexdigest()}],
}
journal['journalHash'] = hashlib.sha256(json.dumps({key: journal[key] for key in ('transactionId', 'openedAt', 'candidateReceiptHash', 'predecessor', 'orderedMutations', 'compensationPlan')}, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
wire = json.dumps(journal, sort_keys=True, separators=(',', ':')).encode() + b'\n'
directory = os.path.dirname(output_path)
if os.path.exists(output_path):
  if open(output_path, 'rb').read() != wire: raise SystemExit('existing transaction journal differs from this immutable transaction')
else:
  fd, temp = tempfile.mkstemp(prefix='.r4-c5-', dir=directory)
  with os.fdopen(fd, 'wb') as handle: handle.write(wire); handle.flush(); os.fsync(handle.fileno())
  os.replace(temp, output_path); os.chmod(output_path, 0o600)
status_record = {'contract': 'r4-coordinated-production-transaction-status/v1', 'transactionId': transaction_id, 'journalHash': journal['journalHash'], 'status': status, 'updatedAt': datetime.datetime.now(datetime.UTC).isoformat(timespec='milliseconds').replace('+00:00', 'Z')}
status_wire = json.dumps(status_record, sort_keys=True, separators=(',', ':')).encode() + b'\n'
fd, temp = tempfile.mkstemp(prefix='.r4-c5-status-', dir=directory)
with os.fdopen(fd, 'wb') as handle: handle.write(status_wire); handle.flush(); os.fsync(handle.fileno())
os.replace(temp, status_path); os.chmod(status_path, 0o600)
PY
}

preflight_and_prepare() {
  python3 - "$candidate_dir/candidate-receipt.json" "$candidate_dir/authority-current.json" "$candidate_dir/runtime-stage.json" "$candidate_dir/predecessor-observation.json" "$AUTHORITY_ROOT/current.json" "$LIFECYCLE" "$STATE_DIR" "$candidate_dir/coordinated-cutover.json" <<'PY'
import hashlib, json, os, re, subprocess, sys
candidate_path, successor_path, stage_path, observed_path, authority_path, lifecycle, state_dir, declaration_path = sys.argv[1:]
sha = lambda value: hashlib.sha256(value).hexdigest()
canonical = lambda value: json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()
candidate = json.load(open(candidate_path, encoding='utf-8'))
keys = ['allocationHash','authorityCaptureHash','builderVersion','candidateId','consumerActivationHash','continuityReceiptHash','contract','derivationReceiptHash','domainShardCatalogHash','domainShardSetHash','formalResourceEnvelopeHash','localeQualificationHash','predecessor','predecessorRuntimeLifecycleGeneration','prerequisitePublicationHash','receiptHash','rollbackPlanHash','sealedAt','selectable','successorRuntimeManifestHash','successorRuntimeMaterializationHash','successorSelectorExpectations','teachingClosureReceiptHash','teachingProjectionHash','transactionImplementationIdentity','verificationPolicyHash']
if sorted(candidate) != keys or candidate['contract'] != 'coordinated-candidate-receipt/v1' or candidate['builderVersion'] != 'latest-authority-oss-cutover-builder/v1' or candidate['selectable'] is not False:
  raise SystemExit('invalid non-selectable coordinated candidate')
hash_keys = ['candidateId','sealedAt','allocationHash','authorityCaptureHash','localeQualificationHash','teachingProjectionHash','teachingClosureReceiptHash','formalResourceEnvelopeHash','continuityReceiptHash','derivationReceiptHash','successorRuntimeManifestHash','successorRuntimeMaterializationHash','domainShardCatalogHash','domainShardSetHash','prerequisitePublicationHash','consumerActivationHash','predecessor','predecessorRuntimeLifecycleGeneration','successorSelectorExpectations','transactionImplementationIdentity','rollbackPlanHash','verificationPolicyHash']
if sha(canonical({key: candidate[key] for key in hash_keys})) != candidate['receiptHash']:
  raise SystemExit('candidate receipt hash is invalid')
stage = json.load(open(stage_path, encoding='utf-8'))
observed = json.load(open(observed_path, encoding='utf-8'))
if stage.get('contract') != 'coordinated-runtime-stage/v1' or observed.get('contract') != 'r4-production-predecessor-observation/v1':
  raise SystemExit('runtime stage or predecessor observation is invalid')
before = open(authority_path, 'rb').read()
if candidate['predecessor'] != [{'selectorId':'authority:current','identity':sha(before)}]:
  raise SystemExit('Authority predecessor drifted from candidate')
live = json.loads(subprocess.check_output(['python3', lifecycle, 'inspect', '--state-dir', state_dir], text=True))
runtime = observed['runtime']
if live['desired'] is None or live['active'] != {key: runtime[key] for key in ('releaseId','manifestSha256','treeSha256')} or live['generation'] != runtime['lifecycleGeneration']:
  raise SystemExit('Runtime predecessor or staged desired state drifted')
if live['desired'] != stage['runtimeRelease']:
  raise SystemExit('staged Runtime desired identity does not match c5 stage')
after = open(successor_path, 'rb').read()
if candidate['successorSelectorExpectations'] != [{'selectorId':'authority:current','expectedSuccessorIdentity':sha(after)}]:
  raise SystemExit('Authority successor does not match candidate')
successor=json.loads(after)
snapshot=successor.get('snapshotId')
if not isinstance(snapshot, str) or not re.fullmatch(r'snap-[0-9a-f]{64}', snapshot): raise SystemExit('Authority successor snapshot identity is invalid')
manifest=os.path.join(os.path.dirname(authority_path), 'releases', snapshot, 'manifest.json')
if not os.path.isfile(manifest) or os.path.islink(manifest): raise SystemExit('Authority successor snapshot is not installed as a regular manifest')
declaration = {'contract':'runtime-blob-coordinated-cutover.v1', **stage['runtimeRelease'], 'candidateReceiptHash':candidate['receiptHash']}
with open(declaration_path, 'w', encoding='utf-8') as handle:
  json.dump(declaration, handle, sort_keys=True, separators=(',', ':')); handle.write('\n')
PY
}

write_authority_pointer() {
  local source="$1"
  python3 - "$source" "$AUTHORITY_ROOT/current.json" <<'PY'
import os, sys, tempfile
source, target = sys.argv[1:]
data = open(source, 'rb').read()
directory = os.path.dirname(target)
fd, temp = tempfile.mkstemp(prefix='.authority-current-', dir=directory)
with os.fdopen(fd, 'wb') as handle:
  handle.write(data); handle.flush(); os.fsync(handle.fileno())
os.chmod(temp, 0o644); os.replace(temp, target)
fd = os.open(directory, os.O_RDONLY)
try: os.fsync(fd)
finally: os.close(fd)
PY
}

seal_runtime_artifacts() {
  python3 - "$candidate_dir/candidate-receipt.json" "$candidate_dir/runtime-stage.json" "$journal_path" "$candidate_dir/runtime-binding.json" "$candidate_dir/runtime-authorization.json" <<'PY'
import datetime, hashlib, json, sys
candidate_path, stage_path, journal_path, binding_path, authorization_path = sys.argv[1:]
canonical = lambda value: json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()
digest = lambda value: hashlib.sha256(canonical(value)).hexdigest()
candidate = json.load(open(candidate_path, encoding='utf-8')); stage = json.load(open(stage_path, encoding='utf-8')); journal = json.load(open(journal_path, encoding='utf-8'))
binding = {'contract':'coordinated-runtime-active-receipt-binding/v1','transactionId':journal['transactionId'],'candidateReceiptHash':candidate['receiptHash'],'runtimeRelease':stage['runtimeRelease'],'materializationReceiptHash':stage['materializationReceiptSha256'],'bindingHash':''}
binding['bindingHash'] = digest({key: binding[key] for key in ('transactionId','candidateReceiptHash','runtimeRelease','materializationReceiptHash')})
now = datetime.datetime.now(datetime.UTC).isoformat(timespec='milliseconds').replace('+00:00','Z')
before = journal['predecessor'][0]['identity']; after = journal['orderedMutations'][0]['successorIdentity']
mutation = {'contract':'cutover-selector-mutation-receipt/v1','transactionId':journal['transactionId'],'candidateReceiptHash':candidate['receiptHash'],'selectorId':'authority:current','appliedAt':now,'beforeIdentity':before,'afterIdentity':after}
mutation_hash = digest(mutation); mutation['receiptHash'] = mutation_hash; mutation['receiptId'] = 'mut-' + mutation_hash[:24]
authorization = {'contract':'coordinated-runtime-authorization/v1','authorizationId':'','authorizedAt':now,'transactionId':journal['transactionId'],'journalHash':journal['journalHash'],'candidateReceiptHash':candidate['receiptHash'],'committedSelectors':[{'selectorId':'authority:current','identity':after}],'mutationReceiptHashes':[mutation_hash],'runtimeBindingHash':binding['bindingHash'],'authorizationHash':''}
authorization['authorizationHash'] = digest({key: authorization[key] for key in ('transactionId','journalHash','candidateReceiptHash','committedSelectors','mutationReceiptHashes','runtimeBindingHash')}); authorization['authorizationId'] = 'auth-' + authorization['authorizationHash'][:24]
for path, value in ((binding_path,binding),(authorization_path,authorization), (binding_path + '.mutation.json', mutation)):
  with open(path, 'w', encoding='utf-8') as handle: json.dump(value, handle, sort_keys=True, separators=(',', ':')); handle.write('\n')
PY
}

seal_final_receipt() {
  python3 - "$candidate_dir/candidate-receipt.json" "$candidate_dir/runtime-stage.json" "$journal_path" "$candidate_dir/runtime-binding.json" "$final_receipt" "$LIFECYCLE" "$STATE_DIR" <<'PY'
import datetime, hashlib, json, os, subprocess, sys, tempfile
candidate_path, stage_path, journal_path, binding_path, output_path, lifecycle, state_dir = sys.argv[1:]
canonical = lambda value: json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()
digest = lambda value: hashlib.sha256(canonical(value)).hexdigest()
candidate=json.load(open(candidate_path)); stage=json.load(open(stage_path)); journal=json.load(open(journal_path)); binding=json.load(open(binding_path))
live=json.loads(subprocess.check_output(['python3', lifecycle, 'inspect', '--state-dir', state_dir], text=True))
if live['active'] != stage['runtimeRelease'] or live['desired'] is not None: raise SystemExit('Runtime lifecycle did not activate the staged identity')
mutation=json.load(open(binding_path + '.mutation.json'))
after = journal['orderedMutations'][0]['successorIdentity']
receipt={'contract':'coordinated-active-receipt/v1','receiptId':'','sealedAt':datetime.datetime.now(datetime.UTC).isoformat(timespec='milliseconds').replace('+00:00','Z'),'transactionId':journal['transactionId'],'journalHash':journal['journalHash'],'candidateReceiptHash':candidate['receiptHash'],'committedSelectors':[{'selectorId':'authority:current','identity':after}],'mutationReceiptHashes':[mutation['receiptHash']],'runtimeActiveReceiptHash':binding['bindingHash'],'runtimeActiveIdentity':stage['runtimeRelease'],'receiptHash':''}
receipt['receiptHash']=digest({key: receipt[key] for key in ('transactionId','journalHash','candidateReceiptHash','committedSelectors','mutationReceiptHashes','runtimeActiveReceiptHash','runtimeActiveIdentity')}); receipt['receiptId']='act-'+receipt['receiptHash'][:24]
fd,temp=tempfile.mkstemp(prefix='.coordinated-active-',dir=os.path.dirname(output_path))
with os.fdopen(fd,'w',encoding='utf-8') as handle: json.dump(receipt,handle,sort_keys=True,separators=(',',':'));handle.write('\n');handle.flush();os.fsync(handle.fileno())
os.replace(temp,output_path);os.chmod(output_path,0o600)
PY
}

restore_runtime_predecessor() {
  local state generation
  state="$(python3 "$LIFECYCLE" inspect --state-dir "$STATE_DIR" 2>/dev/null)" || return 1
  generation="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["generation"])' <<<"$state")" || return 1
  [[ "$generation" =~ ^[0-9]+$ ]] || return 1
  if python3 - "$state" "$candidate_dir/runtime-stage.json" "$candidate_dir/predecessor-observation.json" <<'PY'
import json, sys
live, stage, predecessor = map(json.loads, sys.argv[1:])
before = {key: predecessor['runtime'][key] for key in ('releaseId', 'manifestSha256', 'treeSha256')}
if live['active'] == stage['runtimeRelease']:
    raise SystemExit(10)
if live['active'] == before and live['desired'] in (None, stage['runtimeRelease']):
    raise SystemExit(0)
raise SystemExit(1)
PY
  then
    return 0
  else
    case "$?" in
      10) ;;
      *) return 1 ;;
    esac
  fi
  python3 "$ACTIVATION" rollback --state-dir "$STATE_DIR" --lifecycle-script "$LIFECYCLE" --host-state-script "$HOST_STATE" --expected-generation "$generation" >/dev/null 2>&1 || return 1
  state="$(python3 "$LIFECYCLE" inspect --state-dir "$STATE_DIR" 2>/dev/null)" || return 1
  python3 - "$state" "$candidate_dir/predecessor-observation.json" <<'PY'
import json, sys
live, predecessor = map(json.loads, sys.argv[1:])
before = {key: predecessor['runtime'][key] for key in ('releaseId', 'manifestSha256', 'treeSha256')}
if live['active'] != before or live['desired'] is not None:
    raise SystemExit(1)
PY
}

restore_final_receipt() {
  if [[ "$final_receipt_written" != "1" ]]; then return 0; fi
  [[ -f "$final_receipt" && ! -L "$final_receipt" ]] || return 1
  [[ "$(sha256sum "$final_receipt" | awk '{print $1}')" == "$final_receipt_hash" ]] || return 1
  if [[ "$previous_final_receipt_present" == "1" ]]; then
    cp -- "$previous_final_receipt" "$final_receipt"
    chmod 0600 "$final_receipt"
  else
    rm -f -- "$final_receipt"
  fi
}

recover() {
  local status=$?
  set +e
  local recovery_safe=1
  if [[ "$completed" == "1" ]]; then exit "$status"; fi
  if [[ "$authority_mutated" == "1" && "$consumers_stopped" == "1" ]]; then
    restore_runtime_predecessor || recovery_safe=0
  fi
  if [[ "$authority_mutated" == "1" && -f "$previous_pointer" ]]; then
    expected_after="$(sha256sum "$candidate_dir/authority-current.json" | awk '{print $1}')"
    current_after="$(sha256sum "$AUTHORITY_ROOT/current.json" | awk '{print $1}')"
    if [[ "$current_after" == "$expected_after" ]]; then
      write_authority_pointer "$previous_pointer"
    elif [[ "$current_after" != "$(sha256sum "$previous_pointer" | awk '{print $1}')" ]]; then
      recovery_safe=0
    fi
  fi
  restore_final_receipt || recovery_safe=0
  if [[ "$recovery_safe" == "1" && "$consumers_stopped" == "1" && -n "$rollback_image" ]]; then
    RUNTIME_DELIVERY_MODE=ossfs-blob-view ACT_RUNTIME_OSS_RAM_ROLE="$RAM_ROLE" ACT_COORDINATED_CUTOVER_REQUIRED="$([[ "$previous_final_receipt_present" == "1" ]] && printf true || printf false)" \
      ACT_COORDINATED_ACTIVE_RECEIPT_PATH="$final_receipt" \
      ACT_RUNTIME_ACTIVE_RECEIPT_PATH="$STATE_DIR/act-runtime-active-receipt.json" RUNTIME_CONTENT_DIR="$VIEW_ROOT/current" APP_IMAGE="$rollback_image" \
      "$DEPLOY" --runtime-cutover-app-only >/dev/null 2>&1 || true
  fi
  if [[ -n "$transaction_id" ]]; then
    if [[ "$recovery_safe" == "1" ]]; then write_journal ROLLED_BACK; else write_journal BLOCKED_RECOVERY; fi
  fi
  exit "$status"
}
trap recover ERR INT TERM

rollback_image="$(active_image)"
preflight_and_prepare
if [[ -e "$final_receipt" ]]; then
  [[ -f "$final_receipt" && ! -L "$final_receipt" ]] || { echo "ERROR: prior coordinated active receipt is not a regular file" >&2; exit 1; }
  cp -- "$final_receipt" "$previous_final_receipt"
  previous_final_receipt_present=1
fi
cp -- "$AUTHORITY_ROOT/current.json" "$previous_pointer"
transaction_id="tx-$(python3 -c 'import uuid; print(uuid.uuid4())')"
opened_at="$(python3 -c 'import datetime; print(datetime.datetime.now(datetime.UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z"))')"
write_journal PREPARED
stop_consumers
preflight_and_prepare
write_authority_pointer "$candidate_dir/authority-current.json"
authority_mutated=1
write_journal AUTHORITY_APPLIED
seal_runtime_artifacts
generation="$(python3 "$LIFECYCLE" inspect --state-dir "$STATE_DIR" | python3 -c 'import json,sys; print(json.load(sys.stdin)["generation"])')"
python3 "$LIFECYCLE" attach-coordinated-desired --state-dir "$STATE_DIR" --expected-generation "$generation" --identity "$candidate_dir/lifecycle-identity.json" --coordinated-cutover "$candidate_dir/coordinated-cutover.json" >/dev/null
ACT_RUNTIME_COORDINATED_CUTOVER_DECLARATION="$candidate_dir/coordinated-cutover.json" \
ACT_RUNTIME_COORDINATED_RUNTIME_AUTHORIZATION="$candidate_dir/runtime-authorization.json" \
ACT_RUNTIME_COORDINATED_RUNTIME_BINDING="$candidate_dir/runtime-binding.json" \
ACT_RUNTIME_BLOB_LIFECYCLE_SCRIPT="$LIFECYCLE" \
  "$ACTIVATOR" --release-id "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["runtimeRelease"]["releaseId"])' "$candidate_dir/runtime-stage.json")" \
  --expected-active-release "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["runtime"]["releaseId"])' "$candidate_dir/predecessor-observation.json")" \
  --manifest "$candidate_dir/manifest.json" --release-receipt "$candidate_dir/release-receipt.json" --verification-receipt "$candidate_dir/publisher-verification.json" \
  --ram-role "$RAM_ROLE" --coordinated-activate-before-consumers >/dev/null
runtime_activated=1
seal_final_receipt
final_receipt_hash="$(sha256sum "$final_receipt" | awk '{print $1}')"
final_receipt_written=1
RUNTIME_DELIVERY_MODE=ossfs-blob-view ACT_RUNTIME_OSS_RAM_ROLE="$RAM_ROLE" ACT_COORDINATED_CUTOVER_REQUIRED=true \
  ACT_COORDINATED_ACTIVE_RECEIPT_PATH="$final_receipt" ACT_RUNTIME_ACTIVE_RECEIPT_PATH="$STATE_DIR/act-runtime-active-receipt.json" \
  RUNTIME_CONTENT_DIR="$VIEW_ROOT/current" APP_IMAGE="$rollback_image" "$DEPLOY" --runtime-cutover-app-only
write_journal COMMITTED
completed=1
trap - ERR INT TERM
printf '{"status":"COMMITTED","transactionId":"%s"}\n' "$transaction_id"
