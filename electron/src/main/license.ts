import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import { execSync } from "node:child_process"

// ─── Offline license keys ─────────────────────────────────────────────
// Pure crypto/identity logic — no Electron imports — so it is testable with
// plain node. There is no license UI: the key is a string the admin pastes
// into config.json ("LICENSE_KEY"), and the main process verifies it at
// startup. Keys are signed with the vendor's Ed25519 private key; only the
// public key ships inside the app, so a customer who unpacks the installer
// cannot forge one. Keys may be locked to one machine (payload.machineId) —
// a copied key fails verification on any other PC.

// Vendor public key (paste output of scripts/license/generate-keys.mjs).
// Verification is impossible without it: a placeholder/empty key makes every
// license fail closed.
export const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAqg5qmwplnWBrz0ufjogk/NILZvudlIbhDC3qhnfhTk8=
-----END PUBLIC KEY-----`

export type LicenseType = "perpetual" | "temporary"

export interface LicensePayload {
  customer: string
  /** SHA-256 of the machine ID when the key is machine-locked; null = portable. */
  machineId: string | null
  type: LicenseType
  expiresAt: string | null
  issuedAt: string
}

export type LicenseReason =
  | "MISSING"
  | "MALFORMED"
  | "BAD_SIGNATURE"
  | "WRONG_MACHINE"
  | "EXPIRED"

export type LicenseResult =
  | { ok: true; payload: LicensePayload }
  | { ok: false; reason: LicenseReason; detail?: string }

const MACHINE_ID_PATTERN = /^[0-9a-f]{64}$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Stable JSON of the signed fields — the exact bytes the signature covers. */
function canonicalPayload(p: LicensePayload): string {
  return JSON.stringify({
    customer: p.customer,
    expiresAt: p.expiresAt,
    issuedAt: p.issuedAt,
    machineId: p.machineId,
    type: p.type,
  })
}

/** Builds the pasteable LICENSE_KEY value for a payload. */
export function buildLicenseKey(payload: LicensePayload, privateKeyPem: string): string {
  const payloadPart = Buffer.from(canonicalPayload(payload)).toString("base64url")
  const signature = crypto
    .sign(null, Buffer.from(canonicalPayload(payload)), privateKeyPem)
    .toString("base64url")
  return `IC1.${payloadPart}.${signature}`
}

/**
 * The machine identifier keys lock to: SHA-256 of the Windows MachineGuid
 * (survives reboots and app reinstalls; changes only if Windows is
 * reinstalled/regenerated). /etc/machine-id keeps local Linux testing
 * honest; a hostname hash is the last-resort fallback so the locked dialog
 * always has something deterministic to show.
 */
export function getMachineId(): string {
  let raw = ""
  try {
    if (process.platform === "win32") {
      const out = execSync(
        "reg query HKLM\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid",
        { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }
      )
      raw = out.split("\n").find((l) => l.includes("MachineGuid"))?.split(/\s+/).pop() ?? ""
    } else if (fs.existsSync("/etc/machine-id")) {
      raw = fs.readFileSync("/etc/machine-id", "utf-8").trim()
    }
  } catch {
    raw = ""
  }
  if (!raw) raw = `fallback:${process.platform}:${os.hostname()}`
  return crypto.createHash("sha256").update(raw.trim()).digest("hex")
}

/**
 * Verifies a LICENSE_KEY config value against this machine. Fail-closed
 * order: presence → structure → signature → machine → expiry. `now` is
 * injectable for testing; temporary keys expire at the END of their
 * expiresAt date (inclusive).
 */
export function verifyLicenseKey(
  key: string | undefined | null,
  expectedMachineId: string,
  now: Date = new Date()
): LicenseResult {
  if (!key || !key.trim()) {
    return { ok: false, reason: "MISSING", detail: "no LICENSE_KEY in config.json" }
  }

  const parts = key.trim().split(".")
  if (parts.length !== 3 || parts[0] !== "IC1") {
    return { ok: false, reason: "MALFORMED", detail: "key must look like IC1.<payload>.<signature>" }
  }

  let payload: LicensePayload
  let signature: Buffer
  try {
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"))
    signature = Buffer.from(parts[2], "base64url")
  } catch {
    return { ok: false, reason: "MALFORMED", detail: "payload/signature are not valid base64url JSON" }
  }

  const { type, customer, machineId, issuedAt, expiresAt } = payload ?? {}
  const canonical: LicensePayload = {
    customer,
    machineId: machineId ?? null,
    type,
    issuedAt,
    expiresAt: expiresAt ?? null,
  }

  if (
    (canonical.type !== "perpetual" && canonical.type !== "temporary") ||
    typeof canonical.customer !== "string" || !canonical.customer.trim() ||
    (canonical.machineId !== null && (typeof canonical.machineId !== "string" || !MACHINE_ID_PATTERN.test(canonical.machineId))) ||
    typeof canonical.issuedAt !== "string" || !DATE_PATTERN.test(canonical.issuedAt) ||
    signature.length === 0
  ) {
    return { ok: false, reason: "MALFORMED", detail: "missing or invalid fields" }
  }
  if (canonical.type === "temporary") {
    if (typeof canonical.expiresAt !== "string" || !DATE_PATTERN.test(canonical.expiresAt)) {
      return { ok: false, reason: "MALFORMED", detail: "temporary key requires expiresAt YYYY-MM-DD" }
    }
  } else if (canonical.expiresAt !== null) {
    return { ok: false, reason: "MALFORMED", detail: "perpetual key must not carry expiresAt" }
  }

  const signatureOk = crypto.verify(
    null,
    Buffer.from(canonicalPayload(canonical)),
    crypto.createPublicKey(LICENSE_PUBLIC_KEY_PEM),
    signature
  )
  if (!signatureOk) {
    return { ok: false, reason: "BAD_SIGNATURE", detail: "the key was not signed by the vendor or was modified" }
  }

  if (canonical.machineId && canonical.machineId !== expectedMachineId) {
    return { ok: false, reason: "WRONG_MACHINE", detail: "this key belongs to a different computer" }
  }

  if (canonical.type === "temporary") {
    const endOfDay = new Date(`${canonical.expiresAt}T23:59:59.999`)
    if (Number.isNaN(endOfDay.getTime())) {
      return { ok: false, reason: "MALFORMED", detail: "expiresAt is not a valid date" }
    }
    if (now.getTime() > endOfDay.getTime()) {
      return { ok: false, reason: "EXPIRED", detail: `la licencia expiró el ${canonical.expiresAt}` }
    }
  }

  return { ok: true, payload: canonical }
}
