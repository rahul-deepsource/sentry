import React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import moment from 'moment';

import AsyncComponent from 'app/components/asyncComponent';
import Card from 'app/components/card';
import ErrorPanel from 'app/components/charts/errorPanel';
import OptionSelector from 'app/components/charts/optionSelector';
import {
  ChartControls,
  HeaderTitle,
  InlineContainer,
  SectionValue,
} from 'app/components/charts/styles';
import {DateTimeObject, getInterval} from 'app/components/charts/utils';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody} from 'app/components/panels';
import QuestionTooltip from 'app/components/questionTooltip';
import TextOverflow from 'app/components/textOverflow';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {IconCalendar, IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {DataCategory, IntervalPeriod, Organization, RelativePeriod} from 'app/types';

import {getDateFromMoment} from './usageChart/utils';
import {Outcome, UsageSeries, UsageStat} from './types';
import UsageChart, {
  CHART_OPTIONS_DATA_TRANSFORM,
  CHART_OPTIONS_DATACATEGORY,
  ChartDataTransform,
  ChartStats,
} from './usageChart';
import {formatUsageWithUnits} from './utils';

type Props = {
  organization: Organization;
  dataCategory: DataCategory;
  dataCategoryName: string;
  dataDatetime: DateTimeObject;
  chartTransform?: string;
  handleChangeState: (state: {
    dataCategory?: DataCategory;
    statsPeriod?: RelativePeriod;
    chartTransform?: ChartDataTransform;
  }) => void;
} & AsyncComponent['props'];

type State = {
  orgStats: UsageSeries | undefined;
} & AsyncComponent['state'];

class UsageStatsOrganization extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    return [['orgStats', this.endpointPath, {query: this.endpointQuery}]];
  }

  get endpointPath() {
    const {organization} = this.props;
    return `/organizations/${organization.slug}/stats_v2/`;
  }

  get endpointQuery() {
    const {dataDatetime} = this.props;

    // TODO: Enable user to use dateStart/dateEnd
    return {
      statsPeriod: dataDatetime?.period || DEFAULT_STATS_PERIOD,
      interval: getInterval(dataDatetime),
      groupBy: ['category', 'outcome'],
      field: ['sum(quantity)', 'sum(times_seen)'],
    };
  }

  get chartMetadata(): {
    chartData: ChartStats;
    cardData: {
      total: string;
      accepted: string;
      dropped: string;
      filtered: string;
    };
    dataError?: Error;
    chartDateInterval: IntervalPeriod;
    chartDateStart: string;
    chartDateEnd: string;
    chartTransform: ChartDataTransform;
  } {
    const {orgStats} = this.state;

    return {
      ...this.mapSeriesToChart(orgStats),
      ...this.chartDateRange,
      ...this.chartTransform,
    };
  }

  get chartTransform(): {chartTransform: ChartDataTransform} {
    const {chartTransform} = this.props;

    switch (chartTransform) {
      case ChartDataTransform.CUMULATIVE:
      case ChartDataTransform.DAILY:
        return {chartTransform};
      default:
        return {chartTransform: ChartDataTransform.CUMULATIVE};
    }
  }

  get chartDateRange(): {
    chartDateInterval: IntervalPeriod;
    chartDateStart: string;
    chartDateEnd: string;
  } {
    const {dataDatetime} = this.props;
    const {period, start, end} = dataDatetime;
    const interval = getInterval(dataDatetime);

    let chartDateStart = moment().subtract(14, 'd');
    let chartDateEnd = moment();

    try {
      if (start && end) {
        chartDateStart = moment(start);
        chartDateEnd = moment(end);
      }

      if (period) {
        const amount = Number(period.replace(/[a-zA-Z]/g, ''));
        const unit = period.replace(/[0-9]/g, '');

        switch (unit) {
          case 'h':
          case 'd':
            break;
          default:
            throw new Error('Format for data period is not recognized');
        }

        chartDateStart = moment().subtract(amount, unit);
      }
    } catch (err) {
      // do nothing
    }

    // chartDateStart need to +1 hour to remove empty column on left of chart
    return {
      chartDateInterval: interval,
      chartDateStart: chartDateStart.add(1, 'h').startOf('h').format(),
      chartDateEnd: chartDateEnd.startOf('h').format(),
    };
  }

  handleSelectDataTransform(value: ChartDataTransform) {
    this.setState({chartDataTransform: value});
  }

  mapSeriesToChart(
    orgStats?: UsageSeries
  ): {
    chartData: ChartStats;
    cardData: {
      total: string;
      accepted: string;
      dropped: string;
      filtered: string;
    };
    dataError?: Error;
  } {
    const cardData = {
      total: '-',
      accepted: '-',
      dropped: '-',
      filtered: '-',
    };
    const chartData: ChartStats = {
      accepted: [],
      dropped: [],
      projected: [],
    };

    if (!orgStats) {
      return {cardData, chartData};
    }

    try {
      const {dataCategory} = this.props;
      const {chartDateInterval} = this.chartDateRange;

      const usageStats: UsageStat[] = orgStats.intervals.map(i => {
        const dateTime = moment(i);

        return {
          date: getDateFromMoment(dateTime, chartDateInterval),
          total: 0,
          accepted: 0,
          filtered: 0,
          dropped: {total: 0},
        };
      });

      orgStats.groups.forEach(group => {
        const {outcome, category} = group.by;
        if (category !== dataCategory) {
          return;
        }

        const stats = this.mapSeriesToStats(dataCategory, group.series);
        stats.forEach((s, i) => {
          usageStats[i][outcome] = outcome === Outcome.DROPPED ? {total: s} : s;
        });
      });

      let sumTotal = 0;
      let sumAccepted = 0;
      let sumDropped = 0;
      let sumFiltered = 0;
      usageStats.forEach(s => {
        s.total = s.accepted + s.filtered + s.dropped.total;

        // Card Data
        sumTotal += s.total;
        sumAccepted += s.accepted;
        sumDropped += s.dropped.total;
        sumFiltered += s.filtered;

        // Chart Data
        chartData.accepted.push({value: [s.date, s.accepted]} as any);
        chartData.dropped.push({value: [s.date, s.dropped.total]} as any);
      });

      const formatOptions = {
        isAbbreviated: dataCategory !== DataCategory.ATTACHMENTS,
        useUnitScaling: dataCategory === DataCategory.ATTACHMENTS,
      };

      return {
        cardData: {
          total: formatUsageWithUnits(sumTotal, dataCategory, formatOptions),
          accepted: formatUsageWithUnits(sumAccepted, dataCategory, formatOptions),
          dropped: formatUsageWithUnits(sumDropped, dataCategory, formatOptions),
          filtered: formatUsageWithUnits(sumFiltered, dataCategory, formatOptions),
        },
        chartData,
      };
    } catch (err) {
      Sentry.withScope(scope => {
        scope.setContext('query', this.endpointQuery);
        scope.setContext('body', orgStats);
        Sentry.captureException(err);
      });

      return {
        cardData,
        chartData,
        dataError: err,
      };
    }
  }

  mapSeriesToStats(dataCategory: DataCategory, series: Record<string, number[]>) {
    if (
      dataCategory === DataCategory.ATTACHMENTS ||
      dataCategory === DataCategory.TRANSACTIONS
    ) {
      return series['sum(times_seen)'];
    }

    return series['sum(quantity)'];
  }

  renderCards() {
    const {dataCategory, dataCategoryName} = this.props;
    const {total, accepted, dropped, filtered} = this.chartMetadata.cardData;

    const cardMetadata = [
      {
        title: tct('Total [dataCategory]', {dataCategory: dataCategoryName}),
        value: total,
      },
      {
        title: t('Accepted'),
        value: accepted,
      },
      {
        title: t('Filtered'),
        description: tct(
          'Filtered [dataCategory] were blocked due to your inbound data filter rules',
          {dataCategory}
        ),
        value: filtered,
      },
      // TODO(org-stats): Need a better description for dropped data
      {
        title: t('Dropped'),
        description: tct(
          'Dropped [dataCategory] were discarded due to rate-limits, quota limits, or spike protection',
          {dataCategory}
        ),
        value: dropped,
      },
    ];

    return (
      <CardWrapper>
        {cardMetadata.map((c, i) => (
          <StyledCard key={i}>
            <HeaderTitle>
              <TextOverflow>{c.title}</TextOverflow>
              {c.description && (
                <QuestionTooltip size="sm" position="top" title={c.description} />
              )}
            </HeaderTitle>
            <CardContent>
              <TextOverflow>{c.value}</TextOverflow>
            </CardContent>
          </StyledCard>
        ))}
      </CardWrapper>
    );
  }

  renderChart() {
    const {dataCategory} = this.props;
    const {error, loading, orgStats} = this.state;

    if (loading) {
      return (
        <Panel>
          <PanelBody>
            <LoadingIndicator />
          </PanelBody>
        </Panel>
      );
    }

    const {
      chartData,
      dataError,
      chartDateInterval,
      chartDateStart,
      chartDateEnd,
      chartTransform,
    } = this.chartMetadata;

    if (error || dataError || !orgStats) {
      return (
        <Panel>
          <PanelBody>
            <ErrorPanel height="256px">
              <IconWarning color="gray300" size="lg" />
            </ErrorPanel>
          </PanelBody>
        </Panel>
      );
    }

    return (
      <UsageChart
        footer={this.renderChartFooter()}
        dataCategory={dataCategory}
        dataTransform={chartTransform}
        usageDateStart={chartDateStart}
        usageDateEnd={chartDateEnd}
        usageDateInterval={chartDateInterval}
        usageStats={chartData}
      />
    );
  }

  renderChartFooter = () => {
    const {dataCategory, handleChangeState} = this.props;
    const {chartTransform} = this.chartMetadata;

    return (
      <ChartControls>
        <InlineContainer>
          <SectionValue>
            <IconCalendar />
          </SectionValue>
          <SectionValue>
            {/*
            TODO(org-stats): Add calendar dropdown for user to select date range

            {moment(usagePeriodStart).format('ll')}
            {' — '}
            {moment(usagePeriodEnd).format('ll')}
            */}
          </SectionValue>
        </InlineContainer>
        <InlineContainer>
          <OptionSelector
            title={t('Display')}
            selected={dataCategory}
            options={CHART_OPTIONS_DATACATEGORY}
            onChange={(val: string) =>
              handleChangeState({dataCategory: val as DataCategory})
            }
          />
          <OptionSelector
            title={t('Type')}
            selected={chartTransform}
            options={CHART_OPTIONS_DATA_TRANSFORM}
            onChange={(val: string) =>
              handleChangeState({chartTransform: val as ChartDataTransform})
            }
          />
        </InlineContainer>
      </ChartControls>
    );
  };

  renderComponent() {
    return (
      <React.Fragment>
        {this.renderCards()}
        {this.renderChart()}
      </React.Fragment>
    );
  }
}

export default UsageStatsOrganization;

const CardWrapper = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  grid-auto-rows: 1fr;
  grid-gap: ${space(2)};
  margin-bottom: ${space(3)};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-auto-flow: row;
  }
`;

const StyledCard = styled(Card)`
  align-items: flex-start;
  min-height: 95px;
  padding: ${space(2)} ${space(3)};
  color: ${p => p.theme.textColor};
`;

const CardContent = styled('div')`
  margin-top: ${space(1)};
  font-size: 32px;
`;
