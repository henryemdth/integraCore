import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { getDb } from "../db/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

// List all users (admin only)
router.get("/", authenticate, requireRole("admin"), (_req: Request, res: Response) => {
  const db = getDb();
  const users = db.prepare(
    "SELECT id, username, full_name, role, active, created_at, updated_at FROM users ORDER BY full_name ASC"
  ).all();
  res.json({ users });
});

// Get single user (admin only)
router.get("/:id", authenticate, requireRole("admin"), (req: Request, res: Response) => {
  const db = getDb();
  const user = db.prepare(
    "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?"
  ).get(req.params.id) as any;

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ user });
});

// Update user (admin only)
router.put("/:id", authenticate, requireRole("admin"), (req: Request, res: Response) => {
  const { id } = req.params;
  const { full_name, role } = req.body;
  const db = getDb();

  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Can't change own role
  if (Number(id) === req.user!.id && role && role !== existing.role) {
    res.status(400).json({ error: "Cannot change your own role" });
    return;
  }

  // Validate role
  if (role && role !== "admin" && role !== "user") {
    res.status(400).json({ error: "Role must be 'admin' or 'user'" });
    return;
  }

  db.prepare(
    `UPDATE users SET
      full_name = COALESCE(?, full_name),
      role = COALESCE(?, role),
      updated_at = datetime('now')
    WHERE id = ?`
  ).run(
    full_name ?? null,
    role ?? null,
    id
  );

  const user = db.prepare(
    "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?"
  ).get(id);

  res.json({ user });
});

// Deactivate user (admin only, soft delete)
router.patch("/:id/deactivate", authenticate, requireRole("admin"), (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Can't deactivate yourself
  if (Number(id) === req.user!.id) {
    res.status(400).json({ error: "Cannot deactivate your own account" });
    return;
  }

  // Can't deactivate last active admin
  if (existing.role === "admin") {
    const activeAdminCount = db.prepare(
      "SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND active = 1"
    ).get() as { count: number };
    if (activeAdminCount.count <= 1) {
      res.status(400).json({ error: "Cannot deactivate the last active admin" });
      return;
    }
  }

  db.prepare("UPDATE users SET active = 0, updated_at = datetime('now') WHERE id = ?").run(id);

  const user = db.prepare(
    "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?"
  ).get(id);

  res.json({ user });
});

// Activate user (admin only)
router.patch("/:id/activate", authenticate, requireRole("admin"), (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  db.prepare("UPDATE users SET active = 1, updated_at = datetime('now') WHERE id = ?").run(id);

  const user = db.prepare(
    "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?"
  ).get(id);

  res.json({ user });
});

// Admin reset password (admin only)
router.put("/:id/password", authenticate, requireRole("admin"), (req: Request, res: Response) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(id) as any;
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const password_hash = bcrypt.hashSync(password, 10);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(password_hash, id);

  res.json({ success: true });
});

export default router;
