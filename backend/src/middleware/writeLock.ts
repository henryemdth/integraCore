import { Request, Response, NextFunction } from "express";
import { isWriteLocked } from "../services/lockService.js";

export function writeLockGuard(_req: Request, res: Response, next: NextFunction): void {
  if (isWriteLocked()) {
    res.status(503).json({
      error: "System is in maintenance mode (database restore in progress). Please try again in a moment.",
    });
    return;
  }
  next();
}
