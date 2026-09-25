import { AppError } from "./appError.js";

/** Parses a route id param, rejecting NaN / non-positive values with a 400. */
export function parseId(raw: string): number {
  const id = Number(raw);
  if (isNaN(id) || id <= 0) throw new AppError(400, "Invalid ID parameter", "INVALID_ID");
  return id;
}
