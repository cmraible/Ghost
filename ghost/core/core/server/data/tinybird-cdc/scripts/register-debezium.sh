#!/bin/sh
set -eu

docker compose -f compose.dev.yaml -f compose.dev.cdc.yaml exec -T debezium \
  curl -fsS -X PUT \
    -H 'Content-Type: application/json' \
    --data @/debezium/ghost-email-recipients.json \
    http://localhost:8083/connectors/ghost-email-recipients/config
