'use strict'

/**
 * ChainProof Chaincode
 *
 * 契约来源：
 *   - docs/ARCHITECTURE.md §5 事务函数、§7 贡献确认状态机、§9 Certificate 规则
 *   - docs/API.md          §6 关键实体字段、§7 错误返回
 *
 * 错误约定（供后端 fabric.service.js 映射为 API.md §7 的 error.code）：
 *   链码抛出的 Error.message 一律以 "<CODE>: <中文说明>" 开头，
 *   后端取冒号前的 CODE 即可，无需字符串模糊匹配。
 *   例：`ALREADY_DECIDED: 成员 alice 已经对该里程碑表过态，不能重复提交。`
 */

const { Contract } = require('fabric-contract-api')

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

const PROJECT_PREFIX = 'PROJECT_'
const MILESTONE_PREFIX = 'MILESTONE_'
const CERT_PREFIX = 'CERT_'

/** 项目 -> 里程碑 索引，避免全状态扫描 */
const PROJECT_MILESTONE_INDEX = 'PROJECT_MILESTONE'
/** (projectId, memberId) -> 证书 索引，用于按项目/成员过滤 */
const CERT_INDEX = 'CERT_INDEX'

/** 索引值：Fabric 复合键只需键存在，值写空字节 */
const INDEX_VALUE = Buffer.from('\u0000')

/** 范围查询的结束哨兵 */
const RANGE_END = '\uffff'

const MILESTONE_STATUS = Object.freeze({
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED'
})

/** 关闭态：不再接受任何新表态（ARCHITECTURE §7） */
const CLOSED_MILESTONE_STATUSES = Object.freeze([
  MILESTONE_STATUS.VERIFIED,
  MILESTONE_STATUS.REJECTED
])

const DECISIONS = Object.freeze(['CONFIRMED', 'REJECTED'])

const SHA256_HEX = /^[0-9a-f]{64}$/

// ---------------------------------------------------------------------------
// 业务异常
// ---------------------------------------------------------------------------

/**
 * 携带机器可读 code 的业务异常。
 * 链码在 peer 侧被包装后，message 前缀仍会原样返回给 SDK。
 */
class ChainProofError extends Error {
  constructor (code, message) {
    super(`${code}: ${message}`)
    this.name = 'ChainProofError'
    this.code = code
  }
}

// ---------------------------------------------------------------------------
// 合约
// ---------------------------------------------------------------------------

class ChainProofContract extends Contract {
  constructor () {
    super('ChainProofContract')
  }

  // =========================================================================
  // Project
  // =========================================================================

  /**
   * 判断项目是否存在（API.md 未暴露为 REST 接口，供链内与后端探活使用）。
   * @returns {Promise<boolean>}
   */
  async ProjectExists (ctx, projectId) {
    const data = await ctx.stub.getState(this._projectKey(projectId))
    return Boolean(data && data.length > 0)
  }

  /**
   * 创建项目。
   * @param {string} projectId  不透明字符串 ID
   * @param {string} name
   * @param {string} description
   * @param {string} ownerId
   * @param {string} membersJson string[] 的 JSON
   * @returns {Promise<string>} 完整 Project JSON
   */
  async CreateProject (ctx, projectId, name, description, ownerId, membersJson) {
    this._requireNonEmptyString(projectId, 'projectId')
    this._requireNonEmptyString(name, 'name')
    this._requireNonEmptyString(ownerId, 'ownerId')

    if (await this.ProjectExists(ctx, projectId)) {
      throw new ChainProofError('VALIDATION_ERROR', `项目 ${projectId} 已经存在，不能重复创建。`)
    }

    const members = this._parseJsonArray(membersJson, 'members')
    if (members.length === 0) {
      throw new ChainProofError('VALIDATION_ERROR', '项目至少要有一名成员。')
    }
    members.forEach((memberId, index) => {
      if (typeof memberId !== 'string' || memberId.trim() === '') {
        throw new ChainProofError('VALIDATION_ERROR', `members[${index}] 必须是非空字符串。`)
      }
    })

    const uniqueMembers = [...new Set(members.map((memberId) => memberId.trim()))]
    if (uniqueMembers.length !== members.length) {
      throw new ChainProofError('VALIDATION_ERROR', 'members 中存在重复成员，请去重后重试。')
    }

    const project = {
      docType: 'project',
      projectId,
      name,
      description: description || '',
      ownerId,
      members: uniqueMembers,
      createdAt: this._txTimestamp(ctx),
      status: 'ACTIVE',
      txId: ctx.stub.getTxID()
    }

    await ctx.stub.putState(this._projectKey(projectId), this._toBuffer(project))
    return JSON.stringify(project)
  }

