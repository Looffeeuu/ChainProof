import { Router } from 'express'
import { createProject, getProject } from '../controllers/project.controller.js'

export const projectRouter = Router()

projectRouter.post('/', createProject)
projectRouter.get('/:projectId', getProject)
