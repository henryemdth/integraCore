import type Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { AppError } from "./authService.js";

export function userService(db: Database.Database) {
  function list(params: { page: number; limit: number; active?: string }) {
    const { page, limit, active } = params;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const sqlParams: any[] = [];

    if (active === "active") {
      conditions.push("active = 1");
    } else if (active === "inactive") {
      conditions.push("active = 0");
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRow = db.prepare(`SELECT COUNT(*) as count FROM users ${where}`)
      .get(...sqlParams) as { count: number };
    const total = countRow.count;
    const totalPages = Math.ceil(total / limit);

    const users = db.prepare(
      `SELECT id, username, full_name, role, active, created_at, updated_at FROM users ${where} ORDER BY full_name ASC LIMIT ? OFFSET ?`
    ).all(...sqlParams, limit, offset);

    return { users, total, page, totalPages };
  }

  function getById(id: number) {
    const user = db.prepare(
      "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?"
    ).get(id) as any;
    if (!user) throw new AppError(404, "User not found");
    return user;
  }

  function update(id: number, data: { full_name?: string; role?: string }, requesterId: number) {
    const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
    if (!existing) throw new AppError(404, "User not found");

    if (Number(id) === requesterId && data.role && data.role !== existing.role) {
      throw new AppError(400, "Cannot change your own role");
    }

    if (data.role && data.role !== "admin" && data.role !== "user") {
      throw new AppError(400, "Role must be 'admin' or 'user'");
    }

    db.prepare(
      `UPDATE users SET
        full_name = COALESCE(?, full_name),
        role = COALESCE(?, role),
        updated_at = datetime('now')
      WHERE id = ?`
    ).run(data.full_name ?? null, data.role ?? null, id);

    return db.prepare(
      "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?"
    ).get(id);
  }

  function deactivate(id: number, requesterId: number) {
    const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
    if (!existing) throw new AppError(404, "User not found");

    if (Number(id) === requesterId) {
      throw new AppError(400, "Cannot deactivate your own account");
    }

    if (existing.role === "admin") {
      const activeAdminCount = db.prepare(
        "SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND active = 1"
      ).get() as { count: number };
      if (activeAdminCount.count <= 1) {
        throw new AppError(400, "Cannot deactivate the last active admin");
      }
    }

    db.prepare("UPDATE users SET active = 0, updated_at = datetime('now') WHERE id = ?").run(id);

    return db.prepare(
      "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?"
    ).get(id);
  }

  function activate(id: number) {
    const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
    if (!existing) throw new AppError(404, "User not found");

    db.prepare("UPDATE users SET active = 1, updated_at = datetime('now') WHERE id = ?").run(id);

    return db.prepare(
      "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?"
    ).get(id);
  }

  function resetPassword(id: number, password: string) {
    const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
    if (!existing) throw new AppError(404, "User not found");

    const passwordHash = bcrypt.hashSync(password, 10);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
      .run(passwordHash, id);

    return { success: true };
  }

  return { list, getById, update, deactivate, activate, resetPassword };
}
