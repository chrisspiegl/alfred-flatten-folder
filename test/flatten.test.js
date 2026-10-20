import assert from 'node:assert/strict'
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test' // eslint-disable-line test/no-import-node-test -- node --test is the project runner
import { escapeGlobPath, flattenDirectories, flattenDirectory, moveFileToDestination, parseFilePaths } from '../src/flatten.js'

async function withTempDirectory(run) {
  const directory = await mkdtemp(path.join(tmpdir(), 'alfred-flatten-folder-'))
  try {
    await run(directory)
  }
  finally {
    await chmod(directory, 0o755).catch(() => {})
    await rm(directory, { recursive: true, force: true })
  }
}

function readText(filePath) {
  return readFile(filePath, 'utf8')
}

test('treats blank tab-separated input as empty', () => {
  assert.deepEqual(parseFilePaths(''), [])
  assert.deepEqual(parseFilePaths('\t'), [])
  assert.deepEqual(parseFilePaths(' \t \t '), [])
  assert.deepEqual(parseFilePaths('/tmp/a\t/tmp/b'), ['/tmp/a', '/tmp/b'])
  assert.deepEqual(parseFilePaths('/tmp/a\t\t/tmp/b '), ['/tmp/a', '/tmp/b'])
})

test('escapes glob characters in a folder path', () => {
  assert.equal(escapeGlobPath('/tmp/dir[name]/*.txt'), '/tmp/dir[[]name[]]/\\*.txt')
})

test('does not leave dotfiles or symlinks in the parent, and does not follow symlinks', async () => {
  await withTempDirectory(async (root) => {
    const parent = path.join(root, 'parent')
    const folder = path.join(parent, 'folder')
    const nested = path.join(folder, 'nested')
    const outside = path.join(root, 'outside')
    const outsideFile = path.join(outside, 'secret.txt')
    await mkdir(nested, { recursive: true })
    await mkdir(outside, { recursive: true })
    await writeFile(path.join(folder, '.hidden'), 'dot')
    await writeFile(path.join(nested, 'visible.txt'), 'visible')
    await writeFile(outsideFile, 'stay')
    await symlink(outside, path.join(nested, 'dir-link'))
    await symlink(outsideFile, path.join(folder, 'file-link'))

    await flattenDirectory(folder)

    assert.equal(await readText(path.join(parent, 'visible.txt')), 'visible')
    await assert.rejects(lstat(path.join(parent, '.hidden')), { code: 'ENOENT' })
    await assert.rejects(lstat(path.join(parent, 'dir-link')), { code: 'ENOENT' })
    await assert.rejects(lstat(path.join(parent, 'file-link')), { code: 'ENOENT' })
    await assert.rejects(lstat(folder), { code: 'ENOENT' })
    assert.equal(await readText(outsideFile), 'stay')
    await lstat(outside)
    await assert.rejects(lstat(path.join(parent, 'secret.txt')), { code: 'ENOENT' })
  })
})

test('flattens a folder whose name contains glob characters', async () => {
  await withTempDirectory(async (root) => {
    const folder = path.join(root, 'dir[name]')
    const decoy = path.join(root, 'dirn')
    await mkdir(path.join(folder, 'nested'), { recursive: true })
    await mkdir(decoy)
    await writeFile(path.join(folder, 'nested', 'keep.txt'), 'kept')
    await writeFile(path.join(folder, 'nested', '.keep'), 'hidden')
    await writeFile(path.join(decoy, 'secret.txt'), 'stay')

    await flattenDirectory(folder)

    assert.equal(await readText(path.join(root, 'keep.txt')), 'kept')
    await assert.rejects(lstat(path.join(root, '.keep')), { code: 'ENOENT' })
    assert.equal(await readText(path.join(decoy, 'secret.txt')), 'stay')
    await assert.rejects(lstat(folder), { code: 'ENOENT' })
  })
})

test('adds a duplicate suffix when the destination exists and stops at the cap', async () => {
  await withTempDirectory(async (root) => {
    const folder = path.join(root, 'folder')
    await mkdir(folder)
    const source = path.join(folder, 'note.txt')
    await writeFile(source, 'moved')
    await writeFile(path.join(root, 'note.txt'), 'original')

    await flattenDirectory(folder)

    assert.equal(await readText(path.join(root, 'note.txt')), 'original')
    assert.equal(await readText(path.join(root, 'note.txt duplicate-filename 1')), 'moved')
    await assert.rejects(lstat(folder), { code: 'ENOENT' })
  })
})

test('does not delete the folder when every destination name is taken', async () => {
  await withTempDirectory(async (root) => {
    const folder = path.join(root, 'folder')
    await mkdir(folder)
    const source = path.join(folder, 'note.txt')
    await writeFile(source, 'stay-inside')
    await writeFile(path.join(root, 'note.txt'), 'taken')
    for (let attempt = 1; attempt < 100; attempt++)
      await writeFile(path.join(root, `note.txt duplicate-filename ${attempt}`), 'taken')

    await assert.rejects(
      moveFileToDestination(source, path.join(root, 'note.txt'), 3),
      /destination already exists/,
    )
    assert.equal(await readText(source), 'stay-inside')

    await assert.rejects(flattenDirectory(folder), /destination already exists|not moved/)
    assert.equal(await readText(source), 'stay-inside')
    await lstat(folder)
  })
})

test('refuses a file and an empty path', async () => {
  await withTempDirectory(async (root) => {
    const filePath = path.join(root, 'note.txt')
    await writeFile(filePath, 'keep')

    await assert.rejects(flattenDirectory(filePath), /not a directory/)
    assert.equal(await readText(filePath), 'keep')
    await assert.rejects(flattenDirectory(''), /empty path/)
    await assert.rejects(flattenDirectory('   '), /empty path/)
    await assert.rejects(flattenDirectory('\t'), /empty path/)
  })
})

test('does not delete the folder when a move fails for another reason', async () => {
  await withTempDirectory(async (root) => {
    const parent = path.join(root, 'parent')
    const folder = path.join(parent, 'folder')
    await mkdir(folder, { recursive: true })
    const source = path.join(folder, 'note.txt')
    await writeFile(source, 'keep')
    await chmod(parent, 0o555)

    try {
      await assert.rejects(flattenDirectory(folder))
      assert.equal(await readText(source), 'keep')
      await lstat(folder)
    }
    finally {
      await chmod(parent, 0o755)
    }
  })
})

test('flattens each selected folder', async () => {
  await withTempDirectory(async (root) => {
    const first = path.join(root, 'first')
    const second = path.join(root, 'second')
    await mkdir(path.join(first, 'nested'), { recursive: true })
    await mkdir(second)
    await writeFile(path.join(first, 'nested', 'a.txt'), 'a')
    await writeFile(path.join(second, 'b.txt'), 'b')
    await writeFile(path.join(second, '.b'), 'hidden')

    await flattenDirectories([first, second])

    assert.equal(await readText(path.join(root, 'a.txt')), 'a')
    assert.equal(await readText(path.join(root, 'b.txt')), 'b')
    await assert.rejects(lstat(path.join(root, '.b')), { code: 'ENOENT' })
    await assert.rejects(lstat(first), { code: 'ENOENT' })
    await assert.rejects(lstat(second), { code: 'ENOENT' })
  })
})
