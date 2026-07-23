import { Request, Response, NextFunction } from "express";
import { AppError } from "../services/authService.js";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if ("issues" in err && Array.isArray((err as any).issues)) {
    const messages = (err as any).issues.map((i: any) => `${i.path?.join(".")}: ${i.message}`);
    res.status(400).json({ error: "Validation failed", details: messages });
    return;
  }

  console.error("[error]", err);
  res.status(500).json({ error: "Internal server error" });
}