  /**
   * 读取完整项目。
   * @returns {Promise<string>} Project JSON
   */
  async GetProject (ctx, projectId) {
    const project = await this._readProject(ctx, projectId)
    return JSON.stringify(project)
  }

  /**
   * 列出全部项目，供 GET /projects 使用。
   * MVP 规模下按 PROJECT_ 前缀做范围查询。
   * @returns {Promise<string>} Project[] JSON，按 createdAt 正序
   */
  async GetAllProjects (ctx) {
    const projects = await this._rangeQuery(ctx, PROJECT_PREFIX, (record) => record.docType === 'project')
    projects.sort(this._byCreatedAtAsc)
    return JSON.stringify(projects)
  }

  /**
   * 读取项目的链上历史记录（getHistoryForKey）。
   * @returns {Promise<string>} Array<{txId, timestamp, isDelete, value}> JSON
   */
  async GetProjectHistory (ctx, projectId) {
    this._requireNonEmptyString(projectId, 'projectId')
    if (!(await this.ProjectExists(ctx, projectId))) {
      throw new ChainProofError('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在。`)
    }

    const iterator = await ctx.stub.getHistoryForKey(this._projectKey(projectId))
    const history = []
    let result = await iterator.next()

    while (!result.done) {
      const item = result.value
      history.push({
        txId: item.txId || item.tx_id || '',
        timestamp: this._normalizeTimestamp(item.timestamp),
        isDelete: Boolean(item.isDelete || item.is_delete),
        value: this._safeParse(item.value)
      })
      result = await iterator.next()
    }

    await this._closeIterator(iterator)
    return JSON.stringify(history)
  }

  // =========================================================================
  // Milestone
  // =========================================================================

  /**
   * 创建里程碑。
   * @param {string} contributorsJson {memberId, percentage}[] 的 JSON，整数百分比且总和严格为 100
   * @returns {Promise<string>} 完整 Milestone JSON
   */
  async CreateMilestone (ctx, milestoneId, projectId, title, description, fileName, fileHash, contributorsJson) {
    this._requireNonEmptyString(milestoneId, 'milestoneId')
    this._requireNonEmptyString(projectId, 'projectId')
    this._requireNonEmptyString(title, 'title')

    if (await this._milestoneExists(ctx, milestoneId)) {
      throw new ChainProofError('VALIDATION_ERROR', `里程碑 ${milestoneId} 已经存在，不能重复创建。`)
    }

    // 项目不存在优先于其它校验，保证后端拿到 404 而不是 400
    const project = await this._readProject(ctx, projectId)

    if (typeof fileHash !== 'string' || !SHA256_HEX.test(fileHash)) {
      throw new ChainProofError(
        'VALIDATION_ERROR',
        'fileHash 必须是 64 位小写十六进制的 SHA-256 摘要。'
      )
    }

    const contributors = this._validateContributors(contributorsJson)
    const knownMembers = new Set(project.members)
    const outsiders = contributors
      .map((item) => item.memberId)
      .filter((memberId) => !knownMembers.has(memberId))
    if (outsiders.length > 0) {
      throw new ChainProofError(
        'VALIDATION_ERROR',
        `贡献者 ${outsiders.join('、')} 不属于项目 ${projectId} 的成员。`
      )
    }

    const milestone = {
      docType: 'milestone',
      milestoneId,
      projectId,
      title,
      description: description || '',
      fileName: fileName || '',
      fileHash,
      contributors,
      confirmations: [],
      createdAt: this._txTimestamp(ctx),
      status: MILESTONE_STATUS.PENDING_CONFIRMATION,
      txId: ctx.stub.getTxID()
    }

    await ctx.stub.putState(this._milestoneKey(milestoneId), this._toBuffer(milestone))
    await this._indexProjectMilestone(ctx, projectId, milestoneId)

    return JSON.stringify(milestone)
  }

  /**
   * 读取完整里程碑。
   * @returns {Promise<string>} Milestone JSON
   */
  async GetMilestone (ctx, milestoneId) {
    const milestone = await this._readMilestone(ctx, milestoneId)
    return JSON.stringify(milestone)
  }

  /**
   * 列出某项目的全部里程碑，按 createdAt 正序。
   * 项目存在但无里程碑时返回空数组，不报错。
   * @returns {Promise<string>} Milestone[] JSON
   */
  async GetProjectMilestones (ctx, projectId) {
    this._requireNonEmptyString(projectId, 'projectId')
    if (!(await this.ProjectExists(ctx, projectId))) {
      throw new ChainProofError('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在。`)
    }

    const milestoneIds = await this._getIndexedMilestoneIds(ctx, projectId)
    const milestones = []
    for (const milestoneId of milestoneIds) {
      const data = await ctx.stub.getState(this._milestoneKey(milestoneId))
      if (data && data.length > 0) {
        milestones.push(this._parseJson(data, `milestone ${milestoneId}`))
      }
    }

    milestones.sort(this._byCreatedAtAsc)
    return JSON.stringify(milestones)
  }

  /**
   * 成员对里程碑的贡献比例表态。
   *
   * 状态机（ARCHITECTURE §7）：
   *   - 非 contributor          -> MEMBER_NOT_IN_CLAIM
   *   - 里程碑已 VERIFIED/REJECTED -> MILESTONE_CLOSED
   *   - 同一成员已表态            -> ALREADY_DECIDED（不得撤回或改票）
   *   - 任一 REJECTED            -> 立即 REJECTED
   *   - 全部 CONFIRMED           -> VERIFIED
   *   - 其余                     -> PENDING_CONFIRMATION
   *
   * @param {string} decision CONFIRMED | REJECTED
   * @returns {Promise<string>} 更新后的完整 Milestone JSON（含新 confirmations、status、txId）
   */
  async ConfirmContribution (ctx, milestoneId, memberId, decision) {
    this._requireNonEmptyString(milestoneId, 'milestoneId')
    this._requireNonEmptyString(memberId, 'memberId')

    if (!DECISIONS.includes(decision)) {
      throw new ChainProofError('VALIDATION_ERROR', 'decision 只能是 CONFIRMED 或 REJECTED。')
    }

    const milestone = await this._readMilestone(ctx, milestoneId)

    // 1) 关闭态优先判定：已终态的里程碑不接受任何新表态
    if (CLOSED_MILESTONE_STATUSES.includes(milestone.status)) {
      throw new ChainProofError(
        'MILESTONE_CLOSED',
        `里程碑 ${milestoneId} 已处于 ${milestone.status} 状态，不再接受新的表态。`
      )
    }

    // 2) 必须是该里程碑的贡献者
    const contributorIds = milestone.contributors.map((item) => item.memberId)
    if (!contributorIds.includes(memberId)) {
      throw new ChainProofError(
        'MEMBER_NOT_IN_CLAIM',
        `成员 ${memberId} 不在里程碑 ${milestoneId} 的贡献者名单中。`
      )
    }

    // 3) 同一成员只能表态一次
    const alreadyDecided = milestone.confirmations.some((item) => item.memberId === memberId)
    if (alreadyDecided) {
      throw new ChainProofError(
        'ALREADY_DECIDED',
        `成员 ${memberId} 已对里程碑 ${milestoneId} 表过态，不能撤回或改票。`
      )
    }

    milestone.confirmations.push({
      memberId,
      decision,
      timestamp: this._txTimestamp(ctx)
    })

    const decisions = new Map(milestone.confirmations.map((item) => [item.memberId, item.decision]))
    const hasRejection = contributorIds.some((id) => decisions.get(id) === 'REJECTED')
    const allConfirmed = contributorIds.every((id) => decisions.get(id) === 'CONFIRMED')

    if (hasRejection) {
      milestone.status = MILESTONE_STATUS.REJECTED
    } else if (allConfirmed) {
      milestone.status = MILESTONE_STATUS.VERIFIED
    } else {
      milestone.status = MILESTONE_STATUS.PENDING_CONFIRMATION
    }

    milestone.txId = ctx.stub.getTxID()

    await ctx.stub.putState(this._milestoneKey(milestoneId), this._toBuffer(milestone))

    // 状态跃迁到终态时发事件，便于后端/前端订阅刷新
    if (CLOSED_MILESTONE_STATUSES.includes(milestone.status)) {
      ctx.stub.setEvent(
        'MilestoneClosed',
        Buffer.from(JSON.stringify({
          milestoneId,
          projectId: milestone.projectId,
          status: milestone.status,
          txId: milestone.txId
        }))
      )
    }

    return JSON.stringify(milestone)
  }

  // =========================================================================
  // Contribution 统计（API.md §4）
  // =========================================================================

  /**
   * 只统计 VERIFIED 里程碑的贡献分布。
   *
   * 聚合口径（PR #9 契约）：
   *   - 分母为项目全部 VERIFIED 里程碑总数 N（不是成员参与条数）；
   *   - 成员未出现在某条 VERIFIED 里程碑时，该条按 0 计算；
   *   - 返回项目全部成员，未参与任何已验证里程碑的成员返回 percentage: 0；
   *   - 项目无 VERIFIED 里程碑时返回全员 0，basedOnMilestones = 0。
   *
   * 取整用最大余数法（见 _roundContributions），保证整数总和严格为 100。
   *
   * @returns {Promise<string>} {projectId, members:[{memberId, percentage}], basedOnMilestones} JSON
   */
  async GetProjectContributions (ctx, projectId) {
    this._requireNonEmptyString(projectId, 'projectId')
    const project = await this._readProject(ctx, projectId)

    const milestoneIds = await this._getIndexedMilestoneIds(ctx, projectId)
    // 以项目全部成员为全集初始化，保证 0% 成员也会出现在结果中
    const totals = new Map()
    for (const memberId of project.members) {
      totals.set(memberId, { sum: 0 })
    }
    let basedOnMilestones = 0

    // 按 milestoneId UTF-8 字节序遍历后累加，保证各背书节点累加顺序一致
    const sortedMilestoneIds = [...milestoneIds].sort((a, b) => this._compareUtf8ByteOrder(a, b))

    for (const milestoneId of sortedMilestoneIds) {
      const data = await ctx.stub.getState(this._milestoneKey(milestoneId))
      if (!data || data.length === 0) continue

      const milestone = this._parseJson(data, `milestone ${milestoneId}`)
      if (milestone.status !== MILESTONE_STATUS.VERIFIED) continue

      basedOnMilestones += 1
      for (const contributor of milestone.contributors) {
        const current = totals.get(contributor.memberId)
        if (current) {
          current.sum += Number(contributor.percentage)
        }
      }
    }

    // 分母为全部 VERIFIED 里程碑总数 N；传递 sum 给 _roundContributions 做整数运算
    const memberSums = [...totals.entries()]
      .map(([memberId, { sum }]) => ({ memberId, sum }))
      .sort((a, b) => this._compareUtf8ByteOrder(a.memberId, b.memberId))

    const members = this._roundContributions(memberSums, basedOnMilestones)
    return JSON.stringify({ projectId, members, basedOnMilestones })
  }

  /**
   * 最大余数法（Hamilton method）用整数运算分配百分比。
   *
   * 契约（PR #9）：全程整数运算，`floor = sum div N`、`remainder = sum mod N`。
   * 先分配各成员的 floor，再将 `100 - Σfloor` 个剩余百分点按 remainder 降序逐个分配。
   * 余数相同按 memberId UTF-8 字节序升序，保证确定性。
   *
   * @param {Array<{memberId: string, sum: number}>} memberSums 已按 memberId UTF-8 字节序排列
   * @param {number} basedOnMilestones VERIFIED 里程碑总数
   * @returns {Array<{memberId: string, percentage: number}>}
   */
  _roundContributions (memberSums, basedOnMilestones) {
    if (!Array.isArray(memberSums) || memberSums.length === 0) {
      return []
    }

    // N = 0 时全员返回 0
    if (basedOnMilestones === 0) {
      return memberSums.map(({ memberId }) => ({ memberId, percentage: 0 }))
    }

    const N = basedOnMilestones
    const targetSum = 100

    // 严格整数运算：先取余再减再除，全程不经过浮点除法
    const entries = memberSums.map(({ memberId, sum }) => {
      const remainder = sum % N
      const floor = (sum - remainder) / N
      return { memberId, percentage: floor, remainder }
    })

    const floorSum = entries.reduce((sum, item) => sum + item.percentage, 0)
    let remaining = targetSum - floorSum

    if (remaining > 0) {
      // 余数大者优先获得 +1；余数相同则按 memberId UTF-8 字节序升序，保证确定性
      const order = entries
        .map((item, index) => index)
        .sort((a, b) => {
          const diff = entries[b].remainder - entries[a].remainder
          if (diff !== 0) return diff
          return this._compareUtf8ByteOrder(entries[a].memberId, entries[b].memberId)
        })

      for (let i = 0; i < remaining && i < order.length; i += 1) {
        entries[order[i]].percentage += 1
      }
      remaining = 0
    }

    return entries.map(({ memberId, percentage }) => ({ memberId, percentage }))
  }

  // =========================================================================
  // Certificate（ARCHITECTURE §9 / API.md §5）
  // =========================================================================

  /**
   * 签发贡献证明。
   *
   * 规则：
   *   - 项目必须存在，成员必须属于该项目；
   *   - 项目至少有 1 条 VERIFIED 里程碑；
   *   - 同一 (projectId, memberId) 重复请求时返回已存在证书，不产生新的 certificateId；
   *   - 证书保存签发交易 txId。
   *
   * @param {string} certificateId 由后端生成的证书 ID（如 CP-001）；命中幂等时以链上已有值为准
   * @returns {Promise<string>} 完整 Certificate JSON
   */
  async IssueCertificate (ctx, certificateId, projectId, memberId) {
    this._requireNonEmptyString(certificateId, 'certificateId')
    this._requireNonEmptyString(projectId, 'projectId')
    this._requireNonEmptyString(memberId, 'memberId')

    // 幂等优先：同一 projectId + memberId 已有证书则原样返回，不重新检查资格
    const existingId = await this._findCertificateId(ctx, projectId, memberId)
    if (existingId) {
      const existing = await this._readCertificate(ctx, existingId)
      return JSON.stringify(existing)
    }

    const project = await this._readProject(ctx, projectId)

    if (!project.members.includes(memberId)) {
      throw new ChainProofError(
        'VALIDATION_ERROR',
        `成员 ${memberId} 不属于项目 ${projectId}，无法签发贡献证明。`
      )
    }

    const contributions = JSON.parse(await this.GetProjectContributions(ctx, projectId))
    if (contributions.basedOnMilestones === 0) {
      throw new ChainProofError(
        'NO_VERIFIED_CONTRIBUTION',
        '累计贡献比例为 0%，不能签发证书。'
      )
    }

    const memberContribution = contributions.members.find((item) => item.memberId === memberId)
    if (!memberContribution || memberContribution.percentage <= 0) {
      throw new ChainProofError(
        'NO_VERIFIED_CONTRIBUTION',
        '累计贡献比例为 0%，不能签发证书。'
      )
    }

    const milestoneIds = await this._getVerifiedMilestoneIdsForMember(ctx, projectId, memberId)

    const certificate = {
      docType: 'certificate',
      certificateId,
      projectId,
      memberId,
      contributionPercentage: memberContribution.percentage,
      milestoneIds,
      issuedAt: this._txTimestamp(ctx),
      verificationStatus: 'VALID',
      txId: ctx.stub.getTxID()
    }

    await ctx.stub.putState(this._certificateKey(certificateId), this._toBuffer(certificate))
    await ctx.stub.putState(
      ctx.stub.createCompositeKey(CERT_INDEX, [projectId, memberId, certificateId]),
      INDEX_VALUE
    )

    ctx.stub.setEvent('CertificateIssued', Buffer.from(JSON.stringify({
      certificateId,
      projectId,
      memberId,
      txId: certificate.txId
    })))

    return JSON.stringify(certificate)
  }

  /**
   * 公开验证证书。
   * 证书不存在不是错误：返回 verificationStatus = NOT_FOUND（API.md §5）。
   * @returns {Promise<string>} {certificateId, verificationStatus, certificate?} JSON
   */
  async VerifyCertificate (ctx, certificateId) {
    this._requireNonEmptyString(certificateId, 'certificateId')

    const data = await ctx.stub.getState(this._certificateKey(certificateId))
    if (!data || data.length === 0) {
      return JSON.stringify({ certificateId, verificationStatus: 'NOT_FOUND' })
    }

    const certificate = this._parseJson(data, `certificate ${certificateId}`)

    // 与当前链上状态一致性校验：项目仍存在且成员仍属于该项目
    const projectExists = await this.ProjectExists(ctx, certificate.projectId)
    let memberStillInProject = false
    if (projectExists) {
      const project = await this._readProject(ctx, certificate.projectId)
      memberStillInProject = project.members.includes(certificate.memberId)
    }

    const verificationStatus = projectExists && memberStillInProject ? 'VALID' : 'INVALID'

    return JSON.stringify({
      certificateId,
      verificationStatus,
      certificate: { ...certificate, verificationStatus }
    })
  }

  /**
   * 读取单张证书。
   * @returns {Promise<string>} Certificate JSON
   */
  async GetCertificate (ctx, certificateId) {
    const certificate = await this._readCertificate(ctx, certificateId)
    return JSON.stringify(certificate)
  }

  /**
   * 按可选条件列出证书，供 GET /certificates?projectId=&memberId= 使用。
   * 传空字符串表示不过滤。
   * @returns {Promise<string>} Certificate[] JSON，按 issuedAt 正序
   */
  async GetCertificates (ctx, projectId, memberId) {
    const hasProject = typeof projectId === 'string' && projectId.trim() !== ''
    const hasMember = typeof memberId === 'string' && memberId.trim() !== ''

    let certificates
    if (hasProject) {
      const attrs = hasMember ? [projectId.trim(), memberId.trim()] : [projectId.trim()]
      const iterator = await ctx.stub.getStateByPartialCompositeKey(CERT_INDEX, attrs)
      certificates = await this._drainCertificates(iterator, ctx)
    } else {
      // 仅按 memberId 过滤或不过滤：MVP 规模下扫描 CERT_ 前缀
      certificates = await this._rangeQuery(
        ctx,
        CERT_PREFIX,
        (record) => record.docType === 'certificate' && (!hasMember || record.memberId === memberId.trim())
      )
    }

    certificates.sort((a, b) => String(a.issuedAt).localeCompare(String(b.issuedAt)))
    return JSON.stringify(certificates)
  }

  // =========================================================================
  // 内部工具
  // =========================================================================

  async _readProject (ctx, projectId) {
    this._requireNonEmptyString(projectId, 'projectId')
    const data = await ctx.stub.getState(this._projectKey(projectId))
    if (!data || data.length === 0) {
      throw new ChainProofError('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在。`)
    }
    return this._parseJson(data, `project ${projectId}`)
  }

  async _readMilestone (ctx, milestoneId) {
    this._requireNonEmptyString(milestoneId, 'milestoneId')
    const data = await ctx.stub.getState(this._milestoneKey(milestoneId))
    if (!data || data.length === 0) {
      throw new ChainProofError('MILESTONE_NOT_FOUND', `里程碑 ${milestoneId} 不存在。`)
    }
    return this._parseJson(data, `milestone ${milestoneId}`)
  }

  async _readCertificate (ctx, certificateId) {
    this._requireNonEmptyString(certificateId, 'certificateId')
    const data = await ctx.stub.getState(this._certificateKey(certificateId))
    if (!data || data.length === 0) {
      throw new ChainProofError('CERTIFICATE_NOT_FOUND', `证书 ${certificateId} 不存在。`)
    }
    return this._parseJson(data, `certificate ${certificateId}`)
  }

  async _milestoneExists (ctx, milestoneId) {
    const data = await ctx.stub.getState(this._milestoneKey(milestoneId))
    return Boolean(data && data.length > 0)
  }

  async _indexProjectMilestone (ctx, projectId, milestoneId) {
    const key = ctx.stub.createCompositeKey(PROJECT_MILESTONE_INDEX, [projectId, milestoneId])
    await ctx.stub.putState(key, INDEX_VALUE)
  }

  async _getIndexedMilestoneIds (ctx, projectId) {
    const iterator = await ctx.stub.getStateByPartialCompositeKey(PROJECT_MILESTONE_INDEX, [projectId])
    const ids = []
    let result = await iterator.next()

    while (!result.done) {
      const { attributes } = ctx.stub.splitCompositeKey(result.value.key)
      // attributes = [projectId, milestoneId]
      if (attributes && attributes.length === 2) {
        ids.push(attributes[1])
      }
      result = await iterator.next()
    }

    await this._closeIterator(iterator)
    return ids
  }

  async _findCertificateId (ctx, projectId, memberId) {
    const iterator = await ctx.stub.getStateByPartialCompositeKey(CERT_INDEX, [projectId, memberId])
    let certificateId = null
    let result = await iterator.next()

    while (!result.done) {
      const { attributes } = ctx.stub.splitCompositeKey(result.value.key)
      // attributes = [projectId, memberId, certificateId]
      if (attributes && attributes.length === 3) {
        certificateId = attributes[2]
        break
      }
      result = await iterator.next()
    }

    await this._closeIterator(iterator)
    return certificateId
  }

  async _getVerifiedMilestoneIdsForMember (ctx, projectId, memberId) {
    const milestoneIds = await this._getIndexedMilestoneIds(ctx, projectId)
    const verified = []

    for (const milestoneId of milestoneIds) {
      const data = await ctx.stub.getState(this._milestoneKey(milestoneId))
      if (!data || data.length === 0) continue

      const milestone = this._parseJson(data, `milestone ${milestoneId}`)
      if (milestone.status !== MILESTONE_STATUS.VERIFIED) continue

      // 只保留该成员在该里程碑中 percentage > 0 的记录
      const contributor = milestone.contributors.find((item) => item.memberId === memberId)
      if (!contributor || contributor.percentage <= 0) continue

      verified.push({ milestoneId, createdAt: milestone.createdAt })
    }

    // 契约要求：按 createdAt 正序，时间相同再按 milestoneId 升序
    verified.sort((a, b) => {
      const timeDiff = String(a.createdAt).localeCompare(String(b.createdAt))
      if (timeDiff !== 0) return timeDiff
      return String(a.milestoneId).localeCompare(String(b.milestoneId))
    })

    return verified.map((item) => item.milestoneId)
  }

  async _drainCertificates (iterator, ctx) {
    const certificates = []
    let result = await iterator.next()

    while (!result.done) {
      const { attributes } = ctx.stub.splitCompositeKey(result.value.key)
      if (attributes && attributes.length === 3) {
        const data = await ctx.stub.getState(this._certificateKey(attributes[2]))
        if (data && data.length > 0) {
          certificates.push(this._parseJson(data, `certificate ${attributes[2]}`))
        }
      }
      result = await iterator.next()
    }

    await this._closeIterator(iterator)
    return certificates
  }

  /**
   * 按前缀做范围查询并按谓词过滤。MVP 数据量小，扫描成本可接受。
   */
  async _rangeQuery (ctx, prefix, predicate) {
    const iterator = await ctx.stub.getStateByRange(prefix, prefix + RANGE_END)
    const records = []
    let result = await iterator.next()

    while (!result.done) {
      const { key, value } = result.value
      if (value && value.length > 0 && key.startsWith(prefix)) {
        const record = this._safeParse(value)
        if (record && predicate(record)) {
          records.push(record)
        }
      }
      result = await iterator.next()
    }

    await this._closeIterator(iterator)
    return records
  }

  async _closeIterator (iterator) {
    if (iterator && typeof iterator.close === 'function') {
      try {
        await iterator.close()
      } catch (error) {
        // 迭代器关闭失败不影响业务结果，忽略
      }
    }
  }

  /**
   * 校验贡献者列表（ARCHITECTURE §7）：
   *   - 非空数组
   *   - 每项含非空 memberId 与整数 percentage
   *   - memberId 不得重复
   *   - percentage 总和严格等于 100
   */
  _validateContributors (contributorsJson) {
    const contributors = this._parseJsonArray(contributorsJson, 'contributors')
    if (contributors.length === 0) {
      throw new ChainProofError('VALIDATION_ERROR', 'contributors 不能为空，至少需要一名贡献者。')
    }

    const seen = new Set()
    const normalized = contributors.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new ChainProofError('VALIDATION_ERROR', `contributors[${index}] 必须是对象。`)
      }

      const memberId = typeof item.memberId === 'string' ? item.memberId.trim() : ''
      if (memberId === '') {
        throw new ChainProofError('VALIDATION_ERROR', `contributors[${index}].memberId 必须是非空字符串。`)
      }
      if (seen.has(memberId)) {
        throw new ChainProofError('VALIDATION_ERROR', `contributors 中成员 ${memberId} 重复出现。`)
      }
      seen.add(memberId)

      const percentage = item.percentage
      if (typeof percentage !== 'number' || !Number.isInteger(percentage)) {
        throw new ChainProofError(
          'VALIDATION_ERROR',
          `contributors[${index}].percentage 必须是整数，当前值：${String(percentage)}。`
        )
      }
      if (percentage < 0 || percentage > 100) {
        throw new ChainProofError(
          'VALIDATION_ERROR',
          `contributors[${index}].percentage 必须在 0 到 100 之间，当前值：${percentage}。`
        )
      }

      return { memberId, percentage }
    })

    const total = normalized.reduce((sum, item) => sum + item.percentage, 0)
    if (total !== 100) {
      throw new ChainProofError(
        'CONTRIBUTION_TOTAL_INVALID',
        `贡献比例总和是 ${total}%，必须正好是 100%。`
      )
    }

    return normalized
  }

