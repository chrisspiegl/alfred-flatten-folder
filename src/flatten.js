import { lstat, readdir } from 'node:fs/promises'
import path from 'node:path'
import del from 'del'
import { globby } from 'globby'
import { moveFile } from 'move-file'

const MAX_DUPLICATE_ATTEMPTS = 100

const GLOB_ESCAPE = {
  '\\': '\\\\',
  '*': '\\*',
  '?': '\\?',
  '[': '[[]',
  ']': '[]]',
  '{': '[{]',
  '}': '[}]',
  '(': '\\(',
  ')': '\\)',
  '!': '\\!',
}

export function parseFilePaths(input) {
  if (typeof input !== 'string' || input.trim() === '')
    return []

  return input
    .split('\t')
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0)
}

export function escapeGlobPath(filePath) {
  return filePath.replace(/[\\*?[\]{}()!]/g, character => GLOB_ESCAPE[character])
}

function duplicateDestination(destination, attempt) {
  if (attempt === 0)
    return destination

  return `${destination} duplicate-filename ${attempt}`
}

async function pathExists(filePath) {
  try {
    await lstat(filePath)
    return true
  }
  catch (error) {
    if (error && error.code === 'ENOENT')
      return false

    throw error
  }
}

function isInsideDirectory(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative !== ''
    && relative !== '.'
    && !relative.startsWith(`..${path.sep}`)
    && relative !== '..'
    && !path.isAbsolute(relative)
}

export async function moveFileToDestination(source, destination, maxAttempts = MAX_DUPLICATE_ATTEMPTS) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = duplicateDestination(destination, attempt)
    if (await pathExists(candidate))
      continue

    try {
      await moveFile(source, candidate, { overwrite: false })
      return candidate
    }
    catch (error) {
      if (await pathExists(candidate))
        continue

      throw error
    }
  }

  throw new Error(`Could not move "${source}" because the destination already exists after ${maxAttempts} attempts`)
}

function isHiddenPath(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative.split(path.sep).some(segment => segment.startsWith('.'))
}

async function listMovablePaths(directoryPath) {
  const pattern = `${escapeGlobPath(directoryPath)}/**/*`
  const matches = await globby(pattern, {
    absolute: true,
    dot: false,
    expandDirectories: false,
    followSymbolicLinks: false,
    onlyFiles: true,
  })

  const movable = []
  for (const match of matches) {
    if (isHiddenPath(directoryPath, match))
      continue

    const stats = await lstat(match)
    if (stats.isSymbolicLink() || !stats.isFile())
      continue

    movable.push(match)
  }

  return movable
}

async function remainingUnmovedFiles(directoryPath) {
  const remaining = []

  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isSymbolicLink() || entry.name.startsWith('.'))
        continue

      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }
      remaining.push(fullPath)
    }
  }

  await walk(directoryPath)
  return remaining
}

export async function flattenDirectory(directoryPath) {
  if (typeof directoryPath !== 'string' || directoryPath.trim() === '')
    throw new Error('Refusing to flatten an empty path')

  const resolved = path.resolve(directoryPath)
  let stats
  try {
    stats = await lstat(resolved)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Refusing to flatten "${resolved}": ${message}`)
  }

  if (!stats.isDirectory())
    throw new Error(`Refusing to flatten because it is not a directory: ${resolved}`)

  const parentFolder = path.dirname(resolved)
  const movable = await listMovablePaths(resolved)

  for (const match of movable) {
    if (!isInsideDirectory(resolved, match))
      throw new Error(`Refusing to move a path outside the folder: ${match}`)
  }

  for (const match of movable) {
    const destination = path.join(parentFolder, path.basename(match))
    await moveFileToDestination(match, destination)
  }

  const remaining = await remainingUnmovedFiles(resolved)
  if (remaining.length > 0) {
    throw new Error(`Refusing to delete "${resolved}" because these paths were not moved: ${remaining.join(', ')}`)
  }

  await del(escapeGlobPath(resolved), { force: true })

  if (await pathExists(resolved))
    throw new Error(`Refusing to finish because the folder still exists: ${resolved}`)
}

export async function flattenDirectories(directoryPaths) {
  for (const directoryPath of directoryPaths)
    await flattenDirectory(directoryPath)
}
