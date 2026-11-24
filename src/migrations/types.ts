import type { Auth } from 'firebase-admin/auth';
import type { Database } from 'firebase-admin/database';

export interface MigrationContext {
  db: Database;
  auth: Auth;
  dryRun: boolean;
  log: (msg: string) => void;
  /** Applies a multi-path update at the DB root (no-op in dry-run). */
  write: (updates: Record<string, unknown>) => Promise<void>;
}

export interface Migration {
  /** Ordered, never renamed once applied, e.g. "001-sync-auth-users". */
  id: string;
  description: string;
  up(ctx: MigrationContext): Promise<Record<string, number | string>>;
}