  _parseJsonArray (raw, fieldName) {
    if (Array.isArray(raw)) {
      return raw
    }
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new ChainProofError('VALIDATION_ERROR', `${fieldName} 必须是 JSON 数组字符串。`)
    }

    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch (error) {
      throw new ChainProofError('VALIDATION_ERROR', `${fieldName} 不是合法 JSON：${error.message}`)
    }
    if (!Array.isArray(parsed)) {
      throw new ChainProofError('VALIDATION_ERROR', `${fieldName} 必须是 JSON 数组。`)
    }
    return parsed
  }

  _parseJson (buffer, label) {
    try {
      return JSON.parse(buffer.toString('utf8'))
    } catch (error) {
      throw new ChainProofError('INTERNAL_ERROR', `${label} 的链上数据损坏，无法解析：${error.message}`)
    }
  }

  _safeParse (buffer) {
    try {
      return JSON.parse(buffer.toString('utf8'))
    } catch (error) {
      return null
    }
  }

  _requireNonEmptyString (value, fieldName) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new ChainProofError('VALIDATION_ERROR', `${fieldName} 必须是非空字符串。`)
    }
  }

  _projectKey (projectId) {
    return `${PROJECT_PREFIX}${projectId}`
  }

  _milestoneKey (milestoneId) {
    return `${MILESTONE_PREFIX}${milestoneId}`
  }

  _certificateKey (certificateId) {
    return `${CERT_PREFIX}${certificateId}`
  }

  _toBuffer (value) {
    return Buffer.from(JSON.stringify(value))
  }

  _byCreatedAtAsc (a, b) {
    return String(a.createdAt).localeCompare(String(b.createdAt))
  }

  /**
   * UTF-8 字节序比较（确定性要求）。
   * 链码必须在所有背书节点上产出完全一致的结果，localeCompare() 依赖 locale 设置，
   * 可能导致各节点结果不同。改用 Buffer.compare 按 UTF-8 字节值逐字节比较。
   */
  _compareUtf8ByteOrder (a, b) {
    return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  }

  /**
   * 确定性交易时间戳：只依赖区块时间，不使用 Date.now()，
   * 保证各背书节点执行结果一致（endorsement policy 要求）。
   */
  _txTimestamp (ctx) {
    const timestamp = ctx.stub.getTxTimestamp()
    if (!timestamp) {
      return new Date(0).toISOString()
    }

    const secondsRaw = timestamp.seconds
    const seconds = Number(
      secondsRaw && typeof secondsRaw.toString === 'function' ? secondsRaw.toString() : secondsRaw
    ) || 0
    const nanos = Number(timestamp.nanos) || 0

    return new Date(seconds * 1000 + Math.floor(nanos / 1e6)).toISOString()
  }

  _normalizeTimestamp (timestamp) {
    if (!timestamp) {
      return ''
    }
    const secondsRaw = timestamp.seconds
    const seconds = Number(
      secondsRaw && typeof secondsRaw.toString === 'function' ? secondsRaw.toString() : secondsRaw
    ) || 0
    const nanos = Number(timestamp.nanos) || 0
    return new Date(seconds * 1000 + Math.floor(nanos / 1e6)).toISOString()
  }
}

module.exports = ChainProofContract
module.exports.ChainProofError = ChainProofError
module.exports.MILESTONE_STATUS = MILESTONE_STATUS
module.exports.CLOSED_MILESTONE_STATUSES = CLOSED_MILESTONE_STATUSES
