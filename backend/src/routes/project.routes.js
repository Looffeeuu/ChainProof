import { Router } from 'express'
import multer from 'multer'
import { createProject, getProject, listProjects } from '../controllers/project.controller.js'
import {
  createMilestone,
  getContributions,
  listMilestones
} from '../controllers/milestone.controller.js'

export const projectRouter = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 }
})

projectRouter.get('/', listProjects)
projectRouter.post('/', createProject)
projectRouter.get('/:projectId/milestones', listMilestones)
projectRouter.post('/:projectId/milestones', upload.single('file'), createMilestone)
projectRouter.get('/:projectId/contributions', getContributions)
projectRouter.get('/:projectId', getProject)
