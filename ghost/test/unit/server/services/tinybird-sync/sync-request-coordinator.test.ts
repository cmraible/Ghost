import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSyncRequestCoordinator,
  SYNC_BOUNDARY_MARGIN_MS,
} from '../../../../../core/server/services/tinybird-sync/sync-request-coordinator';
import { SAFETY_LAG_MS } from '../../../../../core/server/services/tinybird-sync/sync-table-to-tinybird';
import TinybirdSyncJob from '../../../../../core/server/services/tinybird-sync/jobs/tinybird-sync-job';

const DELAY = SAFETY_LAG_MS + SYNC_BOUNDARY_MARGIN_MS;

describe('requested Tinybird sync (NY-1661)', () => {
  const setup = () => {
    let id = 0;
    const dispatch = vi.fn<(job: TinybirdSyncJob) => Promise<void>>().mockResolvedValue();
    const isConfigured = vi.fn(() => true);
    const logging = { error: vi.fn() };
    const coordinator = createSyncRequestCoordinator({
      dispatch,
      isConfigured,
      logging,
      now: () => new Date(),
      createId: () => {
        id += 1;
        return String(id);
      },
    });
    return { coordinator, dispatch, isConfigured, logging };
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('waits through the strict safety boundary and whole-second margin', async () => {
    const { coordinator, dispatch } = setup();
    coordinator.request();
    await vi.advanceTimersByTimeAsync(SAFETY_LAG_MS - 1);
    expect(dispatch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(dispatch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SYNC_BOUNDARY_MARGIN_MS - 1);
    expect(dispatch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(dispatch).toHaveBeenCalledExactlyOnceWith(new TinybirdSyncJob({ requestId: '1' }));
  });

  it('keeps the first deadline and a trailing deadline for staggered signups', async () => {
    const { coordinator, dispatch } = setup();
    coordinator.request();
    await vi.advanceTimersByTimeAsync(DELAY - 1000);
    coordinator.request();
    await vi.advanceTimersByTimeAsync(1000);
    expect(dispatch).toHaveBeenCalledTimes(1);
    coordinator.complete('1');
    await vi.advanceTimersByTimeAsync(DELAY - 1001);
    expect(dispatch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('makes progress during continuous bursts and retains the final writes', async () => {
    const { coordinator, dispatch } = setup();
    dispatch.mockImplementation(async (job) => coordinator.complete(job.requestId));
    for (let second = 0; second < 180; second++) {
      for (let signup = 0; signup < 100; signup++) {
        coordinator.request();
      }
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(dispatch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(dispatch).toHaveBeenCalledTimes(4);
  });

  it('bounds queued work until delivery finishes, preserving writes during a slow sync', async () => {
    const { coordinator, dispatch } = setup();
    coordinator.request();
    await vi.advanceTimersByTimeAsync(DELAY);
    for (let minute = 0; minute < 10; minute++) {
      coordinator.request();
      await vi.advanceTimersByTimeAsync(60_000);
    }
    expect(dispatch).toHaveBeenCalledTimes(1);
    coordinator.complete(); // Recurring completion must not release the request.
    coordinator.complete('stale');
    await vi.advanceTimersByTimeAsync(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    coordinator.complete('1');
    await vi.advanceTimersByTimeAsync(1);
    expect(dispatch).toHaveBeenCalledTimes(2);
    coordinator.complete('2');
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(dispatch).toHaveBeenCalledTimes(3);
  });

  it('logs enqueue failures and allows later requests', async () => {
    const { coordinator, dispatch, logging } = setup();
    dispatch.mockRejectedValueOnce(new Error('unavailable'));
    coordinator.request();
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(logging.error).toHaveBeenCalledTimes(1);
    coordinator.request();
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('checks configuration at request and dispatch time', async () => {
    const { coordinator, dispatch, isConfigured } = setup();
    isConfigured.mockReturnValue(false);
    coordinator.request();
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(dispatch).not.toHaveBeenCalled();
    isConfigured.mockReturnValue(true);
    coordinator.request();
    isConfigured.mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('drops pending timers on shutdown', async () => {
    const { coordinator, dispatch } = setup();
    coordinator.request();
    coordinator.stop();
    coordinator.request();
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
