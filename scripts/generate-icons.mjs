// Regenerates every brand icon asset from the master PNG (assets/brand/icon.png).
// The Server-edition outputs additionally composite the badge in icon-server-overlay.svg.
// Run via `npm run icons` after a design change; the generated files are committed,
// so builds and CI never need to run this.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import png2icons from "png2icons"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const masterPngPath = path.join(rootDir, "assets", "brand", "icon.png")
const serverOverlayPath = path.join(rootDir, "assets", "brand", "icon-server-overlay.svg")
const MASTER_SIZE = 1024

// The master is a full-bleed square; every output gets ~22% rounded corners with
// transparent cutouts — except apple-touch-icon, since iOS masks its own corners.
const TILE_RADIUS = 228

function roundedRectMask(size, radius) {
  return Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`,
  )
}

async function renderSource({ rounded = true, server = false } = {}) {
  const base = sharp(masterPngPath).resize(MASTER_SIZE, MASTER_SIZE)
  const composites = []
  if (server) composites.push({ input: fs.readFileSync(serverOverlayPath), blend: "over" })
  if (rounded) composites.push({ input: roundedRectMask(MASTER_SIZE, TILE_RADIUS), blend: "dest-in" })
  if (composites.length === 0) return base.png().toBuffer()
  return base.composite(composites).png().toBuffer()
}

function writeIco(pngBuffer, outPath, { forWinExe }) {
  const ico = png2icons.createICO(pngBuffer, png2icons.BICUBIC, 0, !forWinExe, forWinExe)
  if (!ico) throw new Error(`png2icons failed to create ${outPath}`)
  fs.writeFileSync(outPath, ico)
}

async function writePng(source, outPath, size) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  await sharp(source).resize(size, size).png().toFile(outPath)
  console.log(`wrote ${path.relative(rootDir, outPath)} (${size}x${size})`)
}

async function main() {
  const rounded = await renderSource({ rounded: true })
  const fullBleed = await renderSource({ rounded: false })
  const serverRounded = await renderSource({ rounded: true, server: true })

  await writePng(rounded, path.join(rootDir, "electron", "build", "icon.png"), 512)
  await writePng(rounded, path.join(rootDir, "frontend", "public", "icons", "icon-192.png"), 192)
  await writePng(rounded, path.join(rootDir, "frontend", "public", "icons", "icon-512.png"), 512)
  await writePng(rounded, path.join(rootDir, "frontend", "src", "assets", "brand-mark.png"), 256)
  await writePng(fullBleed, path.join(rootDir, "frontend", "public", "icons", "apple-touch-icon.png"), 180)
  await writePng(serverRounded, path.join(rootDir, "electron", "build", "icon-server.png"), 512)

  const icoOutputs = [
    { file: path.join(rootDir, "electron", "build", "icon.ico"), forWinExe: true },
    { file: path.join(rootDir, "electron", "build", "icon-server.ico"), forWinExe: true },
    { file: path.join(rootDir, "frontend", "public", "favicon.ico"), forWinExe: false },
  ]
  for (const { file, forWinExe } of icoOutputs) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    writeIco(rounded, file, { forWinExe })
    console.log(`wrote ${path.relative(rootDir, file)} (multi-size 16-256)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
