#!/usr/bin/env bash
# Apply all SQL migrations to a Supabase Postgres database.
# Requires SUPABASE_DB_PASSWORD (from Supabase → Project Settings → Database).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_REF="${SUPABASE_PROJECT_REF:-raqmcjiyaafmqwsplmrc}"
DB_PASSWORD="${SUPABASE_DB_PASSWORD:?Set SUPABASE_DB_PASSWORD in .env.local or export it}"
DB_HOST="${SUPABASE_DB_HOST:-aws-1-ap-southeast-2.pooler.supabase.com}"
DB_PORT="${SUPABASE_DB_PORT:-5432}"

DB_URL="postgresql://postgres.${PROJECT_REF}@${DB_HOST}:${DB_PORT}/postgres"

for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ $(basename "$migration")"
  PGPASSWORD="$DB_PASSWORD" psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$migration"
done

echo "Done. Applied migrations via ${DB_HOST}"
