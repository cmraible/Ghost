#!/bin/sh
set -eu

docker compose -f compose.dev.yaml -f compose.dev.cdc.yaml exec -T mysql mysql \
  -uroot \
  "-p${MYSQL_ROOT_PASSWORD:-root}" \
  "${MYSQL_DATABASE:-ghost_dev}" <<'SQL'
SET FOREIGN_KEY_CHECKS=0;

INSERT INTO email_recipients (
    id,
    email_id,
    member_id,
    batch_id,
    processed_at,
    delivered_at,
    opened_at,
    failed_at,
    member_uuid,
    member_email,
    member_name
) VALUES (
    'cdc_spike_recipient_001',
    'cdc_spike_email_001',
    'cdc_spike_member_001',
    'cdc_spike_batch_001',
    NOW(3),
    NULL,
    NULL,
    NULL,
    '11111111-1111-4111-8111-111111111111',
    'cdc-spike@example.com',
    'CDC Spike Insert'
) ON DUPLICATE KEY UPDATE
    processed_at = VALUES(processed_at),
    delivered_at = NULL,
    opened_at = NULL,
    failed_at = NULL,
    member_email = VALUES(member_email),
    member_name = VALUES(member_name);

UPDATE email_recipients
SET
    delivered_at = NOW(3),
    member_name = 'CDC Spike Update'
WHERE id = 'cdc_spike_recipient_001';

SET FOREIGN_KEY_CHECKS=1;
SQL
