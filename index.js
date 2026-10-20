import process from 'node:process'
import alfy from 'alfy'
import { flattenDirectories, parseFilePaths } from './src/flatten.js'

// alfy prints an empty Script Filter result on exit. This Run Script uses stdout as the notification.
for (const listener of process.listeners('beforeExit'))
  process.removeListener('beforeExit', listener)

async function main() {
  const filePaths = parseFilePaths(alfy.input)

  if (filePaths.length === 0) {
    console.error('Nothing to flatten.')
    process.exitCode = 1
    return
  }

  try {
    await flattenDirectories(filePaths)
    process.stdout.write('Finished flattening folders.\n')
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exitCode = 1
  }
}

void main()
