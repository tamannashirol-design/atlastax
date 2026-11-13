// npm run illustrations
// Makes 1x / 2x / 3x WebP copies (68 / 136 / 204px) of the designer's income
// illustrations. Only scales: no cropping (fits inside the box at the original
// proportions), no recoloring, no filters. Originals are never modified.
import { mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const SRC = 'src/assets/illustrations'
const OUT = join(SRC, 'generated')
mkdirSync(OUT, { recursive: true })

for (const file of readdirSync(SRC).filter((f) => /^income-.*\.png$/i.test(f))) {
  const name = file.replace(/(\.png)+$/i, '') // also handles "income-optcpt.png.png"
  // Shown in a 64px box, enlarged 5% (≈67px), so copies are made 5% larger to stay sharp
  for (const [scale, size] of [[1, 68], [2, 136], [3, 204]]) {
    const dest = join(OUT, `${name}@${scale}x.webp`)
    await sharp(join(SRC, file))
      .resize(size, size, { fit: 'inside' })
      .webp({ quality: 90, alphaQuality: 100, effort: 6 })
      .toFile(dest)
    console.log(dest.padEnd(62), String(statSync(dest).size).padStart(6), 'bytes')
  }
}
