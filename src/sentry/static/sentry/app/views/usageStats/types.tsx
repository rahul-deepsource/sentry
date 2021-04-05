export enum Outcome {
  ACCEPTED = 'accepted',
  FILTERED = 'filtered',
  INVALID = 'invalid',
  DROPPED = 'dropped',
}

/**
 * Raw response from API endpoint
 */
export type UsageSeries = {
  start: string;
  end: string;
  groups: Array<{
    by: Record<string, string>;
    series: Record<string, number[]>;
    totals: Record<string, number>;
  }>;
  intervals: string[];
};

export type UsageStat = {
  date: string;
  total: number;
  accepted: number;
  filtered: number;
  dropped: {
    total: number;
    other?: number;
  };
};
