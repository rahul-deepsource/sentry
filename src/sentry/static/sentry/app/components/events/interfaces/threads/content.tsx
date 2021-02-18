import React from 'react';
import {isEqual} from 'lodash';
import isNil from 'lodash/isNil';

import CrashContent from 'app/components/events/interfaces/crashContent';
import Pill from 'app/components/pill';
import Pills from 'app/components/pills';
import {t} from 'app/locale';
import {Project} from 'app/types';
import {Event} from 'app/types/event';
import {Thread} from 'app/types/events';
import {STACK_TYPE, STACK_VIEW} from 'app/types/stacktrace';

type CrashContentProps = React.ComponentProps<typeof CrashContent>;

type Props = {
  event: Event;
  projectId: Project['id'];
  stackType: STACK_TYPE;
  newestFirst: boolean;
  hasMissingStacktrace: boolean;
  stackView?: STACK_VIEW;
  data?: Thread;
} & Pick<CrashContentProps, 'exception' | 'stacktrace'>;

const Content = ({
  event,
  projectId,
  data,
  stackView,
  stackType,
  newestFirst,
  exception,
  stacktrace,
  hasMissingStacktrace,
}: Props) => {
  function renderContent() {
    if (hasMissingStacktrace) {
      <div className="traceback missing-traceback">
        <ul>
          <li className="frame missing-frame">
            <div className="title">
              <i>{data?.crashed ? t('Thread Errored') : t('No or unknown stacktrace')}</i>
            </div>
          </li>
        </ul>
      </div>;
    }

    if (exception) {
      const activeException = exception.values?.find(
        value =>
          isEqual(value.stacktrace, data?.stacktrace) &&
          isEqual(value.rawStacktrace, data?.rawStacktrace)
      );

      return (
        <CrashContent
          event={event}
          stackType={stackType}
          stackView={stackView}
          newestFirst={newestFirst}
          projectId={projectId}
          exception={
            activeException ? {...exception, values: [activeException]} : exception
          }
          stacktrace={stacktrace}
        />
      );
    }

    return (
      <CrashContent
        event={event}
        stackType={stackType}
        stackView={stackView}
        newestFirst={newestFirst}
        projectId={projectId}
        exception={exception}
        stacktrace={stacktrace}
      />
    );
  }

  return (
    <div className="thread">
      {data && (!isNil(data?.id) || !!data?.name) && (
        <Pills>
          {!isNil(data.id) && <Pill name={t('id')} value={String(data.id)} />}
          {!!data.name?.trim() && <Pill name={t('name')} value={data.name} />}
          <Pill name={t('was active')} value={data.current} />
          <Pill name={t('errored')} className={data.crashed ? 'false' : 'true'}>
            {data.crashed ? t('yes') : t('no')}
          </Pill>
        </Pills>
      )}
      {renderContent()}
    </div>
  );
};

export default Content;
