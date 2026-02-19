import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { unlink } from 'node:fs/promises'

export async function calculateFileHashFromPath(filePath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)

    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

export async function deleteFileIfExists(filePath: string): Promise<void> {
  try {
    await unlink(filePath)
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return
    }
    throw error
  }
}
