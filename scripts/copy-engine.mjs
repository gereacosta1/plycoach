
import {
  access,
  copyFile,
  mkdir,
  readdir
} from 'node:fs/promises'

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(
  new URL('../', import.meta.url)
)

const pkg = join(root, 'node_modules', 'stockfish')
const target = join(root, 'public', 'engine')

const required = [
  'stockfish-19-lite-single.js',
  'stockfish-19-lite-single.wasm',
  'stockfish-19-asm.js'
]

async function find(start, name, depth = 6) {
  if (depth <= 0) return null

  let entries

  try {
    entries = await readdir(start, {
      withFileTypes: true
    })
  } catch {
    return null
  }

  const match = entries.find(
    entry =>
      entry.isFile() &&
      entry.name === name
  )

  if (match) {
    return join(start, match.name)
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const found = await find(
      join(start, entry.name),
      name,
      depth - 1
    )

    if (found) return found
  }

  return null
}

try {
  await access(pkg)
} catch {
  console.error(
    'No se encuentra Stockfish. Ejecutá npm install.'
  )
  process.exit(1)
}

await mkdir(target, {
  recursive: true
})

for (const filename of required) {
  const source = await find(pkg, filename)

  if (!source) {
    console.error(
      `Falta ${filename}. Revisá la versión de Stockfish.`
    )
    process.exit(1)
  }

  await copyFile(
    source,
    join(target, filename)
  )
}

console.log(
  'Stockfish WASM y ASM listos en public/engine/'
)
