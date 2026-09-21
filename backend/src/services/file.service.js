import multer from 'multer'
import { mkdirSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fabricConfig } from '../config/fabric.config.js'

const uploadDir = fabricConfig.uploadDir
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ts = Date.now()
    const ext = extname(file.originalname)
    cb(null, `${ts}-${file.originalname.replace(ext, '')}${ext}`)
  },
})

export const upload = multer({ storage })

export function getUploadedFilePath (req) {
  if (!req.file) return null
  return req.file.path
}
