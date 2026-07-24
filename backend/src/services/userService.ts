import type { DatabaseAdapter } from "../db/adapter.js";
import bcrypt from "bcryptjs";
import { AppError } from "./authService.js";

export function userService(db: DatabaseAdapter) {
  async function list(params: { page: number; limit: number; active?: string }) {
    const { page, limit, active } = params;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const sqlParams: any[] = [];

    if (active === "active") {
      conditions.push("active = ?");
      sqlParams.push(true);
    } else if (active === "inactive") {
      conditions.push("active = ?");
      sqlParams.push(false);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRow = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM users ${where}`,
      sqlParams
    );
    const total = countRow!.count;
    const totalPages = Math.ceil(total / limit);

    const users = await db.all(
      `SELECT id, username, full_name, role, active, created_at, updated_at FROM users ${where} ORDER BY full_name ASC LIMIT ? OFFSET ?`,
      [...sqlParams, limit, offset]
    );

    return { users, total, page, totalPages };
  }

  async function getById(id: number) {
    const user = await db.get(
      "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?",
      [id]
    );
    if (!user) throw new AppError(404, "User not found");
    return user;
  }

  async function update(id: number, data: { full_name?: string; role?: string }, requesterId: number) {
    const existing = await db.get("SELECT * FROM users WHERE id = ?", [id]) as any;
    if (!existing) throw new AppError(404, "User not found");

    if (Number(id) === requesterId && data.role && data.role !== existing.role) {
      throw new AppError(400, "Cannot change your own role");
    }

    if (data.role && data.role !== "admin" && data.role !== "user") {
      throw new AppError(400, "Role must be 'admin' or 'user'");
    }

    await db.run(
      `UPDATE users SET
        full_name = COALESCE(?, full_name),
        role = COALESCE(?, role),
        updated_at = datetime('now')
      WHERE id = ?`,
      [data.full_name ?? null, data.role ?? null, id]
    );

    return await db.get(
      "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?",
      [id]
    );
  }

  async function deactivate(id: number, requesterId: number) {
    const existing = await db.get("SELECT * FROM users WHERE id = ?", [id]) as any;
    if (!existing) throw new AppError(404, "User not found");

    if (Number(id) === requesterId) {
      throw new AppError(400, "Cannot deactivate your own account");
    }

    if (existing.role === "admin") {
      const activeAdminCount = await db.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND active = ?",
        [true]
      );
      if (activeAdminCount!.count <= 1) {
        throw new AppError(400, "Cannot deactivate the last active admin");
      }
    }

    await db.run(
      "UPDATE users SET active = ?, updated_at = datetime('now') WHERE id = ?",
      [false, id]
    );

    return await db.get(
      "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?",
      [id]
    );
  }

  async function activate(id: number) {
    const existing = await db.get("SELECT id FROM users WHERE id = ?", [id]);
    if (!existing) throw new AppError(404, "User not found");

    await db.run(
      "UPDATE users SET active = ?, updated_at = datetime('now') WHERE id = ?",
      [true, id]
    );

    return await db.get(
      "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?",
      [id]
    );
  }

  async function resetPassword(id: number, password: string) {
    const existing = await db.get("SELECT id FROM users WHERE id = ?", [id]);
    if (!existing) throw new AppError(404, "User not found");

    const passwordHash = bcrypt.hashSync(password, 10);
    await db.run(
      "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
      [passwordHash, id]
    );

    return { success: true };
  }

  return { list, getById, update, deactivate, activate, resetPassword };
}
