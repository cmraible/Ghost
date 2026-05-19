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

## Files

- `debezium/ghost-email-recipients.json` registers the scoped MySQL connector.
- `tinybird/connections/kafka_conn.connection` points Tinybird Local at Kafka.
- `tinybird/datasources/email_recipients_cdc.datasource` stores raw Debezium JSON records.
- `tinybird/endpoints/email_recipients_latest.pipe` exposes the latest non-deleted record for each recipient id.
