'use strict'

const { Contract } = require('fabric-contract-api')

class ChainProofContract extends Contract {
  async ProjectExists(ctx, projectId) {
    const data = await ctx.stub.getState(this._projectKey(projectId))
    return Boolean(data && data.length > 0)
  }

  async CreateProject(ctx, projectId, name, description, ownerId, membersJson) {
    if (await this.ProjectExists(ctx, projectId)) {
      throw new Error(`Project ${projectId} already exists`)
    }

    const members = JSON.parse(membersJson)
    if (!Array.isArray(members) || members.length === 0) {
      throw new Error('Project must contain at least one member')
    }

    const project = {
      docType: 'project',
      projectId,
      name,
      description,
      ownerId,
      members,
      createdAt: this._txTimestamp(ctx),
      status: 'ACTIVE'
    }

    await ctx.stub.putState(this._projectKey(projectId), Buffer.from(JSON.stringify(project)))
    return JSON.stringify(project)
  }

  async GetProject(ctx, projectId) {
    const data = await ctx.stub.getState(this._projectKey(projectId))
    if (!data || data.length === 0) {
      throw new Error(`Project ${projectId} does not exist`)
    }
    return data.toString()
  }

  async CreateMilestone(ctx, milestoneId, projectId, title, description, fileName, fileHash, contributorsJson) {
    const milestoneKey = this._milestoneKey(milestoneId)
    const existing = await ctx.stub.getState(milestoneKey)
    if (existing && existing.length > 0) {
      throw new Error(`Milestone ${milestoneId} already exists`)
    }
    if (!(await this.ProjectExists(ctx, projectId))) {
      throw new Error(`Project ${projectId} does not exist`)
    }

    const contributors = JSON.parse(contributorsJson)
    this._validateContributors(contributors)

    const milestone = {
      docType: 'milestone',
      milestoneId,
      projectId,
      title,
      description,
      fileName,
      fileHash,
      contributors,
      confirmations: [],
      createdAt: this._txTimestamp(ctx),
      status: 'PENDING_CONFIRMATION'
    }

    await ctx.stub.putState(milestoneKey, Buffer.from(JSON.stringify(milestone)))
    return JSON.stringify(milestone)
  }

  async GetMilestone(ctx, milestoneId) {
    const data = await ctx.stub.getState(this._milestoneKey(milestoneId))
    if (!data || data.length === 0) {
      throw new Error(`Milestone ${milestoneId} does not exist`)
    }
    return data.toString()
  }

  async ConfirmContribution(ctx, milestoneId, memberId, decision) {
    if (!['CONFIRMED', 'REJECTED'].includes(decision)) {
      throw new Error('Decision must be CONFIRMED or REJECTED')
    }

    const milestone = JSON.parse(await this.GetMilestone(ctx, milestoneId))
    const contributorIds = milestone.contributors.map((item) => item.memberId)
    if (!contributorIds.includes(memberId)) {
      throw new Error(`Member ${memberId} is not a contributor to milestone ${milestoneId}`)
    }

    milestone.confirmations = milestone.confirmations.filter((item) => item.memberId !== memberId)
    milestone.confirmations.push({
      memberId,
      decision,
      timestamp: this._txTimestamp(ctx)
    })

    const decisions = new Map(milestone.confirmations.map((item) => [item.memberId, item.decision]))
    const hasRejection = contributorIds.some((id) => decisions.get(id) === 'REJECTED')
    const allConfirmed = contributorIds.every((id) => decisions.get(id) === 'CONFIRMED')

    milestone.status = hasRejection
      ? 'REJECTED'
      : allConfirmed
        ? 'VERIFIED'
        : 'PENDING_CONFIRMATION'

    await ctx.stub.putState(this._milestoneKey(milestoneId), Buffer.from(JSON.stringify(milestone)))
    return JSON.stringify(milestone)
  }

  _validateContributors(contributors) {
    if (!Array.isArray(contributors) || contributors.length === 0) {
      throw new Error('Contributors must be a non-empty array')
    }

    const total = contributors.reduce((sum, item) => sum + Number(item.percentage), 0)
    if (Math.abs(total - 100) > 0.000001) {
      throw new Error('Contribution percentages must sum to 100')
    }
  }

  _projectKey(projectId) {
    return `PROJECT_${projectId}`
  }

  _milestoneKey(milestoneId) {
    return `MILESTONE_${milestoneId}`
  }

  _txTimestamp(ctx) {
    const timestamp = ctx.stub.getTxTimestamp()
    const milliseconds = Number(timestamp.seconds.toString()) * 1000 + Math.floor(timestamp.nanos / 1e6)
    return new Date(milliseconds).toISOString()
  }
}

module.exports = ChainProofContract
