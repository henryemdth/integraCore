import type { DatabaseAdapter } from "../db/adapter.js";
import bcrypt from "bcryptjs";
import { AppError } from "../utils/appError.js";
import { emitUsersChanged } from "../socket/index.js";
import { fetchUserProjection } from "./userProjection.js";

export function userService(db: DatabaseAdapter) {
  async function list(params: { page: number; limit: number; active?: string; search?: string }) {
    const { page, limit, active, search } = params;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const sqlParams: any[] = [];

    if (active === "active") {
      conditions.push("active = ?");
      sqlParams.push(1);
    } else if (active === "inactive") {
      conditions.push("active = ?");
      sqlParams.push(0);
    }
    if (search) {
      conditions.push("(username LIKE ? OR full_name LIKE ?)");
      sqlParams.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRow = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM users ${where}`,
      sqlParams
    );

    const total = countRow!.count;
    const totalPages = Math.ceil(total / limit);

    const users = await db.all(
      `SELECT id, username, full_name, role, active, created_at, updated_at FROM users ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...sqlParams, limit, offset]
    );

    return { users, total, page, totalPages };
  }

  async function getById(id: number) {
    const user = await fetchUserProjection(db, id);
    if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");
    return user;
  }

  async function update(id: number, data: { full_name?: string; role?: string }, requesterId: number) {
    const existing = await db.get("SELECT * FROM users WHERE id = ?", [id]) as any;
    if (!existing) throw new AppError(404, "User not found", "USER_NOT_FOUND");

    if (Number(id) === requesterId && data.role && data.role !== existing.role) {
      throw new AppError(400, "Cannot change your own role", "CANNOT_CHANGE_OWN_ROLE");
    }

    await db.run(
      `UPDATE users SET
        full_name = COALESCE(?, full_name),
        role = COALESCE(?, role),
        updated_at = datetime('now')
      WHERE id = ?`,
      [data.full_name ?? null, data.role ?? null, id]
    );

    const user = await fetchUserProjection(db, id);
    emitUsersChanged();
    return user;
  }

  async function deactivate(id: number, requesterId: number) {
    const existing = await db.get("SELECT * FROM users WHERE id = ?", [id]) as any;
    if (!existing) throw new AppError(404, "User not found", "USER_NOT_FOUND");

    if (Number(id) === requesterId) {
      throw new AppError(400, "Cannot deactivate your own account", "CANNOT_DEACTIVATE_SELF");
    }

    if (existing.role === "admin") {
      const activeAdminCount = await db.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND active = ?",
        [1]
      );
      if (activeAdminCount!.count <= 1) {
        throw new AppError(400, "Cannot deactivate the last active admin", "LAST_ACTIVE_ADMIN");
      }
    }

    await db.run(
      "UPDATE users SET active = ?, updated_at = datetime('now') WHERE id = ?",
      [0, id]
    );

    const user = await fetchUserProjection(db, id);
    emitUsersChanged();
    return user;
  }

  async function activate(id: number) {
    const existing = await db.get("SELECT id FROM users WHERE id = ?", [id]);
    if (!existing) throw new AppError(404, "User not found", "USER_NOT_FOUND");

    await db.run(
      "UPDATE users SET active = ?, updated_at = datetime('now') WHERE id = ?",
      [1, id]
    );

    const user = await fetchUserProjection(db, id);
    emitUsersChanged();
    return user;
  }

  async function resetPassword(id: number, password: string) {
    const existing = await db.get("SELECT id FROM users WHERE id = ?", [id]);
    if (!existing) throw new AppError(404, "User not found", "USER_NOT_FOUND");

    const passwordHash = bcrypt.hashSync(password, 10);
    await db.run(
      "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
      [passwordHash, id]
    );

    return { success: true };
  }

  return { list, getById, update, deactivate, activate, resetPassword };
}
