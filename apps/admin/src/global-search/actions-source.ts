import { useMemo } from 'react';
import { useCurrentUser } from '@tryghost/admin-x-framework/api/current-user';
import { getSettingValue, useBrowseSettings } from '@tryghost/admin-x-framework/api/settings';
import {
  type User,
  canAccessSettings,
  canManageAutomations,
  canManageMembers,
  canManageTags,
  hasAdminAccess,
} from '@tryghost/admin-x-framework/api/users';
import { useFeatureFlag } from '@tryghost/admin-x-framework/hooks';
import { canSeeApps } from '@/apps/permissions';
import type { ThemeMode } from '@/hooks/use-theme';
import { useThemeContext } from '@/providers/theme-context';
import { CUSTOMIZE_SITE_PATH, VIEW_SITE_PATH, useCanCustomizeSite } from '@/view-site/api';
import type { SearchItem, SearchSource } from './search-source';

export const ACTIONS_HEADING = 'Actions';

interface NavigationItemOptions {
  appsEnabled: boolean;
  automationsEnabled: boolean;
  canCustomizeSite: boolean;
  commentsEnabled: boolean;
  networkEnabled: boolean;
}

const navigate = (
  id: string,
  title: string,
  to: string,
  keywords: string,
  isFeatured = false,
): SearchItem => ({
  kind: 'navigate',
  id,
  title,
  to,
  keywords,
  isFeatured,
});

/** Global creation and navigation commands, filtered like the matching Admin controls. */
export function navigationItems(
  user: User | undefined,
  {
    appsEnabled,
    automationsEnabled,
    canCustomizeSite,
    commentsEnabled,
    networkEnabled,
  }: NavigationItemOptions,
): SearchItem[] {
  const items = [
    navigate('new-post', 'New post', '/editor/post', 'create write draft article', true),
    navigate('new-page', 'New page', '/editor/page', 'create write draft', true),
  ];

  if (user && canManageMembers(user)) {
    items.push(
      navigate('new-member', 'New member', '/members/new', 'create add subscriber', true),
      navigate('import-members', 'Import members', '/members/import', 'upload csv subscribers'),
    );
  }

  if (user && canManageTags(user)) {
    items.push(navigate('new-tag', 'New tag', '/tags/new', 'create add label taxonomy', true));
  }

  items.push(navigate('view-site', 'View site', VIEW_SITE_PATH, 'open publication website', true));

  if (canCustomizeSite) {
    items.push(
      navigate(
        'customize-site',
        'Customize site',
        CUSTOMIZE_SITE_PATH,
        'design branding theme',
        true,
      ),
    );
  }

  items.push(
    navigate('my-profile', 'Your profile', '/my-profile', 'account user personal', true),
    navigate('posts', 'Go to posts', '/posts', 'content articles drafts scheduled published'),
    navigate('pages', 'Go to pages', '/pages', 'content static'),
  );

  if (!user) {
    return items;
  }

  if (canManageTags(user)) {
    items.push(navigate('tags', 'Go to tags', '/tags', 'content labels taxonomy'));
  }

  if (canManageMembers(user)) {
    items.push(navigate('members', 'Go to members', '/members', 'audience subscribers people'));
    if (commentsEnabled) {
      items.push(
        navigate('comments', 'Go to comments', '/comments', 'audience discussion replies'),
      );
    }
  }

  if (canManageAutomations(user) && automationsEnabled) {
    items.push(navigate('automations', 'Go to automations', '/automations', 'workflows email'));
  }

  if (hasAdminAccess(user)) {
    items.push(
      navigate('analytics', 'Go to analytics', '/analytics', 'stats insights performance'),
    );
    if (networkEnabled) {
      items.push(navigate('network', 'Go to network', '/network', 'social activitypub'));
    }
  }

  if (canSeeApps(user, appsEnabled)) {
    items.push(navigate('apps', 'Go to apps', '/apps', 'integrations extensions'));
  }

  if (canAccessSettings(user)) {
    items.push(navigate('settings', 'Go to settings', '/settings', 'preferences configuration'));
  }

  return items;
}

/** Explicit appearance choices, including the system preference. */
export function appearanceItems(setTheme: (mode: ThemeMode) => Promise<void>): SearchItem[] {
  const appearance = (mode: ThemeMode, title: string, keywords: string): SearchItem => ({
    kind: 'action',
    id: `appearance-${mode}`,
    title,
    keywords: `appearance theme mode switch toggle ${keywords}`,
    run: () => setTheme(mode),
  });

  return [
    appearance('light', 'Use light appearance', 'light day'),
    appearance('dark', 'Use dark appearance', 'dark night'),
    appearance('system', 'Use system appearance', 'system automatic auto'),
  ];
}

/** Global commands available from Cmd-K. */
export function useActionsSearchSource(): SearchSource {
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();
  const { data: settings, isLoading: isSettingsLoading } = useBrowseSettings();
  const appsEnabled = useFeatureFlag('apps');
  const automationsEnabled = useFeatureFlag('automations');
  const canCustomizeSite = useCanCustomizeSite();
  const { isThemeReady, setTheme } = useThemeContext();
  const commentsEnabled = getSettingValue<string>(settings?.settings, 'comments_enabled') !== 'off';
  const networkEnabled =
    getSettingValue<boolean>(settings?.settings, 'social_web_enabled') ?? false;

  return useMemo(
    () => ({
      id: 'actions',
      heading: ACTIONS_HEADING,
      items: [
        ...navigationItems(currentUser, {
          appsEnabled,
          automationsEnabled,
          canCustomizeSite,
          commentsEnabled,
          networkEnabled,
        }),
        ...(isThemeReady ? appearanceItems(setTheme) : []),
      ],
      isLoading: isUserLoading || isSettingsLoading,
    }),
    [
      appsEnabled,
      automationsEnabled,
      canCustomizeSite,
      commentsEnabled,
      currentUser,
      isSettingsLoading,
      isThemeReady,
      isUserLoading,
      networkEnabled,
      setTheme,
    ],
  );
}
