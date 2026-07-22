import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { getDb } from "../db/index.js";
import { authenticate, requireRole, signToken } from "../middleware/auth.js";

const router = Router();

router.get("/setup-status", (_req: Request, res: Response) => {
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  res.json({ needsSetup: count.count === 0 });
});

router.post("/setup", (req: Request, res: Response) => {
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };

  if (count.count > 0) {
    res.status(400).json({ error: "Setup already completed" });
    return;
  }

  const { username, password, full_name } = req.body;

  if (!username || !password || !full_name) {
    res.status(400).json({ error: "Username, password, and full_name are required" });
    return;
  }

  if (username.length < 3) {
    res.status(400).json({ error: "Username must be at least 3 characters" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    res.status(409).json({ error: "Username already exists" });
    return;
  }

  const password_hash = bcrypt.hashSync(password, 10);

  const result = db.prepare(
    "INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, 'admin')"
  ).run(username, password_hash, full_name);

  const user = db.prepare("SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?")
    .get(result.lastInsertRowid) as any;

  const token = signToken({ id: user.id, username: user.username, role: user.role });

  res.status(201).json({ token, user });
});

router.post("/login", (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const db = getDb();
  const user = db.prepare(
    "SELECT id, username, password_hash, full_name, role, active FROM users WHERE username = ?"
  ).get(username) as any;

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (!user.active) {
    res.status(403).json({ error: "Account is deactivated" });
    return;
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({ id: user.id, username: user.username, role: user.role });

  res.json({
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
  });
});

router.post("/register", authenticate, requireRole("admin"), (req: Request, res: Response) => {
  const { username, password, full_name, role } = req.body;

  if (!username || !password || !full_name) {
    res.status(400).json({ error: "Username, password, and full_name are required" });
    return;
  }

  if (username.length < 3) {
    res.status(400).json({ error: "Username must be at least 3 characters" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const userRole = role === "admin" ? "admin" : "user";

  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    res.status(409).json({ error: "Username already exists" });
    return;
  }

  const password_hash = bcrypt.hashSync(password, 10);

  const result = db.prepare(
    "INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)"
  ).run(username, password_hash, full_name, userRole);

  const user = db.prepare("SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?")
    .get(result.lastInsertRowid) as any;

  res.status(201).json({ user });
});

// Self-service password change (any authenticated user)
router.put("/password", authenticate, (req: Request, res: Response) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    res.status(400).json({ error: "Current password and new password are required" });
    return;
  }

  if (new_password.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }

  const db = getDb();
  const user = db.prepare("SELECT id, password_hash FROM users WHERE id = ?").get(req.user!.id) as any;

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = bcrypt.compareSync(current_password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const password_hash = bcrypt.hashSync(new_password, 10);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(password_hash, req.user!.id);

  res.json({ success: true });
});

router.get("/me", authenticate, (req: Request, res: Response) => {
  const db = getDb();
  const user = db.prepare(
    "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?"
  ).get(req.user!.id) as any;

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ user });
});

export default router;
