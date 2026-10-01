#!/usr/bin/env bash
# FUTURE native acceptance only. Not executed for V135 local candidate formation.
set -euo pipefail
test "$(id -u)" != 0 || { echo 'M04 native runtime requires an already available non-root user' >&2; exit 1; }
test $# = 1 || { echo 'usage: m04-pg17-local.sh /absolute/PG17/bin' >&2; exit 1; }
pg17_bin=$1
test "${pg17_bin:0:1}" = / && test -x "$pg17_bin/pg_ctl" && test -x "$pg17_bin/initdb"
"$pg17_bin/postgres" --version | rg '^postgres \(PostgreSQL\) 17\.'
m04_cluster=$(mktemp -d /tmp/m04_isolated_XXXXXXXX)
export M04_PG_DATA=$m04_cluster M04_PG_CTL=$pg17_bin/pg_ctl
export PGHOST=$m04_cluster/socket PGPORT=55437 PGDATABASE=postgres
export PGUSER=$(id -un)
unset PGPASSWORD PGSERVICE PGSERVICEFILE PGSSLMODE PGOPTIONS
"$pg17_bin/initdb" -D "$m04_cluster" -A trust --no-instructions
mkdir "$PGHOST"
"$pg17_bin/pg_ctl" -D "$m04_cluster" -l "$m04_cluster/postmaster.log" -o "-k $PGHOST -p $PGPORT -c listen_addresses='' -c fsync=on -c synchronous_commit=on" -w start
cleanup() { "$pg17_bin/pg_ctl" -D "$m04_cluster" -m fast -w stop || true; echo "M04 disposable evidence retained at $m04_cluster"; }
trap cleanup EXIT
python tests/psttg_wire/test_m04_response_store.py --native
