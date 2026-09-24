import { createHash } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_UPLOAD_DIR = fileURLToPath(new URL('../../uploads/', import.meta.url))
const configuredUploadDir = () => process.env.UPLOAD_DIR || DEFAULT_UPLOAD_DIR

export function uploadPath(milestoneId, root = configuredUploadDir()) {
  const key = createHash('sha256').update(String(milestoneId)).digest('hex')
  return join(root, `${key}.bin`)
}

export async function storeUpload(milestoneId, bytes, root = configuredUploadDir()) {
  await mkdir(root, { recursive: true })
  const path = uploadPath(milestoneId, root)
  await writeFile(path, bytes, { flag: 'wx' })
  return path
}

export async function removeUpload(milestoneId, root = configuredUploadDir()) {
  await rm(uploadPath(milestoneId, root), { force: true })
}
