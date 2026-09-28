import { Router } from 'express'
import {
  confirmMilestone,
  downloadMilestoneFile,
  getMilestone
} from '../controllers/milestone.controller.js'

export const milestoneRouter = Router()

milestoneRouter.get('/:milestoneId', getMilestone)
milestoneRouter.get('/:milestoneId/file', downloadMilestoneFile)
milestoneRouter.post('/:milestoneId/confirmations', confirmMilestone)
