import { Migration } from '../types';

/**
 * Keeps `/users/{uid}/orgs/{orgId}` and `/orgs/{orgId}/members/{uid}` in sync.
 * Missing member rows are created from the user's membership; dangling references
 * (org deleted) are reported only — never deleted automatically.
 */
export const syncOrgMemberships: Migration = {
  id: '003-sync-org-memberships',
  description: 'Reconcile users/{uid}/orgs with orgs/{orgId}/members',
  async up({ db, write, log }) {
    const stats = { memberships: 0, membersCreated: 0, userLinksCreated: 0, danglingOrgs: 0, ok: 0 };
    const users: Record<string, any> = (await db.ref('users').get()).val() ?? {};
    const orgIds = new Set<string>();

    for (const [uid, user] of Object.entries(users)) {
      for (const [orgId, m] of Object.entries<any>(user.orgs ?? {})) {
        stats.memberships++;
        orgIds.add(orgId);
        const [info, member] = await Promise.all([
          db.ref(`orgs/${orgId}/info`).get(),
          db.ref(`orgs/${orgId}/members/${uid}`).get(),
        ]);
        if (!info.exists()) {
          stats.danglingOrgs++;
          log(`  ! users/${uid}/orgs/${orgId} points to a missing org (left untouched)`);
          continue;
        }
        if (!member.exists()) {
          await write({
            [`orgs/${orgId}/members/${uid}`]: {
              userId: uid, role: m?.role ?? 'Member', defaultLane: 'Developer', status: 'active',
              joinedAt: m?.joinedAt ?? Date.now(),
            },
          });
          stats.membersCreated++;
          log(`  + orgs/${orgId}/members/${uid}`);
          continue;
        }
        stats.ok++;
      }
    }

    // Reverse direction: members whose user profile lacks the org link.
    for (const orgId of orgIds) {
      const members: Record<string, any> = (await db.ref(`orgs/${orgId}/members`).get()).val() ?? {};
      for (const [uid, member] of Object.entries(members)) {
        if (users[uid] && !users[uid].orgs?.[orgId]) {
          await write({ [`users/${uid}/orgs/${orgId}`]: { role: member.role, joinedAt: member.joinedAt ?? Date.now() } });
          stats.userLinksCreated++;
          log(`  + users/${uid}/orgs/${orgId}`);
        }
      }
    }
    return stats;
  },
};
