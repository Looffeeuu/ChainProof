import { Router } from 'express'
import { createProject, getProject, listProjects } from '../controllers/project.controller.js'

export const projectRouter = Router()

projectRouter.get('/', listProjects)
projectRouter.post('/', createProject)
projectRouter.get('/:projectId', getProject)
