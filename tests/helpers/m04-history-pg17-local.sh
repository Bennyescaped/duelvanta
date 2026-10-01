#!/usr/bin/env bash
# V147 native R01-R36 only; never run during local candidate formation.
set -euo pipefail
test "$(id -u)" != 0 || { echo 'M04 native runtime requires an already available non-root user' >&2; exit 1; }
test $# = 1 || { echo 'usage: m04-pg17-local.sh /absolute/PG17/bin' >&2; exit 1; }
pg17_bin=$1
test "${pg17_bin:0:1}" = / && test -x "$pg17_bin/pg_ctl" && test -x "$pg17_bin/initdb"
"$pg17_bin/postgres" --version | rg '^postgres \(PostgreSQL\) 17\.'
m04_cluster=$(mktemp -d /tmp/m04_isolated_XXXXXXXX)
export M04_PG_DATA=$m04_cluster M04_PG_CTL=$pg17_bin/pg_ctl
export PGHOST=$m04_cluster/socket PGPORT=55437 PGDATABASE=postgres
export PGUSER=postgres
unset PGPASSWORD PGSERVICE PGSERVICEFILE PGSSLMODE PGOPTIONS
"$pg17_bin/initdb" -D "$m04_cluster" -U postgres -A trust --no-instructions
mkdir "$PGHOST"
"$pg17_bin/pg_ctl" -D "$m04_cluster" -l "$m04_cluster/postmaster.log" -o "-k $PGHOST -p $PGPORT -c listen_addresses='' -c fsync=on -c synchronous_commit=on" -w start
cleanup() { "$pg17_bin/pg_ctl" -D "$m04_cluster" -m fast -w stop || true; echo "M04 disposable evidence retained at $m04_cluster"; }
trap cleanup EXIT
# Bootstrap evidence precedes all fixtures; the server stays owned by this non-root OS user.
mkdir -p test-results
"$pg17_bin/psql" -X -At -v ON_ERROR_STOP=1 -c "select json_build_object('server_version',version(),'server_version_num',current_setting('server_version_num'),'current_user',current_user,'session_user',session_user,'postgres_role_exists',exists(select 1 from pg_roles where rolname='postgres'),'data_directory',current_setting('data_directory'),'system_identifier',(pg_control_system()).system_identifier::text,'socket',current_setting('unix_socket_directories'),'port',current_setting('port'),'listen_addresses',current_setting('listen_addresses'),'fsync',current_setting('fsync'),'synchronous_commit',current_setting('synchronous_commit'),'postmaster_started',pg_postmaster_start_time())" > test-results/m04-history-bootstrap.log
python - "$m04_cluster" "$PGHOST" "$PGPORT" <<'PY'
import json,os,pwd,sys
from pathlib import Path
p=Path('test-results/m04-history-bootstrap.log');d=json.loads(p.read_text())
cluster,socket,port=sys.argv[1:]
assert int(d['server_version_num'])//10000==17
assert d['current_user']==d['session_user']=='postgres' and d['postgres_role_exists']
assert d['data_directory']==cluster and Path(cluster).name.startswith('m04_isolated_')
assert d['socket']==socket==str(Path(cluster)/'socket') and d['port']==port
assert d['listen_addresses']=='' and d['fsync']==d['synchronous_commit']=='on'
pid=int((Path(cluster)/'postmaster.pid').read_text().splitlines()[0]);os.kill(pid,0)
uid_line=next(x for x in Path(f'/proc/{pid}/status').read_text().splitlines() if x.startswith('Uid:'))
uids=[int(x) for x in uid_line.split()[1:]]
assert os.getuid()!=0 and all(x==os.getuid() for x in uids)
assert Path(cluster).stat().st_uid==Path(socket).stat().st_uid==os.getuid()
d.update(gate='M04-bootstrap-role/1',phase='before_fixture',status='PASS',postmaster_pid=pid,
         os_uid=os.getuid(),os_user=pwd.getpwuid(os.getuid()).pw_name,postmaster_uids=uids)
p.write_text(json.dumps(d,indent=2)+'\n');print('M04_BOOTSTRAP '+json.dumps(d))
PY
python tests/psttg_wire/test_m04_adapter_history.py --native
