import React from 'react';
import {withTheme} from 'emotion-theming';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';

import AsyncComponent from 'app/components/asyncComponent';
import AreaChart from 'app/components/charts/areaChart';
import ErrorPanel from 'app/components/charts/errorPanel';
import LoadingPanel from 'app/components/charts/loadingPanel';
import {HeaderTitleLegend} from 'app/components/charts/styles';
import QuestionTooltip from 'app/components/questionTooltip';
import {IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import {OrganizationSummary} from 'app/types';
import {axisLabelFormatter} from 'app/utils/discover/charts';
import EventView from 'app/utils/discover/eventView';
import {getDuration} from 'app/utils/formatters';
import {Theme} from 'app/utils/theme';

import {
  filterToColour,
  filterToField,
  filterToString,
  SpanOperationBreakdownFilter,
} from './filter';

const QUERY_KEYS = [
  'environment',
  'project',
  'query',
  'start',
  'end',
  'statsPeriod',
] as const;

type ViewProps = Pick<EventView, typeof QUERY_KEYS[number]>;

type ApiResult = {
  [bucket: string]: number;
};

type Props = AsyncComponent['props'] &
  ViewProps & {
    theme: Theme;
    organization: OrganizationSummary;
    location: Location;
    currentFilter: SpanOperationBreakdownFilter;
  };

type State = AsyncComponent['state'] & {
  chartData: {data: ApiResult[]} | null;
};

/**
 * Fetch and render a bar chart that shows event volume
 * for each duration bucket. We always render 15 buckets of
 * equal widths based on the endpoints min + max durations.
 *
 * This graph visualizes how many transactions were recorded
 * at each duration bucket, showing the modality of the transaction.
 */
class DurationPercentileChart extends AsyncComponent<Props, State> {
  generateFields = () => {
    const {currentFilter} = this.props;

    if (currentFilter === SpanOperationBreakdownFilter.None) {
      return [
        'percentile(transaction.duration, 0.10)',
        'percentile(transaction.duration, 0.25)',
        'percentile(transaction.duration, 0.50)',
        'percentile(transaction.duration, 0.75)',
        'percentile(transaction.duration, 0.90)',
        'percentile(transaction.duration, 0.95)',
        'percentile(transaction.duration, 0.99)',
        'percentile(transaction.duration, 0.995)',
        'percentile(transaction.duration, 0.999)',
        'p100()',
      ];
    }

    const field = filterToField(currentFilter);

    return [
      `percentile(${field}, 0.10)`,
      `percentile(${field}, 0.25)`,
      `percentile(${field}, 0.50)`,
      `percentile(${field}, 0.75)`,
      `percentile(${field}, 0.90)`,
      `percentile(${field}, 0.95)`,
      `percentile(${field}, 0.99)`,
      `percentile(${field}, 0.995)`,
      `percentile(${field}, 0.999)`,
      `p100(${field})`,
    ];
  };

  getEndpoints = (): ReturnType<AsyncComponent['getEndpoints']> => {
    const {
      organization,
      query,
      start,
      end,
      statsPeriod,
      environment,
      project,
      location,
    } = this.props;

    const eventView = EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: this.generateFields(),
      orderby: '',
      projects: project,
      range: statsPeriod,
      query,
      environment,
      start,
      end,
    });
    const apiPayload = eventView.getEventsAPIPayload(location);
    apiPayload.referrer = 'api.performance.durationpercentilechart';

    return [
      ['chartData', `/organizations/${organization.slug}/eventsv2/`, {query: apiPayload}],
    ];
  };

  componentDidUpdate(prevProps: Props) {
    if (this.shouldRefetchData(prevProps)) {
      this.fetchData();
    }
  }

  shouldRefetchData(prevProps: Props) {
    if (this.state.loading) {
      return false;
    }
    return !isEqual(pick(prevProps, QUERY_KEYS), pick(this.props, QUERY_KEYS));
  }

  renderLoading() {
    return <LoadingPanel data-test-id="histogram-loading" />;
  }

  renderError() {
    // Don't call super as we don't really need issues for this.
    return (
      <ErrorPanel>
        <IconWarning color="gray300" size="lg" />
      </ErrorPanel>
    );
  }

  renderBody() {
    const {theme, currentFilter} = this.props;
    const {chartData} = this.state;
    if (chartData === null) {
      return null;
    }
    const xAxis = {
      type: 'category' as const,
      truncate: true,
      axisLabel: {
        showMinLabel: true,
        showMaxLabel: true,
      },
      axisTick: {
        interval: 0,
        alignWithLabel: true,
      },
    };
    const yAxis = {
      type: 'value' as const,
      axisLabel: {
        color: theme.chartLabel,
        // Use p50() to force time formatting.
        formatter: (value: number) => axisLabelFormatter(value, 'p50()'),
      },
    };
    const tooltip = {
      valueFormatter(value) {
        return getDuration(value / 1000, 2);
      },
    };

    const colors =
      currentFilter === SpanOperationBreakdownFilter.None
        ? theme.charts.getColorPalette(1)
        : [filterToColour(currentFilter)];

    return (
      <AreaChart
        grid={{left: '10px', right: '10px', top: '40px', bottom: '0px'}}
        xAxis={xAxis}
        yAxis={yAxis}
        series={transformData(chartData.data)}
        tooltip={tooltip}
        colors={[...colors]}
      />
    );
  }

  render() {
    const {currentFilter} = this.props;

    const headerTitle =
      currentFilter === SpanOperationBreakdownFilter.None
        ? t('Duration Percentiles')
        : tct('Span Operation Percentiles - [operationName]', {
            operationName: filterToString(currentFilter) as string,
          });

    return (
      <React.Fragment>
        <HeaderTitleLegend>
          {headerTitle}
          <QuestionTooltip
            position="top"
            size="sm"
            title={t(
              `Compare the duration at each percentile. Compare with Latency Histogram to see transaction volume at duration intervals.`
            )}
          />
        </HeaderTitleLegend>
        {this.renderComponent()}
      </React.Fragment>
    );
  }
}

const VALUE_EXTRACT_PATTERN = /(\d+)$/;
/**
 * Convert a discover response into a barchart compatible series
 */
function transformData(data: ApiResult[]) {
  const extractedData = Object.keys(data[0])
    .map((key: string) => {
      const nameMatch = VALUE_EXTRACT_PATTERN.exec(key);
      if (!nameMatch) {
        return [-1, -1];
      }
      let nameValue = Number(nameMatch[1]);
      if (nameValue > 100) {
        nameValue /= 10;
      }
      return [nameValue, data[0][key]];
    })
    .filter(i => i[0] > 0);

  extractedData.sort((a, b) => {
    if (a[0] > b[0]) {
      return 1;
    }
    if (a[0] < b[0]) {
      return -1;
    }
    return 0;
  });

  return [
    {
      seriesName: t('Duration'),
      data: extractedData.map(i => ({value: i[1], name: `${i[0].toLocaleString()}%`})),
    },
  ];
}

export default withTheme(DurationPercentileChart);
