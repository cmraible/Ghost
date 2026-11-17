import { describe, expect, it, vi } from 'vitest';
import type { User } from '@tryghost/admin-x-framework/api/users';
import { appearanceItems, navigationItems } from './actions-source';

const user = (role: string) => ({ roles: [{ name: role }] }) as User;

const navigationOptions = {
  appsEnabled: false,
  automationsEnabled: false,
  canCustomizeSite: false,
  commentsEnabled: false,
  networkEnabled: false,
};

const titles = (role?: string, overrides = {}) =>
  navigationItems(role ? user(role) : undefined, { ...navigationOptions, ...overrides }).map(
    (item) => item.title,
  );

describe('appearanceItems', () => {
  it.each([
    ['Use light appearance', 'light'],
    ['Use dark appearance', 'dark'],
    ['Use system appearance', 'system'],
  ] as const)('offers %j', async (title, mode) => {
    const setTheme = vi.fn(() => Promise.resolve());
    const item = appearanceItems(setTheme).find((candidate) => candidate.title === title);

    expect(item).toMatchObject({ kind: 'action', title });
    expect(item?.keywords).toContain('appearance');
    if (item?.kind === 'action') {
      await item.run();
    }
    expect(setTheme).toHaveBeenCalledWith(mode);
  });
});

describe('navigationItems', () => {
  it('offers universal creation, site and navigation commands while the user loads', () => {
    expect(titles()).toEqual([
      'New post',
      'New page',
      'View site',
      'Your profile',
      'Go to posts',
      'Go to pages',
    ]);
  });

  it("matches an owner's commands to enabled Admin features", () => {
    expect(
      titles('Owner', {
        appsEnabled: true,
        automationsEnabled: true,
        canCustomizeSite: true,
        commentsEnabled: true,
        networkEnabled: true,
      }),
    ).toEqual([
      'New post',
      'New page',
      'New member',
      'Import members',
      'New tag',
      'View site',
      'Customize site',
      'Your profile',
      'Go to posts',
      'Go to pages',
      'Go to tags',
      'Go to members',
      'Go to comments',
      'Go to automations',
      'Go to analytics',
      'Go to network',
      'Go to apps',
      'Go to settings',
    ]);
  });

  it('does not expose privileged commands to a contributor', () => {
    expect(titles('Contributor')).toEqual(titles());
  });

  it('marks only the suggested empty-state commands as featured', () => {
    const items = navigationItems(user('Owner'), navigationOptions);

    expect(items.filter((item) => item.isFeatured).map((item) => item.title)).toEqual([
      'New post',
      'New page',
      'New member',
      'New tag',
      'View site',
      'Your profile',
    ]);
  });
});
