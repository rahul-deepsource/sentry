import React from 'react';
import {browserHistory} from 'react-router';
import {withTheme} from 'emotion-theming';
import {Location} from 'history';

import AsyncComponent from 'app/components/asyncComponent';
import BaseChart from 'app/components/charts/baseChart';
import {HeaderTitleLegend} from 'app/components/charts/styles';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import getDynamicText from 'app/utils/getDynamicText';
import {Theme} from 'app/utils/theme';

const ALLOWED_TIME_PERIODS = ['1h', '24h', '7d', '14d', '30d'];

type Props = AsyncComponent['props'] & {
  organization: Organization;
  location: Location;
  theme: Theme;
  onTotalValuesChange: (value: number | null) => void;
  projectId?: string;
};

type State = AsyncComponent['state'] & {
  projects: Project[] | null;
};

class ProjectErrorsBasicChart extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      projects: null,
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, projectId} = this.props;

    if (!projectId) {
      return [];
    }

    return [
      [
        'projects',
        `/organizations/${organization.slug}/projects/`,
        {
          query: {
            statsPeriod: this.getStatsPeriod(),
            query: `id:${projectId}`,
          },
        },
      ],
    ];
  }

  componentDidMount() {
    const {location} = this.props;
    if (!ALLOWED_TIME_PERIODS.includes(location.query.statsPeriod)) {
      browserHistory.replace({
        pathname: location.pathname,
        query: {
          ...location.query,
          statsPeriod: this.getStatsPeriod(),
          start: undefined,
          end: undefined,
        },
      });
    }
  }

  onLoadAllEndpointsSuccess() {
    this.props.onTotalValuesChange(
      this.state.projects?.[0]?.stats?.reduce((acc, [, value]) => acc + value, 0) ?? null
    );
  }

  getStatsPeriod() {
    const {location} = this.props;
    const statsPeriod = location.query.statsPeriod;

    if (ALLOWED_TIME_PERIODS.includes(statsPeriod)) {
      return statsPeriod;
    }

    return DEFAULT_STATS_PERIOD;
  }

  getSeries() {
    const {projects} = this.state;

    return [
      {
        cursor: 'normal' as const,
        name: t('Errors'),
        type: 'bar',
        data:
          projects?.[0]?.stats?.map(([timestamp, value]) => [timestamp * 1000, value]) ??
          [],
      },
    ];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {theme} = this.props;
    const {loading, reloading} = this.state;

    return getDynamicText({
      value: (
        <TransitionChart loading={loading} reloading={reloading}>
          <TransparentLoadingMask visible={reloading} />

          <HeaderTitleLegend>{t('Daily Errors')}</HeaderTitleLegend>

          <BaseChart
            series={this.getSeries()}
            isGroupedByDate
            showTimeInTooltip
            colors={[theme.purple300, theme.purple200]}
            grid={{left: '10px', right: '10px', top: '40px', bottom: '0px'}}
          />
        </TransitionChart>
      ),
      fixed: t('Number of Errors Chart'),
    });
  }
}

export default withTheme(ProjectErrorsBasicChart);
