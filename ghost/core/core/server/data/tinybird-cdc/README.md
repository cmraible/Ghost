# Email Recipients CDC Spike

This is a local spike for streaming Ghost's MySQL `email_recipients` table into Tinybird Local.

The local path is:

```text
Ghost -> MySQL binlog -> Debezium Kafka Connect -> Kafka -> Tinybird Kafka datasource -> Tinybird endpoint
```

Run it from the repository root:

```bash
pnpm dev:cdc
```

This uses `compose.dev.yaml` plus `compose.dev.cdc.yaml`. The CDC overlay:

- switches the dev MySQL service to `mysql:8.0` and enables row-based binary logging
- uses a separate `mysql-cdc-data` Docker volume so it does not reuse an existing MySQL 8.4 dev volume
- starts Kafka, Debezium Connect, Tinybird Local, and a one-shot `tb-cdc` deploy container
- registers the Debezium connector automatically after Ghost has created the schema

The Ghost dev database is `ghost_dev`, so Debezium emits the topic:

```text
ghost.ghost_dev.email_recipients
```

## Email analytics integration

This spike keeps the existing Mailgun polling flow for collecting delivery/open/failure events. Mailgun events still update MySQL `email_recipients`, and the CDC pipeline streams those row changes into Tinybird.

When the `emailAnalyticsTinybirdAggregations` labs flag is enabled:

- the normal per-fetch email/member aggregation step is skipped
- a recurring `email-analytics-reconcile-stats-tinybird` job is scheduled alongside `email-analytics-fetch-latest`
- the reconciliation job queries Tinybird's `email_recipients_latest` endpoint and writes aggregate counts back to MySQL `emails` and `members`

The current spike reconciliation is intentionally blunt: it scans all emails and members in batches and recalculates their aggregate fields from Tinybird. A production implementation should use a durable cursor and reconcile only changed `email_id` and `member_id` values.

## Commands

Re-register the Debezium connector:

```bash
pnpm cdc:register
```

Insert and update a sample `email_recipients` row:

```bash
pnpm cdc:smoke-test
```

Query the Tinybird latest-row endpoint:

```bash
pnpm cdc:query
```

Reset the CDC stack:

```bash
DEV_COMPOSE_FILES='-f compose.dev.cdc.yaml' pnpm docker:clean
pnpm dev:cdc
```

## Remaining spike checks

- TODO: Verify delete/update correctness with an insert -> update -> delete scenario. Confirm the latest-row Tinybird endpoint excludes the deleted `email_recipients` row, and test rapid repeated updates to see whether the current `__ts_ms` ordering is deterministic enough.
- TODO: Prove the incremental reconciliation shape. Sketch or prototype a Tinybird query/pipe that returns affected `email_id` and `member_id` values since a durable cursor, so production reconciliation does not need to rescan all emails and members.

## Files

- `debezium/ghost-email-recipients.json` registers the scoped MySQL connector.
- `tinybird/connections/kafka_conn.connection` points Tinybird Local at Kafka.
- `tinybird/datasources/email_recipients_cdc.datasource` stores raw Debezium JSON records.
- `tinybird/endpoints/email_recipients_latest.pipe` exposes the latest non-deleted record for each recipient id.
