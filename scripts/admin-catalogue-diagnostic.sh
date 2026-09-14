#!/usr/bin/env bash
# Invoked only after the compatible staging Worker has deployed.
set -euo pipefail
project_ref="${NEXT_PUBLIC_SUPABASE_URL#https://}"
project_ref="${project_ref%%.*}"
test -n "$project_ref"

# Refuse to seed any project except the named staging project. Query
# the selected project directly: a least-privilege project-scoped PAT
# can read this endpoint but cannot enumerate every account project.
curl --fail --silent --show-error \
  "https://api.supabase.com/v1/projects/${project_ref}" \
  --header "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  | jq -e --arg ref "$project_ref" \
      '(.ref == $ref or .id == $ref) and .name == "nibatlas-staging"' \
  >/dev/null

pooler_url="$(
  curl --fail --silent --show-error \
    "https://api.supabase.com/v1/projects/${project_ref}/config/database/pooler" \
    --header "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    | jq -er \
        '[.[] | select(.database_type == "PRIMARY")][0] | (.connection_string // .connectionString)'
)"
case "$pooler_url" in
  *'[YOUR-PASSWORD]'*) ;;
  *) echo "Supabase did not return the expected staging pooler URL" >&2; exit 1 ;;
esac

encoded_password="$(
  jq -nr --arg password "$SUPABASE_DB_PASSWORD" '$password | @uri'
)"
db_url="${pooler_url/\[YOUR-PASSWORD\]/$encoded_password}"
echo "::add-mask::$db_url"

psql "$db_url" --no-psqlrc -v ON_ERROR_STOP=1 -f scripts/admin-catalogue-diagnostic.sql
unset db_url encoded_password pooler_url
