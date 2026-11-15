// npm run illustrations
//
// 1. Normalize: for each designer illustration (src/assets/illustrations/income-*.png
//    and documents-*.png),
//    trim the fully transparent border, scale the artwork to fit a 384px square
//    with equal padding (~8%), and save to illustrations/normalized/.
//    No redrawing, recoloring, or filters. Originals are never modified.
// 2. Export: 96 / 192 / 288px WebP copies of the normalized files (the icon box
//    is 96px on iPad/laptop, 80px on phone) into illustrations/generated/.
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const SRC = 'src/assets/illustrations'
const NORM = join(SRC, 'normalized')
const OUT = join(SRC, 'generated')
const SIZE = 384
const CONTENT = 322 // 384 − 2 × 31 → ~8% padding on every side
const EXPORTS = [96, 192, 288]

mkdirSync(NORM, { recursive: true })
rmSync(OUT, { recursive: true, force: true }) // only ever holds files made by this script
mkdirSync(OUT, { recursive: true })

for (const file of readdirSync(SRC).filter((f) => /^(income|documents)-.*\.png$/i.test(f))) {
  const name = file.replace(/(\.png)+$/i, '') // also handles "income-optcpt.png.png"

  // Bounding box of every pixel that isn't fully transparent
  const { data, info } = await sharp(join(SRC, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[(y * info.width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
  const box = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }

  // Trim → fit inside 322×322 → center on a transparent 384×384 square
  const art = await sharp(join(SRC, file)).extract(box).resize(CONTENT, CONTENT, { fit: 'inside' }).png().toBuffer()
  const { width: w, height: h } = await sharp(art).metadata()
  const normalized = join(NORM, `${name}.png`)
  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: art, left: Math.round((SIZE - w) / 2), top: Math.round((SIZE - h) / 2) }])
    .png({ compressionLevel: 9 })
    .toFile(normalized)
  console.log(`${name.padEnd(20)} trimmed ${info.width}×${info.height} → ${box.width}×${box.height}, artwork ${w}×${h} in ${SIZE}×${SIZE}`)

  for (const px of EXPORTS) {
    const dest = join(OUT, `${name}-${px}.webp`)
    await sharp(normalized).resize(px, px).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(dest)
  }
}
const kb = readdirSync(OUT).reduce((n, f) => n + statSync(join(OUT, f)).size, 0) / 1024
console.log(`exports: ${readdirSync(OUT).length} WebP files, ${kb.toFixed(0)} KB total`)
