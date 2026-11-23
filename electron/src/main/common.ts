import { app, dialog } from "electron"
import path from "path"
import fs from "fs"
import { CONFIG_FILENAME } from "./config.js"
import { getMachineId, verifyLicenseKey, type LicenseReason } from "./license.js"

// ─── Shared file logging ────────────────────────────────────────────────────
// Packaged Windows apps have no visible console: important lifecycle events
// are appended to userData/logs/<filename> with one 1 MB rotated copy.

export interface FileLogger {
  init: () => void
  log: (line: string) => void
  getLogFile: () => string | null
}

export function createFileLogger(fileName: string): FileLogger {
  let logFile: string | null = null

  function init(): void {
    try {
      const logsDir = path.join(app.getPath("userData"), "logs")
      fs.mkdirSync(logsDir, { recursive: true })
      logFile = path.join(logsDir, fileName)
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

  return { init, log, getLogFile: () => logFile }
}

// ─── Shared paths ───────────────────────────────────────────────────────────

export function getResourcesPath(mainDir: string): string {
  if (app.isPackaged) {
    return process.resourcesPath
  }
  return path.resolve(mainDir, "..", "..", "..")
}

export function getFrontendPath(mainDir: string): string {
  return path.join(getResourcesPath(mainDir), "frontend", "dist", "index.html")
}

export function getConfigPath(): string {
  return path.join(app.getPath("userData"), CONFIG_FILENAME)
}

export function getIconPath(mainDir: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "icon.png")
  }
  return path.resolve(mainDir, "..", "..", "build", "icon.png")
}

// ─── Shared license gate ────────────────────────────────────────────────────

const LICENSE_REASON_TEXT: Record<LicenseReason, string> = {
  MISSING: "Falta la clave de activación (LICENSE_KEY).",
  MALFORMED: "La clave de activación no es válida.",
  BAD_SIGNATURE: "La clave de activación no es válida (firma incorrecta o clave de otro cliente).",
  WRONG_MACHINE: "Esta clave pertenece a otra computadora.",
  EXPIRED: "La licencia ha expirado. Solicite una renovación a su proveedor.",
}

export function enforceAppLicense(appTitle: string, licenseKey: string, log: (line: string) => void): boolean {
  const machineId = getMachineId()
  const result = verifyLicenseKey(licenseKey, machineId)
  if (result.ok) {
    log(`[license] Activated: ${result.payload.customer} (${result.payload.type})`)
    return true
  }
  log(`[license] Locked (${result.reason})${result.detail ? `: ${result.detail}` : ""}`)
  const detail = result.reason === "EXPIRED" && result.detail ? `\n${result.detail}` : ""
  dialog.showErrorBox(
    `${appTitle} — Activación requerida`,
    `${LICENSE_REASON_TEXT[result.reason]}${detail}\n\n` +
      `ID de esta máquina (envíelo a su proveedor):\n${machineId}\n\n` +
      `Coloque su clave en el archivo:\n${getConfigPath()}\n` +
      `con:  "LICENSE_KEY": "<clave proporcionada por su proveedor>"\n` +
      `y reinicie la aplicación.`
  )
  return false
}
