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
for file in "$LIFECYCLE" "$HOST_STATE" "$ACTIVATOR" "$DEPLOY" "$STATE_DIR/act-runtime-active-receipt.json" "$candidate_dir/candidate-receipt.json" "$candidate_dir/authority-current.json" "$candidate_dir/runtime-stage.json" "$candidate_dir/predecessor-observation.json" "$candidate_dir/lifecycle-predecessor.json" "$candidate_dir/outer-artifacts.json" "$candidate_dir/presentation-label-qualification.json" "$candidate_dir/teaching-reclosure-receipt.json" "$candidate_dir/projection-adjustments.json" "$candidate_dir/projection-scope-binding.json" "$candidate_dir/verification-policy.json" "$candidate_dir/successor-runtime-manifest-extension.json" "$candidate_dir/successor-manifest.json" "$candidate_dir/lifecycle-identity.json" "$candidate_dir/manifest.json" "$candidate_dir/release-receipt.json" "$candidate_dir/publisher-verification.json" "$candidate_dir/materialization-receipt.json"; do
  [[ -f "$file" && ! -L "$file" ]] || { echo "ERROR: required regular file is missing: $file" >&2; exit 1; }
done

journal_dir="$STATE_DIR/knowledge-cutover-transactions"
mkdir -p "$journal_dir"
lock_path="$journal_dir/r4-c5.lock"
exec 9>"$lock_path"
flock -x 9

journal_path=""
status_path="$journal_dir/r4-c5-current.json"
previous_pointer="$candidate_dir/previous-authority-current.json"
final_receipt="$STATE_DIR/coordinated-active-receipt.json"
previous_final_receipt="$candidate_dir/previous-coordinated-active-receipt.json"
transaction_id=""
opened_at=""
authority_mutated=0
runtime_activated=0
consumers_stop_intent=0
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
  consumers_stop_intent=1
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
status_record = {'contract': 'r4-coordinated-production-transaction-status/v1', 'transactionId': transaction_id, 'journalPath': os.path.basename(output_path), 'journalHash': journal['journalHash'], 'status': status, 'updatedAt': datetime.datetime.now(datetime.UTC).isoformat(timespec='milliseconds').replace('+00:00', 'Z')}
status_wire = json.dumps(status_record, sort_keys=True, separators=(',', ':')).encode() + b'\n'
fd, temp = tempfile.mkstemp(prefix='.r4-c5-status-', dir=directory)
with os.fdopen(fd, 'wb') as handle: handle.write(status_wire); handle.flush(); os.fsync(handle.fileno())
os.replace(temp, status_path); os.chmod(status_path, 0o600)
PY
}

