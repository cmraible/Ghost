import errors from '@tryghost/errors';
import type { Knex } from 'knex';
import {
  getIngestConfig,
  type GetIngestConfigDependencies,
  type IngestConfig,
} from './get-ingest-config';
import {
  AUTOMATION_SYNC_TARGETS,
  SAFETY_LAG_MS,
  syncTableToTinybird,
} from './sync-table-to-tinybird';
import TinybirdSyncJob from './jobs/tinybird-sync-job';
import type { JobsService } from '../jobs-service/jobs-service';
import { randomFiveMinuteCron } from '../jobs-service/cron';

const BATCH_SIZE = 5000;
// This should be a little less than the maximum, because rows are chunked by
// JSON line, not bytes strictly.
const MAX_PAYLOAD_BYTES = 9 * 1024 * 1024;
const MAX_PAYLOAD_MESSAGES = 1000;
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

type Logger = {
  error(error: unknown, message?: string): void;
  info(...args: unknown[]): void;
};

type Labs = {
  isSet(feature: string): boolean;
};

type TinybirdSyncDependencies = GetIngestConfigDependencies & {
  labs: Labs;
  knex: Knex;
  logging: Logger;
  random: () => number;
  now: () => Date;
  fetch: typeof globalThis.fetch;
  createId: () => string;
};

export function createTinybirdSyncService({
  config,
  settingsCache,
  labs,
  knex,
  logging,
  random,
  now,
  fetch,
  createId,
}: TinybirdSyncDependencies) {
  let scheduled = false;
  let requestedAt = 0;
  let syncTimer: ReturnType<typeof setTimeout> | undefined;

  const requestSync = (jobsService: Pick<JobsService, 'dispatch'>): void => {
    if (!labs.isSet('automationsTinybirdSync') || !getIngestConfig({ config, settingsCache })) {
      return;
    }

    requestedAt = now().getTime();
    if (syncTimer) {
      return;
    }

    const schedule = (at: number): void => {
      // The cutoff is exclusive. Wait until these committed rows are older than
      // the watermark safety lag. Database cutoffs have second precision.
      // Do not postpone earlier requests in a burst.
      syncTimer = setTimeout(
        () => {
          syncTimer = undefined;
          if (requestedAt > at) {
            schedule(requestedAt);
          }
          if (
            !labs.isSet('automationsTinybirdSync') ||
            !getIngestConfig({ config, settingsCache })
          ) {
            return;
          }
          void jobsService.dispatch(new TinybirdSyncJob()).catch((error: unknown) => {
            logging.error(error, '[Tinybird sync] Failed to enqueue automation run sync');
          });
        },
        Math.max(0, at + SAFETY_LAG_MS + 1000 - now().getTime()),
      );
      syncTimer.unref();
    };

    schedule(requestedAt);
  };

  const syncAll = async (ingest: IngestConfig): Promise<void> => {
    const results = await Promise.allSettled(
      AUTOMATION_SYNC_TARGETS.map(async (target) => {
        const sent = await syncTableToTinybird(target, {
          knex,
          ...ingest,
          now,
          fetch,
          createId,
          batchSize: BATCH_SIZE,
          maxPayloadBytes: MAX_PAYLOAD_BYTES,
          maxPayloadMessages: MAX_PAYLOAD_MESSAGES,
          requestTimeoutMs: REQUEST_TIMEOUT_MS,
        });
        logging.info(
          { system: { event: 'tinybird.sync.completed', table: target.table, sent } },
          `[Tinybird sync] ${target.table}: sent ${sent} rows`,
        );
      }),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        logging.error(result.reason, '[Tinybird sync] Failed to sync table');
      }
    }
  };

  const sync = async (): Promise<void> => {
    if (!labs.isSet('automationsTinybirdSync')) {
      return;
    }

    const ingest = getIngestConfig({ config, settingsCache });
    if (!ingest) {
      return;
    }

    await syncAll(ingest);
  };

  const scheduleJob = async (
    jobsService: Pick<JobsService, 'scheduleRecurring'>,
  ): Promise<void> => {
    if (scheduled) {
      throw new errors.IncorrectUsageError({
        message: 'Tinybird sync is already scheduled.',
      });
    }

    if (!getIngestConfig({ config, settingsCache })) {
      logging.info('[Tinybird sync] Not started: Traffic Analytics service is not configured');
      return;
    }

    scheduled = true;

    const isSyncEnabled = labs.isSet('automationsTinybirdSync');
    logging.info(
      { system: { event: 'tinybird.sync.started' } },
      `[Tinybird sync] Started: sync ${isSyncEnabled ? 'enabled' : 'disabled'} by labs flag (but may change)`,
    );

    const at = randomFiveMinuteCron(random);
    logging.info(`[Background Job] ${TinybirdSyncJob.type} scheduled at ${at}`);
    try {
      await jobsService.scheduleRecurring(new TinybirdSyncJob(), { cron: at });
    } catch (error) {
      // Unmarked so a later call can retry the registration.
      scheduled = false;
      throw error;
    }
  };

  return { scheduleJob, sync, requestSync };
}
