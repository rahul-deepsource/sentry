import {MinimalProject} from 'app/types';

// Duplicated from getsentry
export enum DataCategory {
  ERRORS = 'errors',
  TRANSACTIONS = 'transactions',
  ATTACHMENTS = 'attachments',
}

export type RawStat = {
  quantity: number; // Counting for attachment size
  times_seen: number; // Counting for errors or transactions  // FIXME
};

export type UsageStat = {
  ts: string;
  accepted: RawStat;
  filtered: RawStat;
  dropped: {
    overQuota?: RawStat;
    spikeProtection?: RawStat;
    other?: RawStat;
  };
};

export type OrganizationUsageStats = {
  statsErrors: UsageStat[];
  statsTransactions: UsageStat[];
  statsAttachments: UsageStat[];
};

export type ProjectUsageStats = MinimalProject & OrganizationUsageStats;
