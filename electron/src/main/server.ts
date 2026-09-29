import { app, BrowserWindow, dialog } from "electron"
import path from "path"
import fs from "fs"
import { fork, ChildProcess } from "child_process"
import { CONFIG_FILENAME, ensureConfigFile, pickAllowedEnv, readJsonConfig, type ServerEnvKey } from "./config.js"

const DEFAULT_BACKEND_PORT = "3001"
const MAX_START_ATTEMPTS = 3
const MAX_CRASH_RESTARTS = 5

// Documented defaults written to config.json on first run so the admin
// always has a file to edit. Keys not in SERVER_ENV_ALLOWLIST are ignored.
const DEFAULT_SERVER_CONFIG = {
  _comments: [
    "integraCore Server runtime configuration. Keys are backend environment variables;",
    "unknown keys are ignored. Restart the app after editing for changes to apply.",
    "Cloud deployments do not use this file (they read a standard .env).",
    "Recognized keys: PORT, CORS_ORIGIN, DB_DRIVER, DB_PATH, DATA_DIR, JWT_SECRET,",
    "PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD, PG_SSL,",
    "PG_SSL_REJECT_UNAUTHORIZED, RATE_LIMIT_WINDOW_MINUTES, RATE_LIMIT_MAX.",
  ],
  PORT: DEFAULT_BACKEND_PORT,
  CORS_ORIGIN: "*",
}

let mainWindow: BrowserWindow | null = null
let backendProcess: ChildProcess | null = null
let stopping = false
let crashRestarts = 0

// Set by loadDesktopConfig() during startup, before the backend is forked.
let backendPort = DEFAULT_BACKEND_PORT
let configEnv: Partial<Record<ServerEnvKey, string>> = {}

// ---- file logging ---------------------------------------------------------
// Packaged Windows apps have no visible console: everything important is also
// appended to userData/logs/server-main.log so failures are diagnosable.

let logFile: string | null = null

function initLogging(): void {
  try {
    const logsDir = path.join(app.getPath("userData"), "logs")
    fs.mkdirSync(logsDir, { recursive: true })
    logFile = path.join(logsDir, "server-main.log")
    // Keep one rotated copy when the log grows past 1 MB.
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 1024 * 1024) {
      fs.renameSync(logFile, logFile.replace(/\.log$/, ".old.log"))
    }
  } catch {
    logFile = null // logging is best-effort; never block startup on it
  }
}

function log(line: string): void {
  console.log(line)
  if (!logFile) return
  try {
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`)
  } catch { /* best-effort */ }
}

// ---- paths ----------------------------------------------------------------

function getResourcesPath(): string {
  if (app.isPackaged) {
    return process.resourcesPath
  }
  return path.resolve(__dirname, "..", "..", "..")
}

function getFrontendPath(): string {
  return path.join(getResourcesPath(), "frontend", "dist", "index.html")
}

function getFrontendUrl(): string {
  return process.env.DEV_FRONTEND_URL || "http://localhost:5173"
}

function getBackendEntry(): string {
  return path.join(getResourcesPath(), "backend", "dist", "index.cjs")
}

function getDataDir(): string {
  return path.join(app.getPath("userData"), "data")
}

// ---- desktop config.json ---------------------------------------------------

function getConfigPath(): string {
  return path.join(app.getPath("userData"), CONFIG_FILENAME)
}

// Reads (creating with defaults on first run) the admin-editable config and
// derives everything the backend fork needs from it. Runs once at startup.
function loadDesktopConfig(): void {
  const configPath = getConfigPath()
  if (ensureConfigFile(configPath, DEFAULT_SERVER_CONFIG)) {
    log(`[server] Created default config at ${configPath}`)
  }
  const { values, error } = readJsonConfig(configPath)
  if (error) log(`[server] ${error}`)
  configEnv = pickAllowedEnv(values, (key) => log(`[server] config.json: ignoring unknown key "${key}"`))
  backendPort = configEnv.PORT || DEFAULT_BACKEND_PORT
  log(`[server] Config: ${configPath} (port ${backendPort})`)
}

// ---- transient startup splash --------------------------------------------
// Shown while the backend boots so the user never sees a broken login page.

const STARTING_HTML = `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html>
<html><head><meta charset="utf-8"><title>integraCore Server</title></head>
<body style="margin:0;font-family:'Segoe UI',system-ui,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;color:#334155">
<div style="text-align:center">
<div style="width:36px;height:36px;border:4px solid #dbeafe;border-top-color:#2563eb;border-radius:50%;margin:0 auto 16px;animation:spin 1s linear infinite"></div>
<div style="font-size:15px">Starting integraCore Server&hellip;</div>
</div>
<style>@keyframes spin{to{transform:rotate(360deg)}}</style>
</body></html>`)}`

// ---- backend process ------------------------------------------------------

function forkBackend(): void {
  const backendEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: backendPort,
    DATA_DIR: getDataDir(),
    DB_DRIVER: "sqlite",
    // "*" lets the packaged frontend (loaded from file://, Origin "null")
    // reach its own local backend. Tighten via config.json for cloud/Postgres.
    CORS_ORIGIN: "*",
    NODE_ENV: "production",
    // config.json overrides the built-in defaults above (allowlisted keys
    // only) — this is the packaged app's supported configuration surface.
    ...configEnv,
  }
  // When set, honor an explicit JWT_SECRET; otherwise the backend generates
  // and persists a per-install secret under DATA_DIR/.jwt-secret. Never pass a
  // shared hardcoded fallback.
  if (process.env.JWT_SECRET) backendEnv.JWT_SECRET = process.env.JWT_SECRET

  backendProcess = fork(getBackendEntry(), [], {
    env: backendEnv,
    stdio: ["pipe", "pipe", "pipe", "ipc"],
  })

  backendProcess.stdout?.on("data", (data: Buffer) => log(`[backend] ${data.toString().trim()}`))
  backendProcess.stderr?.on("data", (data: Buffer) => log(`[backend] ${data.toString().trim()}`))

  backendProcess.on("error", (err) => {
    log(`[backend] Failed to start: ${err.message}`)
    backendProcess = null
  })

  backendProcess.on("exit", (code) => {
    log(`[backend] Exited with code ${code}`)
    backendProcess = null
  })
}

function startBackend(): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false

    forkBackend()
    if (!backendProcess) {
      reject(new Error("The backend process could not be launched"))
      return
    }

    const settleResolve = () => {
      if (settled) return
      settled = true
      resolve()
    }
    const settleReject = (err: Error) => {
      if (settled) return
      settled = true
      reject(err)
    }

    // An exit before health OK fails this attempt (the retry wrapper decides
    // what to do). After health OK, an exit is a crash → crash-restart path.
    backendProcess.on("exit", (code) => {
      if (!settled) {
        settled = true
        reject(new Error(`The backend exited during startup (code ${code})`))
        return
      }
      handleBackendExit()
    })

    const maxRetries = 30
    let retries = 0

    const poll = async () => {
      if (settled) return
      try {
        const http = await import("http")
        const req = http.get(`http://localhost:${backendPort}/api/health`, (res) => {
          if (res.statusCode === 200) {
            settleResolve()
          } else {
            retry()
          }
        })
        req.on("error", () => retry())
        req.end()
      } catch {
        retry()
      }
    }

    const retry = () => {
      retries++
      if (retries >= maxRetries) {
        settleReject(new Error("Backend failed to start within timeout"))
        return
      }
      setTimeout(poll, 500)
    }

    setTimeout(poll, 1000)
  })
}

