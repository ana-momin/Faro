export type CollectionPolicy = {
  maxProviderCallsPerSync: number;
  maxProviderCallsPerDay: number;
  maxPagesPerFamily: number;
  maxQueryFamiliesPerSync: number;
  activeMonitorLimitPerUser: number;
  scheduledMonitorBatchSize: number;
  scheduledProviderCallsPerMonitor: number;
  pollingLabel: string;
};

function boundedInt(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), minimum), maximum);
}

/**
 * These ceilings are deliberately conservative defaults. Production owners
 * may tune them through server-only environment configuration after observing
 * documented provider limits and their own credit allocation.
 */
export function collectionPolicy(): CollectionPolicy {
  return {
    maxProviderCallsPerSync: boundedInt(process.env.FARO_MAX_PROVIDER_CALLS_PER_SYNC, 4, 1, 12),
    maxProviderCallsPerDay: boundedInt(process.env.FARO_MAX_PROVIDER_CALLS_PER_DAY, 24, 1, 1_000),
    maxPagesPerFamily: boundedInt(process.env.FARO_MAX_PAGES_PER_FAMILY, 2, 1, 5),
    maxQueryFamiliesPerSync: boundedInt(process.env.FARO_MAX_QUERY_FAMILIES_PER_SYNC, 3, 1, 3),
    activeMonitorLimitPerUser: boundedInt(process.env.FARO_ACTIVE_MONITOR_LIMIT, 5, 1, 20),
    scheduledMonitorBatchSize: boundedInt(process.env.FARO_SCHEDULED_MONITOR_BATCH_SIZE, 1, 1, 20),
    scheduledProviderCallsPerMonitor: boundedInt(process.env.FARO_SCHEDULED_PROVIDER_CALLS_PER_MONITOR, 1, 1, 4),
    pollingLabel: "Scheduled polling — source checks use a bounded provider budget",
  };
}
