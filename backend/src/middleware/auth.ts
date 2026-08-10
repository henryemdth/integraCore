import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { getAdapter } from "../db/index.js";

interface JwtPayload {
  id: number;
  username: string;
  role: "admin" | "user";
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

    // Re-validate the user on every request so deactivated accounts lose
    // access immediately and role changes apply without waiting for the
    // 24h token to expire.
    const db = getAdapter();
    const user = await db.get(
      "SELECT id, username, role, active FROM users WHERE id = ?",
      [decoded.id]
    ) as { id: number; username: string; role: "admin" | "user"; active: number | boolean } | undefined;

    if (!user) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    if (!user.active) {
      res.status(401).json({ error: "Account is deactivated" });
      return;
    }

    req.user = { id: user.id, username: user.username, role: user.role };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    next();
  };
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "24h" });
}
