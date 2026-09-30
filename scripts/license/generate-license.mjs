#!/usr/bin/env node
// Vendor tool: signs a machine-locked license key for one customer install
// and PRINTS the value to paste into the customer's config.json:
//
//   "LICENSE_KEY": "<printed string>"
//
//   node scripts/license/generate-license.mjs --customer "Ferretería Pérez" --machine-id <64-hex-id>
//   node scripts/license/generate-license.mjs --customer "ACME" --machine-id <id> --type temporary --expires 2027-09-30
//
// Perpetual keys (default) never expire. Temporary keys are valid through
// the END of the --expires date and lock the app again after it. Requires
// scripts/license/private-key.pem (see generate-keys.mjs).

import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const dir = path.dirname(fileURLToPath(import.meta.url))
const privatePath = path.join(dir, "private-key.pem")

function parseArgs(argv) {
  const args = { type: "perpetual", expires: null, customer: null, machineId: null }
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]
    if (!key.startsWith("--")) continue
    const value = argv[i + 1]
    switch (key) {
      case "--customer": args.customer = value; i++; break
      case "--machine-id": args.machineId = value?.toLowerCase(); i++; break
      case "--type": args.type = value; i++; break
      case "--expires": args.expires = value; i++; break
    }
  }
  return args
}

const args = parseArgs(process.argv.slice(2))
const errors = []
if (!args.customer) errors.push("--customer is required")
if (args.machineId !== null && args.machineId !== undefined && !/^[0-9a-f]{64}$/.test(args.machineId)) {
  errors.push("--machine-id must be the 64-hex character ID shown on the customer's locked screen")
}
if (args.machineId == null) errors.push("--machine-id is required (the ID shown on the customer's screen)")
if (!["perpetual", "temporary"].includes(args.type)) errors.push("--type must be 'perpetual' or 'temporary'")
if (args.type === "temporary" && !/^\d{4}-\d{2}-\d{2}$/.test(args.expires ?? "")) {
  errors.push("--expires YYYY-MM-DD is required for temporary keys")
}
if (args.type === "perpetual" && args.expires) errors.push("--expires only applies to temporary keys")
if (errors.length) {
  console.error("Error(s):\n  " + errors.join("\n  "))
  process.exit(1)
}

if (!fs.existsSync(privatePath)) {
  console.error(`Vendor private key not found at ${privatePath}.`)
  console.error("Run generate-keys.mjs once, then paste the public key into electron/src/main/license.ts.")
  process.exit(1)
}

const payload = {
  customer: args.customer,
  machineId: args.machineId,
  type: args.type,
  issuedAt: new Date().toISOString().slice(0, 10),
  expiresAt: args.type === "temporary" ? args.expires : null,
}

// Must match electron/src/main/license.ts canonicalPayload exactly.
const canonical = JSON.stringify({
  customer: payload.customer,
  expiresAt: payload.expiresAt,
  issuedAt: payload.issuedAt,
  machineId: payload.machineId,
  type: payload.type,
})
const privateKey = crypto.createPrivateKey(fs.readFileSync(privatePath))
const signature = crypto.sign(null, Buffer.from(canonical), privateKey).toString("base64url")

const key = `IC1.${Buffer.from(canonical).toString("base64url")}.${signature}`

console.log("Add this to the customer's config.json and restart the app:")
console.log("")
console.log(`  "LICENSE_KEY": "${key}"`)
console.log("")
console.log(`  customer : ${payload.customer}`)
console.log(`  type     : ${payload.type}${payload.expiresAt ? ` (through ${payload.expiresAt}, inclusive)` : ""}`)
console.log(`  machine  : ${payload.machineId.slice(0, 16)}…`)
console.log("This key only activates the machine above.")
