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

  // Preserve real status codes from framework errors (e.g. body-parser's 413
  // "request entity too large") instead of masking them as a generic 500.
  const status = (err as any).statusCode ?? (err as any).status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    res.status(status).json({ error: (err as Error).message || "Request failed" });
    return;
  }

  console.error("[error]", err);
  res.status(500).json({ error: "Internal server error" });
}