preflight_and_prepare() {
  python3 - "$candidate_dir/candidate-receipt.json" "$candidate_dir/authority-current.json" "$candidate_dir/runtime-stage.json" "$candidate_dir/predecessor-observation.json" "$candidate_dir/lifecycle-predecessor.json" "$candidate_dir/outer-artifacts.json" "$candidate_dir/presentation-label-qualification.json" "$candidate_dir/teaching-reclosure-receipt.json" "$candidate_dir/projection-adjustments.json" "$candidate_dir/projection-scope-binding.json" "$candidate_dir/verification-policy.json" "$candidate_dir/successor-runtime-manifest-extension.json" "$candidate_dir/successor-manifest.json" "$candidate_dir/manifest.json" "$candidate_dir/materialization-receipt.json" "$STATE_DIR/act-runtime-active-receipt.json" "$AUTHORITY_ROOT/current.json" "$LIFECYCLE" "$STATE_DIR" "$candidate_dir/coordinated-cutover.json" <<'PY'
import hashlib, json, os, re, subprocess, sys
candidate_path, successor_path, stage_path, observed_path, predecessor_lifecycle_path, artifacts_path, labels_path, teaching_reclosure_path, projection_adjustment_path, projection_scope_binding_path, policy_path, extension_path, successor_runtime_path, runtime_manifest_path, materialization_receipt_path, active_receipt_path, authority_path, lifecycle, state_dir, declaration_path = sys.argv[1:]
sha = lambda value: hashlib.sha256(value).hexdigest()
canonical = lambda value: json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()
candidate = json.load(open(candidate_path, encoding='utf-8'))
keys = ['allocationHash','authorityCaptureHash','builderVersion','candidateId','consumerActivationHash','continuityReceiptHash','contract','derivationReceiptHash','domainShardCatalogHash','domainShardSetHash','formalResourceEnvelopeHash','localeQualificationHash','predecessor','predecessorRuntimeLifecycleGeneration','prerequisitePublicationHash','receiptHash','rollbackPlanHash','sealedAt','selectable','successorRuntimeManifestHash','successorRuntimeMaterializationHash','successorSelectorExpectations','teachingClosureReceiptHash','teachingProjectionHash','transactionImplementationIdentity','verificationPolicyHash']
if sorted(candidate) != keys or candidate['contract'] != 'coordinated-candidate-receipt/v1' or candidate['builderVersion'] != 'latest-authority-oss-cutover-builder/v1' or candidate['selectable'] is not False:
  raise SystemExit('invalid non-selectable coordinated candidate')
hash_keys = ['candidateId','sealedAt','allocationHash','authorityCaptureHash','localeQualificationHash','teachingProjectionHash','teachingClosureReceiptHash','formalResourceEnvelopeHash','continuityReceiptHash','derivationReceiptHash','successorRuntimeManifestHash','successorRuntimeMaterializationHash','domainShardCatalogHash','domainShardSetHash','prerequisitePublicationHash','consumerActivationHash','predecessor','predecessorRuntimeLifecycleGeneration','successorSelectorExpectations','transactionImplementationIdentity','rollbackPlanHash','verificationPolicyHash']
if sha(canonical({key: candidate[key] for key in hash_keys})) != candidate['receiptHash']:
  raise SystemExit('candidate receipt hash is invalid')
artifacts=json.load(open(artifacts_path, encoding='utf-8'))
expected_artifacts={
  'authority-capture':candidate['authorityCaptureHash'], 'locale-qualification':candidate['localeQualificationHash'],
  'teaching-projection':candidate['teachingProjectionHash'], 'teaching-closure-receipt':candidate['teachingClosureReceiptHash'],
  'formal-resource-envelope':candidate['formalResourceEnvelopeHash'], 'continuity-receipt':candidate['continuityReceiptHash'],
  'derivation-receipt':candidate['derivationReceiptHash'], 'successor-runtime-manifest':candidate['successorRuntimeManifestHash'],
  'successor-runtime-materialization':candidate['successorRuntimeMaterializationHash'], 'authority-domain-shard-catalog':candidate['domainShardCatalogHash'],
  'authority-domain-shard-set':candidate['domainShardSetHash'], 'prerequisite-publication':candidate['prerequisitePublicationHash'],
  'consumer-activation':candidate['consumerActivationHash'],
}
if not isinstance(artifacts,list) or len(artifacts) != len(expected_artifacts): raise SystemExit('candidate artifact closure is invalid')
seen={}
for row in artifacts:
  if not isinstance(row,dict) or set(row) - {'artifactId','artifactHash','allocationHash'}: raise SystemExit('candidate artifact row is invalid')
  artifact_id=row.get('artifactId'); artifact_hash=row.get('artifactHash')
  if artifact_id in seen or expected_artifacts.get(artifact_id) != artifact_hash: raise SystemExit('candidate artifact closure differs from receipt')
  seen[artifact_id]=artifact_hash
if set(seen) != set(expected_artifacts): raise SystemExit('candidate artifact closure is incomplete')
labels=json.load(open(labels_path, encoding='utf-8')); teaching_reclosure=json.load(open(teaching_reclosure_path, encoding='utf-8')); projection_adjustment=json.load(open(projection_adjustment_path, encoding='utf-8')); projection_scope_binding=json.load(open(projection_scope_binding_path, encoding='utf-8')); policy=json.load(open(policy_path, encoding='utf-8'))
if labels.get('contract') != 'r4-presentation-label-qualification/v1' or labels.get('status') != 'PASS' or labels.get('reviewRequired') != 0:
  raise SystemExit('presentation label qualification is not production ready')
if policy.get('contract') != 'r4-c5-coordinated-production-verification/v1': raise SystemExit('presentation label verification policy is invalid')
policy_hash=policy.get('verificationPolicyHash')
if not isinstance(policy_hash,str) or policy_hash != candidate['verificationPolicyHash']: raise SystemExit('presentation label verification policy differs from candidate')
reclosure_hash=teaching_reclosure.get('receiptHash')
reclosure_input={key:value for key,value in teaching_reclosure.items() if key != 'receiptHash'}
if teaching_reclosure.get('contract') != 'r4-c6-teaching-governance-reclosure/v1' or teaching_reclosure.get('status') != 'COMPLETE' or not isinstance(reclosure_hash,str) or sha(canonical(reclosure_input)) != reclosure_hash:
  raise SystemExit('teaching governance reclosure receipt is invalid')
if policy.get('teachingGovernanceReclosureHash') != reclosure_hash or policy.get('teachingGovernanceReclosureSha256') != sha(open(teaching_reclosure_path,'rb').read()):
  raise SystemExit('teaching governance reclosure is not sealed by the verification policy')
if projection_adjustment.get('contract') != 'act-coordinated-projection-adjustments/v1' or projection_adjustment.get('scopeHash') != policy.get('projectionScopeHash') or policy.get('projectionScopeAdjustmentSha256') != sha(open(projection_adjustment_path,'rb').read()):
  raise SystemExit('Teaching Projection scope binding is not sealed by the verification policy')
projection_scope_binding_hash=projection_scope_binding.get('bindingHash')
projection_scope_binding_input={key:value for key,value in projection_scope_binding.items() if key != 'bindingHash'}
if projection_scope_binding.get('contract') != 'r4-coordinated-teaching-projection-scope-binding/v1' or not isinstance(projection_scope_binding_hash,str) or sha(canonical(projection_scope_binding_input)) != projection_scope_binding_hash:
  raise SystemExit('Teaching Projection scope binding receipt is invalid')
if projection_scope_binding.get('projectionHash') != candidate.get('teachingProjectionHash') or projection_scope_binding.get('projectionId') != 'proj-' + candidate.get('teachingProjectionHash',''):
  raise SystemExit('Teaching Projection scope binding does not select the candidate Projection')
if projection_scope_binding.get('scopeHash') != policy.get('projectionScopeHash') or policy.get('projectionScopeBindingHash') != projection_scope_binding_hash or policy.get('projectionScopeBindingSha256') != sha(open(projection_scope_binding_path,'rb').read()):
  raise SystemExit('Teaching Projection scope binding is not sealed by the verification policy')
policy_input={key:value for key,value in policy.items() if key != 'verificationPolicyHash'}
if sha(canonical(policy_input)) != policy_hash: raise SystemExit('presentation label verification policy hash is invalid')
if policy.get('presentationLabelQualificationHash') != labels.get('qualificationHash') or policy.get('presentationLabelQualificationSha256') != sha(open(labels_path,'rb').read()):
  raise SystemExit('presentation label qualification is not sealed by the verification policy')
stage = json.load(open(stage_path, encoding='utf-8'))
observed = json.load(open(observed_path, encoding='utf-8'))
predecessor_lifecycle = json.load(open(predecessor_lifecycle_path, encoding='utf-8'))
if stage.get('contract') != 'coordinated-runtime-stage/v1' or observed.get('contract') != 'r4-production-predecessor-observation/v1':
  raise SystemExit('runtime stage or predecessor observation is invalid')
runtime_stage=stage.get('runtimeRelease')
successor_runtime=json.load(open(successor_runtime_path, encoding='utf-8'))
runtime_manifest_wire=open(runtime_manifest_path,'rb').read()
runtime_manifest=json.loads(runtime_manifest_wire.decode('utf-8'))
materialization_receipt_wire=open(materialization_receipt_path,'rb').read()
extension=json.load(open(extension_path, encoding='utf-8'))
identity_keys={'schemaVersion','releaseId','manifestVersion','manifestSha256','manifestWireSha256','manifestWireSizeBytes','treeSha256'}
def runtime_identity(value, label):
  if not isinstance(value,dict) or set(value) != identity_keys or value.get('schemaVersion') != 'runtime-blob-release-identity.v1' or value.get('manifestVersion') != 'act-runtime-release.v2':
    raise SystemExit(label + ' is not a complete Runtime lifecycle identity')
  if not isinstance(value.get('releaseId'),str) or not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?',value['releaseId']):
    raise SystemExit(label + ' has an invalid release id')
  if any(not isinstance(value.get(key),str) or not re.fullmatch(r'[a-f0-9]{64}',value[key]) for key in ('manifestSha256','manifestWireSha256','treeSha256')) or not isinstance(value.get('manifestWireSizeBytes'),int) or value['manifestWireSizeBytes'] < 1:
    raise SystemExit(label + ' has invalid content identity')
  return value
runtime_stage=runtime_identity(runtime_stage, 'Runtime stage')
successor_runtime=runtime_identity(successor_runtime, 'sealed successor Runtime')
if runtime_stage != successor_runtime or any(runtime_manifest.get(key) != runtime_stage.get(key) for key in ('releaseId','manifestSha256','treeSha256')) or hashlib.sha256(runtime_manifest_wire).hexdigest() != runtime_stage['manifestWireSha256'] or len(runtime_manifest_wire) != runtime_stage['manifestWireSizeBytes']:
  raise SystemExit('Runtime stage does not match the sealed successor Runtime manifest')
runtime_manifest_input={key:value for key,value in runtime_manifest.items() if key != 'manifestSha256'}
if sha(canonical(runtime_manifest_input)) != runtime_stage.get('manifestSha256'):
  raise SystemExit('Runtime manifest semantic identity is invalid')
if sha(materialization_receipt_wire) != stage.get('materializationReceiptSha256') or candidate.get('successorRuntimeMaterializationHash') != stage.get('materializationReceiptSha256'):
  raise SystemExit('Runtime materialization receipt does not match the sealed candidate')
runtime_extension_hash=sha(canonical({'successorManifest':runtime_stage,'materializationReceiptHash':stage.get('materializationReceiptSha256'),'extension':extension}))
if candidate.get('successorRuntimeManifestHash') != runtime_extension_hash:
  raise SystemExit('Runtime manifest extension does not match the sealed candidate')
before = open(authority_path, 'rb').read()
if candidate['predecessor'] != [{'selectorId':'authority:current','identity':sha(before)}]:
  raise SystemExit('Authority predecessor drifted from candidate')
live = json.loads(subprocess.check_output(['python3', lifecycle, 'inspect', '--state-dir', state_dir], text=True))
runtime = observed['runtime']
runtime_before=runtime_identity({key: runtime.get(key) for key in identity_keys}, 'observed predecessor Runtime')
if observed.get('lifecycle') != predecessor_lifecycle:
  raise SystemExit('candidate predecessor lifecycle artifact differs from the captured observation')
if live != predecessor_lifecycle or live['desired'] is None or live['active'] != runtime_before or live['generation'] != runtime['lifecycleGeneration']:
  raise SystemExit('Runtime predecessor or staged desired state drifted')
if sha(open(active_receipt_path,'rb').read()) != runtime.get('activeReceiptHash'):
  raise SystemExit('Runtime active receipt differs from the observed predecessor')
if live['desired'] != stage['runtimeRelease']:
  raise SystemExit('staged Runtime desired identity does not match c5 stage')
if candidate.get('predecessorRuntimeLifecycleGeneration') != runtime.get('lifecycleGeneration'):
  raise SystemExit('candidate Runtime predecessor lifecycle generation drifted')
if extension.get('predecessorRuntimeReleaseId') != runtime.get('releaseId') or extension.get('predecessorRuntimeManifestSha256') != runtime.get('manifestSha256') or extension.get('predecessorLifecycleGeneration') != runtime.get('lifecycleGeneration'):
  raise SystemExit('Runtime manifest extension predecessor differs from the observed Runtime')
after = open(successor_path, 'rb').read()
if candidate['successorSelectorExpectations'] != [{'selectorId':'authority:current','expectedSuccessorIdentity':sha(after)}]:
  raise SystemExit('Authority successor does not match candidate')
rollback_hash=sha(canonical({'authorityBefore':sha(before),'authorityAfter':sha(after),'runtimeLifecycleBefore':predecessor_lifecycle,'runtimeAfter':runtime_stage}))
if candidate.get('rollbackPlanHash') != rollback_hash:
  raise SystemExit('candidate rollback plan does not bind the observed Runtime and Authority identities')
successor=json.loads(after)
snapshot=successor.get('snapshotId')
if not isinstance(snapshot, str) or not re.fullmatch(r'snap-[0-9a-f]{64}', snapshot): raise SystemExit('Authority successor snapshot identity is invalid')
manifest=os.path.join(os.path.dirname(authority_path), 'releases', snapshot, 'manifest.json')
if not os.path.isfile(manifest) or os.path.islink(manifest): raise SystemExit('Authority successor snapshot is not installed as a regular manifest')
authority_labels=labels.get('authority')
if not isinstance(authority_labels,dict) or any(authority_labels.get(key) != successor.get(key) for key in ('snapshotId','snapshotHash','releaseId','releaseSetId')):
  raise SystemExit('presentation label qualification does not bind the successor Authority')
installed_manifest=json.load(open(manifest, encoding='utf-8'))
if any(installed_manifest.get(key) != successor.get(key) for key in ('snapshotId','snapshotHash','releaseId','releaseSetId')):
  raise SystemExit('installed Authority snapshot manifest differs from successor')
if teaching_reclosure.get('successorSnapshotHash') != successor.get('snapshotHash') or teaching_reclosure.get('changedFields') != ['scopeHash']:
  raise SystemExit('teaching governance reclosure does not bind the successor Authority')
if projection_adjustment.get('authoritySnapshotHash') != successor.get('snapshotHash'):
  raise SystemExit('Teaching Projection scope binding does not bind the successor Authority')
binding_authority=projection_scope_binding.get('authority')
if not isinstance(binding_authority,dict) or any(binding_authority.get(key) != successor.get(key) for key in ('snapshotId','snapshotHash','releaseId','releaseSetId')):
  raise SystemExit('Teaching Projection scope binding does not bind the successor Authority')
declaration = {'contract':'runtime-blob-coordinated-cutover.v1', **runtime_stage, 'candidateReceiptHash':candidate['receiptHash']}
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
  python3 "$LIFECYCLE" restore-coordinated-predecessor \
    --state-dir "$STATE_DIR" --predecessor-lifecycle "$candidate_dir/lifecycle-predecessor.json" \
    --successor-identity "$candidate_dir/lifecycle-identity.json" \
    --coordinated-cutover "$candidate_dir/coordinated-cutover.json" \
    --host-state-script "$HOST_STATE" >/dev/null 2>&1
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

inspect_incomplete_transaction() {
  python3 - "$status_path" "$journal_dir" "$candidate_dir/candidate-receipt.json" "$candidate_dir/authority-current.json" "$previous_pointer" "$AUTHORITY_ROOT/current.json" "$final_receipt" "$previous_final_receipt" <<'PY'
import hashlib, json, os, re, stat, sys

status_path, journal_dir, candidate_path, successor_path, predecessor_path, authority_path, final_path, previous_final_path = sys.argv[1:]
sha = lambda value: hashlib.sha256(value).hexdigest()
canonical = lambda value: json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()

def regular(path, label, required=True):
    if not os.path.exists(path):
        if required: raise SystemExit('ERROR: %s is missing' % label)
        return None
    mode = os.lstat(path).st_mode
    if not stat.S_ISREG(mode) or os.path.islink(path):
        raise SystemExit('ERROR: %s must be a regular non-symlink file' % label)
    return open(path, 'rb').read()

status_wire = regular(status_path, 'current transaction status', required=False)
if status_wire is None:
    raise SystemExit(0)
try:
    status_record = json.loads(status_wire.decode('utf-8'))
except Exception as error:
    raise SystemExit('ERROR: current transaction status is invalid: %s' % error)
expected_status_keys = {'contract', 'transactionId', 'journalPath', 'journalHash', 'status', 'updatedAt'}
if not isinstance(status_record, dict) or set(status_record) != expected_status_keys or status_record.get('contract') != 'r4-coordinated-production-transaction-status/v1':
    raise SystemExit('ERROR: current transaction status has an unsupported contract')
transaction_id = status_record.get('transactionId')
journal_name = status_record.get('journalPath')
journal_hash = status_record.get('journalHash')
if not isinstance(transaction_id, str) or not re.fullmatch(r'tx-[0-9a-f-]{36}', transaction_id):
    raise SystemExit('ERROR: current transaction status has an invalid transaction id')
if journal_name != transaction_id + '.json' or os.path.basename(journal_name) != journal_name:
    raise SystemExit('ERROR: current transaction status points outside its immutable journal')
if not isinstance(journal_hash, str) or not re.fullmatch(r'[a-f0-9]{64}', journal_hash):
    raise SystemExit('ERROR: current transaction status has an invalid journal hash')
journal_path = os.path.join(journal_dir, journal_name)
journal_wire = regular(journal_path, 'immutable transaction journal')
try:
    journal = json.loads(journal_wire.decode('utf-8'))
except Exception as error:
    raise SystemExit('ERROR: immutable transaction journal is invalid: %s' % error)
journal_keys = {'contract', 'transactionId', 'openedAt', 'candidateReceiptHash', 'predecessor', 'orderedMutations', 'compensationPlan', 'journalHash'}
if not isinstance(journal, dict) or set(journal) != journal_keys or journal.get('contract') != 'cutover-transaction-journal/v1':
    raise SystemExit('ERROR: immutable transaction journal has an unsupported contract')
journal_body = {key: journal[key] for key in ('transactionId', 'openedAt', 'candidateReceiptHash', 'predecessor', 'orderedMutations', 'compensationPlan')}
if journal.get('transactionId') != transaction_id or journal.get('journalHash') != journal_hash or sha(canonical(journal_body)) != journal_hash:
    raise SystemExit('ERROR: immutable transaction journal does not match the current status')
if status_record.get('status') in {'COMMITTED', 'ROLLED_BACK'}:
    raise SystemExit(0)
if status_record.get('status') == 'BLOCKED_RECOVERY':
    raise SystemExit('ERROR: prior coordinated transaction is BLOCKED_RECOVERY and requires operator investigation')
if status_record.get('status') not in {'PREPARED', 'AUTHORITY_APPLIED', 'RUNTIME_ACTIVATED', 'FINAL_RECEIPT_WRITTEN', 'SUCCESSOR_READY'}:
    raise SystemExit('ERROR: current transaction status is not recoverable')
candidate = json.loads(regular(candidate_path, 'candidate receipt').decode('utf-8'))
if not isinstance(candidate, dict) or journal.get('candidateReceiptHash') != candidate.get('receiptHash'):
    raise SystemExit('ERROR: incomplete transaction binds a different candidate receipt')
successor = regular(successor_path, 'successor Authority pointer')
predecessor = regular(predecessor_path, 'captured predecessor Authority pointer')
mutation = journal.get('orderedMutations')
if (not isinstance(mutation, list) or len(mutation) != 1 or not isinstance(mutation[0], dict)
        or mutation[0].get('selectorId') != 'authority:current'
        or mutation[0].get('expectedPredecessorIdentity') != sha(predecessor)
        or mutation[0].get('successorIdentity') != sha(successor)):
    raise SystemExit('ERROR: incomplete transaction Authority identities do not match its candidate')
authority = regular(authority_path, 'live Authority pointer')
if authority == predecessor:
    authority_state = 'predecessor'
elif authority == successor:
    authority_state = 'successor'
else:
    raise SystemExit('ERROR: live Authority pointer does not belong to the incomplete transaction')
previous_final = regular(previous_final_path, 'captured predecessor final receipt', required=False)
final = regular(final_path, 'live final receipt', required=False)
final_state = 'none'
if final is not None:
    try:
        receipt = json.loads(final.decode('utf-8'))
    except Exception as error:
        raise SystemExit('ERROR: live final receipt is invalid: %s' % error)
    if isinstance(receipt, dict) and receipt.get('transactionId') == transaction_id:
        expected_receipt_keys = {'contract', 'receiptId', 'sealedAt', 'transactionId', 'journalHash', 'candidateReceiptHash', 'committedSelectors', 'mutationReceiptHashes', 'runtimeActiveReceiptHash', 'runtimeActiveIdentity', 'receiptHash'}
        receipt_body = {key: receipt.get(key) for key in ('transactionId', 'journalHash', 'candidateReceiptHash', 'committedSelectors', 'mutationReceiptHashes', 'runtimeActiveReceiptHash', 'runtimeActiveIdentity')}
        receipt_hash = sha(canonical(receipt_body))
        if (set(receipt) != expected_receipt_keys or receipt.get('contract') != 'coordinated-active-receipt/v1'
                or receipt.get('journalHash') != journal_hash or receipt.get('candidateReceiptHash') != candidate.get('receiptHash')
                or receipt.get('receiptHash') != receipt_hash or receipt.get('receiptId') != 'act-' + receipt_hash[:24]):
            raise SystemExit('ERROR: live final receipt does not match the incomplete transaction')
        final_state = 'successor'
    elif previous_final is not None and final == previous_final:
        final_state = 'predecessor'
    else:
        raise SystemExit('ERROR: live final receipt does not belong to the incomplete transaction or its predecessor')
if previous_final is not None and final_state == 'none':
    raise SystemExit('ERROR: captured predecessor final receipt disappeared during the incomplete transaction')
print('\t'.join((transaction_id, journal_name, journal['openedAt'], authority_state, final_state, '1' if previous_final is not None else '0')))
PY
}

block_incomplete_recovery() {
  local message="$1"
  echo "ERROR: $message" >&2
  if [[ -n "$transaction_id" && -n "$journal_path" ]]; then
    write_journal BLOCKED_RECOVERY || true
  fi
  completed=1
  trap - ERR INT TERM
  exit 1
}

recover_incomplete_transaction() {
  local stale transaction_journal authority_state final_state previous_final_state
  if ! stale="$(inspect_incomplete_transaction)"; then
    echo "ERROR: unable to inspect the prior coordinated transaction" >&2
    return 1
  fi
  [[ -n "$stale" ]] || return 0
  IFS=$'\t' read -r transaction_id transaction_journal opened_at authority_state final_state previous_final_state <<<"$stale"
  journal_path="$journal_dir/$transaction_journal"
  rollback_image="$(active_image)" || block_incomplete_recovery 'incomplete transaction has no recoverable predecessor app image'
  previous_final_receipt_present="$previous_final_state"
  consumers_stop_intent=1
  if [[ "$authority_state" == "successor" ]]; then
    authority_mutated=1
  else
    if ! python3 - "$LIFECYCLE" "$STATE_DIR" "$candidate_dir/lifecycle-predecessor.json" <<'PY'
import json, subprocess, sys
lifecycle, state_dir, predecessor_path = sys.argv[1:]
live = json.loads(subprocess.check_output(['python3', lifecycle, 'inspect', '--state-dir', state_dir], text=True))
predecessor = json.load(open(predecessor_path, encoding='utf-8'))
if live != predecessor:
    raise SystemExit('Runtime lifecycle is not the captured predecessor while Authority is unchanged')
PY
    then
      block_incomplete_recovery 'incomplete transaction has an inconsistent Authority and Runtime predecessor state'
    fi
  fi
  if [[ "$final_state" == "successor" ]]; then
    final_receipt_hash="$(sha256sum "$final_receipt" | awk '{print $1}')"
    final_receipt_written=1
  fi
  echo "WARN: recovering incomplete coordinated transaction $transaction_id before opening a new transaction" >&2
  false
}

recover() {
  local status=$?
  set +e
  local recovery_safe=1
  if [[ "$completed" == "1" ]]; then exit "$status"; fi
  if [[ "$authority_mutated" == "1" ]]; then
    # A failed post-deploy smoke can leave the successor app running. Stop it
    # before changing either selector so no consumer observes a mixed pair.
    if [[ "$consumers_stop_intent" == "1" ]]; then
      stop_consumers || recovery_safe=0
    fi
    if [[ "$recovery_safe" == "1" ]]; then
      restore_runtime_predecessor || recovery_safe=0
    fi
  fi
  if [[ "$recovery_safe" == "1" && "$authority_mutated" == "1" && -f "$previous_pointer" ]]; then
    expected_after="$(sha256sum "$candidate_dir/authority-current.json" | awk '{print $1}')"
    current_after="$(sha256sum "$AUTHORITY_ROOT/current.json" | awk '{print $1}')"
    if [[ "$current_after" == "$expected_after" ]]; then
      write_authority_pointer "$previous_pointer"
    elif [[ "$current_after" != "$(sha256sum "$previous_pointer" | awk '{print $1}')" ]]; then
      recovery_safe=0
    fi
  fi
  if [[ "$recovery_safe" == "1" ]]; then
    restore_final_receipt || recovery_safe=0
  fi
  if [[ "$recovery_safe" == "1" && "$consumers_stop_intent" == "1" && -n "$rollback_image" ]]; then
    RUNTIME_DELIVERY_MODE=ossfs-blob-view ACT_RUNTIME_OSS_RAM_ROLE="$RAM_ROLE" ACT_COORDINATED_CUTOVER_REQUIRED="$([[ "$previous_final_receipt_present" == "1" ]] && printf true || printf false)" \
      ACT_COORDINATED_ACTIVE_RECEIPT_PATH="$final_receipt" \
      ACT_RUNTIME_ACTIVE_RECEIPT_PATH="$STATE_DIR/act-runtime-active-receipt.json" RUNTIME_CONTENT_DIR="$VIEW_ROOT/current" APP_IMAGE="$rollback_image" \
      "$DEPLOY" --runtime-cutover-app-only >/dev/null 2>&1 || recovery_safe=0
    if [[ "$recovery_safe" == "1" ]]; then
      for name in act-obe-app act-obe-worker act-obe-submission-scanner act-obe-submission-gc; do
        if ! podman container exists "$name" || [[ "$(podman inspect --format '{{.State.Running}}' "$name")" != "true" ]]; then
          recovery_safe=0
          break
        fi
      done
    fi
    if [[ "$recovery_safe" == "1" ]]; then
      app_port="$(awk -F= '$1 == "APP_PORT" { print $2 }' "$PROJECT_DIR/data/runtime/act-obe.env" | tail -n 1)"
      [[ "$app_port" =~ ^[0-9]{1,5}$ ]] || recovery_safe=0
      if [[ "$recovery_safe" == "1" ]]; then
        curl -fsS "http://127.0.0.1:${app_port}/api/readyz" >/dev/null || recovery_safe=0
      fi
    fi
  fi
  if [[ -n "$transaction_id" ]]; then
    if [[ "$recovery_safe" == "1" ]]; then write_journal ROLLED_BACK; else write_journal BLOCKED_RECOVERY; fi
  fi
  exit "$status"
}
trap recover ERR INT TERM

recover_incomplete_transaction
rollback_image="$(active_image)"
preflight_and_prepare
if [[ -e "$final_receipt" ]]; then
  [[ -f "$final_receipt" && ! -L "$final_receipt" ]] || { echo "ERROR: prior coordinated active receipt is not a regular file" >&2; exit 1; }
  cp -- "$final_receipt" "$previous_final_receipt"
  previous_final_receipt_present=1
fi
cp -- "$AUTHORITY_ROOT/current.json" "$previous_pointer"
transaction_id="tx-$(python3 -c 'import uuid; print(uuid.uuid4())')"
journal_path="$journal_dir/${transaction_id}.json"
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
write_journal RUNTIME_ACTIVATED
seal_final_receipt
final_receipt_hash="$(sha256sum "$final_receipt" | awk '{print $1}')"
final_receipt_written=1
write_journal FINAL_RECEIPT_WRITTEN
RUNTIME_DELIVERY_MODE=ossfs-blob-view ACT_RUNTIME_OSS_RAM_ROLE="$RAM_ROLE" ACT_COORDINATED_CUTOVER_REQUIRED=true \
  ACT_COORDINATED_ACTIVE_RECEIPT_PATH="$final_receipt" ACT_RUNTIME_ACTIVE_RECEIPT_PATH="$STATE_DIR/act-runtime-active-receipt.json" \
  RUNTIME_CONTENT_DIR="$VIEW_ROOT/current" APP_IMAGE="$rollback_image" "$DEPLOY" --runtime-cutover-app-only
"$ACTIVATOR" --release-id "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["runtimeRelease"]["releaseId"])' "$candidate_dir/runtime-stage.json")" \
  --expected-active-release "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["runtime"]["releaseId"])' "$candidate_dir/predecessor-observation.json")" \
  --manifest "$candidate_dir/manifest.json" --release-receipt "$candidate_dir/release-receipt.json" --verification-receipt "$candidate_dir/publisher-verification.json" \
  --ram-role "$RAM_ROLE" --verify-active-consumers >/dev/null
write_journal SUCCESSOR_READY
write_journal COMMITTED
completed=1
trap - ERR INT TERM
printf '{"status":"COMMITTED","transactionId":"%s"}\n' "$transaction_id"
