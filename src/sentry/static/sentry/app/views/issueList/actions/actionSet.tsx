import React from 'react';
import styled from '@emotion/styled';

import ActionLink from 'app/components/actions/actionLink';
import ActionButton from 'app/components/actions/button';
import IgnoreActions from 'app/components/actions/ignore';
import MenuItemActionLink from 'app/components/actions/menuItemActionLink';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import DropdownLink from 'app/components/dropdownLink';
import Tooltip from 'app/components/tooltip';
import {IconEllipsis, IconPause, IconPlay} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project, ResolutionStatus} from 'app/types';
import Projects from 'app/utils/projects';

import ResolveActions from './resolveActions';
import ReviewAction from './reviewAction';
import {ConfirmAction, getConfirm, getLabel} from './utils';

type Props = {
  orgSlug: Organization['slug'];
  queryCount: number;
  query: string;
  realtimeActive: boolean;
  allInQuerySelected: boolean;
  anySelected: boolean;
  multiSelected: boolean;
  issues: Set<string>;
  onShouldConfirm: (action: ConfirmAction) => boolean;
  onDelete: () => void;
  onRealtimeChange: () => void;
  onMerge: () => void;
  onUpdate: (data?: any) => void;
  selectedProjectSlug?: string;
  hasInbox?: boolean;
};

