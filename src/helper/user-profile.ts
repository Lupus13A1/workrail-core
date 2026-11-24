import { randomBytes } from 'crypto';
import { buildAvatarSeed, resolveImage } from './image';

/** Shared builders for `/users/{uid}` and `/orgs/{orgId}` (see docref/02-database-rtdb-schema.md). */

export const ORG_ADMIN = 'Org admin';
export const AVATAR_COLORS = ['avatar-mint', 'avatar-sky', 'avatar-peach', 'avatar-lilac', 'avatar-lemon', 'avatar-rose'];

export interface OrgMembership {
  role: string;
  joinedAt: number;
}

export interface UserRecord {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  initials: string;
  avatarColor: string;
  photoURL: string;
  authProviders: string[];
  activeOrgId: string | null;
  orgs: Record<string, OrgMembership>;
  createdAt: number;
  lastLoginAt?: number;
}

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(10).toString('hex')}`;
}

export function hashString(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function slugify(name: string, id: string): string {
  const base = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${base || 'workspace'}-${id.slice(-6)}`;
}

/** "Thanet Chankhua" -> { firstName: "Thanet", lastName: "Chankhua" } */
export function splitName(name?: string | null): { firstName: string; lastName: string } {
  const [firstName = '', ...rest] = (name ?? '').trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}

export function buildInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || '?';
}

export interface BuildUserInput {
  uid: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  photoURL?: string | null;
  authProviders?: string[];
  orgId?: string | null;
  createdAt?: number;
  now?: number;
}

export function buildUserRecord(input: BuildUserInput): UserRecord {
  const now = input.now ?? Date.now();
  const email = input.email ?? null;
  const firstName = input.firstName?.trim() || email?.split('@')[0] || 'User';
  const lastName = input.lastName?.trim() ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  const orgId = input.orgId ?? null;
  return {
    id: input.uid,
    email,
    firstName,
    lastName,
    fullName,
    initials: buildInitials(firstName, lastName),
    avatarColor: AVATAR_COLORS[hashString(input.uid) % AVATAR_COLORS.length],
    photoURL: resolveImage(input.photoURL, buildAvatarSeed(fullName, email)),
    authProviders: input.authProviders ?? [],
    activeOrgId: orgId,
    orgs: orgId ? { [orgId]: { role: ORG_ADMIN, joinedAt: now } } : {},
    createdAt: input.createdAt ?? now,
    lastLoginAt: now,
  };
}

/** Multi-path payload for `/orgs/{orgId}` (info + owner membership). Use with `ref(\`orgs/${orgId}\`).update()`. */
export function buildDefaultOrg(orgId: string, ownerId: string, name: string, now = Date.now()) {
  return {
    info: { id: orgId, name, slug: slugify(name, orgId), ownerId, createdAt: now },
    [`members/${ownerId}`]: {
      userId: ownerId, role: ORG_ADMIN, defaultLane: 'Project admin', status: 'active', joinedAt: now,
    },
  };
}

export function defaultOrgName(firstName: string): string {
  return `${firstName}'s Workspace`;
}
