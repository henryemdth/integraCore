import type { DatabaseAdapter } from "../db/adapter.js";
import type { UserProjectionRow } from "../types/models.js";

// The shared user row shape every service returns after a read or mutation
// (no password hash). Kept in its own dependency-free module so the auth
// middleware and the socket handshake can reuse it without importing
// userService (which pulls in the socket emitters and would create an import
// cycle).
export function fetchUserProjection(db: DatabaseAdapter, id: number): Promise<UserProjectionRow | undefined> {
  return db.get<UserProjectionRow>(
    "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?",
    [id]
  );
}
