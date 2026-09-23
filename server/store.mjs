import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Tiny JSON-file persistence for the server. Writes go to a temp file and are
 * renamed into place, so a crash mid-write never leaves a half-written file.
 */

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data')

async function readJson(name, fallback) {
  try {
    return JSON.parse(await readFile(join(DATA_DIR, name), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw error
  }
}

async function writeJson(name, value) {
  await mkdir(DATA_DIR, { recursive: true })
  const path = join(DATA_DIR, name)
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2))
  await rename(`${path}.tmp`, path)
}

/** The browser's task list, mirrored here so the digest can read it. null until the first sync. */
export const loadTasks = () => readJson('tasks.json', null)
export const saveTasks = (tasks) => writeJson('tasks.json', tasks)

/** { lastSentOn: 'YYYY-MM-DD' | null, lastSentAt, lastError } */
export const loadDigestState = () =>
  readJson('digest.json', { lastSentOn: null, lastSentAt: null, lastError: null })
export const saveDigestState = (state) => writeJson('digest.json', state)
