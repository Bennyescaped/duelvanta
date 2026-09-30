#!/usr/bin/env bash
# CI-only audit wrapper for the unchanged V124 N19 pg_ctl invocation.
set -euo pipefail
test "${GITHUB_ACTIONS:-}" = true
test "$#" = 6
test "$1" = -D && test "$2" = "$W11_PG_DATA"
test "$3" = -m && test "$4" = fast && test "$5" = -w && test "$6" = restart
test "$W11_PG_DATA" = "$RUNNER_TEMP/w11_isolated_${GITHUB_RUN_ID}_${GITHUB_RUN_ATTEMPT}"
test "$W11_REAL_PG_CTL" = /usr/lib/postgresql/17/bin/pg_ctl
test "$W11_PSQL" = /usr/lib/postgresql/17/bin/psql
test "$PGHOST" = 127.0.0.1 && test "$PGPORT" = 55432
audit="$W11_RESTART_EVIDENCE"
mkdir -p "$audit"
test ! -e "$audit/w11-n19-before.json"
state_sql="select json_build_object('version',current_setting('server_version_num'),'data_directory',current_setting('data_directory'),'fsync',current_setting('fsync'),'synchronous_commit',current_setting('synchronous_commit'),'system_identifier',(select system_identifier::text from pg_control_system()),'postmaster_started',pg_postmaster_start_time(),'backend_pid',pg_backend_pid())"
"$W11_PSQL" -X -v ON_ERROR_STOP=1 -At -c "$state_sql" > "$audit/w11-n19-before.json"
mapfile -t dbs < <("$W11_PSQL" -X -v ON_ERROR_STOP=1 -At -c "select datname from pg_database where datname like 'f3_ci_%'")
test "${#dbs[@]}" = 1
[[ "${dbs[0]}" =~ ^f3_ci_[0-9a-f]{32}$ ]]
proof_sql="select coalesce(json_agg(json_build_object('proof_id',proof_id,'receipt_id',receipt_id,'record_kind',record_kind,'commit_ref',commit_ref,'created_transaction',created_transaction::text,'cipher_commitment',encode(cipher_commitment,'hex'),'cipher_sha256',encode(sha256(ciphertext),'hex')) order by proof_id),'[]'::json) from dv_market_private.psttg_w11_envelope_proof_v1"
"$W11_PSQL" -X -v ON_ERROR_STOP=1 -At -d "${dbs[0]}" -c "$proof_sql" > "$audit/w11-n19-proofs-before.json"
before_pid=$(head -n 1 "$W11_PG_DATA/postmaster.pid")
"$W11_REAL_PG_CTL" "$@" > "$audit/w11-n19-pgctl.log" 2>&1
after_pid=$(head -n 1 "$W11_PG_DATA/postmaster.pid")
test "$before_pid" != "$after_pid"
if kill -0 "$before_pid" 2>/dev/null; then
  echo 'Old W11 postmaster still exists after restart' >&2
  exit 1
fi
"$W11_PSQL" -X -v ON_ERROR_STOP=1 -At -c "$state_sql" > "$audit/w11-n19-after.json"
"$W11_PSQL" -X -v ON_ERROR_STOP=1 -At -d "${dbs[0]}" -c "$proof_sql" > "$audit/w11-n19-proofs-after.json"
python - "$audit" "$before_pid" "$after_pid" "${dbs[0]}" <<'PY'
import json,sys
from pathlib import Path
p=Path(sys.argv[1]);before=json.loads((p/'w11-n19-before.json').read_text());after=json.loads((p/'w11-n19-after.json').read_text())
a=json.loads((p/'w11-n19-proofs-before.json').read_text());b=json.loads((p/'w11-n19-proofs-after.json').read_text())
assert int(before['version'])//10000==int(after['version'])//10000==17
assert before['data_directory']==after['data_directory']
assert before['system_identifier']==after['system_identifier']
assert before['postmaster_started']!=after['postmaster_started']
assert before['fsync']==after['fsync']==before['synchronous_commit']==after['synchronous_commit']=='on'
assert a and a==b
(p/'w11-n19-restart.json').write_text(json.dumps(dict(cluster_before=before,cluster_after=after,postmaster_pid_before=sys.argv[2],postmaster_pid_after=sys.argv[3],old_postmaster_terminated=True,database=sys.argv[4],committed_proofs_before_restart=a,persisted_proof_rows_identical=True,actual_pg_ctl_restart=True,full_m02_revalidation='REQUIRES_SEPARATE_N19_RUNNER_PASS'),indent=2)+'\n')
PY
