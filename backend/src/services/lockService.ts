// Single-process write lock (SQLite era): held only while a backup/restore
// swap is in flight. A timestamp bounds the damage of a crashed holder — a
// lock older than LOCK_TIMEOUT_MS is treated as stale and expired on the
// next check instead of blocking writes forever. The cloud/Postgres
// deployment will need a shared lock (pg_advisory_lock or a locks table).
const LOCK_TIMEOUT_MS = 30_000;

let locked = false;
let lockedAt = 0;

export function isWriteLocked(): boolean {
  if (locked && Date.now() - lockedAt >= LOCK_TIMEOUT_MS) {
    locked = false;
    lockedAt = 0;
  }
  return locked;
}

// Returns false when the lock is already held (e.g. a concurrent restore) so
// callers can reject instead of silently overwriting the held state.
export function acquireWriteLock(): boolean {
  if (isWriteLocked()) return false;
  locked = true;
  lockedAt = Date.now();
  return true;
}

export function releaseWriteLock(): void {
  locked = false;
  lockedAt = 0;
}
