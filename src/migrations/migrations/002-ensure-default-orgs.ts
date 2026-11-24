import { Migration } from '../types';
import { ORG_ADMIN, buildDefaultOrg, defaultOrgName, newId } from '../../helper/user-profile';

/**
 * Every user must belong to at least one Organization and have a valid `activeOrgId`.
 * - no orgs            -> create "<firstName>'s Workspace" with the user as Org admin
 * - orgs but no active -> set activeOrgId to the first org
 */
export const ensureDefaultOrgs: Migration = {
  id: '002-ensure-default-orgs',
  description: 'Create a Default Organization for users without one and fix activeOrgId',
  async up({ db, write, log }) {
    const stats = { users: 0, orgsCreated: 0, activeOrgFixed: 0, ok: 0 };
    const users: Record<string, any> = (await db.ref('users').get()).val() ?? {};

    for (const [uid, user] of Object.entries(users)) {
      stats.users++;
      const orgIds = Object.keys(user.orgs ?? {});

      if (!orgIds.length) {
        const now = Date.now();
        const orgId = newId('org');
        const name = defaultOrgName(user.firstName || user.email?.split('@')[0] || 'User');
        const updates: Record<string, unknown> = {
          [`users/${uid}/orgs/${orgId}`]: { role: ORG_ADMIN, joinedAt: now },
          [`users/${uid}/activeOrgId`]: orgId,
        };
        for (const [path, value] of Object.entries(buildDefaultOrg(orgId, uid, name, now))) {
          updates[`orgs/${orgId}/${path}`] = value;
        }
        await write(updates);
        stats.orgsCreated++;
        log(`  + orgs/${orgId} "${name}" for users/${uid}`);
        continue;
      }

      if (!user.activeOrgId || !orgIds.includes(user.activeOrgId)) {
        await write({ [`users/${uid}/activeOrgId`]: orgIds[0] });
        stats.activeOrgFixed++;
        log(`  ~ users/${uid}/activeOrgId -> ${orgIds[0]}`);
        continue;
      }
      stats.ok++;
    }
    return stats;
  },
};
