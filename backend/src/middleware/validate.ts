import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { formatZodIssues } from "../utils/zodIssues.js";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Validation failed",
        code: "VALIDATION_FAILED",
        details: formatZodIssues(result.error.issues),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
