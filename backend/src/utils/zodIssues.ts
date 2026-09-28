/** Formats Zod issues as "path: message" strings for the VALIDATION_FAILED payload. */
export function formatZodIssues(issues: readonly { path: readonly PropertyKey[]; message: string }[]): string[] {
  return issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}