function killBackend(): void {
  if (backendProcess) {
    backendProcess.kill("SIGKILL")
    backendProcess = null
  }
}

function showFatalError(detail: string): void {
  log(`[server] FATAL: ${detail}`)
  dialog.showErrorBox(
    "integraCore Server",
    `The server could not start.\n\n${detail}\n\nPossible causes:\n` +
      `- Port ${backendPort} is already in use (another integraCore Server instance or another application).\n` +
      `- Antivirus software blocked the server.\n\n` +
      `Details were written to:\n${logFile ?? "(log file unavailable)"}`
  )
  app.quit()
}

function handleBackendExit(): void {
  crashRestarts++
  if (crashRestarts >= MAX_CRASH_RESTARTS) {
    showFatalError("The backend process keeps crashing and was restarted too many times.")
    return
  }
  const delay = Math.min(1000 * Math.pow(2, crashRestarts), 30000)
  log(`[server] Restarting backend in ${delay}ms (crash restart ${crashRestarts}/${MAX_CRASH_RESTARTS})`)
  setTimeout(async () => {
    if (stopping) return
    try {
      await startBackend()
      crashRestarts = 0
      log("[server] Backend restarted and ready")
      await mainWindow?.loadFile(getFrontendPath())
    } catch (err) {
      log(`[server] Backend restart failed: ${err instanceof Error ? err.message : err}`)
      handleBackendExit()
    }
  }, delay)
}

async function startBackendWithRetries(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_START_ATTEMPTS; attempt++) {
    try {
      await startBackend()
      return
    } catch (err) {
      killBackend()
      const message = err instanceof Error ? err.message : String(err)
      log(`[server] Backend start attempt ${attempt}/${MAX_START_ATTEMPTS} failed: ${message}`)
      if (attempt === MAX_START_ATTEMPTS) throw err
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
    }
  }
}

function stopBackend(): void {
  stopping = true
  if (backendProcess) {
    backendProcess.kill("SIGTERM")
    setTimeout(() => {
      if (backendProcess && !backendProcess.killed) {
        backendProcess.kill("SIGKILL")
      }
    }, 5000)
  }
}

// ---- window ---------------------------------------------------------------

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "integraCore Server",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "..", "preload.js"),
      additionalArguments: ["--platform=server", `--backend-url=http://localhost:${backendPort}`],
    },
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })

  if (app.isPackaged) {
    // Transient splash; replaced by the real frontend once the backend is healthy.
    await mainWindow.loadURL(STARTING_HTML)
  } else {
    await mainWindow.loadURL(getFrontendUrl())
  }
}

// ---- app lifecycle --------------------------------------------------------

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  // A second Server launch would fight this one over port 3001 and the SQLite file.
  app.quit()
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    initLogging()
    loadDesktopConfig()

    await createWindow()
    if (!app.isPackaged) {
      log("[server] Dev mode: using external backend on http://localhost:3001")
      return
    }

    try {
      await startBackendWithRetries()
      crashRestarts = 0
      log("[server] Backend is ready — loading the app")
      await mainWindow?.loadFile(getFrontendPath())
    } catch (err) {
      killBackend()
      showFatalError(err instanceof Error ? err.message : String(err))
    }
  })

  app.on("window-all-closed", () => {
    stopBackend()
    app.quit()
  })

  app.on("before-quit", () => {
    stopBackend()
  })
}
