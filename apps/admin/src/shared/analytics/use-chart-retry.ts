import { useState } from 'react';

/** Keep retry progress tied to its query, including when filters change mid-request. */
export function useChartRetry(requestKey: string, refetch: () => Promise<void>) {
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(() => new Set());
  const isRetrying = pendingRequests.has(requestKey);

  const retry = async () => {
    if (isRetrying) {
      return;
    }
    setPendingRequests((pending) => new Set(pending).add(requestKey));
    try {
      await refetch();
    } finally {
      setPendingRequests((pending) => {
        const next = new Set(pending);
        next.delete(requestKey);
        return next;
      });
    }
  };

  return { isRetrying, retry };
}
