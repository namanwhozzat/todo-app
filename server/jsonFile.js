/** Tiny JSON-file persistence for the prototype server. Swap for a database later. */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data')

export function jsonFile(name, fallback) {
  const file = join(DATA_DIR, name)
  return {
    async read() {
      try {
        return JSON.parse(await readFile(file, 'utf8'))
      } catch {
        return structuredClone(fallback)
      }
    },
    async write(value) {
      await mkdir(DATA_DIR, { recursive: true })
      await writeFile(file, JSON.stringify(value, null, 2))
    },
  }
}
