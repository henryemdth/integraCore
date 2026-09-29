import fs from "fs"
import path from "path"

// ─── Desktop config.json ──────────────────────────────────────────────
// The packaged Windows installers have no .env: dotenv reads the install
// directory, which the CI build never populates. config.json in the app's
// userData directory is the supported runtime-config surface instead — the
// main process reads it at startup, and the Server forwards the allowlisted
// keys as environment variables to the forked backend. The backend never
// sees this file, so cloud deployments keep reading a standard .env exactly
// as before.
//
// Edits apply on the next app launch. Unknown keys are ignored: the
// allowlist below is the security boundary, since config.json must never be
// able to inject arbitrary environment (e.g. NODE_OPTIONS) into the forked
// backend process.

export const CONFIG_FILENAME = "config.json"

/** Backend env vars the Server is allowed to take from config.json. */
export const SERVER_ENV_ALLOWLIST = [
  "PORT",
  "CORS_ORIGIN",
  "DB_DRIVER",
  "DB_PATH",
  "DATA_DIR",
  "JWT_SECRET",
  "PG_HOST",
  "PG_PORT",
  "PG_DATABASE",
  "PG_USER",
  "PG_PASSWORD",
  "PG_SSL",
  "PG_SSL_REJECT_UNAUTHORIZED",
  "RATE_LIMIT_WINDOW_MINUTES",
  "RATE_LIMIT_MAX",
] as const

export type ServerEnvKey = (typeof SERVER_ENV_ALLOWLIST)[number]

export interface JsonConfigResult {
  /** String-coerced config values (documentation keys stripped), or null when the file is missing/unreadable. */
  values: Record<string, string> | null
  fileExisted: boolean
  error?: string
}

/**
 * Reads a config.json. Values are coerced to strings so JSON numbers are
 * accepted; keys starting with "_" are documentation and skipped. A
 * malformed file returns null values (callers fall back to built-in
 * defaults) and never causes the file to be rewritten.
 */
export function readJsonConfig(filePath: string): JsonConfigResult {
  if (!fs.existsSync(filePath)) {
    return { values: null, fileExisted: false }
  }
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, "utf-8"))
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { values: null, fileExisted: true, error: "config.json must contain a JSON object" }
    }
    const values: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (key.startsWith("_")) continue
      if (value === null || value === undefined) continue
      values[key] = String(value)
    }
    return { values, fileExisted: true }
  } catch (err) {
    return {
      values: null,
      fileExisted: true,
      error: `config.json could not be parsed (${err instanceof Error ? err.message : err}) — running on built-in defaults`,
    }
  }
}

/** Creates the config file with documented defaults when it does not exist. Best-effort; never overwrites. */
export function ensureConfigFile(filePath: string, defaults: Record<string, unknown>): boolean {
  if (fs.existsSync(filePath)) return false
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(defaults, null, 2))
    return true
  } catch {
    return false
  }
}

/**
 * Filters config values down to the allowlisted backend env keys. Empty
 * strings count as "not set". onIgnored reports keys that were dropped so
 * the log can tell the admin why their entry had no effect.
 */
export function pickAllowedEnv(
  values: Record<string, string> | null,
  onIgnored?: (key: string) => void
): Partial<Record<ServerEnvKey, string>> {
  const env: Partial<Record<ServerEnvKey, string>> = {}
  if (!values) return env
  for (const key of SERVER_ENV_ALLOWLIST) {
    const value = values[key]
    if (value !== undefined && value !== "") env[key] = value
  }
  if (onIgnored) {
    for (const key of Object.keys(values)) {
      if (!(SERVER_ENV_ALLOWLIST as readonly string[]).includes(key)) onIgnored(key)
    }
  }
  return env
}
