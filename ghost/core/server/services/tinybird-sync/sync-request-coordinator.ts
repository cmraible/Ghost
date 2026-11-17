import TinybirdSyncJob from './jobs/tinybird-sync-job';
import { SAFETY_LAG_MS } from './sync-table-to-tinybird';

// The cutoff is strict and database dates are truncated to whole seconds.
export const SYNC_BOUNDARY_MARGIN_MS = 1000;

export function createSyncRequestCoordinator({
  dispatch,
  isConfigured,
  now,
  createId,
  logging,
}: {
  dispatch: (job: TinybirdSyncJob) => Promise<void>;
  isConfigured: () => boolean;
  now: () => Date;
  createId: () => string;
  logging: { error(error: unknown, message: string): void };
}) {
  let earliest: number | undefined;
  let latest: number | undefined;
  let outstanding: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  function arm() {
    if (stopped || timer || outstanding || earliest === undefined) {
      return;
    }
    timer = setTimeout(
      () => {
        timer = undefined;
        void dispatchDue();
      },
      Math.max(0, earliest - now().getTime()),
    );
    timer.unref();
  }

  async function dispatchDue() {
    try {
      // Consume due work before fallible calls, retaining a trailing deadline
      // for newer writes. Two timestamps suffice regardless of signup volume.
      earliest = latest !== undefined && latest > now().getTime() ? latest : undefined;
      latest = earliest;
      if (!isConfigured()) {
        earliest = latest = undefined;
        return;
      }

      const requestId = createId();
      outstanding = requestId;
      try {
        await dispatch(new TinybirdSyncJob({ requestId }));
      } catch (error) {
        if (outstanding === requestId) {
          outstanding = undefined;
        }
        throw error;
      }
    } catch (error) {
      // The recurring job recovers failed deliveries. Never fail a committed write.
      logging.error(error, '[Tinybird sync] Failed to dispatch requested sync');
    } finally {
      arm();
    }
  }

  return {
    request() {
      if (stopped || !isConfigured()) {
        return;
      }
      const due = now().getTime() + SAFETY_LAG_MS + SYNC_BOUNDARY_MARGIN_MS;
      earliest = Math.min(earliest ?? due, due);
      latest = Math.max(latest ?? due, due);
      arm();
    },
    complete(requestId?: string) {
      // A recurring pass or a stale delivery cannot release a queued request.
      if (requestId !== undefined && outstanding === requestId) {
        outstanding = undefined;
        arm();
      }
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = undefined;
      earliest = latest = undefined;
      outstanding = undefined;
    },
  };
}
