/** Parses page/limit query params with sane bounds, shared by all list routes. */
export function parsePagination(query: Record<string, unknown>, defaultLimit: number) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || defaultLimit));
  return { page, limit };
}
