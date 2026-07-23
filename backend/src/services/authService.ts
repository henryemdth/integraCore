import type Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { signToken } from "../middleware/auth.js";

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "AppError";
  }
}

export function authService(db: Database.Database) {
  function getSetupStatus() {
    const count = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
    return count.count === 0;
  }

  function setup(username: string, password: string, fullName: string) {
    const count = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
    if (count.count > 0) throw new AppError(400, "Setup already completed");

    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    if (existing) throw new AppError(409, "Username already exists");

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      "INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, 'admin')"
    ).run(username, passwordHash, fullName);

    const user = db.prepare(
      "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?"
    ).get(Number(result.lastInsertRowid)) as any;

    const token = signToken({ id: user.id, username: user.username, role: user.role });
    return { token, user };
  }

  function login(username: string, password: string) {
    const user = db.prepare(
      "SELECT id, username, password_hash, full_name, role, active FROM users WHERE username = ?"
    ).get(username) as any;

    if (!user) throw new AppError(401, "Invalid credentials");
    if (!user.active) throw new AppError(403, "Account is deactivated");

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) throw new AppError(401, "Invalid credentials");

    const token = signToken({ id: user.id, username: user.username, role: user.role });
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        active: user.active,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
  }

  function register(username: string, password: string, fullName: string, role: string) {
    const userRole = role === "admin" ? "admin" : "user";

    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    if (existing) throw new AppError(409, "Username already exists");

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      "INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)"
    ).run(username, passwordHash, fullName, userRole);

    const user = db.prepare(
      "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?"
    ).get(Number(result.lastInsertRowid)) as any;

    return { user };
  }

  function changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = db.prepare("SELECT id, password_hash FROM users WHERE id = ?").get(userId) as any;
    if (!user) throw new AppError(404, "User not found");

    const valid = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!valid) throw new AppError(401, "Current password is incorrect");

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
      .run(passwordHash, userId);

    return { success: true };
  }

  function getMe(userId: number) {
    const user = db.prepare(
      "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?"
    ).get(userId) as any;

    if (!user) throw new AppError(404, "User not found");
    return { user };
  }

  return { getSetupStatus, setup, login, register, changePassword, getMe };
}
