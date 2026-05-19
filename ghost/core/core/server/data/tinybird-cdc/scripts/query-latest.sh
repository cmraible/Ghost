#!/bin/sh
set -eu

docker compose -f compose.dev.yaml -f compose.dev.cdc.yaml run --no-deps --rm --entrypoint sh tb-cdc -lc "/root/.local/bin/tb --host http://tinybird-local:7181 sql \"select id, JSONExtractString(record, 'member_email') as email, JSONExtractString(record, 'member_name') as name, JSONExtractString(record, 'processed_at') as processed_at, JSONExtractString(record, 'delivered_at') as delivered_at, JSONExtractString(record, 'opened_at') as opened_at, JSONExtractString(record, 'failed_at') as failed_at, JSONExtractString(record, '__op') as op, JSONExtractString(record, '__source_ts_ms') as source_ts_ms, JSONExtractString(record, '__ts_ms') as ts_ms from email_recipients_latest order by id\""
