import { Migration } from './types';
import { syncAuthUsers } from './migrations/001-sync-auth-users';
import { ensureDefaultOrgs } from './migrations/002-ensure-default-orgs';
import { syncOrgMemberships } from './migrations/003-sync-org-memberships';

/** Ordered list — append new migrations at the end, never reorder or rename applied ones. */
export const MIGRATIONS: Migration[] = [syncAuthUsers, ensureDefaultOrgs, syncOrgMemberships];

/** Top-level collections from docref/02 (RTDB has no tables; nodes appear when data is written). */
export const SCHEMA_COLLECTIONS = {
  root: ['users', 'access_tokens', 'org_invites', 'orgs', 'mcpServers'],
  org: [
    'info', 'members', 'agent_accounts', 'agent_runs', 'projects', 'issues', 'issue_comments',
    'issue_attachments', 'issue_history', 'sprints', 'project_docs', 'releases', 'inbox',
  ],
};
