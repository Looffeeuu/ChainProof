import { Router } from 'express'
import multer from 'multer'
import {
  createProject,
  getProject,
  getProjectHistory,
  listProjects
} from '../controllers/project.controller.js'
import { issueCertificate } from '../controllers/certificate.controller.js'
import {
  createMilestone,
  getContributions,
  listMilestones
} from '../controllers/milestone.controller.js'

export const projectRouter = Router()
// 浏览器在 multipart 的 filename 参数里直接发送 UTF-8 字节；multer 默认按 latin1
// 解码，中文文件名会变成「ç­”è¾©…」并原样写进链上的 fileName，下载时也是乱码。
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  defParamCharset: 'utf8'
})

projectRouter.get('/', listProjects)
projectRouter.post('/', createProject)
projectRouter.get('/:projectId/milestones', listMilestones)
projectRouter.post('/:projectId/milestones', upload.single('file'), createMilestone)
projectRouter.get('/:projectId/contributions', getContributions)
projectRouter.get('/:projectId/history', getProjectHistory)
projectRouter.post('/:projectId/certificates', issueCertificate)
projectRouter.get('/:projectId', getProject)
