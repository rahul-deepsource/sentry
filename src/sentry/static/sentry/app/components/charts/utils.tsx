import {EChartOption} from 'echarts';
import {Location} from 'history';
import moment from 'moment';

import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {EventsStats, GlobalSelection, MultiSeriesEventsStats} from 'app/types';
import {escape} from 'app/utils';
import {parsePeriodToHours} from 'app/utils/dates';
import {decodeList} from 'app/utils/queryString';

const DEFAULT_TRUNCATE_LENGTH = 80;

// In minutes
export const SIXTY_DAYS = 86400;
export const THIRTY_DAYS = 43200;
export const TWO_WEEKS = 20160;
export const ONE_WEEK = 10080;
export const TWENTY_FOUR_HOURS = 1440;
export const ONE_HOUR = 60;

/**
 * If there are more releases than this number we hide "Releases" series by default
 */
export const RELEASE_LINES_THRESHOLD = 50;

export type DateTimeObject = Partial<GlobalSelection['datetime']>;

export function truncationFormatter(
  value: string,
  truncate: number | boolean | undefined
): string {
  if (!truncate) {
    return escape(value);
  }
  const truncationLength =
    truncate && typeof truncate === 'number' ? truncate : DEFAULT_TRUNCATE_LENGTH;
  const truncated =
    value.length > truncationLength ? value.substring(0, truncationLength) + '…' : value;
  return escape(truncated);
}

/**
 * Use a shorter interval if the time difference is <= 24 hours.
 */
export function useShortInterval(datetimeObj: DateTimeObject): boolean {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  return diffInMinutes <= TWENTY_FOUR_HOURS;
}

export function getInterval(datetimeObj: DateTimeObject, highFidelity = false) {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  if (diffInMinutes >= SIXTY_DAYS) {
    // Greater than or equal to 60 days
    return highFidelity ? '4h' : '1d';
  }

  if (diffInMinutes >= THIRTY_DAYS) {
    // Greater than or equal to 30 days
    return highFidelity ? '1h' : '4h';
  }

  if (diffInMinutes > TWENTY_FOUR_HOURS) {
    // Greater than 24 hours
    return highFidelity ? '30m' : '1h';
  }

  if (diffInMinutes <= ONE_HOUR) {
    // Less than or equal to 1 hour
    return highFidelity ? '1m' : '5m';
  }

  // Between 1 hour and 24 hours
  return highFidelity ? '5m' : '15m';
}

export function getDiffInMinutes(datetimeObj: DateTimeObject): number {
  const {period, start, end} = datetimeObj;

  if (start && end) {
    return moment(end).diff(start, 'minutes');
  }

  return (
    parsePeriodToHours(typeof period === 'string' ? period : DEFAULT_STATS_PERIOD) * 60
  );
}

// Max period (in hours) before we can no long include previous period
const MAX_PERIOD_HOURS_INCLUDE_PREVIOUS = 45 * 24;

export function canIncludePreviousPeriod(
  includePrevious: boolean | undefined,
  period: string | undefined
) {
  if (!includePrevious) {
    return false;
  }

  if (period && parsePeriodToHours(period) > MAX_PERIOD_HOURS_INCLUDE_PREVIOUS) {
    return false;
  }

  // otherwise true
  return !!includePrevious;
}

/**
 * Generates a series selection based on the query parameters defined by the location.
 */
export function getSeriesSelection(
  location: Location,
  parameter = 'unselectedSeries'
): EChartOption.Legend['selected'] {
  const unselectedSeries = decodeList(location?.query[parameter]);
  return unselectedSeries.reduce((selection, series) => {
    selection[series] = false;
    return selection;
  }, {});
}

export function isMultiSeriesStats(
  data: MultiSeriesEventsStats | EventsStats | null
): data is MultiSeriesEventsStats {
  return data !== null && data.data === undefined && data.totals === undefined;
}

// If dimension is a number convert it to pixels, otherwise use dimension
// without transform
export const getDimensionValue = (dimension?: number | string | null) => {
  if (typeof dimension === 'number') {
    return `${dimension}px`;
  }

  if (dimension === null) {
    return undefined;
  }

  return dimension;
};
