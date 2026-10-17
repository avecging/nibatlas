"""Prove the retired reset refuses writes in the disposable local CI database."""
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent.parent
PSQL = ['docker', 'exec', '-i', 'supabase_db_nibatlas', 'psql', '-XAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres']
SNAPSHOT = (ROOT / 'scripts/maintenance/snapshot-staging-catalogue.sql').read_text()
RESET = (ROOT / 'scripts/maintenance/reset-staging-catalogue.sql').read_text()

def run(sql):
    return subprocess.run(PSQL, input=sql, text=True, capture_output=True)

before = run(SNAPSHOT)
assert before.returncode == 0, 'Could not read local CI snapshot'
for prefix in ["", "BEGIN; SET LOCAL nibatlas.catalogue_reset_confirmation='RESET DISPOSABLE NIBATLAS STAGING CATALOGUE';\n"]:
    result = run(prefix + RESET)
    assert result.returncode and 'Legacy catalogue reset is retired' in result.stderr, 'Retired reset was accepted'
after = run(SNAPSHOT)
assert after.returncode == 0
assert json.loads(before.stdout)['fingerprints'] == json.loads(after.stdout)['fingerprints'], 'Refused reset changed the local database'
print('Retired catalogue reset refuses every connection and leaves local data unchanged.')
