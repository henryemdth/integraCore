#!/usr/bin/env node
// One-time vendor setup: generates the Ed25519 keypair used to sign customer
// license keys. The private key NEVER leaves this machine and must not be
// committed (gitignored) — losing it means generating a new pair and shipping
// a new build with the new public key. The public key is pasted into
// electron/src/main/license.ts (LICENSE_PUBLIC_KEY_PEM).

import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const dir = path.dirname(fileURLToPath(import.meta.url))
const privatePath = path.join(dir, "private-key.pem")

if (fs.existsSync(privatePath)) {
  console.error(`Refusing to overwrite existing keypair at ${privatePath}.`)
  console.error("If you really need a new pair, delete the file first AND plan to ship")
  console.error("a new build with the new public key (existing keys stop working).")
  process.exit(1)
}

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519")

fs.writeFileSync(
  privatePath,
  privateKey.export({ type: "pkcs8", format: "pem" }),
  { mode: 0o600 }
)

console.log("Private key written to:")
console.log(`  ${privatePath}`)
console.log("  (keep it safe and NEVER commit it — it signs every customer key)")
console.log("")
console.log("Paste this public key into electron/src/main/license.ts:")
console.log("")
console.log(publicKey.export({ type: "spki", format: "pem" }).trim())
