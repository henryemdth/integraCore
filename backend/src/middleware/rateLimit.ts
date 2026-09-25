import rateLimit from "express-rate-limit";

// Throttles credential endpoints (login/setup) per IP. The LAN deployment has
// few machines, so the default window is generous; if the backend ever faces
// the public internet this becomes the first line of defense against
// password brute-forcing. Tunable via env for unusual deployments.
export const authRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || "15", 10) * 60_000,
  limit: parseInt(process.env.RATE_LIMIT_MAX || "20", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later", code: "RATE_LIMITED" },
});
