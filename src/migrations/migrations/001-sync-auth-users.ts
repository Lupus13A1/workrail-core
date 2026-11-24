import type { UserRecord as AuthUserRecord } from 'firebase-admin/auth';
import { Migration } from '../types';
import { buildUserRecord, splitName } from '../../helper/user-profile';
import { isBlankImage } from '../../helper/image';

/** Fields we may backfill on an existing `/users/{uid}` without overwriting user data. */
const FILLABLE = ['id', 'email', 'firstName', 'lastName', 'fullName', 'initials', 'avatarColor', 'photoURL', 'createdAt'] as const;

const isMissing = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/**
 * Every Firebase Auth account (Email/Password + Google) gets a `/users/{uid}` record matching
 * docref/02. Existing records are only filled in (missing fields, merged authProviders); never overwritten.
 */
export const syncAuthUsers: Migration = {
  id: '001-sync-auth-users',
  description: 'Import Firebase Auth users into /users and backfill missing profile fields',
  async up({ db, auth, write, log }) {
    const stats = { authUsers: 0, created: 0, backfilled: 0, unchanged: 0, orphanProfiles: 0 };
    const authUids = new Set<string>();

    let pageToken: string | undefined;
    do {
      const page = await auth.listUsers(1000, pageToken);
      pageToken = page.pageToken;

      for (const au of page.users) {
        stats.authUsers++;
        authUids.add(au.uid);
        const snap = await db.ref(`users/${au.uid}`).get();
        const current = (snap.val() ?? null) as Record<string, any> | null;
        const updates = current ? backfill(au, current) : { [`users/${au.uid}`]: create(au) };

        if (!current) {
          stats.created++;
          log(`  + users/${au.uid} (${au.email ?? 'no email'})`);
        } else if (Object.keys(updates).length) {
          stats.backfilled++;
          log(`  ~ users/${au.uid}: ${Object.keys(updates).map((k) => k.split('/').pop()).join(', ')}`);
        } else {
          stats.unchanged++;
        }
        if (Object.keys(updates).length) await write(updates);
      }
    } while (pageToken);

    // Report (never delete) profiles that have no matching Auth account.
    const all = (await db.ref('users').get()).val() ?? {};
    for (const uid of Object.keys(all)) {
      if (!authUids.has(uid)) {
        stats.orphanProfiles++;
        log(`  ! users/${uid} has no Firebase Auth account (left untouched)`);
      }
    }
    return stats;
  },
};

function providersOf(au: AuthUserRecord): string[] {
  return au.providerData.map((p) => p.providerId);
}

function create(au: AuthUserRecord) {
  const { firstName, lastName } = splitName(au.displayName);
  const record = buildUserRecord({
    uid: au.uid,
    email: au.email,
    firstName,
    lastName,
    photoURL: au.photoURL,
    authProviders: providersOf(au),
    createdAt: Date.parse(au.metadata.creationTime) || Date.now(),
  });
  delete record.lastLoginAt;
  const lastSignIn = Date.parse(au.metadata.lastSignInTime);
  return { ...record, ...(lastSignIn ? { lastLoginAt: lastSignIn } : {}) };
}

function backfill(au: AuthUserRecord, current: Record<string, any>): Record<string, unknown> {
  // Legacy records (UsersService v1) stored `displayName` instead of first/last name.
  const legacyName = splitName(current.fullName ?? current.displayName ?? au.displayName);
  const target = buildUserRecord({
    uid: au.uid,
    email: current.email ?? au.email,
    firstName: current.firstName ?? legacyName.firstName,
    lastName: current.lastName ?? legacyName.lastName,
    photoURL: isBlankImage(current.photoURL) ? au.photoURL : current.photoURL,
    createdAt: current.createdAt ?? (Date.parse(au.metadata.creationTime) || undefined),
  });

  const updates: Record<string, unknown> = {};
  for (const key of FILLABLE) {
    if (isMissing(current[key])) updates[`users/${au.uid}/${key}`] = target[key];
  }

  const existing: string[] = Array.isArray(current.authProviders) ? current.authProviders : [];
  const merged = Array.from(new Set([...existing, ...providersOf(au)]));
  if (merged.length !== existing.length) updates[`users/${au.uid}/authProviders`] = merged;

  return updates;
}
