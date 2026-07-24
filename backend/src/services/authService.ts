import type { DatabaseAdapter } from "../db/adapter.js";
import bcrypt from "bcryptjs";
import { signToken } from "../middleware/auth.js";

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "AppError";
  }
}

export function authService(db: DatabaseAdapter) {
  async function getSetupStatus() {
    const count = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM users");
    return count!.count === 0;
  }

  async function setup(username: string, password: string, fullName: string) {
    const count = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM users");
    if (count!.count > 0) throw new AppError(400, "Setup already completed");

    const existing = await db.get("SELECT id FROM users WHERE username = ?", [username]);
    if (existing) throw new AppError(409, "Username already exists");

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = await db.run(
      "INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, 'admin')",
      [username, passwordHash, fullName]
    );

    const user = await db.get(
      "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?",
      [result.insertId]
    );

    const token = signToken({ id: user!.id, username: user!.username, role: user!.role });
    return { token, user };
  }

  async function login(username: string, password: string) {
    const user = await db.get(
      "SELECT id, username, password_hash, full_name, role, active FROM users WHERE username = ?",
      [username]
    ) as any;
    
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

  async function register(username: string, password: string, fullName: string, role: string) {
    const userRole = role === "admin" ? "admin" : "user";

    const existing = await db.get("SELECT id FROM users WHERE username = ?", [username]);
    if (existing) throw new AppError(409, "Username already exists");

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = await db.run(
      "INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)",
      [username, passwordHash, fullName, userRole]
    );

    const user = await db.get(
      "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?",
      [result.insertId]
    );

    return { user };
  }

  async function changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await db.get("SELECT id, password_hash FROM users WHERE id = ?", [userId]) as any;
    if (!user) throw new AppError(404, "User not found");

    const valid = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!valid) throw new AppError(401, "Current password is incorrect");

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await db.run(
      "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
      [passwordHash, userId]
    );

    return { success: true };
  }

  async function getMe(userId: number) {
    const user = await db.get(
      "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?",
      [userId]
    );

    if (!user) throw new AppError(404, "User not found");
    return { user };
  }

  return { getSetupStatus, setup, login, register, changePassword, getMe };
}