function ActionSet({
  orgSlug,
  queryCount,
  query,
  realtimeActive,
  allInQuerySelected,
  anySelected,
  multiSelected,
  issues,
  onUpdate,
  onShouldConfirm,
  onDelete,
  onRealtimeChange,
  onMerge,
  selectedProjectSlug,
  hasInbox,
}: Props) {
  const numIssues = issues.size;
  const confirm = getConfirm(numIssues, allInQuerySelected, query, queryCount);
  const label = getLabel(numIssues, allInQuerySelected);

  // merges require a single project to be active in an org context
  // selectedProjectSlug is null when 0 or >1 projects are selected.
  const mergeDisabled = !(multiSelected && selectedProjectSlug);

  return (
    <Wrapper hasInbox={hasInbox}>
      {selectedProjectSlug ? (
        <Projects orgId={orgSlug} slugs={[selectedProjectSlug]}>
          {({projects, initiallyLoaded, fetchError}) => {
            const selectedProject = projects[0];
            return (
              <ResolveActions
                onShouldConfirm={onShouldConfirm}
                onUpdate={onUpdate}
                anySelected={anySelected}
                orgSlug={orgSlug}
                params={{
                  hasReleases: selectedProject.hasOwnProperty('features')
                    ? (selectedProject as Project).features.includes('releases')
                    : false,
                  latestRelease: selectedProject.hasOwnProperty('latestRelease')
                    ? (selectedProject as Project).latestRelease
                    : undefined,
                  projectId: selectedProject.slug,
                  confirm,
                  label,
                  loadingProjects: !initiallyLoaded,
                  projectFetchError: !!fetchError,
                }}
              />
            );
          }}
        </Projects>
      ) : (
        <ResolveActions
          onShouldConfirm={onShouldConfirm}
          onUpdate={onUpdate}
          anySelected={anySelected}
          orgSlug={orgSlug}
          params={{
            hasReleases: false,
            latestRelease: null,
            projectId: null,
            confirm,
            label,
          }}
        />
      )}

      <GuideAnchor target="inbox_guide_ignore" position="bottom">
        <IgnoreActions
          onUpdate={onUpdate}
          shouldConfirm={onShouldConfirm(ConfirmAction.IGNORE)}
          confirmMessage={confirm(ConfirmAction.IGNORE, true)}
          confirmLabel={label('ignore')}
          disabled={!anySelected}
        />
      </GuideAnchor>

      {hasInbox && (
        <GuideAnchor target="inbox_guide_review" position="bottom">
          <div className="hidden-sm hidden-xs">
            <ReviewAction disabled={!anySelected} onUpdate={onUpdate} />
          </div>
        </GuideAnchor>
      )}

      <div className="hidden-md hidden-sm hidden-xs">
        <ActionLink
          type="button"
          disabled={mergeDisabled}
          onAction={onMerge}
          shouldConfirm={onShouldConfirm(ConfirmAction.MERGE)}
          message={confirm(ConfirmAction.MERGE, false)}
          confirmLabel={label('merge')}
          title={t('Merge Selected Issues')}
        >
          {t('Merge')}
        </ActionLink>
      </div>

      <DropdownLink
        key="actions"
        customTitle={
          <ActionButton
            label={t('Open more issue actions')}
            icon={<IconEllipsis size="xs" />}
          />
        }
      >
        <MenuItemActionLink
          className="hidden-lg hidden-xl"
          disabled={mergeDisabled}
          onAction={onMerge}
          shouldConfirm={onShouldConfirm(ConfirmAction.MERGE)}
          message={confirm(ConfirmAction.MERGE, false)}
          confirmLabel={label('merge')}
          title={t('Merge Selected Issues')}
        >
          {t('Merge')}
        </MenuItemActionLink>
        {hasInbox && (
          <MenuItemActionLink
            className="hidden-md hidden-lg hidden-xl"
            disabled={!anySelected}
            onAction={() => onUpdate({inbox: false})}
            title={t('Mark Reviewed')}
          >
            {t('Mark Reviewed')}
          </MenuItemActionLink>
        )}
        <MenuItemActionLink
          disabled={!anySelected}
          onAction={() => onUpdate({isBookmarked: true})}
          shouldConfirm={onShouldConfirm(ConfirmAction.BOOKMARK)}
          message={confirm(ConfirmAction.BOOKMARK, false)}
          confirmLabel={label('bookmark')}
          title={t('Add to Bookmarks')}
        >
          {t('Add to Bookmarks')}
        </MenuItemActionLink>
        <MenuItemActionLink
          disabled={!anySelected}
          onAction={() => onUpdate({isBookmarked: false})}
          shouldConfirm={onShouldConfirm(ConfirmAction.UNBOOKMARK)}
          message={confirm('remove', false, ' from your bookmarks')}
          confirmLabel={label('remove', ' from your bookmarks')}
          title={t('Remove from Bookmarks')}
        >
          {t('Remove from Bookmarks')}
        </MenuItemActionLink>

        <MenuItemActionLink
          disabled={!anySelected}
          onAction={() => onUpdate({status: ResolutionStatus.UNRESOLVED})}
          shouldConfirm={onShouldConfirm(ConfirmAction.UNRESOLVE)}
          message={confirm(ConfirmAction.UNRESOLVE, true)}
          confirmLabel={label('unresolve')}
          title={t('Set status to: Unresolved')}
        >
          {t('Set status to: Unresolved')}
        </MenuItemActionLink>
        <MenuItemActionLink
          disabled={!anySelected}
          onAction={onDelete}
          shouldConfirm={onShouldConfirm(ConfirmAction.DELETE)}
          message={confirm(ConfirmAction.DELETE, false)}
          confirmLabel={label('delete')}
          title={t('Delete Issues')}
        >
          {t('Delete Issues')}
        </MenuItemActionLink>
      </DropdownLink>
      {!hasInbox && (
        <Tooltip
          title={t('%s real-time updates', realtimeActive ? t('Pause') : t('Enable'))}
        >
          <ActionButton
            onClick={onRealtimeChange}
            label={
              realtimeActive
                ? t('Pause real-time updates')
                : t('Enable real-time updates')
            }
            icon={realtimeActive ? <IconPause size="xs" /> : <IconPlay size="xs" />}
          />
        </Tooltip>
      )}
    </Wrapper>
  );
}

export default ActionSet;

const Wrapper = styled('div')<{hasInbox?: boolean}>`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    width: 66.66%;
  }
  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    width: 50%;
  }
  flex: 1;
  margin: 0 ${space(1)};
  display: grid;
  gap: ${space(0.5)};
  grid-auto-flow: column;
  justify-content: flex-start;
  white-space: nowrap;
`;
