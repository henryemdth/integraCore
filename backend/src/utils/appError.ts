export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    /** Machine-readable identifier so the frontend can show a localized message. */
    public code?: string,
    /** Interpolation values for the frontend's i18n string (e.g. available/requested stock). */
    public params?: Record<string, string | number>,
  ) {
    super(message);
    this.name = "AppError";
  }
}
